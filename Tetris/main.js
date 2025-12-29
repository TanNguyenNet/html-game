const boardCanvas = document.getElementById("game");
const nextCanvas = document.getElementById("next");
const boardCtx = boardCanvas.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySubtitle = document.getElementById("overlaySubtitle");
const overlayButton = document.getElementById("overlayButton");
const primaryAction = document.getElementById("primaryAction");
const resetButton = document.getElementById("resetButton");
const statusChip = document.getElementById("statusChip");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const speedEl = document.getElementById("speed");

const COLS = 10;
const ROWS = 20;

const PIECES = [
  {
    name: "I",
    color: "#4dd6c8",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "O",
    color: "#f4d35e",
    matrix: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "T",
    color: "#ff6b4a",
    matrix: [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "S",
    color: "#63d2ff",
    matrix: [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "Z",
    color: "#ff4d6d",
    matrix: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "J",
    color: "#7c7bff",
    matrix: [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: "L",
    color: "#f39c5a",
    matrix: [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  }
];

let board = createMatrix(ROWS, COLS);
let active = null;
let bag = [];
let queue = [];
let score = 0;
let level = 0;
let lines = 0;
let combo = 0;
let status = "idle";
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let metrics = { block: 32, width: 320, height: 640 };

function createMatrix(rows, cols) {
  const matrix = [];
  for (let y = 0; y < rows; y += 1) {
    matrix.push(new Array(cols).fill(null));
  }
  return matrix;
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function createBag() {
  const bagPieces = PIECES.map((piece) => ({
    name: piece.name,
    color: piece.color,
    matrix: cloneMatrix(piece.matrix)
  }));
  for (let i = bagPieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bagPieces[i], bagPieces[j]] = [bagPieces[j], bagPieces[i]];
  }
  return bagPieces;
}

function ensureQueue() {
  while (queue.length < 5) {
    if (bag.length === 0) {
      bag = createBag();
    }
    queue.push(bag.pop());
  }
}

function createPiece(type) {
  return {
    name: type.name,
    color: type.color,
    matrix: cloneMatrix(type.matrix),
    pos: { x: Math.floor(COLS / 2) - 2, y: -1 }
  };
}

function getDropInterval(currentLevel) {
  const base = 1000;
  const interval = base * Math.pow(0.88, currentLevel);
  return Math.max(90, Math.round(interval));
}

function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;

  const boardWidth = boardCanvas.clientWidth;
  const boardHeight = boardCanvas.clientHeight;
  boardCanvas.width = Math.floor(boardWidth * dpr);
  boardCanvas.height = Math.floor(boardHeight * dpr);
  boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  metrics = {
    block: boardWidth / COLS,
    width: boardWidth,
    height: boardHeight
  };

  const nextWidth = nextCanvas.clientWidth;
  const nextHeight = nextCanvas.clientHeight;
  nextCanvas.width = Math.floor(nextWidth * dpr);
  nextCanvas.height = Math.floor(nextHeight * dpr);
  nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setStatus(nextStatus) {
  status = nextStatus;
  const statusMap = {
    idle: "IDLE",
    running: "RUNNING",
    paused: "PAUSED",
    over: "GAME OVER"
  };
  statusChip.textContent = statusMap[status];
  updateOverlay();
  updateActionLabels();
}

function updateOverlay() {
  overlay.classList.toggle("is-visible", status !== "running");
  if (status === "idle") {
    overlayTitle.textContent = "Press Enter";
    overlaySubtitle.textContent = "Start the run and chase the tempo.";
    overlayButton.textContent = "Start Game";
  } else if (status === "paused") {
    overlayTitle.textContent = "Paused";
    overlaySubtitle.textContent = "Take a breath, then press Enter to resume.";
    overlayButton.textContent = "Resume";
  } else if (status === "over") {
    overlayTitle.textContent = "Run Over";
    overlaySubtitle.textContent = `Final score: ${score.toLocaleString("en-US")}`;
    overlayButton.textContent = "Restart";
  }
}

function updateActionLabels() {
  if (status === "running") {
    primaryAction.textContent = "Pause";
  } else if (status === "paused") {
    primaryAction.textContent = "Resume";
  } else if (status === "over") {
    primaryAction.textContent = "Restart";
  } else {
    primaryAction.textContent = "Start";
  }
}

function flashLevel() {
  document.body.classList.remove("level-up");
  void document.body.offsetWidth;
  document.body.classList.add("level-up");
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString("en-US");
  levelEl.textContent = level;
  linesEl.textContent = lines;
  speedEl.textContent = `${dropInterval}ms`;
}

function collide(state, piece) {
  const { matrix, pos } = piece;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }
      const boardX = x + pos.x;
      const boardY = y + pos.y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }
      if (boardY >= 0 && state[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function merge(state, piece) {
  let lockedAbove = false;
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }
      const boardY = y + piece.pos.y;
      const boardX = x + piece.pos.x;
      if (boardY < 0) {
        lockedAbove = true;
        return;
      }
      state[boardY][boardX] = piece.color;
    });
  });
  return lockedAbove;
}

function sweep() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell)) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function spawnPiece() {
  ensureQueue();
  const type = queue.shift();
  ensureQueue();
  active = createPiece(type);
  if (collide(board, active)) {
    gameOver();
  }
}

function resetGame() {
  board = createMatrix(ROWS, COLS);
  bag = createBag();
  queue = [];
  ensureQueue();
  score = 0;
  level = 0;
  lines = 0;
  combo = 0;
  dropInterval = getDropInterval(level);
  dropCounter = 0;
  spawnPiece();
  updateStats();
}

function gameOver() {
  setStatus("over");
}

