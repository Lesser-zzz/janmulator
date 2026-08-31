const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const jan=new JanModel();

const state={player:{x:760,y:420,r:17,moveSpeed:245,destination:null,target:null,attackMove:false,attackCooldown:0,windup:0,windupTarget:null,facing:Math.PI,flash:0},dummies:[{id:1,x:485,y:285,r:31,hit:0,shake:0},{id:2,x:350,y:470,r:31,hit:0,shake:0},{id:3,x:885,y:250,r:31,hit:0,shake:0}],mouse:{x:760,y:420},attackModifier:false,logs:[],particles:[],floaters:[],telegraph:[],rRing:null};
const cfg={attackRange:70,attackInterval:.285,attackWindup:.13,Q_LENGTH:145,Q_WIDTH:54,W_RADIUS:150,W_HALF_ANGLE:Math.PI/4,E_DISTANCE:125,R_INNER_RADIUS:125,R_OUTER_RADIUS:165};
const stackCountEl=document.getElementById("stackCount"),stackRowEl=document.getElementById("stackRow"),enhancedEl=document.getElementById("enhanced"),logEl=document.getElementById("log"),modeEl=document.getElementById("mode");
function log(text){const t=new Date().toLocaleTimeString("ko-KR",{hour12:false});state.logs.push(`${t} · ${text}`);if(state.logs.length>14)state.logs.shift();logEl.innerHTML=state.logs.map(x=>`<div>${x}</div>`).join("")}
function pointFromEvent(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function nearestDummyToPoint(point){let best=null,bd=Infinity;for(const d of state.dummies){const dd=distance(point,d);if(dd<bd){best=d;bd=dd}}return best}
function dummyAt(point){for(const d of state.dummies)if(distance(point,d)<=d.r+9)return d;return null}
function nearestDummyInRange(){let best=null,bd=Infinity;for(const d of state.dummies){const dd=distance(state.player,d);if(dd<=cfg.attackRange+d.r&&dd<bd){best=d;bd=dd}}return best}
function attackRangeEnough(d){return d&&distance(state.player,d)<=cfg.attackRange+d.r}
function faceAt(point){state.player.facing=Math.atan2(point.y-state.player.y,point.x-state.player.x)}
function hitDummy(d,source){if(!d)return;const change=jan.addStack(1);d.hit=.15;d.shake=.15;state.player.flash=.10;state.particles.push({x:d.x,y:d.y,life:.22,max:.22,type:"hit"});state.floaters.push({x:d.x,y:d.y-42,text:"+1",life:.6,max:.6});log(`<b>${source}</b> 적중 · 패시브 ${change.before} → ${change.after}`)}
function beginBasicAttack(target){const p=state.player;if(!target||p.attackCooldown>0||p.windup>0)return false;if(!attackRangeEnough(target))return false;p.target=target;p.windup=cfg.attackWindup;p.windupTarget=target;p.attackCooldown=cfg.attackInterval;faceAt(target);return true}
function finishBasicAttack(){const d=state.player.windupTarget;state.player.windupTarget=null;if(d&&attackRangeEnough(d))hitDummy(d,"평타")}
function issueMove(point){state.player.destination={x:point.x,y:point.y};state.player.target=null;state.player.attackMove=false;state.player.windup=0;state.player.windupTarget=null;modeEl.textContent="이동 명령"}
function issueAttack(point){const target=nearestDummyToPoint(point);if(!target)return;state.player.destination=null;state.player.target=target;state.player.attackMove=true;state.player.windup=0;state.player.windupTarget=null;modeEl.textContent=`공격 대상 DUMMY ${target.id}`;if(attackRangeEnough(target)&&state.player.attackCooldown<=0)beginBasicAttack(target)}
function updatePlayer(dt){const p=state.player;p.attackCooldown=Math.max(0,p.attackCooldown-dt);p.flash=Math.max(0,p.flash-dt);if(p.windup>0){p.windup-=dt;if(p.windup<=0)finishBasicAttack();return}if(p.attackMove&&p.target){const target=p.target;if(!attackRangeEnough(target)){const dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy)||1;p.facing=Math.atan2(dy,dx);const step=Math.min(len,p.moveSpeed*dt);p.x+=dx/len*step;p.y+=dy/len*step}else if(p.attackCooldown<=0)beginBasicAttack(target);return}if(p.destination){const dx=p.destination.x-p.x,dy=p.destination.y-p.y,len=Math.hypot(dx,dy)||0;if(len<=2){p.x=p.destination.x;p.y=p.destination.y;p.destination=null;modeEl.textContent="우클릭으로 이동";return}p.facing=Math.atan2(dy,dx);const step=Math.min(len,p.moveSpeed*dt);p.x+=dx/len*step;p.y+=dy/len*step;p.x=Math.max(p.r,Math.min(canvas.width-p.r,p.x));p.y=Math.max(p.r,Math.min(canvas.height-p.r,p.y))}}
function logCooldownChange(result){if(!result)return;const parts=[];for(const k of ["Q","W","E"]){const before=result.before[k]||0,after=result.after[k]||0;if(before>0)parts.push(`${k} ${before.toFixed(2)}→${after.toFixed(2)}`)}if(parts.length)log(`강화 쿨감 · ${parts.join(" / ")}`)}
function qHit(stage,enhancedCast){
  const a=state.player.facing,cos=Math.cos(a),sin=Math.sin(a);
  let isHit = false;
  for(const d of state.dummies){
    const dx=d.x-state.player.x,dy=d.y-state.player.y,forward=dx*cos+dy*sin,side=-dx*sin+dy*cos;
    if(forward>=0&&forward<=cfg.Q_LENGTH&&Math.abs(side)<=cfg.Q_WIDTH/2+d.r){
      hitDummy(d,`Q${stage}${enhancedCast?"(강화)":""}`);
      isHit = true;
    }
  }
  return isHit;
}
function wHit(enhancedCast){const a=state.player.facing;for(const d of state.dummies){const dx=d.x-state.player.x,dy=d.y-state.player.y,r=Math.hypot(dx,dy);if(r>cfg.W_RADIUS+d.r)continue;const delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a),Math.cos(Math.atan2(dy,dx)-a)));if(delta<=cfg.W_HALF_ANGLE)hitDummy(d,`W${enhancedCast?"(강화)":""}`)}}

