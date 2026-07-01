const pool = require('../db/pool');

// SECURITY: Columns are added lazily so existing databases without the migration
// continue to work. Once the migration runs, IP and user-agent are captured.
let hasExtraColumnsCache = null;

const hasExtraColumns = async () => {
  if (hasExtraColumnsCache !== null) return hasExtraColumnsCache;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
        AND column_name = 'ip_address'
    ) AS exists`
  );
  hasExtraColumnsCache = Boolean(result.rows[0]?.exists);
  return hasExtraColumnsCache;
};

/**
 * Log an audit event.
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - 'CREATE', 'UPDATE', 'DELETE', etc.
 * @param {string} entityName - Name of the table or resource
 * @param {string|number} entityId - ID of the affected record
 * @param {object} details - Optional JSON metadata
 * @param {object} [reqContext] - Optional { ip, userAgent } for forensic logging
 */
const log = async (userId, action, entityName, entityId, details = null, reqContext = null) => {
  try {
    const supportsExtra = await hasExtraColumns();
    if (supportsExtra && reqContext) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_name, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId || null,
          action,
          entityName,
          String(entityId),
          details ? JSON.stringify(details) : null,
          reqContext.ip || null,
          reqContext.userAgent ? String(reqContext.userAgent).slice(0, 500) : null,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_name, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId || null, action, entityName, String(entityId), details ? JSON.stringify(details) : null]
      );
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
    // Don't throw, we don't want audit failures to break main workflows
  }
};

/**
 * Helper to extract request context for audit logging.
 * Call from controllers that have access to `req`.
 * @param {object} req - Express request object
 * @returns {{ ip: string, userAgent: string }}
 */
const extractReqContext = (req) => {
  if (!req) return null;
  return {
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers?.['user-agent'] || null,
  };
};

module.exports = { log, extractReqContext };