function move(dx, dy) {
  active.pos.x += dx;
  active.pos.y += dy;
  if (collide(board, active)) {
    active.pos.x -= dx;
    active.pos.y -= dy;
    return false;
  }
  return true;
}

function rotateMatrix(matrix, dir) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      rotated[y][x] = dir > 0 ? matrix[size - 1 - x][y] : matrix[x][size - 1 - y];
    }
  }
  return rotated;
}

function rotatePiece(dir) {
  const original = active.matrix;
  const rotated = rotateMatrix(active.matrix, dir);
  active.matrix = rotated;
  const originalX = active.pos.x;
  let offset = 1;
  while (collide(board, active)) {
    active.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > 2) {
      active.matrix = original;
      active.pos.x = originalX;
      return;
    }
  }
}

function lockPiece() {
  const lockedAbove = merge(board, active);
  const cleared = sweep();
  if (cleared > 0) {
    combo += 1;
    const lineScores = [0, 100, 300, 500, 800];
    const comboBonus = combo > 1 ? combo * 25 : 0;
    score += lineScores[cleared] * (level + 1) + comboBonus;
    lines += cleared;
    const nextLevel = Math.floor(lines / 10);
    if (nextLevel !== level) {
      level = nextLevel;
      dropInterval = getDropInterval(level);
      flashLevel();
    }
  } else {
    combo = 0;
  }
  updateStats();
  if (lockedAbove) {
    gameOver();
    return;
  }
  spawnPiece();
}

function drop() {
  if (!move(0, 1)) {
    lockPiece();
  }
  dropCounter = 0;
}

function softDrop() {
  if (move(0, 1)) {
    score += 1;
    updateStats();
  }
}

function hardDrop() {
  let distance = 0;
  while (move(0, 1)) {
    distance += 1;
  }
  score += distance * 2;
  updateStats();
  lockPiece();
}

function drawCell(ctx, x, y, size, color, alpha = 1) {
  if (y < 0) {
    return;
  }
  const pad = Math.max(1, size * 0.08);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
  ctx.globalAlpha = 1;
}

function drawMatrix(ctx, matrix, offset, size, colorOverride) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }
      const color = colorOverride || value;
      drawCell(ctx, x + offset.x, y + offset.y, size, color);
    });
  });
}

function drawBoard() {
  const { width, height, block } = metrics;
  boardCtx.clearRect(0, 0, width, height);
  const gradient = boardCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(12, 16, 24, 0.98)");
  gradient.addColorStop(1, "rgba(8, 12, 18, 0.98)");
  boardCtx.fillStyle = gradient;
  boardCtx.fillRect(0, 0, width, height);

  boardCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  boardCtx.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * block, 0);
    boardCtx.lineTo(x * block, height);
    boardCtx.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * block);
    boardCtx.lineTo(width, y * block);
    boardCtx.stroke();
  }
}

function drawNext() {
  const width = nextCanvas.clientWidth;
  const height = nextCanvas.clientHeight;
  nextCtx.clearRect(0, 0, width, height);
  const gradient = nextCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(16, 21, 30, 0.95)");
  gradient.addColorStop(1, "rgba(10, 14, 20, 0.95)");
  nextCtx.fillStyle = gradient;
  nextCtx.fillRect(0, 0, width, height);

  const slots = 3;
  const cell = Math.min(width / 6, height / (slots * 5));
  const slotHeight = height / slots;
  const startX = Math.floor((width - cell * 4) / 2);

  for (let i = 0; i < Math.min(queue.length, slots); i += 1) {
    const type = queue[i];
    const offsetY = i * slotHeight + (slotHeight - cell * 4) / 2;
    drawMatrix(nextCtx, type.matrix, { x: startX / cell, y: offsetY / cell }, cell, type.color);
  }
}

function draw() {
  drawBoard();
  drawMatrix(boardCtx, board, { x: 0, y: 0 }, metrics.block, null);
  if (active) {
    drawMatrix(boardCtx, active.matrix, active.pos, metrics.block, active.color);
  }
  drawNext();
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (status === "running") {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      drop();
    }
  }
  draw();
  requestAnimationFrame(update);
}

function startGame() {
  resetGame();
  setStatus("running");
}

function pauseGame() {
  if (status === "running") {
    setStatus("paused");
  }
}

function resumeGame() {
  if (status === "paused") {
    setStatus("running");
  }
}

function togglePause() {
  if (status === "running") {
    pauseGame();
  } else if (status === "paused") {
    resumeGame();
  }
}

primaryAction.addEventListener("click", () => {
  if (status === "running") {
    pauseGame();
  } else if (status === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});

overlayButton.addEventListener("click", () => {
  if (status === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});

resetButton.addEventListener("click", () => {
  startGame();
});

window.addEventListener("resize", () => {
  resizeCanvases();
});

window.addEventListener("keydown", (event) => {
  const { code } = event;
  const controlKeys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    "KeyZ",
    "KeyX",
    "Space",
    "KeyP",
    "Enter"
  ];
  if (controlKeys.includes(code)) {
    event.preventDefault();
  }

  if (code === "Enter") {
    if (status === "running") {
      pauseGame();
    } else if (status === "paused") {
      resumeGame();
    } else {
      startGame();
    }
    return;
  }

  if (code === "KeyP") {
    togglePause();
    return;
  }

  if (status !== "running") {
    return;
  }

  if (code === "ArrowLeft") {
    move(-1, 0);
  } else if (code === "ArrowRight") {
    move(1, 0);
  } else if (code === "ArrowDown") {
    softDrop();
  } else if (code === "ArrowUp" || code === "KeyX") {
    rotatePiece(1);
  } else if (code === "KeyZ") {
    rotatePiece(-1);
  } else if (code === "Space") {
    hardDrop();
  }
});

resizeCanvases();
setStatus("idle");
updateStats();
update();
