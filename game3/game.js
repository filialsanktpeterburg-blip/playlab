const GAME_DURATION = 60;
const TRASH_TARGET = 15;
const STARTING_LIVES = 3;
const POINTS_PER_TRASH = 10;
const PLAYER_SPEED = 300;
const MIN_SPAWN_INTERVAL = 900;
const MAX_SPAWN_INTERVAL = 1300;
const SPAWN_EDGE_PADDING = 75;
const MIN_HORIZONTAL_GAP = 165;
const NEARBY_VERTICAL_RANGE = 155;

const trashTypes = [
  { image: "../images/bottle.png", name: "бутылка" },
  { image: "../images/can.png", name: "банка" },
  { image: "../images/bag.png", name: "пакет" }
];

const animalTypes = [
  { image: "../images/fish.png", name: "рыба" },
  { image: "../images/turtle.png", name: "черепаха" },
  { image: "../images/jellyfish.png", name: "медуза" }
];

const ocean = document.querySelector("#ocean");
const oceanPanel = document.querySelector(".ocean-panel");
const objectsLayer = document.querySelector("#objectsLayer");
const submarine = document.querySelector("#submarine");
const startCurtain = document.querySelector("#startCurtain");
const scoreElement = document.querySelector("#score");
const trashCountElement = document.querySelector("#trashCount");
const timeLeftElement = document.querySelector("#timeLeft");
const livesElement = document.querySelector("#lives");
const timeStat = document.querySelector(".stat--time");
const statusText = document.querySelector("#statusText");
const startButton = document.querySelector("#startButton");
const helpButton = document.querySelector("#helpButton");
const helpModal = document.querySelector("#helpModal");
const resultModal = document.querySelector("#resultModal");
const replayButton = document.querySelector("#replayButton");
const toast = document.querySelector("#toast");
const sounds = {
  click: document.querySelector("#clickSound"),
  collect: document.querySelector("#collectSound"),
  wrong: document.querySelector("#wrongSound"),
  win: document.querySelector("#winSound")
};

let score = 0;
let trashCollected = 0;
let lives = STARTING_LIVES;
let remainingTime = GAME_DURATION;
let isPlaying = false;
let playerX = 0;
let objects = [];
let pressedKeys = { left: false, right: false };
let animationFrameId = null;
let lastFrameTime = 0;
let gameStartTime = 0;
let spawnAccumulator = 0;
let nextSpawnDelay = MIN_SPAWN_INTERVAL;
let toastTimer = null;
let objectId = 0;

function playSound(name) {
  const sound = sounds[name];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function updateStats() {
  scoreElement.textContent = String(score);
  trashCountElement.textContent = String(trashCollected);
  timeLeftElement.textContent = String(remainingTime);
  livesElement.textContent = lives > 0 ? Array(lives).fill("♥").join(" ") : "—";
  livesElement.setAttribute("aria-label", `${lives} ${lives === 1 ? "жизнь" : "жизни"}`);
  timeStat.classList.toggle("is-warning", isPlaying && remainingTime <= 10);
}

function setStatus(message, type = "normal") {
  statusText.textContent = message;
  oceanPanel.classList.toggle("has-error", type === "error");
  oceanPanel.classList.toggle("has-success", type === "success");
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1000);
}

