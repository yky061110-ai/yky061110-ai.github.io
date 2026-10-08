/* 배경음악 원곡 '라운지 블러프' 작곡·합성 코드 (이 앱 전용 창작곡, 외부 음원 없음)
   브라우저 콘솔에서 renderMusic(44100) 을 실행하면 80초짜리 AudioBuffer가 만들어지고,
   이것을 WAV로 저장한 뒤 MP3(96kbps)로 변환한 것이 audio/lounge.mp3 입니다.
   휴대폰에서 매번 합성하면 수십 초가 걸려서, 미리 만들어 둔 파일을 씁니다. */
async function renderMusic(rate, bars, solo){
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const BPM = 96, B = 60 / BPM, BAR = 4 * B, BARS = bars || 32, LEN = BARS * BAR;
  const sr = Math.min(rate || 44100, 44100);
  const ctx = new OAC(2, Math.ceil(LEN * sr), sr);
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
  const at = (bar, beat) => bar * BAR + beat * B;

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
    if (bar % 8 === 7) { brush(T + (3 + SW) * B, .12); kick(T + (3 + SW) * B, .25); }
    // 낮게 깔리는 긴장감 패드 (마지막 4마디마다)
    if (bar % 16 >= 12){ const g = ctx.createGain(); env(g, T, .8, 1, 1.4, T + BAR - .1); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; g.connect(lp); lp.connect(padBus); osc('sawtooth', hz(root + 12), T, T + BAR + .6, g); osc('sawtooth', hz(root + 12) * 1.004, T, T + BAR + .6, g); }
  }
  MEL.forEach(([bar, bt, m, d]) => vib(m, at(bar, bt), d * B, .55));
  FILL.forEach(([bar, bt, m, d]) => vib(m, at(bar + 16, bt), d * B, .45));

  const buf = await ctx.startRendering();
  // 크기 맞추기 + 이음매가 튀지 않게 앞뒤 살짝 페이드
  let peak = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++){ const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++){ const v = Math.abs(d[i]); if (v > peak) peak = v; } }
  buf.rawPeak = peak;
  const k = peak > 0 ? .85 / peak : 1, fade = Math.floor(sr * .02);
  for (let ch = 0; ch < buf.numberOfChannels; ch++){ const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++){ let v = d[i] * k; if (i < fade) v *= i / fade; else if (i > d.length - fade) v *= (d.length - i) / fade; d[i] = v; } }
  return buf;
}

