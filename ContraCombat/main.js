const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySubtitle = document.getElementById("overlaySubtitle");
const overlayButton = document.getElementById("overlayButton");
const primaryAction = document.getElementById("primaryAction");
const resetButton = document.getElementById("resetButton");
const statusChip = document.getElementById("statusChip");

const playerHealthBar = document.getElementById("playerHealth");
const enemyHealthBar = document.getElementById("enemyHealth");
const playerHpText = document.getElementById("playerHpText");
const enemyHpText = document.getElementById("enemyHpText");
const comboCountEl = document.getElementById("comboCount");
const comboNameEl = document.getElementById("comboName");

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const GROUND_Y = 420;
const MAX_HEALTH = 100;
const GRAVITY = 1800;
const PLAYER_SPEED = 240;
const ENEMY_SPEED = 250;
const JUMP_SPEED = 620;

const ATTACKS = {
  light: { duration: 0.22, damage: 6, range: 68, knock: 220, hitstun: 0.18, cooldown: 0.14 },
  heavy: { duration: 0.34, damage: 10, range: 76, knock: 260, hitstun: 0.24, cooldown: 0.2 },
  special: { duration: 0.45, damage: 18, range: 90, knock: 340, hitstun: 0.32, cooldown: 0.3 }
};

const COMBOS = [
  { name: "Blaster Uppercut", seq: ["light", "light", "heavy"], damage: 20, knock: 380 },
  { name: "Spiral Kick", seq: ["light", "heavy", "light"], damage: 18, knock: 320 },
  { name: "Breaker Shot", seq: ["heavy", "heavy", "light"], damage: 22, knock: 400 }
];

const COMBO_WINDOW = 0.9;
const COMBO_DECAY = 0.75;

const AI_MODES = {
  aggressive: { desired: 110, speed: 1.2, shoot: 0.08, combo: 0.5, retreat: 0.35 },
  neutral: { desired: 170, speed: 1.05, shoot: 0.1, combo: 0.32, retreat: 0.6 },
  defensive: { desired: 230, speed: 0.95, shoot: 0.14, combo: 0.2, retreat: 0.85 }
};

const enemyAI = {
  mode: "neutral",
  modeTimer: 0,
  action: null,
  dashCooldown: 0,
  think: 0,
  strafeTimer: 0,
  strafeDir: 1,
  attackQueue: []
};

const state = {
  status: "idle",
  lastTime: 0,
  shake: 0,
  hits: 0,
  bestCombo: 0,
  comboAnnounce: { name: "", timer: 0 }
};

const input = {
  left: false,
  right: false,
  jump: false
};

const inputBuffer = [];
let projectiles = [];
let effects = [];

const player = createFighter("player", 200, 1, { base: "#7bff6b", accent: "#ffb74a" });
const enemy = createFighter("enemy", 700, -1, { base: "#ff4f4f", accent: "#f0b15a" });

