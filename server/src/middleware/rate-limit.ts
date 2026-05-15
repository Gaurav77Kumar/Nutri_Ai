import rateLimit from "express-rate-limit";
import { config } from "../lib/config";

// Strict limit for sensitive routes (Login, Register, Payment)
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.isDev ? 1000 : 20, 
  message: { error: "Security limit reached. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI Usage limit to prevent cost abuse
export const aiUsageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.isDev ? 100 : 5, 
  message: { error: "AI rate limit exceeded — please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});
