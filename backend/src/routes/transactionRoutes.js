
const express = require("express");
const prisma = require("../lib/prisma");
const logAudit = require("../lib/auditLog");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

function validateAmount(amount) {
  if (
    typeof amount !== "string" &&
    typeof amount !== "number"
  ) return false;

  const value = String(amount);

  return (
    /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value) &&
    Number(value) > 0
  );
}

// Shared validation for both operations
function getIdempotencyKey(req) {
  const key = req.get("Idempotency-Key");

  if (
    typeof key !== "string" ||
    key.length < 8 ||
    key.length > 100 ||
    !/^[a-zA-Z0-9_-]+$/.test(key)
  ) {
    return null;
  }

  return key;
}

// DEPOSIT
router.post(
  "/deposit",
  authenticateToken,
  authorizeRoles("ACCOUNT_HOLDER"),
  async (req, res) => {
    try {
      const { amount, description } = req.body || {};
      const idempotencyKey = getIdempotencyKey(req);

      if (!idempotencyKey) {
        return res.status(400).json({
          message: "Provide a valid Idempotency-Key header"
        });
      }

      if (!validateAmount(amount)) {
        return res.status(400).json({
          message: "Enter a valid positive amount with at most 2 decimal places"
        });
      }

      if (
        description !== undefined &&
        (typeof description !== "string" || description.length > 200)
      ) {
        return res.status(400).json({
          message: "Description must be a string of at most 200 characters"
        });
      }

      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey }
      });

      if (existing) {
        if (
          existing.userId !== req.user.id ||
          existing.type !== "DEPOSIT" ||
        existing.amount.toFixed(2) !== Number(amount).toFixed(2)
        ) {
          return res.status(409).json({
            message: "Idempotency key already used for a different request"
          });
        }

        const account = await prisma.account.findUnique({
          where: { id: existing.accountId }
        });

        return res.status(200).json({
          message: "Duplicate request. Original deposit returned.",
          transaction: existing,
          balance: account?.balance ?? null,
          duplicate: true
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({
          where: { userId: req.user.id }
        });

        if (!account || account.status !== "ACTIVE") {
          throw new Error("ACCOUNT_NOT_AVAILABLE");
        }

        const updatedAccount = await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: amount } }
        });

        const transaction = await tx.transaction.create({
          data: {
            userId: req.user.id,
            accountId: account.id,
            type: "DEPOSIT",
            amount,
            description: description?.trim() || "Account deposit",
            status: "COMPLETED",
            idempotencyKey
          }
        });

        return { updatedAccount, transaction };
      });

      await logAudit({
        actorId: req.user.id,
        action: "DEPOSIT_COMPLETED",
        entity: "Transaction",
        entityId: result.transaction.id,
        details: { amount: String(amount) },
        req
      });

      return res.status(201).json({
        message: "Deposit successful",
        transaction: result.transaction,
        balance: result.updatedAccount.balance,
        duplicate: false
      });

    } catch (error) {
      if (error.message === "ACCOUNT_NOT_AVAILABLE") {
        return res.status(404).json({
          message: "Active account not found"
        });
      }

      if (error.code === "P2002") {
        return res.status(409).json({
          message: "This request has already been processed. Check transaction history."
        });
      }

      console.error("Deposit error:", error);

      return res.status(500).json({
        message: "Deposit failed"
      });
    }
  }
);

// WITHDRAWAL
router.post(
  "/withdraw",
  authenticateToken,
  authorizeRoles("ACCOUNT_HOLDER"),
  async (req, res) => {
    try {
      const { amount, description } = req.body || {};
      const idempotencyKey = getIdempotencyKey(req);

      if (!idempotencyKey) {
        return res.status(400).json({
          message: "Provide a valid Idempotency-Key header"
        });
      }

      if (!validateAmount(amount)) {
        return res.status(400).json({
          message: "Enter a valid positive amount with at most 2 decimal places"
        });
      }

      if (
        description !== undefined &&
        (typeof description !== "string" || description.length > 200)
      ) {
        return res.status(400).json({
          message: "Description must be a string of at most 200 characters"
        });
      }

      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey }
      });

      if (existing) {
        if (
          existing.userId !== req.user.id ||
          existing.type !== "WITHDRAWAL" ||
          existing.amount.toFixed(2) !== Number(amount).toFixed(2)
        ) {
          return res.status(409).json({
            message: "Idempotency key already used for a different request"
          });
        }

        const account = await prisma.account.findUnique({
          where: { id: existing.accountId }
        });

        return res.status(200).json({
          message: "Duplicate request. Original withdrawal returned.",
          transaction: existing,
          balance: account?.balance ?? null,
          duplicate: true
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({
          where: { userId: req.user.id }
        });

        if (!account || account.status !== "ACTIVE") {
          throw new Error("ACCOUNT_NOT_AVAILABLE");
        }

        const update = await tx.account.updateMany({
          where: {
            id: account.id,
            status: "ACTIVE",
            balance: { gte: amount }
          },
          data: {
            balance: { decrement: amount }
          }
        });

        if (update.count !== 1) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        const updatedAccount = await tx.account.findUnique({
          where: { id: account.id }
        });

        const transaction = await tx.transaction.create({
          data: {
            userId: req.user.id,
            accountId: account.id,
            type: "WITHDRAWAL",
            amount,
            description: description?.trim() || "Account withdrawal",
            status: "COMPLETED",
            idempotencyKey
          }
        });

        return { updatedAccount, transaction };
      });

      await logAudit({
        actorId: req.user.id,
        action: "WITHDRAWAL_COMPLETED",
        entity: "Transaction",
        entityId: result.transaction.id,
        details: { amount: String(amount) },
        req
      });

      return res.status(201).json({
        message: "Withdrawal successful",
        transaction: result.transaction,
        balance: result.updatedAccount.balance,
        duplicate: false
      });

    } catch (error) {
      if (error.message === "ACCOUNT_NOT_AVAILABLE") {
        return res.status(404).json({
          message: "Active account not found"
        });
      }

      if (error.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({
          message: "Insufficient account balance"
        });
      }

      if (error.code === "P2002") {
        return res.status(409).json({
          message: "This request has already been processed. Check transaction history."
        });
      }

      console.error("Withdrawal error:", error);

      return res.status(500).json({
        message: "Withdrawal failed"
      });
    }
  }
);

module.exports = router;
