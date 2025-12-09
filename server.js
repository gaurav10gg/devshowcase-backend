import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import commentRoutes from "./routes/comments.js";
import uploadRoutes from "./routes/upload.js";

app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/upload", uploadRoutes);

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("API running... 🚀");
});

const PORT = process.env.PORT || 5000;

// ⭐ IMPORTANT FOR RENDER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
