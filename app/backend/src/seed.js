import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { users } from "./db/schema.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

async function seed() {
  const { adminEmail, adminPassword, adminName } = config;

  if (!adminEmail || !adminPassword) {
    logger.error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required");
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ email: adminEmail }, "Admin user already exists — skipping");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const [admin] = await db
    .insert(users)
    .values({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "admin",
    })
    .returning();

  logger.info({ id: admin.id, email: admin.email }, "Admin user created");
  process.exit(0);
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
