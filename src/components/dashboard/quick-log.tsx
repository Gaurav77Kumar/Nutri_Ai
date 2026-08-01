"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle,} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {Camera,Mic,Sparkles,Search,Clock,Loader2,CheckCircle2,ScanBarcode,Plus,} from "lucide-react";
import { mealsApi, mealTemplatesApi } from "@/lib/api";

interface Template {
  id: string;
  name: string;
  totalCals: number;
  items: string;
}

interface AIItem {
  name: string;
  category: string;
  default_quantity: number;
  unit: string;
  reasoning?: string;
  quantity_text?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (event: unknown) => void;
  start: () => void;
}

interface QuickLogProps {
  open: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

const recentFoods = [
  { name: "Dal makhani with 2 roti", calories: 480, emoji: "🍛" },
  { name: "Masala chai (less sugar)", calories: 65, emoji: "☕" },
  { name: "Curd rice", calories: 220, emoji: "🍚" },
  { name: "Mixed nuts (handful)", calories: 180, emoji: "🥜" },
  { name: "Paneer tikka (6 pcs)", calories: 320, emoji: "🧀" },
  { name: "2 Paratha with curd", calories: 420, emoji: "🫓" },
];

export function QuickLog({ open, onClose, onLogged }: QuickLogProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mealType, setMealType] = useState<string>("Lunch");
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTab, setActiveTab] = useState<"ai" | "templates">("ai");
  

  const [reviewState, setReviewState] = useState<"none" | "draft" | "final">("none");
  const [draftItems, setDraftItems] = useState<AIItem[]>([]);
  const [parsedItems, setParsedItems] = useState<AIItem[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);


  const [isOutside, setIsOutside] = useState(false);
  const [cost, setCost] = useState("");
  const [source, setSource] = useState("Home");

  useEffect(() => {
    if (open) {
      mealTemplatesApi.list().then(res => setTemplates(res as unknown as Template[])).catch(console.error);
    }
  }, [open]);

  const sources = ["Home", "Zomato", "Swiggy", "Zepto", "BigBasket", "Instamart", "Restaurant"];

  const handleTemplateLog = async (templateId: string) => {
    setLoading(true);
    try {
      await mealTemplatesApi.logFromTemplate(templateId, mealType.toLowerCase());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onLogged?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log from template");
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const win = window as unknown as { 
      SpeechRecognition: new () => ISpeechRecognition; 
      webkitSpeechRecognition: new () => ISpeechRecognition; 
    };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: unknown) => {
      const e = event as { results: { transcript: string }[][] };
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
    };

    recognition.start();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, isLabelScan = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        if (isLabelScan) {
          setQuery("Read the nutrition label in this image and parse the exact calories, protein, carbs, and fat per serving.");
        } else if (!query) {
          setQuery("Analyze this food image...");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiLog = async () => {
    if (!query && !selectedImage) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mealsApi.analyze({
        description: query,
        image: selectedImage || undefined,
      });
      setDraftItems(res.items as unknown as AIItem[]);
      setReviewState("draft");
    } catch (err: unknown) {
      console.error("AI parse failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateMacros = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemsText = draftItems
        .map((item) => `${item.default_quantity} ${item.unit} of ${item.name}`)
        .join(", ");
        
      const res = await mealsApi.calculate({ itemsText });
      setParsedItems(res.items as unknown as AIItem[]);
      setTotalCalories(res.totalCalories);
      setReviewState("final");
    } catch (err: unknown) {
      console.error("Calculation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to calculate macros");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLog = async () => {
    setLoading(true);
    setError(null);
    try {
      await mealsApi.bulkCreate({
        items: parsedItems.map(item => ({ ...item, confidence: "high" })),
        mealType: mealType.toLowerCase(),
        isOutside,
        cost: cost ? Number(cost) : undefined,
        source: isOutside ? source : "Home",
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReviewState("none");
        setQuery("");
        setSelectedImage(null);
        onLogged?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error("Bulk create failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save meal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateDraftQuantity = (index: number, newQty: number) => {
    const updated = [...draftItems];
    updated[index].default_quantity = Math.max(0.25, newQty);
    setDraftItems(updated);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="glass-card rounded-t-3xl border-t border-white/10 border-x-0 border-b-0 max-h-[90vh] pb-8 h-[75vh] sm:h-auto overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg gradient-text">
            Log Your Meal
          </SheetTitle>
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => setActiveTab("ai")}
              className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "ai" ? "border-emerald-500 text-white" : "border-transparent text-muted-foreground"}`}
            >
              Smart Log
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "templates" ? "border-emerald-500 text-white" : "border-transparent text-muted-foreground"}`}
            >
              Templates {templates.length > 0 && <span className="ml-1 bg-emerald-500/20 text-emerald-400 px-1 rounded">{templates.length}</span>}
            </button>
          </div>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <p className="text-lg font-semibold">Meal Logged!</p>
              <p className="text-sm text-muted-foreground">Stats updated on your dashboard</p>
            </motion.div>
          ) : reviewState === "draft" ? (
            <motion.div
              key="draft"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">Confirm Portions</h3>
                <span className="text-xs text-muted-foreground">AI Draft</span>
              </div>
              
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {draftItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white leading-tight">{item.name}</span>
                          <Badge className="bg-white/10 text-white border-none text-[8px] h-4 px-1 uppercase">{item.category}</Badge>
                        </div>
                        {item.reasoning && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{item.reasoning}</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-medium text-emerald-400 capitalize">{item.unit}s</span>
                      <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-white/5">
                        <button onClick={() => updateDraftQuantity(idx, item.default_quantity - (item.category === 'discrete' ? 1 : 0.5))} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white bg-white/5 rounded-md">-</button>
                        <span className="text-sm font-bold w-12 text-center">{item.default_quantity}</span>
                        <button onClick={() => updateDraftQuantity(idx, item.default_quantity + (item.category === 'discrete' ? 1 : 0.5))} className="w-8 h-8 flex items-center justify-center text-white bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-md">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setReviewState("none")} className="flex-1 border-white/10 text-muted-foreground">
                  Back
                </Button>
                <Button onClick={handleCalculateMacros} disabled={loading} className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Calculate Calories
                </Button>
              </div>
            </motion.div>
          ) : reviewState === "final" ? (
             <motion.div
              key="final"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">Final Macros</h3>
                <span className="text-xs font-black text-emerald-400">{totalCalories} kcal Total</span>
              </div>
              
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-white leading-tight">{item.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.quantity_text}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-emerald-400">{item.calories}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">kcal</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-start gap-4 text-[10px] text-muted-foreground font-medium pt-2 border-t border-white/5">
                      <span>Protein: {item.protein}g</span>
                      <span>Carbs: {item.carbs}g</span>
                      <span>Fat: {item.fat}g</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setReviewState("draft")} className="flex-1 border-white/10 text-muted-foreground">
                  Adjust Quantities
                </Button>
                <Button onClick={handleConfirmLog} disabled={loading} className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Confirm & Log
                </Button>
              </div>
            </motion.div>
          ) : activeTab === "ai" ? (
            <div className="space-y-4">
              <div className="space-y-4">
                {selectedImage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative aspect-square w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500/30"
                  >
                    <img src={selectedImage} alt="Food" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white text-[10px]"
                    >✕</button>
                  </motion.div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="meal-search-input"
                    placeholder="e.g. 2 paratha with curd..."
                    className="pl-10 pr-24 h-12 rounded-xl bg-white/5 border-white/10 focus:border-emerald-500/50 text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAiLog()}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <input type="file" accept="image/*" capture="environment" className="hidden" id="camera-input" onChange={(e) => handleImageSelect(e, false)} />
                    <input type="file" accept="image/*" capture="environment" className="hidden" id="barcode-input" onChange={(e) => handleImageSelect(e, true)} />
                    <button onClick={startListening} className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-colors ${isListening ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground'}`}>
                      <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={() => document.getElementById("barcode-input")?.click()} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10 hover:text-emerald-400 transition-colors" title="Scan Nutrition Label">
                      <ScanBarcode className="w-4 h-4" />
                    </button>
                    <button onClick={() => document.getElementById("camera-input")?.click()} className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {["Breakfast", "Lunch", "Snack", "Dinner"].map((type) => (
                  <Button
                    key={type}
                    variant={mealType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMealType(type)}
                    className={`h-8 text-xs rounded-lg flex-1 cursor-pointer transition-all ${mealType === type ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "border-white/10"
                      }`}
                  >
                    {type}
                  </Button>
                ))}
              </div>

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}

              {/* Source & Spending Section */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70">Source of food?</span>
                  <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                    <button
                      onClick={() => setIsOutside(false)}
                      className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${!isOutside ? 'bg-emerald-500 text-white' : 'text-muted-foreground'}`}
                    >HOME</button>
                    <button
                      onClick={() => setIsOutside(true)}
                      className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${isOutside ? 'bg-orange-500 text-white' : 'text-muted-foreground'}`}
                    >OUTSIDE</button>
                  </div>
                </div>

                {isOutside && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2">
                      {sources.filter(s => s !== "Home").map(s => (
                        <button
                          key={s}
                          onClick={() => setSource(s)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${source === s ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-white/5 border-white/5 text-muted-foreground'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Meal Cost (₹)</label>
                        <Input
                          type="number"
                          placeholder="e.g. 240"
                          value={cost}
                          onChange={e => setCost(e.target.value)}
                          className="bg-white/5 border-white/10 h-10 text-sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>



              {query || selectedImage ? (
                <Button onClick={handleAiLog} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl h-10 shadow-lg shadow-emerald-500/10">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {loading ? "Analyzing..." : "Analyze & Track Portions"}
                </Button>
              ) : null}

              {!query && !selectedImage && (
                <div className="space-y-3">
                  <div className="px-1 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Recently in India</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recentFoods.slice(0, 4).map((food) => (
                      <button key={food.name} onClick={() => setQuery(food.name)} className="flex flex-col items-start gap-1 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-emerald-500/30 transition-all text-left group">
                        <span className="text-lg">{food.emoji}</span>
                        <p className="text-xs font-medium truncate w-full group-hover:text-emerald-400">{food.name}</p>
                        <p className="text-[10px] text-muted-foreground">{food.calories} kcal</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-muted-foreground">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">You haven&apos;t saved any templates yet.<br />Log a meal first to save it as a favorite.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateLog(template.id)}
                      disabled={loading}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-white group-hover:text-emerald-400">{template.name}</p>
                          <p className="text-[10px] text-muted-foreground">{template.totalCals} kcal • {JSON.parse(template.items).length} items</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
