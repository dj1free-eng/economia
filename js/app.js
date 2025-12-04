// js/app.js
(() => {
  'use strict';

  const STORAGE_KEY = 'ecoApp_v2_state';

  const monthNames = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  let state = {
    ingresosBase: { juan: 0, saray: 0, otros: 0 },
    fijos: [],              // {id, nombre, importe, categoria, endMonth? "YYYY-MM"}
    sobres: [],             // {id, nombre, presupuesto}
    huchas: [],             // {id, nombre, objetivo, saldo}
    ingresosPuntuales: [],  // {id, fecha, desc, importe}
    gastos: [],             // {id, fecha, categoria, desc, importe}
    notasPorMes: {}         // { 'YYYY-MM': 'texto' }
  };

  let currentYM = getYM(new Date());
  let fixedFilter = 'Todos';
  let fixedSelectedCategory = 'Suministros';

  // Modal edición
  let editContext = null;
  // Modal confirmación
  let confirmCallback = null;
  // Chart informe fijos
  let fixedChart = null;

  function getYM(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2,'0');
    return `${y}-${m}`;
  }

  function parseYM(ym) {
    const [y, m] = ym.split('-').map(Number);
    return { year: y, month: m };
  }

  function formatMoney(n) {
    if (isNaN(n)) n = 0;
    return n.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---- Estado / storage ----
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      state = Object.assign(state, data || {});

      // migración de fijos sin categoría (anteriores versiones)
      if (Array.isArray(state.fijos)) {
        state.fijos = state.fijos.map(f => ({
          ...f,
          categoria: f.categoria || 'Varios'
        }));
      }
    } catch (err) {
      console.error('Error al cargar estado:', err);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Error al guardar estado:', err);
    }
  }

  // ---- Modales ----
  function openConfirm(message, onConfirm) {
    const overlay = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    if (!overlay || !msgEl) return;
    msgEl.textContent = message;
    confirmCallback = onConfirm || null;
    overlay.classList.add('show');
  }

  function closeConfirm() {
    const overlay = document.getElementById('confirmModal');
    if (!overlay) return;
    overlay.classList.remove('show');
    confirmCallback = null;
  }

  function setupConfirmModalEvents() {
    const overlay = document.getElementById('confirmModal');
    const btnOk = document.getElementById('confirmOk');
    const btnCancel = document.getElementById('confirmCancel');
    const btnClose = document.getElementById('confirmClose');

    if (!overlay) return;

    const close = () => closeConfirm();

    btnOk?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirm();
    });
    btnCancel?.addEventListener('click', close);
    btnClose?.addEventListener('click', close);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  function openEditModal(tipo, item) {
    const overlay = document.getElementById('editModal');
    const titleEl = document.getElementById('editModalTitle');
    const nameEl = document.getElementById('editNombre');
    const impEl = document.getElementById('editImporte');
    const extraEl = document.getElementById('editExtra');
    const fechaEl = document.getElementById('editFecha');
    const fechaGroup = document.getElementById('editFechaGroup');
    const fechaLabel = document.getElementById('editFechaLabel');

    if (!overlay || !titleEl || !nameEl || !impEl || !extraEl || !fechaGroup || !fechaLabel) return;

    editContext = { tipo, item: { ...item } };

    switch (tipo) {
      case 'fijo':
        titleEl.textContent = 'Editar gasto fijo';
        nameEl.value = item.nombre || '';
        impEl.value = item.importe ?? 0;
        extraEl.value = item.categoria || '';
        fechaGroup.style.display = 'block';
        fechaLabel.textContent = 'Mes fin (YYYY-MM)';
        fechaEl.type = 'month';
        fechaEl.value = item.endMonth || '';
        break;
      case 'ingresoPuntual':
        titleEl.textContent = 'Editar ingreso puntual';
        nameEl.value = item.desc || '';
        impEl.value = item.importe ?? 0;
        extraEl.value = '';
        fechaGroup.style.display = 'block';
        fechaLabel.textContent = 'Fecha';
        fechaEl.type = 'date';
        fechaEl.value = item.fecha || '';
        break;
      case 'gasto':
        titleEl.textContent = 'Editar gasto variable';
        nameEl.value = item.desc || '';
        impEl.value = item.importe ?? 0;
        extraEl.value = item.categoria || '';
        fechaGroup.style.display = 'block';
        fechaLabel.textContent = 'Fecha';
        fechaEl.type = 'date';
        fechaEl.value = item.fecha || '';
        break;
      case 'sobre':
        titleEl.textContent = 'Editar sobre';
        nameEl.value = item.nombre || '';
        impEl.value = item.presupuesto ?? 0;
        extraEl.value = '';
        fechaGroup.style.display = 'none';
        break;
      case 'hucha':
        titleEl.textContent = 'Editar hucha';
        nameEl.value = item.nombre || '';
        impEl.value = item.objetivo ?? 0;
        extraEl.value = '';
        fechaGroup.style.display = 'none';
        break;
      default:
        titleEl.textContent = 'Editar';
        nameEl.value = '';
        impEl.value = 0;
        extraEl.value = '';
        fechaGroup.style.display = 'none';
    }

    overlay.classList.add('show');
  }

  function closeEditModal() {
    const overlay = document.getElementById('editModal');
    if (!overlay) return;
    overlay.classList.remove('show');
    editContext = null;
  }

  function setupEditModalEvents() {
    const overlay = document.getElementById('editModal');
    const btnClose = document.getElementById('editModalClose');
    const btnCancel = document.getElementById('editModalCancel');
    const btnSave = document.getElementById('editModalSave');

    if (!overlay) return;

    const close = () => closeEditModal();

    btnClose?.addEventListener('click', close);
    btnCancel?.addEventListener('click', close);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    btnSave?.addEventListener('click', () => {
      if (!editContext) return;
      const nameEl = document.getElementById('editNombre');
      const impEl = document.getElementById('editImporte');
      const extraEl = document.getElementById('editExtra');
      const fechaEl = document.getElementById('editFecha');

      const nombre = nameEl.value.trim();
      const importe = parseFloat(impEl.value) || 0;
      const extra = extraEl.value.trim();
      const fecha = fechaEl.value;

      const { tipo, item } = editContext;

      if (tipo === 'fijo') {
        state.fijos = state.fijos.map(f =>
          f.id === item.id
            ? { ...f, nombre, importe, categoria: extra || f.categoria, endMonth: fecha || null }
            : f
        );
        saveState();
        renderFijos();
        updateResumen();
      } else if (tipo === 'ingresoPuntual') {
        state.ingresosPuntuales = state.ingresosPuntuales.map(i =>
          i.id === item.id ? { ...i, desc: nombre, importe, fecha: fecha || i.fecha } : i
        );
        saveState();
        renderIngresosPuntuales();
        updateResumen();
      } else if (tipo === 'gasto') {
        state.gastos = state.gastos.map(g =>
          g.id === item.id ? { ...g, desc: nombre, importe, categoria: extra || g.categoria, fecha: fecha || g.fecha } : g
        );
        saveState();
        renderGastosVariables();
        renderSobres();
        updateResumen();
      } else if (tipo === 'sobre') {
        state.sobres = state.sobres.map(s =>
          s.id === item.id ? { ...s, nombre, presupuesto: importe } : s
        );
        saveState();
        renderSobres();
      } else if (tipo === 'hucha') {
        state.huchas = state.huchas.map(h =>
          h.id === item.id ? { ...h, nombre, objetivo: importe } : h
        );
        saveState();
        renderHuchas();
      }

      closeEditModal();
      showToast('Cambios guardados.');
    });
  }

  // ---- Mes actual y UI ----
  function updateMonthDisplay() {
    const display = document.getElementById('monthDisplay');
    if (!display) return;
    const { year, month } = parseYM(currentYM);
    display.textContent = `${monthNames[month - 1]} ${year}`;
  }

  function changeMonth(delta) {
    const { year, month } = parseYM(currentYM);
    const date = new Date(year, month - 1 + delta, 1);
    currentYM = getYM(date);
    updateMonthDisplay();
    loadMonthBoundUI();
  }

  function setupMonthNav() {
    const btnPrev = document.getElementById('btnPrevMonth');
    const btnNext = document.getElementById('btnNextMonth');
    const display = document.getElementById('monthDisplay');

    btnPrev?.addEventListener('click', () => {
      changeMonth(-1);
    });
    btnNext?.addEventListener('click', () => {
      changeMonth(1);
    });
    display?.addEventListener('click', toggleMonthPicker);

    buildMonthPicker();
  }

  function buildMonthPicker() {
    const dropdown = document.getElementById('monthPickerDropdown');
    const yearPrev = document.getElementById('yearPrev');
    const yearNext = document.getElementById('yearNext');
    const yearEl = document.getElementById('pickerYear');
    const monthsGrid = document.getElementById('monthsGrid');
    if (!dropdown || !yearPrev || !yearNext || !yearEl || !monthsGrid) return;

    let currentYear = parseYM(currentYM).year;
    yearEl.textContent = currentYear;

    function renderMonths() {
      monthsGrid.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const ym = `${currentYear}-${m.toString().padStart(2,'0')}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-pill' + (ym === currentYM ? ' active' : '');
        btn.textContent = monthNames[m - 1].slice(0,3);
        btn.addEventListener('click', () => {
          currentYM = ym;
          yearEl.textContent = currentYear;
          updateMonthDisplay();
          loadMonthBoundUI();
          dropdown.classList.remove('show');
        });
        monthsGrid.appendChild(btn);
      }
    }
    renderMonths();

    yearPrev.addEventListener('click', () => {
      currentYear--;
      yearEl.textContent = currentYear;
      renderMonths();
    });

    yearNext.addEventListener('click', () => {
      currentYear++;
      yearEl.textContent = currentYear;
      renderMonths();
    });
  }

  function toggleMonthPicker() {
    const dropdown = document.getElementById('monthPickerDropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('show');
  }

  // ---- Tabs (integrado con swipe.js) ----
  function setupTabs() {
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    const tabSections = Array.from(document.querySelectorAll('.tab-section'));

    window.activateTab = function(tabName) {
      tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabTarget === tabName);
      });
      tabSections.forEach(sec => {
        sec.classList.toggle('active', sec.dataset.tab === tabName);
      });
    };

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tabTarget;
        if (!target) return;
        window.activateTab(target);
      });
    });
  }

  // ---- Resumen ----
  function getIngresosMes(ym) {
    const { year, month } = parseYM(ym);
    const base = (state.ingresosBase.juan || 0) + (state.ingresosBase.saray || 0) + (state.ingresosBase.otros || 0);

    const extra = state.ingresosPuntuales
      .filter(i => i.fecha && i.fecha.startsWith(`${year}-${month.toString().padStart(2,'0')}`))
      .reduce((sum, i) => sum + (i.importe || 0), 0);

    return base + extra;
  }

  function isFijoActivoEnMes(fijo, ym) {
    if (!fijo.endMonth) return true;
    return fijo.endMonth >= ym;
  }

  function getGastosFijosMes(ym) {
    return state.fijos
      .filter(f => isFijoActivoEnMes(f, ym))
      .reduce((sum, f) => sum + (f.importe || 0), 0);
  }

  function getGastosVariablesMes(ym) {
    const { year, month } = parseYM(ym);
    const prefix = `${year}-${month.toString().padStart(2,'0')}`;
    return state.gastos
      .filter(g => g.fecha && g.fecha.startsWith(prefix))
      .reduce((sum, g) => sum + (g.importe || 0), 0);
  }

  function updateResumen() {
    const ingEl = document.getElementById('sumIngresos');
    const fijosEl = document.getElementById('sumFijos');
    const varsEl = document.getElementById('sumVariables');
    const balEl = document.getElementById('sumBalance');

    const ing = getIngresosMes(currentYM);
    const f = getGastosFijosMes(currentYM);
    const v = getGastosVariablesMes(currentYM);
    const bal = ing - f - v;

    if (ingEl) ingEl.textContent = formatMoney(ing);
    if (fijosEl) fijosEl.textContent = formatMoney(f);
    if (varsEl) varsEl.textContent = formatMoney(v);
    if (balEl) {
      balEl.textContent = formatMoney(bal);
      balEl.parentElement.classList.toggle('summary-card-balance', true);
    }
  }

  // ---- Ingresos base + puntuales ----
  function setupIngresosBaseForm() {
    const form = document.getElementById('formIngresosBase');
    const juan = document.getElementById('ingJuan');
    const saray = document.getElementById('ingSaray');
    const otros = document.getElementById('ingOtros');
    if (!form || !juan || !saray || !otros) return;

    juan.value = state.ingresosBase.juan || 0;
    saray.value = state.ingresosBase.saray || 0;
    otros.value = state.ingresosBase.otros || 0;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      state.ingresosBase = {
        juan: parseFloat(juan.value) || 0,
        saray: parseFloat(saray.value) || 0,
        otros: parseFloat(otros.value) || 0
      };
      saveState();
      updateResumen();
      showToast('Ingresos base guardados.');
    });
  }

  function setupIngresoPuntualForm() {
    const form = document.getElementById('formIngresoPuntual');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fechaEl = document.getElementById('ingPuntualFecha');
      const descEl = document.getElementById('ingPuntualDesc');
      const impEl = document.getElementById('ingPuntualImporte');

      let fecha = fechaEl.value;
      if (!fecha) {
        const { year, month } = parseYM(currentYM);
        const today = new Date();
        const d = today.getDate().toString().padStart(2,'0');
        fecha = `${year}-${month.toString().padStart(2,'0')}-${d}`;
      }

      const desc = descEl.value.trim() || 'Ingreso';
      const importe = parseFloat(impEl.value) || 0;
      if (!importe) {
        showToast('Importe debe ser mayor que 0.');
        return;
      }

      const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
      state.ingresosPuntuales.push({ id, fecha, desc, importe });
      saveState();
      descEl.value = '';
      impEl.value = '';
      renderIngresosPuntuales();
      updateResumen();
      showToast('Ingreso puntual añadido.');
    });
  }

  function renderIngresosPuntuales() {
    const cont = document.getElementById('listaIngresosPuntuales');
    if (!cont) return;
    cont.innerHTML = '';

    const { year, month } = parseYM(currentYM);
    const prefix = `${year}-${month.toString().padStart(2,'0')}`;

    const lista = state.ingresosPuntuales.filter(i => i.fecha && i.fecha.startsWith(prefix));

    if (!lista.length) {
      cont.innerHTML = '<p class="section-hint small">No hay ingresos puntuales este mes.</p>';
      return;
    }

    lista
      .sort((a,b) => (a.fecha||'').localeCompare(b.fecha||''))
      .forEach(item => {
        const div = document.createElement('div');
        div.className = 'pill-item';

        const main = document.createElement('div');
        main.className = 'pill-main';
        const l1 = document.createElement('div');
        l1.className = 'pill-line1';
        l1.textContent = item.desc || 'Ingreso';
        const l2 = document.createElement('div');
        l2.className = 'pill-line2';
        l2.textContent = `${item.fecha || ''} · ${formatMoney(item.importe || 0)}`;
        main.append(l1,l2);

        const actions = document.createElement('div');
        actions.className = 'pill-actions';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-edit';
        btnEdit.textContent = '✏️';
        btnEdit.addEventListener('click', () => {
          openEditModal('ingresoPuntual', item);
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-danger-chip';
        btnDel.textContent = '🗑️';
        btnDel.addEventListener('click', () => {
          openConfirm('¿Eliminar este ingreso puntual?', () => {
            state.ingresosPuntuales = state.ingresosPuntuales.filter(i => i.id !== item.id);
            saveState();
            renderIngresosPuntuales();
            updateResumen();
          });
        });

        actions.append(btnEdit, btnDel);
        div.append(main, actions);
        cont.appendChild(div);
      });
  }

  // ---- Gastos fijos ----
  function setupFijosForm() {
    const form = document.getElementById('formGastoFijo');
    const chips = document.getElementById('fijoCategoriaChips');
    if (!form || !chips) return;

    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-select');
      if (!btn) return;
      fixedSelectedCategory = btn.dataset.cat;
      Array.from(chips.querySelectorAll('.chip-select')).forEach(c => c.classList.remove('chip-active'));
      btn.classList.add('chip-active');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombreEl = document.getElementById('fijoNombre');
      const impEl = document.getElementById('fijoImporte');
      const endEl = document.getElementById('fijoEndMonth');

      const nombre = nombreEl.value.trim();
      const importe = parseFloat(impEl.value) || 0;
      const endMonth = endEl.value || null;

      if (!nombre || !importe) {
        showToast('Rellena concepto e importe.');
        return;
      }

      const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
      state.fijos.push({
        id,
        nombre,
        importe,
        categoria: fixedSelectedCategory || 'Varios',
        endMonth
      });

      saveState();
      nombreEl.value = '';
      impEl.value = '';
      endEl.value = '';

      renderFijos();
      updateResumen();
      showToast('Gasto fijo añadido.');
    });

    const filtro = document.getElementById('fijoFiltroChips');
    filtro?.addEventListener('click',(e)=>{
      const btn = e.target.closest('.chip-filter');
      if (!btn) return;
      fixedFilter = btn.dataset.filter;
      Array.from(filtro.querySelectorAll('.chip-filter')).forEach(b => b.classList.remove('chip-active'));
      btn.classList.add('chip-active');
      renderFijos();
    });

    const btnInforme = document.getElementById('btnVerInformeFijos');
    btnInforme?.addEventListener('click', openFijosReport);
  }

  function renderFijos() {
    const tbody = document.getElementById('tablaFijosBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const lista = state.fijos
      .filter(f => fixedFilter === 'Todos' || f.categoria === fixedFilter)
      .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));

    if (!lista.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.innerHTML = '<span class="section-hint small">No hay gastos fijos almacenados.</span>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    lista.forEach(f => {
      const tr = document.createElement('tr');

      const tdNombre = document.createElement('td');
      tdNombre.textContent = f.nombre || '';

      const tdCat = document.createElement('td');
      tdCat.textContent = f.categoria || 'Varios';

      const tdImp = document.createElement('td');
      tdImp.textContent = formatMoney(f.importe || 0);

      const tdEnd = document.createElement('td');
      tdEnd.textContent = f.endMonth || '—';

      const tdAcc = document.createElement('td');
      tdAcc.style.whiteSpace = 'nowrap';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-edit';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', () => openEditModal('fijo', f));

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger-chip';
      btnDel.textContent = '🗑️';
      btnDel.addEventListener('click', () => {
        openConfirm('¿Eliminar este gasto fijo?', () => {
          state.fijos = state.fijos.filter(x => x.id !== f.id);
          saveState();
          renderFijos();
          updateResumen();
        });
      });

      tdAcc.append(btnEdit, btnDel);
      tr.append(tdNombre, tdCat, tdImp, tdEnd, tdAcc);
      tbody.appendChild(tr);
    });
  }

  // ---- Informe fijos ----
  function openFijosReport() {
    const overlay = document.getElementById('reportModal');
    const chartEl = document.getElementById('fixedReportChart');
    const totalsEl = document.getElementById('fixedReportTotals');
    const listEl = document.getElementById('fixedReportList');
    const grandEl = document.getElementById('fixedReportGrandTotal');
    if (!overlay || !chartEl || !totalsEl || !listEl || !grandEl) return;

    const activos = state.fijos.filter(f => isFijoActivoEnMes(f, currentYM));
    const porCat = {};
    activos.forEach(f => {
      const cat = f.categoria || 'Varios';
      porCat[cat] = (porCat[cat] || 0) + (f.importe || 0);
    });

    const labels = Object.keys(porCat);
    const data = labels.map(l => porCat[l]);

    if (fixedChart) fixedChart.destroy();
    fixedChart = new Chart(chartEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { callback: v => formatMoney(v) } }
        }
      }
    });

    totalsEl.innerHTML = '';
    let totalGeneral = 0;
    labels.forEach(cat => {
      const val = porCat[cat];
      totalGeneral += val;
      const chip = document.createElement('div');
      chip.className = 'chip chip-active';
      chip.textContent = `${cat}: ${formatMoney(val)}`;
      totalsEl.appendChild(chip);
    });
    grandEl.textContent = formatMoney(totalGeneral);

    listEl.innerHTML = '';
    labels.forEach(cat => {
      const grupo = document.createElement('div');
      grupo.className = 'report-category-group';
      const t = document.createElement('div');
      t.className = 'report-category-title';
      t.textContent = cat;
      const ul = document.createElement('div');
      ul.className = 'report-category-list';
      activos
        .filter(f => (f.categoria || 'Varios') === cat)
        .forEach(f => {
          const line = document.createElement('div');
          line.textContent = `• ${f.nombre} · ${formatMoney(f.importe || 0)}${f.endMonth ? ` (hasta ${f.endMonth})` : ''}`;
          ul.appendChild(line);
        });
      grupo.append(t, ul);
      listEl.appendChild(grupo);
    });

    overlay.classList.add('show');
  }

  function setupFijosReportModal() {
    const overlay = document.getElementById('reportModal');
    const btnClose = document.getElementById('reportClose');
    const btnOk = document.getElementById('reportOk');
    if (!overlay) return;

    const close = () => overlay.classList.remove('show');

    btnClose?.addEventListener('click', close);
    btnOk?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  // ---- Gastos variables ----
  function setupGastoVariableForm() {
    const form = document.getElementById('formGastoVariable');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fechaEl = document.getElementById('varFecha');
      const catEl = document.getElementById('varCategoria');
      const descEl = document.getElementById('varDesc');
      const impEl = document.getElementById('varImporte');

      let fecha = fechaEl.value;
      if (!fecha) {
        const { year, month } = parseYM(currentYM);
        const today = new Date();
        const d = today.getDate().toString().padStart(2,'0');
        fecha = `${year}-${month.toString().padStart(2,'0')}-${d}`;
      }

      const categoria = catEl.value.trim() || 'Sin categoría';
      const desc = descEl.value.trim() || categoria;
      const importe = parseFloat(impEl.value) || 0;
      if (!importe) {
        showToast('Importe debe ser mayor que 0.');
        return;
      }

      const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
      state.gastos.push({ id, fecha, categoria, desc, importe });
      saveState();

      catEl.value = '';
      descEl.value = '';
      impEl.value = '';

      renderGastosVariables();
      renderSobres();
      updateResumen();
      showToast('Gasto añadido.');
    });
  }

  function renderGastosVariables() {
    const cont = document.getElementById('listaGastosVariables');
    if (!cont) return;
    cont.innerHTML = '';

    const { year, month } = parseYM(currentYM);
    const prefix = `${year}-${month.toString().padStart(2,'0')}`;

    const lista = state.gastos
      .filter(g => g.fecha && g.fecha.startsWith(prefix))
      .sort((a,b) => (a.fecha||'').localeCompare(b.fecha||''));

    if (!lista.length) {
      cont.innerHTML = '<p class="section-hint small">No hay gastos variables este mes.</p>';
      return;
    }

    lista.forEach(g => {
      const div = document.createElement('div');
      div.className = 'expense-item';

      const main = document.createElement('div');
      main.className = 'expense-main';

      const l1 = document.createElement('div');
      l1.className = 'expense-line1';
      l1.textContent = g.desc || g.categoria || 'Gasto';

      const l2 = document.createElement('div');
      l2.className = 'expense-line2';
      l2.textContent = `${g.fecha || ''} · ${g.categoria || ''}`;

      main.append(l1,l2);

      const actions = document.createElement('div');
      actions.className = 'expense-actions';

      const impSpan = document.createElement('div');
      impSpan.className = 'amount-neg';
      impSpan.textContent = formatMoney(g.importe || 0);

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-edit';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', ()=> openEditModal('gasto', g));

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger-chip';
      btnDel.textContent = '🗑️';
      btnDel.addEventListener('click', () => {
        openConfirm('¿Eliminar este gasto?', () => {
          state.gastos = state.gastos.filter(x => x.id !== g.id);
          saveState();
          renderGastosVariables();
          renderSobres();
          updateResumen();
        });
      });

      actions.append(impSpan, btnEdit, btnDel);
      div.append(main, actions);
      cont.appendChild(div);
    });
  }

  // ---- Sobres ----
  function setupSobreForm() {
    const form = document.getElementById('formSobre');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nomEl = document.getElementById('sobreNombre');
      const impEl = document.getElementById('sobreImporte');

      const nombre = nomEl.value.trim();
      const importe = parseFloat(impEl.value) || 0;

      if (!nombre || !importe) {
        showToast('Rellena nombre e importe.');
        return;
      }

      const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
      state.sobres.push({ id, nombre, presupuesto: importe });
      saveState();
      nomEl.value = '';
      impEl.value = '';
      renderSobres();
      showToast('Sobre añadido.');
    });
  }

  function getGastoEnCategoriaMes(cat, ym) {
    const { year, month } = parseYM(ym);
    const prefix = `${year}-${month.toString().padStart(2,'0')}`;
    return state.gastos
      .filter(g => g.fecha && g.fecha.startsWith(prefix) && (g.categoria || '').toLowerCase() === cat.toLowerCase())
      .reduce((sum, g) => sum + (g.importe || 0), 0);
  }

  function renderSobres() {
    const cont = document.getElementById('listaSobres');
    if (!cont) return;
    cont.innerHTML = '';

    if (!state.sobres.length) {
      cont.innerHTML = '<p class="section-hint small">No hay sobres. Crea alguno para controlar categorías.</p>';
      return;
    }

    state.sobres.forEach(s => {
      const gastado = getGastoEnCategoriaMes(s.nombre, currentYM);
      const ratio = s.presupuesto > 0 ? (gastado / s.presupuesto) : 0;
      const pct = Math.min(100, Math.round(ratio * 100));

      const card = document.createElement('div');
      card.className = 'budget-card';

      const header = document.createElement('div');
      header.className = 'budget-card-header';

      const name = document.createElement('div');
      name.className = 'budget-name';
      name.textContent = s.nombre;

      const btns = document.createElement('div');
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-edit';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', () => openEditModal('sobre', s));

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger-chip';
      btnDel.textContent = '🗑️';
      btnDel.addEventListener('click', () => {
        openConfirm('¿Eliminar este sobre?', () => {
          state.sobres = state.sobres.filter(x => x.id !== s.id);
          saveState();
          renderSobres();
        });
      });

      btns.append(btnEdit,btnDel);
      header.append(name,btns);

      const amounts = document.createElement('div');
      amounts.className = 'budget-amounts';

      const a1 = document.createElement('div');
      a1.className = 'budget-amount-item';
      a1.innerHTML = `<div class="budget-amount-label">Presupuesto</div><div class="budget-amount-value">${formatMoney(s.presupuesto || 0)}</div>`;
      const a2 = document.createElement('div');
      a2.className = 'budget-amount-item';
      a2.innerHTML = `<div class="budget-amount-label">Gastado</div><div class="budget-amount-value">${formatMoney(gastado)}</div>`;
      amounts.append(a1,a2);

      const bar = document.createElement('div');
      bar.className = 'budget-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'budget-progress-fill';
      fill.style.width = pct + '%';
      if (ratio > 1) fill.classList.add('over');
      bar.appendChild(fill);

      const status = document.createElement('div');
      status.className = 'budget-status';
      if (ratio <= 0.8) {
        status.classList.add('good');
        status.textContent = `Vas bien (${pct}% usado)`;
      } else if (ratio <= 1) {
        status.classList.add('warning');
        status.textContent = `Casi al límite (${pct}% usado)`;
      } else {
        status.classList.add('over');
        status.textContent = `Presupuesto superado (${pct}% usado)`;
      }

      card.append(header, amounts, bar, status);
      cont.appendChild(card);
    });
  }

  // ---- Huchas ----
  function setupHuchasForm() {
    const form = document.getElementById('formHucha');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nomEl = document.getElementById('huchaNombre');
      const objEl = document.getElementById('huchaObjetivo');

      const nombre = nomEl.value.trim();
      const objetivo = parseFloat(objEl.value) || 0;
      if (!nombre || !objetivo) {
        showToast('Rellena nombre y objetivo.');
        return;
      }

      const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
      state.huchas.push({ id, nombre, objetivo, saldo: 0 });
      saveState();
      nomEl.value = '';
      objEl.value = '';
      renderHuchas();
      showToast('Hucha creada.');
    });
  }

  function renderHuchas() {
    const cont = document.getElementById('listaHuchas');
    if (!cont) return;
    cont.innerHTML = '';

    if (!state.huchas.length) {
      cont.innerHTML = '<p class="section-hint small">No hay huchas creadas.</p>';
      return;
    }

    state.huchas.forEach(h => {
      const card = document.createElement('div');
      card.className = 'budget-card';

      const header = document.createElement('div');
      header.className = 'budget-card-header';

      const name = document.createElement('div');
      name.className = 'budget-name';
      name.textContent = h.nombre;

      const btns = document.createElement('div');

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-edit';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', ()=> openEditModal('hucha', h));

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger-chip';
      btnDel.textContent = '🗑️';
      btnDel.addEventListener('click', () => {
        openConfirm('¿Eliminar esta hucha?', () => {
          state.huchas = state.huchas.filter(x => x.id !== h.id);
          saveState();
          renderHuchas();
        });
      });

      btns.append(btnEdit,btnDel);
      header.append(name,btns);

      const amounts = document.createElement('div');
      amounts.className = 'budget-amounts';

      const a1 = document.createElement('div');
      a1.className = 'budget-amount-item';
      a1.innerHTML = `<div class="budget-amount-label">Objetivo</div><div class="budget-amount-value">${formatMoney(h.objetivo || 0)}</div>`;
      const a2 = document.createElement('div');
      a2.className = 'budget-amount-item';
      a2.innerHTML = `<div class="budget-amount-label">Saldo</div><div class="budget-amount-value">${formatMoney(h.saldo || 0)}</div>`;
      amounts.append(a1,a2);

      const ratio = h.objetivo > 0 ? (h.saldo / h.objetivo) : 0;
      const pct = Math.min(100, Math.round(ratio * 100));

      const bar = document.createElement('div');
      bar.className = 'budget-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'budget-progress-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);

      const status = document.createElement('div');
      status.className = 'budget-status';
      if (ratio < 1) {
        status.classList.add('good');
        status.textContent = `Llevas ${pct}% del objetivo`;
      } else {
        status.classList.add('over');
        status.textContent = '¡Objetivo alcanzado o superado!';
      }

      const acciones = document.createElement('div');
      acciones.className = 'chip-row';
      const btnAdd = document.createElement('button');
      btnAdd.className = 'chip';
      btnAdd.textContent = '➕ Aportar';
      btnAdd.addEventListener('click', () => {
        const val = prompt('Cantidad a aportar a la hucha:', '0');
        const cant = parseFloat(val);
        if (!cant) return;
        h.saldo = (h.saldo || 0) + cant;
        saveState();
        renderHuchas();
      });
      const btnSub = document.createElement('button');
      btnSub.className = 'chip';
      btnSub.textContent = '➖ Retirar';
      btnSub.addEventListener('click', () => {
        const val = prompt('Cantidad a retirar de la hucha:', '0');
        const cant = parseFloat(val);
        if (!cant) return;
        h.saldo = (h.saldo || 0) - cant;
        saveState();
        renderHuchas();
      });
      acciones.append(btnAdd,btnSub);

      card.append(header, amounts, bar, status, acciones);
      cont.appendChild(card);
    });
  }

  // ---- Notas por mes ----
  function setupNotas() {
    const area = document.getElementById('notasMes');
    if (!area) return;

    const sync = () => {
      area.value = state.notasPorMes[currentYM] || '';
    };

    area.addEventListener('input', () => {
      state.notasPorMes[currentYM] = area.value;
      saveState();
    });

    sync();
  }

  // ---- Export / Import JSON (CORREGIDO) ----
  function setupJSONImportExport() {
    const btnExp = document.getElementById('btnExportJSON');
    const inputImport = document.getElementById('inputImportJSON');

    // Export
    btnExp?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `economia-familiar-${currentYM}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Import
    inputImport?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!imported || typeof imported !== 'object') {
            showToast('El archivo no tiene un formato válido.');
            return;
          }

          const overwrite = confirm(
            '¿Quieres sobrescribir todos los datos actuales con el archivo importado?\n\nAceptar = Sobrescribir todo\nCancelar = Intentar fusionar sin borrar lo existente.'
          );

          if (overwrite) {
            state = {
              ingresosBase: imported.ingresosBase || { juan: 0, saray: 0, otros: 0 },
              fijos: imported.fijos || [],
              sobres: imported.sobres || [],
              huchas: imported.huchas || [],
              ingresosPuntuales: imported.ingresosPuntuales || [],
              gastos: imported.gastos || [],
              notasPorMes: imported.notasPorMes || {}
            };
          } else {
            const mergeById = (currentArr, newArr) => {
              const map = new Map();
              (currentArr || []).forEach(item => map.set(String(item.id), item));
              (newArr || []).forEach(item => {
                const key = String(item.id);
                if (map.has(key)) {
                  const replace = confirm(
                    'Se ha encontrado un elemento con el mismo ID.\n¿Quieres sobrescribir el existente por el importado?\n\nAceptar = Sobrescribir\nCancelar = Mantener el existente.'
                  );
                  if (replace) map.set(key, item);
                } else {
                  map.set(key, item);
                }
              });
              return Array.from(map.values());
            };

            state.ingresosBase = imported.ingresosBase || state.ingresosBase;
            state.fijos = mergeById(state.fijos, imported.fijos || []);
            state.sobres = mergeById(state.sobres, imported.sobres || []);
            state.huchas = mergeById(state.huchas, imported.huchas || []);
            state.ingresosPuntuales = mergeById(state.ingresosPuntuales, imported.ingresosPuntuales || []);
            state.gastos = mergeById(state.gastos, imported.gastos || []);
            state.notasPorMes = {
              ...(state.notasPorMes || {}),
              ...(imported.notasPorMes || {})
            };
          }

          // Normalizar categorías de fijos tras importar
          if (Array.isArray(state.fijos)) {
            state.fijos = state.fijos.map(f => ({
              ...f,
              categoria: f.categoria || 'Varios'
            }));
          }

          saveState();
          loadMonthBoundUI();
          showToast('Datos importados correctamente.');
        } catch (err) {
          console.error(err);
          showToast('Error al importar JSON.');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // ---- Import CSV Caixa ----
  function setupCSVImport() {
    const input = document.getElementById('inputImportCSV');
    if (!input) return;

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result;
          importCaixaCSV(text);
        } catch {
          showToast('Error al leer CSV.');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file, 'ISO-8859-1');
    });
  }

  function importCaixaCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) {
      showToast('CSV vacío.');
      return;
    }

    // Saltamos cabecera si detecta "Concepto;Fecha;Importe"
    let start = 0;
    if (/concepto/i.test(lines[0])) start = 1;

    let contIng = 0;
    let contGas = 0;

    for (let i = start; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length < 4) continue;
      let [concepto, fecha, importeStr] = parts;
      concepto = concepto.trim() || 'Movimiento';
      const imp = parseFloat(importeStr.replace(',', '.')) || 0;
      if (!fecha) continue;

      if (imp > 0) {
        const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
        state.ingresosPuntuales.push({
          id,
          fecha,
          desc: concepto,
          importe: imp
        });
        contIng++;
      } else if (imp < 0) {
        const id = crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2));
        state.gastos.push({
          id,
          fecha,
          categoria: 'Banco',
          desc: concepto,
          importe: Math.abs(imp)
        });
        contGas++;
      }
    }
    saveState();
    loadMonthBoundUI();
    showToast(`CSV importado: ${contIng} ingresos, ${contGas} gastos.`);
  }

  // ---- Cargar todo lo que depende del mes ----
  function loadMonthBoundUI() {
    updateMonthDisplay();
    updateResumen();
    renderIngresosPuntuales();
    renderFijos();
    renderGastosVariables();
    renderSobres();
    renderHuchas();
    setupNotas();
  }

  // ---- Init ----
  function init() {
    loadState();
    updateMonthDisplay();

    setupMonthNav();
    setupTabs();

    setupConfirmModalEvents();
    setupEditModalEvents();
    setupFijosReportModal();

    setupIngresosBaseForm();
    setupIngresoPuntualForm();
    setupFijosForm();
    setupGastoVariableForm();
    setupSobreForm();
    setupHuchasForm();
    setupNotas();
    setupJSONImportExport();
    setupCSVImport();

    loadMonthBoundUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