function createFighter(id, x, facing, palette) {
  return {
    id,
    pos: { x, y: GROUND_Y - 88 },
    vel: { x: 0, y: 0 },
    width: 48,
    height: 88,
    facing,
    health: MAX_HEALTH,
    attack: null,
    attackHit: false,
    cooldown: 0,
    stun: 0,
    blink: 0,
    onGround: true,
    blasterCooldown: 0,
    comboCount: 0,
    comboTimer: 0,
    lastHitAt: 0,
    palette
  };
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function setEnemyMode(mode) {
  enemyAI.mode = mode;
  enemyAI.modeTimer = randRange(0.9, 1.8);
}

function chooseEnemyMode() {
  const comboPressure = player.comboCount >= 3;
  const lowHealth = enemy.health < 35;
  if (lowHealth && Math.random() < 0.7) {
    setEnemyMode("defensive");
    return;
  }
  if (comboPressure && Math.random() < 0.6) {
    setEnemyMode("defensive");
    return;
  }
  const roll = Math.random();
  if (roll < 0.25) {
    setEnemyMode("aggressive");
  } else if (roll < 0.7) {
    setEnemyMode("neutral");
  } else {
    setEnemyMode("defensive");
  }
}

function startEnemyDash(dir) {
  if (enemyAI.dashCooldown > 0) {
    return false;
  }
  enemyAI.action = { type: "dash", timer: 0.18, dir };
  enemyAI.dashCooldown = 0.9;
  return true;
}

function tryEnemyDisengage() {
  if (enemyAI.action || enemyAI.dashCooldown > 0 || enemy.stun > 0) {
    return;
  }
  const mode = AI_MODES[enemyAI.mode];
  if (Math.random() > mode.retreat) {
    return;
  }
  const distance = player.pos.x - enemy.pos.x;
  const awayDir = distance === 0 ? -enemy.facing : -Math.sign(distance);
  startEnemyDash(awayDir);
}

function setStatus(nextStatus) {
  state.status = nextStatus;
  updateOverlay();
  updateStatusChip();
}

function updateStatusChip() {
  const map = {
    idle: "IDLE",
    running: "LIVE",
    paused: "PAUSED",
    over: "RESULT"
  };
  statusChip.textContent = map[state.status] || "IDLE";
}

function updateOverlay() {
  overlay.classList.toggle("is-visible", state.status !== "running");
  if (state.status === "idle") {
    overlayTitle.textContent = "Press Enter";
    overlaySubtitle.textContent = "Lock and load. Keep combos alive to break the enemy.";
    overlayButton.textContent = "Start Mission";
  } else if (state.status === "paused") {
    overlayTitle.textContent = "Paused";
    overlaySubtitle.textContent = "Press Enter to resume.";
    overlayButton.textContent = "Resume";
  } else if (state.status === "over") {
    const win = enemy.health <= 0 && player.health > 0;
    overlayTitle.textContent = win ? "Mission Complete" : "Mission Failed";
    overlaySubtitle.textContent = `Hits: ${state.hits} | Best combo: ${state.bestCombo}`;
    overlayButton.textContent = "Restart";
  }
}

function resetGame() {
  player.pos.x = 200;
  player.pos.y = GROUND_Y - player.height;
  player.vel.x = 0;
  player.vel.y = 0;
  player.health = MAX_HEALTH;
  player.attack = null;
  player.attackHit = false;
  player.cooldown = 0;
  player.stun = 0;
  player.blink = 0;
  player.onGround = true;
  player.blasterCooldown = 0;
  player.comboCount = 0;
  player.comboTimer = 0;
  player.lastHitAt = 0;

  enemy.pos.x = 700;
  enemy.pos.y = GROUND_Y - enemy.height;
  enemy.vel.x = 0;
  enemy.vel.y = 0;
  enemy.health = MAX_HEALTH;
  enemy.attack = null;
  enemy.attackHit = false;
  enemy.cooldown = 0;
  enemy.stun = 0;
  enemy.blink = 0;
  enemy.onGround = true;
  enemy.blasterCooldown = 0;

  enemyAI.mode = "neutral";
  enemyAI.modeTimer = 0;
  enemyAI.action = null;
  enemyAI.dashCooldown = 0;
  enemyAI.think = 0;
  enemyAI.strafeTimer = 0;
  enemyAI.strafeDir = 1;
  enemyAI.attackQueue.length = 0;

  inputBuffer.length = 0;
  projectiles = [];
  effects = [];
  state.hits = 0;
  state.bestCombo = 0;
  state.comboAnnounce = { name: "", timer: 0 };
  state.shake = 0;
  updateHud();
}

function startGame() {
  resetGame();
  setStatus("running");
}

function pauseGame() {
  if (state.status === "running") {
    setStatus("paused");
  }
}

function resumeGame() {
  if (state.status === "paused") {
    setStatus("running");
  }
}

function queueAttack(type) {
  if (state.status !== "running") {
    return;
  }
  if (player.stun > 0 || player.attack || player.cooldown > 0) {
    return;
  }
  const now = performance.now() / 1000;
  if (type === "light" || type === "heavy") {
    inputBuffer.push({ type, time: now });
    pruneBuffer(now);
    const combo = matchCombo(now);
    if (combo) {
      startAttack(player, "special", combo);
      inputBuffer.length = 0;
      return;
    }
  }
  startAttack(player, type, null);
}

function pruneBuffer(now) {
  const cutoff = now - COMBO_WINDOW;
  while (inputBuffer.length && inputBuffer[0].time < cutoff) {
    inputBuffer.shift();
  }
}

function matchCombo(now) {
  for (const combo of COMBOS) {
    if (inputBuffer.length < combo.seq.length) {
      continue;
    }
    const recent = inputBuffer.slice(-combo.seq.length);
    const matches = recent.every((entry, index) => entry.type === combo.seq[index]);
    const timeSpan = recent[recent.length - 1].time - recent[0].time;
    if (matches && timeSpan <= COMBO_WINDOW) {
      return combo;
    }
  }
  return null;
}

function startAttack(fighter, type, combo) {
  const base = ATTACKS[type];
  fighter.attack = {
    type,
    timer: base.duration,
    damage: combo ? combo.damage : base.damage,
    range: combo ? base.range + 16 : base.range,
    knock: combo ? combo.knock : base.knock,
    hitstun: base.hitstun,
    comboName: combo ? combo.name : ""
  };
  fighter.attackHit = false;
  fighter.cooldown = base.cooldown;
  if (combo && fighter.id === "player") {
    announceCombo(combo.name);
    state.shake = Math.max(state.shake, 8);
  }
}

function announceCombo(name) {
  state.comboAnnounce = { name, timer: 1.2 };
}

function queueShot(owner) {
  if (state.status !== "running") {
    return;
  }
  if (owner.blasterCooldown > 0 || owner.stun > 0) {
    return;
  }
  const offsetX = owner.facing === 1 ? owner.width + 12 : -12;
  projectiles.push({
    owner,
    x: owner.pos.x + offsetX,
    y: owner.pos.y + owner.height * 0.4,
    dir: owner.facing,
    speed: 520,
    damage: 4,
    life: 1.4
  });
  owner.blasterCooldown = owner.id === "enemy" ? 0.45 : 0.6;
}

function updateFighter(fighter, dt, isPlayer) {
  if (fighter.cooldown > 0) {
    fighter.cooldown = Math.max(0, fighter.cooldown - dt);
  }
  if (fighter.stun > 0) {
    fighter.stun = Math.max(0, fighter.stun - dt);
  }
  if (fighter.blink > 0) {
    fighter.blink = Math.max(0, fighter.blink - dt);
  }
  if (fighter.blasterCooldown > 0) {
    fighter.blasterCooldown = Math.max(0, fighter.blasterCooldown - dt);
  }

  if (fighter.attack) {
    fighter.attack.timer -= dt;
    if (fighter.attack.timer <= 0) {
      fighter.attack = null;
      fighter.attackHit = false;
    }
  }

  if (fighter.stun <= 0) {
    if (isPlayer) {
      const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      fighter.vel.x = moveDir * PLAYER_SPEED;
      if (input.jump && fighter.onGround) {
        fighter.vel.y = -JUMP_SPEED;
        fighter.onGround = false;
      }
      input.jump = false;
    } else {
      updateEnemyAI(dt);
    }
  } else {
    fighter.vel.x = 0;
  }

  fighter.vel.y += GRAVITY * dt;
  fighter.pos.x += fighter.vel.x * dt;
  fighter.pos.y += fighter.vel.y * dt;

  if (fighter.pos.y >= GROUND_Y - fighter.height) {
    fighter.pos.y = GROUND_Y - fighter.height;
    fighter.vel.y = 0;
    fighter.onGround = true;
  }

  const bounds = 30;
  if (fighter.pos.x < bounds) {
    fighter.pos.x = bounds;
  }
  if (fighter.pos.x > VIEW_WIDTH - fighter.width - bounds) {
    fighter.pos.x = VIEW_WIDTH - fighter.width - bounds;
  }

  if (fighter.vel.x > 0.1) {
    fighter.facing = 1;
  } else if (fighter.vel.x < -0.1) {
    fighter.facing = -1;
  }
}

function updateEnemyAI(dt) {
  enemyAI.modeTimer = Math.max(0, enemyAI.modeTimer - dt);
  enemyAI.dashCooldown = Math.max(0, enemyAI.dashCooldown - dt);
  enemyAI.think = Math.max(0, enemyAI.think - dt);
  enemyAI.strafeTimer = Math.max(0, enemyAI.strafeTimer - dt);

  if (enemyAI.modeTimer <= 0) {
    chooseEnemyMode();
  }

  if (enemyAI.action) {
    enemyAI.action.timer -= dt;
    if (enemyAI.action.type === "dash") {
      enemy.vel.x = enemyAI.action.dir * ENEMY_SPEED * 2.4;
    }
    if (enemyAI.action.timer <= 0) {
      enemyAI.action = null;
    }
    return;
  }

  if (enemyAI.attackQueue.length > 0 && !enemy.attack && enemy.cooldown <= 0 && enemy.stun <= 0) {
    const next = enemyAI.attackQueue.shift();
    startAttack(enemy, next, null);
  }

  const distance = player.pos.x - enemy.pos.x;
  enemy.facing = distance >= 0 ? 1 : -1;
  const absDist = Math.abs(distance);
  const mode = AI_MODES[enemyAI.mode];
  const speed = ENEMY_SPEED * mode.speed;

  const playerThreat = player.attack && absDist < 130;
  if (playerThreat) {
    const awayDir = distance === 0 ? -enemy.facing : -Math.sign(distance);
    const towardDir = distance === 0 ? enemy.facing : Math.sign(distance);
    const dashDir = enemyAI.mode === "aggressive" && Math.random() < 0.2 ? towardDir : awayDir;
    if (startEnemyDash(dashDir)) {
      return;
    }
    if (enemy.onGround && Math.random() < 0.4) {
      enemy.vel.y = -JUMP_SPEED * 0.85;
      enemy.onGround = false;
    }
  }

  if (!enemy.attack && enemy.cooldown <= 0 && enemy.stun <= 0 && enemyAI.think <= 0) {
    if (absDist < 120) {
      if (Math.random() < mode.combo) {
        const route =
          Math.random() < 0.4 ? ["light", "heavy", "light"] : ["light", "light", "heavy"];
        enemyAI.attackQueue.push(...route);
      } else {
        const type = Math.random() < 0.55 ? "light" : "heavy";
        startAttack(enemy, type, null);
      }
      enemyAI.think = randRange(0.14, 0.32);
    } else if (absDist > 170 && enemy.blasterCooldown <= 0 && Math.random() < mode.shoot) {
      queueShot(enemy);
      enemyAI.think = randRange(0.2, 0.42);
    }
  }

  const desired = mode.desired;
  if (absDist > desired + 24) {
    enemy.vel.x = Math.sign(distance) * speed;
  } else if (absDist < desired - 24) {
    enemy.vel.x = -Math.sign(distance) * speed;
  } else {
    if (enemyAI.strafeTimer <= 0) {
      enemyAI.strafeTimer = randRange(0.4, 1.2);
      enemyAI.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    enemy.vel.x = enemyAI.strafeDir * speed * 0.55;
  }

  if (enemyAI.mode === "aggressive" && absDist > 200) {
    const towardDir = distance === 0 ? enemy.facing : Math.sign(distance);
    if (Math.random() < 0.07) {
      startEnemyDash(towardDir);
    }
  }

  if (absDist > 220 && enemy.onGround && Math.random() < 0.004) {
    enemy.vel.y = -JUMP_SPEED * 0.8;
    enemy.onGround = false;
  }
}

function updateProjectiles(dt) {
  projectiles.forEach((proj) => {
    proj.x += proj.speed * proj.dir * dt;
    proj.life -= dt;
  });
  projectiles = projectiles.filter((proj) => proj.life > 0 && proj.x > -40 && proj.x < VIEW_WIDTH + 40);
}

function applyHit(attacker, target, damage, knock, hitX, hitY) {
  target.health = Math.max(0, target.health - damage);
  target.vel.x = knock * attacker.facing;
  target.vel.y = -220;
  target.stun = 0.16;
  target.blink = 0.12;
  state.shake = Math.max(state.shake, 10);
  effects.push({ x: hitX, y: hitY, life: 0.2, size: 18, color: "#ffd66b" });

  if (attacker.id === "enemy") {
    tryEnemyDisengage();
  }

  if (attacker.id === "player") {
    const now = performance.now() / 1000;
    if (now - player.lastHitAt <= COMBO_DECAY) {
      player.comboCount += 1;
    } else {
      player.comboCount = 1;
    }
    player.lastHitAt = now;
    player.comboTimer = COMBO_DECAY + 0.2;
    state.hits += 1;
    if (player.comboCount > state.bestCombo) {
      state.bestCombo = player.comboCount;
    }
  }
}

function checkMeleeHit(attacker, target) {
  if (!attacker.attack || attacker.attackHit) {
    return;
  }
  const attack = attacker.attack;
  const attackerCenter = attacker.pos.x + attacker.width / 2;
  const targetCenter = target.pos.x + target.width / 2;
  const dx = targetCenter - attackerCenter;
  const facingOk = dx === 0 || Math.sign(dx) === attacker.facing;
  const withinRange = Math.abs(dx) < attack.range;
  const verticalOverlap =
    target.pos.y + target.height > attacker.pos.y + 12 &&
    target.pos.y < attacker.pos.y + attacker.height - 8;

  if (facingOk && withinRange && verticalOverlap) {
    applyHit(attacker, target, attack.damage, attack.knock, targetCenter, target.pos.y + 24);
    attacker.attackHit = true;
  }
}

function checkProjectileHits() {
  projectiles.forEach((proj) => {
    const target = proj.owner.id === "player" ? enemy : player;
    if (
      proj.x > target.pos.x &&
      proj.x < target.pos.x + target.width &&
      proj.y > target.pos.y &&
      proj.y < target.pos.y + target.height
    ) {
      applyHit(proj.owner, target, proj.damage, 120, proj.x, proj.y);
      proj.life = 0;
    }
  });
}

function updateEffects(dt) {
  effects.forEach((fx) => {
    fx.life -= dt;
  });
  effects = effects.filter((fx) => fx.life > 0);
}

function updateComboTimer(dt) {
  if (player.comboTimer > 0) {
    player.comboTimer -= dt;
  } else {
    player.comboCount = 0;
  }

  if (state.comboAnnounce.timer > 0) {
    state.comboAnnounce.timer -= dt;
    if (state.comboAnnounce.timer <= 0) {
      state.comboAnnounce.name = "";
    }
  }
}

function updateHud() {
  playerHealthBar.style.width = `${(player.health / MAX_HEALTH) * 100}%`;
  enemyHealthBar.style.width = `${(enemy.health / MAX_HEALTH) * 100}%`;
  playerHpText.textContent = Math.ceil(player.health);
  enemyHpText.textContent = Math.ceil(enemy.health);
  comboCountEl.textContent = player.comboCount;
  comboNameEl.textContent = state.comboAnnounce.name || (player.comboCount > 1 ? "Chain" : "-");
}

function checkGameOver() {
  if (player.health <= 0 || enemy.health <= 0) {
    setStatus("over");
  }
}

function step(dt) {
  updateFighter(player, dt, true);
  updateFighter(enemy, dt, false);
  updateProjectiles(dt);
  checkMeleeHit(player, enemy);
  checkMeleeHit(enemy, player);
  checkProjectileHits();
  updateEffects(dt);
  updateComboTimer(dt);
  updateHud();
  checkGameOver();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, "#101820");
  gradient.addColorStop(1, "#05080c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.strokeStyle = "rgba(123, 255, 107, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= VIEW_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW_HEIGHT);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  for (let y = 0; y <= VIEW_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#0a1016";
  ctx.fillRect(0, GROUND_Y + 12, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
  ctx.fillStyle = "rgba(123, 255, 107, 0.3)";
  ctx.fillRect(0, GROUND_Y, VIEW_WIDTH, 4);
}

function drawFighter(fighter) {
  const { x, y } = fighter.pos;
  ctx.save();
  if (fighter.blink > 0 && Math.floor(fighter.blink * 60) % 2 === 0) {
    ctx.globalAlpha = 0.6;
  }
  ctx.fillStyle = fighter.palette.base;
  ctx.fillRect(x, y, fighter.width, fighter.height);

  ctx.fillStyle = "#0d1118";
  ctx.fillRect(x + fighter.width * 0.2, y + 8, fighter.width * 0.6, 18);

  ctx.fillStyle = fighter.palette.accent;
  ctx.fillRect(x + fighter.width * 0.2, y + 34, fighter.width * 0.6, 12);

  const gunLength = 20;
  const gunX = fighter.facing === 1 ? x + fighter.width : x - gunLength;
  ctx.fillStyle = "#c7d0dc";
  ctx.fillRect(gunX, y + 42, gunLength, 6);

  if (fighter.attack) {
    drawAttackArc(fighter);
  }
  ctx.restore();
}

function drawAttackArc(fighter) {
  const arcX = fighter.facing === 1 ? fighter.pos.x + fighter.width + 10 : fighter.pos.x - 20;
  const arcY = fighter.pos.y + 30;
  ctx.strokeStyle = fighter.palette.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(arcX, arcY, 18, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

function drawProjectiles() {
  projectiles.forEach((proj) => {
    ctx.fillStyle = proj.owner.id === "player" ? "#7bff6b" : "#ff6b6b";
    ctx.fillRect(proj.x, proj.y, 8, 3);
  });
}

function drawEffects() {
  effects.forEach((fx) => {
    ctx.globalAlpha = Math.max(0, fx.life * 4);
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx.x - fx.size, fx.y);
    ctx.lineTo(fx.x + fx.size, fx.y);
    ctx.moveTo(fx.x, fx.y - fx.size);
    ctx.lineTo(fx.x, fx.y + fx.size);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    const shakeX = (Math.random() - 0.5) * state.shake;
    const shakeY = (Math.random() - 0.5) * state.shake;
    ctx.translate(shakeX, shakeY);
    state.shake = Math.max(0, state.shake - 0.6);
  }
  drawBackground();
  drawFighter(player);
  drawFighter(enemy);
  drawProjectiles();
  drawEffects();
  ctx.restore();
}

function gameLoop(timestamp) {
  const time = timestamp / 1000;
  const dt = Math.min(0.033, time - state.lastTime || 0);
  state.lastTime = time;
  if (state.status === "running") {
    step(dt);
  }
  draw();
  requestAnimationFrame(gameLoop);
}

primaryAction.addEventListener("click", () => {
  if (state.status === "running") {
    pauseGame();
  } else if (state.status === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});

resetButton.addEventListener("click", () => {
  setStatus("idle");
  resetGame();
});

overlayButton.addEventListener("click", () => {
  if (state.status === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});

window.addEventListener("keydown", (event) => {
  const { code } = event;
  const controlKeys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyP",
    "Enter"
  ];
  if (controlKeys.includes(code)) {
    event.preventDefault();
  }

  if (code === "Enter") {
    if (state.status === "running") {
      pauseGame();
    } else if (state.status === "paused") {
      resumeGame();
    } else {
      startGame();
    }
    return;
  }

  if (code === "KeyP") {
    if (state.status === "running") {
      pauseGame();
    } else if (state.status === "paused") {
      resumeGame();
    }
    return;
  }

  if (state.status !== "running") {
    return;
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = true;
  } else if (code === "ArrowRight" || code === "KeyD") {
    input.right = true;
  } else if (code === "ArrowUp" || code === "KeyW") {
    input.jump = true;
  } else if (code === "KeyJ") {
    queueAttack("light");
  } else if (code === "KeyK") {
    queueAttack("heavy");
  } else if (code === "KeyL") {
    queueShot(player);
  }
});

window.addEventListener("keyup", (event) => {
  const { code } = event;
  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = false;
  } else if (code === "ArrowRight" || code === "KeyD") {
    input.right = false;
  }
});

setStatus("idle");
updateHud();
requestAnimationFrame(gameLoop);
