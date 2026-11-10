
require("dotenv").config();

const prisma = require("../src/lib/prisma");

async function checkAdmin() {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN"
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    console.log("\nAdmin accounts found:");
    console.log(admins);

  } catch (error) {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
