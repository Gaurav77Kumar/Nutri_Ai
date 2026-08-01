"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingDown } from "lucide-react";
import { authApi, mealsApi, type Meal } from "@/lib/api";

export function BudgetInsights() {
  const [spending, setSpending] = useState(0);
  const [budget, setBudget] = useState(0);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({});
  const [period, setPeriod] = useState<string>("weekly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [me, mealsData] = await Promise.all([
          authApi.me(),
          mealsApi.list({ limit: 1000 })
        ]);

        const meals = mealsData.meals || [];
        const now = new Date();
        const isMonthly = me.budgetPeriod === "monthly";
        const startDate = new Date(now);
        if (isMonthly) {
          startDate.setDate(1); 
        } else {
          startDate.setDate(now.getDate() - now.getDay()); 
        }
        startDate.setHours(0, 0, 0, 0);

        const periodMeals = meals.filter((m) => new Date(m.eatenAt) >= startDate);
        const totalSpent = periodMeals.reduce((sum: number, m: Meal) => sum + (m.cost || 0), 0);
        
        const breakdown: Record<string, number> = {};
        periodMeals.forEach((m: Meal) => {
          if (m.isOutside && m.source) {
            breakdown[m.source] = (breakdown[m.source] || 0) + (m.cost || 0);
          }
        });

        setSpending(totalSpent);
        setBudget(me.weeklyBudget || 3500);
        setPeriod(me.budgetPeriod || "weekly");
        setSourceBreakdown(breakdown);
      } catch (err) {
        console.error("Budget fetch failed", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || budget === 0) return null;

  const progress = Math.min(spending / budget, 1);
  const remains = Math.max(budget - spending, 0);
  const isOver = spending > budget;

  return (
    <div className="glass-card rounded-3xl p-5 border border-orange-500/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/90">Food Budget</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{period === 'monthly' ? 'Monthly' : 'Weekly'} Goal: ₹{budget}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xl font-black tabular-nums ${isOver ? 'text-rose-400' : 'text-white'}`}>₹{spending.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground font-bold">Spent this {period === 'monthly' ? 'month' : 'week'}</p>
        </div>
      </div>

      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-4">
        <motion.div 
          className={`absolute top-0 left-0 h-full ${isOver ? 'bg-rose-500' : 'bg-orange-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
          <p className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter mb-1">Remaining</p>
          <p className="text-sm font-bold text-emerald-400">₹{remains.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
          <p className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter mb-1">Top Platform</p>
          <p className="text-sm font-bold text-white truncate">
            {Object.keys(sourceBreakdown).length > 0 
              ? Object.entries(sourceBreakdown).sort((a,b) => b[1]-a[1])[0][0]
              : "Home Food"
            }
          </p>
        </div>
      </div>

      {isOver && (
        <div className="flex items-center gap-2 mt-3 text-rose-400 text-[10px] font-bold uppercase animate-pulse">
          <TrendingDown className="w-3 h-3" />
          Over budget by ₹{(spending - budget).toLocaleString()}
        </div>
      )}
    </div>
  );
}
