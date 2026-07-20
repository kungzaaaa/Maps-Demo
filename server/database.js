const initSqlJs = require('sql.js');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

let dbInstance = null;
let dbPath = null;

async function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    dbPath = path.join(dataDir, 'database.sqlite');
    
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        dbInstance = new SQL.Database(fileBuffer);
    } else {
        dbInstance = new SQL.Database();
    }
    
    // Enable foreign keys
    dbInstance.run('PRAGMA foreign_keys = ON');
    
    // Create tables
    dbInstance.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'doctor' CHECK(role IN ('admin', 'doctor')),
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            can_edit INTEGER DEFAULT 1,
            can_delete INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_at DATETIME,
            approved_by INTEGER REFERENCES users(id)
        )
    `);

    dbInstance.run(`
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            encrypted_name TEXT NOT NULL,
            encrypted_id_card TEXT,
            encrypted_address TEXT,
            encrypted_phone TEXT,
            encrypted_diseases TEXT,
            encrypted_medications TEXT,
            encrypted_allergies TEXT,
            birth_date TEXT,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')),
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'critical')),
            notes TEXT,
            next_visit_date TEXT,
            created_by INTEGER REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    dbInstance.run(`
        CREATE TABLE IF NOT EXISTS visit_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            doctor_id INTEGER NOT NULL REFERENCES users(id),
            visit_date DATETIME NOT NULL,
            visit_type TEXT DEFAULT 'routine' CHECK(visit_type IN ('routine', 'emergency', 'follow_up')),
            symptoms TEXT,
            diagnosis TEXT,
            treatment TEXT,
            vital_signs TEXT,
            notes TEXT,
            next_visit_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    dbInstance.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    saveDb();
    return dbInstance;
}

// Save database to file
function saveDb() {
    if (dbInstance && dbPath) {
        try {
            const data = dbInstance.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbPath, buffer);
        } catch (e) {
            console.error('Error saving database:', e);
        }
    }
}

// Auto-save every 5 seconds
setInterval(() => {
    saveDb();
}, 5000);

// Save on exit
process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

async function initializeAdmin() {
    const db = await getDb();
    const result = db.exec('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (result.length === 0 || result[0].values.length === 0) {
        const password_hash = await bcrypt.hash('Admin@1234', 12);
        db.run(`
            INSERT INTO users (username, email, password_hash, full_name, role, status, can_edit, can_delete, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, ['admin', 'admin@system.local', password_hash, 'System Administrator', 'admin', 'approved', 1, 1]);
        saveDb();
        console.log('Default admin account created. (username: admin, password: Admin@1234)');
    }
}

// Helper: sql.js returns results in { columns: [...], values: [[...], ...] } format
// This helper converts to array of objects like better-sqlite3
function queryAll(db, sql, params = []) {
    const result = db.exec(sql, params);
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
}

function queryOne(db, sql, params = []) {
    const rows = queryAll(db, sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function runSql(db, sql, params = []) {
    db.run(sql, params);
    saveDb();
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const changes = db.getRowsModified();
    return { 
        lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : 0, 
        changes 
    };
}

module.exports = { getDb, initializeAdmin, queryAll, queryOne, runSql, saveDb };
