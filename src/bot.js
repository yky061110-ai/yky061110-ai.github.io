/* ================= 컴퓨터 플레이어 (난이도별 AI) =================
   참고한 실전 기준
   - 포지션별 오픈 레인지(6인): UTG 14% · HJ 19% · CO 26% · BTN 43% · SB 33%, 오픈 2.5BB (SB 3BB)
   - 숏스택(10~12BB 이하)은 푸시/폴드: 올인 범위는 BTN 약 44%, SB 약 69%, 받아주는 콜은 훨씬 좁게(8~19%)
   - 콘티뉴에이션 베팅: 헤즈업·드라이 보드에서 자주(팟의 1/3), 웻 보드·멀티웨이에선 강한 패·강한 드로우 위주
   - 팟 오즈로 콜/폴드: 필요 승률 = 콜 금액 ÷ (팟 + 콜 금액)
   - 블러핑 비율: 베팅 크기에 맞춰 (팟 1/2 베팅이면 가치:블러핑 ≈ 3:1)
   - 플레이어 유형: 하드=TAG/LAG(타이트하거나 영리하게 공격적), 노멀=정석(ABC) 플레이어, 이지=루즈-패시브(초보) */

// 169가지 시작 패 강도 순위 (1:1 승률과 4인 승률을 섞어 미리 계산) → 상위 몇 %인지
const PF_ORDER = 'AA KK QQ JJ TT 99 88 AKs AQs AKo AJs KQs KJs AQo KTs ATs A9s 77 QTs KQo AJo QJs KJo A8s ATo K9s Q9s 66 A5s JTs QJo A7s A6s A9o A4s KTo J9s 55 A8o K8s A6o A3s K7s Q8s K9o A7o QTo T9s A5o K6s JTo A2s A4o J8s Q9o K8o K5s T8s 98s J9o Q7s K4s Q8o 44 K6o K2s J7s K3s T9o Q5s A3o Q6s A2o Q4s Q3s 97s T7s Q2s K5o K7o Q7o J5s 33 J6s K4o J8o T6s 87s 76s K3o 96s 22 T8o J4s K2o J7o J2s 98o Q6o T7o Q5o J3s 86s 97o T6o 95s T3s 75s T4s T5s Q4o J5o Q3o 93s 85s 65s 84s 87o T2s Q2o J6o 53s 94s 86o 76o J4o 74s 54s 92s 85o 63s 64s J2o 65o T3o T5o J3o 96o 75o 43s 73s 95o 83s 82s 52s 54o T4o 94o 62s 72s T2o 64o 92o 93o 74o 42s 84o 43o 53o 32s 83o 63o 73o 82o 72o 52o 62o 42o 32o'.split(' ');
const PF_PCT = {}; (()=>{ let cum = 0; PF_ORDER.forEach(c=>{ cum += c.length===2 ? 6 : (c[2]==='s' ? 4 : 12); PF_PCT[c] = cum/1326; }); })();
function handClass(cards){ const [a,b] = cards.slice().sort((x,y)=>rv(y)-rv(x)); return a[0]===b[0] ? a[0]+b[0] : a[0]+b[0]+(a[1]===b[1]?'s':'o'); }
const pfPct = cards => PF_PCT[handClass(cards)] ?? 1;

