import express from "express";
import { pool } from "../db.js";
import { supabase } from "../supabase.js";

const router = express.Router();

// helper — get user from Bearer token
async function getUserFromToken(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// ─── POST PROJECT ──────────────────────────────────────────
router.post("/post-project", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { title, short_desc, full_desc, github, live, tags } = req.body;

  const result = await pool.query(
    `INSERT INTO projects (title, short_desc, full_desc, github, live, tags, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, short_desc, full_desc, github, live, tags || [], user.id]
  );

  res.json({ success: true, project: result.rows[0] });
});

export default router;