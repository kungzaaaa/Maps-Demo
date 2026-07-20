const App = {
    inactivityTimer: null,
    countdownInterval: null,
    INACTIVITY_LIMIT: 30 * 60 * 1000, // 30 mins
    
    async init() {
        Auth.init();
        Patients.init();
        Admin.init();
        
        this.setupHamburger();
        this.setupNavigation();
        this.setupPanelClose();
        this.setupModalClose();
        this.setupThemeToggle();
        
        const isAuth = await Auth.checkAuth();
        if (isAuth) {
            this.showPage('app');
            this.updateUserInfo();
            MapView.init();
            await MapView.loadPatients();
            this.setupInactivityTimer();
        }
    },
    
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const page = document.getElementById(`${pageId}-page`);
        if (page) page.classList.add('active');
    },
    
    setupHamburger() {
        const btn = document.getElementById('hamburger-btn');
        const overlay = document.getElementById('sidebar-overlay');
        const closeBtn = document.getElementById('close-sidebar');
        
        btn.addEventListener('click', () => this.toggleSidebar());
        overlay.addEventListener('click', () => this.closeSidebar());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeSidebar());
    },
    
    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('active');
        document.getElementById('hamburger-btn').classList.toggle('active');
        document.getElementById('map-container').classList.toggle('blurred');
    },
    
    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
        document.getElementById('hamburger-btn').classList.remove('active');
        document.getElementById('map-container').classList.remove('blurred');
    },
    
    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle-btn');
        const icon = btn.querySelector('i');
        
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            icon.classList.replace('fa-moon', 'fa-sun');
        }
        
        btn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                icon.classList.replace('fa-sun', 'fa-moon');
                if (window.MapView) MapView.setTheme('light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                icon.classList.replace('fa-moon', 'fa-sun');
                if (window.MapView) MapView.setTheme('dark');
            }
        });
    },
    
    setupNavigation() {
        document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.closeSidebar();
                this.closeAllPanels();
                
                switch(page) {
                    case 'map':
                        MapView.fitAllMarkers();
                        break;
                    case 'patients':
                        this.showPanel('patient-list-panel');
                        await Patients.loadList();
                        break;
                    case 'visits-today':
                        this.showPanel('visits-today-panel');
                        await this.loadTodayVisits();
                        break;
                    case 'upcoming':
                        this.showPanel('upcoming-panel');
                        await this.loadUpcomingVisits();
                        break;
                    case 'dashboard':
                        this.showPanel('dashboard-panel');
                        await Admin.loadDashboard();
                        break;
                    case 'profile':
                        Auth.openProfileModal();
                        break;
                    case 'admin':
                        this.showPanel('admin-panel');
                        await Admin.loadTab('pending');
                        break;
                }
            });
        });
        
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        // User badge click -> Profile Modal
        const userBadge = document.getElementById('user-badge');
        if (userBadge) {
            userBadge.addEventListener('click', () => Auth.openProfileModal());
        }

        this.setupProfileTabs();
    },

    setupProfileTabs() {
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const targetTab = e.currentTarget.dataset.tab;
                
                document.querySelectorAll('.profile-tab-content').forEach(c => {
                    c.style.display = 'none';
                    c.classList.remove('active');
                });
                
                const activeContent = document.getElementById(`profile-tab-${targetTab}`);
                if (activeContent) {
                    activeContent.style.display = 'block';
                    activeContent.classList.add('active');
                }

                if (targetTab === 'activity') {
                    Auth.loadMyActivity();
                }
            });
        });
    },
    
    async loadTodayVisits() {
        const container = document.getElementById('today-visits-list');
        container.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        
        try {
            const visits = await API.get('/visits/today');
            
            if (!visits || visits.length === 0) {
                container.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;"><i class="fas fa-calendar-check" style="font-size: 2rem; color: #00e676; margin-bottom: 10px; display: block;"></i>ไม่มีนัดเยี่ยมวันนี้ / No visits today</div>';
                return;
            }
            
            container.innerHTML = visits.map(p => `
                <div style="padding: 12px; margin: 8px 0; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #ffc107; cursor: pointer;" onclick="Patients.showDetail(${p.id})">
                    <h4 style="margin: 0; color: #80deea;">${p.name || 'ไม่ระบุ'}</h4>
                    <p style="margin: 4px 0 0; font-size: 0.85rem; color: #ffc107;"><i class="fas fa-calendar-day"></i> นัดเยี่ยม: ${p.next_visit_date}</p>
                </div>
            `).join('');
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="text-align:center; color: #ff5252; padding: 2rem;">โหลดข้อมูลล้มเหลว</div>';
        }
    },
    
    async loadUpcomingVisits() {
        const container = document.getElementById('upcoming-visits-list');
        container.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        
        try {
            const visits = await API.get('/visits/upcoming');
            
            if (!visits || visits.length === 0) {
                container.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;"><i class="fas fa-calendar-alt" style="font-size: 2rem; color: #00bcd4; margin-bottom: 10px; display: block;"></i>ไม่มีนัดเยี่ยมใน 7 วันข้างหน้า / No upcoming visits</div>';
                return;
            }
            
            container.innerHTML = visits.map(p => {
                const daysLeft = Math.ceil((new Date(p.next_visit_date) - new Date()) / (1000 * 60 * 60 * 24));
                const urgencyColor = daysLeft <= 1 ? '#ff5252' : daysLeft <= 3 ? '#ffc107' : '#00e676';
                return `
                    <div style="padding: 12px; margin: 8px 0; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid ${urgencyColor}; cursor: pointer;" onclick="Patients.showDetail(${p.id})">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0; color: #80deea;">${p.name || 'ไม่ระบุ'}</h4>
                            <span style="font-size: 0.8rem; color: ${urgencyColor}; font-weight: 600;">อีก ${daysLeft} วัน</span>
                        </div>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);"><i class="fas fa-calendar-alt"></i> ${p.next_visit_date}</p>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="text-align:center; color: #ff5252; padding: 2rem;">โหลดข้อมูลล้มเหลว</div>';
        }
    },
    
    showPanel(panelId) {
        this.closeAllPanels();
        document.getElementById(panelId).classList.add('open');
    },
    
    closeAllPanels() {
        document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('open'));
    },
    
    setupInactivityTimer() {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        const resetTimer = () => this.resetInactivityTimer();
        events.forEach(event => document.addEventListener(event, resetTimer));
        this.resetInactivityTimer();
        
        document.getElementById('stay-logged-in').addEventListener('click', () => {
            this.resetInactivityTimer();
            this.closeModal('inactivity-modal');
        });
        
        document.getElementById('logout-now').addEventListener('click', () => {
            this.closeModal('inactivity-modal');
            Auth.logout();
        });
    },
    
    resetInactivityTimer() {
        if (!Auth.currentUser || Auth.currentUser.status !== 'approved') return;
        
        clearTimeout(this.inactivityTimer);
        clearInterval(this.countdownInterval);
        
        this.inactivityTimer = setTimeout(() => {
            this.showInactivityWarning();
        }, this.INACTIVITY_LIMIT);
    },
    
    showInactivityWarning() {
        this.showModal('inactivity-modal');
        let seconds = 300; // 5 mins
        const timerEl = document.getElementById('countdown-timer');
        timerEl.textContent = seconds;
        
        this.countdownInterval = setInterval(() => {
            seconds--;
            timerEl.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(this.countdownInterval);
                this.closeModal('inactivity-modal');
                Auth.logout();
            }
        }, 1000);
    },
    
    showModal(modalId) { document.getElementById(modalId).classList.add('active'); },
    closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); },
    
    setupModalClose() {
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
    },
    
    setupPanelClose() {
        document.querySelectorAll('.close-panel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.content-panel').classList.remove('open');
            });
        });
    },
    
    updateUserInfo() {
        const user = Auth.currentUser;
        if (!user) return;
        document.getElementById('user-name').textContent = user.full_name;
        
        // Generate initials avatar locally (no external URL needed)
        const initials = user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        document.getElementById('sidebar-user-details').innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #1a73e8, #00bcd4); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 1.3rem; font-weight: 700; color: white;">${initials}</div>
                <h3 style="color: #fff; margin: 5px 0; font-size: 1.05rem;">${user.full_name}</h3>
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.82rem;">
                    <span style="background: rgba(26,115,232,0.2); color: #64b5f6; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${user.role === 'admin' ? '👑 Admin' : '🩺 Doctor'}</span>
                </p>
            </div>
        `;
        
        const adminItem = document.getElementById('admin-menu-item');
        if (adminItem) {
            adminItem.style.display = user.role === 'admin' ? 'block' : 'none';
        }
    }
};

const Toast = {
    show(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
        toast.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${message}</span>`;
        container.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
