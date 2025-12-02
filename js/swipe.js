// SWIPE LATERAL ENTRE PESTAÑAS

const tabsContainer = document.querySelector(".tabs-container");
const tabSections = document.querySelectorAll(".tab-section");
const tabButtons = document.querySelectorAll(".tab-btn");

// Orden lógico de las pestañas
const tabOrder = ["ingresos", "fijos", "gastos", "sobres", "huchas", "config"];

let startX = 0;
let endX = 0;

// Detectar pestaña activa inicial
let currentTabIndex = 0;
tabSections.forEach((sec, idx) => {
  if (sec.classList.contains("active")) {
    currentTabIndex = idx;
  }
});

function setActiveTabByIndex(newIndex, direction) {
  if (newIndex < 0 || newIndex >= tabOrder.length) return;

  currentTabIndex = newIndex;
  const newTab = tabOrder[newIndex];

  // Cambiar sección activa
  tabSections.forEach(sec => {
    sec.classList.toggle(
      "active",
      sec.getAttribute("data-tab") === newTab
    );
  });

  // Cambiar botón activo
  tabButtons.forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-tab-target") === newTab
    );
  });

  // Empujoncito visual en la dirección del swipe
  if (direction === "left") {
    tabsContainer.classList.add("swipe-left");
    setTimeout(() => tabsContainer.classList.remove("swipe-left"), 160);
  } else if (direction === "right") {
    tabsContainer.classList.add("swipe-right");
    setTimeout(() => tabsContainer.classList.remove("swipe-right"), 160);
  }
}

// Swipe sobre el cuerpo de pestañas
if (tabsContainer) {
  tabsContainer.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches.length) return;
    startX = e.touches[0].clientX;
  });

  tabsContainer.addEventListener("touchend", (e) => {
    if (!e.changedTouches || !e.changedTouches.length) return;
    endX = e.changedTouches[0].clientX;
    handleSwipe();
  });
}

function handleSwipe() {
  const diff = endX - startX;

  // Umbral mínimo para que cuente como swipe
  if (Math.abs(diff) < 50) return;

  if (diff < 0 && currentTabIndex < tabOrder.length - 1) {
    // Swipe hacia la izquierda → siguiente pestaña
    setActiveTabByIndex(currentTabIndex + 1, "left");
  } else if (diff > 0 && currentTabIndex > 0) {
    // Swipe hacia la derecha → pestaña anterior
    setActiveTabByIndex(currentTabIndex - 1, "right");
  }
}

// Sincronizar cuando pulsas los botones de abajo
tabButtons.forEach((btn, idx) => {
  btn.addEventListener("click", () => {
    setActiveTabByIndex(idx, null);
  });
});
