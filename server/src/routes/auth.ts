import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { registerSchema, loginSchema, updateProfileSchema } from "../lib/validators";
import { authenticate, generateToken, generateRefreshToken, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { sensitiveLimiter } from "../middleware/rate-limit";

const googleClient = new OAuth2Client(config.googleClientId);
const router = Router();

function toSafeUser(rawUser: any) {
  const { profile, passwordHash, ...userFields } = rawUser;
  void passwordHash;  // ensuring passwordHash is not used
  return {
    id: userFields.id,
    name: userFields.name,
    email: userFields.email,
    avatarUrl: userFields.avatarUrl,
    dietType: profile?.dietType,
    calorieGoal: profile?.calorieGoal,
    proteinGoal: profile?.proteinGoal,
    carbGoal: profile?.carbGoal,
    fatGoal: profile?.fatGoal,
    fibreGoal: profile?.fibreGoal,
    weeklyBudget: profile?.weeklyBudget,
    budgetPeriod: profile?.budgetPeriod,

  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function issueRefreshToken(userId: string) {
  const refreshTokenStr = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshTokenStr),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),

    },
  });
  return refreshTokenStr;
}

// Store the tokens inside cookies before sending the response to the browser
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

const DUMMY_PASSWORD_HASH = "$2a$12$KIXQJ1Z5e6F1Z5e6F1Z5eO6F1Z5eO6F1Z5eO6F1Z5eO6F1Z5eO6F"; 


// POST /api/auth/register
router.post("/register", sensitiveLimiter, asyncHandler(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true }
  });
  if (existingUser) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);  

  const rawUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      profile: {
        create: {
          dietType: data.dietType || "indian",
        }
      },

    },
    include: {
      profile: true,
    },
  });

  const user = toSafeUser(rawUser);

  const token = generateToken(user.id);
  const refreshTokenStr = await issueRefreshToken(user.id);

  await prisma.authLog.create({
    data: {
      userId: user.id,
      event: "register",
      ipAddress: req.ip,
      device: req.headers["user-agent"]?.toString()
    }
  });

  setAuthCookies(res, token, refreshTokenStr);

  res.status(201).json({ user, token, refreshToken: refreshTokenStr });
})
);


router.post("/login", sensitiveLimiter, asyncHandler(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  const rawUser = await prisma.user.findUnique({
    where: { email: data.email },
    include: { profile: true }
  });

  const validPassword = await bcrypt.compare(
    data.password,
    rawUser?.passwordHash || DUMMY_PASSWORD_HASH
  )

  if (!rawUser || !rawUser.profile || !validPassword) {
    await prisma.authLog.create({
      data: {
        userId: null,
        event: "failed_attempt",
        ipAddress: req.ip,
      }
    });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken(rawUser.id);
  const refreshTokenStr = await issueRefreshToken(rawUser.id);

  await prisma.authLog.create({
    data: {
      userId: rawUser.id,
      event: "login",
      ipAddress: req.ip,
      device: req.headers["user-agent"]?.toString()
    }
  });

  setAuthCookies(res, token, refreshTokenStr);

  res.json({ user: toSafeUser(rawUser), token, refreshToken: refreshTokenStr });
})
);



router.post("/refresh", asyncHandler(async (req: Request, res: Response) => {

  const refreshToken: string | undefined = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token is required" });
    return;
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: hashToken(refreshToken) }
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    if(storedToken) await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  await prisma.refreshToken.delete({ where: {id: storedToken.id}});
  const newRefreshToken = await issueRefreshToken(storedToken.userId);
  const token = generateToken(storedToken.userId);


  setAuthCookies(res, token, newRefreshToken);
  res.json({ token, refreshToken: newRefreshToken });
})
);

router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const rawUser = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: {
      profile: true,
    },
  });

  if (!rawUser || !rawUser.profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(toSafeUser(rawUser))
})
);


router.patch("/profile", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateProfileSchema.parse(req.body);

  const { name, ...profileData } = data as any;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (Object.keys(profileData).length > 0) {
    updateData.profile = { update: profileData };
  }

  const rawUser = await prisma.user.update({
    where: { id: req.userId! },
    data: updateData,
    include: { profile: true },
  });

  res.json(toSafeUser(rawUser));
})
);


router.post("/google", sensitiveLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ error: "Google ID token is required" });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401).json({ error: "Invalid Google token" });
    return;
  }

  if (!payload || !payload.email || payload.email_verified !== true) {
    res.status(401).json({ error: "Could not extract user info from Google token" });
    return;
  }

  const { email, name, picture } = payload;

  let rawUser = await prisma.user.findUnique({
    where: { email },
    include: { profile: true }
  });

  let isNewUser = false;

  if (!rawUser) {
    isNewUser = true;
    rawUser = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        avatarUrl: picture || null,
        profile: {
          create: { dietType: "indian" }
        }
      },
      include: { profile: true }
    });
  } else {
    if (picture && picture !== rawUser.avatarUrl) {
      rawUser = await prisma.user.update({
        where: { id: rawUser.id },
        data: { avatarUrl: picture },
        include: { profile: true }
      });
    }
  }

  const token = generateToken(rawUser.id);
  const refreshTokenStr = await issueRefreshToken(rawUser.id);

  await prisma.authLog.create({
    data: {
      userId: rawUser.id,
      event: "login",
      ipAddress: req.ip,
      device: req.headers["user-agent"]?.toString()
    }
  });

  setAuthCookies(res, token, refreshTokenStr);

  res.json({ user: toSafeUser(rawUser), token, refreshToken: refreshTokenStr, isNewUser })
})
);
export default router;
