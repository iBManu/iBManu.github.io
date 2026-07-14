if (window.VANTA) {
  VANTA.FOG({
    el: "#vanta-background",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200,
    minWidth: 200
  });
}

const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".nav");
const panels = [...document.querySelectorAll(".hero, .section")];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = value => Math.max(0, Math.min(1, value));
const dialAnchor = () => innerWidth <= 800 ? 0 : -45;

document.body.classList.add("deck-mode");

const progressBar = document.createElement("nav");
progressBar.className = "section-wheel";
progressBar.setAttribute("aria-label", "Secciones del portfolio");
const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
wheelSvg.setAttribute("viewBox", "0 0 100 100");
const tickCount = 84;
const ticksPerPanel = tickCount / panels.length;
for (let index = 0; index < tickCount; index++) {
  const panelIndex = Math.min(panels.length - 1, Math.floor(index / ticksPerPanel));
  const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const major = index % ticksPerPanel === 0;
  tick.setAttribute("x1", "50"); tick.setAttribute("y1", major ? "2" : "4");
  tick.setAttribute("x2", "50"); tick.setAttribute("y2", major ? "14" : "10");
  tick.setAttribute("transform", `rotate(${index * 360 / tickCount} 50 50)`);
  tick.setAttribute("class", `dial-tick${major ? " major" : ""}`);
  tick.dataset.panel = panelIndex;
  tick.dataset.tick = index;
  wheelSvg.append(tick);
  if (major) {
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hit.setAttribute("x1", "50"); hit.setAttribute("y1", "0");
    hit.setAttribute("x2", "50"); hit.setAttribute("y2", "18");
    hit.setAttribute("transform", `rotate(${index * 360 / tickCount} 50 50)`);
    hit.setAttribute("class", "dial-hit");
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", `Ir a la sección ${panelIndex + 1}: ${panels[panelIndex].id}`);
    const go = () => showPanel(panelIndex, panelIndex < activeIndex);
    hit.addEventListener("click", go);
    hit.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) go(); });
    hit.addEventListener("pointerenter", () => tick.classList.add("hover"));
    hit.addEventListener("pointerleave", () => tick.classList.remove("hover"));
    hit.addEventListener("focus", () => tick.classList.add("hover"));
    hit.addEventListener("blur", () => tick.classList.remove("hover"));
    wheelSvg.append(hit);
  } else {
    tick.setAttribute("aria-hidden", "true");
  }
}
const rim = document.createElementNS("http://www.w3.org/2000/svg", "circle");
rim.setAttribute("cx", "50"); rim.setAttribute("cy", "50"); rim.setAttribute("r", "39"); rim.setAttribute("class", "dial-rim");
wheelSvg.append(rim);
progressBar.append(wheelSvg);
const wheelCenter = document.createElement("span"); wheelCenter.className = "wheel-center";
progressBar.append(wheelCenter);
document.body.append(progressBar);

let activeIndex = Math.max(0, panels.findIndex(panel => `#${panel.id}` === location.hash));
let progress = 0;
let renderedProgress = 0;
let touchY = null;
let touchX = null;
let locked = false;
let motionFrame = null;
let pendingDirection = 0;

function piecesFor(panel) {
  const selectors = [
    ".eyebrow", ".hero h1", ".hero-intro", ".hero-actions", ".hero-meta",
    ".section-heading", ".project-card", ".about-label", ".about-copy",
    ".skill", ".timeline article", ".tech > .section-number", ".marquee",
    ".contact-content", "footer"
  ];
  return [...panel.querySelectorAll(selectors.join(","))];
}

panels.forEach(panel => piecesFor(panel).forEach(piece => piece.classList.add("panel-piece")));

function animatePanel(value = renderedProgress) {
  const panel = panels[activeIndex];
  const pieces = piecesFor(panel);
  const eased = value * value * (3 - 2 * value);

  pieces.forEach((piece, index) => {
    const delay = Math.min(.32, index * .045);
    const local = clamp((eased - delay) / (1 - delay));
    const direction = index % 4;
    const x = direction === 0 ? -local * 34 : direction === 2 ? local * 34 : 0;
    const y = direction === 1 ? local * 24 : direction === 3 ? -local * 24 : 0;
    const rotate = (index % 2 ? 1 : -1) * local * 1.5;
    piece.style.transform = `translate3d(${x}vw, ${y}vh, 0) rotate(${rotate}deg)`;
    piece.style.opacity = String(1 - local * 1.08);
  });

  const reachedTick = (activeIndex + value) * ticksPerPanel;
  [...wheelSvg.querySelectorAll(".dial-tick")].forEach(tick => {
    tick.classList.toggle("active", tick.classList.contains("major") && Number(tick.dataset.panel) === activeIndex);
    tick.classList.toggle("progressed", Number(tick.dataset.tick) < reachedTick);
  });
  wheelSvg.style.transform = `rotate(${dialAnchor() - (activeIndex + value) * 360 / panels.length}deg)`;
  wheelCenter.textContent = String(activeIndex + 1);
}

