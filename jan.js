class JanModel {
  constructor() {
    this.maxStacks = 10;
    this.enhancedThreshold = 5;
    this.baseCooldownReduction = 0.30;
    this.enhancedCooldownReduction = 0.30;
    this.enhancedEReduction = 0.40;

    this.skills = {
      Q: { key: "Q", name: "Q", baseCooldown: 8.0, cooldown: 0, state: "ready", q2Window: 3.0, q2Timer: 0, enhanced: false },
      W: { key: "W", name: "W", baseCooldown: 15.0, cooldown: 0, castDelay: 0.45, pending: 0, enhanced: false },
      E: { key: "E", name: "E", baseCooldown: 8.0, cooldown: 0, enhanced: false },
      R: { key: "R", name: "R", baseCooldown: 0.0, cooldown: 0, enhanced: false }
    };

    this.tactical = {
      key: "F", name: "블링크", distance: 3.0, cooldown: 0,
      enhancedDuration: 2.5, speedBonus: 0.15, enhancedTimer: 0
    };

    this.weapon = {
      key: "D", name: "어퍼컷", cooldown: 0, fixedCooldown: 5.0, range: 1.35
    };

    this.stacks = 0;
  }

  getEffectiveCooldown(key) {
    return this.skills[key].baseCooldown * (1 - this.baseCooldownReduction);
  }

  get enhancedReady() {
    return this.stacks >= this.enhancedThreshold;
  }

  addStack(amount = 1) {
    const before = this.stacks;
    this.stacks = Math.min(this.maxStacks, this.stacks + amount);
    return { before, after: this.stacks };
  }

  consumeEnhanced() {
    this.stacks = Math.max(0, this.stacks - this.enhancedThreshold);
  }

  getCooldownSnapshot() {
    return { Q: this.skills.Q.cooldown, W: this.skills.W.cooldown, E: this.skills.E.cooldown };
  }

  reduceByEffectiveFullCooldown(key, ratio) {
    const skill = this.skills[key];
    if (!skill || skill.cooldown <= 0) return 0;
    const amount = this.getEffectiveCooldown(key) * ratio;
    const before = skill.cooldown;
    skill.cooldown = Math.max(0, skill.cooldown - amount);
    return before - skill.cooldown;
  }

  applyEnhancedCooldownReduction() {
    const before = this.getCooldownSnapshot();
    for (const key of ["Q", "W", "E"]) {
      this.reduceByEffectiveFullCooldown(key, this.enhancedCooldownReduction);
    }
    return { before, after: this.getCooldownSnapshot() };
  }

  applyEnhancedEReduction() {
    const before = this.skills.E.cooldown;
    this.reduceByEffectiveFullCooldown("E", this.enhancedEReduction);
    return { before, after: this.skills.E.cooldown };
  }

  startCooldown(key) {
    this.skills[key].cooldown = this.getEffectiveCooldown(key);
  }

  castQ() {
    const q = this.skills.Q;

    if (q.state === "q2") {
      const enhanced = q.enhanced;
      q.state = "ready";
      q.q2Timer = 0;
      q.enhanced = false;
      this.startCooldown("Q");
      return { ok: true, stage: 2, enhanced, cooldownResult: null };
    }

    if (q.cooldown > 0) return { ok: false, reason: "cooldown" };

    const enhanced = this.enhancedReady;

    if (enhanced) {
      // The passive is consumed at Q1. The enhancement remains flagged for Q2,
      // but the passive cooldown reduction happens immediately at Q1.
      this.consumeEnhanced();
      const cooldownResult = this.applyEnhancedCooldownReduction();
      q.state = "q2";
      q.q2Timer = q.q2Window;
      q.enhanced = true;
      return { ok: true, stage: 1, enhanced: true, cooldownResult };
    }

    q.state = "q2";
    q.q2Timer = q.q2Window;
    q.enhanced = false;
    return { ok: true, stage: 1, enhanced: false, cooldownResult: null };
  }

  castW() {
    const w = this.skills.W;
    if (w.cooldown > 0 || w.pending > 0) return { ok: false, reason: "cooldown" };

    const enhanced = this.enhancedReady;
    if (enhanced) this.consumeEnhanced();

    w.pending = w.castDelay;
    w.enhanced = enhanced;

    let cooldownResult = null;
    if (enhanced) cooldownResult = this.applyEnhancedCooldownReduction();

    return { ok: true, enhanced, cooldownResult };
  }

  resolveW() {
    const w = this.skills.W;
    w.pending = 0;
    this.startCooldown("W");
    const enhanced = w.enhanced;
    w.enhanced = false;
    return { ok: true, enhanced, cooldownResult: null };
  }

  castE() {
    const e = this.skills.E;
    if (e.cooldown > 0) return { ok: false, reason: "cooldown" };

    const enhanced = this.enhancedReady;
    this.startCooldown("E");

    let cooldownResult = null;
    let eExtra = null;

    if (enhanced) {
      this.consumeEnhanced();
      cooldownResult = this.applyEnhancedCooldownReduction();
      eExtra = this.applyEnhancedEReduction();
    }

    return { ok: true, enhanced, cooldownResult, eExtra };
  }

  castR() {
    const stacks = this.addStack(5);
    return { ok: true, enhanced: false, stacks };
  }

  castBlink() {
    this.tactical.enhancedTimer = this.tactical.enhancedDuration;
    return { ok: true, distance: this.tactical.distance, enhancedDuration: this.tactical.enhancedDuration, speedBonus: this.tactical.speedBonus };
  }

  canUseUppercut() {
    return this.weapon.cooldown <= 0;
  }

  castUppercut() {
    if (!this.canUseUppercut()) return { ok: false, reason: "cooldown" };
    this.weapon.cooldown = this.weapon.fixedCooldown;
    return { ok: true };
  }

  getMoveSpeedMultiplier() {
    return this.tactical.enhancedTimer > 0 ? 1.15 : 1;
  }

  update(dt) {
    for (const key of ["Q", "W", "E", "R"]) {
      const skill = this.skills[key];
      skill.cooldown = Math.max(0, skill.cooldown - dt);
    }

    this.weapon.cooldown = Math.max(0, this.weapon.cooldown - dt);
    this.tactical.enhancedTimer = Math.max(0, this.tactical.enhancedTimer - dt);

    const q = this.skills.Q;
    if (q.state === "q2") {
      q.q2Timer -= dt;
      if (q.q2Timer <= 0) {
        q.q2Timer = 0;
        q.state = "ready";
        q.enhanced = false;
        this.startCooldown("Q");
        return { qWindowExpired: true, cooldown: this.getEffectiveCooldown("Q") };
      }
    }

    return { qWindowExpired: false };
  }

  reset() {
    this.stacks = 0;
    for (const key of Object.keys(this.skills)) {
      this.skills[key].cooldown = 0;
      this.skills[key].enhanced = false;
    }
    this.skills.Q.state = "ready";
    this.skills.Q.q2Timer = 0;
    this.skills.W.pending = 0;
    this.tactical.enhancedTimer = 0;
    this.weapon.cooldown = 0;
  }
}

