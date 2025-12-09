import express from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// ADD COMMENT
router.post("/:projectId", requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const { text } = req.body;

  if (!text) return res.status(400).json({ message: "Comment text required" });

  try {
    const result = await pool.query(
      `INSERT INTO comments (project_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectId, req.user.id, text]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// GET COMMENTS FOR A PROJECT
router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.*, u.name AS user_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.project_id = $1
       ORDER BY c.created_at ASC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load comments" });
  }
});

// DELETE COMMENT (ONLY OWNER)
router.delete("/:commentId", requireAuth, async (req, res) => {
  const { commentId } = req.params;

  try {
    // check ownership
    const check = await pool.query(
      "SELECT * FROM comments WHERE id = $1 AND user_id = $2",
      [commentId, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await pool.query("DELETE FROM comments WHERE id = $1", [commentId]);

    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

export default router;
