// Tactical / weapon skill layer + action recovery.
// D: Uppercut, F: Blink.
// Q/W/E/R create a short post-cast recovery during which movement is locked.
// E can always be cast during another skill's recovery, matching Yan's movement-skill flow.
(function(){
  const skillsHud=document.getElementById("skillsHud");
  const blinkHud=document.createElement("div");
  const uppercutHud=document.createElement("div");

  blinkHud.id="skillF";
  uppercutHud.id="skillD";
  blinkHud.className="skill-box";
  uppercutHud.className="skill-box";

  if(skillsHud){
    // Keep Q/W/E/R order, then add D/F at the right side.
    skillsHud.appendChild(uppercutHud);
    skillsHud.appendChild(blinkHud);
  }

  const PIXELS_PER_METER=cfg.E_DISTANCE/3.0;

  // These are intentionally small provisional values until exact animation
  // recovery frames are supplied. They are centralized for easy tuning.
  const POST_DELAY={
    Q:0.18,
    W:0.22,
    E:0.18,
    R:0.18
  };

  state.player.skillRecovery=state.player.skillRecovery||0;
  state.player.uppercutTarget=null;
  state.player.uppercutPending=false;

  function formatTime(t){
    return t>0?t.toFixed(1):"READY";
  }

  function updateExtraHud(){
    state.player.moveSpeed=245*jan.getMoveSpeedMultiplier();

    uppercutHud.innerHTML=`
      <div class="skill-key">D</div>
      <div class="skill-name">어퍼컷</div>
      <div class="skill-time">${formatTime(jan.weapon.cooldown)}</div>`;

    blinkHud.innerHTML=`
      <div class="skill-key">F</div>
      ${jan.tactical.enhancedTimer>0?'<div class="skill-tag">MODULE</div>':''}
      <div class="skill-name">블링크</div>
      <div class="skill-time">READY</div>`;

    uppercutHud.style.display="block";
    uppercutHud.style.visibility="visible";
    uppercutHud.style.opacity=jan.weapon.cooldown>0?".55":"1";

    blinkHud.style.display="block";
    blinkHud.style.visibility="visible";
    blinkHud.style.opacity="1";
  }

  function canUseAfterRecovery(key){
    // E is the only Q/W/E/R skill allowed to ignore an existing post-cast lock.
    return key==="E" || state.player.skillRecovery<=0;
  }

  // Wrap the main movement function without rewriting the stable movement code.
  // This preserves the previously working RMB movement implementation.
  const originalUpdatePlayer=window.updatePlayer;
  window.updatePlayer=function(dt){
    const p=state.player;

    p.skillRecovery=Math.max(0,p.skillRecovery-dt);

    // D uppercut approaches its selected target exactly like an attack order.
    // It does not require the target to already be inside range.
    if(p.uppercutPending && p.uppercutTarget){
      if(p.skillRecovery>0)return;

      const target=p.uppercutTarget;
      const maxRange=jan.weapon.range*PIXELS_PER_METER;

      if(distance(p,target)>maxRange+target.r){
        const dx=target.x-p.x;
        const dy=target.y-p.y;
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
          log(`<b>어퍼컷(D) 적중</b> · 사거리 1.35m · 쿨다운 5.0초`);
        }
      }
      return;
    }

    // During post-cast recovery Yan cannot move or perform the normal basic
    // attack/movement loop. E remains usable because castSkill bypasses this lock.
    if(p.skillRecovery>0){
      p.attackCooldown=Math.max(0,p.attackCooldown-dt);
      return;
    }

    return originalUpdatePlayer(dt);
  };

  // RMB remains a pure movement command, but cannot interrupt a skill recovery.
  const originalIssueMove=window.issueMove;
  window.issueMove=function(point){
    if(state.player.skillRecovery>0){
      modeEl.textContent="스킬 후딜 중";
      return;
    }
    state.player.uppercutTarget=null;
    state.player.uppercutPending=false;
    return originalIssueMove(point);
  };

  // A-click also respects skill recovery.
  const originalIssueAttack=window.issueAttack;
  window.issueAttack=function(point){
    if(state.player.skillRecovery>0){
      modeEl.textContent="스킬 후딜 중";
      return;
    }
    return originalIssueAttack(point);
  };

  // Q/W/E/R are given an explicit post-cast recovery.
  // E is intentionally permitted even while another recovery timer is active.
  const originalCastSkill=window.castSkill;
  window.castSkill=function(key){
    if(!canUseAfterRecovery(key)){
      log(`${key} 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);
      return;
    }

    const beforeCooldown=jan.skills[key] ? jan.skills[key].cooldown : 0;
    originalCastSkill(key);

    // Only start recovery if the attempted cast actually happened.
    if(["Q","W","E","R"].includes(key)){
      const afterCooldown=jan.skills[key] ? jan.skills[key].cooldown : 0;
      const q2Started=key==="Q" && jan.skills.Q.state==="q2";
      const wPending=key==="W" && jan.skills.W.pending>0;
      const castSucceeded=key==="E" || key==="R"
        ? afterCooldown!==beforeCooldown || key==="R"
        : (q2Started || afterCooldown!==beforeCooldown || wPending);

      if(castSucceeded){
        state.player.skillRecovery=POST_DELAY[key];
      }
    }
  };

  function blink(){
    if(state.player.skillRecovery>0){
      log(`블링크 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);
      return;
    }

    const result=jan.castBlink();
    const p=state.player;
    const dx=state.mouse.x-p.x;
    const dy=state.mouse.y-p.y;
    const len=Math.hypot(dx,dy);

    if(len>0){
      const distanceToBlink=Math.min(result.distance*PIXELS_PER_METER,len);
      const nx=dx/len;
      const ny=dy/len;
      const oldX=p.x;
      const oldY=p.y;

      p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x+nx*distanceToBlink));
      p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y+ny*distanceToBlink));
      p.destination=null;
      p.target=null;
      p.attackMove=false;
      p.uppercutTarget=null;
      p.uppercutPending=false;
      p.windup=0;
      p.windupTarget=null;
      p.attackCooldown=0;
      p.facing=Math.atan2(ny,nx);

      state.particles.push({type:"blink",x:oldX,y:oldY,tx:p.x,ty:p.y,life:.22,max:.22});
    }

    log(`<b>블링크(F)</b> · 최대 ${result.distance.toFixed(1)}m 순간이동 · 2.5초 이동속도 +15%`);
    updateExtraHud();
  }

  function uppercut(){
    if(state.player.skillRecovery>0){
      log(`어퍼컷 사용 불가 · 스킬 후딜 ${state.player.skillRecovery.toFixed(2)}s`);
      return;
    }

    if(!jan.canUseUppercut()){
      log(`어퍼컷 사용 불가 · 쿨다운 ${jan.weapon.cooldown.toFixed(1)}s`);
      return;
    }

    // The mouse location selects the closest dummy; it does not require the
    // dummy itself to be under the cursor and does not require it to be in range.
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

    // If already in range, the next update frame performs the actual punch.
    if(distance(state.player,target)<=jan.weapon.range*PIXELS_PER_METER+target.r){
      // Execute immediately to match a normal in-range attack command.
      state.player.uppercutPending=true;
    }
  }

  window.addEventListener("keydown",function(e){
    if(e.repeat)return;
    const key=e.key.toLowerCase();
    if(key==="d"){
      e.preventDefault();
      uppercut();
    }else if(key==="f"){
      e.preventDefault();
      blink();
    }
  });

  setInterval(updateExtraHud,50);
  updateExtraHud();
})();
