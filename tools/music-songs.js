/* 배경음악 메들리 2~6번 곡 작곡·합성 코드 (이 앱 전용 창작곡, 외부 음원 없음)
   renderSong('bossa' | 'spy' | 'ballad' | 'bigband' | 'tango') → AudioBuffer (끝맺음 포함)
   1번 곡 '라운지 블러프'는 music-compose.js */

const SONGS = {
  // 2. 하이 롤러 — 밝은 보사노바 (F장조, 124bpm): 분위기를 환하게 뒤집기
  bossa: {
    title: '하이 롤러', bpm: 124, swing: 0, key: 'F', minor: false,
    prog: [['F','M7'],['F','M7'],['G','m7'],['C','7'],['A','m7'],['D','7b9'],['G','m7'],['C','7'],
           ['F','M7'],['F','7'],['Bb','M7'],['Bb','m6'],['A','m7'],['D','7'],['G','m7'],['C','7']],
    choruses: 2, bass: 'bossa', drums: 'bossa', comp: 'pluck', lead: ['flute','vib'], pad: [false, true],
    range: [67, 84], rhythms: [[[0,1.5],[1.5,.5],[2,1],[3,.5],[3.5,.5]], [[.5,.5],[1,1],[2,1.5],[3.5,.5]], [[0,1],[1,.5],[1.5,1.5],[3,1]], [[0,3]]],
  },
  // 3. 올인 — 긴장감 있는 첩보 영화풍 (E단조, 138bpm, 후반 반음 올라감)
  spy: {
    title: '올인', bpm: 138, swing: 0, key: 'E', minor: true,
    prog: [['E','m'],['E','m'],['C','M7'],['B','7'],['E','m'],['E','m'],['A','m'],['B','7'],
           ['C','M7'],['C','M7'],['A','m'],['A','m'],['F#','h'],['B','7'],['E','m'],['B','7']],
    choruses: 2, modulate: 1, bass: 'spy', drums: 'spy', comp: 'stab', lead: ['vib','reed'], pad: [true, true], tremolo: true,
    range: [64, 81], rhythms: [[[0,.5],[.5,.5],[1,1],[2.5,.5],[3,1]], [[0,2],[2.5,.5],[3,.5],[3.5,.5]], [[.5,.5],[1,.5],[1.5,.5],[2,2]], [[0,1.5],[2,2]]],
  },
  // 4. 새벽 3시 — 느린 재즈 발라드 (Ab장조, 72bpm): 한숨 돌리는 분위기
  ballad: {
    title: '새벽 3시', bpm: 72, swing: 2/3, key: 'Ab', minor: false,
    prog: [['Ab','M7'],['F','m9'],['Bb','m9'],['Eb','13'],['C','m7'],['F','7b9'],['Bb','m9'],['Eb','7'],
           ['Db','M7'],['Db','m6'],['C','m7'],['F','7'],['Bb','m9'],['Eb','7'],['Ab','M7'],['Ab','M7']],
    choruses: 1, bass: 'half', drums: 'ballad', comp: 'arp', lead: ['horn'], pad: [true],
    range: [62, 79], rhythms: [[[0,1.5],[1.67,.33],[2,2]], [[0,1],[1,1],[2,2]], [[.67,.33],[1,1.5],[2.67,1.33]], [[0,3.5]]],
  },
  // 5. 잭팟 — 신나는 빅밴드 스윙 (Bb장조, 152bpm): 터졌다!
  bigband: {
    title: '잭팟', bpm: 152, swing: 2/3, key: 'Bb', minor: false,
    prog: [['Bb','6'],['G','7'],['C','m7'],['F','7'],['Bb','6'],['Bb','7'],['Eb','6'],['E','dim'],
           ['Bb','6'],['G','7'],['C','m7'],['F','7'],['D','m7'],['G','7'],['C','m7'],['F','7']],
    choruses: 2, bass: 'walk', drums: 'bigband', comp: 'shout', lead: ['vib','brass'], pad: [false, false],
    range: [65, 84], rhythms: [[[0,.67],[.67,.33],[1,1],[2,.67],[2.67,1.33]], [[.67,.33],[1,.67],[1.67,.33],[2,1],[3,1]], [[0,1],[1,1],[2,1],[3,1]], [[0,2],[2.67,1.33]]],
  },
  // 6. 리버 카드 — 드라마틱한 탱고 (A단조, 112bpm)
  tango: {
    title: '리버 카드', bpm: 112, swing: 0, key: 'A', minor: true,
    prog: [['A','m'],['A','m'],['D','m'],['E','7'],['A','m'],['A','m'],['E','7'],['A','m'],
           ['F','M7'],['F','M7'],['E','7'],['E','7'],['D','m'],['A','m'],['E','7'],['A','m']],
    choruses: 2, bass: 'habanera', drums: 'tango', comp: 'marcato', lead: ['reed','vib'], pad: [false, true],
    range: [64, 82], rhythms: [[[0,.75],[.75,.25],[1,1],[2,2]], [[0,.5],[.5,.5],[1,.5],[1.5,.5],[2,1.5],[3.5,.5]], [[0,1.5],[1.5,.5],[2,.75],[2.75,.25],[3,1]], [[0,3]]],
  },
};

