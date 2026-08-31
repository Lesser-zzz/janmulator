class YanModel {
  constructor() {
    this.maxStacks = 10;
    this.enhancedThreshold = 5;

    // Live/base cooldowns requested by the user.
    // The trainer applies the user's standard 30% item cooldown reduction.
    this.baseCooldownReduction = 0.30;
    this.enhancedCooldownReduction = 0.30;
    this.enhancedEReduction = 0.40;

    this.skills = {
      Q: {
        key:"Q", name:"Q",
        baseCooldown:8.0,
        cooldown:0,
        state:"ready",
        q2Window:3.0,
        q2Timer:0,
        enhanced:false
      },
      W: {
        key:"W", name:"W",
        baseCooldown:15.0,
        cooldown:0,
        castDelay:0.45,
        pending:0,
        enhanced:false
      },
      E: {
        key:"E", name:"E",
        baseCooldown:8.0,
        cooldown:0,
        enhanced:false
      },
      R: {
        key:"R", name:"R",
        baseCooldown:0.0,
        cooldown:0,
        enhanced:false
      }
    };

    this.stacks = 0;
  }

  getEffectiveCooldown(key) {
    const s=this.skills[key];
    return s.baseCooldown * (1-this.baseCooldownReduction);
  }

  get enhancedReady() {
    return this.stacks >= this.enhancedThreshold;
  }

  addStack(amount=1) {
    const before=this.stacks;
    this.stacks=Math.min(this.maxStacks,this.stacks+amount);
    return {before,after:this.stacks};
  }

  consumeEnhanced() {
    this.stacks=Math.max(0,this.stacks-this.enhancedThreshold);
  }

  getCooldownSnapshot() {
    return {
      Q:this.skills.Q.cooldown,
      W:this.skills.W.cooldown,
      E:this.skills.E.cooldown
    };
  }

  reduceByEffectiveFullCooldown(key, ratio) {
    const s=this.skills[key];
    if(!s || s.cooldown<=0)return 0;

    const amount=this.getEffectiveCooldown(key)*ratio;
    const before=s.cooldown;
    s.cooldown=Math.max(0,s.cooldown-amount);
    return before-s.cooldown;
  }

  applyEnhancedCooldownReduction() {
    const before=this.getCooldownSnapshot();
    for(const k of ["Q","W","E"]){
      this.reduceByEffectiveFullCooldown(k,this.enhancedCooldownReduction);
    }
    return {before,after:this.getCooldownSnapshot()};
  }

  applyEnhancedEReduction() {
    const before=this.skills.E.cooldown;
    this.reduceByEffectiveFullCooldown("E",this.enhancedEReduction);
    return {before,after:this.skills.E.cooldown};
  }

  startCooldown(key) {
    this.skills[key].cooldown=this.getEffectiveCooldown(key);
  }

  castQ() {
    const q=this.skills.Q;

    if(q.state==="q2"){
      const enhanced=q.enhanced;
      q.state="ready";
      q.q2Timer=0;
      q.startingFromQ1=false;

      this.startCooldown("Q");

      let cooldownResult=null;
      if(enhanced){
        cooldownResult=this.applyEnhancedCooldownReduction();
      }

      q.enhanced=false;
      return {ok:true,stage:2,enhanced,cooldownResult};
    }

    if(q.cooldown>0){
      return {ok:false,reason:"cooldown"};
    }

    const enhanced=this.enhancedReady;
    if (enhanced) {
      this.consumeEnhanced();
    }
    
    q.state="q2";
    q.q2Timer=q.q2Window;
    q.enhanced=enhanced;

    return {ok:true,stage:1,enhanced};
  }

  castW() {
    const w=this.skills.W;
    if(w.cooldown>0 || w.pending>0){
      return {ok:false,reason:"cooldown"};
    }

    const enhanced=this.enhancedReady;
    if (enhanced) {
      this.consumeEnhanced();
    }

    w.pending=w.castDelay;
    w.enhanced=enhanced;
    return {ok:true,enhanced};
  }

  resolveW() {
    const w=this.skills.W;
    w.pending=0;
    this.startCooldown("W");

    const enhanced=w.enhanced;
    w.enhanced=false;

    let cooldownResult=null;
    if(enhanced){
      cooldownResult=this.applyEnhancedCooldownReduction();
    }

    return {ok:true,enhanced,cooldownResult};
  }

  castE() {
    const e=this.skills.E;
    if(e.cooldown>0){
      return {ok:false,reason:"cooldown"};
    }

    const enhanced=this.enhancedReady;
    this.startCooldown("E");

    let cooldownResult=null;
    let eExtra=null;

    if(enhanced){
      this.consumeEnhanced();
      cooldownResult=this.applyEnhancedCooldownReduction();
      eExtra=this.applyEnhancedEReduction();
    }

    return {ok:true,enhanced,cooldownResult,eExtra};
  }

  castR() {
    const stacks=this.addStack(5);
    return {ok:true,enhanced:false,stacks};
  }

  update(dt) {
    for(const k of ["Q","W","E","R"]){
      const s=this.skills[k];
      s.cooldown=Math.max(0,s.cooldown-dt);
    }

    const q=this.skills.Q;
    if(q.state==="q2"){
      q.q2Timer-=dt;

      if(q.q2Timer<=0){
        q.q2Timer=0;
        q.state="ready";
        q.enhanced=false;
        this.startCooldown("Q");
        return {qWindowExpired:true,cooldown:this.getEffectiveCooldown("Q")};
      }
    }

    return {qWindowExpired:false};
  }

  reset() {
    this.stacks=0;
    for(const k of Object.keys(this.skills)){
      this.skills[k].cooldown=0;
      this.skills[k].enhanced=false;
    }
    this.skills.Q.state="ready";
    this.skills.Q.q2Timer=0;
    this.skills.W.pending=0;
  }
}
