import express from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { config } from "./lib/config";
import { errorHandler } from "./middleware/error";
import { prisma } from "./lib/prisma";

import authRoutes from "./routes/auth";
import mealRoutes from "./routes/meals";
import userRoutes from "./routes/user";

const app = express();
app.use(cookieParser());

app.set("trust proxy", 1);  

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, 
}));

app.use(hpp());

const allowedOrigins = [config.clientUrl,...(config.isDev ? ["http://localhost:3000", "http://localhost:5173"] : []),].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if( !origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "12mb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDev ? 5000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", globalLimiter);


app.get("/api/health", async(_req, res) => {
  try{
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});


app.use("/api/auth", authRoutes); 
app.use("/api/meals", mealRoutes);
app.use("/api/user", userRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

let server: ReturnType<typeof app.listen>;


async function main() {
  try {
    await prisma.$connect();
    console.log(" Database connected");

     server = app.listen(Number(config.port), "0.0.0.0", () => {
      console.log(` NutriAI API Server Port:${config.port} Env:${config.nodeEnv} Client:${config.clientUrl}`);

      console.log(" API Routes:");
      console.log("   POST  /api/auth/register");
      console.log("   POST  /api/auth/login");
      console.log("   POST  /api/auth/refresh");
      console.log("   POST  /api/auth/google");
      console.log("   GET   /api/auth/me");
      console.log("   PATCH /api/auth/profile");
      console.log("   GET   /api/meals");
      console.log("   GET   /api/meals/today");
      console.log("   GET   /api/meals/week");
      console.log("   POST  /api/meals");
      console.log("   POST  /api/meals/analyze");
      console.log("   POST  /api/meals/calculate");
      console.log("   POST  /api/meals/bulk");
      console.log("   PATCH /api/meals/:id");
      console.log("   DELETE /api/meals/:id");
      console.log("   POST  /api/meals/templates");
      console.log("   GET  /api/meals/templates");
      console.log("   POST  /api/meals/templates/:id/log");
      console.log("   DELETE  /api/user/account");
      console.log("\nServer ready!\n");
    });

    server.on("error", (error) => {
      console.error(" Server error:", error);
      process.exit(1);
    })
  } catch (error) {
    console.error(" Failed to start server:", error);
    process.exit(1);
  }
}

main();

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  if(!server) {
    await prisma.$disconnect();
    process.exit(0);
  }

  server.close(async (err) => {
    if (err) {
      console.error("Error during server shutdown:", err); 
    }
    try {
      await prisma.$disconnect();

    }catch (disconnectError) {
      console.error("Error disconnecting Prisma: ", disconnectError);
    } finally {
      process.exit(err ? 1 : 0);
    }
  });

  setTimeout(() => {
    console.error("Forced shutdown after 10 seconds");
    process.exit(1);
  }, 10_000).unref();

}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on('SIGINT', () => shutdown("SIGINT"));


process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection at:", reason);
  shutdown("unhandledRejection");
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
  shutdown("uncaughtException");
})
