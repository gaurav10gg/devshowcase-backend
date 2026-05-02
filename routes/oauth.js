import express from "express";
import { supabase } from "../supabase.js";
import crypto from "crypto";

const router = express.Router();
const authCodes = new Map();

router.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;
  const params = new URLSearchParams({ redirect_uri, state });
  res.redirect(`${process.env.FRONTEND_URL}/oauth-connect?${params.toString()}`);
});

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
    expires_at: Date.now() + 10 * 60 * 1000, // 10 mins
  });

  console.log("Code generated:", code);
  console.log("Stored codes:", [...authCodes.keys()]);

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  res.json({ redirect_url: redirectUrl.toString() });
});

router.post("/token", (req, res) => {
  let client_id = req.body.client_id;
  let client_secret = req.body.client_secret;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    [client_id, client_secret] = decoded.split(":");
  }

  console.log("client_id received:", client_id);
  console.log("client_secret received:", client_secret);

  if (
    client_id !== process.env.CLIENT_ID ||
    client_secret !== process.env.CLIENT_SECRET
  ) {
    return res.status(401).json({ error: "Invalid client credentials" });
  }

  const { code } = req.body;

  console.log("code received:", code);
  console.log("all stored codes:", [...authCodes.keys()]);

  const entry = authCodes.get(code);

  console.log("entry found:", entry);
  console.log("expired?", entry ? Date.now() > entry.expires_at : "no entry");

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