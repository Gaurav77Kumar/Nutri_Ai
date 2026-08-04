"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Play, Square, Activity, Flame, Droplets } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Preferences } from "@capacitor/preferences";

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

const rawRemove = async (key: string): Promise<void> => {
  try {
    await Preferences.remove({ key });
  } catch (e) {
    console.warn(`Preferences.remove failed for ${key}, using memory fallback`, e);
    delete memoryFallback[key];
  }
};

// Phases of fasting
const FASTING_PHASES = [
  { minHours: 0, maxHours: 4, title: "Blood Sugar Normalizing", description: "Insulin levels begin to drop.", icon: Droplets, color: "from-blue-400 to-indigo-500" },
  { minHours: 4, maxHours: 12, title: "Digestive Rest", description: "Digestion completes, gut heals.", icon: Activity, color: "from-emerald-400 to-teal-500" },
  { minHours: 12, maxHours: 16, title: "Fat Burning", description: "Body switches to fat for energy.", icon: Flame, color: "from-amber-400 to-orange-500" },
  { minHours: 16, maxHours: 72, title: "Autophagy", description: "Cellular repair and regeneration.", icon: Moon, color: "from-purple-400 to-fuchsia-500" },
];

const GOAL_OPTIONS = [12, 14, 16, 18, 20];