// 레인지 표기("22+, ATs+, A5s-A2s, KQo")를 패 집합으로
function expandRange(str){
  const out = new Set(), R = RANKS, ri = c => R.indexOf(c);
  str.split(',').map(t=>t.trim()).filter(Boolean).forEach(t=>{
    const [a, b] = t.split('-'); const plus = a.endsWith('+'); const x = a.replace('+','');
    if (x[0]===x[1]){ // 페어
      const lo = ri(x[0]), hi = b ? ri(b[0]) : (plus ? 12 : lo);
      for (let k=Math.min(lo,hi); k<=Math.max(lo,hi); k++) out.add(R[k]+R[k]);
    } else {
      const hiC = x[0], s = x[2], lo = ri(x[1]);
      const top = b ? ri(b[1]) : (plus ? ri(hiC)-1 : lo);
      for (let k=Math.min(lo,top); k<=Math.max(lo,top); k++) out.add(hiC+R[k]+s);
    }
  });
  return out;
}
const OPEN_RANGE = {
  UTG: expandRange('22+, ATs+, A5s-A2s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo'),
  HJ:  expandRange('22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, ATo+, KJo+'),
  CO:  expandRange('22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, 54s, A8o+, KTo+, QJo'),
  BTN: expandRange('22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o'),
  SB:  expandRange('22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 76s, 65s, 54s, A5o+, K9o+, QTo+, JTo'),
};
const OPEN_PCT = {UTG:.143, HJ:.189, CO:.255, BTN:.433, SB:.33, HUSB:.6, BB:.35};
const PUSH_PCT = {UTG:.18, HJ:.22, CO:.32, BTN:.43, SB:.62, HUSB:.6, BB:.4};   // 10BB 기준 올인 범위
const BLUFF3 = new Set(['A5s','A4s','A3s','A2s','KTs','K9s','QTs','J9s','T9s','98s','87s','76s','65s']);

function posOf(s, i){
  const live = p=>p.inHand;
  if (idxs(s, live).length===2) return i===s.dealer ? 'HUSB' : 'BB';
  if (i===s.sbI) return 'SB'; if (i===s.bbI) return 'BB'; if (i===s.dealer) return 'BTN';
  let k = 0, x = i; while (x!==s.dealer && k<10){ x = nextIdx(s, x, live); k++; }
  return k===1 ? 'CO' : k===2 ? 'HJ' : 'UTG';
}
// 플랍 이후 마지막에 액션하는(포지션이 좋은) 사람인지
function inPosition(s, i){
  const live = idxs(s, p=>p.inHand && !p.folded && !p.allin); if (!live.length) return true;
  const N = s.seats.length, ord = j => (j - s.dealer - 1 + N) % N;
  return live.every(j=>ord(j) <= ord(i));
}

// ---------- 보드·패 읽기 ----------
// 내 카드가 들어간 족보인지 빠르게 판단 (0: 아무것도 아님, 1: 드로우, 2: 내 카드로 페어 이상)
function quickMade(hole, board){
  if (board.length<3) return 0;
  if (hole[0][0]===hole[1][0]) return 2;
  const br = new Set(board.map(c=>c[0])); if (br.has(hole[0][0]) || br.has(hole[1][0])) return 2;
  const all = hole.concat(board);
  for (const st of 'shdc'){ const n = all.filter(c=>c[1]===st).length, mine = hole.some(c=>c[1]===st); if (mine && n>=5) return 2; if (mine && n===4 && board.length<5) return 1; }
  const vals = new Set(all.map(rv)); if (vals.has(14)) vals.add(1);
  const hv = new Set(hole.map(rv).flatMap(v=>v===14?[14,1]:[v]));
  for (let lo=1; lo<=10; lo++){ let n=0, mine=false; for (let v=lo; v<lo+5; v++) if (vals.has(v)){ n++; if (hv.has(v)) mine=true; } if (mine && n===5) return 2; if (mine && n===4 && board.length<5) return 1; }
  return 0;
}
// 드로우 아웃츠 (플러시 드로우 9, 양방향 8, 거트샷 4)
function drawOuts(hole, board){
  if (board.length<3 || board.length>=5) return 0;
  const all = hole.concat(board); let outs = 0;
  for (const st of 'shdc'){ const n = all.filter(c=>c[1]===st).length; if (n===4 && hole.some(c=>c[1]===st)) outs += 9; }
  const vals = new Set(all.map(rv)); if (vals.has(14)) vals.add(1);
  const hv = new Set(hole.map(rv).flatMap(v=>v===14?[14,1]:[v]));
  let oesd = false, gut = false;
  for (let lo=1; lo<=11; lo++){ const w = [lo,lo+1,lo+2,lo+3]; if (w.every(v=>vals.has(v)) && w.some(v=>hv.has(v)) && lo>1 && lo+3<14) oesd = true; }
  for (let lo=1; lo<=10; lo++){ let n=0, mine=false; for (let v=lo; v<lo+5; v++) if (vals.has(v)){ n++; if (hv.has(v)) mine=true; } if (n===4 && mine) gut = true; }
  if (oesd) outs += 8; else if (gut) outs += 4;
  return Math.min(outs, 15);
}
function boardWet(board){
  const b = board.slice(0, 3); if (b.length<3) return false;
  const suits = {}; b.forEach(c=>suits[c[1]]=(suits[c[1]]||0)+1);
  const v = b.map(rv).sort((x,y)=>x-y);
  return Math.max(...Object.values(suits))>=2 && (v[2]-v[0]<=4) || Math.max(...Object.values(suits))===3 || (v[2]-v[0]<=3 && new Set(v).size===3);
}

