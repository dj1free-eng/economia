// Swipe entre pestañas tipo carrusel
(function () {
  const wrapper = document.querySelector('.tabs-wrapper') || document.querySelector('.app');
  const container = document.querySelector('.tabs-container');
  const sections = Array.from(document.querySelectorAll('.tab-section'));
  const buttons  = Array.from(document.querySelectorAll('.tab-btn'));

  if (!wrapper || !container || sections.length === 0 || buttons.length === 0) {
    return; // si algo no existe, no hacemos nada
  }

  let startX = 0;
  let isSwiping = false;

  function getActiveIndex() {
    return sections.findIndex(sec => sec.classList.contains('active'));
  }

  function activateTabByIndex(index) {
    if (index < 0 || index >= sections.length) return;

    sections.forEach((sec, i) => {
      sec.classList.toggle('active', i === index);
    });

    buttons.forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });
  }

  function handleSwipe(dx) {
    const threshold = 60; // mínimo movimiento horizontal en px
    if (Math.abs(dx) < threshold) return;

    const current = getActiveIndex();
    let target = current;
    let directionClass = null;

    if (dx < 0 && current < sections.length - 1) {
      // arrastras a la izquierda → siguiente pestaña
      target = current + 1;
      directionClass = 'slide-left';
    } else if (dx > 0 && current > 0) {
      // arrastras a la derecha → pestaña anterior
      target = current - 1;
      directionClass = 'slide-right';
    }

    if (target === current || !directionClass) return;

    // Reset de clases por si hubiera alguna previa
    container.classList.remove('slide-left', 'slide-right');
    // Fuerza reflow para reiniciar animación
    void container.offsetWidth;

    container.classList.add(directionClass);

    // Cuando termina la animación lateral, cambiamos de pestaña
    setTimeout(() => {
      container.classList.remove('slide-left', 'slide-right');
      activateTabByIndex(target);
    }, 280); // debe coincidir con el transition de CSS
  }

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    isSwiping = true;
    startX = e.touches[0].clientX;
  }, { passive: true });

  wrapper.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    handleSwipe(dx);
  });
})();
