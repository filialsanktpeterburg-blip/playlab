const STEP_DELAY = 430;
const MAX_COMMANDS = 40;

const levels = [
  {
    size: 5,
    start: [4, 0],
    finish: [0, 4],
    batteries: [[2, 2]],
    rocks: [[3, 1], [1, 2], [3, 3]],
    description: "Собери батарейку и доберись до лаборатории."
  },
  {
    size: 6,
    start: [5, 0],
    finish: [0, 5],
    batteries: [[3, 2], [1, 4]],
    rocks: [[4, 1], [4, 4], [2, 2], [2, 3], [1, 1], [0, 3]],
    description: "Найди две батарейки и обойди больше препятствий."
  },
  {
    size: 7,
    start: [6, 0],
    finish: [0, 6],
    batteries: [[5, 2], [3, 4], [1, 5]],
    rocks: [[6, 3], [5, 4], [4, 0], [4, 3], [2, 2], [2, 5], [1, 1], [0, 4]],
    description: "Финальный маршрут: собери три батарейки и найди путь в лабораторию."
  }
];

const directionMap = {
  up: { row: -1, col: 0, symbol: "↑" },
  down: { row: 1, col: 0, symbol: "↓" },
  left: { row: 0, col: -1, symbol: "←" },
  right: { row: 0, col: 1, symbol: "→" }
};

const board = document.querySelector("#board");
const boardPanel = document.querySelector(".board-panel");
const statusText = document.querySelector("#statusText");
const levelNumber = document.querySelector("#levelNumber");
const levelDescription = document.querySelector("#levelDescription");
const batteryCount = document.querySelector("#batteryCount");
const batteryTotal = document.querySelector("#batteryTotal");
const commandQueue = document.querySelector("#commandQueue");
const commandCount = document.querySelector("#commandCount");
const directionButtons = document.querySelectorAll(".direction");
const runButton = document.querySelector("#runButton");
const clearButton = document.querySelector("#clearButton");
const resetButton = document.querySelector("#resetButton");
const helpButton = document.querySelector("#helpButton");
const helpModal = document.querySelector("#helpModal");
const levelModal = document.querySelector("#levelModal");
const victoryModal = document.querySelector("#victoryModal");
const nextLevelButton = document.querySelector("#nextLevelButton");
const replayButton = document.querySelector("#replayButton");
const toast = document.querySelector("#toast");
const sounds = {
  move: document.querySelector("#moveSound"),
  collect: document.querySelector("#collectSound"),
  wrong: document.querySelector("#wrongSound"),
  win: document.querySelector("#winSound"),
  click: document.querySelector("#clickSound")
};

let currentLevel = 0;
let robotPosition = [0, 0];
let collectedBatteries = new Set();
let commands = [];
let isRunning = false;
let runToken = 0;
let toastTimer = null;

function cellKey(row, col) {
  return `${row},${col}`;
}

function hasPosition(list, row, col) {
  return list.some(([itemRow, itemCol]) => itemRow === row && itemCol === col);
}

