"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { DailyOverview } from "@/components/dashboard/daily-overview";
import { MacroRings } from "@/components/dashboard/macro-rings";
import { MealTimeline } from "@/components/dashboard/meal-timeline";
import { QuickLog } from "@/components/dashboard/quick-log";


import { BottomNav } from "@/components/bottom-nav";
import { mealsApi, authApi, type User, type Meal } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { notifyGoalReached, isNotificationEnabled } from "@/lib/notifications";
import { BudgetInsights } from "@/components/dashboard/budget-insights";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";


interface DashboardData {
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
  };
  goals: {
    calorieGoal: number;
    proteinGoal: number;
    carbGoal: number;
    fatGoal: number;
    fibreGoal: number;
  } | null;
  meals: Meal[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("nutriai_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const [profile, dashboardData] = await Promise.all([
        authApi.me(),
        mealsApi.today()
      ]);
      
      setUser(profile);
      setData(dashboardData);
    } catch (err) {
      console.error("Dashboard init failed:", err);
      localStorage.removeItem("nutriai_token");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  const refreshData = async () => {
    try {
      const dashboardData = await mealsApi.today();
      setData(dashboardData);

      // Check if any macro goals were just reached and notify
      const notifEnabled = await isNotificationEnabled();
      if (notifEnabled && dashboardData?.totals && dashboardData?.goals) {
        const { totals, goals } = dashboardData;
        if (totals.protein >= goals.proteinGoal && (data?.totals?.protein ?? 0) < goals.proteinGoal) {
          notifyGoalReached("Protein");
        }
        if (totals.calories >= goals.calorieGoal && (data?.totals?.calories ?? 0) < goals.calorieGoal) {
          notifyGoalReached("Calorie");
        }
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-emerald-500/60 font-medium text-sm animate-pulse">
          {t('connecting_db')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 pb-24 pt-4 max-w-2xl mx-auto w-full space-y-5">
        <DailyOverview 
          calories={data?.totals?.calories ?? 0} 
          goal={data?.goals?.calorieGoal ?? 2200}
        />
        <BudgetInsights />
        <MacroRings 
          protein={data?.totals?.protein ?? 0}
          carbs={data?.totals?.carbs ?? 0}
          fat={data?.totals?.fat ?? 0}
          fibre={data?.totals?.fibre ?? 0}
          goals={data?.goals ?? undefined}
        />
        <MealTimeline 
          meals={data?.meals || []} 
          onAdd={() => setShowQuickLog(true)} 
        />
      </main>


      {/* Floating Add Button */}
      <button
        id="quick-log-btn"
        onClick={() => setShowQuickLog(true)}
        className="fixed z-40 w-14 h-14 rounded-full bg-emerald-500 text-white shadow-lg flex items-center justify-center hover:bg-emerald-400 active:scale-90 transition-all duration-200 glow-emerald cursor-pointer"
        style={{ bottom: "calc(5rem + var(--safe-area-bottom, 0px))", right: "1.5rem" }}
        aria-label="Log a meal"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <QuickLog 
        open={showQuickLog} 
        onClose={() => setShowQuickLog(false)} 
        onLogged={refreshData}
      />
      <BottomNav />
    </div>
  );
}

