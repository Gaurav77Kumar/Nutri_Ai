"use client";

import { GoogleLogin } from "@react-oauth/google";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "framer-motion";
import { authApi, setAuthToken } from "@/lib/api";
import { initNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import {Sparkles,ShieldCheck,Leaf,Mail,Lock,User,Eye,EyeOff,Loader2,} from "lucide-react";

import { useState, useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("nutriai_token");
    if (token) {
      router.push("/");
    }
    
    if (Capacitor.isNativePlatform()) {
      setTimeout(() => {
        GoogleAuth.initialize().catch(err => console.error("GoogleAuth init error:", err));
      }, 500);
    }
  }, [router]);

  const handlePostLogin = async () => {
    try {
      await initNotifications();
    } catch {}
    router.push("/");
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { credential } = credentialResponse;
      if (!credential) throw new Error("No credential received");
      const res = await authApi.googleLogin(credential);
      setAuthToken(res.token);
      await handlePostLogin();
    } catch (err: unknown) {
      console.error("Google login failed:", err);
      setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In (Native Android/iOS) 
  const handleNativeGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await GoogleAuth.signIn();
      const res = await authApi.googleLogin(user.authentication.idToken);
      setAuthToken(res.token);
      await handlePostLogin();
    } catch (err: unknown) {
      console.error("Native Google Login failed:", err);
      setError(`Google Login Error: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };
  

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      setAuthToken(res.token);
      await handlePostLogin();
    } catch (err: unknown) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register({ name, email, password, dietType: "indian" });
      setAuthToken(res.token);
      await handlePostLogin();
    } catch (err: unknown) {
      console.error("Register failed:", err);
      setError(err instanceof Error ? err.message : "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden bg-black safe-top safe-bottom">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-5"
      >
         <ShieldCheck className="w-8 h-8 text-white" />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          <span className="gradient-text-hero">NutriAI</span>
        </h1>
        <p className="text-muted-foreground text-xs max-w-[280px] mx-auto leading-relaxed">
          India&apos;s smartest AI nutrition coach 🇮🇳
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm glass-card rounded-3xl p-6 relative z-10"
      >
        {/* Mode Toggle */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-5">
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "login" 
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "register" 
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sign-In (Platform Specific) */}
        <div className="flex justify-center mb-4">
          {Capacitor.isNativePlatform() ? (
            <button
              onClick={handleNativeGoogleLogin}
              disabled={loading}
              className="w-full h-11 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google login failed")}
              theme="filled_black"
              shape="pill"
              text={mode === "login" ? "signin_with" : "signup_with"}
            />
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email Form */}
        <form onSubmit={mode === "login" ? handleEmailLogin : handleRegister} className="space-y-3">
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-emerald-500/50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Switch Mode */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-emerald-400 font-bold hover:underline">
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </motion.div>

      {/* Footer Details */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex gap-4">
          <div className="flex flex-col items-center gap-1">
             <Sparkles className="w-4 h-4 text-emerald-500" />
             <span className="text-[8px] text-muted-foreground font-bold">AI POWERED</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <Leaf className="w-4 h-4 text-amber-500" />
             <span className="text-[8px] text-muted-foreground font-bold">INDIAN DB</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <ShieldCheck className="w-4 h-4 text-sky-500" />
             <span className="text-[8px] text-muted-foreground font-bold">SECURE</span>
          </div>
      </motion.div>
    </div>
  );
}