function playSound(name) {
  const sound = sounds[name];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

function setStatus(message, type = "normal") {
  statusText.textContent = message;
  boardPanel.classList.toggle("has-error", type === "error");
  boardPanel.classList.toggle("has-success", type === "success");
}

function renderBoard() {
  const level = levels[currentLevel];
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${level.size}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${level.size}, 1fr)`;

  for (let row = 0; row < level.size; row += 1) {
    for (let col = 0; col < level.size; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);

      if (hasPosition(level.rocks, row, col)) {
        cell.classList.add("cell--rock");
        cell.innerHTML = '<img src="../images/rock.png" alt="Препятствие">';
      } else if (level.finish[0] === row && level.finish[1] === col) {
        cell.classList.add("cell--finish");
        cell.innerHTML = '<img src="../images/lab.png" alt="Лаборатория — финиш">';
      } else if (hasPosition(level.batteries, row, col) && !collectedBatteries.has(cellKey(row, col))) {
        cell.classList.add("cell--battery");
        cell.innerHTML = '<img src="../images/battery.png" alt="Батарейка">';
      }

      if (robotPosition[0] === row && robotPosition[1] === col) {
        const robot = document.createElement("img");
        robot.className = "robot";
        robot.src = "../images/robot.png";
        robot.alt = "Робот Ботик";
        cell.append(robot);
      }
      board.append(cell);
    }
  }

  batteryCount.textContent = String(collectedBatteries.size);
  batteryTotal.textContent = String(level.batteries.length);
}

function renderCommands(activeIndex = -1, doneThrough = -1) {
  commandQueue.innerHTML = "";
  commandCount.textContent = String(commands.length);

  if (commands.length === 0) {
    commandQueue.innerHTML = '<p class="queue-empty">Здесь появятся команды</p>';
    return;
  }

  commands.forEach((command, index) => {
    const chip = document.createElement("span");
    chip.className = "command-chip";
    if (index === activeIndex) chip.classList.add("is-active");
    else if (index <= doneThrough) chip.classList.add("is-done");
    chip.textContent = directionMap[command].symbol;
    chip.setAttribute("aria-label", `Команда ${index + 1}: ${directionMap[command].symbol}`);
    commandQueue.append(chip);
  });

  const activeChip = commandQueue.querySelector(".is-active");
  if (activeChip) activeChip.scrollIntoView({ block: "nearest" });
}

function setControlsDisabled(disabled) {
  directionButtons.forEach((button) => { button.disabled = disabled; });
  runButton.disabled = disabled;
  clearButton.disabled = disabled;
}

function stopCurrentRun() {
  runToken += 1;
  isRunning = false;
  setControlsDisabled(false);
}

function loadLevel(index) {
  stopCurrentRun();
  currentLevel = index;
  const level = levels[currentLevel];
  robotPosition = [...level.start];
  collectedBatteries = new Set();
  commands = [];
  levelNumber.textContent = String(currentLevel + 1);
  levelDescription.textContent = level.description;
  levelModal.hidden = true;
  victoryModal.hidden = true;
  setStatus("Составь маршрут");
  renderCommands();
  renderBoard();
}

function addCommand(command) {
  if (isRunning) return;
  if (commands.length >= MAX_COMMANDS) {
    showToast(`Можно добавить не больше ${MAX_COMMANDS} команд`, true);
    return;
  }
  commands.push(command);
  playSound("click");
  renderCommands();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isOutside(row, col, size) {
  return row < 0 || col < 0 || row >= size || col >= size;
}

async function runCommands() {
  if (isRunning) return;
  if (commands.length === 0) {
    showToast("Сначала добавь команды для Ботика", true);
    return;
  }

  isRunning = true;
  setControlsDisabled(true);
  resetButton.disabled = false;
  setStatus("Ботик выполняет команды…");
  const thisRun = ++runToken;
  const level = levels[currentLevel];

  for (let index = 0; index < commands.length; index += 1) {
    if (thisRun !== runToken) return;
    renderCommands(index, index - 1);
    await wait(STEP_DELAY);
    if (thisRun !== runToken) return;

    const direction = directionMap[commands[index]];
    const nextRow = robotPosition[0] + direction.row;
    const nextCol = robotPosition[1] + direction.col;

    if (isOutside(nextRow, nextCol, level.size) || hasPosition(level.rocks, nextRow, nextCol)) {
      playSound("wrong");
      setStatus("Маршрут прерван", "error");
      showToast("Столкновение! Измени маршрут и попробуй снова.", true);
      renderCommands(index, index - 1);
      isRunning = false;
      setControlsDisabled(false);
      return;
    }

    robotPosition = [nextRow, nextCol];
    playSound("move");

    const positionKey = cellKey(nextRow, nextCol);
    if (hasPosition(level.batteries, nextRow, nextCol) && !collectedBatteries.has(positionKey)) {
      collectedBatteries.add(positionKey);
      playSound("collect");
      showToast("Батарейка собрана!");
    }

    renderBoard();
    renderCommands(-1, index);

    const onFinish = level.finish[0] === nextRow && level.finish[1] === nextCol;
    if (onFinish) {
      if (collectedBatteries.size < level.batteries.length) {
        playSound("wrong");
        setStatus("Не все батарейки собраны", "error");
        showToast("Сначала собери все батарейки!", true);
        isRunning = false;
        setControlsDisabled(false);
        return;
      }
      completeLevel();
      return;
    }
  }

  isRunning = false;
  setControlsDisabled(false);
  setStatus("Маршрут закончился");
  showToast("Команды закончились. Продолжи маршрут или начни заново.");
}

function completeLevel() {
  stopCurrentRun();
  setStatus("Уровень пройден!", "success");
  playSound("win");

  if (currentLevel < levels.length - 1) {
    document.querySelector("#levelResultText").textContent = `Ботик собрал все батарейки уровня ${currentLevel + 1} и добрался до лаборатории.`;
    levelModal.hidden = false;
    nextLevelButton.focus();
  } else {
    victoryModal.hidden = false;
    replayButton.focus();
  }
}

directionButtons.forEach((button) => {
  button.addEventListener("click", () => addCommand(button.dataset.command));
});

runButton.addEventListener("click", runCommands);
clearButton.addEventListener("click", () => {
  if (isRunning) return;
  commands = [];
  setStatus("Команды очищены");
  renderCommands();
});
resetButton.addEventListener("click", () => loadLevel(currentLevel));
nextLevelButton.addEventListener("click", () => loadLevel(currentLevel + 1));
replayButton.addEventListener("click", () => loadLevel(0));

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

loadLevel(0);
