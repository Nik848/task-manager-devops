import { Router } from "express";
import {
  eq,
  and,
  or,
  ne,
  lt,
  isNotNull,
  sql,
  count,
  desc,
} from "drizzle-orm";
import { db } from "../db/index.js";
import { tasks, users } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

/** Condition that scopes queries to the current user's own tasks. */
function ownTasks(userId) {
  return or(eq(tasks.assigneeId, userId), eq(tasks.createdBy, userId));
}

// ─── GET /api/tasks/stats ────────────────────────────────────────────────────
router.get("/stats", async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    const base = isAdmin ? sql`true` : ownTasks(req.user.id);

    const statusRows = await db
      .select({ status: tasks.status, value: count() })
      .from(tasks)
      .where(base)
      .groupBy(tasks.status);

    const priorityRows = await db
      .select({ priority: tasks.priority, value: count() })
      .from(tasks)
      .where(base)
      .groupBy(tasks.priority);

    const [overdueRow] = await db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(base, isNotNull(tasks.dueDate), lt(tasks.dueDate, new Date()), ne(tasks.status, "done"))
      );

    const byStatus = { todo: 0, in_progress: 0, done: 0 };
    for (const r of statusRows) byStatus[r.status] = Number(r.value);

    const byPriority = { low: 0, medium: 0, high: 0 };
    for (const r of priorityRows) byPriority[r.priority] = Number(r.value);

    res.json({
      byStatus,
      byPriority,
      overdue: Number(overdueRow.value),
      total: byStatus.todo + byStatus.in_progress + byStatus.done,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks ──────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    const condition = isAdmin ? undefined : ownTasks(req.user.id);

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        createdBy: tasks.createdBy,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assigneeName: users.name,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(condition)
      .orderBy(desc(tasks.createdAt));

    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks ─────────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate, assigneeId } =
      req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (status && !["todo", "in_progress", "done"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (priority && !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }
    if (
      req.user.role !== "admin" &&
      assigneeId &&
      assigneeId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "You can only assign tasks to yourself" });
    }

    const [task] = await db
      .insert(tasks)
      .values({
        title: title.trim(),
        description: description || null,
        status: status || "todo",
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || req.user.id,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, req.params.id))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (
      req.user.role !== "admin" &&
      task.assigneeId !== req.user.id &&
      task.createdBy !== req.user.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/tasks/:id ─────────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, req.params.id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (
      req.user.role !== "admin" &&
      existing.assigneeId !== req.user.id &&
      existing.createdBy !== req.user.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { title, description, status, priority, dueDate, assigneeId } =
      req.body;

    if (status && !["todo", "in_progress", "done"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (priority && !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }
    if (
      req.user.role !== "admin" &&
      assigneeId &&
      assigneeId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "You can only assign tasks to yourself" });
    }

    const data = { updatedAt: new Date() };
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId;

    const [task] = await db
      .update(tasks)
      .set(data)
      .where(eq(tasks.id, req.params.id))
      .returning();

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/tasks/:id ──────────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, req.params.id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (
      req.user.role !== "admin" &&
      existing.createdBy !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "Only the creator or an admin can delete this task" });
    }

    await db.delete(tasks).where(eq(tasks.id, req.params.id));

    res.json({ message: "Task deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
