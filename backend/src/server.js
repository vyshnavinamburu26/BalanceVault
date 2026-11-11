
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

const app = express();

// CORS configuration


app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://balance-vault-vjba.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: "10kb" }));

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to BalanceVault API"
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "BalanceVault backend is running successfully"
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);

// Local development
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`BalanceVault server running on port ${PORT}`);
  });
}

module.exports = app;
