import { supabase } from "../supabase.js";

export const requireAuth = async (req, res, next) => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("TOKEN =", token);

    // Decode user from Supabase
    const response = await supabase.auth.getUser(token);

    console.log("DECODED USER =", response.data.user);

    if (response.error || !response.data?.user) {
      return res.status(401).json({ message: "Invalid auth token" });
    }

    // Attach user ID to request
    req.user = { id: response.data.user.id };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Authentication failed" });
  }
};
