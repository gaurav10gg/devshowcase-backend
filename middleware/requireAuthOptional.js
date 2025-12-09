import { supabase } from "../supabase.js";

export const requireAuthOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // User not logged in → continue with req.user = null
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const { data, error } = await supabase.auth.getUser(token);

    // If token invalid → treat as logged-out
    if (error || !data?.user) {
      req.user = null;
      return next();
    }

    req.user = data.user; // user authenticated
    next();
  } catch (err) {
    console.error("requireAuthOptional error:", err);
    req.user = null;
    next();
  }
};
