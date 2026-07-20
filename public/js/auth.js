const Auth = {
    currentUser: null,
    
    init() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const infoForm = document.getElementById('profile-info-form');
        if (infoForm) {
            infoForm.addEventListener('submit', (e) => this.handleUpdateProfile(e));
        }

        const passForm = document.getElementById('profile-password-form');
        if (passForm) {
            passForm.addEventListener('submit', (e) => this.handleChangePassword(e));
        }
    },
    
    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
            btn.disabled = true;
            
            const res = await API.post('/auth/login', data);
            
            if (res.token) {
                API.setToken(res.token);
            }
            
            this.currentUser = res.user;
            Toast.show('เข้าสู่ระบบสำเร็จ / Login successful', 'success');
            App.showPage('app');
            App.updateUserInfo();
            MapView.init();
            await MapView.loadPatients();
            App.setupInactivityTimer();
        } catch (err) {
            Toast.show(err.message || 'เข้าสู่ระบบล้มเหลว / Login failed', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    async checkAuth() {
        const token = API.getToken();
        if (!token) return false;
        try {
            const res = await API.get('/auth/me');
            this.currentUser = res.user || res;
            return true;
        } catch (e) {
            API.removeToken();
            this.currentUser = null;
            return false;
        }
    },

    openProfileModal() {
        if (!this.currentUser) return;
        this.populateProfileModal();
        App.showModal('profile-modal');
    },

    populateProfileModal() {
        const u = this.currentUser;
        if (!u) return;

        document.getElementById('profile-username').value = u.username || '';
        document.getElementById('profile-role').value = u.role === 'admin' ? '👑 Admin (ผู้ดูแลระบบ)' : '🩺 Doctor (แพทย์)';
        document.getElementById('profile-fullname').value = u.full_name || '';
        document.getElementById('profile-email').value = u.email || '';
        document.getElementById('profile-created-at').value = u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    },

    async handleUpdateProfile(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
            btn.disabled = true;

            const res = await API.put('/auth/profile', data);
            if (res.user) {
                this.currentUser = { ...this.currentUser, ...res.user };
            }
            App.updateUserInfo();
            Toast.show(res.message || 'อัปเดตข้อมูลโปรไฟล์สำเร็จ', 'success');
        } catch (err) {
            Toast.show(err.message || 'อัปเดตข้อมูลล้มเหลว', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async handleChangePassword(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (data.new_password !== data.confirm_password) {
            Toast.show('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน / Passwords do not match', 'error');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเปลี่ยนรหัสผ่าน...';
            btn.disabled = true;

            const res = await API.put('/auth/change-password', data);
            Toast.show(res.message || 'เปลี่ยนรหัสผ่านสำเร็จ', 'success');
            e.target.reset();
        } catch (err) {
            Toast.show(err.message || 'เปลี่ยนรหัสผ่านล้มเหลว', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async loadMyActivity() {
        const container = document.getElementById('profile-activity-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

        try {
            const logs = await API.get('/auth/activity');
            if (!logs || logs.length === 0) {
                container.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;"><i class="fas fa-history" style="font-size:2rem; margin-bottom:10px; display:block;"></i>ยังไม่มีประวัติกิจกรรม</div>';
                return;
            }

            const actionColors = { CREATE: '#10b981', READ: '#3b82f6', UPDATE: '#f59e0b', DELETE: '#ef4444', LOGIN: '#6366f1' };
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; gap: 8px;">
                    ${logs.map(l => `
                        <div style="padding: 10px 14px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-weight: 600; color: ${actionColors[l.action] || 'var(--text-primary)'}; margin-right: 6px;">[${l.action}]</span>
                                <span>${l.details || l.resource_type || '-'}</span>
                            </div>
                            <span style="color: var(--text-secondary); font-size: 0.75rem;">${new Date(l.created_at).toLocaleString('th-TH')}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            container.innerHTML = '<div style="text-align:center; color: var(--danger); padding: 1.5rem;">โหลดประวัติกิจกรรมล้มเหลว</div>';
        }
    },
    
    logout() {
        API.removeToken();
        this.currentUser = null;
        App.showPage('login');
        App.closeSidebar();
        App.closeAllPanels();
        Toast.show('ออกจากระบบแล้ว / Logged out', 'info');
        clearTimeout(App.inactivityTimer);
        clearInterval(App.countdownInterval);
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();
    }
};
