"use client";

import { motion } from "framer-motion";

interface MacroData {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  trackColor: string;
}

interface MacroRingsProps {
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  goals?: {
    proteinGoal: number;
    carbGoal: number;
    fatGoal: number;
    fibreGoal: number;
  };
}

function MacroRing({ macro, index }: { macro: MacroData; index: number }) {
  const percent = Math.min((macro.current / Math.max(macro.goal, 1)) * 100, 100);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1 + 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={macro.trackColor}
            strokeWidth="5"
          />
          {/* Progress */}
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={macro.color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: 1.5,
              delay: index * 0.15 + 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="nutrition-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums" style={{ color: macro.color }}>
            {Math.round(macro.current)}
          </span>
          <span className="text-[9px] text-muted-foreground">{macro.unit}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground/80">{macro.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {Math.max(Math.round(macro.goal - macro.current), 0)}{macro.unit} left
        </p>
      </div>
    </motion.div>
  );
}

export function MacroRings({ protein, carbs, fat, fibre, goals }: MacroRingsProps) {
  const macros: MacroData[] = [
    {
      label: "Protein",
      current: protein,
      goal: goals?.proteinGoal || 120,
      unit: "g",
      color: "oklch(0.765 0.177 163.223)",
      trackColor: "oklch(0.765 0.177 163.223 / 12%)",
    },
    {
      label: "Carbs",
      current: carbs,
      goal: goals?.carbGoal || 280,
      unit: "g",
      color: "oklch(0.828 0.189 84.429)",
      trackColor: "oklch(0.828 0.189 84.429 / 12%)",
    },
    {
      label: "Fat",
      current: fat,
      goal: goals?.fatGoal || 70,
      unit: "g",
      color: "oklch(0.712 0.194 13.428)",
      trackColor: "oklch(0.712 0.194 13.428 / 12%)",
    },
    {
      label: "Fibre",
      current: fibre,
      goal: goals?.fibreGoal || 30,
      unit: "g",
      color: "oklch(0.702 0.183 293.541)",
      trackColor: "oklch(0.702 0.183 293.541 / 12%)",
    },
  ];

  return (
    <motion.div
      id="macro-rings"
      className="glass-card rounded-2xl p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground/90">
          Macronutrients
        </h3>
        <span className="text-xs text-muted-foreground">Daily targets</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {macros.map((macro, i) => (
          <MacroRing key={macro.label} macro={macro} index={i} />
        ))}
      </div>
    </motion.div>
  );
}
