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
      q.startingFromQ1 = false;
      this.startCooldown("Q");
      
      q.enhanced = false;
      // Q2에서는 더 이상 쿨감이 발생하지 않음
      return { ok: true, stage: 2, enhanced, cooldownResult: null };
    }

    if (q.cooldown > 0) return { ok: false, reason: "cooldown" };

    const enhanced = this.enhancedReady;
    let cooldownResult = null;

    if (enhanced) {
      this.consumeEnhanced();
      // FIX: 여기서 드디어 Q1 시전 즉시 쿨감이 들어감!
      cooldownResult = this.applyEnhancedCooldownReduction(); 
    }

    q.state = "q2";
    q.q2Timer = q.q2Window;
    q.enhanced = enhanced;

    return { ok: true, stage: 1, enhanced, cooldownResult };
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
