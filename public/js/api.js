const API = {
    baseUrl: '/api',
    
    getToken() { return localStorage.getItem('token'); },
    setToken(token) { localStorage.setItem('token', token); },
    removeToken() { localStorage.removeItem('token'); },
    
    async request(method, endpoint, data = null) {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const options = { method, headers };
        if (data && method !== 'GET') options.body = JSON.stringify(data);
        
        let url = `${this.baseUrl}${endpoint}`;
        if (data && method === 'GET') {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(data)) {
                if (v !== undefined && v !== null && v !== '') params.append(k, v);
            }
            const qs = params.toString();
            if (qs) url += `?${qs}`;
        }
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 401) {
                this.removeToken();
                if (typeof App !== 'undefined') App.showPage('login');
                throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
            }
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Request failed');
            return result;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ / Cannot connect to server');
            }
            throw error;
        }
    },
    
    get(endpoint, params) { return this.request('GET', endpoint, params); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); }
};
