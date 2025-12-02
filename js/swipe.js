
// Swipe between main tabs (sections)
(function() {
  const container = document.querySelector('.tabs-container');
  if (!container) return;

  const sections = Array.from(document.querySelectorAll('.tab-section'));
  const order = sections.map(sec => sec.dataset.tab).filter(Boolean);

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  function getActiveIndex() {
    const active = sections.find(sec => sec.classList.contains('active'));
    if (!active) return 0;
    const tab = active.dataset.tab;
    return Math.max(0, order.indexOf(tab));
  }

  container.addEventListener('touchstart', (e) => {
    if (!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    isSwiping = false;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (!isSwiping && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const threshold = 60;
    if (Math.abs(dx) < threshold) return;

    let idx = getActiveIndex();
    if (dx < 0 && idx < order.length - 1) {
      idx += 1; // swipe left -> next tab
    } else if (dx > 0 && idx > 0) {
      idx -= 1; // swipe right -> previous tab
    } else {
      return;
    }
    const nextTab = order[idx];
    if (nextTab && typeof window.activateTab === 'function') {
      window.activateTab(nextTab);
    }
  }, { passive: true });
})();