function resetState() {
  cancelAnimationFrame(animationFrameId);
  clearTimeout(toastTimer);
  animationFrameId = null;
  isPlaying = false;
  score = 0;
  trashCollected = 0;
  lives = STARTING_LIVES;
  remainingTime = GAME_DURATION;
  objects = [];
  pressedKeys = { left: false, right: false };
  spawnAccumulator = 0;
  nextSpawnDelay = randomSpawnDelay();
  objectsLayer.innerHTML = "";
  submarine.classList.remove("is-hit");
  toast.classList.remove("is-visible", "is-error");
  const maximumX = ocean.clientWidth - submarine.offsetWidth;
  playerX = maximumX / 2;
  submarine.style.transform = `translateX(${playerX}px)`;
  updateStats();
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomSpawnDelay() {
  return MIN_SPAWN_INTERVAL + Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
}

function spawnObject() {
  const isTrash = Math.random() < 0.68;
  const definition = randomFrom(isTrash ? trashTypes : animalTypes);
  const size = isTrash ? 62 : 78;
  const minimumX = SPAWN_EDGE_PADDING;
  const maximumX = ocean.clientWidth - size - SPAWN_EDGE_PADDING;
  const startY = -size;
  let x = null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidateX = minimumX + Math.random() * (maximumX - minimumX);
    const candidateCenter = candidateX + size / 2;
    const hasNearbyObject = objects.some((object) => {
      const verticalDistance = Math.abs(startY - object.y);
      const horizontalDistance = Math.abs(candidateCenter - (object.x + object.size / 2));
      return verticalDistance < NEARBY_VERTICAL_RANGE && horizontalDistance < MIN_HORIZONTAL_GAP;
    });

    if (!hasNearbyObject) {
      x = candidateX;
      break;
    }
  }

  if (x === null) return false;

  const element = document.createElement("img");
  const item = {
    id: objectId += 1,
    type: isTrash ? "trash" : "animal",
    x,
    y: startY,
    size,
    speed: 82 + Math.random() * 18,
    element
  };

  element.src = definition.image;
  element.alt = definition.name;
  element.className = `falling-object falling-object--${item.type}`;
  element.style.transform = `translate(${item.x}px, ${item.y}px)`;
  objectsLayer.append(element);
  objects.push(item);
  return true;
}

function rectanglesOverlap(first, second) {
  const paddingX = 15;
  const paddingY = 12;
  return first.x + paddingX < second.x + second.width
    && first.x + first.width - paddingX > second.x
    && first.y + paddingY < second.y + second.height
    && first.y + first.height - paddingY > second.y;
}

function removeObject(item) {
  item.element.remove();
  objects = objects.filter((object) => object.id !== item.id);
}

function handleCollision(item) {
  removeObject(item);

  if (item.type === "trash") {
    trashCollected += 1;
    score += POINTS_PER_TRASH;
    playSound("collect");
    showToast(`Мусор собран! +${POINTS_PER_TRASH} очков`);
    updateStats();
    if (trashCollected >= TRASH_TARGET) endGame(true, "target");
    return;
  }

  lives -= 1;
  playSound("wrong");
  showToast("Осторожно, морской житель! −1 жизнь", true);
  submarine.classList.remove("is-hit");
  void submarine.offsetWidth;
  submarine.classList.add("is-hit");
  updateStats();
  if (lives <= 0) endGame(false, "lives");
}

function updateObjects(deltaSeconds) {
  const submarineRect = {
    x: playerX,
    y: ocean.clientHeight - 47 - submarine.offsetHeight,
    width: submarine.offsetWidth,
    height: submarine.offsetHeight
  };

  for (const item of [...objects]) {
    item.y += item.speed * deltaSeconds;
    item.element.style.transform = `translate(${item.x}px, ${item.y}px)`;

    const objectRect = { x: item.x, y: item.y, width: item.size, height: item.size };
    if (rectanglesOverlap(submarineRect, objectRect)) {
      handleCollision(item);
      if (!isPlaying) return;
    } else if (item.y > ocean.clientHeight + item.size) {
      removeObject(item);
    }
  }
}

function updatePlayer(deltaSeconds) {
  let direction = 0;
  if (pressedKeys.left) direction -= 1;
  if (pressedKeys.right) direction += 1;
  const maximumX = ocean.clientWidth - submarine.offsetWidth;
  playerX = Math.max(0, Math.min(maximumX, playerX + direction * PLAYER_SPEED * deltaSeconds));
  submarine.style.transform = `translateX(${playerX}px)`;
}

