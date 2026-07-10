import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
}

function isValidPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as JwtPayload).userId === "string" &&
    (payload as JwtPayload).userId.length > 0
  );
}

export async function authenticate(req: AuthRequest, res: Response,next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if(!token) {
      res.status(401).json({ error: "Missing token"});
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
    });

    if(!isValidPayload(decoded)) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Generate a JWT token for a user
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

// This is sent to client and stored in a secure HTTP-only cookie. It is used to refresh the access token when it expires.
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

// Hashing and storing the refresh token securely in the database. This function hashes the refresh token using SHA-256 before storing it in the database.
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
