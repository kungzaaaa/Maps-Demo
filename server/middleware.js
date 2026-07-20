const jwt = require('jsonwebtoken');
const { getDb, queryOne } = require('./database');

function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'ไม่พบโทเค็นยืนยันตัวตน' });
        }

        jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'โทเค็นไม่ถูกต้องหรือหมดอายุ' });
            }
            req.user = user;
            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการยืนยันตัวตน' });
    }
}

function authorizeRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
        }
        next();
    };
}

function checkPermission(permission) {
    return (req, res, next) => {
        if (!req.user || !req.user[permission]) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
        }
        next();
    };
}

function auditLog(action, resourceType) {
    return async (req, res, next) => {
        try {
            const db = await getDb();
            const userId = req.user ? req.user.id : null;
            const resourceId = req.params.id ? parseInt(req.params.id, 10) : null;
            const details = `${req.method} ${req.originalUrl}`;
            const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

            setImmediate(async () => {
                try {
                    const dbi = await getDb();
                    dbi.run(`
                        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [userId, action, resourceType, resourceId, details, ipAddress]);
                } catch (e) {
                    console.error('Audit log async error:', e);
                }
            });
        } catch (error) {
            console.error('Audit log setup error:', error);
        }
        next();
    };
}

function sanitizeInput(req, res, next) {
    try {
        if (req.body && typeof req.body === 'object') {
            for (let key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = req.body[key].replace(/<[^>]*>?/gm, '').trim();
                }
            }
        }
        next();
    } catch (error) {
        console.error('Sanitization error:', error);
        next();
    }
}

module.exports = {
    authenticateToken,
    authorizeRole,
    checkPermission,
    auditLog,
    sanitizeInput
};
