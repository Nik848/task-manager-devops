import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

// GET /api/users
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

export default router;
