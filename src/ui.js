/* ================= 화면 ================= */
try { if (navigator.standalone) document.documentElement.classList.add('ios-app'); if (/iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) document.documentElement.classList.add('ipad'); } catch(_){}
const app = document.getElementById('app');
const fmt = n => '$' + Number(n||0).toLocaleString('en-US');   // 칩 금액은 달러로 표시
const esc = t => String(t).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view = 'lobby', botCount = 3;
let hostSeats = Math.max(2, Math.min(9, parseInt(store('holdem.seats')) || 6));
const LEVELS = {
  easy:   {name:'이지', tag:'초보', play:'약 60%', lines:['웬만한 패는 다 따라와요 (레이즈는 거의 안 함)','진짜 좋은 패일 때만 작게 베팅, 블러핑 없음','큰 베팅·올인엔 쉽게 포기해요']},
  normal: {name:'노멀', tag:'정석', play:'약 20%', lines:['자리별 좋은 시작 패만 골라서 플레이','좋은 패는 베팅, 팟 오즈대로 콜·폴드','블러핑은 가끔, 무리한 올인 없음']},
  hard:   {name:'하드', tag:'프로 스타일', play:'약 27%', lines:['자리별 시작 패 표, 칩이 적으면 올인/폴드','내 액션으로 패를 읽고 보드에 맞춰 베팅','세미블러핑·리버 블러핑, 잘 접으면 더 압박']},
};
let botLevel = LEVELS[store('holdem.level')] ? store('holdem.level') : 'normal';
let chipChoice = CHIP_OPTIONS[store('holdem.chips')] ? +store('holdem.chips') : 10000;
const blindsOf = c => CHIP_OPTIONS[c] || {sb:SB, bb:BB};
let localState = null, localTimer = null;
let ui = {raiseOpen:false, raiseTo:0, raiseKey:'', seenCards:new Set(), bubbles:{}};

/* 이 기기의 플레이어 정보 */
function store(k, v){ try { if (v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(_){ return null; } }
// 플레이어 ID는 탭마다 따로(새로고침해도 유지), 이름은 기기에 저장
function tabStore(k, v){ try { if (v===undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch(_){ return null; } }
const me = {
  pid: tabStore('holdem.pid') || (()=>{ const id = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,'0')).join(''); tabStore('holdem.pid', id); return id; })(),
  name: store('holdem.name') || ('플레이어' + (10 + randInt(90))),
};
const cleanName = n => String(n||'').replace(/\s+/g,' ').trim().slice(0,10) || '플레이어';

/* ---------- 카드 그림 (SVG, 100×140 기준) ---------- */
// 숫자 카드 문양 위치 (아래쪽 절반은 실제 카드처럼 거꾸로)
const PIPS = {
  A: [[50,70]],
  2: [[50,30],[50,110]],
  3: [[50,30],[50,70],[50,110]],
  4: [[30,30],[70,30],[30,110],[70,110]],
  5: [[30,30],[70,30],[50,70],[30,110],[70,110]],
  6: [[30,30],[70,30],[30,70],[70,70],[30,110],[70,110]],
  7: [[30,30],[70,30],[50,50],[30,70],[70,70],[30,110],[70,110]],
  8: [[30,30],[70,30],[50,50],[30,70],[70,70],[50,90],[30,110],[70,110]],
  9: [[30,28],[70,28],[30,56],[70,56],[50,70],[30,84],[70,84],[30,112],[70,112]],
  T: [[30,28],[70,28],[50,42],[30,56],[70,56],[30,84],[70,84],[50,98],[30,112],[70,112]],
};
const RANK_TXT = r => r==='T' ? '10' : r;
function pip(s, x, y, size, flip){
  const h = size/2;
  return `<use href="#suit-${s}" x="${x-h}" y="${y-h}" width="${size}" height="${size}"${flip?` transform="rotate(180 ${x} ${y})"`:''}/>`;
}
// 그림 카드 인물 (위쪽 절반을 그리고 180도 돌려서 아래쪽에 한 번 더)
function courtHalf(r, s, ink){
  const crown = r==='K'
    ? `<path d="M39 33 L39 23 L44 28 L50 20 L56 28 L61 23 L61 33 Z" fill="#e2b13c" stroke="#7a5a12" stroke-width="1"/><circle cx="50" cy="20" r="2" fill="#c3312c"/>`
    : r==='Q'
    ? `<path d="M40 33 L41 25 L45.5 29 L50 23 L54.5 29 L59 25 L60 33 Z" fill="#e2b13c" stroke="#7a5a12" stroke-width="1"/><circle cx="41" cy="24.5" r="1.8" fill="#fff"/><circle cx="50" cy="22.5" r="1.8" fill="#fff"/><circle cx="59" cy="24.5" r="1.8" fill="#fff"/>`
    : `<path d="M39 34 Q50 19 61 34 Z" fill="${ink}" stroke="#2b2b2b" stroke-width="1"/><path d="M59 30 Q67 20 64 14" stroke="#e2b13c" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const hair = r==='Q' ? `<path d="M40 36 Q38 48 42 54 L44 40 Z M60 36 Q62 48 58 54 L56 40 Z" fill="#7a4a1c"/>` : '';
  const beard = r==='K' ? `<path d="M44 46 Q50 56 56 46 Q53 49 50 49 Q47 49 44 46 Z" fill="#d9d2c3" stroke="#8a7f6a" stroke-width=".6"/>` : '';
  const item = r==='K'
    ? `<path d="M68 70 L68 36" stroke="#9aa4ad" stroke-width="2.4"/><path d="M64 40 L72 40" stroke="#7a5a12" stroke-width="2.4"/>`
    : r==='Q'
    ? `<path d="M32 66 L33 44" stroke="#2f6b34" stroke-width="1.6"/><circle cx="33" cy="42" r="3.6" fill="#c3312c"/><circle cx="33" cy="42" r="1.4" fill="#e2b13c"/>`
    : `<path d="M31 70 L31 40" stroke="#7a5a12" stroke-width="2"/><path d="M28 42 L31 34 L34 42 Z" fill="#9aa4ad"/>`;
  return `<path d="M30 70 L33 56 Q36 51 44 50 L56 50 Q64 51 67 56 L70 70 Z" fill="${ink}" stroke="#2b2b2b" stroke-width="1"/>
    <path d="M44 50 L50 62 L56 50" fill="#e2b13c" stroke="#7a5a12" stroke-width=".8"/>
    <path d="M36 70 L38 60 M64 70 L62 60" stroke="#e2b13c" stroke-width="1.6"/>
    ${hair}<circle cx="50" cy="41" r="7.5" fill="#f3d9b5" stroke="#2b2b2b" stroke-width="1"/>
    <circle cx="47.3" cy="40" r=".9" fill="#2b2b2b"/><circle cx="52.7" cy="40" r=".9" fill="#2b2b2b"/>
    ${beard}${crown}${item}${pip(s, 27, 29, 9)}`;
}
// 스페이드 A: 전통 스타일 장식 (직접 그린 그림)
function aceOfSpadesArt(){
  const petals = Array.from({length:8}, (_,i)=>`<ellipse cx="50" cy="54" rx="1.6" ry="4.6" transform="rotate(${i*45} 50 59)" fill="#1c2733"/>`).join('');
  const leaves = side => Array.from({length:5}, (_,i)=>{ const t = i/4, x = 50 + side*(13 + t*12), y = 118 - t*15, a = side*(-40 - t*25); return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="1.6" ry="3.8" transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#1c2733"/>`; }).join('');
  return `
    <path d="M35 118 Q50 126 65 118" stroke="#1c2733" stroke-width="1.1" fill="none"/>
    <path d="M50 118 C47 110 33 111 29 101" stroke="#1c2733" stroke-width="1" fill="none"/>
    <path d="M50 118 C53 110 67 111 71 101" stroke="#1c2733" stroke-width="1" fill="none"/>
    ${leaves(-1)}${leaves(1)}
    <use href="#suit-s" x="12" y="20" width="76" height="76"/>
    <use href="#suit-s-line" x="18" y="26" width="64" height="64"/>
    <path d="M40 97 C34 103 27 101 28.5 95.5 C30 91 36 93 34 97" stroke="#1c2733" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M60 97 C66 103 73 101 71.5 95.5 C70 91 64 93 66 97" stroke="#1c2733" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="59" r="11.5" fill="#ffffff"/><circle cx="50" cy="59" r="10" fill="none" stroke="#1c2733" stroke-width=".8"/>
    ${petals}<circle cx="50" cy="59" r="2.8" fill="#ffffff" stroke="#1c2733" stroke-width=".8"/>
    <path d="M50 13 L52 16 L50 19 L48 16 Z" fill="#1c2733"/><circle cx="44.5" cy="16" r=".9" fill="#1c2733"/><circle cx="55.5" cy="16" r=".9" fill="#1c2733"/>`;
}
const COURT_IMG = r => 'JQK'.includes(r);
// 그림 카드 12장을 미리 불러와 디코딩해 두고 계속 붙잡아 둠 (화면을 다시 그려도 바로 그려지게)
const COURT_CACHE = {};
(function preloadCourts(){
  for (const r of 'JQK') for (const s of 'SHDC'){
    const img = new Image(); img.decoding = 'async'; img.className = 'face'; img.alt = ''; img.draggable = false; img.src = `cards/${r}${s}.webp`;
    COURT_CACHE[r+s] = img;
    if (img.decode) img.decode().catch(()=>{});
  }
})();
const courtReady = key => { const img = COURT_CACHE[key]; return !!(img && img.complete && img.naturalWidth > 0); };
// 화면을 다시 그린 뒤, 미리 불러 둔 그림 요소를 그대로 옮겨 끼움 (새로 만들지 않으니 깜빡임이 없음)
function mountFaces(root){
  (root || document).querySelectorAll('.face-slot').forEach(slot=>{
    const img = COURT_CACHE[slot.dataset.face];
    if (!img) return;
    slot.replaceWith(img.isConnected ? img.cloneNode() : img);
  });
}
function cardSVG(c, mini){
  const r = c[0], s = c[1], red = s==='h' || s==='d';
  const ink = red ? '#c3312c' : '#1c2733';
  if (mini){
    return `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#ffffff" stroke="#bdb6a4" stroke-width="2"/>
      <text x="50" y="62" text-anchor="middle" font-size="${r==='T'?50:58}" font-weight="700" fill="${ink}" font-family="Arial,Helvetica,'Liberation Sans',sans-serif">${RANK_TXT(r)}</text>
      ${pip(s, 50, 98, 52)}</svg>`;
  }
  const idx = `<text x="12" y="25" text-anchor="middle" font-size="${r==='T'?17:21}" font-weight="600" fill="${ink}" font-family="Arial,Helvetica,'Liberation Sans',sans-serif" letter-spacing="${r==='T'?-1.8:0}">${RANK_TXT(r)}</text>${pip(s, 12, 36, 12)}`;
  let middle;
  if (c==='As') {
    middle = aceOfSpadesArt();
  } else if (PIPS[r]) {
    const big = r==='A' ? (s==='s' ? 46 : 34) : 19;
    middle = PIPS[r].map(([x,y])=>pip(s, x, y, big, y>70)).join('');
  } else {
    middle = `<rect x="22" y="18" width="56" height="104" rx="3" fill="#f6ead0" stroke="${ink}" stroke-width="1.6"/>
      <clipPath id="cf-${c}"><rect x="23" y="19" width="54" height="102" rx="2"/></clipPath>
      <g clip-path="url(#cf-${c})">${courtHalf(r, s, ink)}<g transform="rotate(180 50 70)">${courtHalf(r, s, ink)}</g></g>
      <path d="M22 70 L78 70" stroke="${ink}" stroke-width=".8" opacity=".5"/>`;
  }
  return `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="137" rx="8" fill="#ffffff" stroke="#bdb6a4" stroke-width="1.5"/>
    ${middle}${idx}<g transform="rotate(180 50 70)">${idx}</g></svg>`;
}
const BACK_SVG = `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="137" rx="8" fill="#ffffff" stroke="#bdb6a4" stroke-width="1.5"/>
  <rect x="7" y="7" width="86" height="126" rx="5" fill="url(#card-back)"/><rect x="7" y="7" width="86" height="126" rx="5" fill="none" stroke="#e9dcc0" stroke-width="1.2"/>
  <rect x="13" y="13" width="74" height="114" rx="3" fill="none" stroke="#e9dcc0" stroke-width=".8" opacity=".7"/></svg>`;
/* ---------- 족보 용어 설명 ---------- */
const HAND_INFO = {
  '하이카드':        {p:'17.4%', once:'약 6판에 1번', rank:10, ex:['Ah','Js','8d','5c','3s'], d:'아무 조합도 없는 패예요. 가장 높은 카드끼리 비교하고, 같으면 그다음 높은 카드로 비교해요.'},
  '원 페어':         {p:'43.8%', once:'약 2판에 1번', rank:9,  ex:['9s','9h','Ad','Kc','4s'], d:'같은 숫자 2장이에요. 페어 숫자가 높은 쪽이 이기고, 같으면 나머지 카드(키커)로 비교해요.'},
  '투 페어':         {p:'23.5%', once:'약 4판에 1번', rank:8,  ex:['Js','Jh','5d','5c','As'], d:'서로 다른 페어가 두 개예요. 높은 페어부터 비교하고, 그다음 낮은 페어, 마지막으로 남은 한 장을 비교해요.'},
  '트리플':          {p:'4.83%', once:'약 21판에 1번', rank:7,  ex:['7s','7h','7d','Kc','2s'], d:'같은 숫자 3장이에요. "트립스" 또는 "셋"이라고도 불러요. 숫자가 높은 트리플이 이겨요.'},
  '스트레이트':      {p:'4.62%', once:'약 22판에 1번', rank:6,  ex:['Ts','9h','8d','7c','6s'], d:'무늬와 상관없이 숫자가 연속된 5장이에요. A는 가장 높게(10-J-Q-K-A)도, 가장 낮게(A-2-3-4-5)도 쓸 수 있어요.'},
  '플러시':          {p:'3.03%', once:'약 33판에 1번', rank:5,  ex:['Ad','Jd','8d','6d','2d'], d:'숫자와 상관없이 같은 무늬 5장이에요. 가장 높은 카드부터 차례로 비교해요.'},
  '풀 하우스':       {p:'2.60%', once:'약 38판에 1번', rank:4,  ex:['Ks','Kh','Kd','4c','4s'], d:'트리플 + 원 페어 조합이에요. 트리플 숫자가 높은 쪽이 이기고, 같으면 페어 숫자로 비교해요.'},
  '포카드':          {p:'0.168%', once:'약 595판에 1번', rank:3,  ex:['Qs','Qh','Qd','Qc','7s'], d:'같은 숫자 4장이에요. 거의 지지 않는 아주 강한 패예요.'},
  '스트레이트 플러시':{p:'0.028%', once:'약 3,591판에 1번', rank:2, ex:['9h','8h','7h','6h','5h'], d:'같은 무늬로 숫자가 연속된 5장이에요. 로열 플러시 다음으로 강해요.'},
  '로열 플러시':     {p:'0.0032%', once:'약 30,940판에 1번', rank:1,  ex:['As','Ks','Qs','Js','Ts'], d:'같은 무늬의 10-J-Q-K-A예요. 홀덤에서 가장 강한 패예요.'},
  '포켓 페어':       {p:'5.88%', once:'약 17판에 1번', ex:['8s','8h'], d:'처음 받은 개인 카드 2장이 같은 숫자예요. 공용 카드가 깔리기 전부터 원 페어를 들고 시작하는 좋은 출발이에요.'},
  '수딧':            {p:'23.5%', once:'약 4판에 1번', ex:['Kh','9h'], d:'처음 받은 개인 카드 2장의 무늬가 같아요(수트가 같다는 뜻). 같은 무늬가 3장 더 깔리면 플러시가 돼요.'},
  '오프수트':        {p:'70.6%', once:'10판 중 7번꼴', ex:['Ad','7c'], d:'처음 받은 개인 카드 2장의 무늬가 서로 달라요. 아직 아무 조합도 없는 상태예요.'},
};
const LADDER = ['로열 플러시','스트레이트 플러시','포카드','풀 하우스','플러시','스트레이트','트리플','투 페어','원 페어','하이카드'];
const LADDER_SHORT = ['로플','스플','포카','풀하','플러','스트','트리','투페','원페','하이'];
// 지금 내 족보가 10단계 중 어디인지 + 나올 확률
// 내 카드 2장이 족보에 실제로 쓰였는지 (바닥 카드만으로 된 족보인지) 구분
function handUse(hole, board){
  if (!hole || hole.length<2 || board.length<3) return null;
  const b = best(hole.concat(board)); if (!b) return null;
  const five = b.cards, cnt = {};
  five.forEach(c=>{ cnt[c[0]] = (cnt[c[0]]||0) + 1; });
  let core;
  if ([1,2,3,6,7].includes(b.cat)) core = five.filter(c=>cnt[c[0]]>=2);       // 페어·트리플·풀하우스·포카드: 짝 맞은 카드
  else if (b.cat===0) core = [five.slice().sort((x,y)=>rv(y)-rv(x))[0]];       // 하이카드: 제일 높은 카드
  else core = five;                                                           // 스트레이트·플러시: 5장 모두
  let mineCore = hole.filter(c=>core.includes(c));
  let kick = hole.filter(c=>five.includes(c) && !core.includes(c));
  if (board.length===5){ const bb = best(board); if (bb && bb.score===b.score){ mineCore = []; kick = []; } } // 바닥 5장 그대로가 최고
  return {b, name: handName(b), mineCore, kick, shared: mineCore.length===0};
}
// 내 카드가 실제로 들어가서 만들어지는 가장 좋은 족보 (바닥 카드만으로 된 족보는 제외)
function myHand(hole, board){
  const all = hole.concat(board); let top = null;
  for (const ix of combos(all.length)){
    const five = ix.map(i=>all[i]);
    if (!five.some(c=>hole.includes(c))) continue;
    const h = eval5(five);
    if (top && h.score<=top.score) continue;
    const cnt = {}; five.forEach(c=>{ cnt[c[0]] = (cnt[c[0]]||0) + 1; });
    let core;
    if ([1,2,3,6,7].includes(h.cat)) core = five.filter(c=>cnt[c[0]]>=2);
    else if (h.cat===0) core = [five.slice().sort((x,y)=>rv(y)-rv(x))[0]];
    else core = five;
    if (!core.some(c=>hole.includes(c))) continue;
    top = h; top.cards = five;
  }
  return top;
}
function cardTxt(c){ const r = c[0]==='T' ? '10' : c[0]; const sy = {s:'♠',h:'♥',d:'♦',c:'♣'}[c[1]]; return `<span class="ct ${c[1]==='h'||c[1]==='d'?'red':''}">${r}${sy}</span>`; }
// 추천플레이: 바닥 카드만으로 된 족보 안내
function boardNote(hole, board){
  const u = handUse(hole, board); if (!u || !u.shared) return '';
  const k = u.kick.length ? `실제 승부는 이 ${esc(u.name)}에 내 ${u.kick.map(cardTxt).join(' ')} 키커를 더해서 겨뤄요` : '내 카드는 승부에 안 쓰여서 비기기 쉬워요';
  const ga = ((u.name.charCodeAt(u.name.length-1)-0xAC00)%28) ? '이' : '가';
  return `<p class="adv-board">📋 바닥 카드만으로 ${esc(u.name)}${ga} 돼 있어요. 이건 모두가 같이 쓰는 패라 ${k}.</p>`;
}
// 판 결과·기록용 족보 이름: 바닥 카드만으로 된 족보는 내 것으로 치지 않고, 내 카드로 만든 조합 + 승부를 가른 키커로 표시
function ownHandLabel(hole, board){
  if (!hole || hole.length<2 || board.length<3) return '';
  const mh = myHand(hole, board), name = mh ? handName(mh) : HAND[0];
  const u = handUse(hole, board);
  if (!u || !u.shared || !u.kick.length) return name;
  const k = u.kick.slice().sort((x,y)=>rv(y)-rv(x))[0];
  return `${name} (${k[0]==='T' ? '10' : k[0]}${{s:'♠',h:'♥',d:'♦',c:'♣'}[k[1]]} 키커)`;
}
function handUseHTML(u){
  if (!u) return '';
  if (u.shared){
    const k = u.kick.length ? `내 카드로는 ${u.kick.map(cardTxt).join(' ')} 키커만 더해져요` : '내 카드는 안 쓰여요 (비기기 쉬워요)';
    return `<span class="huse shared">바닥 카드만으로 된 ${esc(u.name)}예요 · ${k}</span>`;
  }
  return `<span class="huse"><b>내 카드</b> ${u.mineCore.map(cardTxt).join(' ')}로 만든 ${esc(u.name)}${u.kick.length ? ` · 키커 ${u.kick.map(cardTxt).join(' ')}` : ''}</span>`;
}
function handRankHTML(term){
  const it = HAND_INFO[term]; if (!it) return '';
  if (!it.rank) return `<span class="hrank"><span class="hr-txt">시작 패 · 나올 확률 <b>${it.p}</b></span></span>`;
  const cells = LADDER.map((n,i)=>`<i class="${i+1===it.rank?'on':''}${i+1<it.rank?' up':''}" title="${i+1}위 ${n}">${i+1}</i>`).join('');
  return `<span class="hrank"><span class="ladder" aria-label="족보 순위">${cells}</span><span class="hr-txt">순위 <b>${it.rank}</b> / 10 · 나올 확률 <b>${it.p}</b></span></span>`;
}
function infoPopHTML(term){
  const it = HAND_INFO[term]; if (!it) return '';
  return `<div class="info-pop" role="dialog" aria-label="${term} 설명">
    <div class="info-head"><b>${term}</b>${it.rank ? `<span class="info-rank">순위 ${it.rank} / 10</span>` : `<span class="info-rank">시작 패 용어</span>`}<button class="info-x" data-a="info-close" aria-label="닫기">×</button></div>
    <p>${it.d}</p>
    <p class="info-prob">${it.rank ? '7장(내 카드 2 + 공용 5)으로 이 족보가 나올 확률' : '처음 받은 2장이 이렇게 나올 확률'} <b>${it.p}</b> · ${it.once}</p>
    <div class="info-ex">${it.ex.map(c=>cardHTML(c,{mini:true})).join('')}</div>
  </div>`;
}

