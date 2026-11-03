const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Use JWT_SECRET from env. If it's missing we derive a stable secret from MONGO_URI so the
// app still runs, but you should set JWT_SECRET in production (Render > Environment).
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash("sha256").update(`kalapila:${process.env.MONGO_URI || "dev"}`).digest("hex");

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set. Using a derived fallback secret – set JWT_SECRET in your environment.");
}

const signToken = (user) =>
  jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: "30d" });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please sign in again." });
  try {
    const payload = verifyToken(token);
    req.userId = payload.id;
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
};

module.exports = { signToken, verifyToken, requireAuth };
