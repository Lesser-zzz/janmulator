// D: Uppercut / F: Blink + movement recovery layer.
// IMPORTANT: Q/W/E/R are intentionally NOT intercepted here.
// game.js owns their keyboard input. Recovery only locks MOVEMENT, so skills
// can always chain. This is what allows 10-stack E -> Q -> E with zero delay.
(function(){
  const skillsHud=document.getElementById("skillsHud");
  const blinkHud=document.createElement("div");
  const uppercutHud=document.createElement("div");
  blinkHud.id="skillF";
  uppercutHud.id="skillD";
  blinkHud.className="skill-box";
  uppercutHud.className="skill-box";
  if(skillsHud){skillsHud.appendChild(uppercutHud);skillsHud.appendChild(blinkHud)}

  const PIXELS_PER_METER=cfg.E_DISTANCE/3;
  const RECOVERY={Q:.18,W:.22,E:.18,R:.18};
  let recovery=0;
  let recoverySource=null;

  state.player.uppercutTarget=null;
  state.player.uppercutPending=false;

  function formatTime(t){return t>0?t.toFixed(1):"READY"}
  function updateExtraHud(){
    state.player.moveSpeed=245*jan.getMoveSpeedMultiplier();
    uppercutHud.innerHTML=`<div class="skill-key">D</div><div class="skill-name">어퍼컷</div><div class="skill-time">${formatTime(jan.weapon.cooldown)}</div>`;
    blinkHud.innerHTML=`<div class="skill-key">F</div>${jan.tactical.enhancedTimer>0?'<div class="skill-tag">MODULE</div>':''}<div class="skill-name">블링크</div><div class="skill-time">READY</div>`;
    uppercutHud.style.display="block";
    uppercutHud.style.visibility="visible";
    uppercutHud.style.opacity=jan.weapon.cooldown>0?".55":"1";
    blinkHud.style.display="block";
    blinkHud.style.visibility="visible";
    blinkHud.style.opacity="1";
  }

  function lockMovement(){
    state.player.destination=null;
    state.player.attackMove=false;
    state.player.target=null;
    state.player.windup=0;
    state.player.windupTarget=null;
  }

  // Preserve the original, already-working movement implementation. We only
  // stop it while a skill recovery is active.
  const originalUpdatePlayer=window.updatePlayer;
  if(typeof originalUpdatePlayer==="function"){
    window.updatePlayer=function(dt){
      if(recovery>0){
        state.player.attackCooldown=Math.max(0,state.player.attackCooldown-dt);
        return;
      }
      return originalUpdatePlayer(dt);
    };
  }

  // Mouse movement/attack commands are ignored during recovery.
  window.addEventListener("mousedown",function(e){
    if(recovery<=0||e.target!==canvas)return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);

  // -----------------------------------------------------------------------
  // Detect successful Q/W/E/R casts AFTER game.js handles them.
  // We do not touch the keyboard event itself, so no skill can be blocked.
  // -----------------------------------------------------------------------
  let previous={
    qState:jan.skills.Q.state,
    qCooldown:jan.skills.Q.cooldown,
    wPending:jan.skills.W.pending,
    wCooldown:jan.skills.W.cooldown,
    eCooldown:jan.skills.E.cooldown,
    rStacks:jan.stacks
  };

  function detectSkillCast(){
    const q=jan.skills.Q,w=jan.skills.W,e=jan.skills.E;
    let source=null;

    if(q.state!==previous.qState)source="Q";
    else if(w.pending>0&&previous.wPending<=0)source="W";
    else if(e.cooldown>previous.eCooldown)source="E";
    else if(jan.stacks>=previous.rStacks+5)source="R";

    if(source){
      recovery=RECOVERY[source];
      recoverySource=source;
      lockMovement();

      // WE interaction: E has already moved Yan when this observer runs.
      // Move the pending W origin to Yan's current position while preserving
      // the W direction stored in t.a.
      if(source==="E"){
        for(const t of state.telegraph){
          if(t.type==="W"){
            t.x=state.player.x;
            t.y=state.player.y;
          }
        }
      }
    }

    previous={
      qState:q.state,
      qCooldown:q.cooldown,
      wPending:w.pending,
      wCooldown:w.cooldown,
      eCooldown:e.cooldown,
      rStacks:jan.stacks
    };
  }

  let last=performance.now();
  function tick(now){
    const dt=Math.min((now-last)/1000,.05);
    last=now;
    recovery=Math.max(0,recovery-dt);
    detectSkillCast();
    updateExtraHud();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function blink(){
    const result=jan.castBlink();
    const p=state.player;
    const dx=state.mouse.x-p.x,dy=state.mouse.y-p.y,len=Math.hypot(dx,dy);
    if(len<=0)return;
    const distanceToBlink=Math.min(result.distance*PIXELS_PER_METER,len);
    const nx=dx/len,ny=dy/len;
    const oldX=p.x,oldY=p.y;
    p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x+nx*distanceToBlink));
    p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y+ny*distanceToBlink));
    lockMovement();
    p.facing=Math.atan2(ny,nx);
    state.particles.push({type:"blink",x:oldX,y:oldY,tx:p.x,ty:p.y,life:.22,max:.22});
    log(`<b>블링크(F)</b> · 3.0m 순간이동 · 2.5초 이동속도 +15%`);
    updateExtraHud();
  }

  function uppercut(){
    if(!jan.canUseUppercut()){
      log(`어퍼컷 사용 불가 · 쿨다운 ${jan.weapon.cooldown.toFixed(1)}s`);
      return;
    }
    const target=nearestDummyToPoint(state.mouse);
    if(!target)return;
    state.player.destination=null;
    state.player.target=target;
    state.player.attackMove=false;
    state.player.uppercutTarget=target;
    state.player.uppercutPending=true;
    state.player.windup=0;
    state.player.windupTarget=null;
    modeEl.textContent=`어퍼컷 대상 DUMMY ${target.id}`;
  }

  // D/F are separate actions and are not part of Q/W/E/R recovery gating.
  window.addEventListener("keydown",function(e){
    if(e.repeat)return;
    const key=e.key.toLowerCase();
    if(key==="d"){e.preventDefault();uppercut()}
    else if(key==="f"){e.preventDefault();blink()}
  });

  // Uppercut movement-to-target execution. It behaves like attack-move:
  // selecting a target causes Yan to approach it instead of requiring range.
  const originalUpdateForUppercut=window.updatePlayer;
  window.updatePlayer=function(dt){
    if(state.player.uppercutPending&&state.player.uppercutTarget){
      const p=state.player,target=p.uppercutTarget;
      const maxRange=jan.weapon.range*PIXELS_PER_METER;
      if(distance(p,target)>maxRange+target.r){
        const dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy)||1;
        p.facing=Math.atan2(dy,dx);
        const step=Math.min(len,p.moveSpeed*dt);
        p.x+=dx/len*step;p.y+=dy/len*step;
        return;
      }
      if(jan.canUseUppercut()){
        const result=jan.castUppercut();
        if(result.ok){
          hitDummy(target,"어퍼컷");
          p.target=target;p.uppercutTarget=null;p.uppercutPending=false;p.attackMove=false;
          p.facing=Math.atan2(target.y-p.y,target.x-p.x);
          log(`<b>어퍼컷(D) 적중</b> · 사거리 1.35m · 쿨다운 5.0초`);
        }
      }
      return;
    }
    if(recovery>0){p=state.player;p.attackCooldown=Math.max(0,p.attackCooldown-dt);return}
    return originalUpdateForUppercut(dt);
  };

  updateExtraHud();
})();