export default function FastingPage() {
  const [isFasting, setIsFasting] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [goalHours, setGoalHours] = useState<number>(16);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const init = () => {
      setNow(Date.now());
    };
    init();
  }, []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fastingHistory, setFastingHistory] = useState<{startTime: number, endTime: number, durationHours: number}[]>([]);

  // Load from native storage
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedStart = await rawGet("fasting_start");
        const savedGoal = await rawGet("fasting_goal");
        
        if (savedStart) {
          setStartTime(parseInt(savedStart, 10));
          setIsFasting(true);
        }
        if (savedGoal) {
          setGoalHours(parseInt(savedGoal, 10));
        }
        
        const savedHistory = await rawGet("fasting_history");
        if (savedHistory) {
          const history = JSON.parse(savedHistory);
          const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const validHistory = history.filter((h: { endTime: number }) => h.endTime > oneWeekAgo);
          setFastingHistory(validHistory);
          if (history.length !== validHistory.length) {
            await rawSet("fasting_history", JSON.stringify(validHistory));
          }
        }
      } catch (e: unknown) {
        console.error("Storage Error:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);

  // Update timer every second
  useEffect(() => {
    if (!isFasting) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isFasting]);

  const toggleFasting = async () => {
    if (isFasting && startTime) {
      // Stop
      const endTime = Date.now();
      const durationHours = (endTime - startTime) / (1000 * 60 * 60);
      
      if (durationHours > 0.25) {
        const newFast = { startTime, endTime, durationHours };
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const updatedHistory = [...fastingHistory, newFast].filter(h => h.endTime > oneWeekAgo);
        
        await rawSet("fasting_history", JSON.stringify(updatedHistory));
        setFastingHistory(updatedHistory);
      }
      
      await rawRemove("fasting_start");
      setStartTime(null);
      setIsFasting(false);
    } else {
      // Start
      const newStart = Date.now();
      await rawSet("fasting_start", newStart.toString());
      await rawSet("fasting_goal", goalHours.toString());
      setStartTime(newStart);
      setIsFasting(true);
      setNow(newStart);
    }
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Calculations
  const elapsedMs = isFasting && startTime ? now - startTime : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const goalMs = goalHours * 60 * 60 * 1000;
  
  // Format MM:SS or HH:MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = isFasting ? Math.min((elapsedMs / goalMs) * 100, 100) : 0;
  const timeRemainingMs = Math.max(goalMs - elapsedMs, 0);

  // Determine current phase
  const currentPhase = FASTING_PHASES.find(p => elapsedHours >= p.minHours && elapsedHours < p.maxHours) || FASTING_PHASES[FASTING_PHASES.length - 1];

  const PhaseIcon = currentPhase.icon;

  return (
    <div className="min-h-screen bg-black font-sans pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4 px-4 h-16 max-w-2xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 blur-md opacity-40 rounded-full"></div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative shadow-xl border border-white/10">
              <Moon className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg">Fasting Tracker</h1>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-8 flex flex-col items-center">
        
        {/* Goal Selector (Only when not fasting) */}
        <AnimatePresence>
          {!isFasting && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mb-12 overflow-hidden"
            >
              <p className="text-center text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Select Goal</p>
              <div className="flex justify-center gap-3">
                {GOAL_OPTIONS.map(h => (
                  <button
                    key={h}
                    onClick={() => setGoalHours(h)}
                    className={`w-14 h-14 rounded-2xl font-black text-lg transition-all ${
                      goalHours === h 
                        ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Circular Timer Ring */}
        <div className="relative w-72 h-72 mb-12 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            {/* Background track */}
            <circle 
              cx="144" cy="144" r="130" 
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" 
            />
            {/* Progress track */}
            <motion.circle 
              cx="144" cy="144" r="130" 
              fill="none" 
              stroke="url(#gradient)" 
              strokeWidth="8" 
              strokeLinecap="round"
              initial={{ strokeDashoffset: 2 * Math.PI * 130 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 130 * (1 - progressPercent / 100) }}
              transition={{ duration: 1, ease: "linear" }}
              style={{ strokeDasharray: 2 * Math.PI * 130 }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isFasting ? "#34d399" : "#6366f1"} />
                <stop offset="100%" stopColor={isFasting ? "#059669" : "#8b5cf6"} />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Text */}
          <div className="relative z-10 flex flex-col items-center">
            {isFasting ? (
              <>
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Elapsed</p>
                <span className="text-5xl font-black tabular-nums tracking-tighter mb-2">{formatTime(elapsedMs)}</span>
                <p className="text-sm font-bold text-emerald-400">{formatTime(timeRemainingMs)} left</p>
              </>
            ) : (
              <>
                <Moon className="w-12 h-12 text-white/20 mb-4" />
                <span className="text-3xl font-black text-white/50">Ready</span>
              </>
            )}
          </div>
        </div>

        {/* Start / Stop Button */}
        <button
          onClick={toggleFasting}
          className={`w-full max-w-[280px] h-16 rounded-[24px] font-black text-lg uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${
            isFasting 
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
              : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
          }`}
        >
          {isFasting ? <><Square className="w-5 h-5 fill-current" /> End Fast</> : <><Play className="w-5 h-5 fill-current" /> Start Fast</>}
        </button>

        {/* Biological Phase Indicator */}
        <AnimatePresence>
          {isFasting && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full mt-12 glass-card rounded-[32px] p-6 border-white/5 relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${currentPhase.color} opacity-10 blur-3xl rounded-full pointer-events-none`}></div>
              
              <div className="flex items-center gap-4 relative z-10 mb-2">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentPhase.color} flex items-center justify-center shadow-lg`}>
                  <PhaseIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Current Phase</p>
                  <h3 className="font-bold text-lg leading-none text-white">{currentPhase.title}</h3>
                </div>
              </div>
              
              <p className="text-sm text-white/70 relative z-10 mt-4 pl-1">{currentPhase.description}</p>
              
              {/* Mini timeline */}
              <div className="flex gap-1 mt-6 relative z-10">
                {FASTING_PHASES.map((p, i) => {
                  const isActive = elapsedHours >= p.minHours && elapsedHours < p.maxHours;
                  const isPassed = elapsedHours >= p.maxHours;
                  return (
                    <div 
                      key={i} 
                      className={`h-1.5 rounded-full flex-1 transition-colors ${
                        isActive ? `bg-gradient-to-r ${p.color}` : isPassed ? "bg-white/30" : "bg-white/5"
                      }`}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fasting History */}
        {!isFasting && fastingHistory.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full mt-8"
          >
            <h3 className="text-sm font-bold text-white/90 mb-4 px-1">Past 7 Days</h3>
            <div className="space-y-3">
              {fastingHistory.slice().reverse().map((fast, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">{fast.durationHours.toFixed(1)} hours</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(fast.endTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
