class JanModel {
  constructor() {
    this.maxStacks = 10;
    this.enhancedThreshold = 5;

    // Permanent item CDR used by the training setup.
    this.baseCooldownReduction = 0.30;

    // Passive enhancement cooldown reductions.
    // The live/base cooldown is reduced by item CDR first, then passive
    // enhancement subtracts a fixed fraction of that effective full cooldown.
    this.enhancedCooldownReduction = 0.30;
    this.enhancedEReduction = 0.40;

    this.skills = {
      Q: {
        key: "Q",
        name: "Q",
        baseCooldown: 8.0,
        cooldown: 0,
        state: "ready",
        q2Window: 3.0,
        q2Timer: 0,
        enhanced: false
      },
      W: {
        key: "W",
        name: "W",
        baseCooldown: 15.0,
        cooldown: 0,
        castDelay: 0.45,
        pending: 0,
        enhanced: false
      },
      E: {
        key: "E",
        name: "E",
        baseCooldown: 8.0,
        cooldown: 0,
        enhanced: false
      },
      R: {
        key: "R",
        name: "R",
        baseCooldown: 0.0,
        cooldown: 0,
        enhanced: false
      }
    };

    this.stacks = 0;
  }

  // Base cooldown after the permanent 30% item cooldown reduction.
  getEffectiveCooldown(key) {
    const skill = this.skills[key];
    return skill.baseCooldown * (1 - this.baseCooldownReduction);
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
    return {
      Q: this.skills.Q.cooldown,
      W: this.skills.W.cooldown,
      E: this.skills.E.cooldown
    };
  }

  // Passive cooldown reduction is based on the FULL effective cooldown,
  // not on the currently remaining cooldown.
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

  /*
   * Q1 -> Q2 state machine:
   * - Q1 starts a 3 second Q2 window.
   * - If Q2 is used inside the window, Q cooldown starts immediately.
   * - If the 3 second window expires, Q2 can no longer be used and Q cooldown
   *   starts automatically.
   * - If Q1 was enhanced, the same enhancement applies to Q2 and the passive
   *   resource is consumed only when the Q2 stage is completed.
   */
  castQ() {
    const q = this.skills.Q;

    if (q.state === "q2") {
      const enhanced = q.enhanced;

      q.state = "ready";
      q.q2Timer = 0;
      this.startCooldown("Q");

      let cooldownResult = null;
      if (enhanced) {
        this.consumeEnhanced();
        cooldownResult = this.applyEnhancedCooldownReduction();
      }

      q.enhanced = false;
      return { ok: true, stage: 2, enhanced, cooldownResult };
    }

    if (q.cooldown > 0) {
      return { ok: false, reason: "cooldown" };
    }

    const enhanced = this.enhancedReady;
    q.state = "q2";
    q.q2Timer = q.q2Window;
    q.enhanced = enhanced;

    return { ok: true, stage: 1, enhanced };
  }

  castW() {
    const w = this.skills.W;
    if (w.cooldown > 0 || w.pending > 0) {
      return { ok: false, reason: "cooldown" };
    }

    const enhanced = this.enhancedReady;
    w.pending = w.castDelay;
    w.enhanced = enhanced;
    return { ok: true, enhanced };
  }

  resolveW() {
    const w = this.skills.W;
    w.pending = 0;
    this.startCooldown("W");

    const enhanced = w.enhanced;
    w.enhanced = false;

    let cooldownResult = null;
    if (enhanced) {
      this.consumeEnhanced();
      cooldownResult = this.applyEnhancedCooldownReduction();
    }

    return { ok: true, enhanced, cooldownResult };
  }

  castE() {
    const e = this.skills.E;
    if (e.cooldown > 0) {
      return { ok: false, reason: "cooldown" };
    }

    const enhanced = this.enhancedReady;
    this.startCooldown("E");

    let cooldownResult = null;
    let eExtra = null;

    if (enhanced) {
      this.consumeEnhanced();
      // First: common enhanced-skill 30% reduction.
      cooldownResult = this.applyEnhancedCooldownReduction();
      // Then: enhanced E's additional 40% reduction.
      eExtra = this.applyEnhancedEReduction();
    }

    return { ok: true, enhanced, cooldownResult, eExtra };
  }

  castR() {
    // Training rule: R has no cooldown and immediately grants +5 stacks.
    const stacks = this.addStack(5);
    return { ok: true, enhanced: false, stacks };
  }

  update(dt) {
    for (const key of ["Q", "W", "E", "R"]) {
      const skill = this.skills[key];
      skill.cooldown = Math.max(0, skill.cooldown - dt);
    }

    const q = this.skills.Q;
    if (q.state === "q2") {
      q.q2Timer -= dt;

      if (q.q2Timer <= 0) {
        q.q2Timer = 0;
        q.state = "ready";
        q.enhanced = false;

        // Q2 window expired: Q cooldown starts immediately.
        this.startCooldown("Q");
        return {
          qWindowExpired: true,
          cooldown: this.getEffectiveCooldown("Q")
        };
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
  }
}
