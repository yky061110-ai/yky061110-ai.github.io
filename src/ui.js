/* ================= 화면 ================= */
const app = document.getElementById('app');
const fmt = n => Number(n||0).toLocaleString('ko-KR');
const esc = t => String(t).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view = 'lobby', botCount = 3;
let hostSeats = Math.max(2, Math.min(9, parseInt(store('holdem.seats')) || 6));
const LEVELS = {
  easy:   {name:'이지',  desc:'자주 따라오고 블러핑 없음'},
  normal: {name:'보통',  desc:'무난한 실력'},
  hard:   {name:'하드',  desc:'계산 정확, 블러핑도 함'},
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

function cardHTML(c, opts={}){
  if (!c) return `<div class="card empty"></div>`;
  if (c==='back') return `<div class="card back"></div>`;
  const red = c[1]==='h' || c[1]==='d';
  const key = (opts.key||'') + c;
  const fresh = opts.animate && !ui.seenCards.has(key); if (opts.animate) ui.seenCards.add(key);
  return `<div class="card${red?' red':''}${opts.hl?' hl':''}${opts.dim?' dim':''}${fresh?' new':''}"><span class="r">${c[0]==='T'?'10':c[0]}</span><span class="s">${SUIT_SYM[c[1]]}</span></div>`;
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
    <h2>노리밋 텍사스 홀덤</h2>
    <p>개인 카드 2장과 공용 카드 5장 중 가장 좋은 5장으로 겨룹니다.</p>
  </section>
  <div class="mode">
    <span><b>시작 칩</b> <span class="note">게임 시작 전에 골라요. 컴퓨터 대결과 방 만들기 모두 적용</span></span>
    <div class="levels chips2" role="radiogroup" aria-label="시작 칩">
      ${Object.entries(CHIP_OPTIONS).map(([c,o])=>`<button role="radio" aria-checked="${chipChoice===+c}" class="level${chipChoice===+c?' on':''}" data-a="chips" data-v="${c}"><b class="num">${fmt(c)}개</b><span>블라인드 ${o.sb}/${o.bb}</span></button>`).join('')}
    </div>
  </div>
  <div class="mode" style="flex-direction:row;align-items:center">
    <label for="name-in" style="white-space:nowrap">내 이름</label>
    <input id="name-in" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(me.name)}" autocomplete="nickname">
  </div>
  <div class="modes">
    <div class="mode">
      <h3>컴퓨터와 대결</h3>
      <p>성향이 다른 컴퓨터 플레이어들과 바로 시작해요.</p>
      <div class="stepper"><button data-a="bots-" aria-label="상대 줄이기">−</button><span class="num">${botCount}</span><span>명의 상대</span><button data-a="bots+" aria-label="상대 늘리기">+</button></div>
      <div class="levels" role="radiogroup" aria-label="난이도">
        ${Object.entries(LEVELS).map(([k,v])=>`<button role="radio" aria-checked="${botLevel===k}" class="level${botLevel===k?' on':''}" data-a="level" data-v="${k}"><b>${v.name}</b><span>${v.desc}</span></button>`).join('')}
      </div>
      <button class="primary" data-a="start-local">게임 시작</button>
    </div>
    <div class="mode">
      <h3>친구와 온라인</h3>
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
    <input id="join-name" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(ui.joinDraft ?? (store('holdem.name') || ''))}" placeholder="예: 영규" autocomplete="nickname" enterkeyhint="go">
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
// 자리 위치(테이블 너비·높이 %): 내 자리(0)를 맨 아래에 두고 시계 방향.
// 가운데 띠(공용 카드·팟)는 비워 두고, 옆자리는 가장자리로 붙여 카드가 가려지지 않게 함
const SEAT_LAYOUT = {
  2: [[50,91],[50,11]],
  3: [[50,91],[14,24],[86,24]],
  4: [[50,91],[12,48],[50,11],[88,48]],
  5: [[50,91],[12,66],[22,13],[78,13],[88,66]],
  6: [[50,91],[12,66],[12,30],[50,11],[88,30],[88,66]],
  7: [[50,91],[16,82],[10,46],[28,11],[72,11],[90,46],[84,82]],
  8: [[50,91],[18,83],[10,54],[14,22],[50,10],[86,22],[90,54],[82,83]],
  9: [[50,91],[24,84],[10,60],[10,32],[28,11],[72,11],[90,32],[90,60],[76,84]],
};
function slotPos(k, N){ return (SEAT_LAYOUT[N] || SEAT_LAYOUT[6])[k]; }
function currentState(){ return view==='local' ? localState : net.state; }
function renderTable(){
  const s = currentState();
  const head = view==='local'
    ? `<div class="bar"><h1>홀덤 테이블<small>컴퓨터 · ${LEVELS[s && s.level || 'normal'].name}</small></h1><button class="ghost" data-a="rules">족보</button><button class="ghost" data-a="leave">나가기</button></div>`
    : `<div class="bar"><h1>홀덤 테이블<small>${net.role==='host'?'온라인 · 방장':'온라인'}</small></h1><button class="ghost" data-a="invite">초대 링크</button><button class="ghost" data-a="rules">족보</button><button class="ghost" data-a="leave">나가기</button></div>`;
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

  let seatsHTML = '', chips = '';
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
    if (!isMe && p.inHand && !p.folded){
      const reveal = showAll && p.shown && p.cards[0] !== 'back';
      hole = p.cards.map(c=>reveal ? cardHTML(c,{hl:winSet.has(i)&&winCards.has(c), dim: winSet.size && !winSet.has(i)}) : cardHTML('back')).join('');
    }
    let st = '';
    if (s.stage==='done' && winSet.has(i)) st = `+${fmt(s.winners.find(w=>w.s===i).amt)}`;
    else if (showAll && p.shown) st = p.hn;
    else if (p.inHand && p.folded) st = '폴드';
    else if (p.allin && p.inHand) st = '올인';
    else if (!p.inHand && p.chips===0) st = view==='local' ? '탈락' : '칩 없음';
    else if (p.away) st = '연결 끊김';
    else if (p.sitOut) st = '자리 비움';
    else if (!p.inHand && s.stage!=='idle' && s.stage!=='done') st = '다음 핸드부터';
    const badge = s.stage!=='idle' && i===s.dealer ? '<span class="badge">D</span>' : '';
    const timer = acting && view==='online' ? `<div class="timer"><i data-deadline="${s.turnDeadline}"></i></div>` : '';
    const bub = view==='online' && ui.bubbles[p.id] && ui.bubbles[p.id].until > now ? `<div class="bubble" data-bub="${esc(p.id)}"></div>` : '';
    seatsHTML += `<div class="${cls}" style="left:${x}%;top:${y}%">${bub}
      ${isMe ? '' : `<div class="hole">${hole}</div>`}
      <div class="plate">${badge}<span class="nm" data-nm="${i}"></span><span class="ch num">${fmt(p.chips)}</span>${st?`<span class="st">${esc(st)}</span>`:''}</div>${timer}</div>`;
    if (p.bet>0){ const bx = x + (50-x)*.42, by = y + (48-y)*.42; chips += `<div class="betchip num" style="left:${bx}%;top:${by}%">${fmt(p.bet)}</div>`; }
  }
  const boardHTML = Array.from({length:5},(_,k)=>cardHTML(s.board[k], {animate:true, key:s.handNo+':', hl: showAll && winCards.has(s.board[k])})).join('');
  let result = '';
  if (s.stage==='done' && s.winners.length){
    result = s.winners.map(w=>`<span data-nm="${w.s}"></span> ${s.uncontested ? '승리' : '· ' + esc(w.h)}`).join(' / ');
  }
  const pot = s.stage==='done' ? s.winners.reduce((a,w)=>a+w.amt,0) : potSize(s);

  app.innerHTML = `${head}${statusLine}
  <div class="table${N>=7?' dense':''}">
    <div class="felt"></div>
    <div class="center">
      <span class="stage">${STAGE_KO[s.stage]||''}${s.handNo?` · #${s.handNo}`:''}</span>
      <div class="board">${boardHTML}</div>
      ${pot? `<span class="pot">팟 <b class="num">${fmt(pot)}</b></span>` : ''}
      <span class="result">${result}</span>
    </div>
    ${chips}${seatsHTML}
  </div>
  ${renderDock(s, myIdx, now)}
  <ul class="log">${s.log.slice(-8).reverse().map(e=>`<li class="${e.i<0?'sys':''}">${e.i>=0?`<b data-lid="${esc(e.id)}" data-li="${e.i}" data-ln="${esc(e.n||'')}"></b> `:''}${esc(e.m)}</li>`).join('')}</ul>`;

  app.querySelectorAll('[data-nm]').forEach(el=>{ el.textContent = nameOf(s, +el.dataset.nm); });
  app.querySelectorAll('[data-li]').forEach(el=>{ el.textContent = logName(s, {i:+el.dataset.li, id:el.dataset.lid, n:el.dataset.ln}); });
  app.querySelectorAll('[data-bub]').forEach(el=>{ const b = ui.bubbles[el.dataset.bub]; if (b) el.textContent = b.text; });
  const slider = document.getElementById('raise-range');
  if (slider) slider.addEventListener('input', e=>{ ui.raiseTo = +e.target.value; const b=document.getElementById('raise-go'); if (b) b.textContent = raiseLabel(s, myIdx, ui.raiseTo); const v=document.getElementById('raise-val'); if (v) v.textContent = fmt(ui.raiseTo); });
  tickTimers();
  // 이름 입력 중 화면이 갱신돼도 입력이 끊기지 않게
  if (ui.renameOpen && ui.renameFocus){ const r = document.getElementById('rename-in'); if (r){ r.focus(); const n = r.value.length; try { r.setSelectionRange(n, n); } catch(_){} } }
}

function raiseLabel(s, i, to){ const p=s.seats[i]; if (to >= p.bet+p.chips) return `올인 ${fmt(to)}`; return `${s.currentBet===0?'베팅':'레이즈'} ${fmt(to)}`; }

function inviteBox(s){
  // 게임이 시작되면 숨김 (위쪽 ‘초대 링크’ 버튼은 계속 사용 가능)
  if (view!=='online' || net.role!=='host' || !net.room || !net.mq || !net.mq.connected || s.stage!=='idle') return '';
  return `<div class="tablecode">초대 링크 <span class="num" id="invite-url" style="font-size:12px;letter-spacing:0;word-break:break-all;min-width:0">${esc(inviteLink())}</span><button class="ghost" data-a="invite">보내기</button></div>`;
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
    if (b) handTxt = handName(b);
    else if (p.cards[0][0]===p.cards[1][0]) handTxt = '포켓 페어';
    else handTxt = p.cards[0][1]===p.cards[1][1] ? '수딧' : '오프수트';
    if (p.folded) handTxt = '폴드함';
  }
  const holes = p.inHand && p.cards.length ? p.cards.map(c=>cardHTML(c,{animate:true,key:s.handNo+'m', dim:p.folded})).join('') : cardHTML(null)+cardHTML(null);
  const mine = `<div class="mine"><div class="hole">${holes}</div><div class="info"><span class="hand">${esc(handTxt || (s.stage==='idle'?'대기 중':'이번 핸드 관전'))}</span><span class="sub">칩 <b class="num">${fmt(p.chips)}</b>${p.bet?` · 이번 라운드 베팅 <span class="num">${fmt(p.bet)}</span>`:''}</span></div></div>`;

  let controls = '';
  if (BETTING.has(s.stage) && s.toAct===mi){
    const L = legal(s, mi);
    const key = `${s.handNo}-${s.stage}-${s.currentBet}-${p.bet}`;
    if (ui.raiseKey!==key){ ui.raiseKey=key; ui.raiseOpen=false; ui.raiseTo=L.minTo; }
    ui.raiseTo = Math.max(L.minTo, Math.min(ui.raiseTo, L.maxTo));
    const callTxt = L.canCheck ? '체크' : (L.callAmt>=p.chips ? `올인 ${fmt(L.callAmt)}` : `콜 ${fmt(L.callAmt)}`);
    controls = `<div class="actions">
      <button class="act fold" data-a="fold">폴드</button>
      <button class="act call" data-a="${L.canCheck?'check':'call'}">${callTxt}</button>
      <button class="act raise" data-a="raise-open" ${L.canRaise?'':'disabled'}>${s.currentBet===0?'베팅':'레이즈'}</button>
    </div>`;
    if (ui.raiseOpen && L.canRaise){
      const potNow = potSize(s);
      const half = s.currentBet + Math.round((potNow+L.callAmt)/2/10)*10;
      const full = s.currentBet + Math.round((potNow+L.callAmt)/10)*10;
      const step = L.maxTo - L.minTo >= 10 ? 10 : 1;
      controls += `<div class="raisebox">
        <div class="row" style="justify-content:space-between"><span>금액</span><b class="num" id="raise-val">${fmt(ui.raiseTo)}</b></div>
        <input id="raise-range" type="range" min="${L.minTo}" max="${L.maxTo}" step="${step}" value="${ui.raiseTo}" aria-label="레이즈 금액">
        <div class="presets">
          <button data-a="preset" data-v="${L.minTo}">최소</button>
          <button data-a="preset" data-v="${half}">½ 팟</button>
          <button data-a="preset" data-v="${full}">팟</button>
          <button data-a="preset" data-v="${L.maxTo}">올인</button>
        </div>
        <button class="primary" id="raise-go" data-a="raise-go">${raiseLabel(s, mi, ui.raiseTo)}</button>
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
      extra += `<form class="row" id="rename-form" novalidate>
        <input id="rename-in" class="code-in" style="letter-spacing:0;text-transform:none;font-family:var(--f-body)" maxlength="10" value="${esc(ui.renameDraft ?? (p.name || me.name))}" aria-label="새 이름" enterkeyhint="done">
        <button class="primary" type="submit">저장</button></form>`;
    }
  }
  return `<div class="dock">${mine}${controls}${extra}${inviteBox(s)}</div>`;
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
    <h4>핸드 순위 (위가 강함)</h4>
    <div class="scroll"><table class="rank">${ex.map((e,k)=>`<tr><td>${k+1}</td><td><span class="nm">${e[0]}</span><br><span class="note">${e[1]}</span></td><td><div class="ex">${e[2].map(c=>cardHTML(c)).join('')}</div></td></tr>`).join('')}</table></div>
    <h4>진행 순서</h4>
    <div class="flow"><div><b>프리플랍</b><span>개인 2장</span></div><div><b>플랍</b><span>공용 3장</span></div><div><b>턴</b><span>공용 1장</span></div><div><b>리버</b><span>공용 1장</span></div><div><b>쇼다운</b><span>패 공개</span></div></div>
    <h4>규칙 요약</h4>
    <div class="scroll"><table class="defs">
      <tr><th>블라인드</th><td>딜러 왼쪽이 스몰 ${SBv}, 그다음이 빅 ${BBv}. 시작 칩 1,000개면 10/20, 10,000개면 50/100이에요. 2명일 땐 딜러가 스몰 블라인드를 내고 프리플랍에 먼저 액션해요.</td></tr>
      <tr><th>액션 순서</th><td>프리플랍은 빅 블라인드 다음 사람부터, 플랍 이후는 딜러 왼쪽부터 시계 방향.</td></tr>
      <tr><th>체크 / 콜</th><td>걸린 베팅이 없으면 넘기기(체크), 있으면 같은 금액 맞추기(콜).</td></tr>
      <tr><th>베팅 / 레이즈</th><td>최소 베팅은 ${BBv}. 레이즈는 직전 레이즈 폭 이상 올려야 해요. 노리밋이라 언제든 올인 가능.</td></tr>
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
  BOT_SEATS[botCount].forEach((seat,k)=>{ s.seats[seat] = makeSeat('bot'+k, {name:BOT_NAMES[k], chips:s.startChips, bot:true, per:{agg:.25+Math.random()*.55, loose:-.03+Math.random()*.1}}); });
  view = 'local'; ui.seenCards = new Set();
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
    }, 650 + Math.random()*650);
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
const EMOJIS = '😀 😂 🤣 😊 😍 😎 🤔 😮 😭 😡 😱 🥶 🤑 😴 🤐 😈 🙏 👍 👎 👏 🙌 💪 🔥 💯 🎉 💰 💸 🍀 🃏 ♠️ ♥️ ♦️ ♣️ ❤️ 💀 🤡 👀 ✌️ 👋 🍻'.split(' ');
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
  ui.bubbles[m.pid] = {text: cleanChat(m.text), until: Date.now() + 4500};
  if (view==='online') renderTable();
  setTimeout(()=>{ if (view==='online') renderTable(); }, 4600);
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
    const tx = document.createElement('span'); tx.textContent = m.text;
    li.append(who, tx); list.appendChild(li);
  });
  if (scroll) list.scrollTop = list.scrollHeight;
}
function toggleEmojiPad(force){
  const pad = document.getElementById('emoji-pad'), btn = document.getElementById('emoji-btn');
  if (!pad.childElementCount) pad.innerHTML = EMOJIS.map(e=>`<button type="button" data-emo="${e}" aria-label="${e}">${e}</button>`).join('');
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
  const reveal = v.stage==='done' && !v.uncontested;
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
  logIt(s, 0, `방을 열었어요 (최대 ${hostSeats}명 · 칩 ${fmt(s.startChips)} · 블라인드 ${s.sb}/${s.bb})`);
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
  net.chat = []; net.lastChat = {}; ui.bubbles = {};
  const ci = document.getElementById('chat-in'); if (ci) ci.value = '';
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
function render(){
  if (view==='lobby') renderLobby(); else if (view==='join') renderJoin(); else renderTable();
  const box = document.getElementById('chatbox'); if (box && box.hidden === (view==='online' && !!net.state)) renderChat(true);
  if (view==='local' && localState && localState.stage==='done' && !localGameOver(localState)){
    clearTimeout(render.auto); render.auto = setTimeout(nextLocalHand, 4500);
  }
}
document.addEventListener('click', async e=>{
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a;
  if (a==='close-sheet'){ if (e.target===el || el.tagName==='BUTTON') document.getElementById('sheet').innerHTML=''; return; }
  switch (a){
    case 'rules': openRules(); break;
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
    case 'raise-open': ui.raiseOpen = !ui.raiseOpen; render(); break;
    case 'preset': ui.raiseTo = +el.dataset.v; ui.raiseOpen = true; render(); break;
    case 'raise-go': doAction({type:'raise', to:ui.raiseTo}); break;
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
