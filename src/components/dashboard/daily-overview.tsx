"use client";

import { motion } from "framer-motion";
import { Flame, TrendingUp, Calendar } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface DailyOverviewProps {
  calories: number;
  goal: number;
  streak?: number;
}

export function DailyOverview({ calories = 0, goal = 2200, streak = 12 }: DailyOverviewProps) {
  const { t, language } = useLanguage();
  const today = new Date();
  
  const dayName = today.toLocaleDateString(language === "Hindi" ? "hi-IN" : "en-IN", { weekday: "long" });
  const dateStr = today.toLocaleDateString(language === "Hindi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const hour = today.getHours();
  const greetingKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';

  const caloriesConsumed = calories;
  const calorieGoal = goal;
  const caloriePercent = Math.min(Math.round((caloriesConsumed / calorieGoal) * 100), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      id="daily-overview"
    >
      {/* Greeting */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t(greetingKey)}, <span className="gradient-text-hero">Gaurav</span> 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dayName}, {dateStr}
        </p>
      </div>

      {/* Calorie + Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Calories Card */}
        <motion.div
          className="col-span-2 glass-card rounded-2xl p-4 relative overflow-hidden group"
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('calories_today')}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold tabular-nums gradient-text">
                  {caloriesConsumed.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {calorieGoal.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${caloriePercent}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {Math.max(calorieGoal - caloriesConsumed, 0)} {t('kcal_remaining')}
          </p>

          {/* Subtle gradient accent */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
        </motion.div>

        {/* Streak & Trend */}
        <div className="flex flex-col gap-3">
          <motion.div
            className="glass-card rounded-2xl p-3 flex-1 flex flex-col items-center justify-center"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-1">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xl font-bold text-amber-400">{streak}</span>
            <span className="text-[10px] text-muted-foreground">{t('streak_days')}</span>
          </motion.div>

          <motion.div
            className="glass-card rounded-2xl p-3 flex-1 flex flex-col items-center justify-center"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center mb-1">
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-xl font-bold text-sky-400">-3%</span>
            <span className="text-[10px] text-muted-foreground">{t('vs_last_week')}</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
