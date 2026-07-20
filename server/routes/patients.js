const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../database');
const { authenticateToken, checkPermission, auditLog, sanitizeInput } = require('../middleware');
const { encrypt, decrypt } = require('../encryption');

const router = express.Router();
router.use(authenticateToken);

function decryptPatient(patient) {
    if (!patient) return null;
    return {
        ...patient,
        name: decrypt(patient.encrypted_name),
        id_card: decrypt(patient.encrypted_id_card),
        address: decrypt(patient.encrypted_address),
        phone: decrypt(patient.encrypted_phone),
        diseases: decrypt(patient.encrypted_diseases),
        medications: decrypt(patient.encrypted_medications),
        allergies: decrypt(patient.encrypted_allergies),
        encrypted_name: undefined,
        encrypted_id_card: undefined,
        encrypted_address: undefined,
        encrypted_phone: undefined,
        encrypted_diseases: undefined,
        encrypted_medications: undefined,
        encrypted_allergies: undefined
    };
}

router.get('/', auditLog('READ', 'patient'), async (req, res) => {
    try {
        const { status, search } = req.query;
        const db = await getDb();
        
        let query = 'SELECT * FROM patients';
        let params = [];
        
        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const patients = queryAll(db, query, params);
        let decryptedPatients = patients.map(decryptPatient);

        if (search) {
            const keyword = search.toLowerCase();
            decryptedPatients = decryptedPatients.filter(p => 
                (p.name && p.name.toLowerCase().includes(keyword)) ||
                (p.id_card && p.id_card.includes(keyword)) ||
                (p.phone && p.phone.includes(keyword))
            );
        }

        res.json(decryptedPatients);
    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย' });
    }
});

router.get('/:id', auditLog('READ', 'patient'), async (req, res) => {
    try {
        const db = await getDb();
        const patient = queryOne(db, 'SELECT * FROM patients WHERE id = ?', [req.params.id]);
        
        if (!patient) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
        }
        
        res.json(decryptPatient(patient));
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย' });
    }
});

router.post('/', sanitizeInput, auditLog('CREATE', 'patient'), async (req, res) => {
    try {
        const { name, id_card, address, phone, diseases, medications, allergies, birth_date, gender, latitude, longitude, status, notes, next_visit_date } = req.body;
        
        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อและตำแหน่งที่อยู่' });
        }
        
        const db = await getDb();
        const result = runSql(db, `
            INSERT INTO patients (
                encrypted_name, encrypted_id_card, encrypted_address, encrypted_phone, 
                encrypted_diseases, encrypted_medications, encrypted_allergies, 
                birth_date, gender, latitude, longitude, status, notes, next_visit_date, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            encrypt(name), encrypt(id_card || ''), encrypt(address || ''), encrypt(phone || ''), 
            encrypt(diseases || ''), encrypt(medications || ''), encrypt(allergies || ''), 
            birth_date || null, gender || null, parseFloat(latitude), parseFloat(longitude), 
            status || 'active', notes || null, next_visit_date || null, req.user.id
        ]);
        
        const newPatient = queryOne(db, 'SELECT * FROM patients WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(decryptPatient(newPatient));
    } catch (error) {
        console.error('Create patient error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างข้อมูลผู้ป่วย' });
    }
});

router.put('/:id', checkPermission('can_edit'), sanitizeInput, auditLog('UPDATE', 'patient'), async (req, res) => {
    try {
        const { name, id_card, address, phone, diseases, medications, allergies, birth_date, gender, latitude, longitude, status, notes, next_visit_date } = req.body;
        const id = req.params.id;
        
        const db = await getDb();
        const existing = queryOne(db, 'SELECT id FROM patients WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
        }
        
        runSql(db, `
            UPDATE patients SET 
                encrypted_name = ?, encrypted_id_card = ?, encrypted_address = ?, encrypted_phone = ?, 
                encrypted_diseases = ?, encrypted_medications = ?, encrypted_allergies = ?, 
                birth_date = ?, gender = ?, latitude = ?, longitude = ?, status = ?, notes = ?, 
                next_visit_date = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [
            encrypt(name), encrypt(id_card || ''), encrypt(address || ''), encrypt(phone || ''), 
            encrypt(diseases || ''), encrypt(medications || ''), encrypt(allergies || ''), 
            birth_date || null, gender || null, parseFloat(latitude), parseFloat(longitude), 
            status, notes || null, next_visit_date || null, id
        ]);
        
        const updatedPatient = queryOne(db, 'SELECT * FROM patients WHERE id = ?', [id]);
        res.json(decryptPatient(updatedPatient));
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ป่วย' });
    }
});

