/* 배경음악 원곡 '라운지 블러프' 작곡·합성 코드 (이 앱 전용 창작곡, 외부 음원 없음)
   구성: 시작할 때 한 번만 나오는 인트로(벨 '띵' + 낮은 브라스·베이스 스탭 + 드럼 히트, 2마디) → 32마디 본곡 반복
   브라우저 콘솔에서 renderMusic(44100) 을 실행하면 AudioBuffer가 만들어지고 (buf.loopStart ~ buf.loopEnd 구간이 반복 구간),
   이것을 WAV로 저장한 뒤 MP3(96kbps)로 변환한 것이 audio/lounge.mp3 입니다.
   휴대폰에서 매번 합성하면 수십 초가 걸려서, 미리 만들어 둔 파일을 씁니다. */
async function renderMusic(rate, bars, solo, ending){
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // 템포: 1~16마디 96 → 17~20마디 점점 빨라짐 → 21~28마디 114로 달림 → 29~32마디 다시 96으로 (반복 이음매 자연스럽게)
  const BARS = bars || 32;
  const bpmOf = bar => bar < 16 ? 96 : bar < 20 ? 96 + (bar - 15) * 4.5 : bar < 28 ? 114 : 114 - (bar - 27) * 4.5;
  const IB = .42, PRE = 10 * IB, TAIL = 2; // 인트로: 0.42초 간격 히트 8번 + 2박 숨 고르기, 끝 잔향은 반복 시작 부분에 겹쳐 넣음
  const beatOf = [], startOf = [PRE];
  for (let b = 0; b < BARS; b++){ beatOf.push(60 / bpmOf(b)); startOf.push(startOf[b] + 4 * beatOf[b]); }
  const LEN = startOf[BARS];
  const sr = Math.min(rate || 44100, 44100);
  const END_LEN = ending ? 2 * 4 * 60 / 96 + 3 : 0;
  const ctx = new OAC(2, Math.ceil((LEN + TAIL + END_LEN) * sr), sr);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // 리버브 (작은 재즈바 느낌)
  const rev = ctx.createConvolver(); const irLen = Math.floor(sr * 1.6); const ir = ctx.createBuffer(2, irLen, sr);
  for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
  rev.buffer = ir;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(ctx.destination);
  const dry = ctx.createGain(); dry.gain.value = 1; dry.connect(comp);
  const wet = ctx.createGain(); wet.gain.value = .22; rev.connect(wet); wet.connect(comp);
  const bus = (g, verb, pan) => { const n = ctx.createGain(); n.gain.value = g; let o = n; if (ctx.createStereoPanner && pan){ const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); o = p; } o.connect(dry); if (verb){ const s = ctx.createGain(); s.gain.value = verb; o.connect(s); s.connect(rev); } return n; };
  const epBus = bus(.16, .8, -.15), bassBus = bus(.16, .15, 0), vibBus = bus(.4, 1, .2), drumBus = bus(1.6, .3, .1), padBus = bus(.05, 1, 0);
  const brassBus = bus(.2, .6, 0), bellBus = bus(.22, .9, .1);
  if (solo) [['ep',epBus],['bass',bassBus],['vib',vibBus],['drum',drumBus],['pad',padBus]].forEach(([n,g])=>{ if (n!==solo) g.gain.value = 0; });
  const noise = ctx.createBuffer(1, sr, sr); { const d = noise.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; }
  const env = (g, t, a, peak, dec, end) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, dec); if (end) { g.gain.setTargetAtTime(0, end, .05); } };
  const osc = (type, f, t, stop, out) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(out); o.start(t); o.stop(stop); return o; };
  const noiseHit = (t, dur, type, f, q, peak, dec, out) => { const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); env(g, t, .002, peak, dec); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, rnd() * .5, dur); };

  // 화음 (D단조 16마디, 두 번 반복) : [베이스 루트, 화음 종류, 일렉피아노 보이싱]
  const PROG = [
    [38,'m',[53,57,60,64]], [38,'m',[53,57,59,64]], [34,'M',[50,53,57,60]], [33,'7',[55,58,61,64]],
    [38,'m',[53,57,60,64]], [38,'m',[53,57,59,64]], [31,'m',[53,57,58,62]], [33,'7',[55,58,61,65]],
    [34,'M',[50,53,57,60]], [34,'M',[50,55,57,62]], [31,'m',[53,57,58,62]], [36,'7',[52,55,58,62]],
    [40,'h',[50,55,58,64]], [33,'7',[55,58,61,64]], [38,'m',[53,57,60,64]], [33,'7',[55,58,61,65]],
  ];
  // 멜로디 (비브라폰) [마디, 박, 음, 길이(박)]
  const MEL = [
    [0,0,69,1.5],[0,1.67,74,.33],[0,2,77,1],[0,3,76,1],[1,0,74,3],
    [2,.67,77,.33],[2,1,74,1],[2,2,69,2],[3,0,70,1],[3,1,73,1],[3,2,76,1],[3,3,79,1],
    [4,0,77,2],[4,2,76,.67],[4,2.67,74,1.33],[5,1,69,1],[5,2,71,1],[5,3,74,1],
    [6,0,77,1.5],[6,1.67,74,.33],[6,2,70,2],[7,0,73,1],[7,1,76,.67],[7,1.67,79,.33],[7,2,77,1],[7,3,73,1],
    [8,0,74,3],[8,3,72,1],[9,0,69,2],[9,2.67,74,.33],[9,3,77,1],
    [10,0,81,1.5],[10,1.67,79,.33],[10,2,77,1],[10,3,74,1],[11,0,76,2],[11,2,79,1],[11,3,82,1],
    [12,0,79,1],[12,1,77,.67],[12,1.67,74,.33],[12,2,70,2],[13,0,73,1],[13,1,70,1],[13,2,67,1],[13,3,64,1],
    [14,0,74,3.5],[15,1,73,.67],[15,1.67,76,.33],[15,2,79,1],[15,3,82,1],
  ];
  // 두 번째 반복은 긴장감 있게: 멜로디는 쉬고 도미넌트 마디에서만 짧은 비브라폰 필인
  const FILL = [[3,2,76,.67],[3,2.67,73,.33],[3,3,70,1],[7,2,79,.67],[7,2.67,77,.33],[7,3,73,1],[11,2.67,82,.33],[11,3,79,1],[15,1,76,.67],[15,1.67,73,.33],[15,2,70,1],[15,3,69,1]];
  const at = (bar, beat) => startOf[bar] + beat * beatOf[bar];

  const ep = (m, t, dur, vel) => { // 로즈 피아노 같은 FM 음색
    const f = hz(m), end = t + dur, stop = end + .5;
    const g = ctx.createGain(); env(g, t, .006, vel, .9, end); g.connect(epBus);
    const car = osc('sine', f, t, stop, g);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.4, t); mg.gain.setTargetAtTime(f * .15, t, .18);
    osc('sine', f, t, stop, mg); mg.connect(car.frequency);
    const tg = ctx.createGain(); env(tg, t, .002, vel * .18, .06); tg.connect(epBus); osc('sine', f * 7.1, t, t + .4, tg);
  };
  const bass = (m, t, dur, vel) => {
    const f = hz(m), end = t + dur * .92;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.setTargetAtTime(420, t, .08); lp.connect(bassBus);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .012); g.gain.setTargetAtTime(vel * .55, t + .012, .12); g.gain.setTargetAtTime(0, end, .04); g.connect(lp);
    osc('triangle', f, t, end + .3, g); const g2 = ctx.createGain(); g2.gain.value = .7; g2.connect(g); osc('sine', f, t, end + .3, g2);
  };
  const vib = (m, t, dur, vel) => {
    const f = hz(m), stop = t + dur + 1.8;
    const g = ctx.createGain(); env(g, t, .003, vel, .7 + dur * .25);
    const trem = ctx.createGain(); trem.gain.value = 1; const ld = ctx.createGain(); ld.gain.value = .28; ld.connect(trem.gain); osc('sine', 5.2, t, stop, ld);
    g.connect(trem); trem.connect(vibBus);
    osc('sine', f, t, stop, g); const h = ctx.createGain(); env(h, t, .002, vel * .35, .08); h.connect(vibBus); osc('sine', f * 4, t, t + .5, h);
  };
  const ride = (t, acc) => { noiseHit(t, .9, 'highpass', 6000, .5, .07 * acc, .22, drumBus); noiseHit(t, .05, 'bandpass', 4200, 2, .05 * acc, .012, drumBus); };
  const hat = t => noiseHit(t, .1, 'highpass', 7500, .7, .06, .025, drumBus);
  const brush = (t, v) => { const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(2200, t); fl.frequency.linearRampToValueAtTime(3800, t + .2); fl.Q.value = .6; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .03); g.gain.setTargetAtTime(0, t + .05, .07); s.connect(fl); fl.connect(g); g.connect(drumBus); s.start(t, rnd() * .5, .5); };
  const kick = (t, v) => { const g = ctx.createGain(); env(g, t, .004, v * .6, .07); g.connect(drumBus); const o = osc('sine', 70, t, t + .4, g); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(44, t + .2); };

  const SW = 2 / 3; // 스윙 8분음표
  const COMP = [[[0,.9,.85],[1+SW,.3,.7]], [[SW,.3,.75],[2,1.2,.8]], [[0,.5,.8],[2+SW,1,.75]], [[1+SW,.3,.7],[3,.6,.75]], [[0,2,.85]]];
  for (let bar = 0; bar < BARS; bar++){
    const [root, q, voic] = PROG[bar % 16], next = PROG[(bar + 1) % 16][0];
    const B = beatOf[bar], BAR = 4 * B, fast = bar >= 20 && bar < 28;
    const T = at(bar, 0), second = bar >= 16;
    // 일렉 피아노 컴핑
    const pat = COMP[Math.floor(rnd() * COMP.length)];
    pat.forEach(([bt, du, v]) => voic.forEach((m, k) => ep(m, T + bt * B + k * .008, du * B, v * (second ? .95 : .8))));
    // 워킹 베이스
    const third = q === 'm' || q === 'h' ? 3 : 4, fifth = q === 'h' ? 6 : 7;
    let line = [root, root + (rnd() < .5 ? third : 12), root + fifth, next + (rnd() < .5 ? 1 : -1)];
    if (bar % 4 === 3 && rnd() < .5) line = [root, root + fifth, root + third, next + 1];
    line.forEach((m, k) => { while (m > 50) m -= 12; while (m < 28) m += 12; bass(m, T + k * B, B, k ? .8 : .95); });
    // 드럼 (라이드 + 하이햇 2·4 + 브러시)
    [[0,.8],[1,1],[1+SW,.55],[2,.8],[3,1],[3+SW,.55]].forEach(([bt, a]) => ride(T + bt * B, a * (second ? 1 : .85)));
    hat(T + B); hat(T + 3 * B);
    brush(T + B, .14); brush(T + 3 * B, .16); if (rnd() < .4) brush(T + (2 + SW) * B, .06);
    kick(T, .32); if (rnd() < .3) kick(T + (2 + SW) * B, .18);
    if (fast){ kick(T + 2 * B, .22); ride(T + (SW) * B, .4); ride(T + (2 + SW) * B, .5); hat(T + (1 + SW) * B); }
    if (bar % 8 === 7) { brush(T + (3 + SW) * B, .12); kick(T + (3 + SW) * B, .25); }
    // 낮게 깔리는 긴장감 패드 (마지막 4마디마다)
    if (bar % 16 >= 12){ const g = ctx.createGain(); env(g, T, .8, 1, 1.4, T + BAR - .1); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; g.connect(lp); lp.connect(padBus); osc('sawtooth', hz(root + 12), T, T + BAR + .6, g); osc('sawtooth', hz(root + 12) * 1.004, T, T + BAR + .6, g); }
  }
  MEL.forEach(([bar, bt, m, d]) => { if (bar < BARS) vib(m, at(bar, bt), d * beatOf[bar], .55); });
  // 빨라지는 구간(21~28마디)에서 주제 멜로디가 다시 나옴
  MEL.forEach(([bar, bt, m, d]) => { const b2 = bar + 20; if (bar < 8 && b2 < BARS) vib(m, at(b2, bt), d * beatOf[b2], .6); });
  FILL.forEach(([bar, bt, m, d]) => { const b2 = bar + 16; if ((bar === 3 || bar === 15) && b2 < BARS) vib(m, at(b2, bt), d * beatOf[b2], .45); });

  // ---------- 인트로: 벨 '띵~' + 스톱타임 리프 ----------
  const bell = (t, f, vel) => { // 데스크벨/코인 같은 맑은 금속음 (배음 비율 1 : 2.56 : 4.54 : 6.85)
    [[1, 1, 1.1], [2.56, .55, .6], [4.54, .9, .35], [6.85, .4, .2]].forEach(([r, a, d]) => { const g = ctx.createGain(); env(g, t, .002, vel * a, d); g.connect(bellBus); osc('sine', f * r, t, t + d * 7, g); });
    noiseHit(t, .03, 'highpass', 7000, .7, vel * .5, .006, bellBus);
  };
  const brass = (m, t, dur, vel) => {
    const f = hz(m), end = t + dur;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1300, t + .03); lp.frequency.setTargetAtTime(480, t + .03, .1); lp.connect(brassBus);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .015); g.gain.setTargetAtTime(vel * .7, t + .015, .12); g.gain.setTargetAtTime(0, end, .04); g.connect(lp);
    osc('sawtooth', f, t, end + .3, g); osc('triangle', f * 1.004, t, end + .3, g); const sub = ctx.createGain(); sub.gain.value = .8; sub.connect(g); osc('triangle', f / 2, t, end + .3, sub);
  };
  const snare = (t, v) => { noiseHit(t, .25, 'bandpass', 1900, .8, v, .07, drumBus); const g = ctx.createGain(); env(g, t, .002, v * .5, .04); g.connect(drumBus); osc('triangle', 190, t, t + .3, g); };
  const crash = (t, v) => noiseHit(t, 1, 'highpass', 4500, .5, v, .45, drumBus);
  { const Bp = IB;
    bell(.02, 1396.9, .9);                       // 시작 '띵~'
    crash(.02, .04); kick(.02, .45);
    // 리프: D → D(옥타브 위) → A → A | B♭ → A → G# → A  (마지막에 스네어 몰아치며 본곡으로)
    [[0,38],[1,50],[2,45],[3,45],[4,46],[5,45],[6,44],[7,45]].forEach(([bt, m], k) => {
      const t = .02 + bt * Bp, v = k === 0 ? 1 : .85;
      brass(m + 12, t, Bp * .92, .5 * v); bass(m, t, Bp * .95, .9 * v);
      kick(t, .35 * v); snare(t + (k % 2 ? 0 : .005), k === 0 ? .2 : .12 * v);
    });
    bell(.02 + 4 * Bp, 1396.9, .45);            // 둘째 마디 머리에 작은 '띵'
    [8, 8.5, 9, 9.25, 9.5, 9.75].forEach((bt, k) => snare(.02 + bt * Bp, .04 + k * .022)); // 본곡 들어가기 전 필인
  }

  // 메들리용 끝맺음: D단조 화음 + 벨 '띵'
  if (ending){
    const T = LEN, B = 60 / 96;
    [50, 53, 57, 60, 64].forEach(m => ep(m, T, 8 * B, .7)); bass(38, T, 6 * B, .95); vib(74, T, 8 * B, .5);
    kick(T, .45); crash(T, .05); bell(T, 1396.9, .6);
  }
  const raw = await ctx.startRendering();
  if (ending){
    const n = raw.length, fin = Math.floor(sr * 1.2); let peak = 0;
    for (let ch = 0; ch < 2; ch++){ const d = raw.getChannelData(ch); for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i])); }
    const k = .85 / peak;
    for (let ch = 0; ch < 2; ch++){ const d = raw.getChannelData(ch); for (let i = 0; i < n; i++){ let v = d[i] * k; if (i > n - fin) v *= (n - i) / fin; d[i] = v; } }
    raw.loopStart = PRE; raw.loopEnd = n / sr; return raw;
  }
  // 끝 잔향(TAIL)을 반복 시작 지점(PRE)에 겹쳐서, 반복될 때 소리가 뚝 끊기지 않게
  const n = Math.round(LEN * sr), p0 = Math.round(PRE * sr);
  const buf = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
  for (let ch = 0; ch < 2; ch++){ const src = raw.getChannelData(ch), d = buf.getChannelData(ch); d.set(src.subarray(0, n)); for (let i = n; i < src.length && p0 + i - n < n; i++) d[p0 + i - n] += src[i]; }
  // 크기 맞추기 + 맨 앞만 살짝 페이드
  let peak = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++){ const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++){ const v = Math.abs(d[i]); if (v > peak) peak = v; } }
  buf.rawPeak = peak;
  const k = peak > 0 ? .85 / peak : 1, fade = Math.floor(sr * .02);
  for (let ch = 0; ch < buf.numberOfChannels; ch++){ const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++){ let v = d[i] * k; if (i < fade) v *= i / fade; d[i] = v; } }
  buf.loopStart = PRE; buf.loopEnd = LEN; buf.loopLen = LEN - PRE;
  return buf;
}

