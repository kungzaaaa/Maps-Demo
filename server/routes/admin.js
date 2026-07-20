const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, queryAll, queryOne, runSql } = require('../database');
const { authenticateToken, authorizeRole, auditLog, sanitizeInput } = require('../middleware');

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRole('admin'));

// Admin creates a new user (no registration/approval needed)
router.post('/users', sanitizeInput, auditLog('CREATE', 'user'), async (req, res) => {
    try {
        const { username, email, password, full_name, role } = req.body;
        
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร' });
        }
        if (!email) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
        }
        if (!full_name) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อ-นามสกุล' });
        }
        
        const db = await getDb();
        
        const existing = queryOne(db, 'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้งานหรืออีเมลนี้มีในระบบแล้ว' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        
        runSql(db, `
            INSERT INTO users (username, email, password_hash, full_name, role, status, can_edit, can_delete)
            VALUES (?, ?, ?, ?, ?, 'approved', 1, 0)
        `, [username, email, password_hash, full_name, role || 'doctor']);

        res.status(201).json({ message: `สร้างบัญชีผู้ใช้ "${username}" สำเร็จ` });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const db = await getDb();
        const users = queryAll(db, `
            SELECT id, username, email, full_name, role, status, 
                   can_edit, can_delete, created_at
            FROM users ORDER BY created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
    }
});

router.put('/users/:id/permissions', auditLog('UPDATE', 'user_permissions'), async (req, res) => {
    try {
        const { can_edit, can_delete } = req.body;
        const db = await getDb();
        
        runSql(db, 'UPDATE users SET can_edit = ?, can_delete = ? WHERE id = ?',
            [can_edit ? 1 : 0, can_delete ? 1 : 0, req.params.id]);
          
        res.json({ message: 'อัปเดตสิทธิ์ผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์' });
    }
});

router.put('/users/:id/role', auditLog('UPDATE', 'user_role'), async (req, res) => {
    try {
        const { role } = req.body;
        if (!['admin', 'doctor'].includes(role)) {
            return res.status(400).json({ error: 'บทบาทไม่ถูกต้อง' });
        }
        
        const db = await getDb();
        runSql(db, 'UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
          
        res.json({ message: 'อัปเดตบทบาทผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตบทบาท' });
    }
});

router.delete('/users/:id', auditLog('DELETE', 'user'), async (req, res) => {
    try {
        if (parseInt(req.params.id, 10) === req.user.id) {
            return res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตนเองได้' });
        }
        
        const db = await getDb();
        runSql(db, 'DELETE FROM users WHERE id = ?', [req.params.id]);
        
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' });
    }
});

router.get('/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const db = await getDb();
        
        const logs = queryAll(db, `
            SELECT a.*, u.username 
            FROM audit_logs a 
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC LIMIT ? OFFSET ?
        `, [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
        
        res.json(logs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Audit Logs' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const db = await getDb();
        
        const total_patients = queryOne(db, 'SELECT count(*) as count FROM patients')?.count || 0;
        const total_doctors = queryOne(db, "SELECT count(*) as count FROM users WHERE role = 'doctor'")?.count || 0;
        const visits_today = queryOne(db, "SELECT count(*) as count FROM visit_records WHERE date(visit_date) = date('now')")?.count || 0;
        const visits_this_week = queryOne(db, "SELECT count(*) as count FROM visit_records WHERE date(visit_date) >= date('now', '-7 days')")?.count || 0;
        const critical_patients = queryOne(db, "SELECT count(*) as count FROM patients WHERE status = 'critical'")?.count || 0;
        const active_patients = queryOne(db, "SELECT count(*) as count FROM patients WHERE status = 'active'")?.count || 0;
        
        res.json({
            total_patients,
            total_doctors,
            visits_today,
            visits_this_week,
            critical_patients,
            active_patients
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ' });
    }
});

module.exports = router;