function castQ(){
  faceAt(state.mouse);
  const result=jan.castQ();
  
  if(!result.ok){
    log(`Q 사용 불가 · 쿨다운 ${jan.skills.Q.cooldown.toFixed(1)}s`);
    return;
  }
  
  // FIX: 계속 화면에 남는 범위를 지우고, 대신 찰나의 순간 이펙트로 처리
  state.particles.push({
    type: "q_slash",
    x: state.player.x,
    y: state.player.y,
    a: state.player.facing,
    life: 0.15,
    max: 0.15
  });
  
  const hitSuccess = qHit(result.stage,result.enhanced);
  
  if(result.stage===1){
    log(`<b>${result.enhanced?"강화 ":""}Q1</b> · Q2 가능 ${jan.skills.Q.q2Window.toFixed(1)}초`);
    if(result.enhanced&&result.cooldownResult){
      log("<b>강화 Q</b> · Q1 사용 즉시 Q/W/E 전체 유효 쿨다운의 30% 차감");
      logCooldownChange(result.cooldownResult);
    }
  } else {
    log(`<b>${result.enhanced?"강화 ":""}Q2</b> · Q 쿨다운 시작`);
    if(result.enhanced && hitSuccess){
      jan.skills.E.cooldown = 0;
      log("<b>강화 Q2 적중</b> · E 쿨다운 완전 초기화!");
    }
  }
}

