
const express = require("express");
const prisma = require("../lib/prisma");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// ADMIN-ONLY DASHBOARD
router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res) => {
    return res.status(200).json({
      message: "Welcome to the BalanceVault Admin Dashboard",
      admin: {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role
      }
    });
  }
);


// ADMIN-ONLY AUDIT LOGS
router.get(
  "/audit-logs",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
      );

      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit, 10) || 10)
      );

      const action =
        typeof req.query.action === "string"
          ? req.query.action.trim().toUpperCase()
          : "";

      if (action.length > 100) {
        return res.status(400).json({
          message: "Action filter must not exceed 100 characters"
        });
      }

      const where = {};

      if (action) {
        where.action = action;
      }

      const skip = (page - 1) * limit;

      const [logs, totalLogs] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            actorId: true,
            action: true,
            entity: true,
            entityId: true,
            details: true,
            ipAddress: true,
            createdAt: true,
            actor: {
              select: {
                fullName: true,
                email: true,
                role: true
              }
            }
          }
        }),

        prisma.auditLog.count({ where })
      ]);

      return res.status(200).json({
        message: "Audit logs retrieved successfully",
        filters: {
          action: action || null
        },
        pagination: {
          page,
          limit,
          totalLogs,
          totalPages: Math.ceil(totalLogs / limit)
        },
        logs
      });

    } catch (error) {
      console.error("Audit logs retrieval error:", error);

      return res.status(500).json({
        message: "Unable to retrieve audit logs"
      });
    }
  }
);

module.exports = router;
