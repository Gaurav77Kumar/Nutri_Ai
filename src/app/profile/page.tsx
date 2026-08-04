"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authApi, mealsApi, setAuthToken, type User, type Meal } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useRouter } from "next/navigation";
import {Target,Wallet,Bell,Shield,ChevronRight,LogOut,Moon,Calendar, Zap, IndianRupee, Loader2, Globe,Download,FileText,Trash2,AlertTriangle,} from "lucide-react";


interface ProfileStats {
  daysTracked: number;
  totalMeals: number;
}


import { useTheme } from "next-themes";
import { initNotifications, isNotificationEnabled, cancelAllReminders } from "@/lib/notifications";

type EditFormState = Partial<User> & { isPrivate?: boolean };

export default function ProfilePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(false);


  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [me, mealsData] = await Promise.all([
        authApi.me(),
        mealsApi.list({ limit: 1000 })
      ]);
      setUser(me);
      
      const meals = mealsData.meals || [];
      const uniqueDays = new Set(meals.map((m: Meal) => new Date(m.eatenAt).toDateString())).size;
      
      setStats({
        daysTracked: uniqueDays,
        totalMeals: meals.length,
      });
    } catch (err) {
      console.error("Profile fetch failed:", err);
      localStorage.removeItem("nutriai_token");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
      isNotificationEnabled().then(setNotificationsOn);
    };
    init();
  }, [fetchData]);

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem("nutriai_token");
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("nutriai_token")}`
        }
      });
      if (!res.ok) throw new Error("Failed to delete account");
      
      handleLogout();
    } catch (err) {
      console.error(err);
      alert("Failed to delete account. Please try again.");
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditClick = async (key: string) => {
    if (key === "Nutrition Goals" && user) {
      setEditForm({
        calorieGoal: user?.calorieGoal,
        proteinGoal: user?.proteinGoal,
        carbGoal: user?.carbGoal,
        fatGoal: user?.fatGoal,
        waterGoal: user?.waterGoal,
      });
      setEditingKey(key);
    } else if (key === "Food Budget") {
      setEditForm({ weeklyBudget: user?.weeklyBudget, budgetPeriod: user?.budgetPeriod || "weekly" });
      setEditingKey(key);
    } else if (key === "Privacy") {
      setEditForm({}); 
      setEditingKey(key);
    } else if (key === "Appearance") {
      setTheme(theme === "dark" ? "light" : "dark");
    } else if (key === "Language") {
      setEditingKey("Language");
    } else if (key === "Notifications") {
      if (!notificationsOn) {
        const granted = await initNotifications();
        setNotificationsOn(granted);
      } else {
        cancelAllReminders();
        setNotificationsOn(false);
      }
    } else if (key === "Export Data") {
      exportCSV();
    }
  };

  const exportCSV = async () => {
    try {
      const data = await mealsApi.list({ limit: 5000 });
      if (!data.meals || data.meals.length === 0) {
        alert("No meals to export!");
        return;
      }
      
      const headers = ["Date", "Time", "Meal Type", "Food Name", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"];
      const rows = data.meals.map((m: Meal) => {
        const dateObj = new Date(m.eatenAt);
        const date = dateObj.toLocaleDateString();
        const time = dateObj.toLocaleTimeString();
        const name = m.customName || m.foodItem?.name || "Unknown";
        const safeName = name.replace(/"/g, '""');
        return `"${date}","${time}","${m.mealType}","${safeName}","${m.calories}","${m.protein}","${m.carbs}","${m.fat}"`;
      });
      
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `nutriai_meals_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export data");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: Partial<User> = {
        calorieGoal: editForm.calorieGoal ? Number(editForm.calorieGoal) : undefined,
        proteinGoal: editForm.proteinGoal ? Number(editForm.proteinGoal) : undefined,
        carbGoal: editForm.carbGoal ? Number(editForm.carbGoal) : undefined,
        fatGoal: editForm.fatGoal ? Number(editForm.fatGoal) : undefined,
        waterGoal: editForm.waterGoal ? Number(editForm.waterGoal) : undefined,
        weeklyBudget: editForm.weeklyBudget ? Number(editForm.weeklyBudget) : undefined,
        budgetPeriod: editForm.budgetPeriod,
      };
      const updatedUser = await authApi.updateProfile(updateData);
      setUser({ ...user, ...updatedUser });
      setEditingKey(null);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setSaving(false);
    }
  };


  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-emerald-500/60 font-medium text-sm">Loading profile...</p>
      </div>
    );
  }

  const initials = user?.name.split(" ").map((n: string) => n[0]).join("").toUpperCase();

  const nutritionGoals = [
    { label: "Daily Calories", value: `${user?.calorieGoal?.toLocaleString()} kcal` },
    { label: "Protein Target", value: `${user?.proteinGoal}g` },
    { label: "Carbs Target", value: `${user?.carbGoal}g` },
    { label: "Fat Target", value: `${user?.fatGoal}g` },
    { label: "Fibre Target", value: `${user?.fibreGoal || 30}g` },
    { label: "Water Target", value: `${(user?.waterGoal || 3000)/1000}L` },
  ];

  const settingsItems = [
    { id: "Nutrition Goals", icon: Target, label: "Nutrition Goals", description: "Edit your daily macro targets" },
    { id: "Food Budget", icon: Wallet, label: "Food Budget", description: `₹${user?.weeklyBudget?.toLocaleString()}/${user?.budgetPeriod === 'monthly' ? 'month' : 'week'} goal` },
    { id: "Language", icon: Globe, label: t("language"), description: "Choose app language", value: language },
    { id: "Notifications", icon: Bell, label: t("notifications"), description: "Meal reminders & nudges", value: notificationsOn ? "On" : "Off" },
    { id: "Appearance", icon: Moon, label: t("theme"), description: "Dark mode & display", value: theme === "dark" ? "Dark" : "Light" },
    { id: "Privacy", icon: Shield, label: "Privacy", description: "Data visibility" },
    { id: "Export Data", icon: Download, label: "Export Data", description: "Download your meal logs as a CSV file" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      <Navbar />
      <main className="flex-1 px-4 pb-24 pt-4 max-w-2xl mx-auto w-full space-y-5">
        {/* Profile Card */}
        <motion.div
          className="relative overflow-hidden rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/5" />
          <div className="relative p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-16 h-16 border-2 border-emerald-500/30">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name} />}
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500/20 to-amber-500/20 text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{user?.name}</h2>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <StatItem label="Days Tracked" value={stats?.daysTracked || 0} icon={Calendar} color="text-emerald-400" />
              <StatItem label="Meals Logged" value={stats?.totalMeals || 0} icon={Zap} color="text-sky-400" />
            </div>
          </div>
        </motion.div>

        {/* Food Budget Optimizer */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Food Budget</h3>
            <Badge variant="secondary" className="text-[9px] h-4 bg-amber-500/10 text-amber-400 border-none ml-auto capitalize">
              {user?.budgetPeriod || "weekly"} Plan
            </Badge>
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xl font-bold tabular-nums">₹{user?.weeklyBudget?.toLocaleString()}</p>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Planned Budget</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            &quot;AI is tracking your meal costs to optimize your ₹{user?.weeklyBudget?.toLocaleString()} {user?.budgetPeriod || "weekly"} spending plan.&quot;
          </p>
        </div>

        {/* Nutrition Goals */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground/90">Personal Nutrition Goals</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {nutritionGoals.map((goal) => (
              <div key={goal.label} className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{goal.label}</span>
                <span className="text-xs font-bold text-foreground/80">{goal.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Items */}



        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
          {settingsItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleEditClick(item.id)}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 transition-colors">
                <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-foreground/90">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.description}</p>
              </div>
              {item.id === "Notifications" ? (
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${notificationsOn ? 'bg-emerald-500' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notificationsOn ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              ) : item.value ? (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">{item.value}</span>
              ) : (
                <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30" />
              )}
            </button>
          ))}
        </div>

        {/* Legal & Security */}
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5 mb-4">
          <div className="p-4 bg-white/5 border-b border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Legal & Security</h3>
          </div>
          <button
            onClick={() => alert("Privacy Policy will be linked here before store launch.")}
            className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground/90">Privacy Policy</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/10" />
          </button>
          <button
            onClick={() => alert("Terms of Service will be linked here before store launch.")}
            className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground/90">Terms of Service</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/10" />
          </button>
        </div>

        {/* Logout & Delete */}
        <div className="space-y-3 mb-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 text-white hover:bg-white/10 transition-all cursor-pointer border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">{t("logout")}</span>
          </button>
          
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer border border-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Delete Account</span>
          </button>
        </div>
      </main>
      <BottomNav />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-[#111115] border border-rose-500/20 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-black mb-2 text-white">Delete Account?</h3>
              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                This action is <strong className="text-rose-400">permanent and irreversible</strong>. All your meal logs, weight tracking, weekly insights, and personal data will be completely wiped from our servers to comply with global privacy laws.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="w-full py-4 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-500 transition-colors flex justify-center items-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, Delete Everything"}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="w-full py-4 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Editor Modal */}
      {editingKey && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111115] border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-white">Edit {editingKey}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              {editingKey === "Nutrition Goals" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Daily Calories (kcal)</label>
                    <input type="number" required value={editForm.calorieGoal || ""} onChange={e => setEditForm({...editForm, calorieGoal: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Protein Target (g)</label>
                    <input type="number" required value={editForm.proteinGoal || ""} onChange={e => setEditForm({...editForm, proteinGoal: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Carbs Target (g)</label>
                    <input type="number" required value={editForm.carbGoal || ""} onChange={e => setEditForm({...editForm, carbGoal: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Fat Target (g)</label>
                    <input type="number" required value={editForm.fatGoal || ""} onChange={e => setEditForm({...editForm, fatGoal: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Water Target (ml)</label>
                    <input type="number" required value={editForm.waterGoal || ""} onChange={e => setEditForm({...editForm, waterGoal: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                </>
              )}
              {editingKey === "Food Budget" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Budget Period</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setEditForm({...editForm, budgetPeriod: "weekly"})} className={`py-2 rounded-xl text-xs font-bold transition-all ${editForm.budgetPeriod === "weekly" ? 'bg-emerald-500 text-white' : 'bg-white/5 text-muted-foreground'}`}>Weekly</button>
                      <button type="button" onClick={() => setEditForm({...editForm, budgetPeriod: "monthly"})} className={`py-2 rounded-xl text-xs font-bold transition-all ${editForm.budgetPeriod === "monthly" ? 'bg-emerald-500 text-white' : 'bg-white/5 text-muted-foreground'}`}>Monthly</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold">Budget Amount (₹)</label>
                    <input type="number" required value={editForm.weeklyBudget || ""} onChange={e => setEditForm({...editForm, weeklyBudget: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                </div>
              )}
              {editingKey === "Privacy" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Keep your meal logs private</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={editForm.isPrivate || false} onChange={e => setEditForm({...editForm, isPrivate: e.target.checked})} />
                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              )}
              {editingKey === "Language" && (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setLanguage("English");
                      setEditingKey(null);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all ${language === "English" ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                  >
                    <span className="block text-xl mb-1">🇺🇸</span>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">English</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setLanguage("Hindi");
                      setEditingKey(null);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all ${language === "Hindi" ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                  >
                    <span className="block text-xl mb-1">🇮🇳</span>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Hindi</span>
                  </button>
                </div>
              )}

              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingKey(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-sm font-bold text-white hover:bg-white/10 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 transition">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <div className="h-24" />
      <BottomNav />
    </div>
  );
}



function StatItem({ label, value, icon: Icon, color }: { label: string; value: string | number | undefined; icon: React.ElementType; color: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/5">
      <Icon className={`w-4 h-4 mb-1.5 ${color}`} />
      <span className="text-xs font-black text-white tabular-nums">{value ?? 0}</span>
      <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">{label}</span>
    </div>
  );
}