// ---------- 상대 레인지 추정 ----------
function statsOf(s, id){ return (s.stats && s.stats[id]) || null; }
function oppModel(s, j, read){
  const q = s.seats[j], st = statsOf(s, q.id), ag = q.ag || {}, cs = q.cs || {};
  if (!read) return {width: 1, streets: [], bluff: 1};
  let width;
  const pfr = ag.preflop || 0;
  if (pfr>=2) width = .05; else if (pfr===1) width = (s.pfRaises||0)>=2 && s.pfAgg!==j ? .2 : .22;
  else if (q.vp) width = .4; else width = 1;
  if (read>=2 && st && st.h>=8){ // 하드: 실제로 본 상대 성향 반영
    const vpip = st.vp/st.h, pfrR = st.pr/st.h;
    if (pfr===1) width = Math.max(.08, Math.min(.5, pfrR*1.1));
    else if (q.vp && !pfr) width = Math.max(.15, Math.min(.8, vpip));
  }
  if (q.allin && (s.stage==='preflop' || pfr)) width = Math.min(width, (q.total/(s.bb||20))<=15 ? .3 : .08);
  // 공격한 스트리트(베팅·레이즈)와 콜한 스트리트
  const streets = [];
  [['flop',3],['turn',4],['river',5]].forEach(([k,n])=>{ if (ag[k]) streets.push({n, need: 2}); else if (cs[k]) streets.push({n, need: 1}); });
  let bluff = .3;
  if (read>=2 && st){
    // 쇼다운에서 확인한 실제 블러핑 비율 (적게 보면 기본값 쪽으로)
    const sa = st.sa||0, sb = st.sbl||0;
    bluff = (sb + 1) / (sa + 4);
    if (st.pb>=6) bluff = (bluff*2 + Math.min(.6, .1 + (st.pa/(st.pa+st.pc+1))*.4)) / 3;
    bluff = Math.max(.08, Math.min(.6, bluff));
  }
  if (q.allin) bluff *= .6;
  return {width, streets, bluff};
}
// 상대 레인지를 고려한 승률 (몬테카를로)
function rangeEquity(s, i, iters, read){
  const me = s.seats[i], board = s.board;
  const opps = idxs(s,(q,j)=>j!==i && q.inHand && !q.folded).map(j=>oppModel(s, j, read));
  const used = new Set(me.cards.concat(board)); const rest = FULL.filter(c=>!used.has(c));
  const need = 5 - board.length; let w = 0;
  const ok = (m, h) => {
    if (m.width < 1 && pfPct(h) > m.width && Math.random() > .04) return false;
    for (const st of m.streets){
      const made = quickMade(h, board.slice(0, st.n));
      if (st.need===2 && made===0 && Math.random() > m.bluff) return false;
      if (st.need===1 && made===0 && Math.random() > .35) return false;
    }
    return true;
  };
  for (let t=0; t<iters; t++){
    // 남은 카드 섞기
    for (let k=0;k<rest.length;k++){ const j = k + Math.floor(Math.random()*(rest.length-k)); [rest[k],rest[j]]=[rest[j],rest[k]]; }
    let ptr = 0; const taken = new Set(); const hands = [];
    for (const m of opps){
      let h = null;
      for (let tries=0; tries<30; tries++){
        const a = rest[ptr % rest.length], b = rest[(ptr+1) % rest.length]; ptr += 2;
        if (taken.has(a) || taken.has(b)) continue;
        h = [a,b]; if (ok(m, h)) break;
      }
      if (!h) h = rest.filter(c=>!taken.has(c)).slice(0, 2);
      h.forEach(c=>taken.add(c)); hands.push(h);
    }
    const remain = rest.filter(c=>!taken.has(c));
    const b = board.concat(remain.slice(0, need));
    const mine = best(me.cards.concat(b)).score; let top = 0;
    for (const h of hands){ const sc = best(h.concat(b)).score; if (sc>top) top = sc; }
    if (mine>top) w += 1; else if (mine===top) w += .5;
  }
  return w/iters;
}