function gameLoop(timestamp) {
  if (!isPlaying) return;
  const deltaMilliseconds = Math.min(timestamp - lastFrameTime, 50);
  const deltaSeconds = deltaMilliseconds / 1000;
  lastFrameTime = timestamp;

  const elapsedSeconds = (timestamp - gameStartTime) / 1000;
  remainingTime = Math.max(0, Math.ceil(GAME_DURATION - elapsedSeconds));
  updateStats();

  if (remainingTime <= 0) {
    endGame(false, "time");
    return;
  }

  updatePlayer(deltaSeconds);
  updateObjects(deltaSeconds);
  if (!isPlaying) return;

  spawnAccumulator += deltaMilliseconds;
  if (spawnAccumulator >= nextSpawnDelay) {
    spawnAccumulator -= nextSpawnDelay;
    spawnObject();
    nextSpawnDelay = randomSpawnDelay();
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
  resetState();
  resultModal.hidden = true;
  startCurtain.hidden = true;
  startButton.disabled = true;
  startButton.textContent = "Игра идёт";
  helpButton.disabled = true;
  isPlaying = true;
  setStatus("Спасательная операция началась!");
  playSound("click");
  gameStartTime = performance.now();
  lastFrameTime = gameStartTime;
  animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame(isVictory, reason) {
  if (!isPlaying) return;
  isPlaying = false;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  clearTimeout(toastTimer);
  pressedKeys = { left: false, right: false };
  objects.forEach((item) => item.element.remove());
  objects = [];
  submarine.classList.remove("is-hit");
  toast.classList.remove("is-visible", "is-error");
  timeStat.classList.remove("is-warning");
  startButton.disabled = false;
  startButton.textContent = "Начать игру";
  helpButton.disabled = false;

  const resultTitle = document.querySelector("#resultTitle");
  const resultMessage = document.querySelector("#resultMessage");
  document.querySelector("#resultIcon").textContent = isVictory ? "🏆" : reason === "lives" ? "💔" : "⏱️";
  document.querySelector("#resultEyebrow").textContent = isVictory ? "Миссия выполнена" : "Миссия завершена";
  resultTitle.textContent = isVictory ? "Риф спасён!" : reason === "lives" ? "Жизни закончились" : "Время закончилось";
  resultMessage.textContent = isVictory
    ? `Ты собрал весь мусор за ${GAME_DURATION - remainingTime} сек. Морские жители в безопасности!`
    : `Собрано ${trashCollected} из ${TRASH_TARGET} предметов. Попробуй ещё раз и спаси риф!`;
  document.querySelector("#finalScore").textContent = String(score);
  document.querySelector("#finalTrash").textContent = String(trashCollected);
  setStatus(isVictory ? "Риф спасён!" : "Попробуй ещё раз", isVictory ? "success" : "error");
  resultModal.hidden = false;
  playSound(isVictory ? "win" : "wrong");
  replayButton.focus();
}

function setMovementKey(event, isPressed) {
  const key = event.key.toLowerCase();
  if (!["arrowleft", "arrowright", "a", "d"].includes(key)) return;
  if (isPlaying) event.preventDefault();
  if (key === "arrowleft" || key === "a") pressedKeys.left = isPressed;
  if (key === "arrowright" || key === "d") pressedKeys.right = isPressed;
}

document.addEventListener("keydown", (event) => setMovementKey(event, true));
document.addEventListener("keyup", (event) => setMovementKey(event, false));
window.addEventListener("blur", () => { pressedKeys = { left: false, right: false }; });

startButton.addEventListener("click", startGame);
replayButton.addEventListener("click", startGame);
helpButton.addEventListener("click", () => {
  playSound("click");
  helpModal.hidden = false;
  helpModal.querySelector(".modal__close").focus();
});

function closeHelp() {
  helpModal.hidden = true;
  helpButton.focus();
}

helpModal.querySelectorAll("[data-close-help]").forEach((element) => element.addEventListener("click", closeHelp));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModal.hidden) closeHelp();
});

resetState();
