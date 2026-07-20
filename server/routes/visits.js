const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../database');
const { authenticateToken, auditLog, sanitizeInput } = require('../middleware');
const { decrypt } = require('../encryption');

const router = express.Router();
router.use(authenticateToken);

router.get('/patient/:patientId', async (req, res) => {
    try {
        const db = await getDb();
        const visits = queryAll(db, `
            SELECT v.*, u.full_name as doctor_name 
            FROM visit_records v
            JOIN users u ON v.doctor_id = u.id
            WHERE v.patient_id = ?
            ORDER BY v.visit_date DESC
        `, [req.params.patientId]);
        
        res.json(visits);
    } catch (error) {
        console.error('Get visits error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเยี่ยมบ้าน' });
    }
});

router.post('/', sanitizeInput, auditLog('CREATE', 'visit'), async (req, res) => {
    try {
        const { patient_id, visit_date, visit_type, symptoms, diagnosis, treatment, vital_signs, notes, next_visit_date } = req.body;
        const db = await getDb();
        
        runSql(db, `
            INSERT INTO visit_records (
                patient_id, doctor_id, visit_date, visit_type, symptoms, 
                diagnosis, treatment, vital_signs, notes, next_visit_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            patient_id, req.user.id, visit_date, visit_type || 'routine', 
            symptoms || null, diagnosis || null, treatment || null, 
            vital_signs || null, notes || null, next_visit_date || null
        ]);
        
        if (next_visit_date) {
            runSql(db, "UPDATE patients SET next_visit_date = ?, updated_at = datetime('now') WHERE id = ?", 
                [next_visit_date, patient_id]);
        }
        
        res.status(201).json({ message: 'บันทึกการเยี่ยมบ้านสำเร็จ' });
    } catch (error) {
        console.error('Create visit error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกการเยี่ยมบ้าน' });
    }
});

router.put('/:id', sanitizeInput, auditLog('UPDATE', 'visit'), async (req, res) => {
    try {
        const { visit_type, symptoms, diagnosis, treatment, vital_signs, notes, next_visit_date } = req.body;
        const db = await getDb();
        
        const existing = queryOne(db, 'SELECT patient_id FROM visit_records WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลการเยี่ยมบ้าน' });
        }

        runSql(db, `
            UPDATE visit_records SET 
                visit_type = ?, symptoms = ?, diagnosis = ?, treatment = ?, 
                vital_signs = ?, notes = ?, next_visit_date = ?
            WHERE id = ?
        `, [visit_type, symptoms, diagnosis, treatment, vital_signs, notes, next_visit_date, req.params.id]);
        
        if (next_visit_date) {
            runSql(db, "UPDATE patients SET next_visit_date = ?, updated_at = datetime('now') WHERE id = ?", 
                [next_visit_date, existing.patient_id]);
        }
        
        res.json({ message: 'อัปเดตการเยี่ยมบ้านสำเร็จ' });
    } catch (error) {
        console.error('Update visit error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตการเยี่ยมบ้าน' });
    }
});

router.get('/upcoming', async (req, res) => {
    try {
        const db = await getDb();
        const patients = queryAll(db, `
            SELECT id, encrypted_name, next_visit_date, latitude, longitude, status
            FROM patients 
            WHERE next_visit_date IS NOT NULL 
            AND date(next_visit_date) > date('now') 
            AND date(next_visit_date) <= date('now', '+7 days')
            ORDER BY date(next_visit_date) ASC
        `);
        
        const mapped = patients.map(p => ({
            ...p,
            name: decrypt(p.encrypted_name),
            encrypted_name: undefined
        }));
        
        res.json(mapped);
    } catch (error) {
        console.error('Get upcoming visits error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการนัดหมาย' });
    }
});

router.get('/today', async (req, res) => {
    try {
        const db = await getDb();
        const patients = queryAll(db, `
            SELECT id, encrypted_name, next_visit_date, latitude, longitude, status
            FROM patients 
            WHERE date(next_visit_date) = date('now')
        `);
        
        const mapped = patients.map(p => ({
            ...p,
            name: decrypt(p.encrypted_name),
            encrypted_name: undefined
        }));
        
        res.json(mapped);
    } catch (error) {
        console.error('Get today visits error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการนัดหมาย' });
    }
});

module.exports = router;
