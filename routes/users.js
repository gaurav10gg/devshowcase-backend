import express from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/*
  POST /api/users
  Sync Supabase user into Neon users table
*/
router.post("/", async (req, res) => {
  const { id, email, name } = req.body;

  if (!id || !email || !name) {
    return res
      .status(400)
      .json({ message: "id, email, and name are required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO users (id, email, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
      `,
      [id, email, name]
    );

    // If user already existed, result.rows = []
    res.json(result.rows[0] ?? { id, email, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Insert failed" });
  }
});

/*
  GET /api/users/me
  Return logged-in user profile
*/
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/*
  GET /api/users
  List all users
*/
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
});
/* UPDATE USER PROFILE */
router.put("/me", requireAuth, async (req, res) => {
  const { username, bio, github, linkedin, website, avatar } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET 
        username = $1,
        bio = $2,
        github = $3,
        linkedin = $4,
        website = $5,
        avatar = $6
      WHERE id = $7
      RETURNING *
      `,
      [username, bio, github, linkedin, website, avatar, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update user" });
  }
});


/*
  DELETE /api/users/:id
*/
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
