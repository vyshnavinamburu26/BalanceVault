
const prisma = require("./prisma");

async function logAudit({
  actorId = null,
  action,
  entity = null,
  entityId = null,
  details = undefined,
  req = null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        ...(details !== undefined ? { details } : {}),
        ipAddress: req?.ip || null,
        userAgent: req?.get("user-agent") || null
      }
    });
  } catch (error) {
    console.error("Audit logging failed:", error.message);
  }
}

module.exports = logAudit;
