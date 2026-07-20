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
            <div style="max-width: 500px; margin: 20px auto;">
                <h3 style="color: #80deea; margin-bottom: 20px;"><i class="fas fa-user-plus"></i> Create New User</h3>
                <form id="admin-create-user-form">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem;">Name *</label>
                        <input type="text" name="full_name" required class="glass-input" style="width:100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6;" />
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem;">Username *</label>
                        <input type="text" name="username" required class="glass-input" style="width:100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6;" />
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem;">Email *</label>
                        <input type="email" name="email" required class="glass-input" style="width:100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6;" />
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem;">Password *</label>
                        <input type="text" name="password" required class="glass-input" style="width:100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6;" placeholder="อย่างน้อย 6 ตัวอักษร" />
                    </div>
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem;">Role</label>
                        <select name="role" class="glass-input" style="width:100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6;">
                            <option value="doctor">Doctor - แพทย์</option>
                            <option value="admin">Admin - ผู้ดูแลระบบ</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary" style="width:100%; padding: 12px; font-size: 1rem;"><i class="fas fa-user-plus"></i> สร้างบัญชี / Create Account</button>
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
                    <div style="padding: 15px; border-radius: 10px; background: rgba(0,230,118,0.1); border: 1px solid rgba(0,230,118,0.3); color: #00e676;">
                        <h4 style="margin: 0 0 8px;"><i class="fas fa-check-circle"></i> ${res.message}</h4>
                        <p style="margin: 0; font-size: 0.9rem;">ข้อมูลสำหรับผู้ใช้:</p>
                        <div style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; font-family: monospace;">
                            <p style="margin: 2px 0;">Username: <strong>${data.username}</strong></p>
                            <p style="margin: 2px 0;">Password: <strong>${data.password}</strong></p>
                        </div>
                        <p style="margin: 8px 0 0; font-size: 0.8rem; color: #90a4ae;"><i class="fas fa-info-circle"></i> ส่งข้อมูลนี้ให้ผู้ใช้เพื่อเข้าสู่ระบบ</p>
                    </div>
                `;
                e.target.reset();
            } catch (err) {
                resultDiv.innerHTML = `
                    <div style="padding: 12px; border-radius: 10px; background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); color: #ff5252;">
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
            <div style="overflow-x: auto; margin-top: 15px;">
                <table style="width:100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                            <th style="padding: 12px;">Name</th>
                            <th style="padding: 12px;">Username</th>
                            <th style="padding: 12px;">Role</th>
                            <th style="padding: 12px;">Permissions</th>
                            <th style="padding: 12px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 10px;">${u.full_name}</td>
                                <td style="padding: 10px; color: var(--text-secondary);">${u.username}</td>
                                <td style="padding: 10px;">
                                    <select onchange="Admin.changeRole(${u.id}, this.value)" style="background: rgba(255,255,255,0.05); color: #e8eaf6; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 0.8rem;">
                                        <option value="doctor" ${u.role === 'doctor' ? 'selected' : ''}>🩺 Doctor</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                                    </select>
                                </td>
                                <td style="padding: 10px;">
                                    <label style="font-size: 0.8rem; margin-right: 8px; cursor: pointer;">
                                        <input type="checkbox" ${u.can_edit ? 'checked' : ''} onchange="Admin.updatePermissions(${u.id}, this.checked, ${u.can_delete})"> แก้ไข
                                    </label>
                                    <label style="font-size: 0.8rem; cursor: pointer;">
                                        <input type="checkbox" ${u.can_delete ? 'checked' : ''} onchange="Admin.updatePermissions(${u.id}, ${u.can_edit}, this.checked)"> ลบ
                                    </label>
                                </td>
                                <td style="padding: 10px;">
                                    <button class="btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="Admin.deleteUser(${u.id})" ${u.id === Auth.currentUser?.id ? 'disabled title="ไม่สามารถลบตัวเอง"' : ''}>
                                        <i class="fas fa-trash"></i>
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
            <div style="overflow-x: auto; margin-top: 15px;">
                <table style="width:100%; border-collapse: collapse; font-size: 0.82rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                            <th style="padding: 10px;">เวลา / Time</th>
                            <th style="padding: 10px;">ผู้ใช้ / User</th>
                            <th style="padding: 10px;">Action</th>
                            <th style="padding: 10px;">Resource</th>
                            <th style="padding: 10px;">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(l => {
            const actionColors = { CREATE: '#00e676', READ: '#2196f3', UPDATE: '#ffc107', DELETE: '#ff5252', LOGIN: '#00bcd4' };
            return `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                    <td style="padding: 8px; white-space: nowrap;">${new Date(l.created_at).toLocaleString('th-TH')}</td>
                                    <td style="padding: 8px;">${l.username || '-'}</td>
                                    <td style="padding: 8px;"><span style="color: ${actionColors[l.action] || '#90a4ae'}; font-weight: 600;">${l.action}</span></td>
                                    <td style="padding: 8px;">${l.resource_type || '-'}</td>
                                    <td style="padding: 8px; color: var(--text-secondary);">${l.details || '-'}</td>
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
                { icon: 'fa-users', color: '#00bcd4', label: 'ผู้ป่วยทั้งหมด / Total Patients', value: stats.total_patients },
                { icon: 'fa-user-md', color: '#1a73e8', label: 'แพทย์ / Doctors', value: stats.total_doctors },
                { icon: 'fa-calendar-check', color: '#00e676', label: 'เยี่ยมวันนี้ / Today', value: stats.visits_today },
                { icon: 'fa-calendar-week', color: '#9c27b0', label: 'เยี่ยมสัปดาห์นี้ / This Week', value: stats.visits_this_week },
                { icon: 'fa-exclamation-circle', color: '#ff5252', label: 'ผู้ป่วยวิกฤต / Critical', value: stats.critical_patients },
                { icon: 'fa-heartbeat', color: '#00e676', label: 'ผู้ป่วย Active', value: stats.active_patients }
            ];
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 15px 0;">
                    ${cards.map(c => `
                        <div style="padding: 20px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-bottom: 3px solid ${c.color};">
                            <i class="fas ${c.icon}" style="font-size: 2rem; color: ${c.color}; margin-bottom: 10px;"></i>
                            <h2 style="font-size: 2.2rem; margin: 5px 0; color: #e8eaf6;">${c.value}</h2>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">${c.label}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            const patients = Patients.list || [];
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 15px 0;">
                    <div style="padding: 20px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-bottom: 3px solid #00bcd4;">
                        <i class="fas fa-users" style="font-size: 2rem; color: #00bcd4; margin-bottom: 10px;"></i>
                        <h2 style="font-size: 2.2rem; margin: 5px 0;">${patients.length}</h2>
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
