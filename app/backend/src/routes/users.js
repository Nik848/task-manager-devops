import { Router } from "express";
import { eq, and, ne, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

// ─── GET /api/users ─────────────────────────────────────────────────────────
// Used by the assignee dropdown — returns id/name/email/role for all (admin)
// or just self (normal user).
router.get("/", async (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      const all = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users);
      return res.json({ users: all });
    }

    // Normal user — return only themselves
    const [self] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    res.json({ users: self ? [self] : [] });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN USER MANAGEMENT (admin-only routes)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/users/manage ──────────────────────────────────────────────────
// List all users with full management fields
router.get("/manage", authorize("admin"), async (req, res, next) => {
  try {
    const all = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users);
    res.json({ users: all });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/users/:id/role ──────────────────────────────────────────────
// Change a user's role (admin or user)
router.patch("/:id/role", authorize("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["admin", "user"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Role must be 'admin' or 'user'" });
    }

    // Cannot change own role
    if (id === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot change your own role" });
    }

    // Fetch target user
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    // If demoting an admin, ensure at least one other active admin remains
    if (target.role === "admin" && role === "user") {
      const [{ value }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

      if (Number(value) <= 1) {
        return res.status(400).json({
          error:
            "Cannot demote the last active admin. Promote another user first.",
        });
      }
    }

    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/users/:id/status ────────────────────────────────────────────
// Enable or disable a user
router.patch("/:id/status", authorize("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ error: "isActive must be a boolean" });
    }

    // Cannot disable yourself
    if (id === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot disable your own account" });
    }

    // Fetch target user
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    // If disabling an admin, ensure at least one other active admin remains
    if (target.role === "admin" && !isActive) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

      if (Number(value) <= 1) {
        return res.status(400).json({
          error:
            "Cannot disable the last active admin. Promote another user first.",
        });
      }
    }

    const [updated] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/users/:id ──────────────────────────────────────────────────
// Permanently delete a user
router.delete("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (id === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    // Fetch target user
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    // If deleting an active admin, ensure at least one other active admin remains
    if (target.role === "admin" && target.isActive) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

      if (Number(value) <= 1) {
        return res.status(400).json({
          error:
            "Cannot delete the last active admin. Promote another user first.",
        });
      }
    }

    await db.delete(users).where(eq(users.id, id));

    res.json({ message: "User deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