/* ---------- 이모티콘 호환 ----------
   보낼 때는 이모티콘 글자 그대로 보내고, 받는 기기에서 그 기기 이모티콘으로 그림.
   그 기기가 못 그리는 이모티콘(□로 깨지거나 쪼개짐)은 같은 이모티콘 그림(Twemoji)으로,
   그림도 못 불러오면 비슷한 옛날 이모티콘으로 대신 보여줌. */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","Android Emoji","Twemoji Mozilla",sans-serif';
const EMOJI_FALLBACK = {'🫵':'👉','😵‍💫':'😵','🪓':'🔨','🤲':'🙌','🤯':'😱','🤬':'😡','🤪':'😜','☠️':'💀','🖐️':'✋','🤝':'👍','💩':'😝','👺':'😈','🃏':'🎴'};
const emojiOkCache = new Map();
let emojiProbe = null;
function emojiPixels(ch){
  const {x} = emojiProbe; x.clearRect(0, 0, 40, 40); x.fillText(ch, 4, 4);
  return x.getImageData(0, 0, 40, 40).data;
}
function emojiSupported(e){
  if (emojiOkCache.has(e)) return emojiOkCache.get(e);
  let ok = true;
  try {
    if (!emojiProbe){
      const c = document.createElement('canvas'); c.width = c.height = 40;
      const x = c.getContext('2d', {willReadFrequently:true});
      x.font = `28px ${EMOJI_FONT}`; x.textBaseline = 'top'; x.fillStyle = '#000';
      emojiProbe = {x, tofu: null, one: x.measureText('😀').width};
      emojiProbe.tofu = emojiPixels('\u{10FFFD}');          // 이 기기가 "없는 글자"를 그리는 모양(□)
    }
    const {x, tofu, one} = emojiProbe;
    if (x.measureText(e).width > one * 1.35) ok = false;   // 합성 이모티콘이 여러 개로 쪼개져 그려짐
    else {
      const d = emojiPixels(e); let ink = 0, same = true;
      for (let i = 3; i < d.length; i += 4){ if (d[i] > 40) ink++; if (same && d[i] !== tofu[i]) same = false; }
      ok = ink > 20 && !same;                               // 아무것도 안 그려지거나 □와 똑같으면 미지원
    }
  } catch(_){ ok = true; }
  emojiOkCache.set(e, ok); return ok;
}
function twemojiURL(e){
  const cps = [...e].map(ch=>ch.codePointAt(0));
  const list = cps.includes(0x200d) ? cps : cps.filter(cp=>cp!==0xfe0f);
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${list.map(cp=>cp.toString(16)).join('-')}.svg`;
}
// HTML 문자열로 (우리 목록에 있는 이모티콘 전용)
function emojiHTML(e){
  if (emojiSupported(e)) return `<span class="emo-t">${e}</span>`;
  const fb = EMOJI_FALLBACK[e] || e;
  return `<img class="emo-i" src="${twemojiURL(e)}" alt="${e}" draggable="false" onerror="this.outerHTML='<span class=&quot;emo-t&quot;>${fb}</span>'">`;
}
// 아무 글(채팅·말풍선)을 안전하게 그리면서 이모티콘만 골라 호환 처리
const isEmojiGrapheme = g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) || /^[‼⁉♠-♧]️$/.test(g);
function graphemes(str){
  if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter('ko', {granularity:'grapheme'}).segment(str)].map(x=>x.segment);
  return str.match(/\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|[\s\S]/gu) || [];
}
function renderRich(el, text){
  el.textContent = '';
  let buf = '';
  const flush = () => { if (buf){ el.appendChild(document.createTextNode(buf)); buf = ''; } };
  for (const g of graphemes(String(text||''))){
    if (!isEmojiGrapheme(g)){ buf += g; continue; }
    flush();
    if (emojiSupported(g)){ const sp = document.createElement('span'); sp.className = 'emo-t'; sp.textContent = g; el.appendChild(sp); }
    else {
      const img = document.createElement('img'); img.className = 'emo-i'; img.alt = g; img.draggable = false; img.src = twemojiURL(g);
      img.onerror = () => { const sp = document.createElement('span'); sp.className = 'emo-t'; sp.textContent = EMOJI_FALLBACK[g] || g; img.replaceWith(sp); };
      el.appendChild(img);
    }
  }
  flush();
}

function cardHTML(c, opts={}){
  if (!c) return `<div class="card empty"></div>`;
  if (c==='back') return `<div class="card back">${BACK_SVG}</div>`;
  const key = (opts.key||'') + c;
  const fresh = opts.animate && !ui.seenCards.has(key); if (opts.animate) ui.seenCards.add(key);
  const dl = fresh && opts.delay ? ` style="--d:${opts.delay|0}ms"` : '';
  const label = `${RANK_TXT(c[0])} ${({s:'스페이드',h:'하트',d:'다이아',c:'클로버'})[c[1]]}`;
  if (!opts.mini && COURT_IMG(c[0])){
    const key = c[0] + c[1].toUpperCase(), src = `cards/${key}.webp`;
    // 이미 준비된 그림이면 예비 그림 없이 바로(동기 디코딩) 그려서 깜빡임이 없게
    if (courtReady(key)) return `<div class="card${opts.hl?' hl':''}${opts.dim?' dim':''}${fresh?' new':''}"${dl} role="img" aria-label="${label}"><span class="face-slot" data-face="${key}"></span></div>`;
    return `<div class="card${opts.hl?' hl':''}${opts.dim?' dim':''}${fresh?' new':''}"${dl} role="img" aria-label="${label}">${cardSVG(c, opts.mini)}<img class="face" src="${src}" alt="" draggable="false" decoding="sync" onerror="this.remove()"></div>`;
  }
  return `<div class="card${opts.hl?' hl':''}${opts.dim?' dim':''}${fresh?' new':''}"${dl} role="img" aria-label="${label}">${cardSVG(c, opts.mini)}</div>`;
}

/* ---------- 카지노 칩 ---------- */
const CHIPS = [
  {v:5000, c:'#8c1d40', e:'#f3d27a', t:'5K'},
  {v:1000, c:'#e0a12a', e:'#3a2a0a', t:'1K'},
  {v:500,  c:'#6a3d9a', e:'#f4efe4', t:'500'},
  {v:100,  c:'#1d1f22', e:'#f4efe4', t:'100'},
  {v:25,   c:'#1f8a4c', e:'#f4efe4', t:'25'},
  {v:5,    c:'#c62f2f', e:'#f4efe4', t:'5'},
  {v:1,    c:'#f2efe6', e:'#2d5fa8', t:'1'},
];
// 시작 칩 구성 (이 개수로 테이블에 앉음)
const START_STACKS = {
  1000:  [[100,4],[25,16],[5,40]],              // $400 + $400 + $200
  10000: [[1000,4],[500,6],[100,20],[25,40]],    // $4,000 + $3,000 + $2,000 + $1,000
};
function chipParts(amount){
  const out = []; let left = Math.max(0, Math.round(amount));
  for (const ch of CHIPS){ const n = Math.floor(left / ch.v); if (n){ out.push([ch, n]); left -= n*ch.v; } }
  return out;
}
function chipOne(ch, i){ return `<i class="chip" style="--c:${ch.c};--e:${ch.e}${i!=null?`;--i:${i}`:''}"><b>${ch.t}</b></i>`; }
// 금액을 칩 더미로 표시 (칩 종류별로 기둥, 기둥마다 최대 maxPer개)
function chipStack(amount, {cols=3, maxPer=6}={}){
  const parts = chipParts(amount).slice(0, cols);
  if (!parts.length) return '';
  return `<span class="stack">${parts.map(([ch,n])=>{
    const k = Math.min(n, maxPer);
    return `<span class="col" style="--n:${k}">${Array.from({length:k},(_,i)=>chipOne(ch, i)).join('')}</span>`;
  }).join('')}</span>`;
}
function chipBreakdown(amount, startTotal){
  const start = START_STACKS[startTotal] || START_STACKS[10000];
  const kinds = start.map(([v])=>v);                     // 이 테이블에서 쓰는 칩 종류 (큰 것부터)
  let left = Math.max(0, Math.round(amount)); const cnt = {};
  // 작은 칩부터 시작할 때 받은 개수만큼 채우고
  for (const [v, n] of [...start].reverse()){ const k = Math.min(n, Math.floor(left / v)); if (k){ cnt[v] = k; left -= k*v; } }
  // 나머지는 큰 칩으로
  for (const v of kinds){ const k = Math.floor(left / v); if (k){ cnt[v] = (cnt[v]||0) + k; left -= k*v; } }
  // 더 작은 단위가 남으면 $5, $1 칩으로
  for (const v of [5, 1]){ const k = Math.floor(left / v); if (k){ cnt[v] = (cnt[v]||0) + k; left -= k*v; } }
  return CHIPS.filter(ch=>cnt[ch.v]).map(ch=>[ch, cnt[ch.v]]);
}
// 내 칩을 실제처럼 기억: 낼 때는 가진 칩으로(필요하면 거슬러 받고), 딸 때는 받은 만큼 위에 쌓음
const TRAY_KINDS = [5000, 1000, 500, 100, 25, 5, 1];
function addChips(cnt, amt){ for (const v of TRAY_KINDS){ const k = Math.floor(amt / v); if (k){ cnt[v] = (cnt[v]||0) + k; amt -= k*v; } } }
function payChips(cnt, amt){
  for (const v of TRAY_KINDS){ while ((cnt[v]||0) > 0 && v <= amt){ cnt[v]--; amt -= v; } }
  while (amt > 0){                                    // 딱 맞는 칩이 없으면 큰 칩 하나를 깨서 거스름돈
    const v = [...TRAY_KINDS].reverse().find(x => (cnt[x]||0) > 0 && x > amt);
    if (!v) return false;
    cnt[v]--; addChips(cnt, v - amt); amt = 0;
  }
  return true;
}
function trayParts(id, amount, startTotal){
  ui.trays = ui.trays || {};
  let t = ui.trays[id];
  if (!t || t.amt === 0){                         // 처음이거나 리바이: 시작 칩 구성으로
    t = {amt: amount, cnt: {}};
    chipBreakdown(amount, startTotal).forEach(([ch, n])=>{ t.cnt[ch.v] = n; });
  } else if (amount > t.amt) addChips(t.cnt, amount - t.amt);
  else if (amount < t.amt && !payChips(t.cnt, t.amt - amount)){ t.cnt = {}; chipBreakdown(amount, startTotal).forEach(([ch, n])=>{ t.cnt[ch.v] = n; }); }
  t.amt = amount; ui.trays[id] = t;
  return CHIPS.filter(ch => t.cnt[ch.v] > 0).map(ch => [ch, t.cnt[ch.v]]);
}
function chipTray(amount, startTotal, id){
  const parts = id ? trayParts(id, amount, startTotal) : chipBreakdown(amount, startTotal);
  if (!parts.length) return '<span class="note">칩 없음</span>';
  return parts.map(([ch, n])=>{
    const k = Math.min(n, 10);
    return `<span class="tcol" title="${fmt(ch.v)} × ${n}"><span class="stack"><span class="col" style="--n:${k}">${Array.from({length:k},(_,i)=>chipOne(ch, i)).join('')}</span></span><span class="count num">×${n}</span></span>`;
  }).join('');
}
function startStackHTML(total){
  const parts = START_STACKS[total] || [];
  return parts.map(([v,n])=>{ const ch = CHIPS.find(x=>x.v===v); return `<span class="startchip">${chipOne(ch)}<span>×${n}</span></span>`; }).join('');
}
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true, 2600); }

function myId(){ return view==='local' ? 'me' : me.pid; }
function nameOf(s, i){
  const p = s.seats[i]; if (!p) return '';
  if (p.id===myId()) return '나';
  return p.name || `플레이어 ${i+1}`;
}
function logName(s, e){
  const p = s.seats[e.i];
  if (p && p.id===e.id) return nameOf(s, e.i);
  return e.n || '';
}

/* ---------- 로비 ---------- */
function renderLobby(){
  const peerOk = onlineSupported();
  app.innerHTML = `
  <div class="bar"><h1>홀덤 테이블</h1><button class="ghost" data-a="rules">족보·규칙</button></div>
  <section class="hero">
    <div class="suits">♠ ♥ ♦ ♣</div>
    <h2>텍사스 홀덤</h2>
  </section>
  <div class="mode">
    <b>시작 금액</b>
    <div class="levels chips2" role="radiogroup" aria-label="시작 칩">
      ${Object.entries(CHIP_OPTIONS).map(([c,o])=>`<button role="radio" aria-checked="${chipChoice===+c}" class="level${chipChoice===+c?' on':''}" data-a="chips" data-v="${c}"><b class="num">${fmt(c)}</b><span>블라인드 $${o.sb}/$${o.bb}</span><span class="startchips">${startStackHTML(+c)}</span></button>`).join('')}
    </div>
  </div>
  <div class="mode" style="flex-direction:row;align-items:center">
    <label for="name-in" style="white-space:nowrap">내 이름</label>
    <input id="name-in" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(me.name)}" name="search_nick" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore>
  </div>
  <div class="modes">
    <div class="mode">
      <h3>컴퓨터와 대결</h3>
      <div class="stepper"><button data-a="bots-" aria-label="상대 줄이기">−</button><span class="num">${botCount}</span><span>명의 상대</span><button data-a="bots+" aria-label="상대 늘리기">+</button></div>
      <div class="levels" role="radiogroup" aria-label="난이도">
        ${Object.entries(LEVELS).map(([k,v])=>`<button role="radio" aria-checked="${botLevel===k}" class="level${botLevel===k?' on':''}" data-a="level" data-v="${k}"><b>${v.name}</b><small>${v.tag}</small></button>`).join('')}
      </div>
      <div class="level-desc"><div class="ld-head"><b>${LEVELS[botLevel].name} · ${LEVELS[botLevel].tag}</b><span>참여하는 판 ${LEVELS[botLevel].play}</span></div><ul>${LEVELS[botLevel].lines.map(t=>`<li>${t}</li>`).join('')}</ul></div>
      <button class="primary" data-a="start-local">게임 시작</button>
    </div>
    <div class="mode">
      <h3>온라인</h3>
      <p>방을 만들고 초대 링크를 보내세요. 링크를 연 친구는 이름만 정하면 바로 자리에 앉아요. 인원은 2~9명 중에서 정하고, 게임 중에도 바꿀 수 있어요.</p>
      <div class="stepper"><button data-a="hseats-" aria-label="최대 인원 줄이기" ${hostSeats<=MIN_SEATS?'disabled':''}>−</button><span class="num">${hostSeats}</span><span>명까지 참여</span><button data-a="hseats+" aria-label="최대 인원 늘리기" ${hostSeats>=MAX_SEATS?'disabled':''}>+</button></div>
      <button class="primary" data-a="host" ${peerOk?'':'disabled'}>방 만들기</button>
      <p class="note ${peerOk?'':'warn'}">${peerOk ? '방을 만든 사람의 기기가 딜러 역할을 해요. 게임 중에는 이 페이지를 닫지 마세요.' : '이 브라우저에서는 온라인 대전을 할 수 없어요. 최신 크롬이나 사파리로 열어 주세요.'}</p>
    </div>
  </div>`;
}

/* ---------- 초대 링크로 들어왔을 때: 이름 정하고 입장 ---------- */
let pendingRoom = null;
function renderJoin(){
  app.innerHTML = `
  <div class="bar"><h1>홀덤 테이블</h1><button class="ghost" data-a="rules">족보·규칙</button></div>
  <section class="hero">
    <div class="suits">♠ ♥ ♦ ♣</div>
    <h2>초대받은 테이블</h2>
    <p>테이블에서 쓸 이름을 정하고 입장하세요. 빈 자리에 바로 앉아요.</p>
  </section>
  <form class="mode" id="join-form" novalidate>
    <label for="join-name"><b>내 이름</b> <span class="note">(최대 10자)</span></label>
    <input id="join-name" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(ui.joinDraft ?? (store('holdem.name') || ''))}" placeholder="예: 영규" name="search_nick_join" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore enterkeyhint="go">
    <button class="primary" type="submit">입장하기</button>
    <p class="note">이름은 이 기기에 저장돼서 다음에도 그대로 써요. 게임 중에도 바꿀 수 있어요.</p>
  </form>
  <button class="ghost" data-a="leave" style="align-self:flex-start">초대 대신 혼자 컴퓨터와 하기</button>`;
  const inp = document.getElementById('join-name');
  if (inp && !inp.value) inp.focus();
}
function submitJoin(){
  const inp = document.getElementById('join-name');
  const raw = (inp && inp.value || '').trim();
  if (!raw){ toast('이름을 입력해 주세요.'); inp && inp.focus(); return; }
  me.name = cleanName(raw); store('holdem.name', me.name);
  const room = pendingRoom; pendingRoom = null;
  joinRoom(room);
}
function saveRename(){
  const inp = document.getElementById('rename-in');
  const raw = (inp && inp.value || '').trim();
  if (!raw){ toast('이름을 입력해 주세요.'); return; }
  me.name = cleanName(raw); store('holdem.name', me.name);
  ui.renameOpen = false; ui.renameFocus = false;
  sendNet({t:'rename', name: me.name});
  toast(`이름을 ‘${me.name}’(으)로 바꿨어요.`);
}

/* ---------- 테이블 ---------- */
// 자리 위치(테이블 너비·높이 %): 내 자리(0)를 맨 아래 가운데에 두고 시계 방향.
// 세로 화면: 맨 아래 줄은 나만(양옆에 이모티콘·내 칩), 다른 사람은 위쪽 줄과 양옆에 앉음
const SEAT_LAYOUT = {
  2: [[50,90],[50,11]],
  3: [[50,90],[25,11],[75,11]],
  4: [[50,90],[11,50],[50,11],[89,50]],
  5: [[50,90],[11,50],[30,11],[70,11],[89,50]],
  6: [[50,90],[11,50],[18,11],[50,11],[82,11],[89,50]],
  7: [[50,90],[10,62],[10,38],[30,11],[70,11],[90,38],[90,62]],
  8: [[50,90],[10,62],[10,38],[18,11],[50,11],[82,11],[90,38],[90,62]],
  9: [[50,90],[10,62],[10,38],[14,11],[38,11],[62,11],[86,11],[90,38],[90,62]],
};
// 가로 화면(PC·태블릿): 2:1 타원 테두리를 따라 고르게
function wideSlot(k, N){
  if (k===0) return [50, 90];
  if (N===2) return [50, 10];
  // 내 자리 양옆(이모티콘·칩 자리)은 비워 두고 나머지 둘레에 고르게
  const gap = Math.max(60, 180 - (N-1)*30), a = (90 + gap + (k-1)*(360 - 2*gap)/(N-2)) * Math.PI/180;
  return [50 + 44*Math.cos(a), 50 + 40*Math.sin(a)];
}
const isWide = () => innerWidth >= 1000 && innerWidth > innerHeight;
// 베팅 칩 위치: 자리에서 가운데 쪽으로, 공용 카드·팟과 자기 자리를 피해서 (단위: 테이블 %)
function betPos(x, y, dense){
  const wide = isWide();
  const C = wide ? {l:25, r:75, t:30, b:70} : {l:dense?23:20, r:dense?77:80, t:34, b:68};   // 가운데(카드·팟) 영역
  const bw = wide ? 4.5 : 8, bh = wide ? 6.5 : 5;                                            // 칩 더미 반쪽 크기
  const sw = wide ? 6 : (dense ? 10 : 11), sh = wide ? 11 : 11;                              // 자리 반쪽 크기
  const clear = (bx, by) => (bx+bw < C.l || bx-bw > C.r || by+bh < C.t || by-bh > C.b) && (Math.abs(bx-x) > sw+bw || Math.abs(by-y) > sh+bh);
  for (let f = .5; f >= .12; f -= .02){ const bx = x + (50-x)*f, by = y + (50-y)*f; if (clear(bx, by)) return [bx, by]; }
  return [x + (x<50 ? 1 : -1)*(sw*.4), y + sh + bh + 1];   // 옆자리: 자리 바로 아래
}
// 그려진 뒤 실제 크기를 재서, 베팅 칩이 카드·팟·자리·다른 칩과 겹치지 않는 첫 자리로 옮김
function placeBets(){
  const table = app.querySelector('.table'); if (!table) return;
  const bets = [...table.querySelectorAll('.betchip')]; if (!bets.length) return;
  const T = table.getBoundingClientRect(), R = e => e.getBoundingClientRect();
  const hit = (a, c) => a.left < c.right-1 && c.left < a.right-1 && a.top < c.bottom-1 && c.top < a.bottom-1;
  const blockers = [...table.querySelectorAll('.center .board, .center .pot, .center .stage, .seat, .emostrip, .mytray')].map(R);
  const placed = [];
  const place = (el, tight) => {
    const x = +el.dataset.x, y = +el.dataset.y, side = x < 50 ? 1 : -1;
    el.classList.toggle('tight', !!tight);
    const b0 = R(el), w = b0.width, h = b0.height;               // 칩 더미 크기는 한 번만 재고
    const rectAt = (bx, by) => { const cx = T.left + bx/100*T.width, cy = T.top + by/100*T.height; return {left:cx-w/2, right:cx+w/2, top:cy-h/2, bottom:cy+h/2}; };
    const cands = [];
    for (let f = .5; f >= .14; f -= .04) cands.push([x + (50-x)*f, y + (50-y)*f]);   // 가운데 쪽으로
    for (let dx = 8; dx <= 26; dx += 3) for (const dy of [0, -6, 6, -11, 11, -16, 16, -21, 21]) cands.push([x + side*dx, y + dy]);  // 자리 주변
    for (const dy of [14, -14, 18, -18, 22, -22]) cands.push([x, y + dy]);
    for (const [bx, by] of cands){
      const r = rectAt(bx, by);
      if (r.left >= T.left && r.right <= T.right && r.top >= T.top && r.bottom <= T.bottom && !blockers.some(b=>hit(r, b)) && !placed.some(b=>hit(r, b))){
        el.style.left = bx + '%'; el.style.top = by + '%'; placed.push(r); return true;
      }
    }
    if (!tight) return false;
    el.style.left = cands[0][0] + '%'; el.style.top = cands[0][1] + '%'; placed.push(R(el)); return true;
  };
  // 자리가 부족하면 칩 더미 없이 금액만 작게 표시
  bets.forEach(el=>{ if (!place(el, false)) place(el, true); });
}
function slotPos(k, N){ return isWide() ? wideSlot(k, N) : (SEAT_LAYOUT[N] || SEAT_LAYOUT[6])[k]; }
function currentState(){ return view==='local' ? localState : net.state; }
function renderTable(){
  const s = currentState();
  const head = view==='local'
    ? `<div class="bar"><h1>홀덤 테이블<small>컴퓨터 · ${LEVELS[s && s.level || 'normal'].name}</small></h1>${soundBtn()}<button class="ghost" data-a="rules">족보</button><button class="ghost" data-a="leave">나가기</button></div>`
    : `<div class="bar"><h1>홀덤 테이블<small>${net.role==='host'?'온라인 · 방장':'온라인'}</small></h1>${soundBtn()}<button class="ghost" data-a="invite">초대 링크</button><button class="ghost" data-a="rules">족보</button><button class="ghost" data-a="leave">나가기</button></div>`;
  const statusLine = view==='online' && net.status ? `<p class="note warn">${esc(net.status)}</p>` : '';
  if (!s){ app.innerHTML = `${head}${statusLine}<p class="status">${view==='online' && net.role==='guest' ? '방에 연결하는 중…' : '테이블을 준비하는 중…'}</p>${view==='online'&&net.status?`<button class="primary" data-a="leave">처음 화면으로</button>`:''}`; return; }
  const meId = myId();
  const myIdx = s.seats.findIndex(p=>p && p.id===meId);
  const base = myIdx>=0 ? myIdx : 0;
  const now = Date.now();
  const betting = BETTING.has(s.stage);
  const winSet = new Set(s.winners.map(w=>w.s));
  const showAll = s.stage==='done' && !s.uncontested;
  const winCards = new Set();
  if (showAll) s.winners.forEach(w=>{ const b = best(s.seats[w.s].cards.concat(s.board)); b && b.cards.forEach(c=>winCards.add(c)); });

  let seatsHTML = '', chips = '', revealN = 0;
  const N = s.seats.length;
  for (let i=0;i<N;i++){
    const slot = (i - base + N) % N; const [x,y] = slotPos(slot, N);
    const p = s.seats[i];
    if (!p){
      if (view==='local') continue;
      seatsHTML += `<div class="seat" style="left:${x}%;top:${y}%">${myIdx<0 ? `<button class="sit" data-a="sit" data-i="${i}">여기 앉기</button>` : `<div class="emptyseat">빈 자리</div>`}</div>`;
      continue;
    }
    const isMe = i===myIdx;
    const acting = betting && s.toAct===i;
    const cls = ['seat', acting?'acting':'', p.folded&&p.inHand?'folded':'', (!p.inHand && p.chips===0)?'out':'', winSet.has(i)&&s.stage==='done'?'win':''].join(' ');
    let hole = '';
    const opened = s.stage==='done' && p.shown && p.cards.length===2 && p.cards[0] !== 'back';
    if (!isMe && p.inHand && (!p.folded || opened)){
      const ord = opened ? revealN++ : 0;   // 판이 끝나면 차례로 '뒤집기'
      hole = p.cards.map((c,k)=>opened ? cardHTML(c,{mini:true, animate:true, key:'sd'+s.handNo+':'+i+':', delay: 120 + ord*160 + k*60, hl:showAll&&winSet.has(i)&&winCards.has(c), dim: p.folded || (winSet.size && !winSet.has(i))}) : cardHTML('back')).join('');
    }
    let st = '';
    if (s.stage==='done' && winSet.has(i)) st = `+${fmt(s.winners.find(w=>w.s===i).amt)}`;
    else if (s.stage==='done' && p.shown && p.inHand) st = p.folded ? '폴드' : p.hn;
    else if (p.inHand && p.folded) st = '폴드';
    else if (p.allin && p.inHand) st = '올인';
    else if (!p.inHand && p.chips===0) st = view==='local' ? '탈락' : '칩 없음';
    else if (p.away) st = '연결 끊김';
    else if (p.sitOut) st = '자리 비움';
    else if (!p.inHand && s.stage!=='idle' && s.stage!=='done') st = '다음 핸드부터';
    const badge = s.stage!=='idle' && i===s.dealer ? '<span class="badge">D</span>' : '';
    const timer = acting && view==='online' ? `<div class="timer"><i data-deadline="${s.turnDeadline}"></i></div>` : '';
    const bub = ui.bubbles[p.id] && ui.bubbles[p.id].until > now ? `<div class="bubble${ui.bubbles[p.id].emo?' emo':''}${y < 30 ? ' below' : ''}" data-bub="${esc(p.id)}"></div>` : '';
    seatsHTML += `<div class="${cls}" data-si="${i}" style="left:${x}%;top:${y}%">${bub}
      ${isMe ? '' : `<div class="hole">${hole}</div>`}
      <div class="plate">${badge}<span class="nm" data-nm="${i}"></span><span class="ch num">${p.chips>0?chipOne(chipParts(p.chips)[0][0]):""}${fmt(p.chips)}</span>${st?`<span class="st">${esc(st)}</span>`:''}</div>${timer}</div>`;
    if (p.bet>0){ const [bx, by] = betPos(x, y, N>=7); chips += `<div class="betchip" data-x="${x}" data-y="${y}" style="left:${bx}%;top:${by}%">${chipStack(p.bet,{cols:2,maxPer:5})}<span class="amt num">${fmt(p.bet)}</span></div>`; }
  }
  const boardHTML = Array.from({length:5},(_,k)=>cardHTML(s.board[k], {animate:true, key:s.handNo+':', delay: 60 + (k<3 ? k*150 : 0), hl: showAll && winCards.has(s.board[k])})).join('');
  let result = '';
  if (s.stage==='done' && s.winners.length){
    result = s.winners.map(w=>`<span data-nm="${w.s}"></span> ${s.uncontested ? '승리' : '· ' + esc(w.h)}`).join(' / ');
  }
  const pot = s.stage==='done' ? s.winners.reduce((a,w)=>a+w.amt,0) : potSize(s);

  app.innerHTML = `${head}${statusLine}
  <div class="table${N>=7?' dense':''}${isWide()?' wide':''}">
    <div class="felt"></div>
    <div class="center">
      <span class="stage">${STAGE_KO[s.stage]||''}${s.handNo?` · #${s.handNo}`:''}</span>
      <div class="board">${boardHTML}</div>
      ${pot? `<span class="pot">${chipStack(pot,{cols:4,maxPer:7})}<span class="amt">팟 <b class="num">${fmt(pot)}</b></span></span>` : ''}
      <span class="result">${result}</span>
    </div>
    ${chips}${seatsHTML}${myIdx>=0 ? mySideHTML(s, s.seats[myIdx]) : ''}
  </div>
  ${renderDock(s, myIdx, now)}
  <ul class="log">${s.log.slice(-8).reverse().map(e=>`<li class="${e.i<0?'sys':''}">${e.i>=0?`<b data-lid="${esc(e.id)}" data-li="${e.i}" data-ln="${esc(e.n||'')}"></b> `:''}${esc(e.m)}</li>`).join('')}</ul>`;

  app.querySelectorAll('[data-nm]').forEach(el=>{ el.textContent = nameOf(s, +el.dataset.nm); });
  app.querySelectorAll('[data-li]').forEach(el=>{ el.textContent = logName(s, {i:+el.dataset.li, id:el.dataset.lid, n:el.dataset.ln}); });
  placeBets();
  app.querySelectorAll('[data-bub]').forEach(el=>{ const b = ui.bubbles[el.dataset.bub]; if (b) renderRich(el, b.text); });
  fitBubbles();
  const slider = document.getElementById('raise-range');
  const rin = document.getElementById('raise-in');
  if (slider) slider.addEventListener('input', e=>{ ui.raiseTo = +e.target.value; ui.raiseTyped = null; const b=document.getElementById('raise-go'); if (b) b.textContent = raiseLabel(s, myIdx, ui.raiseTo); if (rin) rin.value = ui.raiseTo.toLocaleString('en-US'); });
  if (rin){
    const Lr = legal(s, myIdx);
    const clamp = v => Math.max(Lr.minTo, Math.min(Lr.maxTo, v));
    rin.addEventListener('focus', ()=>{
      if (ui.raiseRestoring) return;
      const raw = String(ui.raiseTo); rin.value = raw; ui.raiseTyped = null;
      try { rin.select(); } catch(_){}
      setTimeout(()=>{ if (rin.value === raw) try { rin.select(); } catch(_){} }, 0); // 아이폰은 한 박자 뒤에 선택돼야 함
    });
    rin.addEventListener('input', ()=>{
      const digits = rin.value.replace(/[^0-9]/g, '').slice(0, 9); if (rin.value !== digits) rin.value = digits;
      ui.raiseTyped = digits;
      const v = clamp(+digits || 0); ui.raiseTo = v;
      if (slider) slider.value = v;
      const b = document.getElementById('raise-go'); if (b) b.textContent = raiseLabel(s, myIdx, v);
      rin.classList.toggle('bad', !!digits && +digits !== v);
    });
    rin.addEventListener('blur', ()=>{ ui.raiseTyped = null; rin.classList.remove('bad'); rin.value = ui.raiseTo.toLocaleString('en-US'); });
    rin.addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); rin.blur(); } });
    if (ui.raiseFocus && ui.raiseKeep != null){ ui.raiseRestoring = true; rin.focus({preventScroll:true}); ui.raiseRestoring = false; rin.value = ui.raiseKeep; ui.raiseTyped = ui.raiseKeep; try { rin.setSelectionRange(rin.value.length, rin.value.length); } catch(_){} rin.classList.toggle('bad', !!ui.raiseTyped && +ui.raiseTyped !== ui.raiseTo); }
  }
  tickTimers();
  mountFaces(app);
  placeQuickChat();
  // 이름 입력 중 화면이 갱신돼도 입력이 끊기지 않게
  if (ui.renameOpen && ui.renameFocus){ const r = document.getElementById('rename-in'); if (r){ r.focus(); const n = r.value.length; try { r.setSelectionRange(n, n); } catch(_){} } }
}

// 말풍선이 화면 밖으로 나가지 않게 옆으로 밀고, 꼬리는 계속 그 사람을 가리키게
function fitBubbles(){
  const W = document.documentElement.clientWidth, pad = 6;
  app.querySelectorAll('.bubble').forEach(el=>{
    // 애니메이션 중 크기 변화와 무관하게, 실제 폭(offsetWidth)과 자리 가운데로 계산
    const seat = el.parentElement.getBoundingClientRect(), cx = seat.left + seat.width/2, w = el.offsetWidth;
    const left = cx - w/2, right = cx + w/2;
    let sh = 0;
    if (left < pad) sh = pad - left; else if (right > W - pad) sh = (W - pad) - right;
    el.style.setProperty('--shift', sh + 'px');
  });
}
// 이모티콘 줄 밑 작은 채팅 칸. 테이블은 턴마다 다시 그려지므로, 입력이 끊기지 않게 테이블 밖에 두고 위치만 맞춤
const qchat = (()=>{
  const f = document.createElement('form');
  f.className = 'qchat'; f.id = 'qchat-form'; f.hidden = true; f.noValidate = true; f.autocomplete = 'off';
  f.innerHTML = `<button type="button" class="qchat-open" aria-label="채팅 입력하기"><span class="emo-t">💬</span><span>채팅</span></button>
    <input id="qchat-in" name="search_qchat_msg" type="text" maxlength="200" placeholder="메시지" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore enterkeyhint="send" aria-label="채팅 메시지">
    <button type="submit" class="qchat-send" aria-label="보내기">↑</button>`;
  document.body.appendChild(f);
  const inp = f.querySelector('input');
  const open = () => { f.classList.add('open'); inp.focus(); };
  f.querySelector('.qchat-open').addEventListener('click', open);
  inp.addEventListener('blur', () => setTimeout(() => { if (!inp.value.trim() && document.activeElement !== inp) f.classList.remove('open'); }, 120));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const t = cleanChat(inp.value); if (!t) { inp.focus(); return; }
    if (view === 'online') { if (sendChat(t)) inp.value = ''; }
    else { localBubble(t); inp.value = ''; }
    inp.focus();
  });
  return f;
})();
function placeQuickChat(){
  const strip = (view==='local' || view==='online') ? app.querySelector('.emostrip') : null;
  if (!strip){ qchat.hidden = true; return; }
  const r = strip.getBoundingClientRect();
  qchat.hidden = false;
  qchat.style.left = (r.left + scrollX) + 'px';
  qchat.style.top = (r.bottom + scrollY + 5) + 'px';
  qchat.style.width = Math.max(r.width, 118) + 'px';
}
// 내 자리 왼쪽: 이모티콘 3개 + 더보기(+) / 오른쪽: 내 칩 종류별 더미
function mySideHTML(s, p){
  const quick = EMOJIS.slice(0, 3).map(e=>`<button data-a="emo-send" data-v="${e}" aria-label="${e} 보내기">${emojiHTML(e)}</button>`).join('');
  const all = ui.emoOpen ? `<div class="emo-all" role="listbox" aria-label="이모티콘 전체">${EMOJIS.map(e=>`<button data-a="emo-send" data-v="${e}" aria-label="${e} 보내기">${emojiHTML(e)}</button>`).join('')}</div>` : '';
  return `<div class="emostrip">${quick}<button class="more${ui.emoOpen?' on':''}" data-a="emo-toggle" aria-label="이모티콘 전체 보기" aria-expanded="${!!ui.emoOpen}">${ui.emoOpen?'×':'+'}</button></div>${all}
    <div class="mytray" aria-label="내 칩">${chipTray(p.chips, s.startChips||START_CHIPS, p.id)}</div>`;
}
function raiseLabel(s, i, to){ const p=s.seats[i]; if (to >= p.bet+p.chips) return `올인 ${fmt(to)}`; return `${s.currentBet===0?'베팅':'레이즈'} ${fmt(to)}`; }

function inviteBox(s){
  // 게임이 시작되면 숨김 (위쪽 ‘초대 링크’ 버튼은 계속 사용 가능)
  if (view!=='online' || net.role!=='host' || !net.room || !net.mq || !net.mq.connected || s.stage!=='idle') return '';
  return `<div class="tablecode">초대 링크 <span class="num" id="invite-url" style="font-size:12px;letter-spacing:0;word-break:break-all;min-width:0">${esc(inviteLink())}</span><button class="ghost" data-a="invite">보내기</button></div>`;
}

/* ---------- 추천플레이 (초보자용, 플랍·턴·리버) ---------- */
ui.adviceOpen = store('holdem.advice') === '1';
const adviceCache = new Map();
// 다음 카드로 족보가 좋아질 확률(정확히 계산)과 아웃츠
function improveInfo(hole, board){
  if (board.length >= 5) return null;
  const cur = best(hole.concat(board)).cat;
  const used = new Set(hole.concat(board)), rest = FULL.filter(c=>!used.has(c));
  const outs = {};
  for (const c of rest){ const k = best(hole.concat(board, [c])).cat; if (k > cur) outs[k] = (outs[k]||0) + 1; }
  let better = 0, total = 0;
  if (board.length === 3){            // 턴+리버 두 장을 모두 따져서 리버까지 좋아질 확률
    for (let i=0;i<rest.length;i++) for (let j=i+1;j<rest.length;j++){ total++; if (best(hole.concat(board, [rest[i], rest[j]])).cat > cur) better++; }
  } else { total = rest.length; better = Object.values(outs).reduce((a,b)=>a+b, 0); }
  const list = Object.entries(outs).map(([k,n])=>[+k, n]).sort((a,b)=>b[0]-a[0]);
  return {p: better/total, outs: list, nextCards: rest.length};
}
function adviceFor(s, mi){
  const p = s.seats[mi], L = legal(s, mi);
  const opp = idxs(s, (q,i)=>i!==mi && q.inHand && !q.folded).length;
  const key = [p.cards.join(''), s.board.join(''), opp].join('|');
  let a = adviceCache.get(key);
  if (!a){
    const eq = opp ? equity(p.cards, s.board, opp, 500) : 1;
    a = {eq, opp, imp: improveInfo(p.cards, s.board), cat: best(p.cards.concat(s.board)).cat};
    adviceCache.set(key, a); if (adviceCache.size > 40) adviceCache.delete(adviceCache.keys().next().value);
  }
  const pot = potSize(s), call = L.callAmt, need = call > 0 ? call / (pot + call) : 0;
  const pct = x => (x*100 >= 10 ? Math.round(x*100) : (x*100).toFixed(1)) + '%';
  const draw = a.imp && a.imp.p >= .3;
  const bbAmt = s.bb || BB, round = v => Math.max(bbAmt, Math.round(v / 10) * 10);
  let act, why, tone;
  if (L.canCheck){
    if (a.eq >= .65){ act = `베팅 ${fmt(round(pot*.6))}`; tone='bet'; why = `이길 확률이 ${pct(a.eq)}로 높아요. 팟의 절반~¾ 정도 베팅해서 칩을 더 받아내세요.`; }
    else if (a.eq >= .48){ act = `작게 베팅 ${fmt(round(pot*.35))}`; tone='bet'; why = `괜찮은 패예요(이길 확률 ${pct(a.eq)}). 팟의 ⅓ 정도로 작게 베팅하거나 체크해도 좋아요.`; }
    else if (draw){ act = '체크'; tone='check'; why = `지금은 약하지만 ${s.board.length===3?'리버까지':'다음 카드에서'} 족보가 좋아질 확률이 ${pct(a.imp.p)}예요. 공짜로 다음 카드를 보세요.`; }
    else { act = '체크'; tone='check'; why = `아직 약한 패예요(이길 확률 ${pct(a.eq)}). 공짜면 체크하고, 상대가 크게 베팅하면 접는 게 좋아요.`; }
  } else {
    if (a.eq >= .7 && L.canRaise){ act = '레이즈'; tone='bet'; why = `이길 확률 ${pct(a.eq)}로 아주 강해요. 레이즈해서 팟을 키우세요.`; }
    else if (a.eq >= need + .05){ act = `콜 ${fmt(call)}`; tone='call'; why = `이길 확률 ${pct(a.eq)}가 콜에 필요한 승률 ${pct(need)}보다 높아서, 길게 보면 이득이에요.`; }
    else if (draw && s.board.length < 5 && a.eq >= need - .04){ act = `콜 ${fmt(call)}`; tone='call'; why = `지금 승률(${pct(a.eq)})은 필요한 만큼(${pct(need)})에 조금 못 미치지만, 좋아질 확률이 ${pct(a.imp.p)}라 콜해볼 만해요.`; }
    else { act = '폴드'; tone='fold'; why = `이길 확률 ${pct(a.eq)}로는 ${fmt(call)}을 내기엔 손해예요(필요한 승률 ${pct(need)}). 접고 다음 판을 노리세요.`; }
  }
  return {...a, act, why, tone, need, call, pct};
}
function adviceShown(s, mi){ const p = s.seats[mi]; return !!(p && s.board.length && BETTING.has(s.stage) && p.inHand && !p.folded && !p.allin); }
// 족보 이름 옆에 붙는 작은 '추천플레이' 버튼
function adviceChip(s, mi){
  if (!adviceShown(s, mi)) return '';
  return `<button class="adv-chip${ui.adviceOpen?' on':''}" data-a="advice" aria-label="추천플레이 ${ui.adviceOpen?'접기':'펼치기'}" aria-expanded="${!!ui.adviceOpen}"><span class="emo-t">💡</span>추천<span class="adv-caret">${ui.adviceOpen?'▴':'▾'}</span></button>`;
}
function adviceHTML(s, mi){
  const p = s.seats[mi];
  if (!adviceShown(s, mi) || !ui.adviceOpen) return '';
  const head = '';
  const a = adviceFor(s, mi);
  const mine = s.toAct === mi;
  const eqW = Math.round(a.eq*100), needL = Math.round(a.need*100);
  const outs = a.imp && a.imp.outs.length ? `<div class="adv-row"><span>다음 카드 한 장으로 될 수 있는 족보</span><b>${a.imp.outs.slice(0,3).map(([k,n])=>`${HAND[k]==='스트레이트 플러시' ? '스트레이트 플러시' : HAND[k]} ${n}장`).join(' · ')}</b> <span class="adv-sub">(남은 ${a.imp.nextCards}장 중)</span></div>` : '';
  const imp = a.imp ? `<div class="adv-row"><span>${s.board.length===3 ? '리버까지 족보가 좋아질 확률' : '리버에서 족보가 좋아질 확률'}</span><b>${a.pct(a.imp.p)}</b></div>` : '';
  const street = {3:'플랍', 4:'턴', 5:'리버'}[s.board.length];
  return `<div class="advice open">${head}
    <div class="adv-body"><div class="adv-title">💡 추천플레이 <span>${street}</span></div>
      <div class="adv-rec ${a.tone}"><span class="adv-label">${mine ? '추천' : '내 차례가 오면'}</span><b>${a.act}</b></div>
      <p class="adv-why">${a.why}</p>${boardNote(p.cards, s.board)}
      <div class="adv-bar" aria-label="이길 확률 ${eqW}%"><i style="width:${eqW}%"></i>${a.call>0 ? `<em style="left:${needL}%" title="필요한 승률"></em>` : ''}</div>
      <div class="adv-legend"><span>이길 확률 <b>${a.pct(a.eq)}</b> (상대 ${a.opp}명)</span>${a.call>0 ? `<span><em></em>콜에 필요한 승률 <b>${a.pct(a.need)}</b></span>` : ''}</div>
      ${imp}${outs}
      <p class="adv-note">상대 패를 모른다고 보고 계산한 참고용 확률이에요.</p>
    </div></div>`;
}

// 판이 끝난 뒤 전원 카드·족보 비교표
function resultHTML(s, mi){
  if (s.stage!=='done') return '';
  const won = {}; (s.winners||[]).forEach(w=>{ won[w.s] = (won[w.s]||0) + w.amt; });
  const rows = [];
  s.seats.forEach((p,i)=>{ if (p && p.inHand && p.cards && p.cards.length===2 && p.cards[0]!=='back') rows.push({i, p, w: won[i]||0}); });
  if (rows.length<2) return '';
  const rank = r => r.w ? 0 : r.p.folded ? 2 : 1;
  rows.sort((a,b)=> rank(a)-rank(b) || b.w-a.w || (b.p.sc||0)-(a.p.sc||0));
  const winHands = new Set(rows.filter(r=>r.w).map(r=>r.i));
  const body = rows.map(r=>{
    const res = r.w ? `<b class="res-win num">+${fmt(r.w)}</b>` : r.p.folded ? `<span class="res-fold">폴드</span>` : `<span class="res-lose">패배</span>`;
    const hn = r.p.hn ? esc(r.p.hn) : '';
    return `<tr class="${r.w?'w':''}${r.p.folded?' f':''}${r.i===mi?' me':''}"><td class="res-nm"><span data-nm="${r.i}"></span>${r.i===mi?' <small>(나)</small>':''}</td><td class="res-cards">${r.p.cards.map(c=>cardHTML(c,{mini:true, dim:r.p.folded})).join('')}</td><td class="res-hn">${hn}</td><td class="res-out">${res}</td></tr>`;
  }).join('');
  const note = s.uncontested ? '<p class="res-note">모두 폴드해서 끝난 판이에요. 공개된 카드는 참고용이에요.</p>' : '';
  return `<div class="result"><div class="res-title">이번 핸드 결과</div><table class="res-table"><thead><tr><th>플레이어</th><th>카드</th><th>족보</th><th>결과</th></tr></thead><tbody>${body}</tbody></table>${note}</div>`;
}
function renderDock(s, mi, now){
  if (mi<0){
    const full = s.seats.every(Boolean);
    return `<div class="dock"><p class="status">${full ? '자리가 다 찼어요. 관전 중이에요.' : '빈 자리를 눌러 앉으면 다음 핸드부터 참여해요.'}</p></div>`;
  }
  const p = s.seats[mi];
  const inPlay = p.inHand && !p.folded;
  const b = inPlay && s.board.length>=3 ? best(p.cards.concat(s.board)) : null;
  let handTxt = '';
  if (p.inHand && p.cards.length){
    if (b){ const mh = myHand(p.cards, s.board); handTxt = mh ? handName(mh) : HAND[0]; }
    else if (p.cards[0][0]===p.cards[1][0]) handTxt = '포켓 페어';
    else handTxt = p.cards[0][1]===p.cards[1][1] ? '수딧' : '오프수트';
    if (p.folded) handTxt = '폴드함';
  }
  const holes = p.inHand && p.cards.length ? p.cards.map(c=>cardHTML(c,{animate:true,key:s.handNo+'m', dim:p.folded})).join('') : cardHTML(null)+cardHTML(null);
  const mine = `<div class="mine"><div class="hole">${holes}</div><div class="info"><span class="hand">${esc(handTxt || (s.stage==='idle'?'대기 중':'이번 핸드 관전'))}${HAND_INFO[handTxt] ? `<button class="info-btn${ui.infoOpen?' on':''}" data-a="info" aria-label="${handTxt} 뜻 보기" aria-expanded="${!!ui.infoOpen}">i</button>` : ''}${adviceChip(s, mi)}</span>${p.inHand && !p.folded ? handRankHTML(handTxt) : ''}<span class="sub">칩 <b class="num">${fmt(p.chips)}</b>${p.bet?` · 이번 라운드 베팅 <span class="num">${fmt(p.bet)}</span>`:''}</span></div></div>`;

  let controls = '';
  if (BETTING.has(s.stage) && s.toAct===mi){
    const L = legal(s, mi);
    const key = `${s.handNo}-${s.stage}-${s.currentBet}-${p.bet}`;
    if (ui.raiseKey!==key){ ui.raiseKey=key; ui.raiseOpen=false; ui.raiseTo=L.minTo; }
    ui.raiseTo = Math.max(L.minTo, Math.min(ui.raiseTo, L.maxTo));
    const callTxt = L.canCheck ? '체크' : (L.callAmt>=p.chips ? `올인 ${fmt(L.callAmt)}` : `콜 ${fmt(L.callAmt)}`);
    if (!(ui.raiseOpen && L.canRaise)) controls = `<div class="actions">
      <button class="act fold" data-a="fold">폴드</button>
      <button class="act call" data-a="${L.canCheck?'check':'call'}">${callTxt}</button>
      <button class="act raise" data-a="raise-open" ${L.canRaise?'':'disabled'}>${s.currentBet===0?'베팅':'레이즈'}</button>
    </div>`;
    if (ui.raiseOpen && L.canRaise){
      const potNow = potSize(s);
      const half = s.currentBet + Math.round((potNow+L.callAmt)/2/10)*10;
      const full = s.currentBet + Math.round((potNow+L.callAmt)/10)*10;
      const step = L.maxTo - L.minTo >= 10 ? 10 : 1;
      const clampV = v => Math.max(L.minTo, Math.min(L.maxTo, v));
      controls = `<div class="raisebox">
        <div class="rb-top">
          <button class="rb-x" data-a="raise-open" aria-label="취소">✕</button>
          <label class="rb-amt"><span>$</span><input id="raise-in" class="num" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${ui.raiseTo.toLocaleString('en-US')}" aria-label="금액 직접 입력 (최소 ${fmt(L.minTo)}, 최대 ${fmt(L.maxTo)})"></label>
          <button class="primary rb-go" id="raise-go" data-a="raise-go">${raiseLabel(s, mi, ui.raiseTo)}</button>
        </div>
        <input id="raise-range" type="range" min="${L.minTo}" max="${L.maxTo}" step="${step}" value="${ui.raiseTo}" aria-label="레이즈 금액">
        <div class="presets">
          <button data-a="preset" data-v="${L.minTo}">최소</button>
          <button data-a="preset" data-v="${clampV(half)}">½ 팟</button>
          <button data-a="preset" data-v="${clampV(full)}">팟</button>
          <button data-a="preset" data-v="${L.maxTo}">올인</button>
        </div>
        <p class="rb-hint">숫자를 눌러 직접 입력 · ${fmt(L.minTo)} ~ ${fmt(L.maxTo)}</p>
      </div>`;
    }
  } else if (BETTING.has(s.stage)){
    controls = `<p class="status"><b data-nm="${s.toAct}"></b> 차례${view==='online'?` · <span data-count="${s.turnDeadline}"></span>`:'…'}</p>`;
  } else if (s.stage==='done'){
    const over = view==='local' && localGameOver(s);
    if (over) controls = over;
    else if (view==='local') controls = `<button class="primary" data-a="next-local">다음 핸드</button>`;
    else controls = `<p class="status">다음 핸드 <span data-count="${s.nextHandAt}"></span></p>`;
  } else if (s.stage==='idle'){
    const ready = idxs(s, q=>!q.sitOut && !q.away && q.chips>0).length;
    controls = view==='online'
      ? (ready>=2 ? `<button class="primary" data-a="start-online">게임 시작 (${ready}명)</button>` : `<p class="status">2명 이상 앉으면 시작할 수 있어요. 친구에게 초대 링크를 보내주세요.</p>`)
      : '';
  }
  let extra = '';
  if (view==='online'){
    const btns = [];
    if (p.sitOut) btns.push(`<button class="ghost" data-a="sitback">자리로 돌아오기</button>`);
    if (p.chips===0 && (!p.inHand || s.stage==='done' || s.stage==='idle')) btns.push(`<button class="ghost" data-a="rebuy">${fmt(s.startChips||START_CHIPS)}칩 다시 받기</button>`);
    btns.push(`<button class="ghost" data-a="rename-open">이름 변경</button>`);
    if (net.role!=='host') btns.push(`<button class="ghost" data-a="stand">자리에서 일어나기</button>`);
    extra = `<div class="row">${btns.join('')}</div>`;
    if (net.role==='host'){
      const N = s.seats.length, seated = s.seats.filter(Boolean).length, busy = BETTING.has(s.stage);
      extra += `<div class="seatsize"><span>최대 인원</span>
        <div class="stepper"><button data-a="seats-" aria-label="인원 줄이기" ${busy||N<=Math.max(MIN_SEATS,seated)?'disabled':''}>−</button><span class="num">${N}</span><span>명</span><button data-a="seats+" aria-label="인원 늘리기" ${busy||N>=MAX_SEATS?'disabled':''}>+</button></div>
        <span class="note">${busy ? '이번 핸드가 끝나면 바꿀 수 있어요' : `지금 ${seated}명 앉아 있어요`}</span></div>`;
    }
    if (ui.renameOpen){
      extra += `<form class="row" id="rename-form" novalidate autocomplete="off">
        <input id="rename-in" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(ui.renameDraft ?? (p.name || me.name))}" aria-label="새 이름" name="search_nick_new" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore enterkeyhint="done">
        <button class="primary" type="submit">저장</button></form>`;
    }
  }
  const pop = ui.infoOpen && HAND_INFO[handTxt] ? infoPopHTML(handTxt) : '';
  return `<div class="dock">${pop}${resultHTML(s, mi)}${mine}${adviceHTML(s, mi)}${controls}${extra}${inviteBox(s)}</div>`;
}

function localGameOver(s){
  const mine = s.seats[0];
  const botsLeft = idxs(s,(p,i)=>i>0 && p.chips>0).length;
  if (mine.chips===0) return `<div class="over"><h3>칩을 모두 잃었어요</h3><p class="note">${s.handNo}핸드를 버텼어요.</p><button class="primary" data-a="start-local">새 게임</button></div>`;
  if (botsLeft===0) return `<div class="over"><h3>우승!</h3><p class="note">${s.handNo}핸드 만에 모든 칩을 가져왔어요.</p><button class="primary" data-a="start-local">새 게임</button></div>`;
  return '';
}

function tickTimers(){
  const now = Date.now();
  app.querySelectorAll('[data-deadline]').forEach(el=>{ const left = Math.max(0, +el.dataset.deadline - now); el.style.width = (left/TURN_MS*100)+'%'; });
  app.querySelectorAll('[data-count]').forEach(el=>{ const left = Math.max(0, Math.ceil((+el.dataset.count - now)/1000)); el.textContent = `${left}초`; });
}

/* ---------- 족보·규칙 시트 ---------- */
function openRules(){
  const cur = currentState(); const SBv = cur && cur.sb || blindsOf(chipChoice).sb, BBv = cur && cur.bb || blindsOf(chipChoice).bb;
  const ex = [
    ['로열 플러시','같은 무늬 A·K·Q·J·10',['As','Ks','Qs','Js','Ts']],
    ['스트레이트 플러시','같은 무늬 연속 5장',['9h','8h','7h','6h','5h']],
    ['포카드','같은 숫자 4장',['Qs','Qh','Qd','Qc','7s']],
    ['풀 하우스','트리플 + 원 페어',['Ks','Kh','Kd','4c','4s']],
    ['플러시','같은 무늬 5장',['Ad','Jd','8d','6d','2d']],
    ['스트레이트','연속된 숫자 5장 (A-2-3-4-5 포함)',['Ts','9h','8d','7c','6s']],
    ['트리플','같은 숫자 3장',['7s','7h','7d','Kc','2s']],
    ['투 페어','페어 두 개',['Js','Jh','5d','5c','As']],
    ['원 페어','같은 숫자 2장',['9s','9h','Ad','Kc','4s']],
    ['하이카드','아무것도 없을 때 가장 높은 카드',['Ah','Js','8d','5c','3s']],
  ];
  document.getElementById('sheet').innerHTML = `<div class="sheet" data-a="close-sheet"><div class="inner" role="dialog" aria-label="족보와 규칙">
    <div class="row" style="justify-content:space-between"><h3>족보 · 규칙</h3><button class="ghost" data-a="close-sheet">닫기</button></div>
    <h4>핸드 순위</h4>
    <p class="note" style="margin:0 0 6px">확률: 7장(내 카드 2장 + 공용 카드 5장)으로 만든 최종 족보 기준</p>
    <div class="scroll"><table class="rank">${ex.map((e,k)=>`<tr><td>${k+1}</td><td><span class="nm">${e[0]}</span><br><span class="note">${e[1]}</span><br><span class="prob"><b>${HAND_INFO[e[0]].p}</b> · ${HAND_INFO[e[0]].once}</span></td><td><div class="ex">${e[2].map(c=>cardHTML(c,{mini:true})).join('')}</div></td></tr>`).join('')}</table></div>
    <h4>진행 순서</h4>
    <div class="flow"><div><b>프리플랍</b><span>개인 2장</span></div><div><b>플랍</b><span>공용 3장</span></div><div><b>턴</b><span>공용 1장</span></div><div><b>리버</b><span>공용 1장</span></div><div><b>쇼다운</b><span>패 공개</span></div></div>
    <h4>규칙 요약</h4>
    <div class="scroll"><table class="defs">
      <tr><th>블라인드</th><td>딜러 왼쪽이 스몰 $${SBv}, 그다음이 빅 $${BBv}. 시작 금액이 $1,000이면 $10/$20, $10,000이면 $50/$100이에요. 2명일 땐 딜러가 스몰 블라인드를 내고 프리플랍에 먼저 액션해요.</td></tr>
      <tr><th>액션 순서</th><td>프리플랍은 빅 블라인드 다음 사람부터, 플랍 이후는 딜러 왼쪽부터 시계 방향.</td></tr>
      <tr><th>체크 / 콜</th><td>걸린 베팅이 없으면 넘기기(체크), 있으면 같은 금액 맞추기(콜).</td></tr>
      <tr><th>베팅 / 레이즈</th><td>최소 베팅은 $${BBv}. 레이즈는 직전 레이즈 폭 이상 올려야 해요. 노리밋이라 언제든 올인 가능.</td></tr>
      <tr><th>짧은 올인</th><td>최소 레이즈에 못 미치는 올인은 이미 액션한 사람에게 다시 레이즈할 기회를 주지 않아요(콜·폴드만).</td></tr>
      <tr><th>사이드 팟</th><td>올인한 사람은 자신이 낸 만큼까지만 가져갈 수 있고, 나머지는 별도 팟으로 나뉘어요.</td></tr>
      <tr><th>무승부</th><td>같은 패면 팟을 나눠요. 나누고 남는 칩은 딜러 왼쪽에 가까운 사람에게.</td></tr>
      <tr><th>온라인 시간</th><td>한 차례 ${TURN_MS/1000}초. 넘기면 자동 체크(불가능하면 폴드)하고 ‘자리 비움’이 돼요.</td></tr>
    </table></div>
  </div></div>`;
}

/* ================= 컴퓨터 대결 모드 ================= */
const BOT_NAMES = ['player1','player2','player3','player4','player5'];
const BOT_SEATS = {1:[3],2:[2,4],3:[2,3,4],4:[1,2,4,5],5:[1,2,3,4,5]};
function startLocal(){
  let s = emptyTable(6, chipChoice);
  s.level = botLevel;
  s.seats[0] = makeSeat('me', {name:'나', chips:s.startChips});
  BOT_SEATS[botCount].forEach((seat,k)=>{ s.seats[seat] = makeSeat('bot'+k, {name:BOT_NAMES[k], chips:s.startChips, bot:true, per:{style: Math.random()<.35 ? 'lag' : 'tag'}}); });
  view = 'local'; ui.seenCards = new Set(); ui.trays = {};
  localState = startHand(s, Date.now());
  afterLocal();
}
function afterLocal(){ render(); scheduleLocal(); }
function scheduleLocal(){
  clearTimeout(localTimer);
  const s = localState; if (view!=='local' || !s) return;
  if (BETTING.has(s.stage) && s.seats[s.toAct] && s.seats[s.toAct].bot){
    const who = s.toAct, hand = s.handNo;
    localTimer = setTimeout(()=>{
      if (view!=='local' || localState.toAct!==who || localState.handNo!==hand) return;
      const a = botDecide(localState, who);
      localState = act(localState, who, a, Date.now()) || act(localState, who, {type:'call'}, Date.now()) || act(localState, who, {type:'fold'}, Date.now());
      afterLocal();
    }, 650 + Math.random()*650 + Math.max(0, (ui.dealUntil||0) - performance.now()));
  }
}
function nextLocalHand(){ if (view!=='local' || localState.stage!=='done' || localGameOver(localState)) return; localState = startHand(localState, Date.now()); afterLocal(); }

/* ================= 온라인 모드 =================
   방장 기기가 딜러. 메시지는 공개 MQTT 중계 서버를 거치고,
   플레이어마다 따로 만든 키(ECDH P-256 → AES-GCM)로 암호화해서
   중계 서버나 다른 사람은 카드·채팅 내용을 볼 수 없음. */
const BROKERS = window.HOLDEM_BROKERS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const TOPIC_ROOT = 'yky-holdem/v1/';
const net = {mq:null, role:null, room:'', broker:0, hostPub:'', keys:null, key:null, myPub:'', peers:new Map(), state:null, hostState:null, tick:null, helloTimer:null, failT:null, status:'', hostStatus:'', gotState:false, token:null, sendQ:Promise.resolve(), chat:[], lastChat:{}};
const roomTopic = () => TOPIC_ROOT + net.room;

/* ---------- 아주 작은 MQTT 3.1.1 클라이언트 (WebSocket, QoS 0) ---------- */
const te = new TextEncoder(), td = new TextDecoder();
function mqStr(str){ const b = typeof str==='string' ? te.encode(str) : str; const o = new Uint8Array(2+b.length); o[0]=b.length>>8; o[1]=b.length&255; o.set(b,2); return o; }
function mqCat(...parts){ let n=0; parts.forEach(x=>n+=x.length); const o=new Uint8Array(n); let k=0; parts.forEach(x=>{ o.set(x,k); k+=x.length; }); return o; }
function mqPacket(type, body){ const len=[]; let n=body.length; do { let d=n%128; n=Math.floor(n/128); if (n>0) d|=128; len.push(d); } while(n>0); return mqCat(Uint8Array.of(type, ...len), body); }
class MiniMQTT {
  constructor(url, o){ this.url=url; this.o=o; this.subs=new Set(); this.queue=[]; this.connected=false; this.ended=false; this.buf=new Uint8Array(0); this.retry=0; this.open(); }
  open(){
    if (this.ended) return;
    let ws; try { ws = new WebSocket(this.url, ['mqtt']); } catch(_){ this.schedule(); return; }
    this.ws = ws; ws.binaryType = 'arraybuffer'; this.buf = new Uint8Array(0);
    ws.onopen = ()=>{ try { ws.send(this.pkConnect()); } catch(_){} };
    ws.onmessage = e=>{ if (this.ws===ws) this.feed(new Uint8Array(e.data)); };
    ws.onclose = ws.onerror = ()=>{
      if (this.ws!==ws) return; this.ws = null;
      const was = this.connected; this.connected = false; clearInterval(this.ping);
      if (was && this.o.onDown) this.o.onDown();
      this.schedule();
    };
  }
  schedule(){ if (this.ended) return; clearTimeout(this.rt); const d = Math.min(6000, 600*Math.pow(1.6, this.retry++)); this.rt = setTimeout(()=>this.open(), d); }
  kick(){ if (this.ended) return; if (this.connected){ this.raw(Uint8Array.of(0xC0,0)); return; } clearTimeout(this.rt); this.retry=0; if (this.ws){ const w=this.ws; this.ws=null; try{ w.close(); }catch(_){} } this.open(); }
  pkConnect(){
    let flags = 0x02; const pay = [mqStr(this.o.clientId)];
    if (this.o.will){ flags |= 0x04 | (this.o.will.retain ? 0x20 : 0); pay.push(mqStr(this.o.will.topic), mqStr(this.o.will.payload)); }
    return mqPacket(0x10, mqCat(mqStr('MQTT'), Uint8Array.of(4, flags, 0, 30), ...pay));
  }
  feed(chunk){
    this.buf = mqCat(this.buf, chunk);
    for(;;){
      const b = this.buf; if (b.length < 2) return;
      let len=0, mul=1, i=1, byte;
      do { if (i >= b.length) return; byte = b[i++]; len += (byte & 127)*mul; mul *= 128; } while (byte & 128);
      if (b.length < i+len) return;
      const head = b[0], body = b.slice(i, i+len); this.buf = b.slice(i+len);
      this.handle(head, body);
    }
  }
  handle(head, body){
    const type = head >> 4;
    if (type===2){                                   // CONNACK
      if (body[1]!==0){ try{ this.ws.close(); }catch(_){} return; }
      this.connected = true; this.retry = 0;
      if (this.subs.size) this.raw(this.pkSub([...this.subs]));
      const q = this.queue; this.queue = []; q.forEach(pk=>this.raw(pk));
      clearInterval(this.ping); this.ping = setInterval(()=>this.raw(Uint8Array.of(0xC0,0)), 20000);
      if (this.o.onConnect) this.o.onConnect();
    } else if (type===3){                            // PUBLISH
      const qos = (head>>1)&3, tl = (body[0]<<8)|body[1];
      const topic = td.decode(body.slice(2, 2+tl)), off = 2+tl+(qos?2:0);
      if (this.o.onMessage) this.o.onMessage(topic, td.decode(body.slice(off)));
    }
  }
  pkSub(topics){ const id = 1+randInt(65000); return mqPacket(0x82, mqCat(Uint8Array.of(id>>8, id&255), ...topics.map(t=>mqCat(mqStr(t), Uint8Array.of(0))))); }
  raw(pk){ try { if (this.ws && this.ws.readyState===1) this.ws.send(pk); } catch(_){} }
  subscribe(t){ this.subs.add(t); if (this.connected) this.raw(this.pkSub([t])); }
  publish(topic, str, retain){
    const pk = mqPacket(0x30 | (retain?1:0), mqCat(mqStr(topic), te.encode(str)));
    if (this.connected) this.raw(pk); else { this.queue.push(pk); if (this.queue.length>100) this.queue.shift(); }
  }
  end(){ this.ended = true; clearTimeout(this.rt); clearInterval(this.ping); this.raw(Uint8Array.of(0xE0,0)); const w=this.ws; this.ws=null; this.connected=false; setTimeout(()=>{ try{ w && w.close(); }catch(_){} }, 50); }
}

/* ---------- 암호화 ---------- */
const b64u = buf => { let s=''; new Uint8Array(buf).forEach(c=>s+=String.fromCharCode(c)); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const ub64u = str => { const s = String(str).replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(s + '==='.slice((s.length+3)%4)), c=>c.charCodeAt(0)); };
const EC = {name:'ECDH', namedCurve:'P-256'};
async function newKeys(){ const k = await crypto.subtle.generateKey(EC, true, ['deriveKey']); return {privateKey:k.privateKey, pub: b64u(await crypto.subtle.exportKey('raw', k.publicKey))}; }
async function guestKeys(){
  const saved = tabStore('holdem.gk');
  if (saved){ try { const j = JSON.parse(saved); return {privateKey: await crypto.subtle.importKey('jwk', j.priv, EC, true, ['deriveKey']), pub:j.pub}; } catch(_){} }
  const k = await crypto.subtle.generateKey(EC, true, ['deriveKey']);
  const pub = b64u(await crypto.subtle.exportKey('raw', k.publicKey));
  tabStore('holdem.gk', JSON.stringify({priv: await crypto.subtle.exportKey('jwk', k.privateKey), pub}));
  return {privateKey:k.privateKey, pub};
}
async function deriveKey(priv, pubStr){
  const pub = await crypto.subtle.importKey('raw', ub64u(pubStr), EC, false, []);
  return crypto.subtle.deriveKey({name:'ECDH', public:pub}, priv, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function sealBox(key, obj){ const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, te.encode(JSON.stringify(obj))); return b64u(iv)+'.'+b64u(ct); }
async function openBox(key, box){ const [a,b] = String(box).split('.'); const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:ub64u(a)}, key, ub64u(b)); return JSON.parse(td.decode(pt)); }
function genId(n){ const A='abcdefghijkmnpqrstuvwxyz23456789'; let c=''; for (let i=0;i<n;i++) c+=A[randInt(A.length)]; return c; }
const onlineSupported = () => !!(window.WebSocket && window.crypto && crypto.subtle);

/* ---------- 채팅 ---------- */
const EMOJIS = ['😀','😆','🤣','🤪','😜','😡','🤬','🤯','😵\u200d💫','😴','🤑','💩','👺','☠️','🤲','👏','🤝','👍','👎','✌️','👌','🖐️','🫵','🖕','🔥','🎰','💸','🚬','🪓','🔪','💣','📈','📉','‼️','⁉️','♣️','♥️','♦️','♠️','🃏'];
const CHAT_MAX = 60;
function cleanChat(t){ return String(t||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,200); }
// 방장만 실행: 메시지를 받아 모두에게 전달
function chatPost(pid, name, text){
  text = cleanChat(text); if (!text) return;
  const now = Date.now(); if (now - (net.lastChat[pid]||0) < 400) return; net.lastChat[pid] = now;
  const m = {pid, n: name, text, ts: now};
  for (const peer of net.peers.values()) sendTo(peer, {t:'chat', m});
  receiveChat(m);
}
function receiveChat(m){
  if (!m || !m.text) return;
  net.chat.push({pid:String(m.pid||''), n:cleanName(m.n), text:cleanChat(m.text), ts:+m.ts||Date.now()});
  if (net.chat.length > CHAT_MAX) net.chat.splice(0, net.chat.length - CHAT_MAX);
  renderChat(true);
  const life = bubbleLife(cleanChat(m.text));
  ui.bubbles[m.pid] = {text: cleanChat(m.text), until: Date.now() + life, emo: EMOJIS.includes(cleanChat(m.text))};
  if (view==='online') renderTable();
  setTimeout(()=>{ if (view==='online') renderTable(); }, life + 100);
}
// 이모티콘 바로 보내기: 온라인이면 채팅으로(모두에게 말풍선), 컴퓨터 대결이면 내 자리 말풍선만
// 말풍선이 떠 있는 시간: 길수록 오래 (4.5초 ~ 12초)
const bubbleLife = t => Math.min(12000, Math.max(4500, 2500 + [...String(t)].length * 90));
// 컴퓨터 대결에서는 채팅 대신 내 자리 말풍선만
function localBubble(text){
  const life = bubbleLife(text);
  ui.bubbles['me'] = {text, until: Date.now() + life, emo: EMOJIS.includes(text)};
  render(); setTimeout(()=>{ if (view==='local') render(); }, life + 100);
}
function sendEmoji(e){
  if (!EMOJIS.includes(e)) return;
  ui.emoOpen = false;
  if (view==='online') sendChat(e);
  else {
    localBubble(e);
  }
  if (view!=='online') return;
  render();
}
function sendChat(text){
  text = cleanChat(text); if (!text) return false;
  if (net.role==='host'){ chatPost(me.pid, me.name, text); return true; }
  return sendNet({t:'chat', text});
}
function renderChat(scroll){
  const box = document.getElementById('chatbox'); if (!box) return;
  const show = view==='online' && !!net.state;
  box.hidden = !show; if (!show) return;
  const list = document.getElementById('chat-list');
  list.textContent = '';
  if (!net.chat.length){ const li = document.createElement('li'); li.className = 'sys'; li.textContent = '아직 메시지가 없어요. 인사해 보세요 👋'; list.appendChild(li); }
  net.chat.forEach(m=>{
    const li = document.createElement('li'); if (m.pid===me.pid) li.className = 'mine';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = m.pid===me.pid ? '나' : m.n;
    const tx = document.createElement('span'); renderRich(tx, m.text);
    li.append(who, tx); list.appendChild(li);
  });
  if (scroll) list.scrollTop = list.scrollHeight;
}
function toggleEmojiPad(force){
  const pad = document.getElementById('emoji-pad'), btn = document.getElementById('emoji-btn');
  if (!pad.childElementCount) pad.innerHTML = EMOJIS.map(e=>`<button type="button" data-emo="${e}" aria-label="${e}">${emojiHTML(e)}</button>`).join('');
  const open = force!==undefined ? force : pad.hidden;
  pad.hidden = !open; btn.setAttribute('aria-expanded', String(open));
}
function insertEmoji(e){
  const inp = document.getElementById('chat-in');
  const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? inp.value.length;
  if ((inp.value.length - (b-a) + e.length) > 200) return;
  inp.value = inp.value.slice(0,a) + e + inp.value.slice(b);
  const pos = a + e.length; inp.focus(); try { inp.setSelectionRange(pos, pos); } catch(_){}
}

function roomFromURL(){
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    const r = h.get('r'), k = h.get('k'), b = +h.get('b')||0;
    if (r && /^[a-z0-9]{10}$/.test(r) && k && /^[A-Za-z0-9_-]{80,100}$/.test(k)) return {r, k, b: Math.max(0, Math.min(BROKERS.length-1, b))};
  } catch(_){}
  return null;
}
function setRoomURL(){ try { if (location.hash) history.replaceState(null, '', location.pathname + location.search); } catch(_){} }
function inviteLink(){ return `${location.origin}${location.pathname}#r=${net.room}&k=${net.hostPub}&b=${net.broker}`; }