const NOTE = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
// 화음 종류 → (근음 기준) 구성음
const QUAL = {
  'M7':[0,4,7,11,14], '6':[0,4,7,9,14], '7':[0,4,7,10,14], '7b9':[0,4,7,10,13], '13':[0,4,10,14,21], 'm':[0,3,7,14,10],
  'm7':[0,3,7,10,14], 'm9':[0,3,7,10,14], 'm6':[0,3,7,9,14], 'h':[0,3,6,10], 'dim':[0,3,6,9],
};

async function renderSong(id, rate){
  const S = SONGS[id];
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = Math.min(rate || 44100, 44100);
  const B = 60 / S.bpm, BAR = 4 * B, SW = S.swing || .5;
  const sw = beat => { const f = beat % 1; if (S.swing && Math.abs(f - .5) < 1e-6) return Math.floor(beat) + SW; return beat; }; // 스윙: 반박 → 2/3박
  const body = S.prog.length * S.choruses, LEN = (body + 2) * BAR + 3; // 끝맺음 2마디 + 잔향
  const ctx = new OAC(2, Math.ceil(LEN * sr), sr);
  let seed = id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const at = (bar, beat) => .05 + bar * BAR + sw(beat) * B;

  // ---- 믹서 ----
  const rev = ctx.createConvolver(); { const n = Math.floor(sr * 1.8), ir = ctx.createBuffer(2, n, sr); for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); } rev.buffer = ir; }
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(ctx.destination);
  const dry = ctx.createGain(); dry.connect(comp); const wet = ctx.createGain(); wet.gain.value = .24; rev.connect(wet); wet.connect(comp);
  const bus = (g, verb, pan) => { const n = ctx.createGain(); n.gain.value = g; let o = n; if (pan && ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); o = p; } o.connect(dry); if (verb){ const s = ctx.createGain(); s.gain.value = verb; o.connect(s); s.connect(rev); } return n; };
  const BUS = { ep: bus(.16, .8, -.2), pluck: bus(.2, .6, -.25), bass: bus(.17, .15, 0), lead: bus(.36, 1, .15), drum: bus(1.4, .3, .08), brass: bus(.17, .6, .1), pad: bus(.05, 1.2, 0) };
  const noise = ctx.createBuffer(1, sr, sr); { const d = noise.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; }
  const env = (g, t, a, peak, dec, end) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, dec); if (end) g.gain.setTargetAtTime(0, end, .05); };
  const osc = (type, f, t, stop, out) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(out); o.start(t); o.stop(stop); return o; };
  const nhit = (t, dur, type, f, q, peak, dec, out) => { const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); env(g, t, .002, peak, dec); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, rnd() * .5, dur); };

  // ---- 악기 ----
  const I = {
    ep(m, t, dur, v){ const f = hz(m), end = t + dur, stop = end + .5; const g = ctx.createGain(); env(g, t, .006, v, .9, end); g.connect(BUS.ep);
      const car = osc('sine', f, t, stop, g); const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.3, t); mg.gain.setTargetAtTime(f * .15, t, .18); osc('sine', f, t, stop, mg); mg.connect(car.frequency);
      const tg = ctx.createGain(); env(tg, t, .002, v * .15, .06); tg.connect(BUS.ep); osc('sine', f * 7.1, t, t + .4, tg); },
    pluck(m, t, dur, v){ const f = hz(m), end = t + Math.min(dur, 1.2); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(500, t, .09); lp.connect(BUS.pluck);
      const g = ctx.createGain(); env(g, t, .003, v, .35, end); g.connect(lp); osc('sawtooth', f, t, end + .4, g); const g2 = ctx.createGain(); g2.gain.value = .8; g2.connect(g); osc('triangle', f * 2.001, t, end + .4, g2); },
    bass(m, t, dur, v, rel = .04){ const f = hz(m), end = t + dur * .92; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.setTargetAtTime(420, t, .08); lp.connect(BUS.bass);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.setTargetAtTime(v * .55, t + .012, .12); g.gain.setTargetAtTime(0, end, rel); g.connect(lp);
      osc('triangle', f, t, end + rel * 7, g); const g2 = ctx.createGain(); g2.gain.value = .7; g2.connect(g); osc('sine', f, t, end + rel * 7, g2); },
    vib(m, t, dur, v){ const f = hz(m), stop = t + dur + 1.6; const g = ctx.createGain(); env(g, t, .003, v, .6 + dur * .25);
      const tr = ctx.createGain(); tr.gain.value = 1; const ld = ctx.createGain(); ld.gain.value = .25; ld.connect(tr.gain); osc('sine', 5.2, t, stop, ld);
      g.connect(tr); tr.connect(BUS.lead); osc('sine', f, t, stop, g); const h = ctx.createGain(); env(h, t, .002, v * .35, .08); h.connect(BUS.lead); osc('sine', f * 4, t, t + .5, h); },
    flute(m, t, dur, v){ const f = hz(m), end = t + dur, stop = end + .3; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .9, t + .05); g.gain.setTargetAtTime(v * .75, t + .05, .3); g.gain.setTargetAtTime(0, end - .02, .05); g.connect(BUS.lead);
      const o = osc('sine', f, t, stop, g); const vd = ctx.createGain(); vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(f * .006, t + .35); vd.connect(o.frequency); osc('sine', 5.3, t, stop, vd);
      const h = ctx.createGain(); h.gain.value = .12; h.connect(g); osc('sine', f * 2, t, stop, h); nhit(t, dur + .1, 'bandpass', f * 2, 2, v * .05, Math.max(.05, dur * .5), BUS.lead); },
    reed(m, t, dur, v){ const f = hz(m), end = t + dur, stop = end + .3; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = .7; lp.connect(BUS.lead);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .55, t + .04); g.gain.setTargetAtTime(v * .45, t + .04, .3); g.gain.setTargetAtTime(0, end - .02, .04); g.connect(lp);
      const tr = ctx.createGain(); tr.gain.value = .85; const td = ctx.createGain(); td.gain.value = .15; td.connect(tr.gain); osc('sine', 6.2, t, stop, td); tr.connect(g);
      osc('sawtooth', f, t, stop, tr); osc('sawtooth', f * 1.004, t, stop, tr); const q = ctx.createGain(); q.gain.value = .5; q.connect(tr); osc('square', f * .998, t, stop, q); },
    horn(m, t, dur, v){ const f = hz(m), end = t + dur, stop = end + .3; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1300, t + .12); lp.frequency.setTargetAtTime(900, t + .12, .3); lp.connect(BUS.lead);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .5, t + .07); g.gain.setTargetAtTime(v * .4, t + .07, .4); g.gain.setTargetAtTime(0, end - .03, .06); g.connect(lp);
      const o = osc('sawtooth', f, t, stop, g); const vd = ctx.createGain(); vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(f * .004, t + .4); vd.connect(o.frequency); osc('sine', 5, t, stop, vd); osc('triangle', f, t, stop, g); },
    brass(m, t, dur, v, out){ const f = hz(m), end = t + dur; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2600, t + .03); lp.frequency.setTargetAtTime(900, t + .03, .12); lp.connect(out || BUS.brass);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.setTargetAtTime(v * .6, t + .02, .15); g.gain.setTargetAtTime(0, end, .05); g.connect(lp);
      osc('sawtooth', f, t, end + .3, g); osc('sawtooth', f * 1.006, t, end + .3, g); },
    pad(ms, t, dur, v, trem){ const end = t + dur; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.connect(BUS.pad);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .35); g.gain.setTargetAtTime(0, end - .1, .2);
      if (trem){ const tr = ctx.createGain(); tr.gain.value = .6; const td = ctx.createGain(); td.gain.value = .4; td.connect(tr.gain); osc('sine', 8, t, end + 1, td); g.connect(tr); tr.connect(lp); } else g.connect(lp);
      ms.forEach(m => [1, 1.003, .997].forEach(k => osc('sawtooth', hz(m) * k, t, end + 1, g))); },
  };
  const D = {
    kick(t, v){ const g = ctx.createGain(); env(g, t, .004, v * .6, .08); g.connect(BUS.drum); const o = osc('sine', 72, t, t + .4, g); o.frequency.exponentialRampToValueAtTime(44, t + .2); },
    snare(t, v){ nhit(t, .25, 'bandpass', 1900, .8, v, .07, BUS.drum); const g = ctx.createGain(); env(g, t, .002, v * .5, .04); g.connect(BUS.drum); osc('triangle', 190, t, t + .3, g); },
    brush(t, v){ const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(2200, t); fl.frequency.linearRampToValueAtTime(3800, t + .2); fl.Q.value = .6; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .03); g.gain.setTargetAtTime(0, t + .05, .07); s.connect(fl); fl.connect(g); g.connect(BUS.drum); s.start(t, rnd() * .5, .5); },
    swirl(t, dur, v){ const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 3000; fl.Q.value = .5; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur); s.connect(fl); fl.connect(g); g.connect(BUS.drum); s.start(t, rnd() * .3, dur); },
    ride(t, v){ nhit(t, .9, 'highpass', 6000, .5, .07 * v, .22, BUS.drum); nhit(t, .05, 'bandpass', 4200, 2, .05 * v, .012, BUS.drum); },
    hat(t, v, open){ nhit(t, open ? .4 : .08, 'highpass', 7500, .7, .06 * v, open ? .12 : .025, BUS.drum); },
    rim(t, v){ const g = ctx.createGain(); env(g, t, .001, v * .25, .012); g.connect(BUS.drum); osc('sine', 1750, t, t + .1, g); nhit(t, .03, 'bandpass', 3000, 3, v * .15, .008, BUS.drum); },
    shaker(t, v){ nhit(t, .06, 'highpass', 6500, .6, .05 * v, .02, BUS.drum); },
    crash(t, v){ nhit(t, 1.6, 'highpass', 4500, .5, v, .55, BUS.drum); },
  };

  // ---- 화음·음계 ----
  const tr = ci => (S.modulate && ci >= S.prog.length) ? S.modulate : 0;   // 후반 전조
  const chordAt = ci => { const [r, q] = S.prog[ci % S.prog.length]; const root = NOTE[r] + tr(ci); return {root, q, tones: QUAL[q].map(x => (root + x) % 12)}; };
  const keyRoot = NOTE[S.key];
  const scaleOf = ci => { const k = (keyRoot + tr(ci)) % 12; const st = S.minor ? [0,2,3,5,7,8,10,11] : [0,2,4,5,7,9,10,11]; return st.map(x => (k + x) % 12); };
  const voicing = c => { // 중음역(52~67) 4음 보이싱
    const pcs = c.tones.slice(1, 5).length >= 3 ? c.tones.slice(1, 5) : c.tones; const out = [];
    pcs.forEach(pc => { let m = 52 + ((pc - 52) % 12 + 12) % 12; out.push(m); });
    return out.sort((a, b) => a - b);
  };
  const bassNote = pc => { let m = 28 + ((pc - 28) % 12 + 12) % 12; if (m < 31) m += 12; return m; };

  // ---- 반주 ----
  for (let bar = 0; bar < body; bar++){
    const c = chordAt(bar), nx = chordAt(bar + 1), ch = Math.floor(bar / S.prog.length), T = at(bar, 0);
    const R = bassNote(c.root), N = bassNote(nx.root), fifth = R + 7 > 50 ? R - 5 : R + 7, third = R + (c.q[0] === 'm' || c.q === 'h' || c.q === 'dim' ? 3 : 4);
    const vo = voicing(c), last = bar === body - 1;
    // 베이스
    if (S.bass === 'walk'){ [R, rnd() < .5 ? third : R + 12 > 50 ? R : R + 12, fifth, N + (rnd() < .5 ? 1 : -1)].forEach((m, k) => I.bass(m, at(bar, k), B, k ? .8 : .95)); }
    if (S.bass === 'bossa'){ [[0, R, 1.4], [1.5, fifth, .45], [2, fifth, 1.4], [3.5, N, .45]].forEach(([b, m, d]) => I.bass(m, at(bar, b), d * B, .9)); }
    if (S.bass === 'half'){ I.bass(R, T, 2 * B, .85); I.bass(rnd() < .5 ? fifth : third, at(bar, 2), 1.8 * B, .7); }
    if (S.bass === 'spy'){ const pat = [0, 0, 2, 2, 3, 3, 2, 2]; pat.forEach((x, k) => I.bass(R + x, at(bar, k * .5), .45 * B, k % 2 ? .65 : .9)); }
    if (S.bass === 'habanera'){ [[0, R, .7], [.75, fifth, .25], [1, R + 12 > 50 ? R : R + 12, .5], [1.5, fifth, .5], [2, R, .7], [2.75, fifth, .25], [3, third, .5], [3.5, fifth, .5]].forEach(([b, m, d]) => I.bass(m, at(bar, b), d * B, b % 2 === 0 ? .95 : .75)); }
    // 화음 반주
    if (S.comp === 'pluck'){ const hits = bar % 2 ? [.5, 1.5, 2.5, 3.5] : [.5, 1.5, 2, 3, 3.5]; hits.forEach(b => vo.forEach((m, k) => I.pluck(m + 12, at(bar, b) + k * .006, .45 * B, .5))); }
    if (S.comp === 'stab'){ [[0, .9], [1.5, .25], [3.5, .25]].forEach(([b, d]) => vo.forEach(m => I.ep(m, at(bar, b), d * B, .55))); }
    if (S.comp === 'arp'){ const notes = vo.concat([vo[1] + 12, vo[2] + 12]); for (let k = 0; k < 8; k++) I.ep(notes[k % notes.length], at(bar, k * .5), 1.6 * B, .5 - (k % 2) * .12); }
    if (S.comp === 'shout'){ // 빅밴드 컴핑 + 브라스 쇼트
      [[0, .4], [1 + SW, .3]].forEach(([b, d]) => vo.forEach(m => I.ep(m, T + b * B, d * B, .5)));
      if (bar % 2 === 1){ vo.forEach(m => I.brass(m + 12, at(bar, 3) + SW * B, .6 * B, .45)); }
      if (bar % 4 === 0 && ch === 1){ vo.forEach(m => I.brass(m + 12, T, .5 * B, .5)); }
    }
    if (S.comp === 'marcato'){ [0, 1, 2, 3].forEach(b => vo.forEach(m => I.ep(m, at(bar, b), .35 * B, b === 0 ? .7 : .45))); if (bar % 2 === 1) vo.forEach(m => I.ep(m, at(bar, 3.5), .25 * B, .5)); }
    // 패드
    if (S.pad[ch]) I.pad(vo.slice(0, 3).map(m => m + 12), T, BAR, 1, S.tremolo);
    // 드럼
    const dr = S.drums;
    if (dr === 'bossa'){
      const clave = bar % 2 ? [1, 2] : [0, 1.5, 3]; clave.forEach(b => D.rim(at(bar, b), .9));
      for (let k = 0; k < 8; k++) D.shaker(at(bar, k * .5), k % 2 ? .6 : 1);
      D.kick(T, .35); D.kick(at(bar, 1.5), .2); D.kick(at(bar, 2), .3); D.kick(at(bar, 3.5), .2);
    }
    if (dr === 'spy'){
      for (let k = 0; k < 8; k++) D.hat(at(bar, k * .5), k % 2 ? .6 : 1, k === 7 && bar % 4 === 3);
      D.kick(T, .45); D.kick(at(bar, 2), .4); if (rnd() < .4) D.kick(at(bar, 2.5), .25);
      D.snare(at(bar, 1), .18); D.snare(at(bar, 3), .2);
      if (bar % 8 === 0) D.crash(T, .07);
      if (bar % 4 === 3) [3, 3.25, 3.5, 3.75].forEach((b, k) => D.snare(at(bar, b), .06 + k * .03));
    }
    if (dr === 'ballad'){ D.swirl(T, BAR * .95, .045); D.rim(at(bar, 3), .5); if (bar % 4 === 0) D.ride(T, .5); D.kick(T, .2); }
    if (dr === 'bigband'){
      [[0, .8], [1, 1], [1 + SW, .55], [2, .8], [3, 1], [3 + SW, .55]].forEach(([b, a]) => D.ride(T + b * B, a * 1.1));
      D.hat(at(bar, 1), .8); D.hat(at(bar, 3), .8); D.snare(at(bar, 1), .07); D.snare(at(bar, 3), .08);
      [0, 1, 2, 3].forEach(b => D.kick(at(bar, b), .15));
      if (rnd() < .35) D.snare(T + (2 + SW) * B, .12);
      if (bar % 8 === 7){ D.snare(T + (3 + SW) * B, .25); D.kick(T + (3 + SW) * B, .4); }
      if (bar % 8 === 0) D.crash(T, .08);
    }
    if (dr === 'tango'){ D.kick(T, .4); D.kick(at(bar, 2), .3); [.75, 1, 2.75, 3].forEach(b => D.rim(at(bar, b), .5)); if (bar % 4 === 3) D.snare(at(bar, 3.5), .15); }
  }

  // ---- 멜로디 (모티브 반복 + 화음 음 위주로 자동 작곡) ----
  const lo = S.range[0], hi = S.range[1];
  let prev = Math.round((lo + hi) / 2);
  const near = (pcs, from, dir) => { let bestM = null, bd = 99; for (let m = lo; m <= hi; m++){ if (!pcs.includes(((m % 12) + 12) % 12)) continue; const d = Math.abs(m - from) + (dir && Math.sign(m - from) !== dir ? 2 : 0); if (d < bd && m !== from){ bd = d; bestM = m; } } return bestM ?? from; };
  for (let ch = 0; ch < S.choruses; ch++){
    const inst = S.lead[ch] || S.lead[0], vel = inst === 'reed' ? .6 : inst === 'horn' ? .55 : .5;
    for (let ph = 0; ph < S.prog.length / 4; ph++){
      // 4마디 프레이즈: 모티브(2마디) → 변형 반복(2마디), 마지막 마디는 길게
      const motif = [S.rhythms[Math.floor(rnd() * (S.rhythms.length - 1))], S.rhythms[Math.floor(rnd() * (S.rhythms.length - 1))]];
      let dir = rnd() < .5 ? 1 : -1;
      for (let k = 0; k < 4; k++){
        const bar = ch * S.prog.length + ph * 4 + k, c = chordAt(bar), sc = scaleOf(bar);
        const rh = k === 3 ? S.rhythms[S.rhythms.length - 1] : motif[k % 2];
        rh.forEach(([b, d], j) => {
          const strong = Math.abs(b - Math.round(b)) < 1e-6;
          let m = strong ? near(c.tones, prev, dir) : near(sc, prev, dir);
          if (m >= hi - 1) dir = -1; if (m <= lo + 1) dir = 1;
          if (rnd() < .2) dir = -dir;
          prev = m;
          const t = at(bar, b), dur = d * B * (k === 3 && j === rh.length - 1 ? 1 : .92);
          if (inst === 'vib') I.vib(m, t, dur, vel * .9);
          else if (inst === 'brass'){ I.brass(m, t, dur, vel * .5, BUS.lead); }
          else I[inst](m, t, dur, vel);
        });
      }
    }
  }

  // ---- 끝맺음: 으뜸화음 + 벨 '띵' ----
  { const bar = body, T = at(bar, 0), c = {root: (keyRoot + (S.modulate ? S.modulate : 0)) % 12};
    const q = S.minor ? [0, 3, 7, 14] : [0, 4, 7, 11, 14], R = bassNote(c.root);
    const tones = q.map(x => 52 + (((c.root + x) - 52) % 12 + 12) % 12).sort((a, b) => a - b);
    tones.forEach(m => I.ep(m, T, 2 * BAR, .42)); I.bass(R, T, 1.6 * BAR, .9, .7); I.vib(tones[tones.length - 1] + 12, T, 2 * BAR, .5);
    D.crash(T, .04); D.kick(T, .35);
    [[1, 1, 1.1], [2.56, .55, .6], [4.54, .9, .35], [6.85, .4, .2]].forEach(([r, a, d]) => { const g = ctx.createGain(); env(g, T, .002, .14 * a, d); g.connect(BUS.lead); osc('sine', 1396.9 * r, T, T + d * 7, g); });
  }

  const raw = await ctx.startRendering();
  // 정규화 + 끝 페이드
  let peak = 0; for (let ch = 0; ch < 2; ch++){ const d = raw.getChannelData(ch); for (let i = 0; i < d.length; i++){ const v = Math.abs(d[i]); if (v > peak) peak = v; } }
  const k = peak > 0 ? .85 / peak : 1, fin = Math.floor(sr * 1.2), fade = Math.floor(sr * .01);
  for (let ch = 0; ch < 2; ch++){ const d = raw.getChannelData(ch); for (let i = 0; i < d.length; i++){ let v = d[i] * k; if (i < fade) v *= i / fade; if (i > d.length - fin) v *= (d.length - i) / fin; d[i] = v; } }
  raw.title = S.title;
  return raw;
}
