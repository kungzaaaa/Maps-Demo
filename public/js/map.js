const MapView = {
    map: null,
    markers: {},
    markerLayer: null,
    
    markerLayer: null,
    
    baseMaps: null,
    currentLayer: null,
    
    init() {
        if (this.map) return;
        
        this.map = L.map('map', { zoomControl: false }).setView([13.7563, 100.5018], 10);
        
        this.baseMaps = {
            "แผนที่ปกติ (Light)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
            "แผนที่ปกติ (Dark)": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
            "ดาวเทียม (Google Maps)": L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google' })
        };
        
        L.control.layers(this.baseMaps, null, { position: 'topright' }).addTo(this.map);
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.setTheme(isDark ? 'dark' : 'light');
        
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        
        this.markerLayer = L.layerGroup().addTo(this.map);
        
        setTimeout(() => this.map.invalidateSize(), 500);
    },
    
    setTheme(theme) {
        if (!this.baseMaps) return;
        
        const isSatellite = this.map.hasLayer(this.baseMaps["ดาวเทียม (Google Maps)"]);
        if (isSatellite) return; // Don't change if user selected satellite

        this.map.removeLayer(this.baseMaps["แผนที่ปกติ (Light)"]);
        this.map.removeLayer(this.baseMaps["แผนที่ปกติ (Dark)"]);
        
        if (theme === 'dark') {
            this.baseMaps["แผนที่ปกติ (Dark)"].addTo(this.map);
        } else {
            this.baseMaps["แผนที่ปกติ (Light)"].addTo(this.map);
        }
    },
    
    async loadPatients() {
        try {
            const patients = await API.get('/patients');
            Patients.list = patients;
            this.markerLayer.clearLayers();
            this.markers = {};
            
            patients.forEach(p => {
                // Backend returns latitude/longitude
                const lat = p.latitude;
                const lng = p.longitude;
                if (lat && lng) {
                    const icon = this.createMarkerIcon(p.status);
                    const marker = L.marker([lat, lng], { icon }).bindPopup(this.createPopupContent(p));
                    marker.addTo(this.markerLayer);
                    this.markers[p.id] = marker;
                }
            });
            
            this.fitAllMarkers();
        } catch (e) {
            console.error(e);
            Toast.show('โหลดข้อมูลผู้ป่วยล้มเหลว / Failed to load patients', 'error');
        }
    },
    
    createMarkerIcon(status) {
        const cls = `custom-marker ${status}`;
        let html = `<div class="pin-body"></div>`;
        if (status === 'critical') {
            html += `<div class="pulse-ring"></div>`;
        }
        
        return L.divIcon({
            className: 'div-icon-custom',
            html: `<div class="${cls}">${html}</div>`,
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40]
        });
    },
    
    createPopupContent(patient) {
        const statusColors = { active: '#00e676', critical: '#ff5252', inactive: '#90a4ae' };
        const statusLabels = { active: 'Active - ดูแลต่อเนื่อง', critical: 'Critical - วิกฤต', inactive: 'Inactive - หยุดดูแล' };
        const nextVisit = patient.next_visit_date ? `<p style="margin:3px 0; font-size: 12px; color: #666;"><i class="fas fa-calendar"></i> นัดเยี่ยม: ${patient.next_visit_date}</p>` : '';
        
        return `
            <div style="font-family: 'Noto Sans Thai', 'Inter', sans-serif; min-width: 220px;">
                <h4 style="margin:0 0 5px 0; color: #333; font-size: 14px;">${patient.name || 'ไม่ระบุชื่อ'}</h4>
                <p style="margin:0 0 3px 0; font-size: 12px; color: #666;">
                    สถานะ: <span style="color: ${statusColors[patient.status]}; font-weight:bold;">${statusLabels[patient.status] || patient.status}</span>
                </p>
                ${patient.phone ? `<p style="margin:3px 0; font-size: 12px; color: #666;"><i class="fas fa-phone"></i> ${patient.phone}</p>` : ''}
                ${nextVisit}
                <div style="margin-top: 10px; display: flex; gap: 5px;">
                    <button onclick="Patients.showDetail(${patient.id})" style="flex:1; padding: 6px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: inherit;">
                        <i class="fas fa-info-circle"></i> รายละเอียด
                    </button>
                    <button onclick="MapView.navigateToPatient(${patient.latitude}, ${patient.longitude})" style="flex:1; padding: 6px; background: #00bcd4; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: inherit;">
                        <i class="fas fa-directions"></i> นำทาง
                    </button>
                </div>
            </div>
        `;
    },
    
    navigateToPatient(lat, lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    },
    
    flyToPatient(lat, lng) {
        App.closeAllPanels();
        App.closeSidebar();
        this.map.flyTo([lat, lng], 16, { duration: 1.5 });
        setTimeout(() => {
            for (let id in this.markers) {
                const m = this.markers[id];
                const pos = m.getLatLng();
                if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
                    m.openPopup();
                    break;
                }
            }
        }, 1600);
    },
    
    fitAllMarkers() {
        const markerList = Object.values(this.markers);
        if (markerList.length > 0) {
            const group = new L.featureGroup(markerList);
            this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
        }
    }
};