// 상대에게 보내는 화면용 상태: 덱과 남의 카드는 숨김
function viewFor(s, pid){
  const v = clone(s); v.deck = [];
  const reveal = v.stage==='done';
  v.seats.forEach(p=>{
    if (!p || p.id===pid) return;
    if (reveal && p.shown) return;
    p.cards = p.inHand && !p.folded ? p.cards.map(()=> 'back') : [];
  });
  return v;
}

async function hostRoom(){
  closeNet();
  if (!onlineSupported()){ toast('이 브라우저에서는 온라인 대전을 할 수 없어요. 최신 크롬이나 사파리로 열어 주세요.'); return; }
  view = 'online'; net.role = 'host'; net.state = null; net.status = '중계 서버에 연결하는 중…'; ui.seenCards = new Set();
  const token = net.token = {};
  render();
  net.keys = await newKeys(); net.hostPub = net.keys.pub;
  if (net.token!==token) return;
  net.room = genId(10);
  const s = emptyTable(hostSeats, chipChoice); s.seats[0] = makeSeat(me.pid, {name: me.name, chips:s.startChips});
  logIt(s, 0, `방을 열었어요 (최대 ${hostSeats}명 · 칩 ${fmt(s.startChips)} · 블라인드 $${s.sb}/$${s.bb})`);
  net.hostState = s; net.state = viewFor(s, me.pid);
  net.tick = setInterval(hostTick, 1000);
  connectHost(0, token, 0);
  render();
}
function connectHost(bi, token, round){
  if (net.token!==token) return;
  net.broker = bi;
  const T = roomTopic();
  const mq = new MiniMQTT(BROKERS[bi], {
    clientId: 'h' + genId(14),
    will: {topic: T+'/status', payload: 'offline', retain: true},
    onConnect: ()=>{ if (net.mq!==mq) return; clearTimeout(net.failT); net.status = ''; mq.subscribe(T+'/host'); mq.publish(T+'/status', 'online', true); hostBroadcast(); },
    onDown: ()=>{ if (net.mq!==mq) return; net.status = '중계 서버 연결이 끊겨 다시 연결하는 중…'; render(); },
    onMessage: (topic, payload)=>{ if (net.mq===mq && topic===T+'/host') onHostMsg(payload); },
  });
  net.mq = mq;
  // 처음 연결이 안 되면 다음 중계 서버로 넘어감 (초대 링크에 어느 서버인지 들어감)
  clearTimeout(net.failT);
  net.failT = setTimeout(()=>{
    if (net.mq!==mq || mq.connected) return;
    mq.end();
    if (bi+1 < BROKERS.length) connectHost(bi+1, token, round);
    else { net.status = '중계 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. 계속 다시 시도하는 중…'; render(); connectHost(0, token, round+1); }
  }, 6500);
}
async function onHostMsg(raw){
  let d; try { d = JSON.parse(raw); } catch(_){ return; }
  if (!d || typeof d.pid!=='string' || !/^p[0-9a-f]{16}$/.test(d.pid)) return;
  const pid = d.pid;
  if (pid===me.pid) return;
  if (d.t==='bye'){ markAway(pid, true); return; }
  if (d.t==='hello'){
    if (typeof d.pub!=='string' || d.pub.length>120) return;
    let peer = net.peers.get(pid);
    if (peer && peer.pub!==d.pub) return;       // 같은 ID를 다른 키로 쓰는 경우(사칭) 무시
    try {
      const key = peer ? peer.key : await deriveKey(net.keys.privateKey, d.pub);
      const body = await openBox(key, d.box);
      if (!peer){ peer = {pid, pub:d.pub, key, q:Promise.resolve(), name:''}; net.peers.set(pid, peer); }
      peer.name = cleanName(body.name);
      hostWelcome(peer);
    } catch(_){}
    return;
  }
  if (d.t==='msg'){
    const peer = net.peers.get(pid); if (!peer) return;
    let m; try { m = await openBox(peer.key, d.box); } catch(_){ return; }
    if (!m || typeof m!=='object') return;
    markAway(pid, false);
    if (m.t==='chat'){ chatPost(pid, peer.name, m.text); return; }
    if (m.t==='rename') peer.name = cleanName(m.name);
    hostApply(pid, peer.name, m);
  }
}
function hostWelcome(peer){
  const n = clone(net.hostState);
  let i = n.seats.findIndex(p=>p && p.id===peer.pid);
  if (i>=0){ if (n.seats[i].away) logIt(n, i, '다시 연결됨'); n.seats[i].away = false; n.seats[i].name = peer.name; }
  else { i = n.seats.findIndex(p=>!p); if (i>=0){ n.seats[i] = makeSeat(peer.pid, {name: peer.name, chips:n.startChips||START_CHIPS}); logIt(n, i, '입장'); } }
  net.hostState = n; hostBroadcast();
  sendTo(peer, {t:'chatlog', list: net.chat.slice(-30)});
}
function markAway(pid, away){
  const s = net.hostState; if (!s) return;
  const i = s.seats.findIndex(p=>p && p.id===pid); if (i<0 || !!s.seats[i].away===away) return;
  const n = clone(s); n.seats[i].away = away; logIt(n, i, away ? '연결 끊김' : '다시 연결됨');
  net.hostState = n; hostBroadcast();
}
function sendTo(peer, obj){
  const T = roomTopic(), mq = net.mq;
  peer.q = peer.q.then(()=>sealBox(peer.key, obj)).then(box=>{ if (mq && net.mq===mq) mq.publish(T+'/p/'+peer.pid, box); }).catch(()=>{});
}
function hostApply(pid, name, d){
  const s = net.hostState; if (!s) return;
  const now = Date.now(); const i = s.seats.findIndex(p=>p && p.id===pid);
  let n = null;
  switch (d.t){
    case 'act': if (i>=0 && d.a && ['fold','check','call','raise'].includes(d.a.type)) n = act(s, i, {type:d.a.type, to:+d.a.to||0}, now); break;
    case 'sit': { const k = +d.seat; if (i<0 && k>=0 && k<s.seats.length && !s.seats[k]){ n = clone(s); n.seats[k] = makeSeat(pid, {name, chips:n.startChips||START_CHIPS}); logIt(n, k, '착석'); } break; }
    case 'resize': if (pid===me.pid && net.role==='host'){ n = resizeTable(s, +d.n); if (!n) toast(`지금 앉아 있는 ${s.seats.filter(Boolean).length}명보다 적게 줄일 수 없어요.`); } break;
    case 'stand': n = standState(s, i, now); break;
    case 'sitback': if (i>=0){ n = clone(s); n.seats[i].sitOut = false; } break;
    case 'rebuy': if (i>=0){ const p = s.seats[i]; const sc = s.startChips||START_CHIPS; if (p.chips===0 && !(p.inHand && BETTING.has(s.stage))){ n = clone(s); n.seats[i].chips = sc; n.seats[i].sitOut = false; logIt(n, i, `${fmt(sc)}칩 리바이`); } } break;
    case 'start': if (i>=0 && (s.stage==='idle' || s.stage==='done')){ n = startHand(s, now); if (n.stage==='idle') n = null; } break;
    case 'rename': if (i>=0){ n = clone(s); n.seats[i].name = cleanName(d.name); } break;
  }
  if (n){ net.hostState = n; hostBroadcast(); }
}
// 방장 전용: 최대 인원 변경 (핸드 진행 중에는 불가)
function resizeTable(s, n){
  n = Math.max(MIN_SEATS, Math.min(MAX_SEATS, n|0));
  if (BETTING.has(s.stage) || n===s.seats.length) return null;
  if (s.seats.filter(Boolean).length > n) return null;
  const c = clone(s);
  const seats = Array(n).fill(null), rest = [];
  c.seats.forEach((p,i)=>{ if (!p) return; if (i<n) seats[i] = p; else rest.push(p); });
  rest.forEach(p=>{ seats[seats.findIndex(x=>!x)] = p; });
  const moved = rest.length > 0;
  c.seats = seats;
  if (c.dealer >= n) c.dealer = -1;
  if (moved){ c.winners = []; c.seats.forEach(p=>{ if (p) p.shown = false; }); }
  logIt(c, -1, `방장이 최대 인원을 ${n}명으로 바꿨어요`);
  return c;
}
function standState(s, i, now){
  if (i<0) return null;
  const p = s.seats[i];
  if (BETTING.has(s.stage) && p.inHand && !p.folded){
    if (s.toAct===i){ const n = act(s, i, {type:'fold'}, now); n.seats[i].leaving = true; return n; }
    const n = clone(s); n.seats[i].folded = true; n.seats[i].leaving = true; logIt(n, i, '폴드 · 자리를 떠남');
    advance(n, (n.toAct+n.seats.length-1)%n.seats.length, now); return n;
  }
  const n = clone(s);
  if (BETTING.has(s.stage) && p.inHand) n.seats[i].leaving = true; else n.seats[i] = null;
  return n;
}
function hostBroadcast(){
  const s = net.hostState; if (!s) return;
  for (const peer of net.peers.values()) sendTo(peer, {t:'state', s: viewFor(s, peer.pid)});
  net.state = viewFor(s, me.pid);
  if (view==='online') render();
}
function hostTick(){
  tickTimers();
  const s = net.hostState; if (!s) return;
  const now = Date.now();
  if (BETTING.has(s.stage) && now > s.turnDeadline + 800){
    const i = s.toAct; const L = legal(s, i);
    const n = act(s, i, {type: L.canCheck ? 'check' : 'fold'}, now);
    if (n){ n.seats[i].sitOut = true; net.hostState = n; hostBroadcast(); }
  } else if (s.stage==='done' && now > s.nextHandAt){
    const ready = idxs(s, p=>!p.sitOut && !p.away && !p.leaving && p.chips>0);
    // 연결이 끊긴 사람은 다음 핸드에서 제외
    const s2 = clone(s); s2.seats.forEach(p=>{ if (p && p.away) p.sitOut = true; });
    net.hostState = ready.length>=2 ? startHand(s2, now) : Object.assign(s2, {stage:'idle'});
    hostBroadcast();
  }
}

