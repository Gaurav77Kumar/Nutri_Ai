"use client";

import { motion } from "framer-motion";

import { useEffect, useState } from "react";

const quotes = [
  "Eating healthy is a form of self-respect. ✨",
  "Health is wealth, start today! 💰",
  "Your body is your temple, treat it well. 🏛️",
  "Let food be thy medicine. 🍎",
  "A healthy outside starts from the inside. 🧘",
  "Fitness is not a destination, it's a way of life. 🏃‍♂️",
  "Small steps every day lead to big results. 📈",
  "Drink water like your life depends on it (it does!). 💧",
  "Savour every bite, your body will thank you. 🥗",
  "consistency is the key to transformation. 🔑"
];

export function LoadingState() {
  const [quote, setQuote] = useState("");

  useEffect(() => {
    const init = async () => {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    };
    init();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500"
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <p className="text-sm font-black text-white/40 uppercase tracking-widest">Loading Health Intel</p>
        <p className="text-lg font-medium text-white max-w-[280px] italic leading-relaxed">
          &quot;{quote}&quot;
        </p>
      </motion.div>
    </div>
  );
}
