(() => {
  'use strict';
  const DATA_URL = './alertas.json';
  const GEOJSON_URL = 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json';
  const COLORS = { 3: '#d83d47', 2: '#ef8d37', 1: '#e3c34d', 0: '#c7d0de' };
  const $ = (id) => document.getElementById(id);
  let alerts = [];
  let map;
  let geojsonLayer;
  let selectedAlertId = null;
  let selectedState = null;
  let toastTimer;
  let geoFeatures = [];

  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim();
  const canonicalState = (name) => {
    const key = normalize(name);
    const aliases = {
      'mexico': 'estado de mexico', 'estado de mexico': 'estado de mexico',
      'distrito federal': 'ciudad de mexico', 'cdmx': 'ciudad de mexico',
      'veracruz de ignacio de la llave': 'veracruz', 'coahuila de zaragoza': 'coahuila',
      'michoacan de ocampo': 'michoacan', 'queretaro de arteaga': 'queretaro',
      'san luis potosi': 'san luis potosi'
    };
    return aliases[key] || key;
  };
  const urgencyLabel = (level) => ({ 1: 'Nivel 1 · Baja', 2: 'Nivel 2 · Media', 3: 'Nivel 3 · Crítica' }[Number(level)] || 'Sin clasificación');
  const statusClass = (status) => normalize(status).replace(/\s+/g, '-');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const activeAlerts = (items = alerts) => items.filter((a) => a.estadoAtencion !== 'Atendido');
  const alertsForState = (name, items = alerts) => items.filter((a) => canonicalState(a.estado) === canonicalState(name));
  const activeForState = (name, items = alerts) => activeAlerts(items).filter((a) => canonicalState(a.estado) === canonicalState(name));
  const priorityForState = (name) => {
    const active = activeForState(name);
    return active.length ? Math.max(...active.map((a) => Number(a.urgencia) || 0)) : 0;
  };
  const urgencyClass = (level) => `urgency-${Number(level) || 0}`;

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2700);
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch (_) { return iso || 'No especificada'; }
  }

  function updateMetrics() {
    $('metricTotal').textContent = alerts.length;
    $('metricPending').textContent = alerts.filter(a => a.estadoAtencion === 'Pendiente').length;
    $('metricCritical').textContent = activeAlerts().filter(a => Number(a.urgencia) === 3).length;
    $('metricStates').textContent = new Set(alerts.map(a => canonicalState(a.estado))).size;
  }

  function filteredAlerts() {
    const query = normalize($('searchInput').value);
    const urgency = $('urgencyFilter').value;
    const status = $('statusFilter').value;
    return alerts.filter((a) => {
      const haystack = normalize([a.id, a.estado, a.municipio, a.zona, a.evento, (a.recursos || []).join(' '), a.estadoAtencion].join(' '));
      return (!query || haystack.includes(query)) && (urgency === 'all' || String(a.urgencia) === urgency) && (status === 'all' || a.estadoAtencion === status);
    }).sort((a, b) => Number(b.urgencia) - Number(a.urgencia) || new Date(b.fecha) - new Date(a.fecha));
  }

  function renderTable() {
    const visible = filteredAlerts();
    const tbody = $('alertsTableBody');
    $('tableCount').textContent = `${visible.length} ${visible.length === 1 ? 'registro' : 'registros'}`;
    $('tableSummary').textContent = visible.length === alerts.length ? 'Mostrando todos los registros de la DEMO' : `Mostrando ${visible.length} de ${alerts.length} registros`;
    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No hay alertas que coincidan con los filtros seleccionados.</td></tr>';
      return;
    }
    tbody.innerHTML = visible.map((a) => `
      <tr tabindex="0" role="button" aria-label="Consultar alerta ${escapeHtml(a.id)} de ${escapeHtml(a.estado)}" data-alert-id="${escapeHtml(a.id)}" class="${a.id === selectedAlertId ? 'selected-row' : ''}">
        <td><span class="id-text">${escapeHtml(a.id)}</span></td>
        <td><span class="locality-main">${escapeHtml(a.estado)}</span><span class="locality-sub">${escapeHtml(a.municipio)}</span></td>
        <td><span class="event-cell">${escapeHtml(a.evento)}</span></td>
        <td><span class="urgency-badge ${urgencyClass(a.urgencia)}">${escapeHtml(urgencyLabel(a.urgencia))}</span></td>
        <td><span class="resource-cell">${escapeHtml((a.recursos || []).slice(0, 2).join(', '))}${(a.recursos || []).length > 2 ? '…' : ''}</span></td>
        <td><span class="status-badge status-${statusClass(a.estadoAtencion)}">${escapeHtml(a.estadoAtencion)}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('tr[data-alert-id]').forEach((row) => {
      const activate = () => selectAlert(row.dataset.alertId, true);
      row.addEventListener('click', activate);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
    });
  }

  function renderAlertDetails(alert) {
    const content = $('detailContent');
    const level = Number(alert.urgencia);
    content.innerHTML = `
      <div class="detail-location-line">
        <div><h3 class="detail-state">${escapeHtml(alert.estado)}</h3><p class="detail-zone">${escapeHtml(alert.municipio)} · ${escapeHtml(alert.zona)}</p></div>
        <span class="detail-urgency level-${level}">${escapeHtml(urgencyLabel(level))}</span>
      </div>
      <div class="detail-event"><span class="event-icon">${level === 3 ? '!' : level === 2 ? '↗' : 'i'}</span><div><small>Tipo de incidente</small><strong>${escapeHtml(alert.evento)}</strong></div></div>
      <div class="detail-facts">
        <div class="detail-fact"><small>ID de reporte</small><strong>${escapeHtml(alert.id)}</strong></div>
        <div class="detail-fact"><small>Personas afectadas</small><strong>${Number(alert.afectados).toLocaleString('es-MX')}</strong></div>
        <div class="detail-fact"><small>Estado de atención</small><strong><span class="status-badge status-${statusClass(alert.estadoAtencion)}">${escapeHtml(alert.estadoAtencion)}</span></strong></div>
        <div class="detail-fact"><small>Fecha del reporte</small><strong>${escapeHtml(formatDate(alert.fecha))}</strong></div>
        <div class="detail-fact full"><small>Recursos solicitados</small><div class="resource-list">${(alert.recursos || []).map(r => `<span class="resource-chip">${escapeHtml(r)}</span>`).join('')}</div></div>
      </div>
      <div class="detail-observations"><h3>Estado y observaciones</h3><p>${escapeHtml(alert.observaciones || 'Sin observaciones para este registro simulado.')}</p></div>`;
  }

  function renderStateDetails(name) {
    const items = alertsForState(name);
    const active = activeForState(name);
    const priority = priorityForState(name);
    const content = $('detailContent');
    const priorityBadge = priority ? `<span class="detail-urgency level-${priority}">${escapeHtml(urgencyLabel(priority))}</span>` : '<span class="detail-urgency no-alert">Sin alerta activa</span>';
    content.innerHTML = `
      <div class="detail-location-line"><div><h3 class="detail-state">${escapeHtml(name)}</h3><p class="detail-zone">Entidad federativa seleccionada</p></div>${priorityBadge}</div>
      <div class="detail-event"><span class="event-icon">⌖</span><div><small>Resumen de la entidad</small><strong>${items.length} ${items.length === 1 ? 'reporte registrado' : 'reportes registrados'}</strong></div></div>
      <div class="detail-facts">
        <div class="detail-fact"><small>Alertas activas</small><strong>${active.length}</strong></div>
        <div class="detail-fact"><small>Personas afectadas*</small><strong>${active.reduce((sum, a) => sum + (Number(a.afectados) || 0), 0).toLocaleString('es-MX')}</strong></div>
        <div class="detail-fact"><small>En espera</small><strong>${active.filter(a => a.estadoAtencion === 'Pendiente').length}</strong></div>
        <div class="detail-fact"><small>En proceso</small><strong>${active.filter(a => a.estadoAtencion === 'En proceso').length}</strong></div>
        <div class="detail-fact full"><small>Incidentes reportados</small>${items.length ? `<div class="resource-list">${items.map(a => `<button class="resource-chip state-alert-link" type="button" data-alert-id="${escapeHtml(a.id)}">${escapeHtml(a.id)} · ${escapeHtml(a.evento)}</button>`).join('')}</div>` : '<strong>No hay reportes registrados en los datos de esta DEMO.</strong>'}</div>
      </div>
      <div class="detail-observations"><h3>Interpretación del mapa</h3><p>${active.length ? `El color del estado corresponde a ${urgencyLabel(priority)} entre sus alertas activas. Selecciona un reporte para consultar los recursos solicitados y las observaciones.` : 'Esta entidad no tiene alertas activas en los datos simulados. Los registros atendidos, si existen, permanecen disponibles en la tabla.'}</p></div>
      <p class="detail-zone" style="margin-top:12px">* Suma de afectados de alertas activas; cifra exclusivamente simulada.</p>`;
    content.querySelectorAll('[data-alert-id]').forEach(button => button.addEventListener('click', () => selectAlert(button.dataset.alertId, true)));
  }

  function setSelectedStateSummary(name) {
    $('selectedStateName').textContent = name || 'Ningún estado seleccionado';
    if (!name) { $('selectedStateMeta').textContent = 'Haz clic en una entidad federativa'; return; }
    const all = alertsForState(name);
    const active = activeForState(name);
    const priority = priorityForState(name);
    $('selectedStateMeta').textContent = `${active.length} alertas activas · ${priority ? urgencyLabel(priority) : 'Sin alertas activas'} · ${all.length} registros en total`;
  }

  function selectAlert(id, panToState) {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;
    selectedAlertId = id;
    selectedState = alert.estado;
    renderAlertDetails(alert);
    setSelectedStateSummary(alert.estado);
    renderTable();
    highlightSelectedState();
    if (panToState) {
      const feature = geoFeatures.find(f => canonicalState(f.properties?.name || '') === canonicalState(alert.estado));
      if (feature && map) {
        const layer = geojsonLayer?.getLayers().find(l => canonicalState(l.feature.properties?.name || '') === canonicalState(alert.estado));
        if (layer) {
          map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 6, animate: true });
          if (window.innerWidth < 850) $('mexicoMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  function selectState(name) {
    selectedState = name;
    selectedAlertId = null;
    renderStateDetails(name);
    setSelectedStateSummary(name);
    renderTable();
    highlightSelectedState();
  }

  function highlightSelectedState() {
    if (!geojsonLayer) return;
    geojsonLayer.eachLayer(layer => {
      const isSelected = selectedState && canonicalState(layer.feature.properties?.name || '') === canonicalState(selectedState);
      layer.setStyle(stateStyle(layer.feature, isSelected));
      if (isSelected && layer.bringToFront) layer.bringToFront();
    });
  }

  function stateStyle(feature, isSelected = false) {
    const name = feature?.properties?.name || '';
    const priority = priorityForState(name);
    return {
      fillColor: COLORS[priority] || COLORS[0],
      weight: isSelected ? 2.7 : 1,
      opacity: 1,
      color: isSelected ? '#07162f' : '#ffffff',
      dashArray: isSelected ? '' : '2 1',
      fillOpacity: priority === 3 ? 0.84 : priority === 2 ? 0.78 : priority === 1 ? 0.72 : 0.48
    };
  }

  function stateFeatureClick(feature) {
    const name = feature?.properties?.name;
    if (!name) return;
    selectState(name);
  }

  function buildMap(geojson) {
    if (!window.L) throw new Error('La biblioteca Leaflet no está disponible.');
    map = L.map('mexicoMap', { scrollWheelZoom: false, zoomControl: true, minZoom: 3, maxZoom: 8, attributionControl: true });
    // OpenStreetMap's public raster tile endpoint does not require a CARTO API key.
    // Keep attribution visible and do not prefetch tiles; follow the OSM tile usage policy.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);
    geoFeatures = geojson.features || [];
    geojsonLayer = L.geoJSON(geojson, {
      style: feature => stateStyle(feature, false),
      onEachFeature: (feature, layer) => {
        const name = feature?.properties?.name || 'Entidad federativa';
        layer.bindTooltip(() => {
          const active = activeForState(name);
          const priority = priorityForState(name);
          return `<strong>${escapeHtml(name)}</strong><br>${active.length} alerta(s) activa(s) · ${priority ? escapeHtml(urgencyLabel(priority)) : 'Sin alertas activas'}`;
        }, { sticky: true, direction: 'top', className: 'state-label' });
        layer.on({
          click: () => stateFeatureClick(feature),
          mouseover: () => { if (!selectedState || canonicalState(selectedState) !== canonicalState(name)) layer.setStyle({ weight: 2, color: '#41658e', fillOpacity: Math.min(.94, (stateStyle(feature).fillOpacity || .5) + .12) }); },
          mouseout: () => { if (geojsonLayer) layer.setStyle(stateStyle(feature, selectedState && canonicalState(selectedState) === canonicalState(name))); }
        });
        layer.on('add', () => { const path = layer.getElement?.(); if (path) { path.setAttribute('role', 'button'); path.setAttribute('tabindex', '0'); path.setAttribute('aria-label', `Seleccionar ${name}`); path.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); stateFeatureClick(feature); } }); } });
      }
    }).addTo(map);
    const bounds = geojsonLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
    $('mapLoading').classList.add('hidden');
    highlightSelectedState();
    setTimeout(() => map.invalidateSize(), 100);
  }

  async function loadData() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo leer ${DATA_URL} (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('El archivo de alertas no contiene una lista válida.');
    alerts = payload;
    updateMetrics();
    renderTable();
  }

  async function loadMap() {
    try {
      const response = await fetch(GEOJSON_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`GeoJSON no disponible (${response.status}).`);
      const geojson = await response.json();
      if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) throw new Error('El archivo geográfico no tiene el formato esperado.');
      buildMap(geojson);
    } catch (error) {
      console.error('Error al cargar el mapa:', error);
      $('mapLoading').classList.add('hidden');
      $('mapError').hidden = false;
    }
  }

  function exportCsv() {
    const rows = filteredAlerts();
    const headers = ['ID', 'Estado', 'Municipio', 'Zona', 'Evento', 'Urgencia', 'Afectados', 'Recursos solicitados', 'Estado de atención', 'Fecha', 'Observaciones'];
    const values = rows.map(a => [a.id, a.estado, a.municipio, a.zona, a.evento, urgencyLabel(a.urgencia), a.afectados, (a.recursos || []).join('; '), a.estadoAtencion, formatDate(a.fecha), a.observaciones]);
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...values].map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'LATIDO-alertas-simuladas.csv';
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    showToast(`Se exportaron ${rows.length} registros simulados.`);
  }

  function resetFilters() {
    $('searchInput').value = '';
    $('urgencyFilter').value = 'all';
    $('statusFilter').value = 'all';
    renderTable();
  }

  function bindEvents() {
    $('searchInput').addEventListener('input', renderTable);
    $('urgencyFilter').addEventListener('change', renderTable);
    $('statusFilter').addEventListener('change', renderTable);
    $('clearFilters').addEventListener('click', resetFilters);
    $('exportBtn').addEventListener('click', exportCsv);
    $('resetMap').addEventListener('click', () => {
      if (map && geojsonLayer) { map.fitBounds(geojsonLayer.getBounds(), { padding: [12, 12], animate: true }); showToast('Vista general de México.'); }
      selectedState = null; selectedAlertId = null;
      $('detailContent').innerHTML = '<div class="empty-detail"><span class="empty-detail-icon">◎</span><h3>Selecciona una alerta</h3><p>Elige un renglón de la tabla o una entidad del mapa para consultar sus detalles.</p></div>';
      setSelectedStateSummary(null); renderTable(); highlightSelectedState();
    });
    window.addEventListener('resize', () => { if (map) map.invalidateSize(); });
  }

  async function init() {
    bindEvents();
    try {
      await loadData();
    } catch (error) {
      console.error('Error al cargar las alertas de la DEMO:', error);
      $('alertsTableBody').innerHTML = '<tr><td colspan="6" class="empty-cell">No fue posible cargar los datos simulados. Verifica que el archivo data/alertas.json esté publicado junto con index.html.</td></tr>';
      $('tableCount').textContent = 'Sin datos';
      $('tableSummary').textContent = 'Error al leer los datos de ejemplo';
    }
    if (alerts.length) selectAlert(alerts[0].id, false);
    loadMap();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
