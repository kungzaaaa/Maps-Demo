require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initializeAdmin } = require('./database');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com", "unpkg.com", "cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "*.basemaps.cartocdn.com"]
        }
    }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'คำขอมากเกินไป กรุณาลองใหม่ภายหลัง / Too many attempts.' }
});
app.use('/api/auth/', authLimiter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/admin', adminRoutes);

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initializeAdmin();
        
        app.listen(PORT, () => {
            console.log('');
            console.log('🏥 ═══════════════════════════════════════════════');
            console.log('🏥  Home Visit Management System');
            console.log('🏥  ระบบจัดการการเยี่ยมบ้านผู้ป่วย');
            console.log('🏥 ═══════════════════════════════════════════════');
            console.log(`🌐  URL: http://localhost:${PORT}`);
            console.log('👤  Default Admin: admin / Admin@1234');
            console.log('🔒  Security: AES-256-GCM, bcrypt, JWT, RBAC');
            console.log('🏥 ═══════════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
