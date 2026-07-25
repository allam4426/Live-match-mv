import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admin-auth";

const router = Router();

function parseStaffInput(body: unknown): { email: string; name: string; password: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!email || !name || password.length < 6) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { email, name, password };
}

router.get("/admin/staff", requireAdmin, async (_req, res) => {
  const staff = await db
    .select({ id: adminUsersTable.id, email: adminUsersTable.email, name: adminUsersTable.name, createdAt: adminUsersTable.createdAt })
    .from(adminUsersTable)
    .orderBy(adminUsersTable.createdAt);
  res.json(staff);
});

router.post("/admin/staff", requireAdmin, async (req, res) => {
  const parsed = parseStaffInput(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, name, password } = parsed;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [user] = await db
      .insert(adminUsersTable)
      .values({ email: email.toLowerCase().trim(), name, passwordHash })
      .returning({ id: adminUsersTable.id, email: adminUsersTable.email, name: adminUsersTable.name, createdAt: adminUsersTable.createdAt });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "Email already exists" });
  }
});

router.delete("/admin/staff/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id ?? "0", 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
  res.json({ success: true });
});

export default router;
