import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";

const router = Router();
const COOKIE_NAME = "fl_user";

router.post("/auth/signup", async (req, res) => {
  const { username, email, password, name } = req.body || {};
  if (!username || !email || !password) { res.status(400).json({ error: "Missing fields" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }

  const existing = await db.select().from(usersTable).where(or(eq(usersTable.username, username), eq(usersTable.email, email))).limit(1);
  if (existing[0]) { res.status(409).json({ error: "Username or email already in use" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await db.insert(usersTable).values({ username, email, passwordHash, name: name || username }).returning();
  const user = inserted[0];

  res.cookie(COOKIE_NAME, String(user.id), { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: false, path: "/" });
  res.json({ id: user.id, username: user.username, email: user.email, name: user.name });
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) { res.status(400).json({ error: "Missing fields" }); return; }

  const rows = await db.select().from(usersTable).where(or(eq(usersTable.username, username), eq(usersTable.email, username))).limit(1);
  const user = rows[0];
  if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

  res.cookie(COOKIE_NAME, String(user.id), { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: false, path: "/" });
  res.json({ id: user.id, username: user.username, email: user.email, name: user.name });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (!token) { res.json({ user: null }); return; }
  const id = parseInt(token, 10);
  if (!id) { res.json({ user: null }); return; }
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  const user = rows[0];
  res.json({ user: user ? { id: user.id, username: user.username, email: user.email, name: user.name } : null });
});

export default router;
