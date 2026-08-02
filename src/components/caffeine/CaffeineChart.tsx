"use client";

import { useMemo, useState, useEffect } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { DrinkLog, generateDecayCurve } from "@/lib/caffeine-math";

type CaffeineChartProps = {
  logs: DrinkLog[];
  effectiveHalfLife: number;
};

export function CaffeineChart({ logs, effectiveHalfLife }: CaffeineChartProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const init = () => {
      setNow(Date.now());
    };
    init();
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Memoizing the computationally heavy curve generation
  const data = useMemo(() => {
    if (!now) return [];
    const startTimeMs = now - (2 * 60 * 60 * 1000); 
    return generateDecayCurve(logs, startTimeMs, effectiveHalfLife);
  }, [logs, effectiveHalfLife, now]);

  if (logs.length === 0 || !now) {
    return (
      <div className="w-full h-48 flex items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
        <p className="text-white/40 text-sm">Log a drink to see your metabolic curve</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total));

  return (
    <div className="w-full h-64 select-none touch-pan-x touch-pan-y" aria-label="Caffeine decay over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              {maxTotal > 200 && <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8}/>}
              <stop offset="30%" stopColor={maxTotal > 100 ? "#fbbf24" : "#34d399"} stopOpacity={0.6}/>
              <stop offset="90%" stopColor="#34d399" stopOpacity={0.1}/>
            </linearGradient>
            {logs.map((log, i) => (
              <linearGradient key={log.id} id={`color_${log.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`hsl(${(i * 50) % 360}, 70%, 60%)`} stopOpacity={0.4}/>
                <stop offset="100%" stopColor={`hsl(${(i * 50) % 360}, 70%, 60%)`} stopOpacity={0.0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          
          <XAxis 
            dataKey="time" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(tick) => {
              const d = new Date(tick);
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            minTickGap={30}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            domain={[0, 'auto']}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const total = payload.find(p => p.dataKey === 'total')?.value as number;
                return (
                  <div className="bg-[#111] border border-white/10 p-3 rounded-xl shadow-xl">
                    <p className="text-xs text-white/50 mb-1">{new Date(label as number | string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="font-bold text-lg">{total.toFixed(0)} <span className="text-[10px] text-white/50">mg</span></p>
                    <div className="mt-2 pt-2 border-t border-white/5">
                      {payload.filter(p => p.dataKey !== 'total').map(p => (
                        <div key={p.dataKey as string} className="flex justify-between text-xs gap-4 mb-1">
                          <span style={{color: p.color}}>{logs.find(l => `drink_${l.id}` === p.dataKey)?.type}</span>
                          <span>{(p.value as number).toFixed(1)}mg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          
          {/* Safe Sleep Line */}
          <ReferenceLine y={50} stroke="#6366f1" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Safe Sleep (50mg)', fill: '#818cf8', fontSize: 10 }} />
          <ReferenceLine x={now} stroke="rgba(255,255,255,0.3)" label={{ position: 'insideTopRight', value: 'Now', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />

          {/* Individual contribution areas */}
          {logs.map((log, i) => (
            <Area 
              key={log.id}
              type="monotone" 
              dataKey={`drink_${log.id}`} 
              stackId="1"
              stroke={`hsl(${(i * 50) % 360}, 70%, 60%)`}
              fill={`url(#color_${log.id})`}
              isAnimationActive={false}
            />
          ))}

          {/* Cumulative Total Curve Overlay (if we didn't want stacked, but stacked is usually better. 
              We'll just draw the total line heavily on top for clarity) */}
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="url(#colorTotal)" 
            strokeWidth={3}
            fill="none" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