async function joinRoom(info){
  closeNet();
  if (!onlineSupported()){ view='online'; net.status = '이 브라우저에서는 온라인 대전을 할 수 없어요. 최신 크롬이나 사파리로 열어 주세요.'; render(); return; }
  view = 'online'; net.role = 'guest'; net.room = info.r; net.broker = info.b; net.hostPub = info.k;
  net.state = null; net.gotState = false; net.hostStatus = ''; net.status = ''; ui.seenCards = new Set();
  const token = net.token = {};
  render();
  try { net.keys = await guestKeys(); net.myPub = net.keys.pub; net.key = await deriveKey(net.keys.privateKey, info.k); }
  catch(_){ net.status = '초대 링크가 올바르지 않아요. 방장에게 링크를 다시 받아 주세요.'; render(); return; }
  if (net.token!==token) return;
  const T = roomTopic(), started = Date.now();
  const sayHello = async ()=>{ const mq = net.mq; if (!mq || !mq.connected) return; const box = await sealBox(net.key, {name: me.name}); mq.publish(T+'/host', JSON.stringify({t:'hello', pid: me.pid, pub: net.myPub, box})); };
  const mq = new MiniMQTT(BROKERS[info.b] || BROKERS[0], {
    clientId: 'g' + genId(14),
    will: {topic: T+'/host', payload: JSON.stringify({t:'bye', pid: me.pid}), retain: false},
    onConnect: ()=>{ if (net.mq!==mq) return; mq.subscribe(T+'/p/'+me.pid); mq.subscribe(T+'/status'); sayHello(); },
    onDown: ()=>{ if (net.mq!==mq) return; net.status = '연결이 끊겨 다시 연결하는 중…'; render(); },
    onMessage: async (topic, payload)=>{
      if (net.mq!==mq) return;
      if (topic===T+'/status'){
        net.hostStatus = payload;
        if (payload==='online'){ if (!net.gotState) sayHello(); else if (net.status){ net.status=''; render(); } }
        else if (payload==='offline'){ net.status = '방장 연결이 잠시 끊겼어요. 방장이 게임 화면으로 돌아오면 이어서 해요.'; render(); }
        else if (payload==='closed'){ net.status = '방장이 방을 닫았어요.'; render(); }
        return;
      }
      let d; try { d = await openBox(net.key, payload); } catch(_){ return; }
      if (!d) return;
      if (d.t==='state'){ net.gotState = true; if (net.hostStatus!=='offline' && net.hostStatus!=='closed') net.status = ''; net.state = d.s; render(); }
      else if (d.t==='chat') receiveChat(d.m);
      else if (d.t==='chatlog' && Array.isArray(d.list)){ net.chat = []; d.list.slice(-CHAT_MAX).forEach(m=>{ if (m && m.text) net.chat.push({pid:String(m.pid||''), n:cleanName(m.n), text:cleanChat(m.text), ts:+m.ts||0}); }); renderChat(true); }
    },
  });
  net.mq = mq;
  // 방장 응답이 올 때까지 4초마다 다시 인사
  net.helloTimer = setInterval(()=>{
    if (net.mq!==mq || net.gotState) return;
    sayHello();
    if (Date.now()-started > 9000 && net.hostStatus!=='closed'){
      net.status = !mq.connected ? '중계 서버에 연결하는 중이에요. 인터넷 연결을 확인해 주세요.'
        : net.hostStatus==='offline' ? '방장 연결이 잠시 끊겼어요. 방장이 게임 화면으로 돌아오면 바로 입장돼요.'
        : '방장의 응답을 기다리는 중이에요. 방장 기기에서 게임 화면이 켜져 있는지 확인해 주세요.';
      render();
    }
  }, 4000);
  net.tick = setInterval(tickTimers, 1000);
}
function closeNet(){
  clearInterval(net.tick); clearInterval(net.helloTimer); clearTimeout(net.failT);
  const mq = net.mq;
  if (mq){
    const T = roomTopic();
    try { if (net.role==='host') mq.publish(T+'/status', 'closed', true); else mq.publish(T+'/host', JSON.stringify({t:'bye', pid: me.pid})); } catch(_){}
    setTimeout(()=>mq.end(), 250);
  }
  Object.assign(net, {mq:null, token:null, peers:new Map(), hostState:null, state:null, key:null, keys:null, gotState:false, hostStatus:'', status:'', tick:null, helloTimer:null, sendQ:Promise.resolve()});
  net.chat = []; net.lastChat = {}; ui.bubbles = {}; ui.trays = {};
  const ci = document.getElementById('chat-in'); if (ci) ci.value = '';
  const qi = document.getElementById('qchat-in'); if (qi){ qi.value = ''; qchat.classList.remove('open'); }
  const pad = document.getElementById('emoji-pad'); if (pad) pad.hidden = true;
}
function sendNet(d){
  if (net.role==='host'){ hostApply(me.pid, me.name, d); return true; }
  const mq = net.mq;
  if (!mq || !net.key){ toast('방장과 연결되어 있지 않아요.'); return false; }
  const T = roomTopic();
  net.sendQ = net.sendQ.then(()=>sealBox(net.key, d)).then(box=>mq.publish(T+'/host', JSON.stringify({t:'msg', pid: me.pid, box}))).catch(()=>{});
  if (!mq.connected) toast('연결이 잠시 끊겼어요. 다시 연결되면 전송돼요.');
  return true;
}
// 휴대폰에서 다른 앱에 다녀오면 바로 다시 연결
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden && net.mq) net.mq.kick(); });

