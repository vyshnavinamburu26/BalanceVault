
require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createAdmin() {
  try {
    console.log("\n=== BalanceVault First Admin Setup ===\n");

    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" }
    });

    if (adminCount > 0) {
      console.log("An ADMIN account already exists.");
      console.log("Admin creation stopped.");
      return;
    }

    const fullName = (await ask("Admin full name: ")).trim();
    const email = (await ask("Admin email: ")).trim().toLowerCase();
    const password = await ask("Admin password (minimum 12 characters): ");

    if (!fullName || fullName.length > 100) {
      throw new Error("Name must contain 1 to 100 characters.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    if (
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error("Password must be at least 12 characters and at most 72 bytes.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error(
        "This email already belongs to a user. Choose another email."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "ADMIN"
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    console.log("\nAdmin account created successfully!");
    console.log(admin);

  } catch (error) {
    console.error("\nAdmin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();
