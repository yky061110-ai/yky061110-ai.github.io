/* 배경음악 2~6번 곡: 1번 곡 '라운지 블러프'와 같은 계열 (느린 스윙 재즈, 단조, 일렉 피아노·콘트라베이스·브러시 드럼·비브라폰/약음 트럼펫)
   renderMusic(44100, 32, null, true, buildVariant(VARIANTS.xxx)) 로 합성 (music-compose.js 필요) */
const NT = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
// 화음 기호 → [베이스 근음(미디), 종류, 보이싱 음정]
const VQ = {
  m9:  ['m', [3, 7, 10, 14]], m6: ['m', [3, 7, 9, 14]], M7: ['M', [4, 7, 11, 14]],
  '7b9': ['7', [10, 13, 16, 19]], alt: ['7', [10, 13, 16, 20]], '9': ['7', [4, 10, 14, 21]], h: ['h', [10, 15, 18, 24]],
};
// 1번 곡 멜로디의 리듬(마디별 [박, 길이])을 그대로 가져와 같은 말투로
const BASE_RHY = [
  [[0,1.5],[1.67,.33],[2,1],[3,1]], [[0,3]], [[.67,.33],[1,1],[2,2]], [[0,1],[1,1],[2,1],[3,1]],
  [[0,2],[2,.67],[2.67,1.33]], [[1,1],[2,1],[3,1]], [[0,1.5],[1.67,.33],[2,2]], [[0,1],[1,.67],[1.67,.33],[2,1],[3,1]],
  [[0,3],[3,1]], [[0,2],[2.67,.33],[3,1]], [[0,1.5],[1.67,.33],[2,1],[3,1]], [[0,2],[2,1],[3,1]],
  [[0,1],[1,.67],[1.67,.33],[2,2]], [[0,1],[1,1],[2,1],[3,1]], [[0,3.5]], [[1,.67],[1.67,.33],[2,1],[3,1]],
];
const BASE_FILL = [[2,.67],[2.67,.33],[3,1]];

const VARIANTS = {
  midnight: { title:'미드나잇 테이블', key:'C', seed: 11, lead:['horn','vib'], drive:false,
    bpm: b => b < 20 ? 92 : b < 28 ? 98 : 92,
    prog: 'Cm9 Cm9 AbM7 G7b9 Cm9 Fm9 Dh Galt EbM7 AbM7 Dh G7b9 Cm9 Ab9 Dh Galt' },
  bluffcall: { title:'블러프 콜', key:'G', seed: 23, lead:['vib','vib'], drive:true,
    bpm: b => b < 16 ? 98 : b < 20 ? 98 + (b - 15) * 4 : b < 28 ? 114 : 114 - (b - 27) * 4,
    prog: 'Gm9 Gm9 Eb9 D7b9 Gm9 Cm9 Ah Dalt BbM7 EbM7 Ah D7b9 Gm9 Eb9 Ah Dalt' },
  smokeroom: { title:'스모크 룸', key:'F', seed: 37, lead:['vib','horn'], drive:false,
    bpm: () => 84,
    prog: 'Fm9 Fm6 DbM7 C7b9 Fm9 Bbm9 Eb9 AbM7 DbM7 Gh C7b9 Fm9 Bbm9 Calt Fm9 C7b9' },
  highstakes: { title:'하이 스테이크', key:'A', seed: 41, lead:['vib','horn'], drive:true,
    bpm: b => b < 16 ? 100 : b < 20 ? 100 + (b - 15) * 4.5 : b < 28 ? 118 : 118 - (b - 27) * 4.5,
    prog: 'Am9 Am9 Dm9 Dm9 Am9 F9 Bh E7b9 Am9 Am9 Dm9 G9 CM7 F9 Bh Ealt' },
  lasthand: { title:'라스트 핸드', key:'E', seed: 53, lead:['horn','vib'], drive:false,
    bpm: b => b < 20 ? 88 : b < 28 ? 94 : 88,
    prog: 'Em9 C9 Am9 B7b9 Em9 GM7 F#h Balt CM7 Am9 F#h B7b9 Em9 C9 Am9 Balt' },
};

function buildVariant(def){
  let seed = def.seed; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const chords = def.prog.split(' ').map(sym => {
    const m = sym.match(/^([A-G][b#]?)(.*)$/); const root = NT[m[1]], [q, iv] = VQ[m[2]];
    let b = 28 + ((root - 28) % 12 + 12) % 12; if (b > 40) b -= 12;
    const voic = iv.map(x => { const pc = (root + x) % 12; return 50 + ((pc - 50) % 12 + 12) % 12; }).sort((a, c) => a - c);
    return { b, q, voic, pcs: [0].concat(iv).map(x => (root + x) % 12), root };
  });
  const prog = chords.map(c => [c.b, c.q, c.voic]);
  // 음계: 단조 (화성단음계의 이끎음 포함)
  const k = NT[def.key], scale = [0, 2, 3, 5, 7, 8, 10, 11].map(x => (k + x) % 12);
  const lo = 64, hi = 82;
  const near = (pcs, from, dir) => { let best = null, bd = 99; for (let m = lo; m <= hi; m++){ if (!pcs.includes(m % 12)) continue; const d = Math.abs(m - from) + (dir && Math.sign(m - from) !== dir ? 1.5 : 0); if (m !== from && d < bd){ bd = d; best = m; } } return best ?? from; };
  // 1번 곡 리듬 순서를 조금 섞어서 (같은 말투, 다른 선율)
  const order = [...Array(16).keys()]; for (let i = 0; i < 16; i += 4){ if (rnd() < .5){ const a = i + Math.floor(rnd() * 3), t = order[a]; order[a] = order[a + 1]; order[a + 1] = t; } }
  const mel = []; let prev = 69 + ((k - 9 + 12) % 12 > 6 ? (k - 9 + 12) % 12 - 12 : (k - 9 + 12) % 12), dir = 1;
  for (let bar = 0; bar < 16; bar++){
    const c = chords[bar], rh = BASE_RHY[order[bar]];
    rh.forEach(([bt, d]) => {
      const strong = Math.abs(bt - Math.round(bt)) < 1e-6;
      const pool = strong ? c.pcs : scale.concat(c.pcs);
      const m = near(pool, prev, dir); if (m >= hi - 2) dir = -1; else if (m <= lo + 2) dir = 1; else if (rnd() < .25) dir = -dir;
      prev = m; mel.push([bar, bt, m, d]);
    });
  }
  const fill = [];
  [3, 15].forEach(bar => { let p = mel.filter(x => x[0] === bar).pop()[2]; BASE_FILL.forEach(([bt, d], i) => { p = near(chords[bar].pcs.concat(scale), p, -1); fill.push([bar, bt, p, d]); }); });
  const tonic = chords[0].b;
  return { title: def.title, seed: def.seed, bpmOf: def.bpm, prog, mel, fill, lead: def.lead, drive: def.drive, tonic };
}
