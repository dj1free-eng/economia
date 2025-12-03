(() => {
  'use strict';

  const STORAGE_KEY = 'ecoApp_v11e_state';

  let state = {
    ingresosBase: { juan: 0, saray: 0, otros: 0 },
    fijos: [],              // {id, nombre, importe, endMonth?}
    sobres: [],             // {id, nombre, presupuesto}
    huchas: [],             // {id, nombre, objetivo, saldo}
    ingresosPuntuales: [],  // {id, fecha, desc, importe}
    gastos: [],             // {id, fecha, categoria, desc, importe}
    notasPorMes: {}         // { 'YYYY-MM': 'texto' }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril',
    'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  // ----------------- Utilidades -----------------
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = {
          ingresosBase: parsed.ingresosBase || { juan: 0, saray: 0, otros: 0 },
          fijos: parsed.fijos || [],
          sobres: parsed.sobres || [],
          huchas: parsed.huchas || [],
          ingresosPuntuales: parsed.ingresosPuntuales || [],
          gastos: parsed.gastos || [],
          notasPorMes: parsed.notasPorMes || {}
        };
      }
    } catch (e) {
      console.error('Error al cargar estado desde localStorage:', e);
    }
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

  function getCurrentMonthKey() {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function parseDateToYM(dateStr) {
    if (!dateStr) return null;
    const [y, m] = dateStr.split('-').map(x => parseInt(x, 10));
    if (!y || !m) return null;
    return { year: y, month: m - 1 };
  }

  function compareYM(aYear, aMonth, bYear, bMonth) {
    if (aYear < bYear) return -1;
    if (aYear > bYear) return 1;
    if (aMonth < bMonth) return -1;
    if (aMonth > bMonth) return 1;
    return 0;
  }

  function getGastosMes(year, month) {
    const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
    return (state.gastos || []).filter(g => (g.fecha || '').slice(0, 7) === ym);
  }

  function getIngresosPuntualesMes(year, month) {
    const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
    return (state.ingresosPuntuales || []).filter(i => (i.fecha || '').slice(0, 7) === ym);
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) {
      alert(msg);
      return;
    }
    toast.textContent = msg;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // --------- Modales genéricos ---------
  let confirmCallback = null;

  function openConfirm(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmText');
    if (!modal || !text) return;
    text.textContent = message;
    confirmCallback = onConfirm || null;
    modal.classList.add('show');
  }

  function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('show');
    confirmCallback = null;
  }

  function setupConfirmModalEvents() {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    const btnOk = document.getElementById('confirmOk');
    const btnCancel = document.getElementById('confirmCancel');

    if (btnOk) {
      btnOk.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirm();
      });
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => closeConfirm());
    }
  }

  // --------- Modal de edición genérico (fijos / sobres / gastos / huchas) ---------
  let editContext = null;

  function openEditModal(tipo, item) {
    const modal = document.getElementById('editModal');
    if (!modal) return;
    editContext = { tipo, item: { ...item } };

    const titleEl = document.getElementById('editModalTitle');
    const nameEl = document.getElementById('editNombre');
    const impEl = document.getElementById('editImporte');
    const extraEl = document.getElementById('editExtra');
    const dateEl = document.getElementById('editFecha');

    if (titleEl) {
      switch (tipo) {
        case 'fijo':
          titleEl.textContent = 'Editar gasto fijo';
          break;
        case 'sobre':
          titleEl.textContent = 'Editar presupuesto';
          break;
        case 'gasto':
          titleEl.textContent = 'Editar gasto';
          break;
        case 'hucha':
          titleEl.textContent = 'Editar hucha';
          break;
        default:
          titleEl.textContent = 'Editar';
      }
    }

    if (nameEl) nameEl.value = item.nombre || item.categoria || item.desc || '';
    if (impEl) {
      if (tipo === 'fijo') {
        impEl.value = item.importe || 0;
      } else if (tipo === 'sobre') {
        impEl.value = item.presupuesto || 0;
      } else if (tipo === 'hucha') {
        impEl.value = item.objetivo || 0;
      } else if (tipo === 'gasto') {
        impEl.value = item.importe || 0;
      } else {
        impEl.value = '';
      }
    }

    if (dateEl) {
      if (tipo === 'gasto') {
        dateEl.value = item.fecha || '';
        dateEl.parentElement.style.display = 'block';
      } else if (tipo === 'fijo') {
        dateEl.value = item.endMonth || '';
        dateEl.parentElement.style.display = 'block';
      } else {
        dateEl.value = '';
        dateEl.parentElement.style.display = 'none';
      }
    }

    if (extraEl) {
      if (tipo === 'hucha') {
        extraEl.style.display = 'block';
        extraEl.value = item.saldo != null ? item.saldo : '';
      } else {
        extraEl.style.display = 'none';
        extraEl.value = '';
      }
    }

    modal.classList.add('show');
  }

  function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('show');
    editContext = null;
  }

  function setupEditModalEvents() {
    const modal = document.getElementById('editModal');
    if (!modal) return;
    const btnSave = document.getElementById('editSave');
    const btnCancel = document.getElementById('editCancel');

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (!editContext) {
          closeEditModal();
          return;
        }
        const { tipo, item } = editContext;

        const nameEl = document.getElementById('editNombre');
        const impEl = document.getElementById('editImporte');
        const extraEl = document.getElementById('editExtra');
        const dateEl = document.getElementById('editFecha');

        const nameVal = nameEl ? nameEl.value.trim() : '';
        const impVal = Number(impEl && impEl.value) || 0;
        const extraVal = extraEl && extraEl.value;
        const dateVal = dateEl && dateEl.value;

        if (!nameVal && tipo !== 'gasto') {
          showToast('El nombre no puede estar vacío.');
          return;
        }

        if (tipo === 'fijo') {
          const idx = state.fijos.findIndex(f => String(f.id) === String(item.id));
          if (idx >= 0) {
            state.fijos[idx].nombre = nameVal;
            state.fijos[idx].importe = impVal;
            state.fijos[idx].endMonth = dateVal || null;
          }
          saveState();
          renderFijosLista();
          updateResumenYChips();
          showToast('Gasto fijo actualizado.');
        } else if (tipo === 'sobre') {
          const idx = state.sobres.findIndex(s => String(s.id) === String(item.id));
          if (idx >= 0) {
            state.sobres[idx].nombre = nameVal;
            state.sobres[idx].presupuesto = impVal;
          }
          saveState();
          renderSobresLista();
          rebuildCategoriasSugerencias();
          showToast('Presupuesto actualizado.');
        } else if (tipo === 'gasto') {
          const idx = state.gastos.findIndex(g => String(g.id) === String(item.id));
          if (idx >= 0) {
            state.gastos[idx].categoria = nameVal;
            state.gastos[idx].importe = impVal;
            state.gastos[idx].fecha = dateVal || item.fecha;
          }
          saveState();
          renderGastosLista();
          renderSobresLista();
          updateResumenYChips();
          showToast('Gasto actualizado.');
        } else if (tipo === 'hucha') {
          const idx = state.huchas.findIndex(h => String(h.id) === String(item.id));
          if (idx >= 0) {
            state.huchas[idx].nombre = nameVal;
            state.huchas[idx].objetivo = impVal;
            if (extraVal !== null && extraVal !== undefined) {
              const saldoNum = Number(extraVal);
              if (!isNaN(saldoNum)) {
                state.huchas[idx].saldo = saldoNum;
              }
            }
          }
          saveState();
          renderHuchas();
          updateResumenYChips();
          showToast('Hucha actualizada.');
        }

        closeEditModal();
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => closeEditModal());
    }
  }

  // ----------------- Mes actual (cabecera) -----------------
  function updateMonthDisplay() {
    const monthEl = document.getElementById('monthLabel');
    if (monthEl) {
      monthEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
  }

  function changeMonth(diff) {
    currentMonth += diff;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    updateMonthDisplay();
    renderAll();
  }

  function setupMonthPicker() {
    const dropdown = document.getElementById('monthDropdown');
    const openBtn = document.getElementById('monthLabel');
    const overlay = document.getElementById('monthOverlay');

    if (!dropdown || !openBtn || !overlay) return;

    function close() {
      dropdown.classList.remove('show');
      overlay.classList.remove('show');
    }

    function open() {
      const selector = document.getElementById('monthPicker');
      if (!selector) return;
      selector.innerHTML = '';
      const currentYMKey = getCurrentMonthKey();

      for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        const group = document.createElement('div');
        group.className = 'month-year-group';

        const h = document.createElement('div');
        h.className = 'month-year-title';
        h.textContent = y;
        group.appendChild(h);

        const grid = document.createElement('div');
        grid.className = 'month-grid';

        for (let m = 0; m < 12; m++) {
          const ymKey = `${y}-${String(m + 1).padStart(2, '0')}`;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'month-grid-item';
          if (ymKey === currentYMKey) btn.classList.add('active');
          btn.textContent = monthNames[m].slice(0, 3);
          btn.addEventListener('click', () => {
            currentYear = y;
            currentMonth = m;
            updateMonthDisplay();
            renderAll();
            close();
          });
          grid.appendChild(btn);
        }

        group.appendChild(grid);
        selector.appendChild(group);
      }

      dropdown.classList.add('show');
      overlay.classList.add('show');
    }

    openBtn.addEventListener('click', open);
    overlay.addEventListener('click', close);
  }

  // ----------------- Ingresos base -----------------
  function renderIngresosBase() {
    const juanEl = document.getElementById('ingJuan');
    const sarayEl = document.getElementById('ingSaray');
    const otrosEl = document.getElementById('ingOtros');

    if (juanEl) juanEl.value = state.ingresosBase.juan || 0;
    if (sarayEl) sarayEl.value = state.ingresosBase.saray || 0;
    if (otrosEl) otrosEl.value = state.ingresosBase.otros || 0;
  }

  function setupIngresosBase() {
    const juanEl = document.getElementById('ingJuan');
    const sarayEl = document.getElementById('ingSaray');
    const otrosEl = document.getElementById('ingOtros');
    const btnSave = document.getElementById('btnSaveIngresosBase');

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const juan = Number(juanEl && juanEl.value) || 0;
        const saray = Number(sarayEl && sarayEl.value) || 0;
        const otros = Number(otrosEl && otrosEl.value) || 0;
        state.ingresosBase = { juan, saray, otros };
        saveState();
        updateResumenYChips();
        showToast('Ingresos base guardados.');
      });
    }
  }

  // ----------------- Ingresos puntuales -----------------
  function renderIngresosPuntuales() {
    const cont = document.getElementById('ingresosPuntualesLista');
    if (!cont) return;

    const ingresosMes = getIngresosPuntualesMes(currentYear, currentMonth);
    if (!ingresosMes.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💶</div>
          No has añadido ingresos puntuales este mes.
        </div>`;
      return;
    }

    cont.innerHTML = '';
    ingresosMes.forEach(ing => {
      const item = document.createElement('div');
      item.className = 'pill-item';
      item.innerHTML = `
        <div class="pill-main">
          <div class="pill-line1">${formatCurrency(ing.importe)} · ${(ing.desc || 'Ingreso puntual')}</div>
          <div class="pill-line2">${ing.fecha || ''}</div>
        </div>
        <div class="pill-actions">
          <button class="btn btn-edit" data-action="edit" data-id="${ing.id}">✏</button>
          <button class="btn btn-danger-chip" data-action="del" data-id="${ing.id}">🗑</button>
        </div>
      `;
      cont.appendChild(item);
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este ingreso puntual?', () => {
          state.ingresosPuntuales = state.ingresosPuntuales.filter(i => String(i.id) !== String(id));
          saveState();
          renderIngresosPuntuales();
          updateResumenYChips();
          showToast('Ingreso puntual eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const ing = state.ingresosPuntuales.find(i => String(i.id) === String(id));
        if (!ing) return;
        openEditModal('ingresoPuntual', ing);
      });
    });
  }

  function setupIngresosPuntuales() {
    const fechaEl = document.getElementById('ingresoPuntualFecha');
    const descEl = document.getElementById('ingresoPuntualDesc');
    const impEl = document.getElementById('ingresoPuntualImporte');
    const btnAdd = document.getElementById('btnAddIngresoPuntual');

    if (fechaEl && !fechaEl.value) {
      const today = new Date();
      fechaEl.value = today.toISOString().slice(0, 10);
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const fecha = fechaEl && fechaEl.value;
        const desc = descEl && descEl.value.trim();
        const importe = Number(impEl && impEl.value);

        if (!fecha) {
          showToast('Pon una fecha.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.ingresosPuntuales.push({ id, fecha, desc, importe });
        saveState();

        if (descEl) descEl.value = '';
        if (impEl) impEl.value = '';

        renderIngresosPuntuales();
        updateResumenYChips();
        showToast('Ingreso puntual añadido.');
      });
    }
  }

  // ----------------- Gastos fijos -----------------
  function renderFijosLista() {
    const cont = document.getElementById('fijosLista');
    if (!cont) return;

    const ymNow = { year: currentYear, month: currentMonth };

    const visibles = (state.fijos || []).filter(f => {
      if (!f.endMonth) return true;
      const ym = parseDateToYM(f.endMonth);
      if (!ym) return true;
      return compareYM(ymNow.year, ymNow.month, ym.year, ym.month) <= 0;
    });

    if (!visibles.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏠</div>
          No tienes gastos fijos activos este mes.
        </div>`;
      return;
    }

    cont.innerHTML = '';
    visibles.forEach(f => {
      let endInfo = '';
      if (f.endMonth) {
        const ym = parseDateToYM(f.endMonth);
        if (ym) {
          endInfo = ` · hasta ${monthNames[ym.month]} ${ym.year}`;
        }
      }

      const item = document.createElement('div');
      item.className = 'pill-item';
      item.innerHTML = `
        <div class="pill-main">
          <div class="pill-line1">${f.nombre || 'Sin nombre'}</div>
          <div class="pill-line2">${formatCurrency(f.importe)}${endInfo}</div>
        </div>
        <div class="pill-actions">
          <button class="btn btn-edit" data-action="edit" data-id="${f.id}">✏</button>
          <button class="btn btn-danger-chip" data-action="end" data-id="${f.id}" title="Marcar mes de fin">📅</button>
          <button class="btn btn-danger-chip" data-action="del" data-id="${f.id}" title="Eliminar definitivamente">🗑</button>
        </div>
      `;
      cont.appendChild(item);
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este gasto fijo definitivamente?', () => {
          state.fijos = state.fijos.filter(f => String(f.id) !== String(id));
          saveState();
          renderFijosLista();
          updateResumenYChips();
          showToast('Gasto fijo eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="end"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const fijo = state.fijos.find(f => String(f.id) === String(id));
        if (!fijo) return;

        const end = prompt('Introduce mes de fin en formato AAAA-MM (por ejemplo 2028-10):', fijo.endMonth || getCurrentMonthKey());
        if (!end) return;

        const ym = parseDateToYM(`${end}-01`.slice(0, 10));
        if (!ym) {
          showToast('Formato de fecha no válido.');
          return;
        }

        fijo.endMonth = `${ym.year}-${String(ym.month + 1).padStart(2, '0')}`;
        saveState();
        renderFijosLista();
        updateResumenYChips();
        showToast('Mes de fin actualizado.');
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const fijo = state.fijos.find(f => String(f.id) === String(id));
        if (!fijo) return;
        openEditModal('fijo', fijo);
      });
    });
  }

  function setupFijos() {
    const nombreEl = document.getElementById('fijoNombre');
    const impEl = document.getElementById('fijoImporte');
    const btnAdd = document.getElementById('btnAddFijo');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const nombre = nombreEl && nombreEl.value.trim();
        const importe = Number(impEl && impEl.value);

        if (!nombre) {
          showToast('Pon un nombre al gasto fijo.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.fijos.push({ id, nombre, importe, endMonth: null });
        saveState();

        if (nombreEl) nombreEl.value = '';
        if (impEl) impEl.value = '';

        renderFijosLista();
        updateResumenYChips();
        showToast('Gasto fijo añadido.');
      });
    }
  }

  // ----------------- Gastos puntuales -----------------
  function renderGastosLista() {
    const cont = document.getElementById('gastosLista');
    if (!cont) return;

    const list = getGastosMes(currentYear, currentMonth);
    if (!list.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🧾</div>
          No has añadido gastos este mes.
        </div>`;
      return;
    }

    cont.innerHTML = '';
    list.forEach(g => {
      const fecha = g.fecha;
      const item = document.createElement('div');
      item.className = 'expense-item';
      item.innerHTML = `
        <div class="expense-main">
          <div class="expense-line1">${formatCurrency(g.importe)} · ${g.categoria || 'Sin categoría'}</div>
          <div class="expense-line2">${fecha || ''} · ${g.desc || ''}</div>
        </div>
        <div class="expense-actions">
          <button class="btn btn-edit" data-action="edit" data-id="${g.id}">✏</button>
          <button class="btn btn-danger-chip" data-action="del" data-id="${g.id}">🗑</button>
        </div>
      `;
      cont.appendChild(item);
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este gasto?', () => {
          state.gastos = state.gastos.filter(g => String(g.id) !== String(id));
          saveState();
          renderGastosLista();
          renderSobresLista();
          updateResumenYChips();
          showToast('Gasto eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const gasto = state.gastos.find(g => String(g.id) === String(id));
        if (!gasto) return;
        openEditModal('gasto', gasto);
      });
    });
  }

  function setupGastos() {
    const fechaEl = document.getElementById('gastoFecha');
    const catEl = document.getElementById('gastoCategoria');
    const descEl = document.getElementById('gastoDesc');
    const impEl = document.getElementById('gastoImporte');
    const btnAdd = document.getElementById('btnAddGasto');

    if (fechaEl && !fechaEl.value) {
      const today = new Date();
      fechaEl.value = today.toISOString().slice(0, 10);
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const fecha = fechaEl && fechaEl.value;
        const categoria = catEl && catEl.value.trim();
        const desc = descEl && descEl.value.trim();
        const importe = Number(impEl && impEl.value);

        if (!fecha) {
          showToast('Pon una fecha.');
          return;
        }
        if (!categoria) {
          showToast('Pon una categoría.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.gastos.push({ id, fecha, categoria, desc, importe });
        saveState();

        if (descEl) descEl.value = '';
        if (impEl) impEl.value = '';

        renderGastosLista();
        renderSobresLista();
        rebuildCategoriasSugerencias();
        updateResumenYChips();
        showToast('Gasto añadido.');
      });
    }
  }

  // ----------------- Sobres / presupuestos -----------------
  function renderSobresLista() {
    const cont = document.getElementById('sobresLista');
    if (!cont) return;

    const sobres = state.sobres || [];
    if (!sobres.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📩</div>
          No hay presupuestos creados.
        </div>`;
      return;
    }

    const gastosMes = getGastosMes(currentYear, currentMonth);
    cont.innerHTML = '';

    sobres.forEach(s => {
      const totalGastado = gastosMes
        .filter(g => (g.categoria || '').toLowerCase() === (s.nombre || '').toLowerCase())
        .reduce((sum, g) => sum + (Number(g.importe) || 0), 0);

      const presupuesto = Number(s.presupuesto) || 0;
      const restante = presupuesto - totalGastado;

      let statusClass = 'good';
      let statusText = 'Dentro de presupuesto';
      const ratio = presupuesto > 0 ? totalGastado / presupuesto : 0;

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

      const pct = presupuesto > 0 ? Math.min(100, (totalGastado / presupuesto) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="budget-card-header">
          <div class="budget-name">📩 ${s.nombre || 'Sin nombre'}</div>
          <div>
            <button class="btn btn-edit" data-action="edit" data-id="${s.id}">✏</button>
            <button class="btn btn-danger-chip" data-action="del" data-id="${s.id}">🗑</button>
          </div>
        </div>
        <div class="budget-amounts">
          <div class="budget-amount-item">
            <div class="budget-amount-label">Presupuesto</div>
            <div class="budget-amount-value">${formatCurrency(presupuesto)}</div>
          </div>
          <div class="budget-amount-item">
            <div class="budget-amount-label">Gastado</div>
            <div class="budget-amount-value">${formatCurrency(totalGastado)}</div>
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
      cont.appendChild(card);
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar este sobre/presupuesto?', () => {
          state.sobres = state.sobres.filter(s => String(s.id) !== String(id));
          saveState();
          renderSobresLista();
          rebuildCategoriasSugerencias();
          showToast('Presupuesto eliminado.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const sobre = state.sobres.find(s => String(s.id) === String(id));
        if (!sobre) return;
        openEditModal('sobre', sobre);
      });
    });
  }

  function setupSobres() {
    const nombreEl = document.getElementById('sobreNombre');
    const impEl = document.getElementById('sobreImporte');
    const btnAdd = document.getElementById('btnAddSobre');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const nombre = nombreEl && nombreEl.value.trim();
        const presupuesto = Number(impEl && impEl.value);

        if (!nombre) {
          showToast('Pon un nombre al presupuesto.');
          return;
        }
        if (isNaN(presupuesto)) {
          showToast('El presupuesto debe ser un número válido.');
          return;
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.sobres.push({ id, nombre, presupuesto });
        saveState();

        if (nombreEl) nombreEl.value = '';
        if (impEl) impEl.value = '';

        renderSobresLista();
        rebuildCategoriasSugerencias();
        showToast('Presupuesto creado.');
      });
    }
  }

  // ----------------- Huchas -----------------
  function renderHuchas() {
    const cont = document.getElementById('huchasLista');
    const select = document.getElementById('huchaSelect');
    if (!cont) return;

    if (select) {
      select.innerHTML = '<option value="">-- Elige una hucha --</option>';
    }

    const list = state.huchas || [];
    if (!list.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🐷</div>
          No has creado ninguna hucha todavía.
        </div>`;
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
          <div class="budget-name">🐷 ${h.nombre || 'Hucha sin nombre'}</div>
          <div>
            <button class="btn btn-edit" data-action="edit" data-id="${h.id}">✏</button>
            <button class="btn btn-danger-chip" data-action="del" data-id="${h.id}">🗑</button>
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
          ${objetivo
            ? (ratio >= 1 ? '¡Objetivo conseguido!' : 'Progreso hacia objetivo')
            : 'Hucha sin objetivo fijo'}
        </div>
      `;
      cont.appendChild(card);

      if (select) {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = `${h.nombre} (${formatCurrency(saldo)})`;
        select.appendChild(opt);
      }
    });

    cont.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        openConfirm('¿Eliminar esta hucha? El saldo se perderá en el control.', () => {
          state.huchas = state.huchas.filter(h => String(h.id) !== String(id));
          saveState();
          renderHuchas();
          updateResumenYChips();
          showToast('Hucha eliminada.');
        });
      });
    });

    cont.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const hucha = state.huchas.find(h => String(h.id) === String(id));
        if (!hucha) return;
        openEditModal('hucha', hucha);
      });
    });
  }

  function setupHuchas() {
    const nombreEl = document.getElementById('huchaNombre');
    const objEl = document.getElementById('huchaObjetivo');
    const saldoEl = document.getElementById('huchaSaldoInicial');
    const btnAdd = document.getElementById('btnAddHucha');

    const select = document.getElementById('huchaSelect');
    const impMovEl = document.getElementById('huchaImporte');
    const accionEl = document.getElementById('huchaAccion');
    const btnMov = document.getElementById('btnHuchaMovimiento');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const nombre = nombreEl && nombreEl.value.trim();
        const objetivo = Number(objEl && objEl.value) || 0;
        const saldoInicial = Number(saldoEl && saldoEl.value) || 0;

        if (!nombre) {
          showToast('Pon un nombre a la hucha.');
          return;
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        state.huchas.push({ id, nombre, objetivo, saldo: saldoInicial });
        saveState();

        if (nombreEl) nombreEl.value = '';
        if (objEl) objEl.value = '';
        if (saldoEl) saldoEl.value = '';

        renderHuchas();
        updateResumenYChips();
        showToast('Hucha creada.');
      });
    }

    if (btnMov) {
      btnMov.addEventListener('click', () => {
        const huchaId = select && select.value;
        const importe = Number(impMovEl && impMovEl.value);
        const accion = accionEl && accionEl.value;

        if (!huchaId) {
          showToast('Elige una hucha.');
          return;
        }
        if (!(importe > 0)) {
          showToast('El importe debe ser mayor que 0.');
          return;
        }
        const hucha = state.huchas.find(h => String(h.id) === String(huchaId));
        if (!hucha) {
          showToast('Hucha no encontrada.');
          return;
        }

        if (accion === 'ingresar') {
          hucha.saldo = (Number(hucha.saldo) || 0) + importe;
        } else if (accion === 'retirar') {
          hucha.saldo = (Number(hucha.saldo) || 0) - importe;
        }

        saveState();
        if (impMovEl) impMovEl.value = '';
        renderHuchas();
        updateResumenYChips();
        showToast('Movimiento registrado.');
      });
    }
  }

  // ----------------- Notas -----------------
  function renderNotas() {
    const txt = document.getElementById('notasMes');
    if (!txt) return;
    const key = getCurrentMonthKey();
    txt.value = state.notasPorMes[key] || '';
  }

  function setupNotas() {
    const txt = document.getElementById('notasMes');
    if (!txt) return;
    txt.addEventListener('change', () => {
      const key = getCurrentMonthKey();
      state.notasPorMes[key] = txt.value || '';
      saveState();
      showToast('Notas guardadas.');
    });
  }

  // ----------------- Resumen cabecera -----------------
  function updateResumenYChips() {
    const ymNow = { year: currentYear, month: currentMonth };

    const ingresosBaseTotal =
      (Number(state.ingresosBase.juan) || 0) +
      (Number(state.ingresosBase.saray) || 0) +
      (Number(state.ingresosBase.otros) || 0);

    const ingresosPuntualesMes = getIngresosPuntualesMes(currentYear, currentMonth)
      .reduce((sum, ing) => sum + (Number(ing.importe) || 0), 0);

    let fijosMes = 0;
    (state.fijos || []).forEach(f => {
      if (!f.endMonth) {
        fijosMes += Number(f.importe) || 0;
      } else {
        const ym = parseDateToYM(f.endMonth);
        if (!ym) {
          fijosMes += Number(f.importe) || 0;
        } else {
          if (compareYM(ymNow.year, ymNow.month, ym.year, ym.month) <= 0) {
            fijosMes += Number(f.importe) || 0;
          }
        }
      }
    });

    const gastosMes = getGastosMes(currentYear, currentMonth).reduce(
      (sum, g) => sum + (Number(g.importe) || 0),
      0
    );

    const huchasSaldoTotal = (state.huchas || []).reduce(
      (sum, h) => sum + (Number(h.saldo) || 0),
      0
    );

    const totalIngresos = ingresosBaseTotal + ingresosPuntualesMes;
    const totalGastos = fijosMes + gastosMes;
    const balance = totalIngresos - totalGastos - huchasSaldoTotal;

    const ingresoEl = document.getElementById('chipIngresosValor');
    const gastoEl = document.getElementById('chipGastosValor');
    const balanceEl = document.getElementById('chipBalanceValor');
    const huchasEl = document.getElementById('chipHuchasValor');

    if (ingresoEl) ingresoEl.textContent = formatCurrency(totalIngresos);
    if (gastoEl) gastoEl.textContent = formatCurrency(totalGastos);
    if (balanceEl) balanceEl.textContent = formatCurrency(balance);
    if (huchasEl) huchasEl.textContent = formatCurrency(huchasSaldoTotal);
  }

  // ----------------- Export / Import JSON -----------------
  function setupExportImportJson() {
    const btnExport = document.getElementById('btnExportJson');
    const btnImport = document.getElementById('btnImportJson');
    const fileInput = document.getElementById('fileImportJson');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `economia_familiar_${getCurrentMonthKey()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Datos exportados en JSON.');
      });
    }

    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const imported = JSON.parse(e.target.result);
            if (!imported || typeof imported !== 'object') {
              showToast('El archivo no tiene un formato válido.');
              return;
            }

            const overwrite = confirm('¿Quieres sobrescribir todos los datos actuales con el archivo importado?\n\nAceptar = Sobrescribir\nCancelar = Intentar fusionar sin borrar lo existente.');

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
                currentArr.forEach(item => map.set(String(item.id), item));
                newArr.forEach(item => {
                  const key = String(item.id);
                  if (map.has(key)) {
                    const replace = confirm(`Se ha encontrado un elemento con el mismo id (${key}).\n¿Quieres sobrescribirlo?\nAceptar = Sobrescribir\nCancelar = Mantener el existente.`);
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
              state.ingresosPuntuales = mergeById(
                state.ingresosPuntuales,
                imported.ingresosPuntuales || []
              );
              state.gastos = mergeById(state.gastos, imported.gastos || []);
              state.notasPorMes = { ...state.notasPorMes, ...(imported.notasPorMes || {}) };
            }

            saveState();
            renderAll();
            showToast('Datos importados correctamente.');
          } catch (err) {
            console.error('Error importando JSON:', err);
            showToast('Error al importar el archivo JSON.');
          } finally {
            fileInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  // ----------------- Import CSV (solo gastos) -----------------
  function setupImportCsv() {
    const btnImportCsv = document.getElementById('btnImportCsv');
    const fileInputCsv = document.getElementById('fileImportCsv');

    if (!btnImportCsv || !fileInputCsv) return;

    btnImportCsv.addEventListener('click', () => fileInputCsv.click());

    fileInputCsv.addEventListener('change', () => {
      const file = fileInputCsv.files && fileInputCsv.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length <= 1) {
            showToast('El CSV no contiene datos suficientes.');
            return;
          }
          const header = lines[0].split(';').map(h => h.trim().toLowerCase());
          const idxFecha = header.indexOf('fecha');
          const idxCat = header.indexOf('categoria');
          const idxDesc = header.indexOf('descripcion');
          const idxImporte = header.indexOf('importe');

          if (idxFecha === -1 || idxCat === -1 || idxImporte === -1) {
            showToast('El CSV debe contener al menos las columnas: fecha, categoria, importe.');
            return;
          }

          const nuevos = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            const fecha = cols[idxFecha] ? cols[idxFecha].trim() : '';
            const categoria = cols[idxCat] ? cols[idxCat].trim() : '';
            const desc = idxDesc >= 0 && cols[idxDesc] ? cols[idxDesc].trim() : '';
            const importe = Number((cols[idxImporte] || '').replace(',', '.'));

            if (!fecha || !categoria || !(importe > 0)) continue;

            const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
            nuevos.push({ id, fecha, categoria, desc, importe });
          }

          if (!nuevos.length) {
            showToast('No se encontraron filas válidas en el CSV.');
            return;
          }

          const sobrescribir = confirm('¿Quieres fusionar estos gastos con los existentes o sobrescribirlos?\nAceptar = Sobrescribir\nCancelar = Fusionar.');
          if (sobrescribir) {
            state.gastos = nuevos;
          } else {
            state.gastos = [...state.gastos, ...nuevos];
          }

          saveState();
          renderGastosLista();
          renderSobresLista();
          updateResumenYChips();
          showToast('Gastos importados desde CSV.');
        } catch (err) {
          console.error('Error importando CSV:', err);
          showToast('Error al importar el archivo CSV.');
        } finally {
          fileInputCsv.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // ----------------- Reset de datos -----------------
  function setupReset() {
    const btnReset = document.getElementById('btnResetAll');
    if (!btnReset) return;
    btnReset.addEventListener('click', () => {
      openConfirm('¿Seguro que quieres borrar TODOS los datos de la app?', () => {
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
        showToast('Todos los datos han sido borrados.');
      });
    });
  }

  // ----------------- Sugerencias de categorías -----------------
  function rebuildCategoriasSugerencias() {
    const datalist = document.getElementById('categoriasSugeridas');
    if (!datalist) return;

    const nombresSobres = (state.sobres || []).map(s => (s.nombre || '').trim()).filter(Boolean);
    const nombresGastos = (state.gastos || []).map(g => (g.categoria || '').trim()).filter(Boolean);

    const set = new Set([...nombresSobres, ...nombresGastos]);
    datalist.innerHTML = '';
    Array.from(set).sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      datalist.appendChild(opt);
    });
  }

  // ----------------- Swipe entre pestañas -----------------
  function setupSwipe() {
    const app = document.querySelector('.app');
    const tabs = Array.from(document.querySelectorAll('[data-tab]'));
    const sections = Array.from(document.querySelectorAll('.tab-section'));

    if (!app || !tabs.length || !sections.length) return;

    let currentIndex = tabs.findIndex(t => t.classList.contains('active'));
    if (currentIndex < 0) currentIndex = 0;

    function activateTab(index, direction = 0) {
      if (index < 0 || index >= tabs.length || index === currentIndex) return;

      const newTab = tabs[index];
      const oldTab = tabs[currentIndex];

      oldTab.classList.remove('active');
      newTab.classList.add('active');

      const oldSectionId = oldTab.getAttribute('data-tab');
      const newSectionId = newTab.getAttribute('data-tab');

      const oldSection = document.getElementById(oldSectionId);
      const newSection = document.getElementById(newSectionId);
      if (!oldSection || !newSection) return;

      sections.forEach(sec => sec.classList.remove('active', 'slide-in-left', 'slide-in-right', 'slide-out-left', 'slide-out-right'));

      oldSection.classList.add(direction === 1 ? 'slide-out-left' : direction === -1 ? 'slide-out-right' : '');
      newSection.classList.add('active', direction === 1 ? 'slide-in-right' : direction === -1 ? 'slide-in-left' : '');

      currentIndex = index;
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        const direction = index > currentIndex ? 1 : -1;
        activateTab(index, direction);
      });
    });

    let startX = 0;
    let isSwiping = false;

    app.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      isSwiping = true;
    });

    app.addEventListener('touchmove', e => {
      if (!isSwiping || e.touches.length !== 1) return;
      const diffX = e.touches[0].clientX - startX;
      if (Math.abs(diffX) > 50) {
        isSwiping = false;
        if (diffX < 0 && currentIndex < tabs.length - 1) {
          activateTab(currentIndex + 1, 1);
        } else if (diffX > 0 && currentIndex > 0) {
          activateTab(currentIndex - 1, -1);
        }
      }
    });

    app.addEventListener('touchend', () => {
      isSwiping = false;
    });
  }

  // ----------------- Render global -----------------
  function renderAll() {
    updateMonthDisplay();
    renderIngresosBase();
    renderIngresosPuntuales();
    renderFijosLista();
    renderGastosLista();
    renderSobresLista();
    renderHuchas();
    renderNotas();
    updateResumenYChips();
  }

  // ----------------- Inicio -----------------
  document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateMonthDisplay();
    setupMonthPicker();

    const prevBtn = document.getElementById('btnPrevMonth');
    const nextBtn = document.getElementById('btnNextMonth');
    if (prevBtn) prevBtn.addEventListener('click', () => changeMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeMonth(1));

    setupIngresosBase();
    setupIngresosPuntuales();
    setupFijos();
    setupGastos();
    setupSobres();
    setupHuchas();
    setupNotas();
    setupExportImportJson();
    setupImportCsv();
    setupReset();
    setupEditModalEvents();
    setupConfirmModalEvents();
    setupSwipe();

    rebuildCategoriasSugerencias();
    renderAll();
  });
})();
