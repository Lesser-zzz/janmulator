class JanModel {
  constructor() {
    this.maxStacks=10; this.enhancedThreshold=5;
    this.baseCooldownReduction=.30; this.enhancedCooldownReduction=.30; this.enhancedEReduction=.40;
    this.skills={Q:{key:"Q",name:"Q",baseCooldown:8,cooldown:0,state:"ready",q2Window:3,q2Timer:0,enhanced:false},W:{key:"W",name:"W",baseCooldown:15,cooldown:0,castDelay:.45,pending:0,enhanced:false},E:{key:"E",name:"E",baseCooldown:8,cooldown:0,enhanced:false},R:{key:"R",name:"R",baseCooldown:0,cooldown:0,enhanced:false}};
    this.tactical={key:"D",name:"블링크",distance:3,cooldown:0,enhancedDuration:2.5,speedBonus:.15,enhancedTimer:0};
    this.weapon={key:"F",name:"어퍼컷",cooldown:0,fixedCooldown:5,range:1.35}; this.stacks=0;
  }
  getEffectiveCooldown(k){return this.skills[k].baseCooldown*(1-this.baseCooldownReduction)}
  get enhancedReady(){return this.stacks>=this.enhancedThreshold}
  addStack(n=1){const before=this.stacks;this.stacks=Math.min(this.maxStacks,this.stacks+n);return{before,after:this.stacks}}
  consumeEnhanced(){this.stacks=Math.max(0,this.stacks-this.enhancedThreshold)}
  getCooldownSnapshot(){return{Q:this.skills.Q.cooldown,W:this.skills.W.cooldown,E:this.skills.E.cooldown}}
  reduceByEffectiveFullCooldown(k,r){const s=this.skills[k];if(!s||s.cooldown<=0)return 0;const amount=this.getEffectiveCooldown(k)*r;const before=s.cooldown;s.cooldown=Math.max(0,s.cooldown-amount);return before-s.cooldown}
  applyEnhancedCooldownReduction(){const before=this.getCooldownSnapshot();for(const k of ["Q","W","E"])this.reduceByEffectiveFullCooldown(k,this.enhancedCooldownReduction);return{before,after:this.getCooldownSnapshot()}}
  applyEnhancedEReduction(){const before=this.skills.E.cooldown;this.reduceByEffectiveFullCooldown("E",this.enhancedEReduction);return{before,after:this.skills.E.cooldown}}
  startCooldown(k){this.skills[k].cooldown=this.getEffectiveCooldown(k)}

  // A passive proc happens when the skill is USED. Q1 consumes the enhancement
  // immediately, while the enhanced flag remains on Q2 for Q2's separate effect.
  castQ(){const q=this.skills.Q;
    if(q.state==="q2"){const enhanced=q.enhanced;q.state="ready";q.q2Timer=0;q.enhanced=false;this.startCooldown("Q");return{ok:true,stage:2,enhanced,cooldownResult:null}}
    if(q.cooldown>0)return{ok:false,reason:"cooldown"};
    const enhanced=this.enhancedReady;
    if(enhanced){this.consumeEnhanced();const cooldownResult=this.applyEnhancedCooldownReduction();q.state="q2";q.q2Timer=q.q2Window;q.enhanced=true;return{ok:true,stage:1,enhanced:true,cooldownResult}}
    q.state="q2";q.q2Timer=q.q2Window;q.enhanced=false;return{ok:true,stage:1,enhanced:false,cooldownResult:null}
  }
  castW(){const w=this.skills.W;if(w.cooldown>0||w.pending>0)return{ok:false,reason:"cooldown"};const enhanced=this.enhancedReady;if(enhanced){this.consumeEnhanced();}w.pending=w.castDelay;w.enhanced=enhanced;let cooldownResult=null;if(enhanced)cooldownResult=this.applyEnhancedCooldownReduction();return{ok:true,enhanced,cooldownResult}}
  resolveW(){const w=this.skills.W;w.pending=0;this.startCooldown("W");const enhanced=w.enhanced;w.enhanced=false;return{ok:true,enhanced,cooldownResult:null}}
  castE(){const e=this.skills.E;if(e.cooldown>0)return{ok:false,reason:"cooldown"};const enhanced=this.enhancedReady;this.startCooldown("E");let cooldownResult=null,eExtra=null;if(enhanced){this.consumeEnhanced();cooldownResult=this.applyEnhancedCooldownReduction();eExtra=this.applyEnhancedEReduction()}return{ok:true,enhanced,cooldownResult,eExtra}}
  castR(){return{ok:true,enhanced:false,stacks:this.addStack(5)}}
  castBlink(){this.tactical.enhancedTimer=this.tactical.enhancedDuration;return{ok:true,distance:3,enhancedDuration:2.5,speedBonus:.15}}
  canUseUppercut(){return this.weapon.cooldown<=0}
  castUppercut(){if(!this.canUseUppercut())return{ok:false,reason:"cooldown"};this.weapon.cooldown=this.weapon.fixedCooldown;return{ok:true}}
  getMoveSpeedMultiplier(){return this.tactical.enhancedTimer>0?1.15:1}
  update(dt){for(const k of ["Q","W","E","R"])this.skills[k].cooldown=Math.max(0,this.skills[k].cooldown-dt);this.weapon.cooldown=Math.max(0,this.weapon.cooldown-dt);this.tactical.enhancedTimer=Math.max(0,this.tactical.enhancedTimer-dt);const q=this.skills.Q;if(q.state==="q2"){q.q2Timer-=dt;if(q.q2Timer<=0){q.q2Timer=0;q.state="ready";q.enhanced=false;this.startCooldown("Q");return{qWindowExpired:true,cooldown:this.getEffectiveCooldown("Q")}}}return{qWindowExpired:false}}
  reset(){this.stacks=0;for(const k of Object.keys(this.skills)){this.skills[k].cooldown=0;this.skills[k].enhanced=false}this.skills.Q.state="ready";this.skills.Q.q2Timer=0;this.skills.W.pending=0;this.tactical.enhancedTimer=0;this.weapon.cooldown=0}
}
