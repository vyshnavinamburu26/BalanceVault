
const express = require("express");
const prisma = require("../lib/prisma");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// ADMIN-ONLY: SEARCH, FILTER AND VIEW USERS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
      );

      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit, 10) || 10)
      );

      const search = typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

      const role = typeof req.query.role === "string"
        ? req.query.role.trim().toUpperCase()
        : "";

      // Validate search length
      if (search.length > 100) {
        return res.status(400).json({
          message: "Search must not exceed 100 characters"
        });
      }

      // Validate role filter
      if (role && !["ADMIN", "ACCOUNT_HOLDER"].includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Use ADMIN or ACCOUNT_HOLDER"
        });
      }

      const where = {};

      // Search by name or email
      if (search) {
        where.OR = [
          {
            fullName: {
              contains: search,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: search,
              mode: "insensitive"
            }
          }
        ];
      }

      // Filter by role
      if (role) {
        where.role = role;
      }

      const skip = (page - 1) * limit;

      const [users, totalUsers] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            createdAt: true
          }
        }),

        prisma.user.count({ where })
      ]);

      return res.status(200).json({
        message: "Users retrieved successfully",
        filters: {
          search: search || null,
          role: role || null
        },
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit)
        },
        users
      });

    } catch (error) {
      console.error("User search error:", error);

      return res.status(500).json({
        message: "Unable to retrieve users"
      });
    }
  }
);

// ACCOUNT HOLDER DASHBOARD
router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles("ACCOUNT_HOLDER"),
  async (req, res) => {
    try {
      const account = await prisma.account.findUnique({
        where: {
          userId: req.user.id
        },
        select: {
          accountNumber: true,
          balance: true,
          status: true,
          createdAt: true
        }
      });

      if (!account) {
        return res.status(404).json({
          message: "Account not found for this user"
        });
      }

      return res.status(200).json({
        message: "Welcome to your BalanceVault Dashboard",
        user: {
          id: req.user.id,
          fullName: req.user.fullName,
          email: req.user.email,
          role: req.user.role
        },
        account: {
          accountNumber: account.accountNumber,
          balance: account.balance.toString(),
          status: account.status,
          createdAt: account.createdAt
        }
      });
    } catch (error) {
      console.error("User dashboard error:", error);

      return res.status(500).json({
        message: "Unable to load dashboard"
      });
    }
  }
);



// ACCOUNT HOLDER: VIEW OWN TRANSACTION HISTORY
router.get(
  "/transactions",
  authenticateToken,
  authorizeRoles("ACCOUNT_HOLDER"),
  async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit, 10) || 10)
      );

      const skip = (page - 1) * limit;

      const [transactions, totalTransactions] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            userId: req.user.id
          },
          orderBy: {
            createdAt: "desc"
          },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            amount: true,
            description: true,
            status: true,
            createdAt: true
          }
        }),

        prisma.transaction.count({
          where: {
            userId: req.user.id
          }
        })
      ]);

      return res.status(200).json({
        message: "Transaction history retrieved successfully",
        pagination: {
          page,
          limit,
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / limit)
        },
        transactions
      });
    } catch (error) {
      console.error("Transaction history error:", error);

      return res.status(500).json({
        message: "Unable to retrieve transaction history"
      });
    }
  }
);

module.exports = router;
