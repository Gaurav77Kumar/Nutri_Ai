import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createMealSchema, updateMealSchema, aiParseMealSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { parseMealWithAI, calculateMacrosFromText } from "../lib/ai";
import { aiUsageLimiter } from "../middleware/rate-limit";

const router = Router();
router.use(authenticate);


function getTimezoneOffsetMs(reference: Date, timeZone: string): number {
  const zoned = new Date(reference.toLocaleString("en-US", { timeZone }));
  const utc = new Date(reference.toLocaleString("en-US", { timeZone : "UTC"}));
  return zoned.getTime() - utc.getTime();
}

function getDayBoundsInTimezone(timeZone: string, reference = new Date()){
  const offsetMs =  getTimezoneOffsetMs(reference, timeZone);
  const zonedNow = new Date(reference.getTime() + offsetMs);
  const zonedMidnight = new Date(Date.UTC(zonedNow.getUTCFullYear(), zonedNow.getUTCMonth(), zonedNow.getUTCDate()));

  const start = new Date(zonedMidnight.getTime() - offsetMs);
  return{ start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000)}
}

async function getUserTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId}, select: { timezone: true } });
  return profile?.timezone || "UTC";
}

const listMealsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD").optional(),

  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD").optional(),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});


router.get("/",asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, startDate, endDate, mealType, limit, offset } = listMealsQuerySchema.parse(req.query);

    const where: any = { userId: req.userId! };

    if (date) {
      const d = new Date(date as string);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.eatenAt = { gte: d, lt: nextDay };
    }else if (startDate && endDate) {
      where.eatenAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    if (mealType) where.mealType = mealType;

    const [meals, total] = await Promise.all([
      prisma.mealLog.findMany({ where, orderBy: { eatenAt: "desc" }, take: limit, skip: offset}),
      prisma.mealLog.count({ where }),
    ])

    res.json({ meals, total, limit, offset });
  })
);


router.get("/today",asyncHandler(async (req: AuthRequest, res: Response) => {
    const timezone =  await getUserTimezone(req.userId!);
    const { start, end } = getDayBoundsInTimezone(timezone);

    const meals = await prisma.mealLog.findMany({
      where: {
        userId: req.userId!,
        eatenAt: { gte: start, lt: end },
      },

      orderBy: { eatenAt: "asc" },
    });

    // Aggregate today's totals
    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
        fibre: acc.fibre + m.fibre,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
    );

    // Get user goals
    const rawUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { profile: true }
    });
    
    const goals = rawUser?.profile ? {
      calorieGoal: rawUser.profile.calorieGoal,
      proteinGoal: rawUser.profile.proteinGoal,
      carbGoal: rawUser.profile.carbGoal,
      fatGoal: rawUser.profile.fatGoal,
      fibreGoal: rawUser.profile.fibreGoal,
    } : null;

    res.json({
      meals,
      totals,
      goals,
      mealCount: meals.length,
    });
  })
);


router.get("/week",asyncHandler(async (req: AuthRequest, res: Response) => {
    const timezone = await getUserTimezone(req.userId!);
    const { start: todayStart } = getDayBoundsInTimezone(timezone);

    const dayOfWeek = todayStart.getUTCDay();
    const monday = new Date(todayStart);
    monday.setUTCDate(todayStart.getUTCDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 7);

    
    const meals = await prisma.mealLog.findMany({
      where: {
        userId: req.userId!,
        eatenAt: { gte: monday, lt: sunday },
      },
      orderBy: { eatenAt: "asc" },
    });

    const dailySummary: Record<string, { calories: number; protein: number; carbs: number; fat: number; mealCount: number }> = {};
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const key = d.toISOString().split("T")[0];
      dailySummary[key] = { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
    }

    for (const meal of meals) {
      const key = meal.eatenAt.toISOString().split("T")[0];
      if (dailySummary[key]) {
        dailySummary[key].calories += meal.calories;
        dailySummary[key].protein += meal.protein;
        dailySummary[key].carbs += meal.carbs;
        dailySummary[key].fat += meal.fat;
        dailySummary[key].mealCount += 1;
      }
    }

    const weekData = Object.entries(dailySummary).map(([date, stats], i) => ({
      date,
      dayName: dayNames[i],
      ...stats,
    }));

    res.json({ weekData, totalMeals: meals.length });
  })
);



router.post("/",asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = createMealSchema.parse(req.body);

    const meal = await prisma.mealLog.create({
      data: {
        ...data,
        userId: req.userId!,
        eatenAt: data.eatenAt ? new Date(data.eatenAt) : new Date(),
      },

    });

    res.status(201).json(meal);
  })
);

// POST /api/meals/analyze — Step 1: Image -> Draft Items
router.post("/analyze",aiUsageLimiter,asyncHandler(async (req: AuthRequest, res: Response) => {
    const { description, image } = aiParseMealSchema.parse(req.body);

    // Parse with Groq Vision (supports text + image)
    const draftItems = await parseMealWithAI(description || "", image);

    res.status(200).json({
      items: draftItems,
    });
  })
);

