import Groq, { toFile } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { config } from "./config";

const GROQ_TEXT_MODEL = config.groqTextModel ?? "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = config.groqVisionModel ?? "llama-3.2-11b-vision-preview";
const GEMINI_MODEL = config.geminiModel ?? "gemini-2.0-flash"; 

const groq = new Groq({ apiKey: config.groqApiKey });
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const geminiModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.2,
    maxOutputTokens: 1000,
  }
});

const DEFAULT_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} time out after ${ms} ms`)), ms)
    )
  ]);
}

const MealItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["discrete", "volume", "packaged"]),
  unit: z.enum(["piece", "katori", "bowl", "plate", "packet"]),
  default_quantity: z.number().positive(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().min(1),
});

const MealParseResponseSchema = z.object({
  items: z.array(MealItemSchema), 
});
export type MealItem = z.infer<typeof MealItemSchema>;

const MacroItemSchema = z.object({
  name: z.string().min(1),
  quantity_text: z.string(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
});

const MacroResponseSchema = z.object({ items: z.array(MacroItemSchema) });
export type MacroItem = z.infer<typeof MacroItemSchema>;

class AIServiceError extends Error {
  constructor(userMessage: string, cause: unknown) {
    super(userMessage, { cause });
    this.name = "AIServiceError";
  }
}

function logServerError(context: string, error: unknown) {
  console.error(JSON.stringify({ level: "error", context, error: String(error), timestamp: new Date().toISOString() }));
}

function extractJson(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No valid JSON data found");
  return JSON.parse(jsonMatch[0]);
}

async function callAIWithFallback(
  groqMessages: any[],
  geminiPrompt: any[],
  groqModel: string
): Promise<string> {
  try {
    const response = await withTimeout(
      groq.chat.completions.create({
        model: groqModel,
        messages: groqMessages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1024,
      }), 
      DEFAULT_TIMEOUT_MS,
      "Groq request"
    );
    return response.choices[0].message.content || "";
  } catch (groqError) {
    logServerError("Groq API failed", groqError);
    try {
      const result = await withTimeout(
        geminiModel.generateContent(geminiPrompt),
        DEFAULT_TIMEOUT_MS,
        "Gemini request"
      );
      return result.response.text();
    } catch (geminiError: any) {
      logServerError("gemini_call_failed", geminiError);
      if (geminiError.status === 429 || geminiError.message?.includes("429")) {
        throw new AIServiceError("AI is currently busy, Please try again in 1 minutes", geminiError);
      }
      throw new AIServiceError("We could not process that right now, Please try again later", geminiError);
    }
  }
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 2000;

function validateImageData(imageData: string): { mimeType: string; base64Data: string } {
  const mimeType = imageData.split(";")[0]?.split(":")[1];
  if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new AIServiceError(`Unsupported image type: ${mimeType}. Allowed types: ${Array.from(ALLOWED_IMAGE_MIME_TYPES).join(", ")}`, null);
  }
  const base64Data = imageData.split(",")[1] || imageData;
  const approxBytes = (base64Data.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new AIServiceError(`Image size exceeds limit of ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`, null);
  }
  return { mimeType, base64Data };
}

function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

// Step 1: Parse a meal photo/text into categorized DRAFT items.
export async function parseMealWithAI(description: string, imageData?: string): Promise<any[]> {
  const cleanDescription = description ? sanitizeText(description) : "";

  const promptText = `You are a food identification assistant for an Indian food app. You will be shown a photo of a meal and/or a text description.
 
Do NOT calculate calories. Your job is ONLY to identify the food and categorize its UI measurement unit.
 
STEP 1 — IDENTIFY each distinct food item (use standard Indian names).
STEP 2 — CATEGORIZE each item into ONE of these three categories:
1. "discrete" (countable pieces: roti, idli, samosa, egg, slice of bread). UNIT must be "piece".
2. "volume" (bowls/plates: dal, rice, sabzi, curry, khichdi). UNIT must be "katori", "bowl", or "plate".
3. "packaged" (branded items: Maggi packet, biscuit packet, chips). UNIT must be "packet".
 
STEP 3 — ESTIMATE a sensible default quantity (e.g., 2 rotis, 1.5 katori dal).
 
OUTPUT — respond with ONLY valid JSON:
{
  "items": [
    {
      "name": "string (e.g., Roti, Wheat)",
      "category": "discrete | volume | packaged",
      "unit": "piece | katori | bowl | plate | packet",
      "default_quantity": number (e.g., 2),
      "confidence": "high" | "medium" | "low",
      "reasoning": "short explanation"
    }
  ]
}
 
${cleanDescription ? `User description: "${cleanDescription}"` : ""}`;

  const groqContent: any[] = [{ type: "text", text: promptText }];
  const geminiPrompt: any[] = [promptText];

  if (imageData) {
    const { mimeType, base64Data } = validateImageData(imageData);
    groqContent.unshift({ type: "image_url", image_url: { url: imageData } });
    geminiPrompt.push({ inlineData: { data: base64Data, mimeType } });
  }

  if (!cleanDescription && !imageData) {
    throw new AIServiceError("Please provide a meal photo or description.", null);
  }

  const groqMessages = [{ role: "user", content: groqContent }];

  try {
    const text = await callAIWithFallback(
      groqMessages,
      geminiPrompt,
      imageData ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL
    );

    const parsed = MealParseResponseSchema.parse(extractJson(text));
    return parsed.items;
  } catch (error: any) {
    logServerError("AI parse failed", error);
    throw new AIServiceError(error.message || "Failed to parse meal with AI", error);
  }
}

// Step 2: Calculate exact macros from a verified text list.
export async function calculateMacrosFromText(itemsText: string): Promise<any[]> {
  const cleanItemsText = sanitizeText(itemsText);
  if (!cleanItemsText) {
    throw new AIServiceError("No items provided to calculate.", null);
  }
 
  const promptText = `You are an expert Indian nutrition database. I will provide a verified list of food items and their exact household quantities.
Calculate the highly accurate total calories and macronutrients for EACH item.
Use your deep knowledge of Indian food (e.g., 1 Katori Dal = ~150g, 1 piece Roti = ~40g).
 
Verified Items:
${cleanItemsText}
 
OUTPUT — respond with ONLY valid JSON:
{
  "items": [
    {
      "name": "string (e.g., Roti, Wheat)",
      "quantity_text": "string (e.g., 2 pieces)",
      "calories": number (integer),
      "protein": number (float),
      "carbs": number (float),
      "fat": number (float),
      "fiber": number (float)
    }
  ]
}`;
 
  const groqMessages = [{ role: "user", content: promptText }];
  const geminiPrompt = [promptText];
 
  try {
    const text = await callAIWithFallback(groqMessages, geminiPrompt, GROQ_TEXT_MODEL);
    const parsed = MacroResponseSchema.parse(extractJson(text));
    return parsed.items;
  } catch (error) {
    logServerError("calculate_macros_failed", error);
    if (error instanceof AIServiceError) throw error;
    throw new AIServiceError("We couldn't calculate macros right now. Please try again.", error);
  }
}

export async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const trans = await groq.audio.transcriptions.create({
      file: new (File as any)([audioBuffer], "audio.webm", { type: "audio/webm" }),
      model: "whisper-large-v3",
    });
    return trans.text;
  } catch (error) {
    throw new Error("Failed to transcribe audio. Please try typing.");
  }
}
