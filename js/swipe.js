
// SWIPE LATERAL ENTRE PESTAÑAS (animación tipo carrusel)

const tabsWrapper = document.querySelector('.tabs-wrapper');
const tabSections = Array.from(document.querySelectorAll('.tab-section'));
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));

let startX = 0;
let isSwiping = false;
let currentIndex = tabSections.findIndex(sec => sec.classList.contains('active'));
if (currentIndex < 0) currentIndex = 0;

function setActiveTab(newIndex, direction) {
  if (newIndex === currentIndex || newIndex < 0 || newIndex >= tabSections.length) return;

  const currentSection = tabSections[currentIndex];
  const nextSection = tabSections[newIndex];

  tabButtons[currentIndex].classList.remove('active');
  tabButtons[newIndex].classList.add('active');

  // Limpia clases previas
  tabSections.forEach(sec => {
    sec.classList.remove(
      'active',
      'slide-in-from-right',
      'slide-out-to-left',
      'slide-in-from-left',
      'slide-out-to-right'
    );
  });

  // Prepara posiciones iniciales según dirección
  if (direction === 'left') {
    currentSection.classList.add('active');
    nextSection.classList.add('slide-in-from-right');
    void nextSection.offsetWidth;
    currentSection.classList.add('slide-out-to-left');
    nextSection.classList.add('active');
  } else if (direction === 'right') {
    currentSection.classList.add('active');
    nextSection.classList.add('slide-in-from-left');
    void nextSection.offsetWidth;
    currentSection.classList.add('slide-out-to-right');
    nextSection.classList.add('active');
  } else {
    nextSection.classList.add('active');
  }

  currentIndex = newIndex;
}

if (tabsWrapper) {
  tabsWrapper.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    isSwiping = true;
  }, { passive: true });

  tabsWrapper.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    if (!e.changedTouches || !e.changedTouches.length) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    const UMBRAL = 60; // píxeles mínimos para considerar el swipe
    if (Math.abs(diff) < UMBRAL) return;

    if (diff < 0 && currentIndex < tabSections.length - 1) {
      // Swipe hacia la izquierda → siguiente pestaña
      setActiveTab(currentIndex + 1, 'left');
    } else if (diff > 0 && currentIndex > 0) {
      // Swipe hacia la derecha → pestaña anterior
      setActiveTab(currentIndex - 1, 'right');
    }
  }, { passive: true });
}

// Sincroniza con los botones inferiores
tabButtons.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    const direction = idx > currentIndex ? 'left' : 'right';
    setActiveTab(idx, direction);
  });
});
