import { z } from "zod";

export const registerSchema = z.
  object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z
      .string()
      .min(4, "Password must be at least 4 characters")
      .max(128)
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    dietType: z.enum(["indian", "vegetarian", "vegan", "mixed"]).optional(),
})
 .strict();

export const loginSchema = z
  .object({
     email: z.string().trim().toLowerCase().email("Invalid email address"),
     password: z.string().min(4, "Password must be at least 4 characters"),
})
 .strict();


 const mealFields = {
  foodItemId: z.string().optional(),
  customName: z.string().trim().max(200).optional(),
  quantity: z.number().positive(),
  calories: z.number().int().nonnegative().max(10000),
  protein: z.number().nonnegative().max(1000),
  carbs: z.number().nonnegative().max(1000),
  fat: z.number().nonnegative().max(1000),
  fibre: z.number().nonnegative().max(200),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  eatenAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  imageUrl: z
     .string()
     .url()
     .refine(
      url => url.startsWith("https://") || url.startsWith("http://"),
      { message: "Image URL must start with http:// or https://" }
    )
    .optional(),
  aiParsed: z.boolean().default(false),
  aiConfidence: z.number().min(0).max(1).optional(),
  isOutside: z.boolean().default(false),
  cost: z.number().nonnegative().max(10000).optional(),
  source: z.string().trim().max(200).optional(),
};


export const createMealSchema = z.object({
  ...mealFields,
  quantity: mealFields.quantity.default(1),
  fibre: mealFields.fibre.default(0),
  isOutside: mealFields.isOutside.default(false),
});


export const updateMealSchema = z.object(mealFields).partial();

export interface MealServerFields {
  aiParsed: boolean;
  aiConfidence?: number;
}

export const aiParseMealSchema = z
    .object({
      description: z.string().trim().max(1000).optional(),
      mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]).optional(),
      image: z.string().optional(),
      quantity: z.number().positive().optional(),
      isOutside: z.boolean().optional(),
      cost: z.number().nonnegative().max(10000).optional(),
      source: z.string().trim().max(200).optional(),
    })
    .refine((data) => data.description || data.image, {
      message: "Either description or image must be provided",
      path: ["description", "image"],
    })


export const updateProfileSchema = z
.object({
  name: z.string().trim().min(2).max(100).optional(),
  dietType: z.enum(["indian", "vegetarian", "vegan", "mixed"]).optional(),
  calorieGoal: z.number().int().min(800).max(5000).optional(),
  proteinGoal: z.number().int().min(20).max(300).optional(),
  carbGoal: z.number().int().min(50).max(600).optional(),
  fatGoal: z.number().int().min(20).max(200).optional(),
  fibreGoal: z.number().int().min(10).max(100).optional(),
  waterGoal: z.number().int().min(500).max(10000).optional(),
  weeklyBudget: z.number().int().min(500).max(50000).optional(),
  budgetPeriod: z.enum(["weekly", "monthly"]).optional(),
  timezone: z
  .string()
  .refine((tz) => {
    try {
      Intl.supportedValuesOf("timeZone").includes(tz);
      return true;
    } catch {
      return true;
    }
  }, "Invalid timezone")
  .optional(),
  emailReports: z.boolean().optional(),
})
.strict();