// ---------- 난이도별 성향 ----------
const BOT_PROFILES = {
  // 이지: 초보(루즈-패시브). 패를 많이 보고 잘 따라가지만, 레이즈·블러핑은 거의 없음. 큰 베팅엔 겁먹음.
  easy:   {read:0, iters:160, noise:.14, cbet:0, semi:.05, riverBluff:0, valueEq:[.72,.75,.78], raiseEq:.9, shoveEq:.88, callMargin:-.06},
  // 노멀: 정석(ABC). 포지션 표를 조금 타이트하게 지키고, 좋은 패는 베팅, 팟 오즈대로 콜. 블러핑은 가끔.
  normal: {read:1, iters:260, noise:.04, cbet:.55, semi:.3, riverBluff:.08, valueEq:[.62,.64,.68], raiseEq:.8, shoveEq:.66, callMargin:.03},
  // 하드: 프로 스타일(TAG/LAG). 포지션별 레인지, 상대 레인지 읽기, 보드에 맞춘 베팅 크기, 세미블러핑·리버 블러핑, 상대 성향 파악.
  hard:   {read:2, iters:340, noise:0, cbet:.72, semi:.5, riverBluff:.3, valueEq:[.58,.6,.6], raiseEq:.74, shoveEq:.6, callMargin:0},
};

