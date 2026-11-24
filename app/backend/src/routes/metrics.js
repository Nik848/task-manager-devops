import { Router } from "express";
import { register } from "../metrics.js";

const router = Router();

// GET /metrics
router.get("/", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

export default router;
