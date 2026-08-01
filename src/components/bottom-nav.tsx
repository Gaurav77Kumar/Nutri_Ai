"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {LayoutDashboard,BarChart3,User,Coffee,Moon,} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { TranslationKeys } from "@/lib/translations";
import { LucideIcon } from "lucide-react";

const navItems: { href: string; label: TranslationKeys; icon: LucideIcon }[] = [
  { href: "/", label: "home", icon: LayoutDashboard },
  { href: "/fasting", label: "fasting", icon: Moon },
  { href: "/history", label: "history", icon: BarChart3 },
  { href: "/caffeine", label: "caffeine", icon: Coffee },
  { href: "/profile", label: "profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 safe-bottom"
    >
      <div className="max-w-2xl mx-auto px-2 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label}`}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-xl bg-emerald-500/10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 relative z-10 transition-colors ${
                  isActive ? "text-emerald-400" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] relative z-10 transition-colors ${
                  isActive
                    ? "text-emerald-400 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
