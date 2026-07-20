const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
    const buffer = Buffer.from(key, 'hex');
    if (buffer.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 bytes long (64 hex characters)');
    return buffer.subarray(0, 32);
}

function encrypt(text) {
    if (text === null || text === undefined) return null;
    
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

function decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) return null;
        
        const [ivHex, authTagHex, encryptedHex] = parts;
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

module.exports = { encrypt, decrypt };
