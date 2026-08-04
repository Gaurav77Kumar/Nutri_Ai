"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Plus, Moon, AlertTriangle, Settings2, Trash2, ChevronDown } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Preferences } from "@capacitor/preferences";

// Why Preferences over localStorage?
// In a Capacitor WebView, localStorage can be cleared by the OS when space is tight or when the app cache is cleared.
// Preferences writes to native storage (UserDefaults on iOS, SharedPreferences on Android) 
// ensuring caffeine logs survive OS-level storage cleanup!
const memoryFallback: Record<string, string> = {};
const rawGet = async (key: string): Promise<string | null> => {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch (e) {
    console.warn(`Preferences.get failed for ${key}, using memory fallback`, e);
    return memoryFallback[key] || null;
  }
};

const rawSet = async (key: string, value: string): Promise<void> => {
  try {
    await Preferences.set({ key, value });
  } catch (e) {
    console.warn(`Preferences.set failed for ${key}, using memory fallback`, e);
    memoryFallback[key] = value;
  }
};

import {  DrinkLog,  MetabolismProfile,  DEFAULT_PROFILE,  getEffectiveHalfLife,  getTotalActiveCaffeine, getSafeSleepInterval} from "@/lib/caffeine-math";
import { CaffeineChart } from "@/components/caffeine/CaffeineChart";
import { MetabolismSettings } from "@/components/caffeine/MetabolismProfile";

const generateId = () => Math.random().toString(36).substr(2, 9);
const getNow = () => Date.now();

