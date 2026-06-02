/* ════════════════════════════════════════════════
   Overtrack — Consentimientos Médicos
   Frontend logic
   ════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────
const state = {
  medicos: [],
  enfermeros: [],
  plantillas: [],
  historial: [],
  config: {},
  menorActivo: false
};

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupCombos();          // registra eventos (los items se leen en tiempo real desde state)
  setupSummaryUpdates();

  await cargarCategorias();

  updateFecha();
  setInterval(updateFecha, 60000);
  await loadAll();        // carga datos → state ya está listo cuando el usuario empiece a tipear
});

async function loadAll() {
  try {
    const [med, enf, plt, cfg] = await Promise.all([
      api('/api/medicos'),
      api('/api/enfermeros'),
      api('/api/plantillas'),
      api('/api/config')
    ]);
    state.medicos    = med;
    state.enfermeros = enf;
    state.plantillas = plt;
    state.config     = cfg;

    // Populate settings
    document.getElementById('outputFolder').value        = cfg.output_folder || '';
    document.getElementById('hospitalName').value        = cfg.hospital_name || '';
    document.getElementById('settingExportPdf').checked  = cfg.export_pdf  !== false;
    document.getElementById('settingExportDocx').checked = cfg.export_docx !== false;

    updateSummary();

    // Verificar estado de conversión PDF
    try {
      const pdfStatus = await api('/api/pdf-status');
      console.log('PDF status:', pdfStatus);
      if (pdfStatus.can_convert) {
        console.log('✓ Conversor PDF:', pdfStatus.recommendation);
      } else {
        toast('⚠ Sin conversor PDF', 'Instala LibreOffice para exportar PDF con el diseño de la plantilla', 'warn');
      }
    } catch(e) { /* no crítico */ }
    console.log(`Plantillas cargadas (${plt.length}):`, plt);
    if (plt.length === 0) {
      console.warn('No se encontraron plantillas en app_templates/');
      toast('Sin plantillas', 'No hay archivos .docx en la carpeta app_templates', 'info');
    }
  } catch(e) {
    console.error('loadAll error:', e);
    toast('Error de carga', e.message, 'error');
  }
}

// ─── API helper ──────────────────────────────────
async function api(url, method='GET', body=null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}

// ─── Tab navigation ──────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchTab(item.dataset.tab, item);
  });
});

function switchTab(tab, navEl) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  (navEl || document.querySelector(`[data-tab="${tab}"]`))?.classList.add('active');
  document.getElementById(`tab-${tab}`)?.classList.add('active');

  const titles = { inicio:'Nuevo Consentimiento', personal:'Personal Médico', historial:'Historial', ajustes:'Configuración' };
  document.getElementById('pageTitle').textContent = titles[tab] || '';

  if (tab === 'historial') loadHistorial();
  if (tab === 'personal')  renderPersonal();
}

// ─── Sidebar toggle ──────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Autocomplete ────────────────────────────────
// Los combos leen de state en tiempo real (no copias), así funcionan aunque los datos carguen tarde

function getComboItems(type) {
  if (type === 'proc')  return state.plantillas;   // string[]
  if (type === 'med')   return state.medicos;       // {nombre, cedula}[]
  if (type === 'enf')   return state.enfermeros;    // {nombre, cedula}[]
  return [];
}
let plantillasPorCategoria = {};

