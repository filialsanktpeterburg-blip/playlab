const TOTAL_TIME = 60;
const POINTS_CORRECT = 10;
const POINTS_WRONG = 5;

const packagePlan = [
  { planet: "gray", label: "A-17" }, { planet: "red", label: "O-21" },
  { planet: "yellow", label: "C-03" }, { planet: "gray", label: "A-42" },
  { planet: "yellow", label: "C-18" }, { planet: "red", label: "O-09" },
  { planet: "red", label: "O-55" }, { planet: "gray", label: "A-06" },
  { planet: "yellow", label: "C-77" }, { planet: "red", label: "O-34" },
  { planet: "gray", label: "A-28" }, { planet: "yellow", label: "C-11" }
];

const scoreElement = document.querySelector("#score");
const timerElement = document.querySelector("#timer");
const remainingElement = document.querySelector("#remaining");
const packagesElement = document.querySelector("#packages");
const planetZones = document.querySelectorAll(".planet-zone");
const timerStat = document.querySelector(".stat--timer");
const startButton = document.querySelector("#startButton");
const helpButton = document.querySelector("#helpButton");
const helpModal = document.querySelector("#helpModal");
const resultModal = document.querySelector("#resultModal");
const restartButton = document.querySelector("#restartButton");
const toast = document.querySelector("#toast");
const sounds = {
  correct: document.querySelector("#correctSound"),
  wrong: document.querySelector("#wrongSound"),
  win: document.querySelector("#winSound"),
  click: document.querySelector("#clickSound")
};

let score = 0;
let timeLeft = TOTAL_TIME;
let delivered = 0;
let gameActive = false;
let timerId = null;
let draggedPackage = null;
let toastTimer = null;

function playSound(name) {
  const sound = sounds[name];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function createPackages() {
  packagesElement.innerHTML = "";
  shuffle(packagePlan).forEach((item, index) => {
    const packageBox = document.createElement("div");
    packageBox.className = `package package--${item.planet}`;
    packageBox.draggable = false;
    packageBox.dataset.planet = item.planet;
    packageBox.dataset.id = String(index);
    packageBox.setAttribute("role", "button");
    packageBox.setAttribute("aria-label", `Посылка ${item.label}`);
    packageBox.innerHTML = `<span>${item.label}</span>`;

    packageBox.addEventListener("dragstart", handleDragStart);
    packageBox.addEventListener("dragend", handleDragEnd);
    packagesElement.append(packageBox);
  });
}

function handleDragStart(event) {
  if (!gameActive) {
    event.preventDefault();
    return;
  }
  draggedPackage = event.currentTarget;
  draggedPackage.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedPackage.dataset.id);
}

function handleDragEnd() {
  if (draggedPackage) draggedPackage.classList.remove("is-dragging");
  draggedPackage = null;
  planetZones.forEach((zone) => zone.classList.remove("drag-over"));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1200);
}

function updateStats() {
  scoreElement.textContent = String(score);
  timerElement.textContent = String(timeLeft);
  remainingElement.textContent = String(packagePlan.length - delivered);
  timerStat.classList.toggle("is-warning", gameActive && timeLeft <= 10);
}

function updatePlanetCount(planet) {
  const zone = document.querySelector(`[data-planet="${planet}"]`);
  const current = Number(zone.querySelector(".delivered-count b").textContent);
  zone.querySelector(".delivered-count b").textContent = String(current + 1);
}

function deliverPackage(zone) {
  if (!gameActive || !draggedPackage) return;

  if (draggedPackage.dataset.planet === zone.dataset.planet) {
    score += POINTS_CORRECT;
    delivered += 1;
    updatePlanetCount(zone.dataset.planet);
    playSound("correct");
    showToast(`Верно! +${POINTS_CORRECT} очков`);
    zone.classList.add("is-correct");
    const deliveredPackage = draggedPackage;
    deliveredPackage.classList.add("is-delivered");
    deliveredPackage.draggable = false;
    setTimeout(() => deliveredPackage.remove(), 180);
    setTimeout(() => zone.classList.remove("is-correct"), 450);
    updateStats();

    if (delivered === packagePlan.length) endGame(true);
  } else {
    score -= POINTS_WRONG;
    playSound("wrong");
    showToast(`Не та планета! −${POINTS_WRONG} очков`);
    zone.classList.add("is-wrong");
    setTimeout(() => zone.classList.remove("is-wrong"), 400);
    updateStats();
  }
}

planetZones.forEach((zone) => {
  zone.addEventListener("dragover", (event) => {
    if (!gameActive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");
    deliverPackage(zone);
  });
});

function resetGame() {
  clearInterval(timerId);
  score = 0;
  timeLeft = TOTAL_TIME;
  delivered = 0;
  gameActive = false;
  draggedPackage = null;
  document.querySelectorAll(".delivered-count b").forEach((count) => { count.textContent = "0"; });
  createPackages();
  packagesElement.classList.add("is-locked");
  updateStats();
  startButton.disabled = false;
  startButton.textContent = "Начать игру";
}

function startGame() {
  resetGame();
  gameActive = true;
  packagesElement.classList.remove("is-locked");
  packagesElement.querySelectorAll(".package").forEach((item) => { item.draggable = true; });
  startButton.disabled = true;
  startButton.textContent = "Игра идёт";
  playSound("click");
  updateStats();

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateStats();
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

function endGame(isVictory) {
  if (!gameActive) return;
  gameActive = false;
  clearInterval(timerId);
  packagesElement.classList.add("is-locked");
  packagesElement.querySelectorAll(".package").forEach((item) => { item.draggable = false; });
  timerStat.classList.remove("is-warning");

  document.querySelector("#resultIcon").textContent = isVictory ? "🏆" : "⏱️";
  document.querySelector("#resultTitle").textContent = isVictory ? "Космопочта доставлена!" : "Время закончилось";
  document.querySelector("#resultMessage").textContent = isVictory
    ? `Все 12 посылок на месте. Осталось времени: ${timeLeft} сек.`
    : `Доставлено посылок: ${delivered} из ${packagePlan.length}. Попробуй ещё раз!`;
  document.querySelector("#finalScore").textContent = String(score);
  resultModal.hidden = false;
  playSound(isVictory ? "win" : "wrong");
  restartButton.focus();
}

function openHelp() {
  playSound("click");
  helpModal.hidden = false;
  helpModal.querySelector(".modal__close").focus();
}

function closeHelp() {
  helpModal.hidden = true;
  helpButton.focus();
}

startButton.addEventListener("click", startGame);
helpButton.addEventListener("click", openHelp);
helpModal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeHelp));
restartButton.addEventListener("click", () => {
  resultModal.hidden = true;
  startGame();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModal.hidden) closeHelp();
});

resetGame();