function clearPanel(panel) {
  piecesFor(panel).forEach(piece => {
    piece.style.transform = "";
    piece.style.opacity = "";
  });
}

function enterPieces(panel, fromEnd) {
  locked = true;
  const pieces = piecesFor(panel);
  panel.classList.remove("panel-preparing");
  panel.classList.add("panel-entering");
  pieces.forEach((piece, index) => {
    piece.style.transitionDelay = `${70 + index * 42}ms`;
    piece.style.opacity = "0";
    piece.style.transform = `translate3d(${index % 2 ? 2.5 : -2.5}vw, ${fromEnd ? -34 : 34}px, 0) scale(.985)`;
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    pieces.forEach(piece => {
      piece.style.opacity = "1";
      piece.style.transform = "translate3d(0,0,0) scale(1)";
    });
  }));

  setTimeout(() => {
    panel.classList.remove("panel-entering");
    pieces.forEach(piece => {
      piece.style.transitionDelay = "";
      piece.style.transform = "";
      piece.style.opacity = "";
    });
    locked = false;
  }, 500 + pieces.length * 30);
}

function updateIndicatorTheme(panel) {
  const light = panel.classList.contains("projects") || panel.classList.contains("skills") || panel.classList.contains("tech");
  progressBar.classList.toggle("on-light", light);
  header.classList.toggle("on-light", light);
  navigation.querySelectorAll('a[href^="#"]').forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${panel.id}`);
  });
}

function showPanel(index, enteringFromEnd = false) {
  if (index < 0 || index >= panels.length || locked) return;
  locked = true;
  pendingDirection = 0;
  if (motionFrame) { cancelAnimationFrame(motionFrame); motionFrame = null; }
  const previous = panels[activeIndex];
  previous.classList.add("panel-behind");

  activeIndex = index;
  // Una sección siempre queda en su estado base al entrar, también al volver atrás.
  progress = 0;
  renderedProgress = progress;
  const current = panels[activeIndex];
  clearPanel(current);
  current.classList.add("panel-sliding", "panel-preparing");
  piecesFor(current).forEach(piece => {
    piece.style.opacity = "0";
    piece.style.transform = `translate3d(0,${enteringFromEnd ? -30 : 30}px,0)`;
  });
  history.replaceState(null, "", `#${current.id}`);
  header.classList.toggle("scrolled", activeIndex > 0);
  updateIndicatorTheme(current);
  [...wheelSvg.querySelectorAll(".dial-tick")].forEach(tick => {
    tick.classList.toggle("active", tick.classList.contains("major") && Number(tick.dataset.panel) === activeIndex);
    tick.classList.toggle("progressed", Number(tick.dataset.tick) < activeIndex * ticksPerPanel);
  });
  wheelSvg.style.transform = `rotate(${dialAnchor() - activeIndex * 360 / panels.length}deg)`;
  wheelCenter.textContent = String(activeIndex + 1);

  const slideDuration = reduceMotion.matches ? 1 : 560;
  const slide = current.animate([
    { transform: "translate3d(0,100%,0)" },
    { transform: "translate3d(0,0,0)" }
  ], {
    duration: slideDuration,
    easing: "cubic-bezier(.76,0,.24,1)",
    fill: "both"
  });

  slide.onfinish = () => {
    previous.classList.remove("panel-active", "panel-behind");
    // Reiniciar el panel saliente solo cuando el nuevo ya lo cubre por completo.
    clearPanel(previous);
    current.classList.remove("panel-sliding");
    current.classList.add("panel-active");
    slide.cancel();
    enterPieces(current, enteringFromEnd);
  };
}

