// Tactical / weapon skill layer.
// D = Uppercut, F = Blink.
(function(){
  const skillsHud=document.getElementById("skillsHud");
  const uppercutHud=document.createElement("div");
  const blinkHud=document.createElement("div");
  uppercutHud.id="skillD";
  blinkHud.id="skillF";
  uppercutHud.className="skill-box";
  blinkHud.className="skill-box";
  if(skillsHud){skillsHud.appendChild(uppercutHud);skillsHud.appendChild(blinkHud)}

  const PIXELS_PER_METER=cfg.E_DISTANCE/3.0;
  function formatTime(t){return t>0?t.toFixed(1):"READY"}

  function updateExtraHud(){
    state.player.moveSpeed=245*jan.getMoveSpeedMultiplier();

    uppercutHud.innerHTML=`<div class="skill-icon">D</div><div class="skill-key">D</div><div class="skill-name">어퍼컷</div><div class="skill-time">${formatTime(jan.weapon.cooldown)}</div>`;
    uppercutHud.className="skill-box"+(jan.weapon.cooldown>0?" cooldown":"");

    blinkHud.innerHTML=`<div class="skill-icon">F</div><div class="skill-key">F</div>${jan.tactical.enhancedTimer>0?'<div class="skill-tag">MODULE</div>':''}<div class="skill-name">블링크</div><div class="skill-time">READY</div>`;
    blinkHud.className="skill-box ready-enhanced";
  }

  function blink(){
    const result=jan.castBlink(),p=state.player,point=state.mouse;
    const dx=point.x-p.x,dy=point.y-p.y,len=Math.hypot(dx,dy);
    if(len>0){
      const maxDistance=result.distance*PIXELS_PER_METER,d=Math.min(maxDistance,len),nx=dx/len,ny=dy/len;
      const oldX=p.x,oldY=p.y;
      p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x+nx*d));
      p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y+ny*d));
      p.destination=null;p.target=null;p.attackMove=false;p.windup=0;p.windupTarget=null;p.attackCooldown=0;p.facing=Math.atan2(ny,nx);
      state.particles.push({type:"blink",x:oldX,y:oldY,tx:p.x,ty:p.y,life:.22,max:.22});
    }
    log(`<b>블링크</b> · 3.0m 순간이동 · 2.5초 이동속도 +15%`);
    updateExtraHud();
  }

  function uppercut(){
    if(!jan.canUseUppercut()){log(`어퍼컷 사용 불가 · 쿨다운 ${jan.weapon.cooldown.toFixed(1)}s`);return}
    const target=nearestDummyToPoint(state.mouse),maxRange=jan.weapon.range*PIXELS_PER_METER;
    if(!target||distance(state.player,target)>maxRange+target.r){log(`어퍼컷 사용 불가 · 사거리 ${jan.weapon.range.toFixed(2)}m`);return}
    const result=jan.castUppercut();if(!result.ok)return;
    hitDummy(target,"어퍼컷");state.player.target=target;faceAt(target);
    log(`<b>어퍼컷</b> 적중 · 사거리 ${jan.weapon.range.toFixed(2)}m · 쿨다운 5.0초`);updateExtraHud();
  }

  window.addEventListener("keydown",function(e){if(e.repeat)return;const key=e.key.toLowerCase();if(key==="d"){e.preventDefault();uppercut()}else if(key==="f"){e.preventDefault();blink()}});
  setInterval(updateExtraHud,50);updateExtraHud();
})();