async function cargarCategorias() {
    try {

        const response = await fetch('/api/plantillas');

        if (!response.ok) {
            throw new Error('No se pudieron cargar las plantillas');
        }

        plantillasPorCategoria = await response.json();

        const categoriaSelect =
            document.getElementById('categoriaSelect');

        const plantillaSelect =
            document.getElementById('plantillaSelect');

        // Limpiar categorías
        categoriaSelect.innerHTML =
            '<option value="">Seleccione una categoría</option>';

        // Limpiar plantillas
        if (plantillaSelect) {
            plantillaSelect.innerHTML =
                '<option value="">Seleccione una plantilla</option>';
        }

        // Agregar categorías
        Object.keys(plantillasPorCategoria)
            .sort()
            .forEach(categoria => {

                const option =
                    document.createElement('option');

                option.value = categoria;
                option.textContent = categoria;

                categoriaSelect.appendChild(option);
            });

        // Cuando cambie la categoría
        categoriaSelect.addEventListener('change', function () {

            const categoria = this.value;

            plantillaSelect.innerHTML =
                '<option value="">Seleccione una plantilla</option>';

            if (!categoria) return;

            const plantillas =
                plantillasPorCategoria[categoria] || [];

            plantillas.forEach(nombre => {

                const option =
                    document.createElement('option');

                option.value = nombre;
                option.textContent = nombre;

                plantillaSelect.appendChild(option);
            });
        });

    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

function setupCombos() {
  
  bindCombo('medicoInput', 'medicoDropdown', 'med', item => {
    document.getElementById('medicoSelected').value = typeof item === 'string' ? item : item.nombre;
    updateSummary();
  });
  bindCombo('enfermeroInput', 'enfermeroDropdown', 'enf', item => {
    document.getElementById('enfermeroSelected').value = typeof item === 'string' ? item : item.nombre;
    updateSummary();
  });

  // Reposicionar dropdowns visibles al hacer scroll o resize
  const allDrops = [
    
    { input: 'medicoInput',        drop: 'medicoDropdown' },
    { input: 'enfermeroInput',     drop: 'enfermeroDropdown' },
  ];
  function repositionAll() {
    allDrops.forEach(({ input, drop }) => {
      const inp = document.getElementById(input);
      const drp = document.getElementById(drop);
      if (inp && drp && !drp.classList.contains('hidden')) {
        const rect = inp.getBoundingClientRect();
        drp.style.top   = (rect.bottom + 4) + 'px';
        drp.style.left  = rect.left + 'px';
        drp.style.width = rect.width + 'px';
      }
    });
  }
  document.querySelector('.main-content')?.addEventListener('scroll', repositionAll, true);
  window.addEventListener('resize', repositionAll);
}

function bindCombo(inputId, dropId, type, onSelect) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  let isMouseDownOnDrop = false;

  function show() {
    const q = input.value.toLowerCase().trim();
    const items = getComboItems(type);
    const filtered = items.filter(it => {
      const name = typeof it === 'string' ? it : it.nombre;
      return name.toLowerCase().includes(q);
    });
    renderDrop(drop, filtered, onSelect, input);
  }

  input.addEventListener('input', show);
  input.addEventListener('focus', show);

  // Evitar que el click en el dropdown cierre el dropdown antes de procesar la selección
  drop.addEventListener('mousedown', () => { isMouseDownOnDrop = true; });
  drop.addEventListener('mouseup',   () => { isMouseDownOnDrop = false; });

  input.addEventListener('blur', () => {
    if (!isMouseDownOnDrop) {
      setTimeout(() => drop.classList.add('hidden'), 150);
    }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !drop.contains(e.target))
      drop.classList.add('hidden');
  });
}

function renderDrop(drop, items, onSelect, input) {
  drop.innerHTML = '';
  if (!items.length) { drop.classList.add('hidden'); return; }

  // Posicionar con fixed relativo al input
  const rect = input.getBoundingClientRect();
  drop.style.top   = (rect.bottom + 4) + 'px';
  drop.style.left  = rect.left + 'px';
  drop.style.width = rect.width + 'px';

  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    if (typeof it === 'string') {
      div.textContent = it;
      div.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = it;
        onSelect(it);
        drop.classList.add('hidden');
      });
    } else {
      div.innerHTML = `${escHtml(it.nombre)}<div class="item-sub">${escHtml(it.cedula)}</div>`;
      div.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = it.nombre;
        onSelect(it);
        drop.classList.add('hidden');
      });
    }
    drop.appendChild(div);
  });
  drop.classList.remove('hidden');
}

function refreshCombos() {
  // Nada que hacer: los combos ya leen de state dinámicamente
}

// ─── Summary ─────────────────────────────────────
function setupSummaryUpdates() {
  ['plantillaSelect','medicoInput','enfermeroInput','pacienteNombre'].forEach(id => {
    document.getElementById('plantillaSelect')
    ?.addEventListener('change', updateSummary);
  });
}

function updateFecha() {
  const str = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  document.getElementById('sumFecha').textContent = str;
}

function updateSummary() {
  document.getElementById('sumProc').textContent = document.getElementById('plantillaSelect')?.value   || '—';
  document.getElementById('sumPac').textContent  = document.getElementById('pacienteNombre')?.value    || '—';
  document.getElementById('sumMed').textContent  = document.getElementById('medicoInput')?.value       || '—';
  document.getElementById('sumEnf').textContent  = document.getElementById('enfermeroInput')?.value    || '—';
}

