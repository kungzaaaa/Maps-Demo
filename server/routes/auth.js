const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, queryOne, queryAll, runSql } = require('../database');
const { authenticateToken, sanitizeInput, auditLog } = require('../middleware');

const router = express.Router();

router.post('/login', sanitizeInput, async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = await getDb();

        const user = queryOne(db, 'SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            can_edit: user.can_edit,
            can_delete: user.can_delete
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '8h' });

        // Audit log
        const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
        runSql(db, `
            INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
            VALUES (?, 'LOGIN', 'auth', 'User login', ?)
        `, [user.id, ipAddress]);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                can_edit: user.can_edit,
                can_delete: user.can_delete
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const user = queryOne(db, `
            SELECT id, username, email, full_name, role, can_edit, can_delete, created_at
            FROM users WHERE id = ?
        `, [req.user.id]);
        
        if (!user) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
        }
        
        res.json({ user });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// Update Profile (Full name & Email)
router.put('/profile', authenticateToken, sanitizeInput, auditLog('UPDATE', 'profile'), async (req, res) => {
    try {
        const { full_name, email } = req.body;
        
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อ-นามสกุล / Full name is required' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล / Email is required' });
        }

        const db = await getDb();

        // Check if email taken by another user
        const existing = queryOne(db, 'SELECT id FROM users WHERE email = ? AND id != ?', [email.trim(), req.user.id]);
        if (existing) {
            return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว / Email already in use' });
        }

        runSql(db, `
            UPDATE users SET full_name = ?, email = ? WHERE id = ?
        `, [full_name.trim(), email.trim(), req.user.id]);

        const updatedUser = queryOne(db, `
            SELECT id, username, email, full_name, role, can_edit, can_delete, created_at
            FROM users WHERE id = ?
        `, [req.user.id]);

        res.json({ message: 'อัปเดตข้อมูลโปรไฟล์สำเร็จ / Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});

// Change Password
router.put('/change-password', authenticateToken, sanitizeInput, auditLog('UPDATE', 'password'), async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านปัจจุบัน / Current password is required' });
        }
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร / New password must be at least 6 chars' });
        }
        if (new_password !== confirm_password) {
            return res.status(400).json({ error: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน / Passwords do not match' });
        }

        const db = await getDb();
        const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน / User not found' });
        }

        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง / Incorrect current password' });
        }

        const new_hash = await bcrypt.hash(new_password, 12);
        runSql(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [new_hash, req.user.id]);

        res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย / Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
    }
});

// User Recent Activity Logs
router.get('/activity', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const logs = queryAll(db, `
            SELECT action, resource_type, details, ip_address, created_at
            FROM audit_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.json(logs);
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติกิจกรรม' });
    }
});

module.exports = router;