router.delete('/:id', async (req, res, next) => {
    if (req.user && (req.user.can_delete || req.user.role === 'admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบข้อมูลผู้ป่วย' });
    }
}, auditLog('DELETE', 'patient'), async (req, res) => {
    try {
        const db = await getDb();
        const result = runSql(db, 'DELETE FROM patients WHERE id = ?', [req.params.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
        }
        
        res.json({ message: 'ลบข้อมูลผู้ป่วยสำเร็จ' });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ป่วย' });
    }
});

router.post('/sync-gmaps', sanitizeInput, auditLog('SYNC', 'gmaps'), async (req, res) => {
    try {
        const { gmap_url } = req.body;
        if (!gmap_url) {
            return res.status(400).json({ error: 'กรุณาระบุลิงก์ Google My Maps' });
        }

        const midMatch = gmap_url.match(/mid=([^&]+)/);
        const mid = midMatch ? midMatch[1] : gmap_url;

        const response = await fetch(`https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`);
        if (!response.ok) {
            return res.status(400).json({ error: 'ไม่สามารถดึงข้อมูล KML จาก Google My Maps ได้ กรุณาตรวจสอบลิงก์และการแชร์แบบสาธารณะ' });
        }

        const kmlText = await response.text();
        const placemarks = kmlText.split('<Placemark>');
        
        const db = await getDb();
        const allPatients = queryAll(db, 'SELECT * FROM patients');
        const decryptedPatients = allPatients.map(decryptPatient);
        
        let added = 0;
        let updated = 0;

        for (let i = 1; i < placemarks.length; i++) {
            const block = placemarks[i];
            const nameMatch = block.match(/<name>(.*?)<\/name>/);
            const descMatch = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || block.match(/<description>(.*?)<\/description>/);
            const coordMatch = block.match(/<coordinates>(.*?)<\/coordinates>/);

            if (nameMatch && coordMatch) {
                const name = nameMatch[1].trim();
                const notes = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : ''; 
                const coords = coordMatch[1].trim().split(','); 
                
                if (coords.length >= 2) {
                    const lng = parseFloat(coords[0]);
                    const lat = parseFloat(coords[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const existing = decryptedPatients.find(p => p.name === name);
                        if (existing) {
                            runSql(db, `
                                UPDATE patients SET 
                                    latitude = ?, longitude = ?, notes = ?, updated_at = datetime('now') 
                                WHERE id = ?
                            `, [lat, lng, notes, existing.id]);
                            updated++;
                        } else {
                            runSql(db, `
                                INSERT INTO patients (
                                    encrypted_name, encrypted_id_card, encrypted_address, encrypted_phone, 
                                    encrypted_diseases, encrypted_medications, encrypted_allergies, 
                                    latitude, longitude, status, notes, created_by
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                encrypt(name), encrypt(''), encrypt(''), encrypt(''), 
                                encrypt(''), encrypt(''), encrypt(''), 
                                lat, lng, 'active', notes, req.user ? req.user.id : null
                            ]);
                            added++;
                        }
                    }
                }
            }
        }

        res.json({ message: `ซิงค์ข้อมูลสำเร็จ (เพิ่มใหม่: ${added}, อัปเดต: ${updated})` });
    } catch (error) {
        console.error('Sync Google My Maps error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลจาก Google My Maps' });
    }
});

module.exports = router;