async function shareInvite(){
  if (!net.mq || !net.mq.connected || !net.room){ toast('중계 서버에 연결되면 초대 링크를 보낼 수 있어요. 잠시만 기다려 주세요.'); return; }
  const url = inviteLink();
  if (navigator.share){ try { await navigator.share({title:'홀덤 테이블 초대', text:'같이 홀덤 해요! 링크를 열면 바로 자리에 앉아요.', url}); return; } catch(e){ if (e && e.name==='AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어요.'); }
  catch(_){ const el = document.getElementById('invite-url'); if (el){ const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } toast('링크를 길게 눌러 복사하세요.'); }
}
function leaveToLobby(){ closeNet(); clearTimeout(localTimer); view='lobby'; setRoomURL(null); render(); }

/* ================= 이벤트 ================= */
/* ================= 소리: 배경음악 + 효과음 =================
   배경음악 audio/lounge.mp3 는 이 앱용으로 직접 작곡·합성한 곡 (tools/music-compose.js), 효과음은 아래 코드가 그 자리에서 합성
   → 외부 음원을 쓰지 않아 저작권 걱정 없음 */
const snd = { on: store('holdem.sound') === '1', ctx: null, master: null, music: null, sfx: null, buf: null, src: null, rendering: null, seen: null };
const SOUND_ICON = on => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 17.5V6.2l10-2.2v11.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><ellipse cx="6.6" cy="17.6" rx="2.6" ry="2.1" fill="currentColor"/><ellipse cx="16.6" cy="15.4" rx="2.6" ry="2.1" fill="currentColor"/>${on ? '' : '<path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'}</svg>`;
function soundBtn(){ return `<button class="ghost snd-btn${snd.on ? ' on' : ''}" data-a="sound" aria-pressed="${snd.on}" aria-label="${snd.on ? '소리 끄기' : '소리 켜기'}" title="${snd.on ? '소리 끄기' : '소리 켜기'}">${SOUND_ICON(snd.on)}</button>`; }

function audioReady(){
  if (snd.ctx && snd.ctx.state === 'closed'){ snd.ctx = null; snd.src = null; }
  if (!snd.ctx){
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(_){} // 아이폰 무음 스위치여도 들리게
    snd.ctx = new AC();
    snd.master = snd.ctx.createGain(); snd.master.gain.value = 1; snd.masterV = 1; snd.master.connect(snd.ctx.destination);
    snd.music = snd.ctx.createGain(); snd.music.gain.value = 0; snd.music.connect(snd.master);
    snd.sfx = snd.ctx.createGain(); snd.sfx.gain.value = .8; snd.sfx.connect(snd.master);
    // 다른 앱 다녀온 뒤 아이폰이 오디오를 다시 살려주면 음악 이어서
    snd.ctx.onstatechange = ()=>{ if (snd.ctx && snd.ctx.state === 'running' && snd.on && !document.hidden) syncMusic(); };
  }
  if (snd.ctx.state !== 'running' && !document.hidden) snd.ctx.resume().catch(()=>{}); // suspended·interrupted 모두
  return snd.ctx;
}
function toggleSound(){
  snd.on = !snd.on; store('holdem.sound', snd.on ? '1' : '0');
  if (snd.on){ audioReady(); melUnlock(); syncMusic(); sfx.tick(); }
  else melStop(false);
  render();
}
const inGame = () => view === 'local' || view === 'online';
function masterTo(v, dur){
  if (!snd.ctx) return; const g = snd.master.gain, t = snd.ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(snd.masterV == null ? 1 : snd.masterV, t); g.linearRampToValueAtTime(v, t + dur); snd.masterV = v;
}
function syncMusic(){
  if (snd.on && inGame() && !document.hidden){
    if (snd.ctx && snd.masterV !== 1) masterTo(1, .25);
    melStart();
  } else melStop(!inGame());   // 처음 화면으로 나가면 다음 게임은 인트로부터
}
// ---------- 배경음악: 인트로(한 번) → 같은 계열의 라운지 재즈 6곡을 이어서 계속 반복 ----------
// 모든 기기에서 <audio> 하나로 재생 (아이폰·아이패드에서 가장 안정적). 곡 파일은 미리 알맞은 음량으로 만들어 둠
const MUSIC_INTRO = 'audio/lounge-intro.mp3';
const PLAYLIST = [
  {src:'audio/song1.mp3', title:'라운지 블러프'},
  {src:'audio/song2.mp3', title:'미드나잇 테이블'},
  {src:'audio/song3.mp3', title:'블러프 콜'},
  {src:'audio/song4.mp3', title:'스모크 룸'},
  {src:'audio/song5.mp3', title:'하이 스테이크'},
  {src:'audio/song6.mp3', title:'라스트 핸드'},
];
const mel = {a: null, idx: -2, playing: false, unlocked: false};   // idx: -2 처음, -1 인트로, 0~ 곡 번호
function melInit(){
  if (mel.a) return;
  const a = mel.a = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', ''); a.setAttribute('webkit-playsinline', '');
  a.addEventListener('ended', () => melNext());
  a.addEventListener('error', () => { if (mel.playing && mel.a.src) setTimeout(melNext, 800); });
}
function melLoad(i){
  mel.idx = i; const src = i < 0 ? MUSIC_INTRO : PLAYLIST[i].src;
  mel.a.src = src; mel.a.loop = i >= 0 && !!PLAYLIST[i].loop;
  const nx = PLAYLIST[(i + 1 + PLAYLIST.length) % PLAYLIST.length]; fetch(nx.src).catch(()=>{});   // 다음 곡 미리 받아 두기
  try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({title: i < 0 ? '홀덤 테이블' : PLAYLIST[i].title, artist: '홀덤 테이블 배경음악'}); } catch(_){}
}
function melNext(){ if (!mel.a) return; melLoad((mel.idx + 1) % PLAYLIST.length); if (mel.playing) mel.a.play().catch(()=>{ mel.playing = false; }); }
// 터치하는 순간 오디오를 '허락받은' 상태로 만들어 둠 (나중에 터치 없이도 다음 곡으로 넘어가게)
function melUnlock(){
  melInit(); if (mel.unlocked || !mel.a.paused) return; mel.unlocked = true;
  if (!mel.a.src) melLoad(-1);
  const a = mel.a; a.muted = true; const pr = a.play();
  if (pr && pr.then) pr.then(() => { if (!mel.playing) a.pause(); a.muted = false; }).catch(() => { a.muted = false; mel.unlocked = false; }); else a.muted = false;
}
function melStart(){
  melInit(); if (mel.playing && !mel.a.paused) return; mel.playing = true;
  if (mel.idx === -2 || !mel.a.src) melLoad(-1);
  mel.a.muted = false; mel.a.volume = 1;
  const pr = mel.a.play(); if (pr && pr.catch) pr.catch(() => { mel.playing = false; });
}
function melStop(reset){
  if (!mel.a) return; mel.playing = false; mel.a.pause();
  if (reset && mel.idx !== -2){ mel.idx = -2; try { mel.a.removeAttribute('src'); mel.a.load(); } catch(_){} }
}
function stopMusic(){ melStop(!inGame()); }
function startMusic(){ audioReady(); melStart(); }
// 다른 앱으로 갈 때: 효과음 오디오는 소리를 먼저 줄인 뒤 재우고(끊기며 '지잉' 하는 소리 방지), 음악은 일시정지
function audioHide(){
  melStop(!inGame());
  if (!snd.ctx) return;
  masterTo(0, .05);
  clearTimeout(snd.hideT); snd.hideT = setTimeout(()=>{ if (document.hidden && snd.ctx) snd.ctx.suspend().catch(()=>{}); }, 90);
}
// 돌아왔을 때: 멈췄던 자리부터 음악 이어서
function audioShow(){ clearTimeout(snd.hideT); if (!snd.on) return; if (snd.ctx) audioReady(); syncMusic(); }
document.addEventListener('visibilitychange', ()=>{ if (document.hidden) audioHide(); else audioShow(); });
window.addEventListener('pagehide', audioHide);
window.addEventListener('pageshow', ()=>{ if (!document.hidden) audioShow(); });
// 소리를 켜 둔 채로 다시 들어오거나 기기가 오디오를 안 깨워줬으면, 첫 터치 때 다시 시작 (브라우저 정책상 터치가 필요)
['pointerdown','touchend','click','keydown'].forEach(ev=>document.addEventListener(ev, ()=>{
  if (!snd.on) return;
  melUnlock();
  if (!snd.ctx || snd.ctx.state !== 'running') audioReady();
  if (inGame() && (!mel.playing || mel.a.paused)) syncMusic();
}, {capture: true, passive: true}));

// 베팅 '치킹!' : 보내준 영상의 소리를 분석해서 같은 구조로 합성
//  - 시작 '치': 밝은 금속성 잡음이 아주 짧게 (두 번 겹쳐 치는 느낌, 7ms 간격)
//  - 이어서 '킹': 1378 · 3528 · 6260 · 9445Hz 배음 (6260Hz가 가장 큼), 높은 배음일수록 빨리 사라짐
//  - 영상보다 짧게: 약 0.4초 안에 거의 사라짐
const CHIKING = [[1378, .5, .15], [1381.6, .22, .15], [1711, .05, .06], [3528, .26, .12], [6260, .9, .09], [6268.5, .32, .09], [7585, .04, .05], [8099, .05, .05], [9445, .38, .055], [13147, .12, .03]];
function chiking(ctx, out, t, v = 1){
  if (!chiking.nb || chiking.nb.sampleRate !== ctx.sampleRate){ const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .2), ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; chiking.nb = nb; }
  const g0 = .16 * v;
  // '치' (금속이 부딪히는 짧은 잡음, 두 번)
  [[0, .55], [.007, 1]].forEach(([d, a]) => {
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = chiking.nb; hp.type = 'highpass'; hp.frequency.value = 3800; hp.Q.value = .8;
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(g0 * 1.3 * a, t + d + .001); g.gain.setTargetAtTime(0, t + d + .001, .016);
    n.connect(hp); hp.connect(g); g.connect(out); n.start(t + d, Math.random() * .05, .12);
  });
  { // 울리는 동안 남는 '찰랑' 잔향 (높은 대역 잡음, 약하게)
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = chiking.nb; bp.type = 'bandpass'; bp.frequency.value = 8000; bp.Q.value = .6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * .25, t + .004); g.gain.setTargetAtTime(0, t + .004, .045);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, 0, .2);
  }
  // '킹' (금속 울림)
  CHIKING.forEach(([f, a, tau]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), st = t + .007;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(g0 * a, st + .0015); g.gain.setTargetAtTime(0, st + .0015, tau);
    o.connect(g); g.connect(out); o.start(st); o.stop(st + tau * 7 + .01);
  });
}

// ---------- 효과음 ----------
const sfx = (()=>{
  let nb = null;
  const N = () => { const c = snd.ctx; if (!nb || nb.sampleRate !== c.sampleRate){ nb = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nb; };
  const ok = () => snd.on && snd.ctx && snd.ctx.state === 'running';
  const tone = (f, t, peak, dec, type = 'sine', dur) => { const c = snd.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .002); g.gain.setTargetAtTime(0, t + .002, dec); o.connect(g); g.connect(snd.sfx); o.start(t); o.stop(t + (dur || dec * 8)); return o; };
  const hiss = (t, dur, type, f, q, peak, dec, f2) => { const c = snd.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = N(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(.01, dur / 3)); g.gain.setTargetAtTime(0, t + Math.min(.01, dur / 3), dec); s.connect(fl); fl.connect(g); g.connect(snd.sfx); s.start(t, Math.random() * .5, dur + dec * 6); };
  // 칩 하나가 부딪히는 소리 (점토 칩: 짧고 맑은 '딱')
  const clink = (t, v) => { const f = 2600 + Math.random() * 1600; tone(f, t, .11 * v, .012); tone(f * 1.47, t, .06 * v, .009); hiss(t, .03, 'highpass', 3500, .7, .12 * v, .006); tone(700 + Math.random() * 300, t, .05 * v, .015); };
  // 카지노 벨 '띠링~' (보내준 영상의 벨 소리 배음 구조를 본떠 합성: 약 1380Hz, 배음 비율 1 : 2.56 : 4.54 : 6.85)
  const coin = (t, v = 1) => chiking(snd.ctx, snd.sfx, t, v);
  const chips = (n, spread = .05, v = 1) => { const t0 = snd.ctx.currentTime + .01; for (let k = 0; k < n; k++) clink(t0 + k * spread * (.6 + Math.random() * .8), v * (.7 + Math.random() * .4)); };
  return {
    // 체크: 테이블을 손가락으로 '똑똑'
    check(){ if (!ok()) return; const t = snd.ctx.currentTime + .01; [0, .14].forEach((d, k) => { const o = tone(170, t + d, .5 - k * .1, .045, 'sine', .3); o.frequency.setValueAtTime(190, t + d); o.frequency.exponentialRampToValueAtTime(110, t + d + .08); hiss(t + d, .03, 'lowpass', 1400, .8, .25, .012); }); },
    // 콜: 칩 몇 개
    call(){ if (ok()) coin(snd.ctx.currentTime + .01, .9); },
    // 베팅·레이즈: 칩 여러 개를 내려놓음
    bet(){ if (ok()) coin(snd.ctx.currentTime + .01, 1); },
    // 올인: 칩 더미를 한꺼번에 밀어 넣음
    allin(){ if (!ok()) return; coin(snd.ctx.currentTime + .01, 1); chips(16, .035, 1.1); hiss(snd.ctx.currentTime, .35, 'bandpass', 1800, .6, .12, .12, 900); },
    // 폴드: 카드를 테이블에 미끄러뜨림
    fold(){ if (!ok()) return; hiss(snd.ctx.currentTime + .01, .22, 'bandpass', 1500, .9, .22, .07, 4200); },
    // 카드 한 장 넘기기
    // 카드 나눠주기: 종이가 펠트 위를 미끄러지는 '스윽' + 내려앉는 '탁'
    card(delay = 0){ if (!ok()) return; const t = snd.ctx.currentTime + .01 + delay; hiss(t, .09, 'bandpass', 1300, .9, .16, .03, 3600); hiss(t + .07, .03, 'lowpass', 1100, .7, .13, .01); tone(240, t + .07, .05, .02); },
    // 카드 뒤집기: 짧은 '착'
    flip(delay = 0){ if (!ok()) return; const t = snd.ctx.currentTime + .01 + delay; hiss(t, .025, 'highpass', 2200, .7, .26, .006); hiss(t + .004, .05, 'bandpass', 1600, 1.1, .1, .015, 2600); tone(520, t, .03, .012); },
    // 카드 섞기: 리플 셔플 '드르륵'
    shuffle(){ if (!ok()) return; const t = snd.ctx.currentTime + .01; for (let k = 0; k < 16; k++) hiss(t + k * .026 + Math.random() * .008, .02, 'bandpass', 2600 + Math.random() * 1800, .9, .05 + .06 * Math.sin(k / 15 * Math.PI), .004); hiss(t + .43, .05, 'lowpass', 900, .7, .14, .015); },
    // 새 판: 셔플 + 카드 나눠주기
    // 차례가 넘어감: 작은 우드블록 '톡'
    tick(){ if (!ok()) return; const t = snd.ctx.currentTime + .01; tone(1250, t, .12, .025); tone(2500, t, .03, .01); },
    // 내 차례: 비브라폰 두 음 '띵-동'
    // 시간이 얼마 안 남음
    hurry(){ if (!ok()) return; const t = snd.ctx.currentTime + .01; tone(660, t, .08, .03); },
    // 승리: 칩 쓸어 담기 (+ 내가 이기면 짧은 팡파르)
    win(me){ if (!ok()) return; chips(12, .045, .9); hiss(snd.ctx.currentTime + .05, .5, 'bandpass', 1200, .5, .1, .15, 2600); if (me){ const t = snd.ctx.currentTime + .25; [587.3, 698.5, 880, 1174.7].forEach((f, k) => { tone(f, t + k * .09, .14, .4); tone(f * 2, t + k * .09, .03, .1); }); } },
  };
})();

// 상태가 바뀔 때 어떤 소리를 낼지 판단 (컴퓨터 대결·온라인 공통)
function soundCues(s){
  if (!s || !inGame()){ snd.seen = null; return; }
  const meId = myId(), mi = s.seats.findIndex(p => p && p.id === meId);
  const lastK = s.log.length ? (s.log[s.log.length - 1].k || 0) : 0;
  const cur = { room: view + (net.room || ''), k: lastK, hand: s.handNo, board: s.board.length, toAct: BETTING.has(s.stage) ? s.toAct : -1, stage: s.stage };
  const prev = snd.seen; snd.seen = cur;
  if (!prev || prev.room !== cur.room || !snd.on) return; // 처음 본 상태는 소리 없이 기록만
  let played = false;
  const fresh = s.log.filter(e => (e.k || 0) > prev.k).slice(-3);
  fresh.forEach((e, n) => {
    const m = e.m || '', delay = n * 120;
    const play = fn => { played = true; setTimeout(fn, delay); };
    if (/번째 핸드/.test(m)) play(() => sfx.shuffle());
    else if (/획득/.test(m)) play(() => sfx.win(e.i === mi));
    else if (/올인/.test(m)) play(() => sfx.allin());
    else if (/^폴드/.test(m)) play(() => sfx.fold());
    else if (/^체크/.test(m)) play(() => sfx.check());
    else if (/^콜/.test(m)) play(() => sfx.call());
    else if (/^(베팅|레이즈)/.test(m)) play(() => sfx.bet());
  });
  if (cur.hand === prev.hand && cur.board > prev.board){ for (let k = 0; k < cur.board - prev.board; k++) sfx.flip((60 + 150*k + 180) / 1000); played = true; }
  // 판이 끝나 카드가 공개될 때 차례로 뒤집는 소리
  if (cur.hand === prev.hand && cur.stage === 'done' && prev.stage !== 'done'){
    const n = s.seats.filter((q, j) => q && j !== mi && q.inHand && q.shown && q.cards.length === 2 && q.cards[0] !== 'back').length;
    for (let k = 0; k < n; k++) sfx.flip((120 + k * 160 + 200) / 1000);
  }
  if (cur.toAct !== prev.toAct && cur.toAct >= 0){
    if (cur.toAct !== mi && !played) sfx.tick();
  }
}

// 베팅 창을 열면 내 카드와 베팅 칸이 한 화면에 같이 보이도록 스크롤
function fitRaiseBox(){
  const rb = document.querySelector('.raisebox'), mine = document.querySelector('.dock .mine'); if (!rb) return;
  const r = rb.getBoundingClientRect(), top = mine ? mine.getBoundingClientRect().top : r.top;
  const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
  if (r.bottom > vh - 8){ const dy = Math.min(r.bottom - vh + 12, Math.max(0, top - 8)); window.scrollBy({top: dy, behavior: 'smooth'}); }
}
// ---------- 카드 나눠주기 애니메이션 ----------
// 새 핸드가 시작되면 테이블 가운데에서 딜러 왼쪽부터 한 장씩, 두 바퀴 날아감 (내 카드는 도착한 뒤 뒤집힘)
const DEAL_STEP = 110, DEAL_DUR = 300;
function dealTarget(s, seat, round){
  const mi = s.seats.findIndex(p=>p && p.id===myId());
  if (seat === mi) return document.querySelectorAll('.dock .mine .hole .card')[round] || null;
  return document.querySelector(`.seat[data-si="${seat}"] .hole .card:nth-child(${round+1})`);
}
function startDealAnim(s){
  if (!s || s.stage !== 'preflop' || !inGame()) return;
  const id = view + ':' + (net.room||'') + ':' + s.handNo;
  if (ui.dealId === id) return;
  ui.dealId = id;
  // 이미 진행 중인 판에 들어온 경우(누가 액션함)는 생략
  if (s.seats.some(p=>p && (p.vp || (p.ag && p.ag.preflop)))) return;
  const live = idxs(s, p=>p.inHand), order = [];
  let i = s.dealer; for (let r = 0; r < 2; r++) for (let k = 0; k < live.length; k++){ i = nextIdx(s, i, p=>p.inHand); order.push([i, r]); }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  ui.dealPlan = order.map(([seat, r], n) => ({seat, r, at: t0 + n * DEAL_STEP + DEAL_DUR}));
  ui.dealUntil = t0 + order.length * DEAL_STEP + DEAL_DUR;
  // 내 카드: 도착하는 순간 뒤집히도록 애니메이션 지연
  const mi = s.seats.findIndex(p=>p && p.id===myId());
  ui.dealPlan.forEach(it => { if (it.seat === mi){ const el = dealTarget(s, it.seat, it.r); if (el && el.classList.contains('new')) el.style.setProperty('--d', Math.round(it.at - t0) + 'ms'); } });
  applyDealHidden();
  order.forEach(([seat, r], n) => setTimeout(() => flyCard(seat, r, n), n * DEAL_STEP));
}
function flyCard(seat, r, n){
  const s = currentState(); if (!s || !ui.dealPlan) return;
  const tgt = dealTarget(s, seat, r), from = document.querySelector('.table .board');
  if (!tgt || !from) return;
  const a = tgt.getBoundingClientRect(), b = from.getBoundingClientRect();
  if (!a.width) return;
  const f = document.createElement('div'); f.className = 'card back fly'; f.innerHTML = BACK_SVG;
  f.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;z-index:15;pointer-events:none;margin:0`;
  document.body.appendChild(f);
  const dx = b.left + b.width/2 - (a.left + a.width/2), dy = b.top + b.height/2 - (a.top + a.height/2);
  const rot = (n % 2 ? 1 : -1) * (12 + Math.random()*10);
  sfx.card();
  const done = () => { f.remove(); const s2 = currentState(), el = s2 && dealTarget(s2, seat, r); if (el) el.style.visibility = ''; };
  if (!f.animate){ done(); return; }
  const an = f.animate([{transform:`translate(${dx}px,${dy}px) rotate(${rot}deg) scale(.55)`, opacity:0}, {opacity:1, offset:.12}, {transform:'none', opacity:1}], {duration: DEAL_DUR, easing:'cubic-bezier(.2,.75,.3,1)'});
  an.onfinish = done; an.oncancel = done;
}
// 다시 그려도 아직 도착 안 한 카드는 숨겨 둠
function applyDealHidden(){
  if (!ui.dealPlan) return;
  const now = performance.now(), s = currentState();
  if (!s || now > ui.dealUntil + 50){ ui.dealPlan = null; return; }
  ui.dealPlan.forEach(it => { if (it.at > now){ const el = dealTarget(s, it.seat, it.r); if (el) el.style.visibility = 'hidden'; } });
}