function renderMotion() {
  motionFrame = null;
  renderedProgress += (progress - renderedProgress) * .105;
  if (Math.abs(progress - renderedProgress) < .0008) renderedProgress = progress;
  animatePanel(renderedProgress);

  if (pendingDirection > 0 && renderedProgress > .985 && activeIndex < panels.length - 1) {
    pendingDirection = 0;
    showPanel(activeIndex + 1);
    return;
  }
  if (pendingDirection < 0 && renderedProgress < .015 && activeIndex > 0) {
    pendingDirection = 0;
    showPanel(activeIndex - 1, true);
    return;
  }

  if (renderedProgress !== progress) motionFrame = requestAnimationFrame(renderMotion);
}

function requestMotion() {
  if (!motionFrame) motionFrame = requestAnimationFrame(renderMotion);
}

function moveBy(delta) {
  if (locked) {
    return;
  }
  // Los extremos no tienen un panel al que salir: conservar su contenido visible.
  if (activeIndex === panels.length - 1 && delta > 0) {
    progress = 0;
    renderedProgress = 0;
    animatePanel(0);
    return;
  }
  if (activeIndex === 0 && delta < 0) {
    progress = 0;
    renderedProgress = 0;
    animatePanel(0);
    return;
  }
  progress = clamp(progress + delta);
  if (progress >= 1 && delta > 0) pendingDirection = 1;
  if (progress <= 0 && delta < 0) pendingDirection = -1;
  requestMotion();
}

addEventListener("wheel", event => {
  event.preventDefault();
  const strength = Math.min(Math.abs(event.deltaY), 90) / 1250;
  moveBy(Math.sign(event.deltaY) * strength);
}, { passive: false });

addEventListener("touchstart", event => {
  touchY = event.touches[0].clientY;
  touchX = event.touches[0].clientX;
}, { passive: true });
addEventListener("touchmove", event => {
  if (touchY === null) return;
  if (event.target.closest?.(".section-wheel")) return;
  const nextY = event.touches[0].clientY;
  const nextX = event.touches[0].clientX;
  const deltaY = touchY - nextY;
  const deltaX = touchX - nextX;
  // Los gestos horizontales pertenecen al carrusel de proyectos.
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    touchY = nextY;
    touchX = nextX;
    return;
  }
  moveBy(deltaY / (innerHeight * 1.7));
  touchY = nextY;
  touchX = nextX;
}, { passive: true });
addEventListener("touchend", () => { touchY = null; touchX = null; }, { passive: true });

// La rueda funciona como un dial independiente: puede girarse directamente.
let dialAngle = null;
let dialDragging = false;

function pointerAngle(event) {
  const rect = progressBar.getBoundingClientRect();
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
}

progressBar.addEventListener("pointerdown", event => {
  dialAngle = pointerAngle(event);
  dialDragging = true;
  progressBar.setPointerCapture(event.pointerId);
  event.preventDefault();
});

progressBar.addEventListener("pointermove", event => {
  if (!dialDragging || dialAngle === null) return;
  const nextAngle = pointerAngle(event);
  let delta = nextAngle - dialAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  moveBy(delta / 95);
  dialAngle = nextAngle;
  event.preventDefault();
});

function stopDial(event) {
  if (!dialDragging) return;
  dialDragging = false;
  dialAngle = null;
  if (progressBar.hasPointerCapture(event.pointerId)) progressBar.releasePointerCapture(event.pointerId);
}

progressBar.addEventListener("pointerup", stopDial);
progressBar.addEventListener("pointercancel", stopDial);
addEventListener("resize", () => animatePanel(renderedProgress), { passive: true });

addEventListener("keydown", event => {
  if (["ArrowDown", "PageDown", " "].includes(event.key)) { event.preventDefault(); moveBy(.18); }
  if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); moveBy(-.18); }
  if (event.key === "Home") showPanel(0);
  if (event.key === "End") showPanel(panels.length - 1);
});

document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener("click", event => {
  const href = link.getAttribute("href");
  if (href === "#") return;
  const target = document.querySelector(href);
  const index = panels.indexOf(target);
  if (index >= 0) {
    event.preventDefault();
    showPanel(index);
  }
}));

menuButton.addEventListener("click", () => {
  const open = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

navigation.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));

document.querySelectorAll(".reveal").forEach(element => element.classList.add("visible"));
document.querySelector("#year").textContent = new Date().getFullYear();
panels[activeIndex].classList.add("panel-active");
header.classList.toggle("scrolled", activeIndex > 0);
updateIndicatorTheme(panels[activeIndex]);
animatePanel(0);
enterPieces(panels[activeIndex], false);
