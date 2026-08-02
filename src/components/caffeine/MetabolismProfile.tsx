"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Settings2, Save } from "lucide-react";
import { MetabolismProfile, DEFAULT_PROFILE, getEffectiveHalfLife } from "@/lib/caffeine-math";

type Props = {
  profile: MetabolismProfile;
  onSave: (p: MetabolismProfile) => void;
  onClose: () => void;
};

export function MetabolismSettings({ profile, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<MetabolismProfile>({ ...profile });

  const effective = getEffectiveHalfLife(draft);
  const activeFactors = draft.lifestyleFactors || [];

  const FACTORS = [
    { id: 'athlete', label: 'Athlete / High Exercise', desc: 'Increases metabolism (faster clearance)' },
    { id: 'sleep_deprived', label: 'Sleep Deprived', desc: 'Slows down metabolism' },
    { id: 'dehydrated', label: 'Dehydrated', desc: 'Slows down metabolism' },
    { id: 'vegetarian', label: 'High Veg / Vegetarian', desc: 'Increases metabolism' },
  ];

  const handleToggleFactor = (id: string) => {
    if (activeFactors.includes(id)) {
      setDraft({ ...draft, lifestyleFactors: activeFactors.filter(f => f !== id) });
    } else {
      if (activeFactors.length >= 2) return; 
      setDraft({ ...draft, lifestyleFactors: [...activeFactors, id] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-[#111] rounded-3xl border border-white/10 p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-black">Metabolism Profile</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <p className="text-xs text-white/50 mb-6">
          Caffeine metabolism varies wildly based on genetics and lifestyle. Adjusting these settings improves the accuracy of the biological engine.
        </p>

        <div className="space-y-6">
          {/* Base Half Life */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-sm font-bold">Base Half-Life</h3>
              <span className="text-xs text-indigo-400">{draft.halfLifeHours.toFixed(1)} hrs</span>
            </div>
            <input 
              type="range" 
              min="2" max="10" step="0.5" 
              value={draft.halfLifeHours}
              onChange={e => setDraft({...draft, halfLifeHours: Number(e.target.value)})}
              className="w-full accent-indigo-500"
            />
            <p className="text-[10px] text-white/40 mt-1">Average human is 5 hours. (Range: 2-10 hrs)</p>
          </div>

          {/* Genetic Type */}
          <div>
            <h3 className="text-sm font-bold mb-2">Genetic Speed (CYP1A2)</h3>
            <div className="flex gap-2">
              {(["fast", "normal", "slow"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setDraft({...draft, geneticType: type})}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${draft.geneticType === type ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-sm font-bold">Lifestyle Modifiers</h3>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{activeFactors.length}/2 MAX</span>
            </div>
            
            {FACTORS.map(factor => (
              <label 
                key={factor.id} 
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${activeFactors.includes(factor.id) ? 'bg-indigo-500/10 border-indigo-500' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${!activeFactors.includes(factor.id) && activeFactors.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div>
                  <p className="font-bold text-sm">{factor.label}</p>
                  <p className="text-[10px] text-white/40">{factor.desc}</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={activeFactors.includes(factor.id)}
                  onChange={() => handleToggleFactor(factor.id)}
                  disabled={!activeFactors.includes(factor.id) && activeFactors.length >= 2}
                  className="w-5 h-5 accent-indigo-500"
                />
              </label>
            ))}
          </div>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex justify-between items-center">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Effective Half-Life:</span>
            <span className="text-xl font-black text-indigo-400">{effective.toFixed(1)} hrs</span>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => { setDraft(DEFAULT_PROFILE); }}
              className="flex-1 py-3 text-sm font-bold text-white/50 bg-white/5 rounded-xl hover:bg-white/10"
            >
              Reset Default
            </button>
            <button 
              onClick={() => { onSave(draft); onClose(); }}
              className="flex-[2] py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-white/90 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4"/> Apply Profile
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
