"use client";

import { useEffect, useState } from "react";
import { BarChart3, ChevronLeft, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { mealsApi, authApi } from "@/lib/api";
import { BottomNav } from "@/components/bottom-nav";
import Link from "next/link";

interface WeekDayData {
  date: string;
  dayName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

export default function HistoryPage() {
  const [weekData, setWeekData] = useState<WeekDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(2200);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [weekRes, userRes] = await Promise.all([
          mealsApi.week(),
          authApi.me()
        ]);
        setWeekData(weekRes.weekData);
        setGoal(userRes.calorieGoal || 2200);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalCalories = weekData.reduce((acc, d) => acc + d.calories, 0);
  const maxCalories = Math.max(...weekData.map(d => d.calories), goal * 1.2, 1); // Ensure maxCalories > 0
  const validDaysCount = weekData.filter(d => d.calories > 0).length || 1;
  const avgCalories = weekData.length ? Math.round(totalCalories / validDaysCount) : 0;

  return (
    <div className="min-h-screen bg-black pb-24 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4 px-4 h-16 max-w-2xl mx-auto">
          <Link href="/">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-95 transition-transform">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Weekly History</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Your 7-Day Trend</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Main Chart Card */}
        <div className="glass-card rounded-[32px] p-6 border-indigo-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-1">Avg Calories</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">{avgCalories}</span>
                <span className="text-sm font-bold text-muted-foreground">kcal/day</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-48 flex items-end justify-between gap-2 relative z-10">
            {/* Goal Line */}
            <div 
              className="absolute w-full border-t border-dashed border-white/20 z-0 pointer-events-none"
              style={{ bottom: `${(goal / maxCalories) * 100}%` }}
            >
              <span className="absolute -top-4 right-0 text-[9px] font-bold text-white/50 uppercase tracking-widest">Goal</span>
            </div>

            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              weekData.map((day, i) => {
                const heightPercentage = Math.min((day.calories / maxCalories) * 100, 100);
                const isOverGoal = day.calories > goal;
                
                return (
                  <div key={day.date} className="flex flex-col items-center flex-1 gap-2 z-10">
                    <div className="w-full relative flex justify-center h-full items-end group">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-8 bg-black border border-white/10 px-2 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                        {day.calories}
                      </div>
                      
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercentage}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
                        className={`w-full max-w-[32px] rounded-t-lg transition-colors ${
                          day.calories === 0 
                            ? "bg-white/5" 
                            : isOverGoal 
                              ? "bg-gradient-to-t from-rose-600 to-rose-400" 
                              : "bg-gradient-to-t from-indigo-600 to-indigo-400"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{day.dayName}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Macro Breakdown */}
        {!loading && weekData.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-[24px] p-5 border-emerald-500/10">
              <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-3">Avg Protein</h3>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {Math.round(weekData.reduce((acc, d) => acc + d.protein, 0) / validDaysCount)}g
                </span>
              </div>
            </div>
            
            <div className="glass-card rounded-[24px] p-5 border-amber-500/10">
              <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-3">Avg Carbs</h3>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-amber-400">
                  {Math.round(weekData.reduce((acc, d) => acc + d.carbs, 0) / validDaysCount)}g
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Insights Summary */}
        <div className="glass-card rounded-[32px] p-6 border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-white/50" />
            <h2 className="font-black text-lg">Weekly Summary</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
              <span className="font-bold text-sm text-white/80">Total Meals Logged</span>
              <span className="font-black text-white">{weekData.reduce((acc, d) => acc + d.mealCount, 0)} meals</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
              <span className="font-bold text-sm text-white/80">Highest Calorie Day</span>
              <span className="font-black text-white">
                {weekData.reduce((max, d) => d.calories > max.calories ? d : max, { calories: 0, dayName: 'None' }).dayName}
              </span>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
