export type DrinkLog = {
  id: string;
  type: string;
  amountMg: number;
  timestamp: number; 
};

export type MetabolismProfile = {
  halfLifeHours: number;
  geneticType: "slow" | "normal" | "fast";
  lifestyleFactors: string[];
};

export const DEFAULT_PROFILE: MetabolismProfile = {
  halfLifeHours: 5,
  geneticType: "normal",
  lifestyleFactors: [],
};

// Calculate effective half-life based on profile modifiers
export function getEffectiveHalfLife(profile: MetabolismProfile): number {
  let base = profile.halfLifeHours || 5;
  if (profile.geneticType === "fast") base *= 0.8;
  if (profile.geneticType === "slow") base *= 1.5;
  
  const factors = profile.lifestyleFactors || [];
  if (factors.includes("athlete")) base *= 0.8;
  if (factors.includes("sleep_deprived")) base *= 1.2;
  if (factors.includes("dehydrated")) base *= 1.15;
  if (factors.includes("vegetarian")) base *= 0.85;
  
  return base;
}

// C(t) = C0 * (0.5)^(t/h)
export function calculateDecay(amountMg: number, elapsedHours: number, halfLifeHours: number): number {
  if (elapsedHours < 0) return 0; 
  return amountMg * Math.pow(0.5, elapsedHours / halfLifeHours);
}

// Get total active caffeine at a specific exact time
export function getTotalActiveCaffeine(logs: DrinkLog[], targetTimeMs: number, halfLifeHours: number): number {
  return logs.reduce((total, log) => {
    const elapsedHours = (targetTimeMs - log.timestamp) / (1000 * 60 * 60);
    return total + calculateDecay(log.amountMg, elapsedHours, halfLifeHours);
  }, 0);
}

// Generate data points for the next 24 hours (10 min intervals = 144 points, or 240 for ~6 min intervals)
// Recharts prefers fewer points for performance,  using 144 (every 10 mins) over 24h.
export function generateDecayCurve(logs: DrinkLog[], startTimeMs: number, halfLifeHours: number) {
  const points = [];
  const intervalMs = 10 * 60 * 1000; // 10 minutes
  
  for (let i = 0; i <= 144; i++) {
    const timeMs = startTimeMs + (i * intervalMs);
    const totalLevel = getTotalActiveCaffeine(logs, timeMs, halfLifeHours);
    
    const point: Record<string, number> = {
      time: timeMs,
      total: Math.max(0, parseFloat(totalLevel.toFixed(1))),
    };

    logs.forEach(log => {
      const elapsedHours = (timeMs - log.timestamp) / (1000 * 60 * 60);
      const val = calculateDecay(log.amountMg, elapsedHours, halfLifeHours);
      point[`drink_${log.id}`] = Math.max(0, parseFloat(val.toFixed(1)));
    });

    points.push(point);
  }
  return points;
}

// Binary Search to find EXACT minute it drops below 50mg
export function findSafeSleepTime(logs: DrinkLog[], startTimeMs: number, halfLifeHours: number, thresholdMg: number = 50): Date | null {
  const currentTotal = getTotalActiveCaffeine(logs, startTimeMs, halfLifeHours);
  if (currentTotal <= thresholdMg) return new Date(startTimeMs);

  let lowMs = startTimeMs;
  let highMs = startTimeMs + (48 * 60 * 60 * 1000); 
  let bestMs = highMs;
  
  while (highMs - lowMs > 60000) {
    const midMs = Math.floor((lowMs + highMs) / 2);
    const val = getTotalActiveCaffeine(logs, midMs, halfLifeHours);
    
    if (val <= thresholdMg) {
      bestMs = midMs;
      highMs = midMs; 
    } else {
      lowMs = midMs;
    }
  }
  
  return new Date(bestMs);
}

// Calculate confidence interval boundaries
export function getSafeSleepInterval(logs: DrinkLog[], startTimeMs: number, effectiveHalfLife: number) {
  const fastHalfLife = effectiveHalfLife * 0.85; 
  const slowHalfLife = effectiveHalfLife * 1.15; 
  
  const earliest = findSafeSleepTime(logs, startTimeMs, fastHalfLife);
  const latest = findSafeSleepTime(logs, startTimeMs, slowHalfLife);
  const projected = findSafeSleepTime(logs, startTimeMs, effectiveHalfLife);
  
  return { earliest, latest, projected };
}