export default function CaffeinePage() {
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [profile, setProfile] = useState<MetabolismProfile>(DEFAULT_PROFILE);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [safeSleepData, setSafeSleepData] = useState<{ earliest: Date|null, latest: Date|null, projected: Date|null }>({ earliest: null, latest: null, projected: null });
  const [now, setNow] = useState<number>(0);
  
  useEffect(() => {
    const init = () => setNow(Date.now());
    init();
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [customMg, setCustomMg] = useState<string>("");
  const [customTime, setCustomTime] = useState<string>("");
  const [stomachState, setStomachState] = useState<string>("Empty stomach");
  const [loggerError, setLoggerError] = useState<string>("");

  const DRINK_PRESETS = [
    { name: "Filter Coffee", amount: 120, icon: "☕" },
    { name: "Instant Coffee", amount: 57, icon: "☕" },
    { name: "Chai", amount: 40, icon: "🫖" },
    { name: "Black Tea", amount: 47, icon: "🫖" },
    { name: "Green Tea", amount: 35, icon: "🌿" },
    { name: "Energy Drink", amount: 160, icon: "⚡" },
  ];

  const handleAddPreset = (name: string, amount: number) => {
    saveLogs([...logs, {
      id: generateId(),
      type: name,
      amountMg: amount,
      timestamp: getNow(),
    }]);
  };

  const handleAddCustom = () => {
    const mg = Number(customMg);
    if (!mg || mg < 5 || mg > 500) {
      setLoggerError("Amount must be between 5 and 500.");
      return;
    }
    let timestamp = getNow();
    if (customTime !== "0") {
      timestamp -= parseInt(customTime) * 60 * 1000;
    }
    saveLogs([...logs, {
      id: generateId(),
      type: `Custom (${stomachState})`,
      amountMg: mg,
      timestamp,
    }]);
    setCustomMg("");
    setCustomTime("0");
    setLoggerError("");
  };

  // Persistence Engine
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedLogs = await rawGet("caffeine_logs_v2");
        const savedProfile = await rawGet("caffeine_profile_v1");
        
        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
        }
        
        if (savedLogs) {
          const parsed = JSON.parse(savedLogs);
          // Prune older than 48h
          const recentLogs = parsed.filter((l: DrinkLog) => Date.now() - l.timestamp < 48 * 60 * 60 * 1000);
          setLogs(recentLogs);
          if (parsed.length !== recentLogs.length) {
            await rawSet("caffeine_logs_v2", JSON.stringify(recentLogs));
          }
        }
      } catch (e) {
        console.error("Storage Error:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadState();
  }, []);

  const saveLogs = async (newLogs: DrinkLog[]) => {
    setLogs(newLogs);
    await rawSet("caffeine_logs_v2", JSON.stringify(newLogs));
  };

  const saveProfile = async (newProfile: MetabolismProfile) => {
    setProfile(newProfile);
    await rawSet("caffeine_profile_v1", JSON.stringify(newProfile));
  };

  // Math Engine Heartbeat
  useEffect(() => {
    if (!isLoaded) return;

    const calculate = () => {
      const nowMs = Date.now();
      const effectiveHalfLife = getEffectiveHalfLife(profile);
      
      const totalLevel = getTotalActiveCaffeine(logs, nowMs, effectiveHalfLife);
      setCurrentLevel(totalLevel);

      const sleepData = getSafeSleepInterval(logs, nowMs, effectiveHalfLife);
      setSafeSleepData(sleepData);
    };

    calculate();
    // Run every minute
    const interval = setInterval(calculate, 60000);
    
    // Also recalculate when window becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') calculate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [logs, profile, isLoaded]);

  if (!isLoaded) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const maxLevel = 400; 
  const levelPercent = Math.min((currentLevel / maxLevel) * 100, 100);
  
  let statusColor = "from-emerald-400 to-teal-500";
  let statusText = "Safe Zone";
  if (currentLevel > 200) {
    statusColor = "from-rose-500 to-red-600";
    statusText = "High Alert";
  } else if (currentLevel > 100) {
    statusColor = "from-orange-400 to-orange-500";
    statusText = "Moderate";
  } else if (currentLevel > 50) {
    statusColor = "from-yellow-400 to-amber-500";
    statusText = "Low";
  }

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--";
    if (date.getTime() <= now) return "Now";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const timeUntilSafe = safeSleepData.projected ? Math.max(0, safeSleepData.projected.getTime() - now) : 0;
  const hoursSafe = Math.floor(timeUntilSafe / (1000 * 60 * 60));
  const minsSafe = Math.floor((timeUntilSafe % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="min-h-screen bg-black font-sans pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5 pt-4 pb-2">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Caffeine Predictor</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Advanced Biology Engine</p>
            </div>
          </div>
          <button 
            onClick={() => setShowProfile(true)}
            className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Metabolism Settings"
          >
            <Settings2 className="w-5 h-5 text-white/70" />
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-6 flex flex-col items-center gap-6">
        {/* Section 1: Main Dial & Legend */}
        <div className="w-full glass-card rounded-3xl p-6 flex flex-col items-center border-white/5 relative min-h-[300px] justify-center">
          <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" aria-hidden="true" viewBox="0 0 192 192" preserveAspectRatio="xMidYMid meet">
              <circle cx="96" cy="96" r="86" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <motion.circle 
                cx="96" cy="96" r="86" 
                fill="none" 
                stroke="url(#gradientMain)" 
                strokeWidth="8" 
                strokeLinecap="round"
                initial={{ strokeDashoffset: 2 * Math.PI * 86 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 86 * (1 - levelPercent / 100) }}
                transition={{ duration: 1.5, type: "spring", bounce: 0.1 }}
                style={{ strokeDasharray: 2 * Math.PI * 86 }}
              />
              <defs>
                <linearGradient id="gradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={currentLevel > 200 ? "#f43f5e" : currentLevel > 100 ? "#fbbf24" : "#34d399"} />
                  <stop offset="100%" stopColor={currentLevel > 200 ? "#e11d48" : currentLevel > 100 ? "#f97316" : "#10b981"} />
                </linearGradient>
              </defs>
            </svg>
            <div className={`absolute inset-6 rounded-full bg-gradient-to-br ${statusColor} opacity-10 blur-2xl`}></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="text-4xl font-black tabular-nums tracking-tighter">
                {currentLevel.toFixed(0)}
              </span>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">mg • {statusText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"></div><span className="text-[10px] text-white/70">&lt;50mg clear</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[10px] text-white/70">50-100mg mod</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400"></div><span className="text-[10px] text-white/70">100-200mg elev</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[10px] text-white/70">&gt;200mg high</span></div>
          </div>

          {currentLevel > 200 && (
            <div className="w-full mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 text-red-400 text-xs font-bold text-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Caffeine is above 200mg — drink water and consider pacing your next cup.
            </div>
          )}
        </div>

        {/* Section 2: Sleep Safe Predictor */}
        <div className="w-full glass-card rounded-3xl p-6 border-white/5 relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-50 rounded-3xl"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Moon className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white/90">Sleep Safe Predictor</h3>
            </div>
            
            <div className="text-5xl font-black text-white my-2 tracking-tight">
              {formatTime(safeSleepData.projected)}
            </div>
            
            {timeUntilSafe > 0 ? (
              <div className="flex flex-col items-center gap-1 mt-2">
                <span className="text-indigo-300 font-bold text-sm bg-indigo-500/10 px-4 py-1.5 rounded-full">
                  Safe in {hoursSafe}h {minsSafe}m
                </span>
                {safeSleepData.projected && safeSleepData.projected.getTime() > now && (
                  <span className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">
                    Range: {formatTime(safeSleepData.earliest)} - {formatTime(safeSleepData.latest)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-4 py-1.5 rounded-full mt-2">
                You are safe to sleep now!
              </span>
            )}
          </div>
        </div>

        {/* Section 3: Log a Drink */}
        <div className="w-full glass-card rounded-3xl p-5 border-white/5">
          <h3 className="font-bold text-sm text-white/90 mb-4">Log a drink</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {DRINK_PRESETS.map((preset) => (
              <button 
                key={preset.name}
                onClick={() => handleAddPreset(preset.name, preset.amount)}
                className="bg-white/10 border border-white/20 hover:bg-white/20 rounded-2xl p-4 flex flex-col items-center justify-center transition-colors text-center"
              >
                <span className="text-xl mb-1">{preset.icon}</span>
                <span className="text-xs font-bold">{preset.name}</span>
                <span className="text-[10px] text-emerald-400">{preset.amount}mg</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="w-full">
              <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1.5 block">Custom mg</label>
              <input type="number" placeholder="e.g. 80" value={customMg} onChange={e => setCustomMg(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 text-sm outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div className="w-full relative">
              <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1.5 block">Time</label>
              <div className="relative">
                <select value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 text-sm outline-none focus:border-emerald-500 transition-colors cursor-pointer text-white appearance-none pr-8">
                  <option value="0" className="bg-[#111] text-white">Just now</option>
                  <option value="15" className="bg-[#111] text-white">15 mins ago</option>
                  <option value="30" className="bg-[#111] text-white">30 mins ago</option>
                  <option value="60" className="bg-[#111] text-white">1 hour ago</option>
                  <option value="120" className="bg-[#111] text-white">2 hours ago</option>
                  <option value="240" className="bg-[#111] text-white">4 hours ago</option>
                </select>
                <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="w-full relative">
              <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1.5 block">Stomach</label>
              <div className="relative">
                <select value={stomachState} onChange={e => setStomachState(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 text-sm outline-none focus:border-emerald-500 transition-colors cursor-pointer text-white appearance-none pr-8">
                  <option value="Empty stomach" className="bg-[#111] text-white">Empty stomach</option>
                  <option value="Full meal" className="bg-[#111] text-white">Full meal</option>
                </select>
                <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <button onClick={handleAddCustom} className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-1 transition-colors">
              <Plus className="w-4 h-4 shrink-0" /> Add
            </button>
          </div>
          {loggerError && <p className="text-red-400 text-xs mt-2">{loggerError}</p>}

          {/* Active Logs */}
          {logs.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              {logs.slice().reverse().map(log => {
                const preset = DRINK_PRESETS.find(p => log.type.includes(p.name));
                const icon = preset ? preset.icon : "⚡";
                return (
                  <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#111] border border-white/5 flex items-center justify-center text-lg">
                        {icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white/90">{log.type}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">{log.amountMg}mg</span>
                          <span className="text-[10px] font-medium text-white/40">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => saveLogs(logs.filter(l => l.id !== log.id))} className="text-white/20 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-full">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Decay Visualization */}
        <div className="w-full glass-card rounded-3xl p-5 border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-white/90">Next 24 hours</h3>
          </div>
          <div className="w-full bg-[#111] rounded-2xl overflow-hidden pt-2">
            <CaffeineChart logs={logs} effectiveHalfLife={getEffectiveHalfLife(profile)} />
          </div>
        </div>

      </main>

      {/* Modals */}
      <AnimatePresence>
        {showProfile && (
          <MetabolismSettings 
            profile={profile}
            onClose={() => setShowProfile(false)}
            onSave={saveProfile}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
