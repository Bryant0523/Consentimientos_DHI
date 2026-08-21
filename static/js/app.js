/* ════════════════════════════════════════════════
   Overtrack — Consentimientos Médicos
   Frontend logic v2.6
   ════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────
const state = {
  medicos:    [],
  enfermeros: [],
  pacientes:  [],
  plantillas: {},
  plantillasList: [],
  historial:  [],
  config:     {},
  pacienteActivo: null,
};

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(document.documentElement.dataset.theme === 'dark');
  setupCombos();
  setupPatientSearch();
  setupSummaryUpdates();
  setupFieldErrorClearing(); // ← agregado
  await cargarCategorias();
  initFecha();
  await loadAll();
});

async function loadAll() {
  try {
    const [med, enf, pac, cfg] = await Promise.all([
      api('/api/medicos'),
      api('/api/enfermeros'),
      api('/api/pacientes'),
      api('/api/config'),
    ]);
    state.medicos    = med;
    state.enfermeros = enf;
    state.pacientes  = pac;
    state.config     = cfg;
    applyTheme(cfg.appearance === 'dark');

    document.getElementById('outputFolder').value        = cfg.output_folder || '';
    document.getElementById('hospitalName').value        = cfg.hospital_name || '';
    document.getElementById('settingExportPdf').checked  = cfg.export_pdf  !== false;
    document.getElementById('settingExportDocx').checked = cfg.export_docx !== false;
    document.getElementById('retentionDays').value        = cfg.retention_days ?? 30; // ← agregado

    updateSummary();
    renderPersonal();

    try {
      const pdfStatus = await api('/api/pdf-status');
      if (!pdfStatus.can_convert) {
        toast('⚠ Sin conversor PDF', 'Instala LibreOffice para exportar PDF con el diseño de la plantilla', 'warn');
      }
    } catch(e) { /* no crítico */ }

    checkForUpdates();

  } catch(e) {
    console.error('loadAll error:', e);
    toast('Error de carga', e.message, 'error');
  }
}

async function cerrarAplicacion() {
  if (!confirm('¿Desea cerrar el sistema?')) return;
  try {
    const r = await fetch('/api/salir', { method: 'POST' });
    const data = await r.json();
    if (data.ok) window.close();
  } catch(e) { console.error(e); }
}

// ─── API helper ──────────────────────────────────
async function api(url, method = 'GET', body = null) {
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
    const titles = { inicio: 'Nuevo Consentimiento', personal: 'Personal Médico', historial: 'Historial', ajustes: 'Configuración', plantillas: 'Plantillas' };
  document.getElementById('pageTitle').textContent = titles[tab] || '';
  if (tab === 'historial')  loadHistorial();
  if (tab === 'personal')   renderPersonal();
  if (tab === 'plantillas') loadPlantillasList();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Categorías y plantillas ──────────────────────
async function cargarCategorias() {
  try {
    const response = await fetch('/api/plantillas');
    if (!response.ok) throw new Error('No se pudieron cargar las plantillas');
    const plantillasPorCategoria = await response.json();
    state.plantillas = plantillasPorCategoria;

    const categoriaSelect = document.getElementById('categoriaSelect');
    const plantillaSelect = document.getElementById('plantillaSelect');

    categoriaSelect.innerHTML = '<option value="">Seleccione una categoría</option>';
    plantillaSelect.innerHTML = '<option value="">Seleccione una plantilla</option>';

    const categorias = Object.keys(plantillasPorCategoria).sort();
    if (categorias.length === 0) {
      toast('Sin plantillas', 'No hay archivos .docx en la carpeta app_templates', 'info');
    }

    categorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria;
      option.textContent = categoria;
      categoriaSelect.appendChild(option);
    });

    categoriaSelect.addEventListener('change', function () {
      const categoria = this.value;
      plantillaSelect.innerHTML = '<option value="">Seleccione una plantilla</option>';
      if (!categoria) return;
      const plantillas = plantillasPorCategoria[categoria] || [];
      plantillas.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        plantillaSelect.appendChild(option);
      });
      updateSummary();
    });

    plantillaSelect.addEventListener('change', updateSummary);

  } catch (error) {
    console.error('Error cargando categorías:', error);
    toast('Error', 'No se pudieron cargar las categorías', 'error');
  }
}

