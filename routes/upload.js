
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import path from "path";
console.log("ENV URL =", process.env.SUPABASE_URL);
console.log("ENV KEY =", process.env.SUPABASE_SERVICE_ROLE_KEY);

// --------------------------
// 1️⃣ MULTER CONFIG
// --------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --------------------------
// 2️⃣ SUPABASE CLIENT (FIXED ENV NAMES)
// --------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const router = express.Router();

// --------------------------
// 3️⃣ UPLOAD ROUTE
// --------------------------
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Generate unique name
    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;

    // Upload to Supabase Bucket
    const { data, error } = await supabase.storage
      .from("project-images") // bucket name
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ message: "Upload failed" });
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("project-images")
      .getPublicUrl(fileName);

    return res.json({
      url: publicUrl.publicUrl,
      message: "Uploaded Successfully",
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No avatar uploaded" });

    const fileExt = path.extname(req.file.originalname);
    const fileName = `avatar-${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) return res.status(500).json({ message: "Upload failed" });

    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    res.json({ url: publicUrl.publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Avatar upload failed" });
  }
});


export default router;