// -----------------------------------------------------------------------------
// Trainer action recovery
// -----------------------------------------------------------------------------
// This lives here because jan.js is loaded before game.js. A capture-phase
// listener can therefore intercept the REAL keyboard path before game.js's
// normal keydown handler calls Q/W/E/R directly.
(() => {
  const RECOVERY = { Q: 0.18, W: 0.22, E: 0.18, R: 0.18 };
  let recovery = 0;
  let recoverySource = null;

  function canUseSkill(key) {
    if (recovery <= 0) return true;

    // E can be inserted during any recovery.
    if (key === "E") return true;

    // E -> Q is also an explicit zero-delay exception.
    if (key === "Q" && recoverySource === "E") return true;

    return false;
  }

  function castFromGame(key) {
    // game.js is loaded after this file, so these functions exist when the
    // player can actually press a key.
    if (typeof castSkill !== "function") return false;

    const before = {
      Q: jan.skills.Q.cooldown,
      W: jan.skills.W.cooldown,
      E: jan.skills.E.cooldown,
      R: jan.skills.R.cooldown,
      qState: jan.skills.Q.state,
      wPending: jan.skills.W.pending
    };

    castSkill(key);

    const after = {
      Q: jan.skills.Q.cooldown,
      W: jan.skills.W.cooldown,
      E: jan.skills.E.cooldown,
      R: jan.skills.R.cooldown,
      qState: jan.skills.Q.state,
      wPending: jan.skills.W.pending
    };

    if (key === "Q") return before.qState !== after.qState || before.Q !== after.Q;
    if (key === "W") return before.wPending !== after.wPending || before.W !== after.W;
    if (key === "E") return before.E !== after.E || after.E > 0;
    if (key === "R") return true;
    return false;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const key = e.key.toUpperCase();
    if (!["Q", "W", "E", "R"].includes(key)) return;

    if (!canUseSkill(key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof log === "function") log(`${key} 사용 불가 · 스킬 후딜 ${recovery.toFixed(2)}s`);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    const beforeWCount = typeof state !== "undefined" ? state.telegraph.length : 0;
    const success = castFromGame(key);
    if (!success) return;

    // A new cast cancels ordinary movement/attack commands.
    if (typeof state !== "undefined") {
      state.player.destination = null;
      state.player.target = null;
      state.player.attackMove = false;
      state.player.windup = 0;
      state.player.windupTarget = null;

      // WE: W's pending hitbox keeps its direction, but its ORIGIN follows
      // Yan. E has already moved Yan by the time this runs.
      if (key === "E" && state.telegraph.length >= beforeWCount) {
        for (const t of state.telegraph) {
          if (t.type === "W") {
            t.x = state.player.x;
            t.y = state.player.y;
          }
        }
      }
    }

    recovery = RECOVERY[key] || 0;
    recoverySource = key;
  }, true);

  // Block movement/attack commands during recovery. This does not block E/Q
  // because their keyboard path is handled above; it only affects mouse input.
  window.addEventListener("mousedown", (e) => {
    if (recovery <= 0) return;
    if (typeof canvas === "undefined") return;
    if (e.target !== canvas) return;

    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // Update recovery independently of game.js's frame loop.
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    recovery = Math.max(0, recovery - dt);
    if (recovery <= 0) recoverySource = null;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
