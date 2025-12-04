// SWIPE LATERAL ENTRE PESTAÑAS (animación tipo carrusel)

const tabsWrapper = document.querySelector('.tabs-wrapper');
const tabSections = Array.from(document.querySelectorAll('.tab-section'));
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));

let startX = 0;
let startY = 0;
let isSwiping = false;
let currentIndex = tabSections.findIndex(sec => sec.classList.contains('active'));
if (currentIndex < 0) currentIndex = 0;

function setActiveTab(newIndex) {
  if (newIndex === currentIndex || newIndex < 0 || newIndex >= tabSections.length) return;

  // Actualizar botones
  tabButtons[currentIndex].classList.remove('active');
  tabButtons[newIndex].classList.add('active');

  // Actualizar secciones
  tabSections.forEach((sec, idx) => {
    sec.classList.remove('active');
    if (idx === newIndex) {
      sec.classList.add('active');
    }
  });

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
      setActiveTab(currentIndex + 1);
    } else if (diff > 0 && currentIndex > 0) {
      // Swipe hacia la derecha → pestaña anterior
      setActiveTab(currentIndex - 1);
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

// Sincroniza con los botones inferiores
tabButtons.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    setActiveTab(idx);
  });
});