function botDecide(s, i){
  const lv0 = s.seats[i].lvl || s.level, lv = BOT_PROFILES[lv0] ? lv0 : 'normal', P = BOT_PROFILES[lv];
  const p = s.seats[i], L = legal(s, i), BBv = s.bb || BB;
  const per = p.per || {};
  const r = Math.random();
  const live = idxs(s, q=>q.inHand && !q.folded);
  const nOpp = Math.max(1, live.length - 1);
  const pot = potSize(s);
  const stack = p.chips + p.bet;
  const oppMax = Math.max(...live.filter(j=>j!==i).map(j=>s.seats[j].chips + s.seats[j].bet));
  const eff = Math.min(stack, oppMax);                // 유효 스택
  const round = v => Math.max(BBv, Math.round(v / (BBv>=100 ? 50 : 10)) * (BBv>=100 ? 50 : 10));
  const need = L.callAmt > 0 ? L.callAmt / (pot + L.callAmt) : 0;
  const call = {type:'call'}, check = {type:'check'}, fold = {type:'fold'};
  const allin = {type:'raise', to:L.maxTo};
  const passive = () => L.canCheck ? check : fold;
  // 올인이 되는 큰 베팅은 충분히 강할 때만
  const raiseTo = (to, eq) => {
    if (!L.canRaise) return L.canCheck ? check : call;
    to = Math.max(L.minTo, Math.min(round(to), L.maxTo));
    const commit = (to - p.bet) / Math.max(1, p.chips);
    if (to >= L.maxTo || commit > .6){
      if (eq >= P.shoveEq) return allin;
      if (L.canCheck) return check;
      return eq >= need + P.callMargin ? call : fold;
    }
    return {type:'raise', to};
  };

  if (s.stage === 'preflop') return preflopDecide();
  return postflopDecide();

  // ===================== 프리플랍 =====================
  function preflopDecide(){
    const cls = handClass(p.cards), pct = pfPct(p.cards), pos = posOf(s, i);
    const raises = s.pfRaises || 0;
    const callBB = L.callAmt / BBv, effBB = eff / BBv;
    const pair = cls.length===2, ip = pos==='BTN' || pos==='CO' || pos==='HUSB';
    const limpers = idxs(s, (q,j)=>j!==i && q.inHand && !q.folded && q.bet===BBv && j!==s.bbI).length;
    const facingAllin = L.callAmt >= p.chips || live.some(j=>j!==i && s.seats[j].allin && s.seats[j].bet > p.bet);
    const premium = ['AA','KK','QQ','AKs','AKo'].includes(cls);

    if (lv==='easy'){
      // 초보: 좋아 보이는 패(페어·에이스·같은 무늬·그림 두 장)면 일단 따라감, 진짜 좋은 패만 레이즈
      const looksGood = pair || cls[0]==='A' || cls[2]==='s' || (rv(cls[0]+'s')>=10 && rv(cls[1]+'s')>=10);
      if (facingAllin || callBB > stack/BBv*.35) return (['AA','KK','QQ','AKs'].includes(cls) || (cls==='JJ' && r<.5)) ? call : fold;
      if (raises===0){
        if (premium && L.canRaise && r < .7) return raiseTo(BBv*(2 + Math.random()), .9);
        if (L.canCheck) return check;
        return looksGood || pct < .55 || r < .1 ? call : fold;
      }
      if (['AA','KK'].includes(cls) && L.canRaise && (p.ag?.preflop||0)===0 && r<.6) return raiseTo(s.currentBet*2.5, .9);
      if (callBB <= 4) return (looksGood || pct < .45) ? call : fold;
      if (callBB <= 12) return pct < .18 || pair ? call : fold;
      return pct < .05 ? call : fold;
    }

    // ---- 숏스택: 올인 아니면 폴드 ----
    if (effBB <= (lv==='hard' ? 12 : 10)){
      if (facingAllin || (raises>=1 && callBB > effBB*.3)){
        const shoverBB = Math.max(...live.filter(j=>j!==i).map(j=>s.seats[j].total)) / BBv;
        let callPct = shoverBB <= 12 ? (pos==='BB' ? .19 : .1) : .05;
        if (lv==='normal') callPct *= .8;
        return pct <= callPct ? call : fold;
      }
      let pushPct = PUSH_PCT[pos] * (effBB <= 6 ? 1.4 : effBB <= 8 ? 1.15 : 1);
      if (lv==='normal') pushPct *= .75;
      if (raises===0 && pct <= pushPct) return allin;
      if (raises>=1 && pct <= .06) return allin;
      return passive();
    }

    // ---- 상대가 올인 (스택이 깊을 때) ----
    if (facingAllin){
      const eq = rangeEquity(s, i, lv==='hard' ? 300 : 180, P.read);
      return eq >= need + (lv==='hard' ? .01 : .05) ? call : fold;
    }

    const style = lv==='hard' ? (per.style || 'tag') : 'abc';
    // ---- 아무도 레이즈 안 함: 오픈 ----
    if (raises===0){
      let inRange;
      if (lv==='hard'){
        const key = pos==='HUSB' ? 'BTN' : pos==='BB' ? null : pos;
        inRange = key ? OPEN_RANGE[key].has(cls) || (style==='lag' && pct <= OPEN_PCT[key] + .05) || (pos==='HUSB' && pct <= .6) : pct <= .12;
      } else {
        // 노멀: 표보다 한 단계 타이트 (초반 자리는 UTG 표, 늦은 자리는 한 칸 앞 표)
        const key = {UTG:'UTG', HJ:'UTG', CO:'HJ', BTN:'CO', SB:'HJ', HUSB:'CO'}[pos];
        inRange = key ? OPEN_RANGE[key].has(cls) : pct <= .08;
      }
      if (inRange && L.canRaise){
        const size = lv==='hard' ? (pos==='SB' ? 3 : limpers ? 3.5 : 2.5) : 3;
        return raiseTo(BBv*(size + limpers), .9);
      }
      if (L.canCheck) return check;
      // 들어온 사람이 있으면 작은 페어·같은 무늬 연결 패로 싸게 따라가기
      if (limpers && callBB <= 1 && (pair || /^(T9|98|87|76|65|A.)s$/.test(cls)) && r < (lv==='hard' ? .6 : .45)) return call;
      if (pos==='SB' && callBB <= .5 && pct <= (lv==='hard' ? .5 : .35)) return call;
      return fold;
    }

    // 레이즈한 사람 레인지 추정
    const raiser = s.pfAgg >= 0 ? s.pfAgg : -1;
    const width = raiser>=0 ? oppModel(s, raiser, P.read).width : .2;
    const setMine = pair && L.callAmt <= eff * .07;
    const iOpened = (p.ag?.preflop || 0) > 0;

    // ---- 레이즈 한 번: 3벳 / 콜 / 폴드 ----
    if (raises===1){
      if (lv==='hard'){
        const valueT = Math.max(.023, width * .22);
        const size = s.currentBet * (ip ? 3 : 4);
        if (pct <= valueT && L.canRaise) return raiseTo(size, .9);
        if (BLUFF3.has(cls) && L.canRaise && r < (style==='lag' ? .45 : .28) * (ip ? 1 : .7)) return raiseTo(size, .5);
        if (setMine) return call;
        const callT = pos==='BB' ? Math.min(.55, width + (callBB <= 2.5 ? .2 : .08)) : width * (ip ? .6 : .4);
        if (pct <= callT && callBB <= 12) return call;
        return fold;
      }
      // 노멀
      if (['AA','KK','QQ','JJ','AKs','AKo'].includes(cls) && L.canRaise) return raiseTo(s.currentBet*3, .9);
      if (setMine && r < .8) return call;
      if (pct <= (pos==='BB' && callBB <= 3 ? .3 : .12) && callBB <= 10) return call;
      return fold;
    }

    // ---- 3벳 이상을 받음 ----
    if (lv==='hard'){
      const fourBet = s.currentBet * 2.3;
      if (['AA','KK'].includes(cls)) return raiseTo(fourBet, .95);
      if (['QQ','AKs','AKo'].includes(cls)) return (raises>=3 || L.callAmt > eff*.3) ? allin : (r < .4 ? raiseTo(fourBet, .9) : call);
      if (iOpened && cls==='A5s' && raises===2 && r < .15) return raiseTo(fourBet, .4);
      if (raises===2 && (['JJ','TT','AQs','AJs','KQs'].includes(cls) || (setMine && ip)) && L.callAmt <= eff*.25) return call;
      return fold;
    }
    if (['AA','KK'].includes(cls)) return raises>=3 ? allin : raiseTo(s.currentBet*2.3, .95);
    if (['QQ','AKs','AKo'].includes(cls) && L.callAmt <= eff*.35) return call;
    if (['JJ','TT'].includes(cls) && raises===2 && L.callAmt <= eff*.15) return call;
    return fold;
  }

  // ===================== 플랍 이후 =====================
  function postflopDecide(){
    const street = s.stage, si = {flop:0, turn:1, river:2}[street];
    let eq = lv==='easy'
      ? equity(p.cards, s.board, nOpp, P.iters) + (Math.random()-.5)*2*P.noise
      : rangeEquity(s, i, P.iters, P.read) + (Math.random()-.5)*2*P.noise;
    const made = quickMade(p.cards, s.board), outs = drawOuts(p.cards, s.board);
    const wet = boardWet(s.board), ip = inPosition(s, i);
    const aggressor = s.pfAgg === i;
    const heads = nOpp === 1;
    const myStreetRaises = (p.ag && p.ag[street]) || 0;
    // 상대들의 성향 (하드만)
    let bluffMul = 1, thin = 0;
    if (lv==='hard'){
      const os = live.filter(j=>j!==i).map(j=>statsOf(s, s.seats[j].id)).filter(x=>x && x.fb>=6);
      if (os.length){
        const foldRate = os.reduce((a,x)=>a + x.ff/x.fb, 0)/os.length;
        bluffMul = foldRate > .55 ? 1.6 : foldRate < .3 ? .35 : 1;   // 잘 접는 상대에겐 블러핑↑, 안 접는 상대에겐 블러핑↓
        thin = foldRate < .3 ? .05 : 0;                               // 잘 안 접으면 가치 베팅을 더 얇게
      }
      if (per.style==='lag') bluffMul *= 1.3;
    }
    const potFrac = f => s.currentBet + (pot + L.callAmt) * f;

    if (lv==='easy'){
      // 초보: 내 카드로 페어 이상이면 따라가고, 진짜 강하면 작게 베팅. 블러핑 없음.
      if (L.canCheck){
        if (eq >= P.valueEq[si] && made===2 && L.canRaise) return raiseTo(potFrac(.3 + Math.random()*.25), eq);
        return check;
      }
      const betFrac = L.callAmt / Math.max(1, pot - L.callAmt);
      if (L.callAmt >= p.chips*.5) return (made===2 && eq >= .62) ? call : fold;         // 큰 베팅·올인엔 겁먹음
      if (eq >= P.raiseEq && L.canRaise && myStreetRaises===0 && r < .5) return raiseTo(s.currentBet*2.5, eq);
      if (made===2 && betFrac <= 1) return call;                                          // 페어만 있으면 끝까지
      if (made===1 && betFrac <= .6 && street!=='river') return call;                     // 드로우도 자주 따라감
      if (eq >= need + P.callMargin && betFrac <= .5) return call;
      return fold;
    }

    if (L.canCheck){
      // 1) 가치 베팅
      const vT = P.valueEq[si] + (heads ? 0 : .08) - thin;
      if (eq >= vT && L.canRaise){
        let f = wet ? .66 : .45;
        if (street==='river') f = eq >= .85 ? .8 : (lv==='hard' && eq < .7 ? .4 : .6);
        if (lv==='hard' && eq >= .85 && !wet && street==='flop' && r < .3) return check;  // 아주 강하면 가끔 슬로플레이
        return raiseTo(potFrac(f + (Math.random()-.5)*.1), eq);
      }
      // 2) 콘티뉴에이션 베팅 (프리플랍 레이저, 헤즈업)
      if (street==='flop' && aggressor && heads && L.canRaise && r < P.cbet * (wet ? .6 : 1) * (lv==='hard' ? Math.min(1.3, bluffMul) : 1))
        return raiseTo(potFrac(wet ? .6 : .33), eq);
      // 3) 세미블러핑 (강한 드로우)
      if (outs >= 8 && street!=='river' && L.canRaise && r < P.semi * (heads ? 1 : .5))
        return raiseTo(potFrac(.55), eq);
      // 4) 턴 지연 베팅 / 리버 블러핑 (하드·노멀, 헤즈업)
      if (heads && L.canRaise && eq < .25){
        if (street==='turn' && lv==='hard' && ip && r < .3 * bluffMul) return raiseTo(potFrac(.5), eq);
        if (street==='river' && (aggressor || lv==='hard') && r < P.riverBluff * bluffMul) return raiseTo(potFrac(.66), eq);
      }
      return check;
    }

    // ---- 베팅을 받음 ----
    const implied = outs >= 8 && street!=='river' ? (lv==='hard' ? .05 : .03) : 0;
    const bigCall = L.callAmt >= p.chips * .5;
    // 레이즈: 가치(아주 강함) 또는 하드의 세미블러핑 레이즈
    if (L.canRaise && myStreetRaises < 2){
      const rT = P.raiseEq + (street==='river' ? .06 : 0) + (heads ? 0 : .05);
      if (eq >= rT) return raiseTo(s.currentBet * (2.6 + Math.random()*.6) + (pot - L.callAmt - s.currentBet) * .3, eq);
      if (lv==='hard' && street==='flop' && heads && outs >= 9 && r < .2 * bluffMul && !bigCall) return raiseTo(s.currentBet * 3, eq);
    }
    // 콜: 팟 오즈(+드로우의 임플라이드 오즈)
    const margin = P.callMargin + (bigCall && lv==='normal' ? .04 : 0);
    if (eq + implied >= need + margin) return call;
    return fold;
  }
}
