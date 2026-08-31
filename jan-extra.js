// Tactical skill / weapon skill layer.
// D: Blink to the mouse position (3m maximum).
// F: Uppercut the nearest dummy under/near the cursor if it is within 1.35m.
(function(){
  const tacticalHud = document.getElementById("skillD");
  const weaponHud = document.getElementById("skillF");
  const PIXELS_PER_METER = cfg.E_DISTANCE / 3.0;

  function formatTime(t){
    return t > 0 ? t.toFixed(1) : "READY";
  }

  function updateExtraHud(){
    const multiplier=jan.getMoveSpeedMultiplier();
    state.player.moveSpeed=245*multiplier;

    if(tacticalHud){
      const t=jan.tactical;
      tacticalHud.innerHTML=`
        <div class="skill-key">D</div>
        ${t.enhancedTimer>0?'<div class="skill-tag">MODULE</div>':''}
        <div class="skill-name">BLINK</div>
        <div class="skill-time">READY</div>`;
      tacticalHud.style.display="block";
      tacticalHud.style.visibility="visible";
      tacticalHud.style.opacity="1";
    }

    if(weaponHud){
      const w=jan.weapon;
      weaponHud.innerHTML=`
        <div class="skill-key">F</div>
        <div class="skill-name">어퍼컷</div>
        <div class="skill-time">${formatTime(w.cooldown)}</div>`;
      weaponHud.style.display="block";
      weaponHud.style.visibility="visible";
      weaponHud.style.opacity=w.cooldown>0?"0.55":"1";
    }
  }

  function blink(){
    const result=jan.castBlink();
    const p=state.player;
    const point=state.mouse;
    const dx=point.x-p.x;
    const dy=point.y-p.y;
    const len=Math.hypot(dx,dy);

    if(len>0){
      // 3m is represented by the same 125px used by Jan's E 3m dash.
      const maxDistance=result.distance*PIXELS_PER_METER;
      const distance=Math.min(maxDistance,len);
      const nx=dx/len;
      const ny=dy/len;
      const oldX=p.x;
      const oldY=p.y;

      p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x+nx*distance));
      p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y+ny*distance));
      p.destination=null;
      p.target=null;
      p.attackMove=false;
      p.windup=0;
      p.windupTarget=null;
      p.attackCooldown=0;
      p.facing=Math.atan2(ny,nx);

      state.particles.push({
        type:"blink",
        x:oldX,y:oldY,
        tx:p.x,ty:p.y,
        life:.22,max:.22
      });
    }

    log(`<b>블링크</b> · 최대 ${result.distance.toFixed(1)}m 순간이동 · 2.5초 이동속도 +15%`);
    updateExtraHud();
  }

  function uppercut(){
    if(!jan.canUseUppercut()){
      log(`어퍼컷 사용 불가 · 쿨다운 ${jan.weapon.cooldown.toFixed(1)}s`);
      return;
    }

    const target=nearestDummyToPoint(state.mouse);
    const maxRange=jan.weapon.range*PIXELS_PER_METER;
    if(!target || distance(state.player,target)>maxRange+target.r){
      log(`어퍼컷 사용 불가 · 사거리 ${jan.weapon.range.toFixed(2)}m`);
      return;
    }

    const result=jan.castUppercut();
    if(!result.ok)return;

    // Damage is intentionally omitted. The trainer only needs the hit event
    // to generate one passive stack.
    hitDummy(target,"어퍼컷");
    state.player.target=target;
    faceAt(target);
    log(`<b>어퍼컷</b> 적중 · 사거리 ${jan.weapon.range.toFixed(2)}m · 쿨다운 5.0초`);
    updateExtraHud();
  }

  window.addEventListener("keydown",function(e){
    if(e.repeat)return;
    const key=e.key.toLowerCase();
    if(key==="d"){
      e.preventDefault();
      blink();
    }else if(key==="f"){
      e.preventDefault();
      uppercut();
    }
  });

  setInterval(updateExtraHud,50);
  updateExtraHud();
})();
