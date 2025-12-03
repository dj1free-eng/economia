// SWIPE LATERAL ENTRE PESTAÑAS (animación tipo carrusel)

const tabsWrapper = document.querySelector('.tabs-wrapper');
const tabSections = Array.from(document.querySelectorAll('.tab-section'));
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));

let startX = 0;
let startY = 0;
let isSwiping = false;

// Índice actual basado en la sección activa
let currentIndex = tabSections.findIndex(sec => sec.classList.contains('active'));
if (currentIndex < 0) currentIndex = 0;

// Aplica cambio de pestaña + animación lateral
function setActiveTabByIndex(newIndex) {
  if (newIndex === currentIndex || newIndex < 0 || newIndex >= tabSections.length) return;

  const oldSection = tabSections[currentIndex];
  const newSection = tabSections[newIndex];

  const direction = newIndex > currentIndex ? 'right' : 'left';

  // Sincronizar con el sistema de pestañas principal (app.js)
  if (newSection && newSection.dataset && window.activateTab) {
    const targetTab = newSection.dataset.tab;
    if (targetTab) {
      window.activateTab(targetTab);
    }
  }

  // El DOM ya tiene la nueva sección marcada como .active por activateTab
  // → solo añadimos la animación adecuada.
  tabSections.forEach(sec => {
    sec.classList.remove('slide-in-from-right', 'slide-in-from-left');
  });

  if (direction === 'right') {
    newSection.classList.add('slide-in-from-right');
  } else {
    newSection.classList.add('slide-in-from-left');
  }

  // Limpiar la clase de animación al terminar
  newSection.addEventListener('animationend', () => {
    newSection.classList.remove('slide-in-from-right', 'slide-in-from-left');
  }, { once: true });

  currentIndex = newIndex;
}

if (tabsWrapper) {
  tabsWrapper.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  tabsWrapper.addEventListener('touchmove', (e) => {
    if (!isSwiping || !e.touches || e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = Math.abs(currentX - startX);
    const diffY = Math.abs(currentY - startY);

    // Si el movimiento es más vertical que horizontal, cancelar el swipe
    if (diffY > diffX) {
      isSwiping = false;
    }
  }, { passive: true });

  tabsWrapper.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    if (!e.changedTouches || !e.changedTouches.length) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    const UMBRAL = 50; // píxeles mínimos para considerar el swipe
    if (Math.abs(diff) < UMBRAL) return;

    if (diff < 0 && currentIndex < tabSections.length - 1) {
      // Swipe hacia la izquierda → siguiente pestaña
      setActiveTabByIndex(currentIndex + 1);
    } else if (diff > 0 && currentIndex > 0) {
      // Swipe hacia la derecha → pestaña anterior
      setActiveTabByIndex(currentIndex - 1);
    }
  }, { passive: true });

  // Prevenir scroll horizontal accidental
  tabsWrapper.addEventListener('touchmove', (e) => {
    if (isSwiping && e.touches && e.touches.length === 1) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(currentX - startX);
      const diffY = Math.abs(currentY - startY);

      // Solo prevenir scroll si es claramente horizontal
      if (diffX > diffY && diffX > 10) {
        e.preventDefault();
      }
    }
  }, { passive: false });
}

// No añadimos listeners a los botones aquí, eso ya lo hace app.js
