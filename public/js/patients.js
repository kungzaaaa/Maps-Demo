const Patients = {
    list: [],
    pickerMap: null,
    pickerMarker: null,
    
    init() {
        document.getElementById('add-patient-btn').addEventListener('click', () => this.showForm());
        document.getElementById('patient-form').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('patient-search').addEventListener('input', () => this.renderList());
        document.getElementById('patient-status-filter').addEventListener('change', () => this.renderList());
        
        // Visit form submission
        document.getElementById('visit-form').addEventListener('submit', (e) => this.handleVisitSubmit(e));
    },
    
    async loadList() {
        try {
            await MapView.loadPatients();
        } catch (e) {
            console.error(e);
        }
        this.renderList();
    },
    
    renderList() {
        const listEl = document.getElementById('patient-list');
        const searchTerm = document.getElementById('patient-search').value.toLowerCase();
        const statusFilter = document.getElementById('patient-status-filter').value;
        
        const filtered = this.list.filter(p => {
            const name = (p.name || '').toLowerCase();
            const matchSearch = name.includes(searchTerm) || (p.phone || '').includes(searchTerm);
            const matchStatus = statusFilter === '' || p.status === statusFilter;
            return matchSearch && matchStatus;
        });
        
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 2rem;">ไม่พบข้อมูล / No patients found</div>';
            return;
        }
        
        const statusColors = { active: '#00e676', critical: '#ff5252', inactive: '#90a4ae' };
        const statusLabels = { active: 'Active', critical: 'Critical', inactive: 'Inactive' };
        
        listEl.innerHTML = filtered.map(p => `
            <div class="patient-card" onclick="Patients.showDetail(${p.id})" style="padding: 15px; margin-bottom: 10px; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: all 0.3s;">
                <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                    <h3 style="margin: 0; font-size: 1rem; color: #80deea;">${p.name || 'ไม่ระบุ'}</h3>
                    <span style="padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; background: ${statusColors[p.status]}22; color: ${statusColors[p.status]}; border: 1px solid ${statusColors[p.status]}44;">${statusLabels[p.status] || p.status}</span>
                </div>
                ${p.address ? `<p style="font-size: 0.82rem; color: var(--text-secondary); margin: 6px 0;"><i class="fas fa-map-marker-alt"></i> ${p.address}</p>` : ''}
                ${p.next_visit_date ? `<p style="font-size: 0.82rem; color: #ffc107; margin: 4px 0;"><i class="fas fa-calendar-check"></i> นัดเยี่ยม: ${p.next_visit_date}</p>` : ''}
                <div style="display:flex; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.78rem;" onclick="event.stopPropagation(); MapView.flyToPatient(${p.latitude}, ${p.longitude})">
                        <i class="fas fa-crosshairs"></i> แผนที่
                    </button>
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 0.78rem;" onclick="event.stopPropagation(); MapView.navigateToPatient(${p.latitude}, ${p.longitude})">
                        <i class="fas fa-directions"></i> นำทาง
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    showForm(patient = null) {
        const form = document.getElementById('patient-form');
        form.reset();
        
        document.getElementById('patient-form-title').innerHTML = patient ? 
            '<i class="fas fa-user-edit"></i> แก้ไขผู้ป่วย / Edit Patient' : 
            '<i class="fas fa-user-plus"></i> เพิ่มผู้ป่วยใหม่ / Add Patient';
            
        if (patient) {
            const fields = ['name', 'id_card', 'address', 'phone', 'diseases', 'medications', 'allergies', 
                          'birth_date', 'gender', 'latitude', 'longitude', 'status', 'next_visit_date', 'notes', 'id'];
            fields.forEach(key => {
                const input = form.elements[key];
                if (input && patient[key] !== undefined && patient[key] !== null) {
                    input.value = patient[key];
                }
            });
        }
        
        App.showModal('patient-form-modal');
        
        // Delay to let modal render
        setTimeout(() => {
            this.initLocationPicker(
                patient ? patient.latitude : 13.7563, 
                patient ? patient.longitude : 100.5018
            );
        }, 300);
    },
    
    initLocationPicker(lat = 13.7563, lng = 100.5018) {
        if (this.pickerMap) {
            this.pickerMap.remove();
            this.pickerMap = null;
        }
        
        const mapContainer = document.getElementById('location-picker-map');
        if (!mapContainer) return;
        
        this.pickerMap = L.map(mapContainer).setView([lat, lng], 13);
        
        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: 'Google Maps'
        }).addTo(this.pickerMap);
        
        this.pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(this.pickerMap);
        
        const latInput = document.querySelector('input[name="latitude"]');
        const lngInput = document.querySelector('input[name="longitude"]');
        
        if (!latInput.value) {
            latInput.value = lat;
            lngInput.value = lng;
        }
        
        this.pickerMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            latInput.value = pos.lat.toFixed(6);
            lngInput.value = pos.lng.toFixed(6);
        });
        
        this.pickerMap.on('click', (e) => {
            this.pickerMarker.setLatLng(e.latlng);
            latInput.value = e.latlng.lat.toFixed(6);
            lngInput.value = e.latlng.lng.toFixed(6);
        });
        
        setTimeout(() => this.pickerMap.invalidateSize(), 300);
    },
    
    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
            btn.disabled = true;
            
            // Convert lat/lng to numbers and fallback if NaN
            data.latitude = parseFloat(data.latitude) || 13.7563;
            data.longitude = parseFloat(data.longitude) || 100.5018;
            
            if (data.id) {
                // Update existing patient
                await API.put(`/patients/${data.id}`, data);
                Toast.show('แก้ไขข้อมูลผู้ป่วยสำเร็จ / Patient updated', 'success');
            } else {
                // Create new patient
                delete data.id;
                await API.post('/patients', data);
                Toast.show('เพิ่มผู้ป่วยใหม่สำเร็จ / Patient added', 'success');
            }
            
            App.closeModal('patient-form-modal');
            await this.loadList();
        } catch (err) {
            Toast.show(err.message || 'บันทึกล้มเหลว / Save failed', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    async showDetail(patientId) {
        try {
            const patient = await API.get(`/patients/${patientId}`);
            let visits = [];
            try {
                visits = await API.get(`/visits/patient/${patientId}`);
            } catch (e) {
                console.warn('Could not load visits:', e);
            }
            
            document.getElementById('detail-patient-name').textContent = patient.name || 'ไม่ระบุ';
            
            const statusColors = { active: '#00e676', critical: '#ff5252', inactive: '#90a4ae' };
            const genderLabels = { male: 'ชาย / Male', female: 'หญิง / Female', other: 'อื่นๆ / Other' };
            
            const canEdit = Auth.currentUser && (Auth.currentUser.can_edit || Auth.currentUser.role === 'admin');
            const canDelete = Auth.currentUser && (Auth.currentUser.can_delete || Auth.currentUser.role === 'admin');
            
            let visitHistory = '';
            if (visits.length > 0) {
                visitHistory = visits.map(v => `
                    <div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid #00bcd4; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong style="color: #80deea;">${new Date(v.visit_date).toLocaleDateString('th-TH')} ${new Date(v.visit_date).toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'})}</strong>
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">${v.visit_type || 'routine'} | Dr. ${v.doctor_name || '-'}</span>
                        </div>
                        ${v.symptoms ? `<p style="margin: 3px 0; font-size: 0.85rem;"><strong>อาการ:</strong> ${v.symptoms}</p>` : ''}
                        ${v.diagnosis ? `<p style="margin: 3px 0; font-size: 0.85rem;"><strong>Diagnosis:</strong> ${v.diagnosis}</p>` : ''}
                        ${v.treatment ? `<p style="margin: 3px 0; font-size: 0.85rem;"><strong>Treatment:</strong> ${v.treatment}</p>` : ''}
                        ${v.vital_signs ? `<p style="margin: 3px 0; font-size: 0.85rem;"><strong>Vital Signs:</strong> ${v.vital_signs}</p>` : ''}
                        ${v.notes ? `<p style="margin: 3px 0; font-size: 0.85rem; color: var(--text-secondary);"><i class="fas fa-sticky-note"></i> ${v.notes}</p>` : ''}
                    </div>
                `).join('');
            } else {
                visitHistory = '<div style="text-align:center; color: var(--text-secondary); padding: 1rem;">ยังไม่มีประวัติการเยี่ยม</div>';
            }
            
            const content = `
                <div style="padding: 1.5rem;">
                    <div style="padding: 15px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 15px;">
                        <h3 style="color: #80deea; margin-bottom: 10px;"><i class="fas fa-id-card"></i> ข้อมูลส่วนตัว / Personal Info</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9rem;">
                            <p><strong>สถานะ:</strong> <span style="color: ${statusColors[patient.status]}">${patient.status}</span></p>
                            <p><strong>เพศ:</strong> ${genderLabels[patient.gender] || '-'}</p>
                            <p><strong>วันเกิด:</strong> ${patient.birth_date || '-'}</p>
                            <p><strong>เลขบัตร:</strong> ${patient.id_card || '-'}</p>
                            <p style="grid-column: 1/-1;"><strong>ที่อยู่:</strong> ${patient.address || '-'}</p>
                            <p><strong>โทรศัพท์:</strong> ${patient.phone || '-'}</p>
                            <p><strong>นัดเยี่ยม:</strong> ${patient.next_visit_date || '-'}</p>
                        </div>
                    </div>
                    
                    <div style="padding: 15px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 15px;">
                        <h3 style="color: #80deea; margin-bottom: 10px;"><i class="fas fa-heartbeat"></i> ข้อมูลทางการแพทย์ / Medical Info</h3>
                        <div style="font-size: 0.9rem;">
                            <p><strong>โรคประจำตัว / Diseases:</strong> ${patient.diseases || '-'}</p>
                            <p><strong>ยาที่ใช้ / Medications:</strong> ${patient.medications || '-'}</p>
                            <p><strong>ประวัติแพ้ยา / Allergies:</strong> ${patient.allergies || '-'}</p>
                            ${patient.notes ? `<p><strong>หมายเหตุ / Notes:</strong> ${patient.notes}</p>` : ''}
                        </div>
                    </div>
                    
                    <div style="padding: 15px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h3 style="color: #80deea; margin: 0;"><i class="fas fa-notes-medical"></i> ประวัติการเยี่ยม / Visit History</h3>
                            <button class="btn-primary" style="padding: 5px 12px; font-size: 0.8rem;" onclick="Patients.showVisitForm(${patient.id})">
                                <i class="fas fa-plus"></i> บันทึกการเยี่ยม
                            </button>
                        </div>
                        ${visitHistory}
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        ${canEdit ? `<button class="btn-primary" style="flex:1;" onclick="App.closeModal('patient-detail-modal'); Patients.editPatient(${patient.id})"><i class="fas fa-edit"></i> แก้ไข / Edit</button>` : ''}
                        <button class="btn-secondary" style="flex:1;" onclick="MapView.flyToPatient(${patient.latitude}, ${patient.longitude}); App.closeModal('patient-detail-modal')"><i class="fas fa-map-marker-alt"></i> ดูบนแผนที่</button>
                        <button class="btn-secondary" style="flex:1;" onclick="MapView.navigateToPatient(${patient.latitude}, ${patient.longitude})"><i class="fas fa-directions"></i> นำทาง</button>
                        ${canDelete ? `<button class="btn-danger" style="padding: 8px 12px;" onclick="Patients.deletePatient(${patient.id})"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            `;
            
            document.getElementById('patient-detail-content').innerHTML = content;
            App.showModal('patient-detail-modal');
        } catch (err) {
            Toast.show(err.message || 'โหลดข้อมูลล้มเหลว / Failed to load', 'error');
        }
    },
    
    async editPatient(id) {
        try {
            const patient = await API.get(`/patients/${id}`);
            this.showForm(patient);
        } catch (err) {
            Toast.show(err.message || 'โหลดข้อมูลล้มเหลว', 'error');
        }
    },
    
    showVisitForm(patientId) {
        const form = document.getElementById('visit-form');
        form.reset();
        form.elements['patient_id'].value = patientId;
        form.elements['id'].value = '';
        // Set default visit date to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        form.elements['visit_date'].value = now.toISOString().slice(0, 16);
        App.showModal('visit-form-modal');
    },
    
    async handleVisitSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
            btn.disabled = true;
            
            if (data.id) {
                await API.put(`/visits/${data.id}`, data);
            } else {
                delete data.id;
                await API.post('/visits', data);
            }
            
            Toast.show('บันทึกการเยี่ยมสำเร็จ / Visit recorded', 'success');
            App.closeModal('visit-form-modal');
            
            // Refresh patient detail if open
            if (data.patient_id) {
                await this.showDetail(parseInt(data.patient_id));
            }
            // Refresh map markers (next_visit_date may have changed)
            await MapView.loadPatients();
        } catch (err) {
            Toast.show(err.message || 'บันทึกล้มเหลว / Save failed', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    async deletePatient(id) {
        if (!confirm('คุณต้องการลบข้อมูลผู้ป่วยนี้หรือไม่?\nAre you sure you want to delete this patient?')) return;
        
        try {
            await API.delete(`/patients/${id}`);
            Toast.show('ลบข้อมูลผู้ป่วยสำเร็จ / Patient deleted', 'success');
            App.closeModal('patient-detail-modal');
            await this.loadList();
        } catch (err) {
            Toast.show(err.message || 'ลบล้มเหลว / Delete failed', 'error');
        }
    }
};
