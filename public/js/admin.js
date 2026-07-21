const Admin = {
    init() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.loadTab(e.currentTarget.dataset.tab);
            });
        });
    },

    async loadTab(tabName) {
        const content = document.getElementById('admin-content');
        content.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

        try {
            switch (tabName) {
                case 'users': await this.loadUsers(content); break;
                case 'add-user': this.showAddUserForm(content); break;
                case 'audit': await this.loadAuditLogs(content); break;
            }
        } catch (e) {
            console.error(e);
            content.innerHTML = '<div style="text-align:center; color: #ff5252; padding: 2rem;">โหลดข้อมูลล้มเหลว</div>';
        }
    },

    showAddUserForm(content) {
        content.innerHTML = `
            <div style="max-width: 500px; margin: 15px auto;" class="data-card">
                <h3 style="color: var(--text-primary); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-user-plus"></i> Create New User
                </h3>
                <form id="admin-create-user-form">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" name="full_name" required placeholder="Enter full name" />
                    </div>
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" name="username" required placeholder="Enter username" />
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" name="email" required placeholder="Enter email" />
                    </div>
                    <div class="form-group">
                        <label>Password *</label>
                        <input type="text" name="password" required placeholder="อย่างน้อย 6 ตัวอักษร" />
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role">
                            <option value="doctor">Doctor - แพทย์</option>
                            <option value="admin">Admin - ผู้ดูแลระบบ</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary btn-block" style="padding: 12px; font-size: 1rem;"><i class="fas fa-user-plus"></i> สร้างบัญชี / Create Account</button>
                </form>
                <div id="create-user-result" style="margin-top: 15px;"></div>
            </div>
        `;

        document.getElementById('admin-create-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            const btn = e.target.querySelector('button[type="submit"]');
            const resultDiv = document.getElementById('create-user-result');

            try {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังสร้าง...';
                btn.disabled = true;

                const res = await API.post('/admin/users', data);

                resultDiv.innerHTML = `
                    <div style="padding: 15px; border-radius: 10px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: var(--success);">
                        <h4 style="margin: 0 0 8px;"><i class="fas fa-check-circle"></i> ${res.message}</h4>
                        <p style="margin: 0; font-size: 0.9rem;">ข้อมูลสำหรับผู้ใช้:</p>
                        <div style="margin-top: 8px; padding: 10px; background: var(--bg-secondary); border-radius: 6px; font-family: monospace; border: 1px solid var(--border-color);">
                            <p style="margin: 2px 0;">Username: <strong>${data.username}</strong></p>
                            <p style="margin: 2px 0;">Password: <strong>${data.password}</strong></p>
                        </div>
                        <p style="margin: 8px 0 0; font-size: 0.8rem; color: var(--text-secondary);"><i class="fas fa-info-circle"></i> ส่งข้อมูลนี้ให้ผู้ใช้เพื่อเข้าสู่ระบบ</p>
                    </div>
                `;
                e.target.reset();
            } catch (err) {
                resultDiv.innerHTML = `
                    <div style="padding: 12px; border-radius: 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: var(--danger);">
                        <i class="fas fa-times-circle"></i> ${err.message}
                    </div>
                `;
            } finally {
                btn.innerHTML = '<i class="fas fa-user-plus"></i> สร้างบัญชี / Create Account';
                btn.disabled = false;
            }
        });
    },

    async loadUsers(content) {
        const users = await API.get('/admin/users');

        if (users.length === 0) {
            content.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;">ไม่พบผู้ใช้</div>';
            return;
        }

        content.innerHTML = `
            <div class="custom-table-container">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Permissions</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>
                                    <div style="font-weight: 600; color: var(--text-primary);">${u.full_name}</div>
                                    ${u.email ? `<div style="font-size: 0.78rem; color: var(--text-secondary);">${u.email}</div>` : ''}
                                </td>
                                <td><code style="background: var(--bg-secondary); padding: 3px 8px; border-radius: 6px; font-size: 0.82rem; border: 1px solid var(--border-color); color: var(--text-primary);">${u.username}</code></td>
                                <td>
                                    <select class="role-select" onchange="Admin.changeRole(${u.id}, this.value)">
                                        <option value="doctor" ${u.role === 'doctor' ? 'selected' : ''}>🩺 Doctor</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                                    </select>
                                </td>
                                <td>
                                    <div class="perm-group">
                                        <label class="perm-item">
                                            <input type="checkbox" ${u.can_edit ? 'checked' : ''} onchange="Admin.updatePermissions(${u.id}, this.checked, ${u.can_delete})">
                                            <span>แก้ไข</span>
                                        </label>
                                        <label class="perm-item">
                                            <input type="checkbox" ${u.can_delete ? 'checked' : ''} onchange="Admin.updatePermissions(${u.id}, ${u.can_edit}, this.checked)">
                                            <span>ลบ</span>
                                        </label>
                                    </div>
                                </td>
                                <td style="text-align: center;">
                                    <button class="action-btn" onclick="Admin.deleteUser(${u.id})" ${u.id === Auth.currentUser?.id ? 'disabled title="ไม่สามารถลบตัวเอง"' : 'title="ลบผู้ใช้"'}>
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async loadAuditLogs(content) {
        const logs = await API.get('/admin/audit-logs');

        if (!logs || logs.length === 0) {
            content.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;">ไม่มี Audit Logs</div>';
            return;
        }

        content.innerHTML = `
            <div class="custom-table-container">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>เวลา / Time</th>
                            <th>ผู้ใช้ / User</th>
                            <th>Action</th>
                            <th>Resource</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(l => {
                            const actionColors = { CREATE: '#10b981', READ: '#3b82f6', UPDATE: '#f59e0b', DELETE: '#ef4444', LOGIN: '#06b6d4' };
                            return `
                                <tr>
                                    <td style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(l.created_at).toLocaleString('th-TH')}</td>
                                    <td><strong style="color: var(--text-primary);">${l.username || '-'}</strong></td>
                                    <td><span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 0.75rem; background: ${actionColors[l.action] || '#71717a'}22; color: ${actionColors[l.action] || '#71717a'}; border: 1px solid ${actionColors[l.action] || '#71717a'}44;">${l.action}</span></td>
                                    <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color);">${l.resource_type || '-'}</code></td>
                                    <td style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${l.details || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async loadDashboard() {
        const content = document.getElementById('dashboard-content');
        content.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

        try {
            const stats = await API.get('/admin/stats');
            const cards = [
                { icon: 'fa-users', color: '#06b6d4', label: 'ผู้ป่วยทั้งหมด / Total Patients', value: stats.total_patients },
                { icon: 'fa-user-md', color: '#3b82f6', label: 'แพทย์ / Doctors', value: stats.total_doctors },
                { icon: 'fa-calendar-check', color: '#10b981', label: 'เยี่ยมวันนี้ / Today', value: stats.visits_today },
                { icon: 'fa-calendar-week', color: '#8b5cf6', label: 'เยี่ยมสัปดาห์นี้ / This Week', value: stats.visits_this_week },
                { icon: 'fa-exclamation-circle', color: '#ef4444', label: 'ผู้ป่วยวิกฤต / Critical', value: stats.critical_patients },
                { icon: 'fa-heartbeat', color: '#10b981', label: 'ผู้ป่วย Active', value: stats.active_patients }
            ];
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 15px 0;">
                    ${cards.map(c => `
                        <div class="data-card" style="text-align: center; border-bottom: 3px solid ${c.color};">
                            <i class="fas ${c.icon}" style="font-size: 2rem; color: ${c.color}; margin-bottom: 10px;"></i>
                            <h2 style="font-size: 2.2rem; margin: 5px 0; color: var(--text-primary);">${c.value}</h2>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">${c.label}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            const patients = Patients.list || [];
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 15px 0;">
                    <div class="data-card" style="text-align: center; border-bottom: 3px solid #06b6d4;">
                        <i class="fas fa-users" style="font-size: 2rem; color: #06b6d4; margin-bottom: 10px;"></i>
                        <h2 style="font-size: 2.2rem; margin: 5px 0; color: var(--text-primary);">${patients.length}</h2>
                        <p style="color: var(--text-secondary); margin: 0;">ผู้ป่วยทั้งหมด</p>
                    </div>
                </div>
            `;
        }
    },

    async updatePermissions(userId, canEdit, canDelete) {
        try {
            await API.put(`/admin/users/${userId}/permissions`, { can_edit: canEdit, can_delete: canDelete });
            Toast.show('อัปเดตสิทธิ์สำเร็จ / Permissions updated', 'success');
        } catch (e) {
            Toast.show(e.message || 'อัปเดตล้มเหลว', 'error');
        }
    },

    async changeRole(userId, role) {
        try {
            await API.put(`/admin/users/${userId}/role`, { role });
            Toast.show('อัปเดตบทบาทสำเร็จ / Role updated', 'success');
        } catch (e) {
            Toast.show(e.message || 'อัปเดตล้มเหลว', 'error');
        }
    },

    async deleteUser(userId) {
        if (!confirm('ลบผู้ใช้นี้? / Delete this user?')) return;
        try {
            await API.delete(`/admin/users/${userId}`);
            Toast.show('ลบผู้ใช้สำเร็จ / User deleted', 'success');
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.loadTab(activeTab.dataset.tab);
        } catch (e) {
            Toast.show(e.message || 'ลบล้มเหลว', 'error');
        }
    }
};
