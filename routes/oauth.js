import express from "express";
import { pool } from "../db.js";
import { supabase } from "../supabase.js";
import crypto from "crypto";

const router = express.Router();

const authCodes = new Map();

// ─── 1. AUTHORIZE ─────────────────────────────────────────
router.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;

  const params = new URLSearchParams({ redirect_uri, state });
  
  res.redirect(
    `${process.env.FRONTEND_URL}/oauth-connect?${params.toString()}`
  );
});

// ─── 2. CALLBACK ──────────────────────────────────────────
router.post("/callback", async (req, res) => {
  const { access_token, redirect_uri, state } = req.body;

  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const code = crypto.randomUUID();
  authCodes.set(code, {
    user_id: data.user.id,
    access_token,
    expires_at: Date.now() + 5 * 60 * 1000,
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  res.json({ redirect_url: redirectUrl.toString() });
});

// ─── 3. TOKEN ─────────────────────────────────────────────
router.post("/token", (req, res) => {
  // ChatGPT can send via body OR Basic Auth header
  let client_id = req.body.client_id;
  let client_secret = req.body.client_secret;

  // Check Basic Auth header as fallback
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    [client_id, client_secret] = decoded.split(":");
  }

  console.log("client_id received:", client_id);
  console.log("client_secret received:", client_secret);
  console.log("expected client_id:", process.env.CLIENT_ID);
  console.log("expected client_secret:", process.env.CLIENT_SECRET);

  if (
    client_id !== process.env.CLIENT_ID ||
    client_secret !== process.env.CLIENT_SECRET
  ) {
    return res.status(401).json({ error: "Invalid client credentials" });
  }

  const { code } = req.body;
  const entry = authCodes.get(code);

  if (!entry || Date.now() > entry.expires_at) {
    authCodes.delete(code);
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  authCodes.delete(code);

  res.json({
    access_token: entry.access_token,
    token_type: "bearer",
  });
});

export default router;