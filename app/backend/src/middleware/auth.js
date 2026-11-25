import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;

    // Check if user is still active in the database
    db.select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1)
      .then(([row]) => {
        if (!row) {
          return res.status(401).json({ error: "User not found" });
        }
        if (!row.isActive) {
          return res
            .status(403)
            .json({ error: "Account is disabled. Contact an administrator." });
        }
        next();
      })
      .catch((err) => next(err));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
