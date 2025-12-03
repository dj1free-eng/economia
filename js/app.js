(() => {
  'use strict';

  const STORAGE_KEY = 'ecoApp_v20_state';

  const monthNames = [
    'Enero','Febrero','Marzo','Abril',
    'Mayo','Junio','Julio','Agosto',
    'Septiembre','Octubre','Noviembre','Diciembre'
  ];

  const FIXO_CATEGORIES = ['Suministros', 'Préstamos', 'Suscripciones', 'Varios'];

  let state = {
    ingresosBase: { juan: 0, saray: 0, otros: 0 },
    fijos: [],              // {id, nombre, categoria, importe, endMonth? 'YYYY-MM' }
    sobres: [],             // {id, nombre, presupuesto}
    huchas: [],             // {id, nombre, objetivo, saldo}
    ingresosPuntuales: [],  // {id, fecha, desc, importe}
    gastos: [],             // {id, fecha, categoria, desc, importe}
    notasPorMes: {}         // { 'YYYY-MM': 'texto' }
  };

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-11
  let currentFijosFilter = 'Todos';

  let chartFijos = null;

  // ---------- Utilidades ----------
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error guardando estado', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      state.ingresosBase = parsed.ingresosBase || state.ingresosBase;
      state.fijos = parsed.fijos || [];
      state.sobres = parsed.sobres || [];
      state.huchas = parsed.huchas || [];
      state.ingresosPuntuales = parsed.ingresosPuntuales || [];
      state.gastos = parsed.gastos || [];
      state.notasPorMes = parsed.notasPorMes || {};
    } catch (e) {
      console.error('Error cargando estado', e);
    }
  }

  function getCurrentMonthKey() {
    const m = String(currentMonth + 1).padStart(2,'0');
    return `${currentYear}-${m}`;
  }

  function formatCurrency(num) {
    const value = Number(num) || 0;
    return value.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) {
      alert(msg);
      return;
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  function isFijoActivoEn(year, monthIndex, fijo) {
    if (!fijo.endMonth) return true;
    const [ey, em] = fijo.endMonth.split('-').map(v => parseInt(v,10));
    if (!ey || !em) return true;
    const fm = em - 1;
    if (year < ey) return true;
    if (year > ey) return false;
    return monthIndex <= fm;
  }

  function gastosDeMes(year, monthIndex) {
    const ym = `${year}-${String(monthIndex + 1).padStart(2,'0')}`;
    return (state.gastos || []).filter(g => (g.fecha || '').slice(0,7) === ym);
  }

  function ingresosPuntualesDeMes(year, monthIndex) {
    const ym = `${year}-${String(monthIndex + 1).padStart(2,'0')}`;
    return (state.ingresosPuntuales || []).filter(i => (i.fecha || '').slice(0,7) === ym);
  }

  // ---------- Mes y header ----------
  function updateMonthDisplay() {
    const el = document.getElementById('monthDisplay');
    if (el) el.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  }

  function buildMonthPickerYear() {
    const yearLabel = document.getElementById('pickerYear');
    const grid = document.getElementById('monthsGrid');
    if (!yearLabel || !grid) return;

    yearLabel.textContent = currentYear;
    grid.innerHTML = '';
    for (let i=0;i<12;i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'month-btn' + (i === currentMonth ? ' selected' : '');
      btn.textContent = monthNames[i].slice(0,3);
      btn.addEventListener('click', () => {
        currentMonth = i;
        updateMonthDisplay();
        renderAll();
        const dd = document.getElementById('monthPickerDropdown');
        if (dd) dd.classList.remove('active');
      });
      grid.appendChild(btn);
    }
  }

  function setupMonthNavigation() {
    document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      updateMonthDisplay();
      renderAll();
      buildMonthPickerYear();
    });

    document.getElementById('btnNextMonth')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      updateMonthDisplay();
      renderAll();
      buildMonthPickerYear();
    });

    const display = document.getElementById('monthDisplay');
    const dropdown = document.getElementById('monthPickerDropdown');
    document.getElementById('yearPrev')?.addEventListener('click', () => {
      currentYear--;
      buildMonthPickerYear();
    });
    document.getElementById('yearNext')?.addEventListener('click', () => {
      currentYear++;
      buildMonthPickerYear();
    });

    if (display && dropdown) {
      display.addEventListener('click', () => {
        dropdown.classList.toggle('active');
        buildMonthPickerYear();
      });
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== display) {
          dropdown.classList.remove('active');
        }
      });
    }
  }

  // ---------- Tabs + swipe (integración con swipe.js) ----------
  function setupTabs() {
    const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
    const sections = Array.from(document.querySelectorAll('.tab-section'));

    function setActive(tabName) {
      sections.forEach(sec => {
        sec.classList.toggle('active', sec.dataset.tab === tabName);
      });
      tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabTarget === tabName);
      });
    }

    window.activateTab = function(tabName) {
      setActive(tabName);
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tabTarget;
        if (!target) return;
        setActive(target);
      });
    });

    setActive('ingresos');
  }

  // ---------- Ingresos base ----------
  function renderIngresosBase() {
    document.getElementById('ingJuan').value = state.ingresosBase.juan || 0;
    document.getElementById('ingSaray').value = state.ingresosBase.saray || 0;
    document.getElementById('ingOtros').value = state.ingresosBase.otros || 0;
  }

  function setupIngresosBase() {
    const btn = document.getElementById('btnSaveIngresos');
    if (!btn) return;
    btn.addEventListener('click', () => {
      state.ingresosBase.juan = Number(document.getElementById('ingJuan').value) || 0;
      state.ingresosBase.saray = Number(document.getElementById('ingSaray').value) || 0;
      state.ingresosBase.otros = Number(document.getElementById('ingOtros').value) || 0;
      saveState();
      updateResumenYChips();
      showToast('Ingresos base guardados.');
    });
  }

  // ---------- Ingresos puntuales ----------
  function renderIngresosPuntuales() {
    const cont = document.getElementById('ingresosPuntualesLista');
    if (!cont) return;
    const lista = ingresosPuntualesDeMes(currentYear, currentMonth);

    if (!lista.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💶</div>No has añadido ingresos puntuales este mes.</div>';
      return;
    }

    cont.innerHTML = '';
    lista.forEach(i => {
      const div = document.createElement('div');
      div.className = 'pill-item';
      div.innerHTML = `
        <div class="pill-main">
          <div class="pill-line1">${formatCurrency(i.importe)} · ${i.desc || 'Ingreso puntual'}</div>
          <div class="pill-line2">${i.fecha || ''}</div>
        </div>
        <div class="pill-actions">
          <button class="btn btn-danger-chip" data-id="${i.id}">🗑</button>
        </div>
      `;
      div.querySelector('button').addEventListener('click', () => {
        if (!confirm('¿Eliminar este ingreso puntual?')) return;
        state.ingresosPuntuales = state.ingresosPuntuales.filter(x => x.id !== i.id);
        saveState();
        renderIngresosPuntuales();
        updateResumenYChips();
      });
      cont.appendChild(div);
    });
  }

  function setupIngresosPuntuales() {
    const fecha = document.getElementById('ingresoPuntualFecha');
    const desc = document.getElementById('ingresoPuntualDesc');
    const importe = document.getElementById('ingresoPuntualImporte');
    const btn = document.getElementById('btnAddIngresoPuntual');

    if (fecha && !fecha.value) {
      const today = new Date();
      fecha.value = today.toISOString().slice(0,10);
    }

    btn?.addEventListener('click', () => {
      const f = fecha.value;
      const d = (desc.value || '').trim();
      const imp = Number(importe.value);
      if (!f) return showToast('Pon una fecha.');
      if (!(imp > 0)) return showToast('Importe debe ser mayor que 0.');

      state.ingresosPuntuales.push({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        fecha: f,
        desc: d,
        importe: imp
      });
      saveState();
      desc.value = '';
      importe.value = '';
      renderIngresosPuntuales();
      updateResumenYChips();
      showToast('Ingreso puntual añadido.');
    });
  }

  // ---------- Gastos fijos ----------
  function setupFijosChips() {
    const chips = Array.from(document.querySelectorAll('#fijoCategoriaChips .category-chip'));
    const hidden = document.getElementById('fijoCategoria');
    chips.forEach(ch => {
      ch.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('selected'));
        ch.classList.add('selected');
        if (hidden) hidden.value = ch.dataset.cat || '';
      });
    });
  }

  function renderFijos() {
    const cont = document.getElementById('fijosTableContainer');
    const totalEl = document.getElementById('totalFijosDisplay');
    if (!cont || !totalEl) return;

    const activos = (state.fijos || []).filter(f => isFijoActivoEn(currentYear, currentMonth, f));

    const totalMes = activos.reduce((sum,f) => sum + (Number(f.importe)||0), 0);
    totalEl.textContent = formatCurrency(totalMes);

    const filtrados = activos.filter(f => {
      if (currentFijosFilter === 'Todos') return true;
      return (f.categoria || '') === currentFijosFilter;
    });

    if (!filtrados.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏠</div>No hay gastos fijos para este filtro en este mes.</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'fixed-expense-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Categoría</th>
          <th>Importe</th>
          <th>Fin</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    filtrados.forEach(f => {
      const tr = document.createElement('tr');
      const endTxt = f.endMonth ? f.endMonth : 'Indef.';
      tr.innerHTML = `
        <td>${f.nombre || ''}</td>
        <td>${f.categoria || ''}</td>
        <td>${formatCurrency(f.importe)}</td>
        <td>${endTxt}</td>
        <td>
          <button class="btn btn-danger-chip btn-sm" data-id="${f.id}">🗑</button>
        </td>
      `;
      tr.querySelector('button').addEventListener('click', () => {
        if (!confirm('¿Eliminar este gasto fijo?')) return;
        state.fijos = state.fijos.filter(x => x.id !== f.id);
        saveState();
        renderFijos();
        updateResumenYChips();
      });
      tbody.appendChild(tr);
    });

    cont.innerHTML = '';
    cont.appendChild(table);
  }

  function setupFijos() {
    setupFijosChips();

    const filtros = Array.from(document.querySelectorAll('#fijosFiltros .filter-pill'));
    filtros.forEach(btn => {
      btn.addEventListener('click', () => {
        filtros.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFijosFilter = btn.dataset.filter || 'Todos';
        renderFijos();
      });
    });

    const btnAdd = document.getElementById('btnAddFijo');
    btnAdd?.addEventListener('click', () => {
      const nombre = (document.getElementById('fijoNombre').value || '').trim();
      const categoria = (document.getElementById('fijoCategoria').value || '').trim();
      const importe = Number(document.getElementById('fijoImporte').value);
      const finMes = document.getElementById('fijoFinMes').value;

      if (!nombre) return showToast('Pon un nombre al gasto fijo.');
      if (!categoria) return showToast('Selecciona una categoría.');
      if (!(importe > 0)) return showToast('Importe debe ser mayor que 0.');

      state.fijos.push({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        nombre,
        categoria,
        importe,
        endMonth: finMes || null
      });
      saveState();

      document.getElementById('fijoNombre').value = '';
      document.getElementById('fijoImporte').value = '';
      document.getElementById('fijoFinMes').value = '';
      const chips = Array.from(document.querySelectorAll('#fijoCategoriaChips .category-chip'));
      chips.forEach(c => c.classList.remove('selected'));
      document.getElementById('fijoCategoria').value = '';

      renderFijos();
      updateResumenYChips();
      showToast('Gasto fijo añadido.');
    });

    document.getElementById('btnInformeFijos')?.addEventListener('click', openReportModal);
  }

  // ---------- Reporte de fijos ----------
  function openReportModal() {
    const activos = (state.fijos || []).filter(f => isFijoActivoEn(currentYear, currentMonth, f));
    const totals = {};
    FIXO_CATEGORIES.forEach(c => totals[c] = 0);
    activos.forEach(f => {
      const cat = FIXO_CATEGORIES.includes(f.categoria) ? f.categoria : 'Varios';
      totals[cat] += Number(f.importe) || 0;
    });

    const totalGeneral = Object.values(totals).reduce((a,b)=>a+b,0);

    const ctx = document.getElementById('chartFijosCategorias').getContext('2d');
    const labels = FIXO_CATEGORIES;
    const dataVals = labels.map(l => totals[l]);

    if (chartFijos) {
      chartFijos.data.labels = labels;
      chartFijos.data.datasets[0].data = dataVals;
      chartFijos.update();
    } else {
      chartFijos = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total por categoría',
            data: dataVals
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
          },
          scales: {
            x: {
              ticks: {
                callback: val => formatCurrency(val)
              }
            }
          }
        }
      });
    }

    const detalle = document.getElementById('reportFijosDetalle');
    let html = '';
    FIXO_CATEGORIES.forEach(cat => {
      const lista = activos.filter(f => (f.categoria || '') === cat);
      if (!lista.length) return;
      html += `<h4>${cat} (${formatCurrency(totals[cat])})</h4><ul>`;
      lista.forEach(f => {
        const endTxt = f.endMonth ? ` · fin ${f.endMonth}` : '';
        html += `<li>${f.nombre || ''} — ${formatCurrency(f.importe)}${endTxt}</li>`;
      });
      html += '</ul>';
    });
    html += `<hr><p><strong>Total general: ${formatCurrency(totalGeneral)}</strong></p>`;
    detalle.innerHTML = html;

    const modal = document.getElementById('reportModal');
    modal?.classList.add('active');
  }

  function setupReportModal() {
    const modal = document.getElementById('reportModal');
    const closeButtons = [document.getElementById('reportClose'), document.getElementById('reportCloseFooter')];
    closeButtons.forEach(btn => {
      btn?.addEventListener('click', () => modal?.classList.remove('active'));
    });
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  // ---------- Gastos variables ----------
  function renderGastos() {
    const cont = document.getElementById('gastosLista');
    if (!cont) return;
    const lista = gastosDeMes(currentYear, currentMonth);

    if (!lista.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>No has añadido gastos este mes.</div>';
      return;
    }
    cont.innerHTML = '';
    lista.forEach(g => {
      const div = document.createElement('div');
      div.className = 'expense-item';
      div.innerHTML = `
        <div class="expense-main">
          <div class="expense-line1">${formatCurrency(g.importe)} · ${g.categoria || 'Sin categoría'}</div>
          <div class="expense-line2">${g.fecha || ''} · ${g.desc || ''}</div>
        </div>
        <div class="expense-actions">
          <button class="btn btn-danger-chip" data-id="${g.id}">🗑</button>
        </div>
      `;
      div.querySelector('button').addEventListener('click', () => {
        if (!confirm('¿Eliminar este gasto?')) return;
        state.gastos = state.gastos.filter(x => x.id !== g.id);
        saveState();
        renderGastos();
        renderSobres();
        updateResumenYChips();
        rebuildCategoriasSugerencias();
      });
      cont.appendChild(div);
    });
  }

  function setupGastos() {
    const fecha = document.getElementById('gastoFecha');
    const categoria = document.getElementById('gastoCategoria');
    const desc = document.getElementById('gastoDesc');
    const importe = document.getElementById('gastoImporte');
    const btn = document.getElementById('btnAddGasto');

    if (fecha && !fecha.value) {
      const today = new Date();
      fecha.value = today.toISOString().slice(0,10);
    }

    btn?.addEventListener('click', () => {
      const f = fecha.value;
      const cat = (categoria.value || '').trim();
      const d = (desc.value || '').trim();
      const imp = Number(importe.value);
      if (!f) return showToast('Pon una fecha.');
      if (!cat) return showToast('Pon una categoría.');
      if (!(imp > 0)) return showToast('Importe debe ser mayor que 0.');

      state.gastos.push({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        fecha: f,
        categoria: cat,
        desc: d,
        importe: imp
      });
      saveState();
      desc.value = '';
      importe.value = '';
      renderGastos();
      renderSobres();
      updateResumenYChips();
      rebuildCategoriasSugerencias();
      showToast('Gasto añadido.');
    });
  }

  // ---------- Sobres ----------
  function renderSobres() {
    const cont = document.getElementById('sobresLista');
    if (!cont) return;
    const sobres = state.sobres || [];
    const gastosMes = gastosDeMes(currentYear, currentMonth);

    if (!sobres.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📩</div>No hay presupuestos creados.</div>';
      return;
    }

    cont.innerHTML = '';
    sobres.forEach(s => {
      const gastado = gastosMes
        .filter(g => (g.categoria || '').toLowerCase() === (s.nombre || '').toLowerCase())
        .reduce((sum,g) => sum + (Number(g.importe)||0), 0);

      const presupuesto = Number(s.presupuesto) || 0;
      const restante = presupuesto - gastado;
      const ratio = presupuesto > 0 ? gastado / presupuesto : 0;
      const pct = presupuesto > 0 ? Math.min(100, (gastado / presupuesto) * 100) : 0;

      let statusClass = 'good';
      let statusText = 'Dentro de presupuesto';
      if (presupuesto === 0) {
        statusClass = 'warning';
        statusText = 'Sin presupuesto definido';
      } else if (ratio >= 0.9 && ratio < 1) {
        statusClass = 'warning';
        statusText = 'A punto de agotar presupuesto';
      } else if (ratio >= 1) {
        statusClass = 'over';
        statusText = 'Presupuesto superado';
      }

      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="budget-card-header">
          <div class="budget-name">📩 ${s.nombre || ''}</div>
          <div>
            <button class="btn btn-danger-chip" data-id="${s.id}">🗑</button>
          </div>
        </div>
        <div class="budget-amounts">
          <div class="budget-amount-item">
            <div class="budget-amount-label">Presupuesto</div>
            <div class="budget-amount-value">${formatCurrency(presupuesto)}</div>
          </div>
          <div class="budget-amount-item">
            <div class="budget-amount-label">Gastado</div>
            <div class="budget-amount-value">${formatCurrency(gastado)}</div>
          </div>
          <div class="budget-amount-item">
            <div class="budget-amount-label">Restante</div>
            <div class="budget-amount-value">${formatCurrency(restante)}</div>
          </div>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill ${ratio >= 1 ? 'over' : ''}" style="width:${pct}%;"></div>
        </div>
        <div class="budget-status ${statusClass}">
          ${statusText}
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => {
        if (!confirm('¿Eliminar este sobre/presupuesto?')) return;
        state.sobres = state.sobres.filter(x => x.id !== s.id);
        saveState();
        renderSobres();
        rebuildCategoriasSugerencias();
      });
      cont.appendChild(card);
    });
  }

  function setupSobres() {
    const nombre = document.getElementById('sobreNombre');
    const importe = document.getElementById('sobreImporte');
    const btn = document.getElementById('btnAddSobre');

    btn?.addEventListener('click', () => {
      const n = (nombre.value || '').trim();
      const p = Number(importe.value);
      if (!n) return showToast('Pon un nombre al presupuesto.');
      if (isNaN(p)) return showToast('El presupuesto debe ser un número.');

      state.sobres.push({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        nombre: n,
        presupuesto: p
      });
      saveState();
      nombre.value = '';
      importe.value = '';
      renderSobres();
      rebuildCategoriasSugerencias();
      showToast('Presupuesto creado.');
    });
  }

  // ---------- Huchas ----------
  function renderHuchas() {
    const cont = document.getElementById('huchasLista');
    const select = document.getElementById('huchaSelect');
    if (!cont || !select) return;

    const list = state.huchas || [];
    select.innerHTML = '<option value="">-- Elige una hucha --</option>';

    if (!list.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🐷</div>No has creado ninguna hucha todavía.</div>';
      return;
    }

    cont.innerHTML = '';
    list.forEach(h => {
      const saldo = Number(h.saldo) || 0;
      const objetivo = Number(h.objetivo) || 0;
      const ratio = objetivo > 0 ? saldo / objetivo : 0;
      const pct = objetivo > 0 ? Math.min(100, (saldo / objetivo) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="budget-card-header">
          <div class="budget-name">🐷 ${h.nombre || ''}</div>
          <div>
            <button class="btn btn-danger-chip" data-id="${h.id}">🗑</button>
          </div>
        </div>
        <div class="budget-amounts">
          <div class="budget-amount-item">
            <div class="budget-amount-label">Saldo</div>
            <div class="budget-amount-value">${formatCurrency(saldo)}</div>
          </div>
          <div class="budget-amount-item">
            <div class="budget-amount-label">Objetivo</div>
            <div class="budget-amount-value">${objetivo ? formatCurrency(objetivo) : '—'}</div>
          </div>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill" style="width:${pct}%;"></div>
        </div>
        <div class="budget-status ${ratio >= 1 ? 'good' : 'warning'}">
          ${objetivo ? (ratio >= 1 ? '¡Objetivo conseguido!' : 'Progreso hacia objetivo') : 'Hucha sin objetivo fijo'}
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => {
        if (!confirm('¿Eliminar esta hucha?')) return;
        state.huchas = state.huchas.filter(x => x.id !== h.id);
        saveState();
        renderHuchas();
        updateResumenYChips();
      });
      cont.appendChild(card);

      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `${h.nombre} (${formatCurrency(saldo)})`;
      select.appendChild(opt);
    });
  }

  function setupHuchas() {
    const nombre = document.getElementById('huchaNombre');
    const objetivo = document.getElementById('huchaObjetivo');
    const saldoIni = document.getElementById('huchaSaldoInicial');
    const btnAdd = document.getElementById('btnAddHucha');

    btnAdd?.addEventListener('click', () => {
      const n = (nombre.value || '').trim();
      const obj = Number(objetivo.value) || 0;
      const saldo = Number(saldoIni.value) || 0;
      if (!n) return showToast('Pon un nombre a la hucha.');

      state.huchas.push({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        nombre: n,
        objetivo: obj,
        saldo
      });
      saveState();
      nombre.value = '';
      objetivo.value = '';
      saldoIni.value = '';
      renderHuchas();
      updateResumenYChips();
      showToast('Hucha creada.');
    });

    const select = document.getElementById('huchaSelect');
    const importe = document.getElementById('huchaImporte');
    const accion = document.getElementById('huchaAccion');
    const btnMov = document.getElementById('btnHuchaMovimiento');

    btnMov?.addEventListener('click', () => {
      const id = select.value;
      const imp = Number(importe.value);
      const acc = accion.value;
      if (!id) return showToast('Elige una hucha.');
      if (!(imp > 0)) return showToast('Importe debe ser mayor que 0.');

      const h = state.huchas.find(x => x.id === id);
      if (!h) return showToast('Hucha no encontrada.');

      if (acc === 'aportar') {
        h.saldo = (Number(h.saldo)||0) + imp;
        // registrar gasto en categoría Huchas
        const today = new Date();
        const fecha = today.toISOString().slice(0,10);
        state.gastos.push({
          id: Date.now().toString(36)+Math.random().toString(36).slice(2),
          fecha,
          categoria: 'Huchas',
          desc: `Aportación a hucha ${h.nombre}`,
          importe: imp
        });
      } else if (acc === 'retirar') {
        h.saldo = (Number(h.saldo)||0) - imp;
      }
      saveState();
      importe.value = '';
      renderHuchas();
      renderGastos();
      renderSobres();
      updateResumenYChips();
      rebuildCategoriasSugerencias();
      showToast('Movimiento registrado.');
    });
  }

  // ---------- Notas ----------
  function renderNotas() {
    const txt = document.getElementById('notasMes');
    if (!txt) return;
    txt.value = state.notasPorMes[getCurrentMonthKey()] || '';
  }

  function setupNotas() {
    const txt = document.getElementById('notasMes');
    const btn = document.getElementById('btnSaveNotas');
    if (!txt || !btn) return;

    btn.addEventListener('click', () => {
      state.notasPorMes[getCurrentMonthKey()] = txt.value || '';
      saveState();
      showToast('Notas guardadas.');
    });
  }

  // ---------- Resumen + chips ----------
  function updateResumenYChips() {
    const ingresosBaseTotal =
      (Number(state.ingresosBase.juan)||0) +
      (Number(state.ingresosBase.saray)||0) +
      (Number(state.ingresosBase.otros)||0);

    const ingresosExtra = ingresosPuntualesDeMes(currentYear,currentMonth)
      .reduce((s,i)=>s+(Number(i.importe)||0),0);

    const activos = (state.fijos || []).filter(f => isFijoActivoEn(currentYear,currentMonth,f));
    const totalFijos = activos.reduce((s,f)=>s+(Number(f.importe)||0),0);

    const gastosMes = gastosDeMes(currentYear,currentMonth)
      .reduce((s,g)=>s+(Number(g.importe)||0),0);

    const totalIngresos = ingresosBaseTotal + ingresosExtra;
    const totalGastos = totalFijos + gastosMes;

    const huchasSaldo = (state.huchas||[]).reduce((s,h)=>s+(Number(h.saldo)||0),0);

    const balance = totalIngresos - totalGastos;

    document.getElementById('chipIngresos').textContent = formatCurrency(totalIngresos);
    document.getElementById('chipGastos').textContent = formatCurrency(totalGastos);
    document.getElementById('chipBalance').textContent = formatCurrency(balance);
    document.getElementById('chipHuchasTotal').textContent = `Huchas: ${formatCurrency(huchasSaldo)}`;

    document.getElementById('resIngMes').textContent = formatCurrency(totalIngresos);
    document.getElementById('resFijosMes').textContent = formatCurrency(totalFijos);
    document.getElementById('resVarMes').textContent = formatCurrency(gastosMes);
    document.getElementById('resBalMes').textContent = formatCurrency(balance);

    const wrap = document.getElementById('chipBalanceWrap');
    if (wrap) {
      if (balance >= 0) {
        wrap.classList.remove('chip-balance-neg');
        wrap.classList.add('chip-balance-pos');
      } else {
        wrap.classList.remove('chip-balance-pos');
        wrap.classList.add('chip-balance-neg');
      }
    }
  }

  // ---------- Export / Import JSON ----------
  function setupExportImportJson() {
    const btnExport = document.getElementById('btnExportJson');
    const importFile = document.getElementById('importFile');
    const btnImportFile = document.getElementById('btnImportJsonFile');
    const importText = document.getElementById('importJsonText');
    const btnImportText = document.getElementById('btnImportJsonText');

    btnExport?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `economia-familiar-${getCurrentMonthKey()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      showToast('JSON exportado.');
    });

    btnImportFile?.addEventListener('click', () => importFile?.click());

    importFile?.addEventListener('change', () => {
      const file = importFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') throw new Error('Formato inválido');
          if (!confirm('Vas a sobrescribir todos los datos actuales. ¿Continuar?')) return;
          state = {
            ingresosBase: data.ingresosBase || { juan:0,saray:0,otros:0 },
            fijos: data.fijos || [],
            sobres: data.sobres || [],
            huchas: data.huchas || [],
            ingresosPuntuales: data.ingresosPuntuales || [],
            gastos: data.gastos || [],
            notasPorMes: data.notasPorMes || {}
          };
          saveState();
          renderAll();
          showToast('Datos importados.');
        } catch (err) {
          console.error(err);
          showToast('Error al importar JSON.');
        } finally {
          importFile.value = '';
        }
      };
      reader.readAsText(file);
    });

    btnImportText?.addEventListener('click', () => {
      try {
        const txt = importText.value || '';
        const data = JSON.parse(txt);
        if (!data || typeof data !== 'object') throw new Error('Formato inválido');
        if (!confirm('Vas a sobrescribir todos los datos actuales. ¿Continuar?')) return;
        state = {
          ingresosBase: data.ingresosBase || { juan:0,saray:0,otros:0 },
          fijos: data.fijos || [],
          sobres: data.sobres || [],
          huchas: data.huchas || [],
          ingresosPuntuales: data.ingresosPuntuales || [],
          gastos: data.gastos || [],
          notasPorMes: data.notasPorMes || {}
        };
        saveState();
        renderAll();
        showToast('Datos importados.');
      } catch (err) {
        console.error(err);
        showToast('Error al importar JSON.');
      }
    });
  }

  // ---------- Import CSV ----------
  function setupImportCsv() {
    const btn = document.getElementById('btnImportCsv');
    const fileInput = document.getElementById('csvFile');

    btn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length <= 1) throw new Error('CSV vacío');
          const header = lines[0].split(';').map(h => h.trim().toLowerCase());
          const idxConcepto = header.indexOf('concepto');
          const idxFecha = header.indexOf('fecha');
          const idxImporte = header.indexOf('importe');
          if (idxConcepto === -1 || idxFecha === -1 || idxImporte === -1) {
            throw new Error('Cabecera no válida');
          }
          let count = 0;
          for (let i=1;i<lines.length;i++) {
            const cols = lines[i].split(';');
            const concepto = (cols[idxConcepto] || '').trim();
            const fecha = (cols[idxFecha] || '').trim();
            let imp = (cols[idxImporte] || '').replace('.','').replace(',','.');
            const importe = Number(imp);
            if (!fecha || isNaN(importe)) continue;
            if (importe >= 0) continue; // solo cargos
            const id = Date.now().toString(36)+Math.random().toString(36).slice(2);
            state.gastos.push({
              id,
              fecha,
              categoria: 'Banco',
              desc: concepto,
              importe: Math.abs(importe)
            });
            count++;
          }
          saveState();
          renderGastos();
          renderSobres();
          updateResumenYChips();
          rebuildCategoriasSugerencias();
          showToast(`Importados ${count} movimientos.`);
        } catch (err) {
          console.error(err);
          showToast('Error al importar CSV.');
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // ---------- Reset ----------
  function setupReset() {
    const btn = document.getElementById('btnResetAll');
    btn?.addEventListener('click', () => {
      if (!confirm('¿Seguro que quieres borrar TODOS los datos de la app?')) return;
      state = {
        ingresosBase: { juan: 0, saray: 0, otros: 0 },
        fijos: [],
        sobres: [],
        huchas: [],
        ingresosPuntuales: [],
        gastos: [],
        notasPorMes: {}
      };
      saveState();
      renderAll();
      showToast('Datos borrados.');
    });
  }

  // ---------- Categorías sugeridas gastos ----------
  function rebuildCategoriasSugerencias() {
    const dl = document.getElementById('catSugerencias');
    if (!dl) return;
    const set = new Set();
    (state.sobres || []).forEach(s => {
      if (s.nombre) set.add(s.nombre);
    });
    (state.gastos || []).forEach(g => {
      if (g.categoria) set.add(g.categoria);
    });
    dl.innerHTML = '';
    Array.from(set).sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      dl.appendChild(opt);
    });
  }

  // ---------- Render global ----------
  function renderAll() {
    updateMonthDisplay();
    renderIngresosBase();
    renderIngresosPuntuales();
    renderFijos();
    renderGastos();
    renderSobres();
    renderHuchas();
    renderNotas();
    rebuildCategoriasSugerencias();
    updateResumenYChips();
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    loadState();

    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    setupTabs();
    setupMonthNavigation();

    setupIngresosBase();
    setupIngresosPuntuales();
    setupFijos();
    setupReportModal();
    setupGastos();
    setupSobres();
    setupHuchas();
    setupNotas();
    setupExportImportJson();
    setupImportCsv();
    setupReset();

    renderAll();
  });

})();
