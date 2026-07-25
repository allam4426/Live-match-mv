import { Router } from "express";
import bcrypt from "bcryptjs";
import { AdminLoginBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin2024";
const COOKIE_NAME = "fl_admin";

export function requireAdmin(req: any, res: any, next: any) {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (!token || (!token.startsWith("staff:") && token !== "superadmin")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/admin/login", async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { email, password } = parsed.data;

  // Staff login (email provided)
  if (email) {
    const users = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    const user = users[0];
    if (!user) {
      res.status(401).json({ authenticated: false });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ authenticated: false });
      return;
    }

    res.cookie(COOKIE_NAME, `staff:${user.id}`, {
      signed: true,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax", secure: false,
      path: "/",
    });
    res.json({ authenticated: true, role: "staff", email: user.email, name: user.name });
    return;
  }

  // Superadmin login (password only)
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.cookie(COOKIE_NAME, "superadmin", {
    signed: true,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax", secure: false,
    path: "/",
  });
  res.json({ authenticated: true, role: "superadmin" });
});

router.post("/admin/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ authenticated: false });
});

router.get("/admin/me", async (req, res) => {
  const token = req.signedCookies?.[COOKIE_NAME];

  if (token === "superadmin") {
    res.json({ authenticated: true, role: "superadmin" });
    return;
  }

  if (token?.startsWith("staff:")) {
    const id = parseInt(token.split(":")[1] ?? "0", 10);
    if (!id) { res.json({ authenticated: false }); return; }

    const users = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);

    const user = users[0];
    if (!user) { res.json({ authenticated: false }); return; }

    res.json({ authenticated: true, role: "staff", email: user.email, name: user.name });
    return;
  }

  res.json({ authenticated: false });
});

export default router;
