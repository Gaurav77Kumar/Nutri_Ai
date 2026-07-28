import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { sensitiveLimiter } from "../middleware/rate-limit";
import { z } from "zod";

const router = Router();

const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
});

/**
 * DELETE /api/user/account
 * Delete the user account and all associated data
 */

router.delete("/account",authenticate,sensitiveLimiter,asyncHandler(async (req: AuthRequest, res: Response) => {
  const { password } = deleteAccountSchema.parse(req.body ?? {});

  const user =  await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, passwordHash: true },
  })

  if(!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if(user.passwordHash) {
    if(!password) {
      res.status(400).json({ error: "Password confirmation is required to delete account" });
      return;
    }
  

  const validPassword =  await bcrypt.compare(password, user.passwordHash);
  if(!validPassword) {
    res.status(401).json({ error: "Incorrect password "});
    return;
  }
}

  console.log(JSON.stringify({
    event: "account_deletion",
    userId: user.id,
    email: user.email,
    ipAddress: req.ip,
    timestamp: new Date().toISOString(),
  })
);

const mealsWithImages =  await prisma.mealLog.findMany({
  where: {
    userId: user.id,
    imageUrl: { not: null },
  },
  select: { imageUrl: true },
});

await prisma.user.delete({ where: { id: user.id } });

void mealsWithImages;

const cookieOtps = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

res.clearCookie("accessToken", cookieOtps);
res.clearCookie("refreshToken", cookieOtps);

res.status(200).json({ message: "Account deleted successfully" });
})
);
 

export default router;
