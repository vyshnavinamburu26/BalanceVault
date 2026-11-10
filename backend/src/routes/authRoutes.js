
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const logAudit = require("../lib/auditLog");

const {
  authenticateToken
} = require("../middleware/authMiddleware");

const router = express.Router();

// GENERATE UNIQUE ACCOUNT NUMBER
async function generateAccountNumber() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const accountNumber =
      "BV" + Date.now().toString() + Math.floor(Math.random() * 1000);

    const existing = await prisma.account.findUnique({
      where: { accountNumber }
    });

    if (!existing) return accountNumber;
  }

  throw new Error("Unable to generate unique account number");
}

// USER REGISTRATION
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Please provide valid registration details"
      });
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length > 100) {
      return res.status(400).json({
        message: "Name must contain 1 to 100 characters"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address"
      });
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and at most 72 bytes"
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const accountNumber = await generateAccountNumber();

    // CREATE USER AND ACCOUNT TOGETHER
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName: cleanName,
          email: cleanEmail,
          passwordHash
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          accountNumber,
          balance: 0,
          status: "ACTIVE"
        }
      });

      return newUser;
    });

    await logAudit({
      actorId: user.id,
      action: "USER_REGISTERED",
      entity: "User",
      entityId: user.id,
      details: { role: user.role },
      req
    });

    return res.status(201).json({
      message: "Registration and account creation successful",
      user
    });

  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Email or account number already exists"
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Registration failed"
    });
  }
});

// USER LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );

    await logAudit({
      actorId: user.id,
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      details: { role: user.role },
      req
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed"
    });
  }
});

// GET CURRENT USER
router.get("/me", authenticateToken, (req, res) => {
  return res.status(200).json({
    message: "Authenticated successfully",
    user: req.user
  });
});

module.exports = router;