function render(){
  const ae = document.activeElement; ui.raiseFocus = !!(ae && ae.id === 'raise-in'); ui.raiseKeep = ui.raiseFocus ? ae.value : null;
  document.body.classList.toggle('wide-table', (view==='local' || view==='online') && isWide());
  if (view==='lobby') renderLobby(); else if (view==='join') renderJoin(); else renderTable();
  mountFaces(app);
  if (view==='lobby' || view==='join') placeQuickChat();
  const box = document.getElementById('chatbox'); if (box && box.hidden === (view==='online' && !!net.state)) renderChat(true);
  applyDealHidden();
  if (inGame()) startDealAnim(currentState());
  soundCues(inGame() ? currentState() : null);
  if (snd.ctx) syncMusic();
  if (view==='local' && localState && localState.stage==='done' && !localGameOver(localState)){
    clearTimeout(render.auto); render.auto = setTimeout(nextLocalHand, 9000);
  }
}
document.addEventListener('click', async e=>{
  // 설명 창은 게임 버튼을 눌러도 그대로 두고, 빈 곳을 눌렀을 때만 닫음
  if (ui.infoOpen && !e.target.closest('.info-pop, [data-a], button, input')){ ui.infoOpen = false; render(); return; }
  if (ui.emoOpen && !e.target.closest('.emo-all, [data-a=emo-toggle]')){ ui.emoOpen = false; if (!e.target.closest('[data-a]')) { render(); return; } }
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a;
  if (a==='close-sheet'){ if (e.target===el || el.tagName==='BUTTON') document.getElementById('sheet').innerHTML=''; return; }
  switch (a){
    case 'rules': openRules(); break;
    case 'sound': toggleSound(); break;
    case 'bots-': botCount = Math.max(1, botCount-1); render(); break;
    case 'bots+': botCount = Math.min(5, botCount+1); render(); break;
    case 'start-local': clearTimeout(render.auto); startLocal(); break;
    case 'next-local': clearTimeout(render.auto); nextLocalHand(); break;
    case 'host': hostRoom(); break;
    case 'chips': chipChoice = +el.dataset.v; store('holdem.chips', String(chipChoice)); render(); break;
    case 'level': botLevel = el.dataset.v; store('holdem.level', botLevel); render(); break;
    case 'hseats-': case 'hseats+': hostSeats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, hostSeats + (a==='hseats+'?1:-1))); store('holdem.seats', String(hostSeats)); render(); break;
    case 'seats-': case 'seats+': { const st = net.hostState; if (st) sendNet({t:'resize', n: st.seats.length + (a==='seats+'?1:-1)}); break; }
    case 'invite': shareInvite(); break;
    case 'leave': leaveToLobby(); break;
    case 'sit': sendNet({t:'sit', seat:+el.dataset.i}); break;
    case 'stand': sendNet({t:'stand'}); break;
    case 'sitback': sendNet({t:'sitback'}); break;
    case 'rebuy': sendNet({t:'rebuy'}); break;
    case 'start-online': sendNet({t:'start'}); break;
    case 'fold': case 'check': case 'call': doAction({type:a}); break;
    case 'raise-open': ui.raiseOpen = !ui.raiseOpen; ui.raiseTyped = null; render(); if (ui.raiseOpen) fitRaiseBox(); break;
    case 'preset': ui.raiseTo = +el.dataset.v; ui.raiseTyped = null; ui.raiseOpen = true; render(); break;
    case 'raise-go': { const L = legal(currentState(), currentState().seats.findIndex(p=>p && p.id===myId())); ui.raiseTyped = null; doAction({type:'raise', to:Math.max(L.minTo, Math.min(L.maxTo, ui.raiseTo))}); break; }
    case 'info': ui.infoOpen = !ui.infoOpen; render(); break;
    case 'advice': ui.adviceOpen = !ui.adviceOpen; store('holdem.advice', ui.adviceOpen ? '1' : '0'); render(); break;
    case 'info-close': ui.infoOpen = false; render(); break;
    case 'emo-toggle': ui.emoOpen = !ui.emoOpen; render(); break;
    case 'emo-send': sendEmoji(el.dataset.v); break;
    case 'rename-open': ui.renameOpen = !ui.renameOpen; ui.renameDraft = null; ui.renameFocus = ui.renameOpen; render(); break;
  }
});
document.addEventListener('submit', e=>{
  if (e.target.id==='join-form'){ e.preventDefault(); submitJoin(); }
  if (e.target.id==='rename-form'){ e.preventDefault(); saveRename(); }
  if (e.target.id==='chat-form'){
    e.preventDefault();
    const inp = document.getElementById('chat-in');
    if (sendChat(inp.value)){ inp.value = ''; toggleEmojiPad(false); }
    inp.focus();
  }
});
document.getElementById('emoji-btn').addEventListener('click', ()=>toggleEmojiPad());
document.getElementById('emoji-pad').addEventListener('click', e=>{ const b = e.target.closest('[data-emo]'); if (b) insertEmoji(b.dataset.emo); });
document.addEventListener('input', e=>{
  if (e.target.id==='join-name') ui.joinDraft = e.target.value;
  if (e.target.id==='rename-in') ui.renameDraft = e.target.value;
});
document.addEventListener('focusin', e=>{ if (e.target.id==='rename-in') ui.renameFocus = true; });
document.addEventListener('focusout', e=>{ if (e.target.id==='rename-in') setTimeout(()=>{ if (document.activeElement && document.activeElement.id!=='rename-in') ui.renameFocus = false; }, 0); });
document.addEventListener('keydown', e=>{ if (e.key==='Escape') document.getElementById('sheet').innerHTML=''; });
document.addEventListener('change', e=>{
  if (e.target.id==='name-in'){ me.name = cleanName(e.target.value); e.target.value = me.name; store('holdem.name', me.name); }
});
function doAction(a){
  ui.raiseOpen = false;
  if (view==='local'){
    const n = act(localState, 0, a, Date.now());
    if (n){ localState = n; afterLocal(); }
  } else sendNet({t:'act', a});
}

const startRoom = roomFromURL();
if (startRoom){ pendingRoom = startRoom; view = 'join'; }
render();

if ('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});

// iOS 사파리는 user-scalable=no를 무시하므로 확대 제스처를 직접 막음
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t, e=>e.preventDefault(), {passive:false}));
document.addEventListener('touchmove', e=>{ if (e.touches && e.touches.length > 1) e.preventDefault(); }, {passive:false});
let lastTouchEnd = 0;
document.addEventListener('touchend', e=>{
  const now = Date.now();
  if (now - lastTouchEnd < 320 && !e.target.closest('input,textarea')){ e.preventDefault(); if (e.target.closest('button,[data-a]')) e.target.click(); }
  lastTouchEnd = now;
}, {passive:false});
document.addEventListener('dblclick', e=>e.preventDefault(), {passive:false});
// 화면을 돌리거나 창 크기를 바꾸면 배치 다시 계산
let lastWide = isWide();
addEventListener('resize', ()=>{ clearTimeout(render.rz); render.rz = setTimeout(()=>{ const w = isWide(); if (w!==lastWide){ lastWide = w; if (view==='local' || view==='online') render(); } else { placeBets(); placeQuickChat(); fitBubbles(); } }, 150); });
