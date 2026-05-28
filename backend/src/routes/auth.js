import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { nickname, email, password, role } = req.body;
  if (!nickname || !email || !password || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (!["organizer", "participant"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const hashed = await bcrypt.hash(password, 10);
  try {
    const result = await query(
      "INSERT INTO users (nickname, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, nickname, email, role",
      [nickname, email, hashed, role]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(400).json({ message: "User already exists", details: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, nickname: user.nickname },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role
    }
  });
});

export default router;