// ─── Autocomplete combos (médico / enfermero) ─────
function getComboItems(type) {
  if (type === 'med') return state.medicos;
  if (type === 'enf') return state.enfermeros;
  return [];
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

  const allDrops = [
    { input: 'medicoInput',    drop: 'medicoDropdown' },
    { input: 'enfermeroInput', drop: 'enfermeroDropdown' },
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

// ─── Búsqueda de pacientes en el formulario principal ──────────────────────
function setupPatientSearch() {
  const searchInput = document.getElementById('pacienteSearch');
  const searchDrop  = document.getElementById('pacienteSearchDropdown');

  if (!searchInput || !searchDrop) return;

  const debouncedSearch = debounce(async () => {
    if (state.pacienteActivo) return;
    const q = searchInput.value.trim();
    if (!q) { searchDrop.classList.add('hidden'); return; }
    try {
      const items = await api(`/api/pacientes/search?q=${encodeURIComponent(q)}`);
      renderPatientDrop(searchDrop, items, searchInput);
    } catch(e) { console.error(e); }
  }, 250);

  searchInput.addEventListener('input', () => {
    if (state.pacienteActivo) {
      clearPaciente(true);
    }
    debouncedSearch();
  });
  searchInput.addEventListener('focus', () => {
    debouncedSearch();
  });

  // Update summary while typing (before selection)
  searchInput.addEventListener('input', updateSummary);

  let mouseOnSearchDrop = false;
  searchDrop.addEventListener('mousedown', () => mouseOnSearchDrop = true);
  searchDrop.addEventListener('mouseup', () => mouseOnSearchDrop = false);
  searchInput.addEventListener('blur', () => { if (!mouseOnSearchDrop) setTimeout(() => searchDrop.classList.add('hidden'), 120); });
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchDrop.contains(e.target)) searchDrop.classList.add('hidden');
  });
}

