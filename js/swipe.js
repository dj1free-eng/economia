// Swipe lateral entre pestañas, integrándose con window.activateTab(tabName)

const tabsWrapper = document.querySelector('.tabs-wrapper');
const tabSections = Array.from(document.querySelectorAll('.tab-section'));
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));

let startX_swipe = 0;
let startY_swipe = 0;
let isSwiping = false;

function getCurrentTabIndex() {
  const active = document.querySelector('.tab-section.active');
  return tabSections.indexOf(active);
}

function setActiveTabByIndex(idx) {
  if (idx < 0 || idx >= tabSections.length) return;
  const tabName = tabSections[idx].dataset.tab;
  if (window.activateTab) {
    window.activateTab(tabName);
  } else {
    // fallback mínimo
    tabSections.forEach(sec => {
      sec.classList.toggle('active', sec.dataset.tab === tabName);
    });
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabTarget === tabName);
    });
  }
}

tabButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    // mantener swipe sincronizado
    // (solo actualización implícita, getCurrentTabIndex leerá el activo real)
  });
});

if (tabsWrapper) {
  tabsWrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX_swipe = e.touches[0].clientX;
    startY_swipe = e.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  tabsWrapper.addEventListener('touchmove', (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX_swipe;
    const dy = e.touches[0].clientY - startY_swipe;
    if (Math.abs(dy) > Math.abs(dx)) {
      isSwiping = false; // gesto vertical, no swipe
    }
  }, { passive: true });

  tabsWrapper.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    if (!e.changedTouches || !e.changedTouches.length) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX_swipe;
    const THRESHOLD = 50;
    if (Math.abs(diff) < THRESHOLD) return;

    const currentIndex = getCurrentTabIndex();
    if (diff < 0 && currentIndex < tabSections.length - 1) {
      // hacia la izquierda → pestaña siguiente
      setActiveTabByIndex(currentIndex + 1);
      const newSection = tabSections[currentIndex + 1];
      newSection.classList.add('slide-in-from-right');
      newSection.addEventListener('animationend', () => {
        newSection.classList.remove('slide-in-from-right');
      }, { once: true });
    } else if (diff > 0 && currentIndex > 0) {
      // hacia la derecha → pestaña anterior
      setActiveTabByIndex(currentIndex - 1);
      const newSection = tabSections[currentIndex - 1];
      newSection.classList.add('slide-in-from-left');
      newSection.addEventListener('animationend', () => {
        newSection.classList.remove('slide-in-from-left');
      }, { once: true });
    }
  }, { passive: true });
}