// ─── Menor toggle ────────────────────────────────
function toggleMenor() {
  state.menorActivo = !state.menorActivo;
  document.getElementById('menorSection').classList.toggle('collapsed', !state.menorActivo);
  document.getElementById('menorToggle').classList.toggle('on', state.menorActivo);
}

// ─── Firma upload ────────────────────────────────
function triggerFirmaUpload(tipo) {
  const ids = { paciente:'firmaPacienteFile', menor:'firmaMenorFile', acudiente:'firmaAcudienteFile' };
  document.getElementById(ids[tipo])?.click();
}

async function handleFirmaUpload(tipo, input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r    = await fetch('/api/upload-firma', { method:'POST', body:fd });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    const cfg = {
      paciente:  { prev:'firmaPacientePreview',  ph:'firmaPacientePlaceholder',  fn:'firmaPacienteFilename' },
      menor:     { prev:'firmaMenorPreview',      ph:'firmaMenorPlaceholder',     fn:'firmaMenorFilename' },
      acudiente: { prev:'firmaAcudientePreview',  ph:'firmaAcudientePlaceholder', fn:'firmaAcudienteFilename' }
    };
    const { prev, ph, fn } = cfg[tipo];
    document.getElementById(fn).value = data.filename;
    const img = document.getElementById(prev);
    img.src = `/api/firma-img/${data.filename}`;
    img.classList.remove('hidden');
    document.getElementById(ph).style.display = 'none';
    toast('Firma cargada', `Firma de ${tipo} subida correctamente`, 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

async function handleModalFirma(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r    = await fetch('/api/upload-firma', { method:'POST', body:fd });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    document.getElementById('modalFirmaFilename').value = data.filename;
    const img = document.getElementById('modalFirmaPreview');
    img.src = `/api/firma-img/${data.filename}`;
    img.classList.remove('hidden');
    document.getElementById('modalFirmaPlaceholder').style.display = 'none';
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

// ─── Generar consentimiento ───────────────────────
async function generarConsentimiento() {
  const btn = document.getElementById('btnGenerar');

  const procedimiento = document.getElementById('plantillaSelect').value;
  if (!procedimiento) {
    showToast('Seleccione una plantilla', 'error');
    return;
}
  const paciente      = document.getElementById('pacienteNombre').value.trim();
  const cedula        = document.getElementById('pacienteCedula').value.trim();

  if (!procedimiento) { toast('Campo requerido', 'Selecciona un procedimiento', 'error'); return; }
  if (!paciente)      { toast('Campo requerido', 'Escribe el nombre del paciente', 'error'); return; }
  if (!cedula)        { toast('Campo requerido', 'Escribe la cédula del paciente', 'error'); return; }

  btn.classList.add('loading');
  btn.disabled = true;

  const payload = {
    procedimiento,
    paciente,
    cedula_paciente:             cedula,
    lugar_expedicion_paciente:   document.getElementById('pacienteLugar').value.trim() || 'Barranquilla',
    firma_paciente_file:         document.getElementById('firmaPacienteFilename').value,
    doctor:                      document.getElementById('medicoInput').value.trim(),
    enfermero:                   document.getElementById('enfermeroInput').value.trim(),
    export_pdf:                  document.getElementById('exportPdf').checked,
    export_docx:                 document.getElementById('exportDocx').checked,
  };

  if (state.menorActivo) {
    Object.assign(payload, {
      menor_nombre:                document.getElementById('menorNombre').value.trim(),
      cedula_menor:                document.getElementById('menorCedula').value.trim(),
      lugar_expedicion_menor:      document.getElementById('menorLugar').value.trim(),
      firma_menor_file:            document.getElementById('firmaMenorFilename').value,
      acudiente_nombre:            document.getElementById('acudienteNombre').value.trim(),
      cedula_acudiente:            document.getElementById('acudienteCedula').value.trim(),
      parentesco_acudiente:        document.getElementById('acudienteParentesco').value.trim(),
      lugar_expedicion_acudiente:  document.getElementById('acudienteLugar').value.trim(),
      firma_acudiente_file:        document.getElementById('firmaAcudienteFilename').value,
    });
  }

  try {
    const result = await api('/api/generar', 'POST', payload);
    showResult(true, result.message, result.pdf || result.docx);
    toast('¡Listo!', result.message, 'success');
    if (!result.pdf_ok && result.pdf_error) {
      toast('PDF no generado', result.pdf_error, 'warn');
    }
  } catch(e) {
    showResult(false, e.message, '');
    toast('Error al generar', e.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function showResult(ok, message, file) {
  const card = document.getElementById('resultCard');
  card.classList.remove('hidden');
  document.getElementById('resultIcon').className = `result-icon ${ok ? 'success' : 'error'}`;
  document.getElementById('resultIcon').textContent = ok ? '✓' : '✕';
  document.getElementById('resultMessage').textContent = message;
  document.getElementById('resultFiles').textContent   = file ? `📄 ${file}` : '';
  card.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function limpiarFormulario() {
  ['procedimientoInput','medicoInput','enfermeroInput','medicoSelected','enfermeroSelected',
   'pacienteNombre','pacienteCedula','pacienteLugar','firmaPacienteFilename',
   'menorNombre','menorCedula','menorLugar','firmaMenorFilename',
   'acudienteNombre','acudienteCedula','acudienteParentesco','acudienteLugar','firmaAcudienteFilename'
  ].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

  ['firmaPacientePreview','firmaMenorPreview','firmaAcudientePreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.src = ''; }
  });
  ['firmaPacientePlaceholder','firmaMenorPlaceholder','firmaAcudientePlaceholder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  if (state.menorActivo) toggleMenor();
  document.getElementById('resultCard').classList.add('hidden');
  updateSummary();
  toast('Formulario limpiado', '', 'info');
}

// ─── Personal ────────────────────────────────────
function renderPersonal() {
  renderTable('medicosTbody',    state.medicos,    'medico');
  renderTable('enfermerosTbody', state.enfermeros, 'enfermero');
}

function renderTable(tbodyId, rows, tipo) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">Sin registros — agrega el primero con "+ Agregar"</td></tr>`;
    return;
  }
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(row.nombre)}</td>
      <td><code style="font-family:var(--mono);font-size:12px;color:var(--text2)">${escHtml(row.cedula)}</code></td>
      <td>${row.firma
        ? `<img src="/api/firma-img/${encodeURIComponent(row.firma)}" class="firma-thumb" onerror="this.style.display='none'">`
        : '<span class="no-firma">Sin firma</span>'}</td>
      <td><div class="table-actions">
        <button class="btn btn-sm btn-ghost btn-icon" onclick="openModal('${tipo}',${idx})" title="Editar">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deletePersonal('${tipo}',${idx})" title="Eliminar">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function openModal(tipo, idx = null) {
  const label = tipo === 'medico' ? 'Médico' : 'Enfermero(a)';
  document.getElementById('modalTitle').textContent = idx !== null ? `Editar ${label}` : `Agregar ${label}`;
  document.getElementById('modalType').value  = tipo;
  document.getElementById('modalIndex').value = idx ?? '';
  document.getElementById('modalNombre').value = '';
  document.getElementById('modalCedula').value = '';
  document.getElementById('modalFirmaFilename').value = '';
  document.getElementById('modalFirmaPreview').classList.add('hidden');
  document.getElementById('modalFirmaPlaceholder').style.display = '';

  if (idx !== null) {
    const row = (tipo === 'medico' ? state.medicos : state.enfermeros)[idx];
    if (row) {
      document.getElementById('modalNombre').value = row.nombre;
      document.getElementById('modalCedula').value = row.cedula;
      if (row.firma) {
        document.getElementById('modalFirmaFilename').value = row.firma;
        const img = document.getElementById('modalFirmaPreview');
        img.src = `/api/firma-img/${encodeURIComponent(row.firma)}`;
        img.classList.remove('hidden');
        document.getElementById('modalFirmaPlaceholder').style.display = 'none';
      }
    }
  }
  document.getElementById('modalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modalNombre').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

async function savePersonal() {
  const tipo   = document.getElementById('modalType').value;
  const idx    = document.getElementById('modalIndex').value;
  const nombre = document.getElementById('modalNombre').value.trim();
  const cedula = document.getElementById('modalCedula').value.trim();
  const firma  = document.getElementById('modalFirmaFilename').value;

  if (!nombre || !cedula) { toast('Campos requeridos', 'Nombre y cédula son obligatorios', 'error'); return; }

  try {
    if (idx !== '') {
      await api(`/api/${tipo}s/${idx}`, 'PUT', { nombre, cedula, firma });
      toast('Actualizado', `${nombre} actualizado`, 'success');
    } else {
      await api(`/api/${tipo}s`, 'POST', { nombre, cedula, firma });
      toast('Agregado', `${nombre} agregado correctamente`, 'success');
    }
    const [med, enf] = await Promise.all([api('/api/medicos'), api('/api/enfermeros')]);
    state.medicos = med; state.enfermeros = enf;
    renderPersonal();
    closeModal();
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

async function deletePersonal(tipo, idx) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    await api(`/api/${tipo}s/${idx}`, 'DELETE');
    const [med, enf] = await Promise.all([api('/api/medicos'), api('/api/enfermeros')]);
    state.medicos = med; state.enfermeros = enf;
    renderPersonal();
    toast('Eliminado', 'Registro eliminado', 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

// ─── Historial ───────────────────────────────────
async function loadHistorial() {
  try {
    state.historial = await api('/api/historial');
    renderHistorial(state.historial);
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

function filterHistorial() {
  const q = document.getElementById('historialSearch').value.toLowerCase();
  renderHistorial(state.historial.filter(r =>
    (r.paciente||'').toLowerCase().includes(q) ||
    (r.procedimiento||'').toLowerCase().includes(q) ||
    (r.medico||'').toLowerCase().includes(q) ||
    (r.fecha||'').includes(q)
  ));
}

function renderHistorial(rows) {
  const tbody = document.getElementById('historialTbody');
  const empty = document.getElementById('historialEmpty');
  tbody.innerHTML = '';
  if (!rows.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  rows.forEach((row, idx) => {
    const hasPdf = row.archivo_pdf?.trim();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge badge-info">${escHtml(row.fecha||'')}</span></td>
      <td style="color:var(--text3);font-size:12px">${escHtml(row.hora||'')}</td>
      <td><strong>${escHtml(row.paciente||'')}</strong><br><small style="color:var(--text3)">${escHtml(row.documento||'')}</small></td>
      <td>${escHtml(row.procedimiento||'')}</td>
      <td>${escHtml(row.medico||'')}</td>
      <td>${escHtml(row.enfermero||'')}</td>
      <td>${hasPdf ? `<button class="btn btn-sm btn-ghost" onclick="abrirPdf(${idx})">📄 Ver</button>` : '<span class="no-firma">—</span>'}</td>
      <td><button class="btn btn-sm btn-danger btn-icon" onclick="deleteHistorial(${idx})" title="Eliminar">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

function abrirPdf(idx) { window.open(`/api/historial/abrir/${idx}`, '_blank'); }

async function deleteHistorial(idx) {
  if (!confirm('¿Eliminar este registro del historial?')) return;
  try {
    await api(`/api/historial/${idx}`, 'DELETE');
    state.historial = await api('/api/historial');
    renderHistorial(state.historial);
    toast('Eliminado', 'Registro eliminado del historial', 'success');
  } catch(e) { toast('Error', e.message, 'error'); }
}

async function clearHistorial() {
  if (!confirm('¿Vaciar todo el historial? Esta acción no se puede deshacer.')) return;
  try {
    await api('/api/historial/clear', 'POST');
    state.historial = [];
    renderHistorial([]);
    toast('Historial vaciado', '', 'success');
  } catch(e) { toast('Error', e.message, 'error'); }
}

function exportHistorial() { window.open('/api/historial/export', '_blank'); }

// ─── Settings ────────────────────────────────────
async function saveSettings() {
  const cfg = {
    output_folder: document.getElementById('outputFolder').value.trim(),
    hospital_name: document.getElementById('hospitalName').value.trim(),
    export_pdf:    document.getElementById('settingExportPdf').checked,
    export_docx:   document.getElementById('settingExportDocx').checked,
  };
  const pwd = document.getElementById('adminPassword').value.trim();
  if (pwd) cfg.admin_password = pwd;
  try {
    await api('/api/config', 'POST', cfg);
    Object.assign(state.config, cfg);
    toast('Configuración guardada', '', 'success');
  } catch(e) { toast('Error', e.message, 'error'); }
}

// ─── Toast ───────────────────────────────────────
function toast(title, msg, type = 'info') {
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `
    <div class="toast-icon">${icons[type]||'ℹ️'}</div>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${escHtml(title)}</div>` : ''}
      ${msg   ? `<div class="toast-msg">${escHtml(msg)}</div>`    : ''}
    </div>`;
  document.getElementById('toastContainer').appendChild(div);
  setTimeout(() => {
    div.style.transition = 'all 0.3s ease';
    div.style.opacity    = '0';
    div.style.transform  = 'translateX(20px)';
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

// ─── Utils ───────────────────────────────────────
function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.ctrlKey && e.key === 'Enter') {
    if (document.getElementById('tab-inicio').classList.contains('active')) generarConsentimiento();
  }
});