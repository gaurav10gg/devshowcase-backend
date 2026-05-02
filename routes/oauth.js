import express from "express";
import { pool } from "../db.js";
import { supabase } from "../supabase.js";
import crypto from "crypto";

const router = express.Router();

// store codes temporarily in memory (fine for now)
const authCodes = new Map(); // code → { user_id, expires_at }

// ─── 1. AUTHORIZE ─────────────────────────────────────────
// ChatGPT redirects user here
router.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;

  // store redirect_uri + state in the URL to pass through login
  const params = new URLSearchParams({ redirect_uri, state });
  
  // send user to your frontend connect page
  res.redirect(
    `${process.env.FRONTEND_URL}/oauth-connect?${params.toString()}`
  );
});

// ─── 2. CALLBACK ──────────────────────────────────────────
// Your frontend calls this after user logs in
// exchanges supabase token → auth code
router.post("/callback", async (req, res) => {
  const { access_token, redirect_uri, state } = req.body;

  // verify supabase token
  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // generate a short-lived auth code
  const code = crypto.randomUUID();
  authCodes.set(code, {
    user_id: data.user.id,
    access_token,
    expires_at: Date.now() + 5 * 60 * 1000, // 5 mins
  });

  // redirect back to ChatGPT with code + state
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  res.json({ redirect_url: redirectUrl.toString() });
});

// ─── 3. TOKEN ─────────────────────────────────────────────
// ChatGPT calls this to exchange code for access_token
router.post("/token", (req, res) => {
  const { code } = req.body;

  const entry = authCodes.get(code);

  if (!entry || Date.now() > entry.expires_at) {
    authCodes.delete(code);
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  authCodes.delete(code); // one-time use

  res.json({
    access_token: entry.access_token,
    token_type: "bearer",
  });
});

export default router;