function renderPatientDrop(drop, items, anchorInput) {
  drop.innerHTML = '';
  if (!items || !items.length) { drop.classList.add('hidden'); return; }

  const rect = anchorInput.getBoundingClientRect();
  drop.style.top   = (rect.bottom + 4) + 'px';
  drop.style.left  = rect.left + 'px';
  drop.style.width = rect.width + 'px';

  items.forEach(p => {
    const esMenor = p.es_menor === true || p.es_menor === 1 || p.es_menor === '1';
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    const badge = esMenor
      ? `<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;
                       padding:2px 8px;border-radius:999px;white-space:nowrap;">👶 Menor de edad</span>`
      : '';
    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <div>${escHtml(p.nombre)}</div>
          <div class="item-sub">${escHtml(p.cedula)}</div>
        </div>
        ${badge}
      </div>`;
    div.addEventListener('mousedown', e => {
      e.preventDefault();
      selectPaciente(p);
      drop.classList.add('hidden');
    });
    drop.appendChild(div);
  });
  drop.classList.remove('hidden');
}

// ─── Seleccionar / limpiar paciente activo ────────
function selectPaciente(p) {
  if (!p) return;
  state.pacienteActivo = p;

  const chip = document.getElementById('pacienteChip');
  chip.classList.remove('hidden');
  chip.style.display = 'flex'; // ← forzado, por si .hidden no existe en el CSS
  document.getElementById('chipNombre').textContent = p.nombre || '—';
  document.getElementById('chipCedula').textContent = p.cedula || '—';

  const esMenor = p.es_menor === true || p.es_menor === 1 || p.es_menor === '1';
  const menorBadge = document.getElementById('chipMenorBadge');
  menorBadge.style.display = esMenor ? 'inline-flex' : 'none'; // ← forzado

  const si = document.getElementById('pacienteSearch');
  if (si) si.value = p.nombre || '';
  document.getElementById('pacienteSearchDropdown').classList.add('hidden');

  document.getElementById('pacienteSelectedId').value = p.id || '';
  document.getElementById('pacienteEsMenor').value    = p.es_menor ? '1' : '0';

  updateSummary();
}

function clearPaciente(preserveInput = false) {
  state.pacienteActivo = null;
  const chip = document.getElementById('pacienteChip');
  chip.classList.add('hidden');
  chip.style.display = 'none'; // ← forzado
  document.getElementById('chipMenorBadge').style.display = 'none'; // ← forzado

  const si = document.getElementById('pacienteSearch');
  if (si && !preserveInput) si.value = '';
  document.getElementById('pacienteSelectedId').value = '';
  document.getElementById('pacienteEsMenor').value    = '';

  updateSummary();
  if (!preserveInput) si?.focus();
}

// ─── Modal Crear Paciente ─────────────────────────
function openPatientModal(patientId = null) {
  ['pmId','pmNombre','pmCedula','pmLugar','pmFirmaFilename',
   'pmAcudienteNombre','pmAcudienteCedula','pmAcudienteParentesco','pmAcudienteLugar','pmAcudienteFirmaFilename'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  ['pmFirmaPreview','pmAcudienteFirmaPreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.src = ''; }
  });
  ['pmFirmaPlaceholder','pmAcudienteFirmaPlaceholder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  document.getElementById('pmEsMenor').checked = false;
  setPatientModalMinorMode(false);

  if (patientId) {
    const paciente = state.pacientes.find(p => p.id === patientId);
    if (paciente) {
      document.getElementById('pmId').value = paciente.id;
      document.getElementById('pmNombre').value = paciente.nombre || '';
      document.getElementById('pmCedula').value = paciente.cedula || '';
      document.getElementById('pmLugar').value = paciente.lugar_expedicion || '';
      document.getElementById('pmFirmaFilename').value = paciente.firma || '';
      if (paciente.firma) {
        const img = document.getElementById('pmFirmaPreview');
        img.src = `/api/firma-img/${encodeURIComponent(paciente.firma)}`;
        img.classList.remove('hidden');
        document.getElementById('pmFirmaPlaceholder').style.display = 'none';
      }
      const esMenor = paciente.es_menor === true || paciente.es_menor === 1 || paciente.es_menor === '1';
      if (esMenor) {
        document.getElementById('pmEsMenor').checked = true;
        setPatientModalMinorMode(true);
        if (paciente.acudiente) {
          document.getElementById('pmAcudienteNombre').value = paciente.acudiente.nombre || '';
          document.getElementById('pmAcudienteCedula').value = paciente.acudiente.cedula || '';
          document.getElementById('pmAcudienteParentesco').value = paciente.acudiente.parentesco || '';
          document.getElementById('pmAcudienteLugar').value = paciente.acudiente.lugar_expedicion || '';
          document.getElementById('pmAcudienteFirmaFilename').value = paciente.acudiente.firma || '';
          if (paciente.acudiente.firma) {
            const img = document.getElementById('pmAcudienteFirmaPreview');
            img.src = `/api/firma-img/${encodeURIComponent(paciente.acudiente.firma)}`;
            img.classList.remove('hidden');
            document.getElementById('pmAcudienteFirmaPlaceholder').style.display = 'none';
          }
        }
      }
    }
  }

  document.getElementById('patientModalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('pmNombre').focus(), 100);
}

function closePatientModal() {
  document.getElementById('patientModalOverlay').classList.add('hidden');
}

function setPatientModalMinorMode(on) {
  const minorSection = document.getElementById('pmMenorSection');
  const mainLabel    = document.getElementById('pmMainSectionLabel');
  const firmaLabel   = document.getElementById('pmFirmaLabel');
  const title        = document.getElementById('pmMenorToggleTitle');
  const sub          = document.getElementById('pmMenorToggleSub');
  const saveButton   = document.getElementById('pmSaveButton');
  const modal        = document.querySelector('#patientModalOverlay .modal');

  if (minorSection) minorSection.classList.toggle('collapsed', !on);
  if (mainLabel)  mainLabel.textContent  = on ? 'Datos del menor' : 'Datos del paciente';
  if (firmaLabel) firmaLabel.textContent = on ? 'Firma del menor (opcional)' : 'Firma del paciente';
  if (title) title.textContent = on ? 'Paciente menor de edad' : 'Paciente mayor de edad';
  if (sub)   sub.textContent   = on ? 'Completa los datos del acudiente' : 'Activa si el paciente es menor de edad';
  if (saveButton) saveButton.textContent = on ? '💾 Guardar menor y acudiente' : '💾 Crear y seleccionar';
  if (modal) modal.classList.toggle('modal-minor', on);
}

function togglePmMenor() {
  const on = document.getElementById('pmEsMenor').checked;
  setPatientModalMinorMode(on);
}

// ─── Validación visual ───────────────────────────
function clearFieldErrors() {
  document.querySelectorAll('.field-input.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

function clearFieldError(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.remove('field-error');
  const next = el.nextElementSibling;
  if (next && next.classList.contains('field-error-msg')) next.remove();
}

function showFieldError(inputId, msg) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.add('field-error');
  const errEl = document.createElement('div');
  errEl.className = 'field-error-msg';
  errEl.textContent = msg;
  el.insertAdjacentElement('afterend', errEl);
}

function setupFieldErrorClearing() {
  ['plantillaSelect', 'pacienteSearch', 'medicoInput', 'fechaInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => clearFieldError(id));
    el.addEventListener('change', () => clearFieldError(id));
  });
}
async function handlePmFirma(tipo, input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/api/upload-firma', { method: 'POST', body: fd });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    const cfg = {
      paciente:  { prev: 'pmFirmaPreview',          ph: 'pmFirmaPlaceholder',          fn: 'pmFirmaFilename' },
      acudiente: { prev: 'pmAcudienteFirmaPreview', ph: 'pmAcudienteFirmaPlaceholder', fn: 'pmAcudienteFirmaFilename' },
    };
    const { prev, ph, fn } = cfg[tipo];
    document.getElementById(fn).value = data.filename;
    const img = document.getElementById(prev);
    img.src = `/api/firma-img/${encodeURIComponent(data.filename)}`;
    img.classList.remove('hidden');
    document.getElementById(ph).style.display = 'none';
    toast('Firma cargada', `Firma de ${tipo} subida correctamente`, 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

async function savePatient() {
  const esMenor = document.getElementById('pmEsMenor').checked;
  const nombre  = document.getElementById('pmNombre').value.trim();
  const cedula  = document.getElementById('pmCedula').value.trim();
  const lugar   = document.getElementById('pmLugar').value.trim();
  const firma   = document.getElementById('pmFirmaFilename').value;

  if (!nombre || !cedula) {
    toast('Campos requeridos', 'Nombre y cédula son obligatorios', 'error');
    return;
  }

  if (esMenor) {
    const acNombre = document.getElementById('pmAcudienteNombre').value.trim();
    const acCedula = document.getElementById('pmAcudienteCedula').value.trim();
    if (!acNombre || !acCedula) {
      toast('Datos incompletos', 'El acudiente requiere nombre y cédula', 'error');
      return;
    }
  }

  const payload = {
    nombre,
    cedula,
    lugar_expedicion: lugar,
    firma,
    es_menor: esMenor,
  };

  if (esMenor) {
    payload.acudiente = {
      nombre:           document.getElementById('pmAcudienteNombre').value.trim(),
      cedula:           document.getElementById('pmAcudienteCedula').value.trim(),
      parentesco:       document.getElementById('pmAcudienteParentesco').value.trim(),
      lugar_expedicion: document.getElementById('pmAcudienteLugar').value.trim(),
      firma:            document.getElementById('pmAcudienteFirmaFilename').value,
    };
    // Mirror de los datos del menor para las plantillas .docx que usan campos separados
    // (menor_nombre, cedula_menor, etc.) — mismos valores que arriba, sin pedirlos dos veces
    payload.menor_nombre           = nombre;
    payload.menor_cedula           = cedula;
    payload.menor_lugar_expedicion = lugar;
    payload.menor_firma            = firma;
  }

  try {
    const pmId = document.getElementById('pmId').value;
    const method = pmId ? 'PUT' : 'POST';
    const url = pmId ? `/api/pacientes/${pmId}` : '/api/pacientes';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error al guardar paciente');

    const pac = data.paciente || {};
    selectPaciente(pac);
    await refreshPacientes();
    closePatientModal();
    toast('Paciente', data.exists ? 'Paciente ya existente — seleccionado' : (pmId ? 'Paciente actualizado' : 'Paciente creado y seleccionado'), 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}
// ─── Generar consentimiento ───────────────────────
async function generarConsentimiento() {
  const btn = document.getElementById('btnGenerar');
  clearFieldErrors();
  let hasError = false;

  const procedimiento = document.getElementById('plantillaSelect').value;
  if (!procedimiento) { showFieldError('plantillaSelect', 'Selecciona una plantilla'); hasError = true; }

  const pac        = state.pacienteActivo;
  const searchText = document.getElementById('pacienteSearch').value.trim();
  const nombre     = pac ? pac.nombre : searchText;
  const cedula     = pac ? pac.cedula : (/^[\d\s\-]+$/.test(searchText) ? searchText : '');

  if (!nombre) {
    showFieldError('pacienteSearch', 'Escribe o selecciona el nombre del paciente'); hasError = true;
  } else if (!cedula) {
    showFieldError('pacienteSearch', 'La cédula del paciente es obligatoria'); hasError = true;
  }

  const doctor = document.getElementById('medicoInput').value.trim();
  if (!doctor) { showFieldError('medicoInput', 'Selecciona el médico tratante'); hasError = true; }

  const fechaValue = document.getElementById('fechaInput')?.value;
  if (!fechaValue) { showFieldError('fechaInput', 'Selecciona la fecha del consentimiento'); hasError = true; }

  if (hasError) {
    toast('Campos requeridos', 'Revisa los campos marcados en rojo', 'error');
    document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  btn.classList.add('loading');
  btn.disabled = true;

  const payload = {
    procedimiento,
    paciente:                    nombre,
    cedula_paciente:             cedula,
    lugar_expedicion_paciente:   pac?.lugar_expedicion || 'Barranquilla',
    firma_paciente_file:         pac?.firma || '',
    doctor:                      document.getElementById('medicoInput').value.trim(),
    enfermero:                   document.getElementById('enfermeroInput').value.trim(),
    fecha:                       fechaValue,   // ← agregado, formato yyyy-mm-dd
    export_pdf:                  document.getElementById('exportPdf').checked,
    export_docx:                 document.getElementById('exportDocx').checked,
  };

  // Si el paciente activo es menor, adjuntar acudiente
  if (pac?.es_menor && pac?.acudiente) {
    payload.acudiente = pac.acudiente;
    // Datos del menor guardados en el paciente (campos extra del payload de creación)
    payload.menor_nombre              = pac.menor_nombre           || '';
    payload.menor_cedula              = pac.menor_cedula           || '';
    payload.lugar_expedicion_menor    = pac.menor_lugar_expedicion || '';
    payload.firma_menor_file          = pac.menor_firma            || '';
  }

  try {
    const result = await api('/api/generar', 'POST', payload);
    showResult(true, result.message, result.pdf || result.docx);
    toast('¡Listo!', result.message, 'success');
    loadStats();
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
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limpiarFormulario() {
  clearPaciente();

  ['medicoInput','enfermeroInput','medicoSelected','enfermeroSelected'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const catSel = document.getElementById('categoriaSelect');
  const pltSel = document.getElementById('plantillaSelect');
  if (catSel) catSel.selectedIndex = 0;
  if (pltSel) pltSel.innerHTML = '<option value="">Seleccione una plantilla</option>';

  initFecha(); // ← agregado, en vez de nada

  document.getElementById('resultCard').classList.add('hidden');
  updateSummary();
  toast('Formulario limpiado', '', 'info');
}

// ─── Summary ─────────────────────────────────────
function setupSummaryUpdates() {
  ['medicoInput', 'enfermeroInput'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateSummary);
  });
}

function initFecha() {
  const input = document.getElementById('fechaInput');
  if (!input) return;
  // Precarga con la fecha de hoy en formato yyyy-mm-dd (requerido por <input type="date">)
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  input.value = `${yyyy}-${mm}-${dd}`;

  input.addEventListener('change', updateSummary);
  updateFecha();
}

function updateFecha() {
  const input = document.getElementById('fechaInput');
  const el = document.getElementById('sumFecha');
  if (!el) return;

  if (input && input.value) {
    const [y, m, d] = input.value.split('-');
    el.textContent = `${d}/${m}/${y}`;
  } else {
    el.textContent = '—';
  }
}

function updateSummary() {
  const proc   = document.getElementById('plantillaSelect')?.value || '—';
  const pac    = state.pacienteActivo;
  const nombre = pac ? pac.nombre : (document.getElementById('pacienteSearch')?.value || '—');
  const cedula = pac ? pac.cedula : '—';
  const med    = document.getElementById('medicoInput')?.value    || '—';
  const enf    = document.getElementById('enfermeroInput')?.value || '—';

  const sp = document.getElementById('sumProc');   if (sp) sp.textContent = proc   || '—';
  const sc = document.getElementById('sumPac');    if (sc) sc.textContent = nombre || '—';
  const sk = document.getElementById('sumCedula'); if (sk) sk.textContent = cedula || '—';
  const sm = document.getElementById('sumMed');    if (sm) sm.textContent = med    || '—';
  const se = document.getElementById('sumEnf');    if (se) se.textContent = enf    || '—';

  updateFecha(); 

  // Mostrar fila acudiente si el paciente es menor
  const menorRow = document.getElementById('sumMenorRow');
  const sumAcud  = document.getElementById('sumAcudiente');
  if (pac?.es_menor && pac?.acudiente) {
    if (menorRow) menorRow.style.display = '';
    if (sumAcud)  sumAcud.textContent = pac.acudiente.nombre || '—';
  } else {
    if (menorRow) menorRow.style.display = 'none';
  }
}

// ─── Personal ────────────────────────────────────
function renderPersonal() {
  renderTable('medicosTbody',    state.medicos,    'medico');
  renderTable('enfermerosTbody', state.enfermeros, 'enfermero');
  renderPacientes();
}

function renderPacientes() {
  const tbody = document.getElementById('pacientesTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!state.pacientes.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">Sin pacientes registrados</td></tr>`;
    return;
  }
  state.pacientes.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(p.nombre)}</td>
      <td><code style="font-family:var(--mono);font-size:12px;color:var(--text2)">${escHtml(p.cedula)}</code></td>
      <td>${(p.es_menor === true || p.es_menor === 1 || p.es_menor === '1') ? '<span class="badge badge-info">Sí</span>' : 'No'}</td>
      <td><div class="table-actions">
        <button class="btn btn-sm btn-ghost btn-icon" onclick="openPatientModal(${p.id})" title="Editar">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deletePaciente(${p.id})" title="Eliminar">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

async function refreshPacientes() {
  try {
    state.pacientes = await api('/api/pacientes');
    renderPacientes();
  } catch(e) {
    toast('Error', 'No se pudo cargar la lista de pacientes', 'error');
  }
}

async function deletePaciente(id) {
  if (!confirm('¿Eliminar este paciente?')) return;
  try {
    await api(`/api/pacientes/${id}`, 'DELETE');
    await refreshPacientes();
    toast('Paciente eliminado', '', 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
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

async function handleModalFirma(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r    = await fetch('/api/upload-firma', { method: 'POST', body: fd });
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
    output_folder:  document.getElementById('outputFolder').value.trim(),
    hospital_name:  document.getElementById('hospitalName').value.trim(),
    export_pdf:     document.getElementById('settingExportPdf').checked,
    export_docx:    document.getElementById('settingExportDocx').checked,
    retention_days: parseInt(document.getElementById('retentionDays').value, 10) || 0, // ← agregado
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
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${escHtml(title)}</div>` : ''}
      ${msg   ? `<div class="toast-msg">${escHtml(msg)}</div>`     : ''}
    </div>`;
  document.getElementById('toastContainer').appendChild(div);
  setTimeout(() => {
    div.style.transition = 'all 0.3s ease';
    div.style.opacity    = '0';
    div.style.transform  = 'translateX(20px)';
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

const showToast = (msg, type) => toast(msg, '', type);

// ─── Combos helper ───────────────────────────────
function bindCombo(inputId, dropId, type, onSelect) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  if (!input || !drop) return;
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
  drop.addEventListener('mousedown', () => { isMouseDownOnDrop = true; });
  drop.addEventListener('mouseup',   () => { isMouseDownOnDrop = false; });
  input.addEventListener('blur', () => {
    if (!isMouseDownOnDrop) setTimeout(() => drop.classList.add('hidden'), 150);
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !drop.contains(e.target))
      drop.classList.add('hidden');
  });
}

function renderDrop(drop, items, onSelect, input) {
  drop.innerHTML = '';
  if (!items.length) { drop.classList.add('hidden'); return; }

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

// ─── Utils ───────────────────────────────────────
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closePatientModal(); }
  if (e.ctrlKey && e.key === 'Enter') {
    if (document.getElementById('tab-inicio').classList.contains('active')) generarConsentimiento();
  }
});

// ─── Actualizaciones ─────────────────────────────
let updatePollInterval = null;
let updateDismissed = false;

async function checkForUpdates() {
  try {
    const st = await api('/api/check-update');
    if (st.available && !updateDismissed) {
      document.getElementById('updateVersion').textContent = st.latest_version || '';
      document.getElementById('updateBanner').classList.remove('hidden');
    }
  } catch(e) {
    console.error('check-update error:', e);
  }
}

function dismissUpdateBanner() {
  updateDismissed = true;
  document.getElementById('updateBanner').classList.add('hidden');
}

async function handleUpdateClick() {
  const btn = document.getElementById('updateActionBtn');
  const sub = document.getElementById('updateSub');
  const progressWrap = document.getElementById('updateProgressWrap');

  btn.disabled = true;
  sub.textContent = 'Descargando actualización...';
  progressWrap.classList.remove('hidden');

  try {
    await api('/api/download-update', 'POST');
    updatePollInterval = setInterval(pollUpdateStatus, 800);
  } catch(e) {
    toast('Error al actualizar', e.message, 'error');
    btn.disabled = false;
  }
}

async function pollUpdateStatus() {
  try {
    const st = await api('/api/update-status');
    const fill = document.getElementById('updateProgressFill');
    const text = document.getElementById('updateProgressText');
    const sub  = document.getElementById('updateSub');
    const btn  = document.getElementById('updateActionBtn');

    if (fill) fill.style.width = `${st.progress || 0}%`;
    if (text) text.textContent = `${st.progress || 0}%`;

    if (st.error) {
      clearInterval(updatePollInterval);
      toast('Error al descargar', st.error, 'error');
      btn.disabled = false;
      sub.textContent = 'Haz clic para descargar e instalar';
      return;
    }

    if (!st.downloading && st.downloaded_path) {
      clearInterval(updatePollInterval);
      sub.textContent = 'Descarga completa';
      btn.textContent = 'Reiniciar e instalar';
      btn.disabled = false;
      btn.onclick = applyUpdate;
    }
  } catch(e) {
    console.error('poll update-status error:', e);
  }
}

async function applyUpdate() {
  if (!confirm('La aplicación se cerrará para instalar la actualización. ¿Continuar?')) return;
  try {
    await api('/api/apply-update', 'POST');
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif">Instalando actualización... puedes cerrar esta ventana.</div>';
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

// ─── Tema (claro/oscuro) ─────────────────────────
function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

  const moon = document.getElementById('themeIconMoon');
  const sun  = document.getElementById('themeIconSun');
  if (moon && sun) {
    moon.classList.toggle('hidden', isDark);
    sun.classList.toggle('hidden', !isDark);
  }

  const chk = document.getElementById('settingDarkMode');
  if (chk) chk.checked = isDark;
}

async function toggleTheme() {
  const isDark = document.documentElement.dataset.theme !== 'dark';
  applyTheme(isDark);
  try {
    await api('/api/config', 'POST', { appearance: isDark ? 'dark' : 'light' });
    state.config.appearance = isDark ? 'dark' : 'light';
  } catch(e) {
    toast('Error', 'No se pudo guardar el tema', 'error');
  }
}

async function limpiarAhora() {
  if (!confirm('¿Eliminar ahora los PDF/DOCX locales que superen los días de retención configurados?')) return;
  try {
    const r = await api('/api/limpiar-archivos', 'POST');
    toast('Limpieza completada', `${r.eliminados} archivo(s) eliminado(s)`, 'success');
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

async function loadStats() {
  try {
    const s = await api('/api/stats');
    document.getElementById('statHoy').textContent = s.hoy;
    document.getElementById('statMes').textContent = s.mes;
    const topEl = document.getElementById('statTopMedicos');
    if (s.top_medicos && s.top_medicos.length) {
      topEl.innerHTML = s.top_medicos.map(m =>
        `<div class="stat-top-item"><span>${escHtml(m.nombre)}</span><strong>${m.cantidad}</strong></div>`
      ).join('');
    } else {
      topEl.textContent = 'Sin datos este mes';
    }
  } catch(e) {
    console.error('loadStats error:', e);
  }
}

// ─── Import/Export Médicos y Enfermeros ─────────
function exportPersonal(tipo) {
  window.open(`/api/${tipo}s/export`, '_blank');
}

async function handleImportPersonal(tipo, input) {
  const file = input.files[0];
  if (!file) return;

  const label = tipo === 'medico' ? 'médicos' : 'enfermeros(as)';
  const reemplazar = confirm(
    `Vas a importar ${label} desde "${file.name}".\n\n` +
    `Aceptar = REEMPLAZAR toda la lista actual por la del CSV.\n` +
    `Cancelar = AGREGAR/ACTUALIZAR (mantiene los existentes, actualiza por cédula si coincide, agrega los nuevos).`
  );

  const fd = new FormData();
  fd.append('file', file);
  fd.append('modo', reemplazar ? 'reemplazar' : 'merge');

  try {
    const r = await fetch(`/api/${tipo}s/import`, { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error al importar');

    if (reemplazar) {
      toast('Importación completa', `Lista reemplazada: ${data.total} registro(s)`, 'success');
    } else {
      toast('Importación completa', `${data.agregados} agregado(s), ${data.actualizados} actualizado(s)`, 'success');
    }

    const [med, enf] = await Promise.all([api('/api/medicos'), api('/api/enfermeros')]);
    state.medicos = med; state.enfermeros = enf;
    renderPersonal();
  } catch(e) {
    toast('Error al importar', e.message, 'error');
  } finally {
    input.value = ''; // permite volver a subir el mismo archivo si hace falta
  }
}

// ─── Gestión de Plantillas ────────────────────────
async function loadPlantillasList() {
  try {
    state.plantillasList = await api('/api/plantillas/list');
    renderPlantillasTable();
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

function renderPlantillasTable() {
  const tbody = document.getElementById('plantillasTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!state.plantillasList || !state.plantillasList.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">Sin plantillas registradas</td></tr>`;
    return;
  }
  state.plantillasList.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(p.categoria)}</td>
      <td>${escHtml(p.nombre)}</td>
      <td><div class="table-actions">
        <button class="btn btn-sm btn-ghost btn-icon" onclick="openPlantillaModal(${idx})" title="Editar">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deletePlantilla(${idx})" title="Eliminar">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

async function populatePlantillaCategoriaDatalist() {
  try {
    const categorias = await api('/api/plantillas/categorias');
    const dl = document.getElementById('plmCategoriaList');
    if (dl) dl.innerHTML = categorias.map(c => `<option value="${escHtml(c)}">`).join('');
  } catch(e) { /* no crítico */ }
}

function openPlantillaModal(idx = null) {
  document.getElementById('plmModoOriginal').value = idx !== null ? 'editar' : 'crear';
  document.getElementById('plmCategoriaActual').value = '';
  document.getElementById('plmNombreActual').value = '';
  document.getElementById('plmCategoria').value = '';
  document.getElementById('plmNombre').value = '';
  document.getElementById('plmFile').value = '';

  const fileHint = document.getElementById('plmFileHint');

  populatePlantillaCategoriaDatalist();

  if (idx !== null) {
    const p = state.plantillasList[idx];
    document.getElementById('plantillaModalTitle').textContent = 'Editar Plantilla';
    document.getElementById('plmCategoriaActual').value = p.categoria;
    document.getElementById('plmNombreActual').value = p.nombre;
    document.getElementById('plmCategoria').value = p.categoria;
    document.getElementById('plmNombre').value = p.nombre;
    fileHint.textContent = 'Deja vacío para conservar el archivo actual, o sube uno nuevo para reemplazarlo';
  } else {
    document.getElementById('plantillaModalTitle').textContent = 'Agregar Plantilla';
    fileHint.textContent = 'Selecciona el archivo .docx de la plantilla';
  }

  document.getElementById('plantillaModalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('plmCategoria').focus(), 100);
}

function closePlantillaModal() {
  document.getElementById('plantillaModalOverlay').classList.add('hidden');
}

async function savePlantilla() {
  const modo      = document.getElementById('plmModoOriginal').value;
  const categoria = document.getElementById('plmCategoria').value.trim();
  const nombre    = document.getElementById('plmNombre').value.trim();
  const file      = document.getElementById('plmFile').files[0];

  if (!categoria || !nombre) {
    toast('Campos requeridos', 'Categoría y nombre son obligatorios', 'error');
    return;
  }
  if (modo === 'crear' && !file) {
    toast('Archivo requerido', 'Debes subir el archivo .docx de la plantilla', 'error');
    return;
  }

  const fd = new FormData();
  fd.append('modo', modo);
  fd.append('categoria', categoria);
  fd.append('nombre', nombre);
  if (modo === 'editar') {
    fd.append('categoria_actual', document.getElementById('plmCategoriaActual').value);
    fd.append('nombre_actual', document.getElementById('plmNombreActual').value);
  }
  if (file) fd.append('file', file);

  try {
    const r = await fetch('/api/plantillas/save', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error al guardar la plantilla');
    toast('Plantilla guardada', `${nombre} (${categoria})`, 'success');
    closePlantillaModal();
    await loadPlantillasList();
    await cargarCategorias(); // refresca los selects del formulario principal
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}

async function deletePlantilla(idx) {
  const p = state.plantillasList[idx];
  if (!confirm(`¿Eliminar la plantilla "${p.nombre}" de la categoría "${p.categoria}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api('/api/plantillas/delete', 'POST', { categoria: p.categoria, nombre: p.nombre });
    toast('Plantilla eliminada', '', 'success');
    await loadPlantillasList();
    await cargarCategorias();
  } catch(e) {
    toast('Error', e.message, 'error');
  }
}