// Swipe entre pestañas principales (sections)
(function () {
  const container = document.querySelector(".tabs-container");
  if (!container) return;

  const sections = Array.from(document.querySelectorAll(".tab-section"));
  const order = sections.map(sec => sec.dataset.tab).filter(Boolean);

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  function getActiveIndex() {
    const active = document.querySelector(".tab-section.active");
    if (!active) return 0;
    const tab = active.dataset.tab;
    const idx = order.indexOf(tab);
    return idx >= 0 ? idx : 0;
  }

  // Inicio del gesto
  container.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    startX = t.clientX;
    startY = t.clientY;
    isSwiping = true;
  }, { passive: true });

  // Comprobar si es swipe horizontal o scroll vertical
  container.addEventListener("touchmove", (e) => {
    if (!isSwiping) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // Si hay más movimiento vertical que horizontal, cancelamos swipe
    if (Math.abs(dy) > Math.abs(dx)) {
      isSwiping = false;
      return;
    }
  }, { passive: true });

  // Fin del gesto
  container.addEventListener("touchend", (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    const threshold = 40;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;

    let idx = getActiveIndex();

    if (dx < 0 && idx < order.length - 1) {
      // swipe izquierda → siguiente pestaña
      idx += 1;
    } else if (dx > 0 && idx > 0) {
      // swipe derecha → pestaña anterior
      idx -= 1;
    } else {
      return;
    }

    const nextTab = order[idx];
if (nextTab && typeof window.activateTab === "function") {
  const direction = dx < 0 ? "left" : "right";
  window.activateTab(nextTab, direction);
}
  }, { passive: true });
})();
