"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authApi, type User } from "@/lib/api";
import { useRouter } from "next/navigation";

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchUser();
    };
    init();
  }, [fetchUser]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GK";

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5 safe-top">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C7 2 3 6 3 11c0 3 1.5 5.5 4 7.5L12 22l5-3.5c2.5-2 4-4.5 4-7.5C21 6 17 2 12 2z"
                fill="white"
                opacity="0.9"
              />
              <path
                d="M12 6c-1.5 0-3 1-3 3s1.5 4 3 6c1.5-2 3-4 3-6s-1.5-3-3-3z"
                fill="oklch(0.696 0.17 162.48)"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight gradient-text">
              NutriAI
            </h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5 tracking-wide uppercase">
              Smart Nutrition
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">

          {/* Profile */}
          <button id="profile-btn" onClick={() => router.push("/profile")} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <Avatar className="w-8 h-8 border border-white/10">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="bg-gradient-to-br from-emerald-500/20 to-amber-500/20 text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
}