function castW(){faceAt(state.mouse);const result=jan.castW();if(!result.ok){log(`W 사용 불가 · 쿨다운/시전 대기`);return}state.telegraph.push({type:"W",x:state.player.x,y:state.player.y,a:state.player.facing,life:jan.skills.W.castDelay,max:jan.skills.W.castDelay,enhanced:result.enhanced});log(`<b>${result.enhanced?"강화 ":""}W</b> · ${jan.skills.W.castDelay.toFixed(2)}초 후 판정`);if(result.enhanced){log("<b>강화 W</b> · W 사용 즉시 Q/W/E 전체 유효 쿨다운의 30% 차감");logCooldownChange(result.cooldownResult)}}
function castE(){faceAt(state.mouse);const result=jan.castE();if(!result.ok){log(`E 사용 불가 · 쿨다운 ${jan.skills.E.cooldown.toFixed(1)}s`);return}state.player.attackCooldown=0;state.player.windup=0;state.player.windupTarget=null;const oldX=state.player.x,oldY=state.player.y,a=state.player.facing;state.player.x=Math.max(state.player.r,Math.min(canvas.width-state.player.r,oldX+Math.cos(a)*cfg.E_DISTANCE));state.player.y=Math.max(state.player.r,Math.min(canvas.height-state.player.r,oldY+Math.sin(a)*cfg.E_DISTANCE));state.particles.push({type:"dash",x:oldX,y:oldY,tx:state.player.x,ty:state.player.y,life:.25,max:.25});if(result.enhanced){log("<b>강화 E</b> · Q/W/E 전체 유효 쿨다운의 30% 차감");logCooldownChange(result.cooldownResult);if(result.eExtra)log(`<b>E 추가 쿨감</b> · E 전체 유효 쿨다운의 40% 차감 · ${result.eExtra.before.toFixed(2)}→${result.eExtra.after.toFixed(2)}`)}else log("<b>E</b> · 고정거리 돌진")}
function castR(){const result=jan.castR();state.rRing={x:state.player.x,y:state.player.y,life:.45,max:.45};log(`<b>R</b> · 패시브 +5 · ${result.stacks.before} → ${result.stacks.after}`)}
function castSkill(key){if(key==="Q")castQ();else if(key==="W")castW();else if(key==="E")castE();else if(key==="R")castR()}
function updateSkills(dt){const qr=jan.update(dt);if(qr.qWindowExpired)log("<b>Q2 시간 만료</b> · Q 쿨다운 시작");for(const t of state.telegraph){t.life-=dt;if(t.life<=0&&t.type==="W"){const result=jan.resolveW();wHit(t.enhanced);if(!result.enhanced)log("<b>W 판정 완료</b>")}}state.telegraph=state.telegraph.filter(t=>t.life>0);if(state.rRing){state.rRing.life-=dt;if(state.rRing.life<=0)state.rRing=null}}
function updateDummyEffects(dt){for(const d of state.dummies){d.hit=Math.max(0,d.hit-dt);d.shake=Math.max(0,d.shake-dt)}}
function drawBackground(){ctx.fillStyle="#151b22";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#202731";ctx.lineWidth=1;for(let x=0;x<=canvas.width;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}for(let y=0;y<=canvas.height;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}ctx.strokeStyle="#28303b";ctx.beginPath();ctx.arc(canvas.width/2,canvas.height/2,180,0,Math.PI*2);ctx.stroke()}
function drawMoveMarker(){if(!state.player.destination)return;const p=state.player.destination;ctx.save();ctx.strokeStyle="#929baa";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-14,p.y);ctx.lineTo(p.x+14,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y-14);ctx.lineTo(p.x,p.y+14);ctx.stroke();ctx.restore()}
function drawTarget(){const d=state.player.target;if(!d)return;ctx.save();ctx.strokeStyle="#edf0f4";ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(d.x,d.y,d.r+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
function drawDummies(){for(const d of state.dummies){const jitter=d.shake>0?Math.sin(performance.now()/18+d.id)*3:0;ctx.save();ctx.translate(d.x+jitter,d.y);ctx.strokeStyle="#343d49";ctx.beginPath();ctx.arc(0,0,50,0,Math.PI*2);ctx.stroke();ctx.fillStyle=d.hit>0?"#f1f3f6":"#687383";ctx.fillRect(-24,-34,48,68);ctx.fillStyle="#38414d";ctx.fillRect(-14,-50,28,14);ctx.fillStyle="#11161c";ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.fillText("DUMMY "+d.id,0,60);ctx.restore()}}
function drawPlayer(){const p=state.player;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.facing);ctx.strokeStyle="rgba(240,243,247,.08)";ctx.beginPath();ctx.arc(0,0,cfg.attackRange,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#e4e8ee";ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#141920";ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(34,-8);ctx.lineTo(34,8);ctx.closePath();ctx.fill();if(p.windup>0){ctx.strokeStyle="#f2f4f7";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(21,0);ctx.lineTo(78,0);ctx.stroke()}ctx.restore()}

// FIX: 계속 남아있던 Q 사각형 그리기 제거됨
function drawTelegraphs(){
  for(const t of state.telegraph){ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.a);ctx.globalAlpha=.25;ctx.fillStyle="#e3e8ee";ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,cfg.W_RADIUS,-cfg.W_HALF_ANGLE,cfg.W_HALF_ANGLE);ctx.closePath();ctx.fill();ctx.restore()}
  if(state.rRing){const a=state.rRing.life/state.rRing.max;ctx.save();ctx.globalAlpha=a*.5;ctx.strokeStyle="#eef1f5";ctx.lineWidth=4;ctx.beginPath();ctx.arc(state.rRing.x,state.rRing.y,cfg.R_INNER_RADIUS,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(state.rRing.x,state.rRing.y,cfg.R_OUTER_RADIUS,0,Math.PI*2);ctx.stroke();ctx.restore()}
}

function drawEffects(dt){
  for(const p of state.particles){
    p.life-=dt;
    const alpha=Math.max(0,p.life/p.max);
    ctx.save();
    ctx.globalAlpha=alpha;
    if(p.type==="hit"){
      ctx.strokeStyle="#eef1f5";ctx.beginPath();ctx.arc(p.x,p.y,(1-alpha)*36+6,0,Math.PI*2);ctx.stroke()
    }else if(p.type==="dash"){
      ctx.strokeStyle="#e7ebf0";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.tx,p.ty);ctx.stroke()
    }
    // FIX: 지웠던 Q 사각형을 타격 이펙트처럼 짧게 터지도록 추가
    else if(p.type==="q_slash"){
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle="#e4e8ee";
      ctx.globalAlpha=alpha*0.15;
      ctx.fillRect(0, -cfg.Q_WIDTH/2, cfg.Q_LENGTH, cfg.Q_WIDTH);
      ctx.strokeStyle="#e4e8ee";
      ctx.globalAlpha=alpha*0.4;
      ctx.strokeRect(0, -cfg.Q_WIDTH/2, cfg.Q_LENGTH, cfg.Q_WIDTH);
    }
    ctx.restore();
  }
  state.particles=state.particles.filter(p=>p.life>0);
  for(const f of state.floaters){f.life-=dt;const alpha=Math.max(0,f.life/f.max);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle="#eef1f5";ctx.font="bold 15px system-ui";ctx.textAlign="center";ctx.fillText(f.text,f.x,f.y-(1-alpha)*24);ctx.restore()}state.floaters=state.floaters.filter(f=>f.life>0)
}
function updateUI(){stackCountEl.textContent=jan.stacks;enhancedEl.textContent=jan.enhancedReady?"NEXT Q / W / E : ENHANCED":"NEXT Q / W / E : NORMAL";enhancedEl.classList.toggle("ready",jan.enhancedReady);stackRowEl.innerHTML="";for(let i=0;i<jan.maxStacks;i++){const el=document.createElement("div");el.className="stack-cell"+(i<jan.stacks?" filled":"");stackRowEl.appendChild(el)}for(const k of ["Q","W","E","R"]){const skill=jan.skills[k],el=document.getElementById("skill"+k);const canEnhance=k!=="R"&&jan.enhancedReady;el.className="skill-box"+((skill.cooldown>0||skill.pending>0)?" cooldown":"")+((canEnhance||skill.state==="q2")?" ready-enhanced":"");let name=k;if(k==="Q"&&skill.state==="q2")name="Q2";else if(canEnhance)name="강화 "+k;if(k==="W"&&skill.pending>0)name="W 대기";let time="READY";if(skill.pending>0)time=skill.pending.toFixed(1);else if(k==="Q"&&skill.state==="q2")time=skill.q2Timer.toFixed(1);else if(skill.cooldown>0)time=skill.cooldown.toFixed(1);el.innerHTML=`<div class="skill-icon">${k==="Q"&&skill.state==="q2"?"Q2":k}</div><div class="skill-key">${k}</div>${canEnhance&&!((k==="Q")&&skill.state==="q2")?'<div class="skill-tag">ENHANCED</div>':""}<div class="skill-name">${name}</div><div class="skill-time">${time}</div>`}}
function reset(){jan.reset();state.player.x=760;state.player.y=420;state.player.destination=null;state.player.target=null;state.player.attackMove=false;state.player.attackCooldown=0;state.player.windup=0;state.player.windupTarget=null;state.player.facing=Math.PI;state.logs=[];state.particles=[];state.floaters=[];state.telegraph=[];state.rRing=null;modeEl.textContent="우클릭으로 이동";log("훈련장 초기화")}
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(k==="a"){state.attackModifier=true;modeEl.textContent="A 모드 · 클릭하여 가장 가까운 더미 공격";e.preventDefault();return}if(k==="q"||k==="w"||k==="e"||k==="r"){castSkill(k.toUpperCase());e.preventDefault()}});window.addEventListener("keyup",e=>{if(e.key.toLowerCase()==="a"){state.attackModifier=false;modeEl.textContent="우클릭으로 이동"}});canvas.addEventListener("mousedown",e=>{if(e.button===2){e.preventDefault();issueMove(pointFromEvent(e));return}if(e.button!==0)return;const point=pointFromEvent(e);if(state.attackModifier){issueAttack(point);return}const target=dummyAt(point);if(target&&attackRangeEnough(target))beginBasicAttack(target)});canvas.addEventListener("contextmenu",e=>e.preventDefault());canvas.addEventListener("mousemove",e=>{state.mouse=pointFromEvent(e)});
for(const k of ["Q","W","E","R"])document.getElementById("skill"+k).addEventListener("click",()=>castSkill(k));
document.getElementById("reset").addEventListener("click",reset);log("훈련장 입장");log("우클릭 = 이동 / A+좌클릭 = 커서 기준 가장 가까운 더미 공격");let last=performance.now();function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;updateSkills(dt);updatePlayer(dt);updateDummyEffects(dt);drawBackground();drawMoveMarker();drawTarget();drawTelegraphs();drawDummies();drawPlayer();drawEffects(dt);updateUI();requestAnimationFrame(frame)}requestAnimationFrame(frame);
