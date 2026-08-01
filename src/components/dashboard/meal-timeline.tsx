"use client";

import { motion } from "framer-motion";
import { Coffee, Sun, Sunset, Moon } from "lucide-react";

import { Meal } from "@/lib/api";

interface MealTimelineProps {
  meals: Meal[];
  onAdd: () => void;
}

const mealTypeConfig = {
  breakfast: {
    icon: Coffee,
    label: "Breakfast",
    gradient: "from-amber-500/10 to-amber-500/5",
    iconColor: "text-amber-400",
    border: "border-amber-500/10",
  },
  lunch: {
    icon: Sun,
    label: "Lunch",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    iconColor: "text-emerald-400",
    border: "border-emerald-500/10",
  },
  snack: {
    icon: Sunset,
    label: "Snack",
    gradient: "from-violet-500/10 to-violet-500/5",
    iconColor: "text-violet-400",
    border: "border-violet-500/10",
  },
  dinner: {
    icon: Moon,
    label: "Dinner",
    gradient: "from-sky-500/10 to-sky-500/5",
    iconColor: "text-sky-400",
    border: "border-sky-500/10",
  },
};

export function MealTimeline({ meals = [], onAdd }: MealTimelineProps) {
  const hasDinner = meals.some(m => m.mealType === "dinner");

  return (
    <motion.div
      id="meal-timeline"
      className="glass-card rounded-2xl p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground/90">
          Today&apos;s Meals
        </h3>
        <span className="text-xs text-muted-foreground">
          {meals.length} logged
        </span>
      </div>

      <div className="space-y-3">
        {meals.map((meal, index) => {
          const config = mealTypeConfig[meal.mealType as keyof typeof mealTypeConfig] || mealTypeConfig.snack;
          const Icon = config.icon;
          const timeStr = new Date(meal.eatenAt).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          return (
            <motion.div
              key={meal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1 + 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${config.gradient} border ${config.border} hover:border-white/10 transition-all cursor-pointer`}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 ${config.iconColor}`} />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {meal.customName || "Unnamed meal"}
                </p>
              </div>

              {/* Calories & Time */}
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {meal.calories}
                  <span className="text-xs text-muted-foreground ml-0.5">
                    cal
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">{timeStr}</p>
              </div>
            </motion.div>
          );
        })}

        {/* Action placeholder if dinner is missing */}
        {!hasDinner && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onClick={onAdd}
            className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/10 hover:border-white/15 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/3 flex items-center justify-center shrink-0 border border-dashed border-white/10">
              <Moon className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                Log your dinner
              </span>
              <p className="text-[10px] text-muted-foreground/40">
                Tap to add tonight&apos;s meal
              </p>
            </div>
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-400">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
