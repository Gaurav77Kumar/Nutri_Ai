import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(4, "Password must be at least 4 characters").max(128),
  dietType: z.enum(["indian", "vegetarian", "vegan", "mixed"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

// Meal Schemas 
export const createMealSchema = z.object({
  foodItemId: z.string().optional(),
  customName: z.string().optional(),
  quantity: z.number().positive().default(1),
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fibre: z.number().nonnegative().default(0),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  eatenAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  aiParsed: z.boolean().default(false),
  aiConfidence: z.number().min(0).max(1).optional(),
  isOutside: z.boolean().default(false),
  cost: z.number().nonnegative().optional(),
  source: z.string().optional(),
});

export const updateMealSchema = createMealSchema.partial();

export const aiParseMealSchema = z.object({
  description: z.string().max(1000).optional(),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]).optional(),
  image: z.string().optional(),
  quantity: z.number().positive().optional(),
  isOutside: z.boolean().optional(),
  cost: z.number().nonnegative().optional(),
  source: z.string().optional(),

}).refine(data => data.description || data.image, {
  message: "Either description or image must be provided",
  path: ["description"],
});

// Profile
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  dietType: z.enum(["indian", "vegetarian", "vegan", "mixed"]).optional(),
  calorieGoal: z.number().int().min(800).max(5000).optional(),
  proteinGoal: z.number().int().min(20).max(300).optional(),
  carbGoal: z.number().int().min(50).max(600).optional(),
  fatGoal: z.number().int().min(20).max(200).optional(),
  fibreGoal: z.number().int().min(10).max(100).optional(),
  waterGoal: z.number().int().min(500).max(10000).optional(),
  weeklyBudget: z.number().int().min(500).max(50000).optional(),
  budgetPeriod: z.enum(["weekly", "monthly"]).optional(),
  timezone: z.string().optional(),
  emailReports: z.boolean().optional(),

});