const calculateMacrosSchema = z.object({
  itemsText: z.string().min(1, "itemsText is required"),
});


router.post("/calculate",aiUsageLimiter,asyncHandler(async (req: AuthRequest, res: Response) => {
    const { itemsText } = calculateMacrosSchema.parse(req.body);
    const finalItems = await calculateMacrosFromText(itemsText);

    const totalCalories = finalItems.reduce((sum, r) => sum + r.calories, 0);
    res.status(200).json({ items: finalItems, totalCalories });
})
);

const bulkItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  calories: z.number().nonnegative().max(10000),
  protein: z.number().nonnegative().max(1000),
  carbs: z.number().nonnegative().max(1000),
  fat: z.number().nonnegative().max(1000),
  fiber: z.number().nonnegative().max(200).optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

const bulkMealSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(20),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  isOutside: z.boolean().optional().default(false),
  cost: z.number().nonnegative().max(10000).optional(),
  source: z.string().optional(),
});


router.post("/bulk",asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, mealType, isOutside, cost, source } = bulkMealSchema.parse(req.body);

    const createdMeals = await Promise.all(
      items.map((parsed) =>
      prisma.mealLog.create({
          data: {
            userId: req.userId!,
            customName: parsed.name,
            quantity: 1, 
            calories: Math.round(parsed.calories),
            protein: parsed.protein,
            carbs: parsed.carbs,
            fat: parsed.fat,
            fibre: parsed.fiber ?? 0,
            mealType,
            aiParsed: true,
            aiConfidence: parsed.confidence === "low" ? 0.3 : (parsed.confidence === "medium" ? 0.7 : 0.9),
            imageUrl: null,
            isOutside,
            cost: cost ?? null,
            source: source ?? null,

          },
        })
      )
    );

    res.status(201).json({
      meals: createdMeals,
      totalCalories: items.reduce((s: number, m: any) => s + (m.calories || 0), 0),
    });
  })
);


router.patch("/:id",asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = updateMealSchema.parse(req.body);
    const mealId = req.params.id as string;

    const result =  await prisma.mealLog.updateMany({
      where: { id: mealId, userId: req.userId! },
      data: {
        ...data, eatenAt: data.eatenAt ? new Date(data.eatenAt) : undefined,
      }
    })

    if (result.count === 0) {
      return res.status(404).json({ error: "Meal not found or not owned by user" });
    }
    
   const meal = await prisma.mealLog.findUnique({ where: {id: mealId } })
   res.json(meal);
  })
);


router.delete("/:id",asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await prisma.mealLog.deleteMany({
    where: { id: req.params.id as string, userId: req.userId! },
  })

  if( result.count === 0) {
     res.status(404).json({ error: "Meal not found " });
     return;
  }

  res.status(204).send();
})  
);


const templateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().optional(),
  calories: z.number().nonnegative().max(10000),
  protein: z.number().nonnegative().max(1000),
  carbs: z.number().nonnegative().max(1000),
  fat: z.number().nonnegative().max(1000),
  fibre: z.number().nonnegative().max(200).optional(),
});

const createTemplateSchema =  z.object({
  name: z.string().trim().min(1).max(100),
  items: z.array(templateSchema).min(1).max(20),
})


router.post("/templates",asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, items } = createTemplateSchema.parse(req.body);

    const template = await prisma.mealTemplate.create({
      data: {
        userId: req.userId!,
        name,
        // Prisma Json fields natively take objects/arrays, but if we cast items as any it works.
        items: items as any,
        totalCals: items.reduce((sum: number, item: any) => sum + (item.calories || 0), 0),
      },
    });

    res.status(201).json(template);
  })
);


router.get("/templates",asyncHandler(async (req: AuthRequest, res: Response) => {
    const templates = await prisma.mealTemplate.findMany({
      where: { userId: req.userId! },
      orderBy: { lastUsed: "desc" },
    });

    res.json(templates);
  })
);


router.post("/templates/:id/log",asyncHandler(async (req: AuthRequest, res: Response) => {
   const logMealTypeSchema = z.enum(["breakfast", "lunch", "snack", "dinner"]).optional();
   const mealType = logMealTypeSchema.parse(req.body.mealType) || 'breakfast';


    const template = await prisma.mealTemplate.findFirst({
      where: { id: req.params.id as string, userId: req.userId! }
    });

    if (!template) {
     res.status(404).json({ error: "Template not found " });
     return;
    }

    let items: Array<z.infer<typeof templateSchema>> = template.items as any;

    if (!Array.isArray(items)) {
      res.status(500).json({ error: "Template data is corrupted" });
      return;
    }

    const logs = await Promise.all(
      items.map((item: any) => 
        prisma.mealLog.create({
          data: {
            userId: req.userId!,
            customName: item.name,
            quantity: item.quantity || 1,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fibre: item.fibre || 0,
            mealType,
          }
        })
      )
    );

    await prisma.mealTemplate.update({
      where: { id: template.id },
      data: { lastUsed: new Date() }
    });
    res.status(201).json(logs);
  })
);


export default router;
