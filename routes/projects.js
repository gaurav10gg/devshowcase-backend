import express from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAuthOptional } from "../middleware/requireAuthOptional.js";

const router = express.Router();

/* Helper: likes + liked status */
async function getProjectStats(projectId, userId) {
  // total likes
  const likesRes = await pool.query(
    "SELECT COUNT(*) AS likes FROM votes WHERE project_id = $1",
    [projectId]
  );

  // check liked
  let liked = false;
  if (userId) {
    const likedRes = await pool.query(
      "SELECT 1 FROM votes WHERE project_id = $1 AND user_id = $2::uuid",
      [projectId, userId]
    );
    liked = likedRes.rows.length > 0;
  }

  return {
    likes: Number(likesRes.rows[0].likes),
    liked,
  };
}

/* ========================================
   CREATE NEW PROJECT
======================================== */
router.post("/", requireAuth, async (req, res) => {
  const { title, short_desc, full_desc, image, github, live, tags } = req.body;

  if (!title) return res.status(400).json({ message: "Title required" });

  try {
    const result = await pool.query(
      `
        INSERT INTO projects 
        (title, short_desc, full_desc, image, github, live, tags, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        title,
        short_desc,
        full_desc,
        image,
        github,
        live,
        tags || [],
        req.user.id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: "Failed to create project" });
  }
});

/* ========================================
   GET ALL PROJECTS (WITH OPTIONAL AUTH)
   ⭐ FIXED: Now properly returns liked status
======================================== */
router.get("/", requireAuthOptional, async (req, res) => {
  try {
    const userId = req.user?.id || null;

    let query;
    let params;

    if (userId) {
      // User is logged in - check liked status
      query = `
        SELECT
          p.*,
          COALESCE(COUNT(DISTINCT v.user_id), 0) AS likes,
          COALESCE(COUNT(DISTINCT c.id), 0) AS comments_count,
          EXISTS (
            SELECT 1 
            FROM votes 
            WHERE votes.user_id = $1::uuid 
              AND votes.project_id = p.id
          ) AS liked
        FROM projects p
        LEFT JOIN votes v ON p.id = v.project_id
        LEFT JOIN comments c ON p.id = c.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      params = [userId];
    } else {
      // User not logged in - liked = false
      query = `
        SELECT
          p.*,
          COALESCE(COUNT(DISTINCT v.user_id), 0) AS likes,
          COALESCE(COUNT(DISTINCT c.id), 0) AS comments_count,
          false AS liked
        FROM projects p
        LEFT JOIN votes v ON p.id = v.project_id
        LEFT JOIN comments c ON p.id = c.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      params = [];
    }

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /projects error:", err);
    res.status(500).json({ message: "Failed to load projects" });
  }
});

/* ========================================
   GET MY PROJECTS (requires login)
======================================== */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        p.*,
        COALESCE(COUNT(DISTINCT v.user_id), 0) AS likes,
        COALESCE(COUNT(DISTINCT c.id), 0) AS comments_count,
        EXISTS (
          SELECT 1 
          FROM votes 
          WHERE votes.user_id = $1::uuid
            AND votes.project_id = p.id
        ) AS liked
      FROM projects p
      LEFT JOIN votes v ON p.id = v.project_id
      LEFT JOIN comments c ON p.id = c.project_id
      WHERE p.user_id = $1::text
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /projects/me error:", err);
    res.status(500).json({ message: "Failed to load your projects" });
  }
});

/* ========================================
   LIKE PROJECT
   ⭐ FIXED: Returns updated stats after like
======================================== */
router.post("/:id/like", requireAuth, async (req, res) => {
  const projectId = req.params.id;

  try {
    await pool.query(
      `
      INSERT INTO votes (user_id, project_id)
      VALUES ($1::uuid, $2::integer)
      ON CONFLICT (user_id, project_id) DO NOTHING
      `,
      [req.user.id, projectId]
    );

    const stats = await getProjectStats(projectId, req.user.id);
    res.json(stats);
  } catch (err) {
    console.error("Like project error:", err);
    res.status(500).json({ message: "Failed to like project" });
  }
});

/* ========================================
   UNLIKE PROJECT
   ⭐ FIXED: Returns updated stats after unlike
======================================== */
router.delete("/:id/like", requireAuth, async (req, res) => {
  const projectId = req.params.id;

  try {
    await pool.query(
      "DELETE FROM votes WHERE user_id = $1::uuid AND project_id = $2::integer",
      [req.user.id, projectId]
    );

    const stats = await getProjectStats(projectId, req.user.id);
    res.json(stats);
  } catch (err) {
    console.error("Unlike project error:", err);
    res.status(500).json({ message: "Failed to unlike project" });
  }
});

/* ========================================
   GET SINGLE PROJECT BY ID
   ⭐ FIXED: Now checks if user has liked
======================================== */
router.get("/:id", requireAuthOptional, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  try {
    let query;
    let params;

    if (userId) {
      // User logged in - check liked status
      query = `
        SELECT 
          p.*,
          COALESCE((SELECT COUNT(*) FROM votes v WHERE v.project_id = p.id), 0) AS likes,
          COALESCE((SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id), 0) AS comments_count,
          EXISTS (
            SELECT 1 
            FROM votes 
            WHERE votes.user_id = $2::uuid 
              AND votes.project_id = p.id
          ) AS liked
        FROM projects p
        WHERE p.id = $1
      `;
      params = [id, userId];
    } else {
      // User not logged in
      query = `
        SELECT 
          p.*,
          COALESCE((SELECT COUNT(*) FROM votes v WHERE v.project_id = p.id), 0) AS likes,
          COALESCE((SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id), 0) AS comments_count,
          false AS liked
        FROM projects p
        WHERE p.id = $1
      `;
      params = [id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Project not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /projects/:id error:", err);
    res.status(500).json({ message: "Failed to load project" });
  }
});

/* ========================================
   UPDATE PROJECT (SAFE PATCH)
======================================== */
router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  let {
    title = "",
    short_desc = "",
    full_desc = "",
    image = "",
    github = "",
    live = "",
    tags = [],
  } = req.body;

  try {
    if (!Array.isArray(tags)) {
      tags = [];
    }

    if (!title.trim()) return res.status(400).json({ message: "Title required" });
    if (!short_desc.trim()) return res.status(400).json({ message: "Short description required" });

    const result = await pool.query(
      `
      UPDATE projects
      SET 
        title = $1,
        short_desc = $2,
        full_desc = $3,
        image = $4,
        github = $5,
        live = $6,
        tags = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *
      `,
      [
        title,
        short_desc,
        full_desc,
        image,
        github,
        live,
        tags,
        id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ message: "Not allowed to edit" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Failed to update project" });
  }
});

/* ========================================
   DELETE PROJECT (SAFE DELETE)
======================================== */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM votes WHERE project_id = $1", [id]);
    await pool.query("DELETE FROM comments WHERE project_id = $1", [id]);

    const result = await pool.query(
      `
      DELETE FROM projects
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ message: "Not allowed to delete" });
    }

    res.json({ message: "Project deleted" });

  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ message: "Failed to delete project" });
  }
});

export default router;