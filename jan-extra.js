// Tactical / weapon skill layer + action recovery.
// D: Uppercut, F: Blink.
// Skill recovery blocks normal movement, while E can always be inserted into
// another skill's recovery. W keeps its pending hitbox attached to Yan, so WE
// places the W cone at E's landing point when W finally resolves.
(function(){
  const skillsHud=document.getElementById("skillsHud");
  const blinkHud=document.createElement("div");
  const uppercutHud=document.createElement("div");

  blinkHud.id="skillF";
  uppercutHud.id="skillD";
  blinkHud.className="skill-box";
  uppercutHud.className="skill-box";

  if(skillsHud){
    skillsHud.appendChild(uppercutHud);
    skillsHud.appendChild(blinkHud);
  }

  const PIXELS_PER_METER=cfg.E_DISTANCE/3.0;

  // Provisional recovery values for the trainer. These are movement/action
  // lock durations, not a claim about exact live-game animation frames.
  const POST_DELAY={Q:0.18,W:0.22,E:0.18,R:0.18};

  state.player.skillRecovery=state.player.skillRecovery||0;
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

  function canUseDuringRecovery(key){
    // E is the movement skill that may be inserted immediately into another
    // skill's recovery. This is what allows EQE with no movement-lock delay.
    return key==="E" || state.player.skillRecovery<=0;
  }

  const originalUpdatePlayer=window.updatePlayer;
  window.updatePlayer=function(dt){
    const p=state.player;
    p.skillRecovery=Math.max(0,p.skillRecovery-dt);

    if(p.uppercutPending && p.uppercutTarget){
      if(p.skillRecovery>0)return;

      const target=p.uppercutTarget;
      const maxRange=jan.weapon.range*PIXELS_PER_METER;

      if(distance(p,target)>maxRange+target.r){
        const dx=target.x-p.x,dy=target.y-p.y;
        const len=Math.hypot(dx,dy)||1;
        p.facing=Math.atan2(dy,dx);
        const step=Math.min(len,p.moveSpeed*dt);
        p.x+=dx/len*step;
        p.y+=dy/len*step;
        return;
      }

      if(jan.canUseUppercut()){
        const result=jan.castUppercut();
        if(result.ok){
          hitDummy(target,"어퍼컷");
          p.target=target;
          p.uppercutTarget=null;
          p.uppercutPending=false;
          p.attackMove=false;
          p.facing=Math.atan2(target.y-p.y,target.x-p.x);
          p.skillRecovery=POST_DELAY.Q;
          log(`<b>어퍼컷(D) 적중</b> · 사거리 1.35m · 쿨다운 5.0초`);
        }
      }
      return;
    }

    if(p.skillRecovery>0){
      p.attackCooldown=Math.max(0,p.attackCooldown-dt);
      return;
    }

    return originalUpdatePlayer(dt);
  };

  const originalIssueMove=window.issueMove;
  window.issueMove=function(point){
    if(state.player.skillRecovery>0){modeEl.textContent="스킬 후딜 중";return;}
    state.player.uppercutTarget=null;
    state.player.uppercutPending=false;
    return originalIssueMove(point);
  };

  const originalIssueAttack=window.issueAttack;
  window.issueAttack=function(point){
    if(state.player.skillRecovery>0){modeEl.textContent="스킬 후딜 중";return;}
    return originalIssueAttack(point);
  };

  const originalCastSkill=window.castSkill;
  window.castSkill=function(key){
    if(!canUseDuringRecovery(key)){
      log(`${key} 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);
      return;
    }

    const beforeQ=jan.skills.Q.cooldown;
    const beforeW=jan.skills.W.cooldown;
    const beforeE=jan.skills.E.cooldown;
    const beforeR=jan.skills.R.cooldown;
    const beforeQState=jan.skills.Q.state;
    const beforeWPending=jan.skills.W.pending;

    originalCastSkill(key);

    let succeeded=false;
    if(key==="Q") succeeded=beforeQState!==jan.skills.Q.state || beforeQ!==jan.skills.Q.cooldown;
    if(key==="W") succeeded=beforeWPending!==jan.skills.W.pending || beforeW!==jan.skills.W.cooldown;
    if(key==="E") succeeded=beforeE!==jan.skills.E.cooldown || jan.skills.E.cooldown>0;
    if(key==="R") succeeded=true;

    if(succeeded)state.player.skillRecovery=POST_DELAY[key];
  };

  function blink(){
    if(state.player.skillRecovery>0){
      // E is not used here; Blink remains a tactical skill and respects recovery.
      log(`블링크 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);
      return;
    }

    const result=jan.castBlink();
    const p=state.player;
    const dx=state.mouse.x-p.x,dy=state.mouse.y-p.y;
    const len=Math.hypot(dx,dy);

    if(len>0){
      const distanceToBlink=Math.min(result.distance*PIXELS_PER_METER,len);
      const nx=dx/len,ny=dy/len;
      const oldX=p.x,oldY=p.y;

      p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x+nx*distanceToBlink));
      p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y+ny*distanceToBlink));
      p.destination=null;p.target=null;p.attackMove=false;
      p.uppercutTarget=null;p.uppercutPending=false;
      p.windup=0;p.windupTarget=null;p.attackCooldown=0;
      p.facing=Math.atan2(ny,nx);

      state.particles.push({type:"blink",x:oldX,y:oldY,tx:p.x,ty:p.y,life:.22,max:.22});
    }

    state.player.skillRecovery=POST_DELAY.E;
    log(`<b>블링크(F)</b> · 3.0m 순간이동 · 2.5초 이동속도 +15%`);
    updateExtraHud();
  }

  function uppercut(){
    if(state.player.skillRecovery>0){log(`어퍼컷 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);return;}
    if(!jan.canUseUppercut()){log(`어퍼컷 사용 불가 · 쿨다운 ${jan.weapon.cooldown.toFixed(1)}s`);return;}

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

  window.addEventListener("keydown",function(e){
    if(e.repeat)return;
    const key=e.key.toLowerCase();
    if(key==="d"){e.preventDefault();uppercut()}
    else if(key==="f"){e.preventDefault();blink()}
  });

  setInterval(updateExtraHud,50);
  updateExtraHud();
})();
