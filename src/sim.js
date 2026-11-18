'use strict';
// ===================== DETERMINISTIC SIMULATION =====================
// Only + - * / Math.sqrt Math.floor Math.min Math.max Math.abs and a seeded RNG are used,
// so every client computes exactly the same game from the same inputs (lockstep).
const TILE = 32, TPS = 10, POPMAX = 150;

function makeRng(s) { // mulberry32 with its state kept in s.rs so a game can be saved and resumed
  return function () {
    let a = s.rs | 0; a = (a + 0x6D2B79F5) | 0; s.rs = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SIZES = { kucuk: [56, 68], orta: [64, 80], buyuk: [80, 100] };
const START_RES = { dusuk: { f: 200, w: 200, g: 100, s: 200 }, orta: { f: 500, w: 500, g: 300, s: 300 }, yuksek: { f: 1000, w: 1000, g: 1000, s: 800 } };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RES_INFO = { f: { n: 'Yemek', i: '🍖' }, w: { n: 'Odun', i: '🪵' }, g: { n: 'Altın', i: '🪙' }, s: { n: 'Taş', i: '🪨' } };
const RT = ['f', 'w', 'g', 's'];
const RICON = { f: '🍖', w: '🪵', g: '🪙', s: '🪨' }, RNAME = { f: 'yiyecek', w: 'odun', g: 'altın', s: 'taş' };

const CIVS = {
  bozkir: { n: 'Bozkır Hanlığı', lead: 'Kağan Aybars', flag: '🐺', uu: 'kurtatli',
    d: 'Atlı birimler %15 hızlı ve %15 ucuz. Özel birim: Kurt Atlı (at üstünde okçu).' },
  liman: { n: 'Kızıl Liman Cumhuriyeti', lead: 'Dük Valeran', flag: '⚓', uu: 'kalkanli',
    d: 'Altın %20 hızlı toplanır, +100 altınla başlar. Özel birim: Kalkanlı Paralı (oklara çok dayanıklı).' },
  dag: { n: 'Taş Dağ Krallığı', lead: 'Kraliçe Senna', flag: '⛰️', uu: 'dagdevi',
    d: 'Binalar %25 dayanıklı, taş %20 hızlı, kuleler +1 menzil. Özel birim: Dağ Devi (binaları yıkar).' },
  orman: { n: 'Yeşil Orman Birliği', lead: 'Bilge Oren', flag: '🌲', uu: 'golgeokcu',
    d: 'Odun %20 hızlı toplanır, okçular +1 menzil. Özel birim: Gölge Okçu (çok uzun menzil).' },
};
const CIV_KEYS = ['bozkir', 'liman', 'dag', 'orman'];
const COLORS = ['#3d7be0', '#d8423a', '#9b55cc', '#e3b423'];
const GAIA = -2; // wild monsters (neutral, hostile to everyone)
const COLOR_NAMES = ['Mavi', 'Kırmızı', 'Mor', 'Sarı'];
const AGE_NAMES = ['', 'Köy Çağı', 'Kale Çağı', 'İmparatorluk Çağı'];

// cls: vil inf arch cav siege
const UT = {
  koylu:    { n: 'Köylü', ico: '👷', cls: 'vil', hp: 25, atk: 3, ar: 0, pa: 1, rng: 0, rof: 2, spd: 0.8, los: 4, cost: { f: 50 }, t: 12, age: 1, r: 7 },
  kilicli:  { n: 'Kılıçlı', ico: '🗡️', cls: 'inf', hp: 50, atk: 6, ar: 1, pa: 1, rng: 0, rof: 2, spd: 0.9, los: 4, cost: { f: 60, g: 20 }, t: 14, age: 1, r: 8, bonus: { bld: 2 } },
  mizrakci: { n: 'Mızrakçı', ico: '🔱', cls: 'inf', hp: 45, atk: 3, ar: 0, pa: 0, rng: 0, rof: 3, spd: 1.0, los: 4, cost: { f: 35, w: 25 }, t: 12, age: 1, r: 8, bonus: { cav: 15 } },
  okcu:     { n: 'Okçu', ico: '🏹', cls: 'arch', hp: 30, atk: 4, ar: 0, pa: 0, rng: 4, rof: 2, spd: 0.96, los: 6, cost: { w: 25, g: 45 }, t: 14, age: 2, r: 7, bonus: { inf: 1 } },
  atli:     { n: 'Hafif Atlı', ico: '🐎', cls: 'cav', hp: 60, atk: 5, ar: 0, pa: 2, rng: 0, rof: 2, spd: 1.55, los: 6, cost: { f: 80 }, t: 16, age: 2, r: 11, bonus: { arch: 6, siege: 6 } },
  zirhli:   { n: 'Zırhlı Atlı', ico: '🛡️', cls: 'cav', hp: 100, atk: 10, ar: 2, pa: 2, rng: 0, rof: 1.8, spd: 1.35, los: 4, cost: { f: 60, g: 75 }, t: 22, age: 3, r: 12 },
  koc:      { n: 'Koçbaşı', ico: '🪵', cls: 'siege', hp: 175, atk: 2, ar: 0, pa: 40, rng: 0, rof: 5, spd: 0.5, los: 3, cost: { w: 160, g: 75 }, t: 24, age: 2, r: 13, bonus: { bld: 110 }, onlyBld: true },
  mancinik: { n: 'Mancınık', ico: '☄️', cls: 'siege', hp: 60, atk: 30, ar: 0, pa: 6, rng: 7, rof: 6, spd: 0.6, los: 8, cost: { w: 160, g: 135 }, t: 26, age: 3, r: 13, bonus: { bld: 60 } },
  // unique units
  kurtatli: { n: 'Kurt Atlı', ico: '🐺', cls: 'cav', hp: 55, atk: 6, ar: 0, pa: 1, rng: 4, rof: 2, spd: 1.4, los: 6, cost: { f: 55, g: 65 }, t: 18, age: 3, r: 11, uu: 1 },
  kalkanli: { n: 'Kalkanlı Paralı', ico: '⚓', cls: 'inf', hp: 70, atk: 9, ar: 2, pa: 7, rng: 0, rof: 2, spd: 0.9, los: 4, cost: { f: 60, g: 50 }, t: 16, age: 3, r: 9, uu: 1 },
  dagdevi:  { n: 'Dağ Devi', ico: '🔨', cls: 'inf', hp: 115, atk: 12, ar: 1, pa: 2, rng: 0, rof: 2.5, spd: 0.8, los: 4, cost: { f: 70, g: 60 }, t: 18, age: 3, r: 11, bonus: { bld: 20 }, uu: 1 },
  // wild monsters (never trained; guard camps on the map)
  ork:      { n: 'Ork Savaşçısı', ico: '👹', cls: 'inf', hp: 70, atk: 7, ar: 1, pa: 1, rng: 0, rof: 2, spd: 0.85, los: 5, cost: {}, t: 0, age: 9, r: 9, mon: 1, bnt: { g: 15 } },
  orkreis:  { n: 'Ork Reisi', ico: '👺', cls: 'inf', hp: 180, atk: 11, ar: 2, pa: 2, rng: 0, rof: 2.2, spd: 0.8, los: 6, cost: {}, t: 0, age: 9, r: 12, mon: 1, bnt: { g: 40 } },
  balcik:   { n: 'Balçık', ico: '🟢', cls: 'inf', hp: 35, atk: 4, ar: 0, pa: 3, rng: 0, rof: 1.8, spd: 0.7, los: 4, cost: {}, t: 0, age: 9, r: 8, mon: 1, bnt: { f: 10 } },
  devbalcik:{ n: 'Dev Balçık', ico: '🟩', cls: 'inf', hp: 140, atk: 8, ar: 0, pa: 4, rng: 0, rof: 2.4, spd: 0.55, los: 5, cost: {}, t: 0, age: 9, r: 13, mon: 1, split: 'balcik', bnt: { f: 30 } },
  golgeokcu:{ n: 'Gölge Okçu', ico: '🎯', cls: 'arch', hp: 40, atk: 7, ar: 0, pa: 1, rng: 6, rof: 2, spd: 0.96, los: 8, cost: { w: 35, g: 55 }, t: 16, age: 3, r: 8, uu: 1 },
};

const BT = {
  tc:       { n: 'Şehir Merkezi', ico: '🏛️', sz: 3, hp: 2400, cost: { w: 275, s: 100 }, t: 60, pop: 5, drop: 'fwgs', trains: ['koylu'], techs: ['cag2', 'cag3', 'elarabasi'], atk: 5, rng: 6, rof: 2, los: 8, age: 1, gar: 10 },
  ev:       { n: 'Ev', ico: '🏠', sz: 2, hp: 550, cost: { w: 25 }, t: 10, pop: 5, los: 2, age: 1 },
  degirmen: { n: 'Değirmen', ico: '🌾', sz: 2, hp: 600, cost: { w: 100 }, t: 15, drop: 'f', techs: ['saban', 'sulama'], los: 4, age: 1 },
  depo:     { n: 'Depo', ico: '📦', sz: 2, hp: 600, cost: { w: 100 }, t: 15, drop: 'wgs', techs: ['balta', 'testere', 'madenci', 'madenci2'], los: 4, age: 1 },
  ciftlik:  { n: 'Çiftlik', ico: '🌱', sz: 2, hp: 300, cost: { w: 60 }, t: 8, farm: 1, walk: 1, los: 1, age: 1 },
  palisat:  { n: 'Palisat', ico: '🪵', sz: 1, hp: 250, cost: { w: 2 }, t: 3, los: 1, age: 1, wall: 1 },
  kapi:     { n: 'Kapı', ico: '🚪', sz: 1, hp: 700, cost: { w: 30 }, t: 8, los: 2, age: 1, gate: 1 },
  kisla:    { n: 'Kışla', ico: '⚔️', sz: 3, hp: 1200, cost: { w: 175 }, t: 25, trains: ['kilicli', 'mizrakci'], techs: ['tatbikat'], los: 4, age: 1 },
  menzil:   { n: 'Okçu Menzili', ico: '🏹', sz: 3, hp: 1200, cost: { w: 175 }, t: 25, trains: ['okcu'], techs: ['hizli'], los: 4, age: 2 },
  ahir:     { n: 'Ahır', ico: '🐴', sz: 3, hp: 1200, cost: { w: 175 }, t: 25, trains: ['atli', 'zirhli'], techs: ['atcilik'], los: 4, age: 2 },
  demirci:  { n: 'Demirci', ico: '⚒️', sz: 3, hp: 1200, cost: { w: 150 }, t: 25, techs: ['demir', 'sivriuc', 'pulzirh', 'deri', 'atzirh', 'celik', 'delici', 'zincir'], los: 4, age: 2 },
  atolye:   { n: 'Kuşatma Atölyesi', ico: '⚙️', sz: 3, hp: 1200, cost: { w: 200 }, t: 30, trains: ['koc', 'mancinik'], los: 4, age: 2 },
  kule:     { n: 'Gözcü Kulesi', ico: '🗼', sz: 2, hp: 800, cost: { w: 25, s: 125 }, t: 20, atk: 5, rng: 7, rof: 2, los: 9, age: 2, gar: 5 },
  sur:      { n: 'Taş Sur', ico: '🧱', sz: 1, hp: 1500, cost: { s: 5 }, t: 6, los: 1, age: 2, wall: 1 },
  kale:     { n: 'Kale', ico: '🏰', sz: 4, hp: 4800, cost: { s: 650 }, t: 60, trains: ['UU'], techs: ['OZ'], atk: 10, rng: 8, rof: 2, los: 10, age: 3, gar: 20 },
};
const BUILD_ECO = ['ev', 'ciftlik', 'degirmen', 'depo', 'tc', 'palisat', 'kapi'];
const BUILD_MIL = ['kisla', 'menzil', 'ahir', 'demirci', 'atolye', 'kule', 'sur', 'kale'];

const TECH = {
  cag2:     { n: 'Kale Çağı', ico: '🏯', cost: { f: 500 }, t: 40, age: 1, d: 'Yeni binalar ve birimler. Gerekli: Depo, Değirmen, Kışla’dan 2 tanesi.' },
  cag3:     { n: 'İmparatorluk Çağı', ico: '👑', cost: { f: 800, g: 200 }, t: 55, age: 2, d: 'Kale, özel birim, mancınık. Gerekli: Menzil, Ahır, Atölye, Demirci’den 2 tanesi.' },
  elarabasi:{ n: 'El Arabası', ico: '🛒', cost: { f: 175, w: 50 }, t: 25, age: 2, d: 'Köylüler %10 hızlı, 14 kaynak taşır (10 yerine)' },
  saban:    { n: 'At Koşumu', ico: '🐂', cost: { f: 75, w: 75 }, t: 20, age: 1, d: 'Çiftlik verimi +%15' },
  sulama:   { n: 'Sulama Kanalları', ico: '💧', cost: { f: 200, w: 125 }, t: 30, age: 2, d: 'Çiftlik verimi +%15' },
  balta:    { n: 'Çift Balta', ico: '🪓', cost: { f: 100, w: 50 }, t: 15, age: 1, d: 'Odun toplama +%20' },
  testere:  { n: 'Bıçkı Testeresi', ico: '🪚', cost: { f: 150, w: 100 }, t: 25, age: 2, d: 'Odun toplama +%20' },
  madenci:  { n: 'Madencilik', ico: '⛏️', cost: { f: 100, w: 75 }, t: 20, age: 2, d: 'Altın ve taş +%15' },
  madenci2: { n: 'Derin Maden', ico: '💎', cost: { f: 200, w: 150 }, t: 30, age: 3, d: 'Altın ve taş +%15' },
  tatbikat: { n: 'Tatbikat', ico: '🥁', cost: { f: 100, g: 50 }, t: 20, age: 2, d: 'Piyade %15 daha hızlı' },
  hizli:    { n: 'Hızlı Atış', ico: '💨', cost: { f: 150, w: 100 }, t: 25, age: 2, d: 'Okçular %15 daha hızlı ok atar' },
  atcilik:  { n: 'Atçılık', ico: '🐎', cost: { f: 150, g: 100 }, t: 25, age: 2, d: 'Atlı birimler +20 can' },
  demir:    { n: 'Demir Döküm', ico: '🔨', cost: { f: 150, g: 50 }, t: 25, age: 2, d: 'Piyade ve atlı saldırısı +1' },
  celik:    { n: 'Çelik Dövme', ico: '🔥', cost: { f: 275, g: 225 }, t: 35, age: 3, req: 'demir', d: 'Piyade ve atlı saldırısı +2' },
  sivriuc:  { n: 'Sivri Uç', ico: '🎯', cost: { f: 100, w: 50 }, t: 20, age: 2, d: 'Okçu, kule, kale: saldırı +1, menzil +1' },
  delici:   { n: 'Delici Ok', ico: '🏹', cost: { f: 200, g: 100 }, t: 30, age: 3, req: 'sivriuc', d: 'Okçu, kule, kale: saldırı +1, menzil +1' },
  pulzirh:  { n: 'Pul Zırh', ico: '🛡️', cost: { f: 100 }, t: 20, age: 2, d: 'Piyade zırhı +1/+1' },
  zincir:   { n: 'Zincir Zırh', ico: '⛓️', cost: { f: 200, g: 100 }, t: 30, age: 3, req: 'pulzirh', d: 'Piyade zırhı +1/+2' },
  deri:     { n: 'Deri Zırh', ico: '🧥', cost: { f: 100 }, t: 20, age: 2, d: 'Okçu zırhı +1/+1' },
  atzirh:   { n: 'At Zırhı', ico: '🐴', cost: { f: 150 }, t: 20, age: 2, d: 'Atlı zırhı +1/+1' },
  oz_bozkir:{ n: 'Kurt Sürüsü', ico: '🐺', cost: { f: 400, g: 300 }, t: 40, age: 3, d: 'Bozkır özel: tüm atlılar saldırı +2' },
  oz_liman: { n: 'Paralı Ordular', ico: '💰', cost: { f: 300, g: 300 }, t: 40, age: 3, d: 'Liman özel: Kalkanlı Paralı +25 can, altın +%15' },
  oz_dag:   { n: 'Granit Surlar', ico: '🏔️', cost: { f: 300, s: 300 }, t: 40, age: 3, d: 'Dağ özel: sur, kapı, kule ve kale %40 dayanıklı' },
  oz_orman: { n: 'Gölge Ok', ico: '🌘', cost: { f: 300, w: 300 }, t: 40, age: 3, d: 'Orman özel: okçular +1 menzil, +2 görüş' },
};

const RESK = { tree: 'w', gold: 'g', stone: 's', berry: 'f', deer: 'f', boar: 'f' };
const RES_AMT = { tree: 100, gold: 800, stone: 600, berry: 125, deer: 100, boar: 340 };
const GATHER = { f: 0.34, w: 0.39, g: 0.38, s: 0.36 }; // per second

// spiral offsets (deterministic)
const SPIRAL = (() => { const a = []; for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) a.push([x, y]); a.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1]) || p[1] - q[1] || p[0] - q[0]); return a; })();

// ---------------- stats with civ/tech modifiers ----------------
function techKey(p, t) { return t === 'OZ' ? 'oz_' + p.civ : t; }
function isRanged(c) { return c.rng > 0 && c.cls !== 'siege'; }
function uStat(p, type) {
  let c = p.uc[type]; if (c) return c;
  const b = UT[type], T = p.tech; c = Object.assign({}, b); c.bonus = b.bonus || {}; c.cost = Object.assign({}, b.cost);
  if (p.civ === 'bozkir' && c.cls === 'cav') { c.spd = c.spd * 1.15; for (const k in c.cost) c.cost[k] = Math.floor(c.cost[k] * 0.85); }
  if (p.civ === 'orman' && c.cls === 'arch') c.rng += 1;
  const melee = (c.cls === 'inf' || c.cls === 'cav') && !isRanged(c);
  if (T.demir && melee) c.atk += 1;
  if (T.celik && melee) c.atk += 2;
  if (isRanged(c)) { if (T.sivriuc) { c.atk += 1; c.rng += 1; } if (T.delici) { c.atk += 1; c.rng += 1; } if (T.hizli) c.rof = c.rof * 0.85; }
  if (c.cls === 'inf') { if (T.pulzirh) { c.ar += 1; c.pa += 1; } if (T.zincir) { c.ar += 1; c.pa += 2; } if (T.tatbikat) c.spd = c.spd * 1.15; }
  if (c.cls === 'arch' && T.deri) { c.ar += 1; c.pa += 1; }
  if (c.cls === 'cav') { if (T.atzirh) { c.ar += 1; c.pa += 1; } if (T.atcilik) c.hp += 20; if (T.oz_bozkir) c.atk += 2; }
  if (c.cls === 'vil' && T.elarabasi) c.spd = c.spd * 1.1;
  if (type === 'kalkanli' && T.oz_liman) c.hp += 25;
  if (c.cls === 'arch' && T.oz_orman) { c.rng += 1; c.los += 2; }
  c.spx = c.spd * TILE / TPS;
  p.uc[type] = c; return c;
}
const MSC = {};
function monStat(t) { let c = MSC[t]; if (!c) { c = Object.assign({}, UT[t]); c.bonus = c.bonus || {}; c.spx = c.spd * TILE / TPS; MSC[t] = c; } return c; }
function ust(s, u) { return u.o === GAIA ? monStat(u.t) : uStat(s.players[u.o], u.t); }
function bStat(p, type) {
  let c = p.bc[type]; if (c) return c;
  const b = BT[type], T = p.tech; c = Object.assign({}, b);
  if (p.civ === 'dag') { c.hp = Math.floor(c.hp * 1.25); if (type === 'kule') c.rng += 1; }
  if (T.oz_dag && (b.wall || b.gate || type === 'kule' || type === 'kale')) c.hp = Math.floor(c.hp * 1.4);
  if (c.atk) { if (T.sivriuc) { c.atk += 1; c.rng += 1; } if (T.delici) { c.atk += 1; c.rng += 1; } }
  p.bc[type] = c; return c;
}
function carryCap(p) { return p.tech.elarabasi ? 14 : 10; }
function gatherRate(p, k, farm, meat) {
  let r = GATHER[k];
  if (meat) r = 0.45;
  if (farm) { r = 0.30; if (p.tech.saban) r *= 1.15; if (p.tech.sulama) r *= 1.15; }
  if (k === 'g' && p.civ === 'liman') r *= 1.2;
  if (k === 'g' && p.tech.oz_liman) r *= 1.15;
  if (k === 's' && p.civ === 'dag') r *= 1.2;
  if (k === 'w' && p.civ === 'orman') r *= 1.2;
  if (k === 'w' && p.tech.balta) r *= 1.2;
  if (k === 'w' && p.tech.testere) r *= 1.2;
  if ((k === 'g' || k === 's') && p.tech.madenci) r *= 1.15;
  if ((k === 'g' || k === 's') && p.tech.madenci2) r *= 1.15;
  if (p.ai) r *= [0.8, 1, 1.2][p.ai.diff];
  return r / TPS;
}
function trainType(p, t) { return t === 'UU' ? CIVS[p.civ].uu : t; }
function afford(p, cost, mul) { mul = mul || 1; for (const k in cost) if (p.res[k] < cost[k] * mul) return false; return true; }
function pay(p, cost) { for (const k in cost) p.res[k] -= cost[k]; }
function refund(p, cost) { for (const k in cost) p.res[k] += cost[k]; }
function isEnemy(s, a, b) {
  if (a === GAIA) return b >= 0;
  if (b === GAIA) return a >= 0;
  if (a < 0 || b < 0 || a === b) return false;
  const ta = s.players[a].team, tb = s.players[b].team;
  return ta === 0 || ta !== tb;
}
function ageReqMet(s, p, tech) {
  let list = tech === 'cag2' ? ['depo', 'degirmen', 'kisla'] : tech === 'cag3' ? ['menzil', 'ahir', 'atolye', 'demirci'] : null;
  if (!list) return true;
  const have = {};
  for (const e of s.ents) if (e.k === 'b' && e.o === p.slot && e.built && !e.dead && list.indexOf(e.t) >= 0) have[e.t] = 1;
  return Object.keys(have).length >= 2;
}

// ---------------- creation ----------------
function newSim(cfg) {
  const n = cfg.players.length;
  const W = (SIZES[cfg.size] || SIZES.orta)[n <= 2 ? 0 : 1], H = W;
  const popMax = [75, 100, 150, 200].indexOf(cfg.pop) >= 0 ? cfg.pop : 150;
  const s = {
    W, H, tick: 0, nextId: 1, ents: [], byId: new Map(), seed: cfg.seed,
    blk: new Int32Array(W * H), occ: new Int32Array(W * H), gate: new Int32Array(W * H), ground: new Uint8Array(W * H), terr: new Uint8Array(W * H), hgt: new Uint8Array(W * H), map: cfg.map || 'ova',
    rs: cfg.seed | 0, rng: null, popMax, size: cfg.size || 'orta', startRes: cfg.res || 'dusuk', players: [], fx: [], ev: [], pathBudget: 0, over: false, winner: -1,
    bw: Math.ceil(W / 4), bh: Math.ceil(H / 4), bk: null, mon: MON_N[cfg.mon] != null ? cfg.mon : 'az', camps: [],
  };
  s.rng = makeRng(s);
  s.bk = []; for (let i = 0; i < s.bw * s.bh; i++) s.bk.push([]);
  cfg.players.forEach((pc, i) => {
    const p = { slot: i, civ: pc.civ, team: pc.team || 0, name: pc.name || ('Oyuncu ' + (i + 1)), color: COLORS[i],
      res: Object.assign({}, START_RES[cfg.res] || START_RES.dusuk), age: 1, tech: {}, researching: {}, bell: false, pop: 0, popCap: 0,
      uc: {}, bc: {}, alive: true, ai: null, human: !pc.ai, lastAlert: -999, stats: { kills: 0, lost: 0, gathered: 0 } };
    if (p.civ === 'liman') p.res.g += 100;
    if (pc.ai) p.ai = newAI(pc.diff == null ? 1 : pc.diff);
    s.players.push(p);
  });
  genMap(s, s.map);
  rebuildBuckets(s); s.pcache = new Map();
  return s;
}
function newAI(diff) { return { diff, next: [5400, 4200, 3000][diff], wave: 0, attacking: false, k: 0, saving: false, scout: null, si: 0, waveN: 0, raidT: 0, bellT: 0 }; }

function addEnt(s, e) { e.id = s.nextId++; s.ents.push(e); s.byId.set(e.id, e); return e; }
function addRes(s, type, tx, ty) {
  const i = ty * s.W + tx;
  if (tx < 0 || ty < 0 || tx >= s.W || ty >= s.H || s.occ[i]) return null;
  const e = addEnt(s, { k: 'r', t: type, o: -1, tx, ty, sz: 1, x: tx * TILE + 16, y: ty * TILE + 16, amt: RES_AMT[type], v: (s.rng() * 4) | 0 });
  s.occ[i] = e.id; s.blk[i] = e.id; return e;
}
function addAnimal(s, type, tx, ty) {
  if (tx < 1 || ty < 1 || tx >= s.W - 1 || ty >= s.H - 1 || s.blk[ty * s.W + tx]) return null;
  const x = tx * TILE + 16, y = ty * TILE + 16;
  return addEnt(s, { k: 'r', t: type, o: -1, tx, ty, sz: 1, x, y, px: x, py: y, hx: x, hy: y, amt: RES_AMT[type], hp: type === 'boar' ? 70 : 5,
    live: true, mob: true, r: type === 'boar' ? 10 : 9, wt: 0, wx: null, wy: null, fl: 0, fx: 0, fy: 0, tgt: 0, cd: 0, face: 1, v: 0 });
}
function addBld(s, o, type, tx, ty, built) {
  const p = s.players[o], st = bStat(p, type), sz = st.sz;
  const e = addEnt(s, { k: 'b', t: type, o, tx, ty, sz, x: (tx + sz / 2) * TILE, y: (ty + sz / 2) * TILE,
    hp: built ? st.hp : 1, maxhp: st.hp, built: !!built, prog: 0, q: [], rally: null, cd: 0, farmer: 0, gl: [] });
  for (let y = ty; y < ty + sz; y++) for (let x = tx; x < tx + sz; x++) { const i = y * s.W + x; s.occ[i] = e.id; if (!st.walk) s.blk[i] = e.id; }
  if (built) recalcPop(s, p);
  return e;
}
function addUnit(s, o, type, x, y) {
  const p = s.players[o], st = uStat(p, type);
  const e = addEnt(s, { k: 'u', t: type, o, x, y, px: x, py: y, r: st.r, hp: st.hp, maxhp: st.hp, st: 'idle', tgt: 0,
    path: null, pi: 0, pathT: 0, cd: 0, carry: 0, ck: '', gk: '', gt: 0, bt: 0, drop: 0, dest: null, acc: 0, stuck: 0, face: 1,
    sn: 0, gar: 0, ms: 0, forced: false, gx: x, gy: y });
  p.pop++;
  return e;
}
function recalcPop(s, p) {
  let c = 0; for (const e of s.ents) if (e.k === 'b' && e.o === p.slot && e.built && !e.dead) { const st = BT[e.t]; if (st.pop) c += st.pop; }
  p.popCap = Math.min(s.popMax, c);
}

// ---------------- map generation ----------------
function genMap(s, mapType) {
  const W = s.W, H = s.H, rng = s.rng, n = s.players.length;
  for (let i = 0; i < W * H; i++) s.ground[i] = (rng() * 4) | 0;
  const m = Math.max(10, Math.round(W * 0.14)), area = (W * H) / ((n <= 2 ? 64 : 80) ** 2);
  let spots = [[m, m], [W - m - 1, H - m - 1], [W - m - 1, m], [m, H - m - 1]];
  if (n === 2) spots = rng() < 0.5 ? [spots[0], spots[1]] : [spots[2], spots[3]];
  for (let i = spots.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
  s.starts = [];
  for (let i = 0; i < n; i++) s.starts.push(spots[i]);
  const keep = new Uint8Array(W * H);
  const clear = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < W && y < H) keep[y * W + x] = 1; };
  const far = (x, y, r) => { for (const [sx, sy] of s.starts) { const dx = x - sx, dy = y - sy; if (dx * dx + dy * dy < r * r) return false; } return true; };
  // ---- water: river with fords, and lakes ----
  const water = (x, y) => { if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return; const i = y * W + x; if (keep[i] || s.terr[i] || !far(x, y, 12)) return; s.terr[i] = 1; s.blk[i] = -1; s.occ[i] = -1; };
  if (mapType === 'nehir') {
    const vert = rng() < 0.5, L = vert ? H : W, C = (vert ? W : H) >> 1;
    const fords = [Math.floor(L * 0.2), Math.floor(L * 0.5), Math.floor(L * 0.8)];
    let off = 0;
    for (let a = 0; a < L; a++) {
      off += (rng() - 0.5) * 1.3; off = Math.max(-5, Math.min(5, off));
      const c = C + Math.round(off), ford = fords.some(f => Math.abs(a - f) <= 1);
      for (let w = -2; w <= 1; w++) {
        const x = vert ? c + w : a, y = vert ? a : c + w; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (ford) { s.terr[i] = 2; keep[i] = 1; } else { s.terr[i] = 1; s.blk[i] = -1; s.occ[i] = -1; }
      }
    }
  }
  const lakes = mapType === 'ova' ? 3 : mapType === 'yayla' ? 2 : 1;
  for (let k = 0, g = 0; k < lakes && g < 300; g++) {
    const x = 4 + ((rng() * (W - 8)) | 0), y = 4 + ((rng() * (H - 8)) | 0);
    if (!far(x, y, 16) || s.terr[y * W + x]) continue;
    const open = [[x, y]], size = 14 + ((rng() * 20) | 0); let placed = 0, guard = 0;
    while (open.length && placed < size && guard++ < 600) {
      const j = (rng() * open.length) | 0, [px, py] = open[j]; open.splice(j, 1);
      const i = py * W + px; if (px < 2 || py < 2 || px >= W - 2 || py >= H - 2 || s.terr[i] || keep[i] || !far(px, py, 12)) continue;
      water(px, py); placed++; open.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    k++;
  }
  // ---- hills (height 1 and 2) ----
  const hills = mapType === 'yayla' ? 11 : mapType === 'nehir' ? 4 : 5;
  const raise = (cx, cy, size, lvl) => {
    const open = [[cx, cy]]; let placed = 0, guard = 0;
    while (open.length && placed < size && guard++ < size * 20) {
      const j = (rng() * open.length) | 0, [px, py] = open[j]; open.splice(j, 1);
      if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
      const i = py * W + px; if (s.hgt[i] >= lvl || s.terr[i] || !far(px, py, 6)) continue;
      if (lvl === 2 && s.hgt[i] < 1) continue;
      s.hgt[i] = lvl; placed++; open.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  };
  for (let k = 0, g = 0; k < hills && g < 300; g++) {
    const x = 3 + ((rng() * (W - 6)) | 0), y = 3 + ((rng() * (H - 6)) | 0);
    if (s.terr[y * W + x] || !far(x, y, 8)) continue;
    raise(x, y, 40 + ((rng() * 60) | 0), 1);
    if (rng() < 0.6) raise(x, y, 10 + ((rng() * 18) | 0), 2);
    k++;
  }
  // ---- players ----
  const blob = (type, cx, cy, size, respectKeep) => {
    const open = [[cx, cy]]; let placed = 0, guard = 0;
    while (open.length && placed < size && guard++ < size * 30) {
      const k = (rng() * open.length) | 0; const [x, y] = open[k]; open.splice(k, 1);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x; if (s.occ[i] || (respectKeep && keep[i])) continue;
      if (addRes(s, type, x, y)) { placed++; open.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    }
  };
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let i = 0; i < n; i++) clear(spots[i][0], spots[i][1], 5);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = spots[i];
    addBld(s, i, 'tc', sx - 1, sy - 1, true);
    const pos = [[sx - 1, sy + 3], [sx + 1, sy + 3], [sx + 3, sy + 1]];
    for (const [x, y] of pos) addUnit(s, i, 'koylu', x * TILE + 16, y * TILE + 16);
    addUnit(s, i, 'atli', (sx + 3) * TILE + 16, (sy - 1) * TILE + 16);
    const d0 = (rng() * 8) | 0;
    const at = (dist, di) => { const d = DIRS[(d0 + di) % 8], len = Math.sqrt(d[0] * d[0] + d[1] * d[1]); return [Math.max(2, Math.min(W - 3, Math.floor(sx + d[0] * dist / len))), Math.max(2, Math.min(H - 3, Math.floor(sy + d[1] * dist / len)))]; };
    const put = (type, dist, size, di) => { const [cx, cy] = at(dist, di); blob(type, cx, cy, size, true); };
    put('berry', 7, 6, 0); put('gold', 8, 6, 2); put('stone', 9, 5, 5); put('gold', 13, 5, 6);
    put('tree', 10, 28, 3); put('tree', 11, 24, 7); put('tree', 14, 30, 4);
    const [hx, hy] = at(9, 1); for (let k = 0; k < 4; k++) addAnimal(s, 'deer', hx + (k % 2), hy + (k >> 1));
    const [bx, by] = at(13, 4); addAnimal(s, 'boar', bx, by);
    const [cx2, cy2] = at(14, 7); addAnimal(s, 'boar', cx2, cy2);
  }
  const forests = Math.round((n <= 2 ? 14 : 22) * area);
  for (let k = 0, g = 0; k < forests && g < 500; g++) {
    const x = 2 + ((rng() * (W - 4)) | 0), y = 2 + ((rng() * (H - 4)) | 0);
    if (!far(x, y, 13)) continue; blob('tree', x, y, 15 + ((rng() * 35) | 0), true); k++;
  }
  for (let k = 0, g = 0; k < Math.round((n + 2) * area) && g < 500; g++) {
    const x = 4 + ((rng() * (W - 8)) | 0), y = 4 + ((rng() * (H - 8)) | 0);
    if (!far(x, y, 16)) continue; blob(k % 3 === 2 ? 'stone' : 'gold', x, y, 6, true); k++;
  }
  for (let k = 0, g = 0; k < n + 1 && g < 500; g++) {
    const x = 4 + ((rng() * (W - 8)) | 0), y = 4 + ((rng() * (H - 8)) | 0);
    if (!far(x, y, 15)) continue; blob('berry', x, y, 5, true); k++;
  }
  for (let k = 0, g = 0; k < n + 3 && g < 500; g++) {
    const x = 3 + ((rng() * (W - 6)) | 0), y = 3 + ((rng() * (H - 6)) | 0);
    if (!far(x, y, 15)) continue; const c = 3 + ((rng() * 3) | 0); for (let j = 0; j < c; j++) addAnimal(s, 'deer', x + (j % 2), y + (j >> 1)); k++;
  }
  // ---- wild monster camps ----
  const nc = Math.round((n + 1) * (MON_N[s.mon] || 0) * area);
  for (let k = 0, g = 0; k < nc && g < 800; g++) {
    const x = 5 + ((rng() * (W - 10)) | 0), y = 5 + ((rng() * (H - 10)) | 0);
    if (!far(x, y, 17)) continue;
    if (s.camps.some(c => Math.abs(c.x / TILE - x) + Math.abs(c.y / TILE - y) < 12)) continue;
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (y + dy) * W + x + dx; if (s.blk[i] || s.terr[i] === 1) { ok = false; break; } }
    if (!ok) continue;
    const t = k % 2 === 0 ? 'ork' : 'balcik', cp = s.camps.length;
    s.camps.push({ t, x: x * TILE + 16, y: y * TILE + 16, m: [], done: false });
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { s.occ[(y + dy) * W + x + dx] = -1; }
    if (t === 'ork') blob('gold', x + 3, y + 2, 5, true); else blob('berry', x - 3, y + 2, 5, true);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (y + dy) * W + x + dx; if (s.occ[i] === -1 && !s.blk[i]) s.occ[i] = 0; }
    const extra = 2 + (rng() < 0.5 ? 1 : 0) + (s.mon === 'cok' ? 1 : 0);
    if (t === 'ork') { addMonster(s, 'orkreis', x, y, cp); for (let j = 0; j < extra; j++) addMonster(s, 'ork', x + [1, -1, 1, -1][j], y + [1, 1, -1, -1][j], cp); }
    else { addMonster(s, 'devbalcik', x, y, cp); for (let j = 0; j < extra; j++) addMonster(s, 'balcik', x + [1, -1, 1, -1][j], y + [1, 1, -1, -1][j], cp); }
    k++;
  }
}

// ---------------- geometry ----------------
function tileOf(v) { return Math.floor(v / TILE); }
function blocked(s, x, y, o) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= s.W || ty >= s.H) return true;
  const i = ty * s.W + tx;
  if (s.blk[i] !== 0) return true;
  const g = s.gate[i];
  return g !== 0 && (o == null || isEnemy(s, o, g - 1));
}
function tileBlockedFor(s, i, o) { if (s.blk[i]) return true; const g = s.gate[i]; return g !== 0 && isEnemy(s, o, g - 1); }
// straight/diagonal line of tiles for walls (deterministic)
function wallLine(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.min(40, Math.max(Math.abs(dx), Math.abs(dy)));
  const out = []; if (n === 0) return [[x0, y0]];
  const L = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) out.push([x0 + Math.round(dx * i / L), y0 + Math.round(dy * i / L)]);
  return out;
}
function rectDist(x, y, e) { // distance from point to entity footprint
  if (e.k === 'u' || e.mob) { const dx = x - e.x, dy = y - e.y; return Math.sqrt(dx * dx + dy * dy) - e.r; }
  const x0 = e.tx * TILE, y0 = e.ty * TILE, x1 = x0 + e.sz * TILE, y1 = y0 + e.sz * TILE;
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return Math.sqrt(dx * dx + dy * dy);
}
function edgeDist(u, t) { return rectDist(u.x, u.y, t) - u.r; }
function nearestFreeTile(s, tx, ty, o) {
  for (const [dx, dy] of SPIRAL) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < s.W && y < s.H && !(o == null ? s.blk[y * s.W + x] : tileBlockedFor(s, y * s.W + x, o))) return [x, y]; }
  return [tx, ty];
}

// ---------------- pathfinding (A*, 8-dir, integer costs) ----------------
let PF = null;
function pfInit(s) {
  const N = s.W * s.H;
  if (PF && PF.N === N) return PF;
  PF = { N, g: new Int32Array(N), f: new Int32Array(N), from: new Int32Array(N), seen: new Int32Array(N), closed: new Int32Array(N), gen: 0, heap: new Int32Array(N * 8 + 16) };
  return PF;
}
function findPath(s, sx, sy, gx, gy, tgt, o) {
  const W = s.W, H = s.H, P = pfInit(s);
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  gx = Math.max(0, Math.min(W - 1, gx)); gy = Math.max(0, Math.min(H - 1, gy));
  let x0 = gx, y0 = gy, x1 = gx, y1 = gy; // goal rect (for entity targets: tiles adjacent to footprint)
  if (tgt && tgt.k !== 'u') { x0 = tgt.tx - 1; y0 = tgt.ty - 1; x1 = tgt.tx + tgt.sz; y1 = tgt.ty + tgt.sz; }
  else if (s.blk[gy * W + gx]) { const f = nearestFreeTile(s, gx, gy); x0 = x1 = gx = f[0]; y0 = y1 = gy = f[1]; }
  const isGoal = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && !(tgt && tgt.k !== 'u' && x >= tgt.tx && x < tgt.tx + tgt.sz && y >= tgt.ty && y < tgt.ty + tgt.sz);
  const hx = (x0 + x1) >> 1, hy = (y0 + y1) >> 1;
  const H8 = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return dx > dy ? 10 * dx + 4 * dy : 10 * dy + 4 * dx; };
  if (isGoal(sx, sy)) { const r = []; r.ok = true; return r; }
  const gen = ++P.gen; let hn = 0; const heap = P.heap, f = P.f, g = P.g;
  const push = (i) => { let k = hn++; heap[k] = i; while (k > 0) { const pk = (k - 1) >> 1; if (f[heap[pk]] < f[i] || (f[heap[pk]] === f[i] && heap[pk] < i)) break; heap[k] = heap[pk]; k = pk; } heap[k] = i; };
  const pop = () => { const top = heap[0]; const last = heap[--hn]; let k = 0;
    while (true) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && (f[heap[c + 1]] < f[heap[c]] || (f[heap[c + 1]] === f[heap[c]] && heap[c + 1] < heap[c]))) c++;
      if (f[last] < f[heap[c]] || (f[last] === f[heap[c]] && last <= heap[c])) break; heap[k] = heap[c]; k = c; }
    heap[k] = last; return top; };
  const si = sy * W + sx; P.seen[si] = gen; g[si] = 0; f[si] = H8(sx, sy); P.from[si] = -1; push(si);
  let best = si, bestH = f[si], exp = 0, found = -1;
  while (hn > 0 && exp < 6400) {
    const c = pop(); if (P.closed[c] === gen) continue; P.closed[c] = gen; exp++;
    const cx = c % W, cy = (c / W) | 0;
    if (isGoal(cx, cy)) { found = c; break; }
    const hc = f[c] - g[c]; if (hc < bestH) { bestH = hc; best = c; }
    for (let d = 0; d < 8; d++) {
      const dx = d === 0 || d === 4 || d === 5 ? 1 : d === 1 || d === 6 || d === 7 ? -1 : 0;
      const dy = d === 2 || d === 4 || d === 6 ? 1 : d === 3 || d === 5 || d === 7 ? -1 : 0;
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (P.closed[ni] === gen || tileBlockedFor(s, ni, o)) continue;
      if (dx && dy && (tileBlockedFor(s, cy * W + nx, o) || tileBlockedFor(s, ny * W + cx, o))) continue;
      const ng = g[c] + (dx && dy ? 14 : 10);
      if (P.seen[ni] !== gen || ng < g[ni]) { P.seen[ni] = gen; g[ni] = ng; f[ni] = ng + H8(nx, ny); P.from[ni] = c; push(ni); }
    }
  }
  let end = found >= 0 ? found : best; const out = [];
  while (end !== si && end >= 0) { out.push(end); end = P.from[end]; }
  out.reverse(); out.ok = found >= 0; return out;
}

// ---------------- buckets ----------------
function rebuildBuckets(s) {
  for (const b of s.bk) b.length = 0;
  s.blds = []; s.resl = [];
  s.anim = [];
  for (const e of s.ents) { if (e.dead) continue; if (e.k === 'b') s.blds.push(e); else if (e.k === 'r') { s.resl.push(e); if (e.mob && e.live) s.anim.push(e); } }
  for (const e of s.ents) if (e.k === 'u' && !e.dead && !e.gar) {
    const bx = Math.max(0, Math.min(s.bw - 1, Math.floor(e.x / (TILE * 4)))), by = Math.max(0, Math.min(s.bh - 1, Math.floor(e.y / (TILE * 4))));
    s.bk[by * s.bw + bx].push(e);
  }
}
function nearUnits(s, x, y, rad, fn) {
  const R = TILE * 4;
  const bx0 = Math.max(0, Math.floor((x - rad) / R)), bx1 = Math.min(s.bw - 1, Math.floor((x + rad) / R));
  const by0 = Math.max(0, Math.floor((y - rad) / R)), by1 = Math.min(s.bh - 1, Math.floor((y + rad) / R));
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const e of s.bk[by * s.bw + bx]) fn(e);
}
function findEnemy(s, o, x, y, rad, onlyBld) {
  let best = null, bd = rad * rad + 1;
  if (!onlyBld) nearUnits(s, x, y, rad, (e) => {
    if (e.dead || !isEnemy(s, o, e.o)) return;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; }
  });
  if (best) return best;
  bd = rad;
  for (const e of s.blds) if (!e.dead && isEnemy(s, o, e.o) && !BT[e.t].wall && !BT[e.t].gate) { const d = rectDist(x, y, e); if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------------- movement ----------------
function steer(s, u, tx, ty, spd) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.01) return true;
  const st = d <= spd ? 1 : spd / d;
  const nx = u.x + dx * st, ny = u.y + dy * st;
  if (dx > 0.5) u.face = 1; else if (dx < -0.5) u.face = -1;
  if (!blocked(s, nx, ny, u.o)) { u.x = nx; u.y = ny; }
  else if (!blocked(s, nx, u.y, u.o)) u.x = nx;
  else if (!blocked(s, u.x, ny, u.o)) u.y = ny;
  else return false;
  return d <= spd;
}
// is the straight line between two points free of obstacles for owner o? (sampled every 8px)
function lineClear(s, x0, y0, x1, y1, o, stopShort) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
  const L = d - (stopShort || 0); if (L <= 0) return true;
  const n = Math.ceil(L / 8);
  for (let i = 1; i <= n; i++) { const k = Math.min(L, i * 8) / d; if (blocked(s, x0 + dx * k, y0 + dy * k, o)) return false; }
  return true;
}
// remove zig-zag: keep only the waypoints where the straight line gets blocked
function smoothPath(s, x, y, path, o) {
  if (path.length < 3) return path;
  const W = s.W, out = []; let cx = x, cy = y, i = 0;
  while (i < path.length) {
    let j = i;
    for (let k = Math.min(path.length - 1, i + 14); k > i; k--) { const p = path[k]; if (lineClear(s, cx, cy, (p % W) * TILE + 16, ((p / W) | 0) * TILE + 16, o)) { j = k; break; } }
    const p = path[j]; out.push(p); cx = (p % W) * TILE + 16; cy = ((p / W) | 0) * TILE + 16; i = j + 1;
  }
  out.ok = path.ok; return out;
}
function goTo(s, u, gx, gy, tgt) {
  const W = s.W;
  gx = Math.max(0, Math.min(W - 1, gx)); gy = Math.max(0, Math.min(s.H - 1, gy));
  // open ground: walk straight, no A* needed
  if (!tgt && !s.blk[gy * W + gx] && lineClear(s, u.x, u.y, gx * TILE + 16, gy * TILE + 16, u.o)) { u.path = [gy * W + gx]; u.path.ok = true; u.pi = 0; u.pathT = s.tick; return true; }
  if (tgt && tgt.k !== 'u') {
    const nx = Math.max(tgt.tx * TILE, Math.min((tgt.tx + tgt.sz) * TILE, u.x)), ny = Math.max(tgt.ty * TILE, Math.min((tgt.ty + tgt.sz) * TILE, u.y));
    if (lineClear(s, u.x, u.y, nx, ny, u.o, 18)) { u.path = []; u.path.ok = true; u.pi = 0; u.pathT = s.tick; return true; }
  }
  const sx = tileOf(u.x), sy = tileOf(u.y), key = sx + ',' + sy + ',' + gx + ',' + gy + ',' + (tgt ? tgt.id : 0) + ',' + u.o;
  let p = s.pcache.get(key);
  if (!p) {
    if (s.pathBudget <= 0) return false;
    s.pathBudget--;
    p = smoothPath(s, u.x, u.y, findPath(s, sx, sy, gx, gy, tgt, u.o), u.o);
    s.pcache.set(key, p);
  }
  u.path = p.slice(); u.path.ok = p.ok; u.pi = 0; u.pathT = s.tick; return true;
}
// returns true when finished
function followPath(s, u, dest) {
  let spd = ust(s, u).spx; if (u.ms && u.ms < spd) spd = u.ms;
  if (u.pi < u.path.length) {
    const i = u.path[u.pi], tx = (i % s.W) * TILE + 16, ty = ((i / s.W) | 0) * TILE + 16;
    if (tileBlockedFor(s, i, u.o)) { u.path = null; return false; }
    const last = u.pi === u.path.length - 1 && dest;
    const wx = last ? dest.x : tx, wy = last ? dest.y : ty;
    const r = steer(s, u, wx, wy, spd);
    const dx = wx - u.x, dy = wy - u.y;
    if (r || dx * dx + dy * dy < (last ? 4 : 64)) u.pi++;
    return false;
  }
  if (dest) return steer(s, u, dest.x, dest.y, spd) || (Math.abs(dest.x - u.x) < 3 && Math.abs(dest.y - u.y) < 3);
  return true;
}
function approach(s, u, t, range) {
  const ed = edgeDist(u, t);
  if (ed <= range) { u.path = null; u.stuck = 0; u.np = 0; u.reps = 0; return true; }
  if (u.apT !== t.id) { u.apT = t.id; u.best = ed; u.np = 0; u.reps = 0; }
  else if (ed < u.best - 0.5) { u.best = ed; u.np = 0; }
  else if (++u.np > 30) { u.np = 0; u.best = ed; u.path = null; if (++u.reps > 3) { u.reps = 0; return 'stuck'; } }
  const spd = ust(s, u).spx;
  const isU = t.k === 'u' || !!t.mob;
  if (isU) { const dx = t.x - u.x, dy = t.y - u.y; if (dx * dx + dy * dy < TILE * TILE * 4) { u.path = null; steer(s, u, t.x, t.y, spd); return false; } }
  if (!u.path || (isU && s.tick - u.pathT > 12)) {
    if (!goTo(s, u, tileOf(t.x), tileOf(t.y), isU ? null : t)) return false;
  }
  if (u.pi >= u.path.length) {
    // final approach: head straight to the nearest point of the footprint
    let nx = t.x, ny = t.y;
    if (!isU) { nx = Math.max(t.tx * TILE, Math.min((t.tx + t.sz) * TILE, u.x)); ny = Math.max(t.ty * TILE, Math.min((t.ty + t.sz) * TILE, u.y)); }
    const ox = u.x, oy = u.y; steer(s, u, nx, ny, spd);
    if (Math.abs(u.x - ox) + Math.abs(u.y - oy) < 0.05) { if (++u.stuck > 25) { u.stuck = 0; u.path = null; return 'stuck'; } }
    return false;
  }
  followPath(s, u, null);
  return false;
}

// ---------------- combat ----------------
function canAttack(s, u, t) {
  if (!t || t.dead || t.k === 'r' || t.gar) return false;
  if (!isEnemy(s, u.o, t.o)) return false;
  const st = UT[u.t]; if (st.onlyBld && t.k !== 'b') return false;
  return true;
}
function hAt(s, e) { const tx = Math.max(0, Math.min(s.W - 1, Math.floor(e.x / TILE))), ty = Math.max(0, Math.min(s.H - 1, Math.floor(e.y / TILE))); return s.hgt[ty * s.W + tx]; }
function damage(s, aO, aSt, t, attacker, extra, src) {
  let dmg;
  if (t.k === 'u') {
    const ts = ust(s, t);
    dmg = Math.max(1, aSt.atk + (extra || 0) - (aSt.rng > 0 ? ts.pa : ts.ar)) + (aSt.bonus && aSt.bonus[ts.cls] || 0);
  } else {
    const base = aSt.rng > 0 && aSt.cls !== 'siege' ? Math.max(1, Math.floor(aSt.atk * 0.25)) : aSt.atk;
    dmg = base + (aSt.bonus && aSt.bonus.bld || 0);
    if (BT[t.t].wall || BT[t.t].gate) dmg = aSt.cls === 'siege' || (aSt.bonus && aSt.bonus.bld) ? dmg : Math.max(1, Math.floor(dmg * 0.5));
  }
  const from = attacker || src;
  if (from) { const ha = hAt(s, from), ht = hAt(s, t); if (ha > ht) dmg = Math.floor(dmg * 5 / 4) + 1; else if (ha < ht) dmg = Math.max(1, Math.floor(dmg * 3 / 4)); }
  if (aSt.rng === 0 || aSt.rng == null) s.fx.push({ k: 'hit', x: t.x, y: t.y, b: t.k === 'b' ? 1 : 0 });
  t.hp -= dmg;
  const tp = s.players[t.o];
  if (tp && s.tick - tp.lastAlert > 150) { tp.lastAlert = s.tick; s.ev.push({ o: t.o, m: 'Saldırı altındasınız!', x: t.x, y: t.y, alert: 1 }); }
  if (t.hp <= 0) {
    if (t.o === GAIA) t.kb = aO;
    kill(s, t); if (aO >= 0) s.players[aO].stats.kills++;
  } else if (t.o === GAIA) { if (attacker && attacker.o >= 0) campAggro(s, t, attacker); }
  else if (t.k === 'u' && attacker && UT[t.t].cls !== 'vil' && !UT[t.t].onlyBld && t.sn !== 2 && (t.st === 'idle' || (t.st === 'attack' && !t.forced && (s.byId.get(t.tgt) || {}).k === 'b')) && canAttack(s, t, attacker)) {
    t.st = 'attack'; t.tgt = attacker.id; t.path = null; t.forced = false;
  }
}
function ejectAll(s, b, onlyBell) {
  const keep = [];
  for (const id of b.gl) {
    const u = s.byId.get(id); if (!u || u.dead) continue;
    if (onlyBell && !u.bellIn) { keep.push(id); continue; }
    const rx = b.rally ? b.rally.x : b.x, ry = b.rally ? b.rally.y : b.y + b.sz * TILE;
    const sp = spawnSpot(s, b, rx, ry) || [b.tx, b.ty + b.sz];
    u.x = u.px = sp[0] * TILE + 16; u.y = u.py = sp[1] * TILE + 16; u.gar = 0; u.st = 'idle'; u.path = null; u.gx = u.x; u.gy = u.y;
    if (u.bellIn && u.pgt) { u.st = 'gather'; u.gt = u.pgt; u.gk = u.pgk; }
    else if (b.rally && !b.dead && u.t !== 'koylu') cmdMove(s, u.o, [u], b.rally.x, b.rally.y);
    u.bellIn = false; u.pgt = 0;
  }
  b.gl = keep;
}
function kill(s, e) {
  if (e.dead) return;
  if (e.k === 'b' && e.gl && e.gl.length) ejectAll(s, e, false);
  e.dead = true; s.anyDead = true;
  if (e.k === 'u' && e.o === GAIA) { monsterDied(s, e); return; }
  if (e.k === 'u') { const p = s.players[e.o]; p.pop--; p.stats.lost++; s.fx.push({ k: 'die', x: e.x, y: e.y, c: p.color, t: e.t, f: e.face, r: e.r, o: e.o }); }
  else if (e.mob) { /* animal carcass used up */ }
  else {
    if (e.k === 'r' && e.t === 'tree') s.fx.push({ k: 'stump', x: e.x, y: e.y });
    for (let y = e.ty; y < e.ty + e.sz; y++) for (let x = e.tx; x < e.tx + e.sz; x++) { const i = y * s.W + x; if (s.occ[i] === e.id) { s.occ[i] = 0; if (e.t === 'kapi') s.gate[i] = 0; } if (s.blk[i] === e.id) s.blk[i] = 0; }
    if (e.k === 'b') {
      const p = s.players[e.o];
      for (const it of e.q) if (it.k === 't') delete p.researching[it.id];
      s.fx.push({ k: 'boom', x: e.x, y: e.y, sz: e.sz });
      if (e.built && BT[e.t].pop) recalcPop(s, p);
    }
  }
}
function garCap(s, b) { const st = BT[b.t]; return st.gar ? st.gar - b.gl.length : 0; }
function canEnter(u, b) {
  if (!b || b.dead || b.k !== 'b' || !b.built || b.o !== u.o || !BT[b.t].gar) return false;
  const c = UT[u.t].cls; if (c === 'siege') return false;
  if (c === 'cav' && b.t !== 'kale') return false;
  return true;
}

// ---------------- commands ----------------
function ownUnits(s, o, ids) { const out = []; if (!Array.isArray(ids)) return out; for (const id of ids) { const e = s.byId.get(id); if (e && !e.dead && e.k === 'u' && e.o === o && !e.gar) out.push(e); } return out; }
function resetU(u) { u.path = null; u.tgt = 0; u.bt = 0; u.stuck = 0; u.dest = null; u.ms = 0; u.forced = false; u.apT = 0; u.np = 0; u.reps = 0; }
function clampW(s, v, max) { return Math.max(8, Math.min(max - 8, v)); }
function cmdMove(s, o, us, x, y) {
  us = us.slice().sort((a, b) => a.id - b.id);
  const vil = us.filter(u => u.t === 'koylu'), mil = us.filter(u => u.t !== 'koylu');
  const WW = s.W * TILE, HH = s.H * TILE;
  vil.forEach((u, i) => {
    const [ox, oy] = SPIRAL[Math.min(i, SPIRAL.length - 1)], gap = vil.length > 1 ? 22 : 0;
    resetU(u); u.st = 'move'; u.dest = { x: clampW(s, x + ox * gap, WW), y: clampW(s, y + oy * gap, HH) };
  });
  if (mil.length === 1) { const u = mil[0]; resetU(u); u.st = 'move'; u.dest = { x: clampW(s, x, WW), y: clampW(s, y, HH) }; }
  else if (mil.length > 1) formation(s, mil, x, y);
}
// AoE-style formation: melee in front, ranged behind, siege at the back; group moves at the slowest speed
function formation(s, us, x, y) {
  const n = us.length; let cx = 0, cy = 0, ms = 1e9;
  for (const u of us) { cx += u.x; cy += u.y; const sp = uStat(s.players[u.o], u.t).spx; if (sp < ms) ms = sp; }
  cx /= n; cy /= n;
  let dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy); if (d < 1) { dx = 0; dy = 1; d = 1; }
  dx /= d; dy /= d; const px = -dy, py = dx;
  const rank = (u) => { const st = UT[u.t]; return st.cls === 'siege' ? 2 : st.rng > 0 ? 1 : 0; };
  const ord = us.slice().sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 2))), gap = 24;
  const far = d > TILE * 4; // only sync speed for longer marches
  ord.forEach((u, i) => {
    const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
    const off = (col - (inRow - 1) / 2) * gap;
    resetU(u); u.st = 'move';
    u.dest = { x: clampW(s, x + px * off - dx * row * gap, s.W * TILE), y: clampW(s, y + py * off - dy * row * gap, s.H * TILE) };
    if (far) u.ms = ms;
  });
}
function cmdAttack(s, o, us, t) {
  for (const u of us) { if (!canAttack(s, u, t)) continue; resetU(u); u.st = 'attack'; u.tgt = t.id; u.forced = true; }
}
function cmdGather(s, o, us, r) {
  const isFarm = r.k === 'b' && r.t === 'ciftlik' && r.o === o && r.built;
  if (r.k !== 'r' && !isFarm) return;
  const k = isFarm ? 'f' : RESK[r.t];
  const others = [];
  for (const u of us) {
    if (u.t !== 'koylu') { others.push(u); continue; }
    resetU(u); u.st = 'gather'; u.gt = r.id; if (u.ck && u.ck !== k) u.carry = 0; u.gk = k;
  }
  if (others.length) cmdMove(s, o, others, r.x, r.y);
}
function cmdGarrison(s, o, us, b) {
  let free = garCap(s, b);
  for (const u of us) { if (!canEnter(u, b)) continue; if (free-- <= 0) break; resetU(u); u.st = 'garrison'; u.tgt = b.id; }
}
function canPlace(s, o, type, tx, ty) {
  const sz = BT[type].sz;
  if (tx < 0 || ty < 0 || tx + sz > s.W || ty + sz > s.H) return false;
  for (let y = ty; y < ty + sz; y++) for (let x = tx; x < tx + sz; x++) if (s.occ[y * s.W + x]) return false;
  return true;
}
function pushOut(s) {
  for (const e of s.ents) if (e.k === 'u' && !e.dead && !e.gar && blocked(s, e.x, e.y, e.o)) {
    const f = nearestFreeTile(s, tileOf(e.x), tileOf(e.y), e.o); e.x = e.px = f[0] * TILE + 16; e.y = e.py = f[1] * TILE + 16; e.path = null;
  }
}
function cmdBuild(s, o, us, type, tx, ty) {
  const p = s.players[o], st = BT[type];
  if (!st || p.age < st.age) return null;
  us = us.filter(u => u.t === 'koylu'); if (!us.length) return null;
  if (!canPlace(s, o, type, tx, ty) || !afford(p, st.cost)) return null;
  pay(p, st.cost);
  const b = addBld(s, o, type, tx, ty, false);
  if (!st.walk) pushOut(s);
  for (const u of us) { resetU(u); u.st = 'build'; u.bt = b.id; }
  return b;
}
function cmdWall(s, o, us, type, x0, y0, x1, y1) {
  const p = s.players[o], st = BT[type];
  if (!st || !st.wall || p.age < st.age) return;
  us = us.filter(u => u.t === 'koylu'); if (!us.length) return;
  let first = null;
  for (const [x, y] of wallLine(x0, y0, x1, y1)) {
    if (!canPlace(s, o, type, x, y)) continue;
    if (!afford(p, st.cost)) break;
    pay(p, st.cost); const b = addBld(s, o, type, x, y, false); if (!first) first = b;
  }
  if (!first) return;
  pushOut(s);
  for (const u of us) { resetU(u); u.st = 'build'; u.bt = first.id; }
}
function cmdHelp(s, o, us, b) {
  for (const u of us) {
    if (u.t !== 'koylu') continue;
    if (b.built && b.t === 'ciftlik') { cmdGather(s, o, [u], b); continue; }
    if (!b.built || b.hp < b.maxhp) { resetU(u); u.st = 'build'; u.bt = b.id; }
  }
}
function canTrain(s, p, b, ut) {
  if (!b || b.dead || b.o !== p.slot || !b.built) return false;
  const tr = BT[b.t].trains; if (!tr) return false;
  if (tr.indexOf(ut) < 0 && !(tr.indexOf('UU') >= 0 && ut === CIVS[p.civ].uu)) return false;
  return p.age >= UT[ut].age;
}
function cmdTrain(s, o, b, ut, n) {
  const p = s.players[o];
  for (let k = 0; k < (n || 1); k++) {
    if (!canTrain(s, p, b, ut) || b.q.length >= 5) return;
    const st = uStat(p, ut); if (!afford(p, st.cost)) return;
    pay(p, st.cost); b.q.push({ k: 'u', id: ut, left: st.t * TPS, tot: st.t * TPS, cost: st.cost });
  }
}
function canResearch(s, p, b, tid) {
  if (!b || b.dead || b.o !== p.slot || !b.built) return false;
  const T = TECH[tid]; const tl = BT[b.t].techs;
  if (!T || !tl || (tl.indexOf(tid) < 0 && !(tl.indexOf('OZ') >= 0 && tid === 'oz_' + p.civ)) || p.tech[tid] || p.researching[tid]) return false;
  if (tid === 'cag2' && p.age !== 1) return false;
  if (tid === 'cag3' && p.age !== 2) return false;
  if (tid !== 'cag2' && tid !== 'cag3' && p.age < T.age) return false;
  if (T.req && !p.tech[T.req]) return false;
  return true;
}
function cmdResearch(s, o, b, tid) {
  const p = s.players[o];
  if (!canResearch(s, p, b, tid) || b.q.length >= 5 || !ageReqMet(s, p, tid) || !afford(p, TECH[tid].cost)) return;
  pay(p, TECH[tid].cost); p.researching[tid] = 1;
  b.q.push({ k: 't', id: tid, left: TECH[tid].t * TPS, tot: TECH[tid].t * TPS, cost: TECH[tid].cost });
}
function applyTech(s, p, tid) {
  delete p.researching[tid];
  const age = tid === 'cag2' || tid === 'cag3';
  if (tid === 'cag2') p.age = 2; else if (tid === 'cag3') p.age = 3; else p.tech[tid] = 1;
  p.uc = {}; p.bc = {};
  for (const e of s.ents) if (e.o === p.slot && !e.dead && e.k !== 'r') {
    const mh = e.k === 'u' ? uStat(p, e.t).hp : bStat(p, e.t).hp;
    if (mh !== e.maxhp) { e.hp = Math.max(1, e.hp + (mh - e.maxhp) * (e.k === 'b' && !e.built ? 0 : 1)); e.maxhp = mh; }
  }
  s.ev.push({ o: p.slot, m: age ? p.name + ' → ' + TECH[tid].n + '!' : TECH[tid].n + ' tamamlandı', all: age ? 1 : 0, age: age ? 1 : 0 });
}
function ringBell(s, o, on) {
  const p = s.players[o];
  if (on) {
    p.bell = true;
    const res = {};
    for (const u of s.ents) {
      if (u.k !== 'u' || u.dead || u.gar || u.o !== o || u.t !== 'koylu') continue;
      let best = null, bd = (TILE * 30) * (TILE * 30);
      for (const b of s.ents) {
        if (b.k !== 'b' || b.dead || !canEnter(u, b)) continue;
        if (garCap(s, b) - (res[b.id] || 0) <= 0) continue;
        const dx = b.x - u.x, dy = b.y - u.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; }
      }
      if (!best) continue;
      res[best.id] = (res[best.id] || 0) + 1;
      const pgt = u.st === 'gather' || u.st === 'return' ? u.gt : 0, pgk = u.gk;
      resetU(u); u.st = 'garrison'; u.tgt = best.id; u.pgt = pgt; u.pgk = pgk; u.bellGo = true;
    }
  } else {
    p.bell = false;
    for (const b of s.ents) if (b.k === 'b' && b.o === o && !b.dead && b.gl.length) ejectAll(s, b, true);
    for (const u of s.ents) if (u.k === 'u' && u.o === o && u.st === 'garrison' && u.bellGo) { u.st = u.pgt ? 'gather' : 'idle'; u.gt = u.pgt || 0; u.gk = u.pgk || u.gk; u.bellGo = false; }
  }
}

function applyCmd(s, o, c) {
  if (!Array.isArray(c)) return;
  const p = s.players[o]; if (!p) return;
  const op = c[0];
  if (!p.alive && op !== 'ch' && op !== 'qm') return;
  if (op === 'mv') { const us = ownUnits(s, o, c[1]); if (us.length) cmdMove(s, o, us, +c[2] || 0, +c[3] || 0); }
  else if (op === 'at') { const t = s.byId.get(c[2]); if (t && !t.dead) cmdAttack(s, o, ownUnits(s, o, c[1]), t); }
  else if (op === 'ga') { const t = s.byId.get(c[2]); if (t && !t.dead) cmdGather(s, o, ownUnits(s, o, c[1]), t); }
  else if (op === 'bd') { if (BT[c[2]] && !BT[c[2]].wall) cmdBuild(s, o, ownUnits(s, o, c[1]), c[2], c[3] | 0, c[4] | 0); }
  else if (op === 'wl') { if (BT[c[2]]) cmdWall(s, o, ownUnits(s, o, c[1]), c[2], c[3] | 0, c[4] | 0, c[5] | 0, c[6] | 0); }
  else if (op === 'hb') { const b = s.byId.get(c[2]); if (b && !b.dead && b.k === 'b' && b.o === o) cmdHelp(s, o, ownUnits(s, o, c[1]), b); }
  else if (op === 'gr') { const b = s.byId.get(c[2]); if (b && !b.dead && b.k === 'b' && b.o === o) cmdGarrison(s, o, ownUnits(s, o, c[1]), b); }
  else if (op === 'ug') { const b = s.byId.get(c[1]); if (b && !b.dead && b.k === 'b' && b.o === o) ejectAll(s, b, false); }
  else if (op === 'bell') { ringBell(s, o, !!c[1]); }
  else if (op === 'sn') { const v = c[2] | 0; if (v >= 0 && v <= 2) for (const u of ownUnits(s, o, c[1])) { if (u.t === 'koylu') continue; u.sn = v; u.gx = u.x; u.gy = u.y; if (v === 2 && u.st === 'move') { resetU(u); u.st = 'idle'; } } }
  else if (op === 'tr') { const b = s.byId.get(c[1]); if (UT[c[2]]) cmdTrain(s, o, b, c[2], Math.min(5, c[3] | 0 || 1)); }
  else if (op === 'rs') { const b = s.byId.get(c[1]); cmdResearch(s, o, b, c[2]); }
  else if (op === 'cq') {
    const b = s.byId.get(c[1]); if (!b || b.o !== o || b.k !== 'b') return;
    const i = c[2] | 0, it = b.q[i]; if (!it) return;
    b.q.splice(i, 1); refund(p, it.cost); if (it.k === 't') delete p.researching[it.id];
  }
  else if (op === 'ry') { const b = s.byId.get(c[1]); if (b && b.o === o && b.k === 'b') b.rally = { x: +c[2] || 0, y: +c[3] || 0, r: c[4] | 0 }; }
  else if (op === 'st') { for (const u of ownUnits(s, o, c[1])) { resetU(u); u.st = 'idle'; u.gx = u.x; u.gy = u.y; } }
  else if (op === 'dl') { for (const id of (c[1] || [])) { const e = s.byId.get(id); if (e && !e.dead && e.o === o && e.k !== 'r' && !e.gar) kill(s, e); } }
  else if (op === 'gg') { for (const e of s.ents) if (e.o === o && !e.dead) kill(s, e); }
  else if (op === 'ai') { if (!p.ai) { p.ai = newAI(1); p.ai.next = s.tick + 600; } }
  else if (op === 'ch') { // chat (text travels in the lockstep so everyone sees it in the same order)
    const txt = String(c[1] || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 80).trim();
    if (txt) s.ev.push({ chat: { from: o, text: txt, team: c[2] ? 1 : 0 } });
  }
  else if (op === 'qm') { if (QUICK[c[1]]) quickMsg(s, o, c[1]); }
  else if (op === 'pg') { s.ev.push({ ping: { from: o, x: +c[1] || 0, y: +c[2] || 0 } }); }
  else if (op === 'tb') { tribute(s, o, c[1] | 0, c[2], c[3] | 0); }
}

// ---------------- diplomacy: quick messages and tribute ----------------
const QUICK = { atk: '⚔️ Saldıralım!', help: '🆘 Yardım edin!', def: '🛡️ Savunmaya geçin!', res: '💰 Kaynak lazım!', ok: '👍 Tamam', no: '👎 Hayır', gg: '🤝 İyi oyundu' };
function isAlly(s, a, b) { return a !== b && a >= 0 && b >= 0 && s.players[a].team !== 0 && s.players[a].team === s.players[b].team; }
function tribute(s, o, to, k, amt) {
  const p = s.players[o], q = s.players[to];
  if (!q || !q.alive || !isAlly(s, o, to) || RT.indexOf(k) < 0 || !(amt > 0) || amt > 100000) return false;
  amt = Math.min(amt, Math.floor(p.res[k])); if (amt <= 0) return false;
  p.res[k] -= amt; q.res[k] += amt;
  s.ev.push({ o: to, m: p.name + ' sana ' + amt + ' ' + RES_INFO[k].n.toLowerCase() + ' gönderdi ' + RES_INFO[k].i });
  s.ev.push({ o, m: q.name + ' oyuncusuna ' + amt + ' ' + RES_INFO[k].n.toLowerCase() + ' gönderildi' });
  return true;
}
function quickMsg(s, o, id) {
  s.ev.push({ chat: { from: o, text: QUICK[id], team: s.players[o].team !== 0 ? 1 : 0, q: id } });
  // computer allies react to their team-mates' calls
  for (const q of s.players) {
    if (!q.ai || !q.alive || !isAlly(s, o, q.slot)) continue;
    const A = q.ai;
    if (id === 'help' || id === 'def') { A.helpTo = o; A.helpT = s.tick + 900; s.ev.push({ chat: { from: q.slot, text: '🛡️ Yardıma geliyorum!', team: 1 } }); }
    else if (id === 'atk') { A.next = Math.min(A.next, s.tick); A.joinT = s.tick + 1200; s.ev.push({ chat: { from: q.slot, text: '⚔️ Ordum hazırlanıyor, saldırıyoruz!', team: 1 } }); }
    else if (id === 'res') {
      let k = 'f'; for (const r of RT) if (q.res[r] > q.res[k]) k = r;
      if (q.res[k] > 500 && tribute(s, q.slot, o, k, 200)) s.ev.push({ chat: { from: q.slot, text: '💰 200 ' + RES_INFO[k].n.toLowerCase() + ' gönderdim.', team: 1 } });
      else s.ev.push({ chat: { from: q.slot, text: '😕 Şu an ayıracak kaynağım yok.', team: 1 } });
    }
  }
}

// ---------------- save / load ----------------
const TA_KEYS = ['blk', 'occ', 'gate', 'ground', 'terr', 'hgt'];
function serializeSim(s) {
  const ents = [];
  for (const e of s.ents) { if (e.dead) continue; const o = {}; for (const k in e) { if (k[0] === '_') continue; o[k] = k === 'path' ? null : e[k]; } ents.push(o); }
  const out = { v: 1, W: s.W, H: s.H, tick: s.tick, nextId: s.nextId, seed: s.seed, map: s.map, size: s.size, startRes: s.startRes, popMax: s.popMax, rs: s.rs, over: s.over, winner: s.winner, winTeam: s.winTeam, starts: s.starts, mon: s.mon, camps: s.camps,
    players: s.players.map(p => Object.assign({}, p, { uc: {}, bc: {} })), ents };
  for (const k of TA_KEYS) out[k] = Array.from(s[k]);
  return out;
}
function deserializeSim(d) {
  const W = d.W, H = d.H;
  const s = { W, H, tick: d.tick, nextId: d.nextId, seed: d.seed, map: d.map, size: d.size, startRes: d.startRes, popMax: d.popMax || 150, rs: d.rs, over: d.over, winner: d.winner, winTeam: d.winTeam, starts: d.starts, mon: d.mon || 'yok', camps: d.camps || [],
    ents: d.ents, byId: new Map(), players: d.players, fx: [], ev: [], pathBudget: 0, bw: Math.ceil(W / 4), bh: Math.ceil(H / 4), bk: [] };
  s.blk = new Int32Array(d.blk); s.occ = new Int32Array(d.occ); s.gate = new Int32Array(d.gate);
  s.ground = new Uint8Array(d.ground); s.terr = new Uint8Array(d.terr); s.hgt = new Uint8Array(d.hgt);
  for (let i = 0; i < s.bw * s.bh; i++) s.bk.push([]);
  for (const e of s.ents) s.byId.set(e.id, e);
  for (const p of s.players) { p.uc = {}; p.bc = {}; }
  s.rng = makeRng(s);
  rebuildBuckets(s); s.pcache = new Map();
  return s;
}

// ---------------- per-tick updates ----------------
function nearestDrop(s, o, k, x, y) {
  let best = null, bd = 1e9;
  for (const e of s.blds) if (e.o === o && e.built && !e.dead) { const d = BT[e.t].drop; if (d && d.indexOf(k) >= 0) { const dd = rectDist(x, y, e); if (dd < bd) { bd = dd; best = e; } } }
  return best;
}
function exposed(s, e) { // a tree deep inside a forest cannot be reached
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const x = e.tx + dx, y = e.ty + dy; if (x >= 0 && y >= 0 && x < s.W && y < s.H && !s.blk[y * s.W + x]) return true; }
  return false;
}
function nearestRes(s, kind, x, y, maxD, filter) {
  let best = null, bd = maxD * maxD;
  for (const e of s.resl) if (!e.dead && RESK[e.t] === kind && !(e.t === 'boar' && e.live) && (!filter || filter(e)) && (kind !== 'w' || exposed(s, e)) && !nearCamp(s, e.x, e.y)) { const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } }
  return best;
}
function freeFarm(s, o, x, y, except) {
  let best = null, bd = 1e12;
  for (const e of s.blds) if (e.t === 'ciftlik' && e.o === o && e.built && !e.dead && e.id !== except) {
    const f = e.farmer && s.byId.get(e.farmer);
    if (f && !f.dead && f.gt === e.id && (f.st === 'gather' || f.st === 'return')) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// enemy structure next to a unit that blocks its way (walls, gates, buildings)
function findBlocker(s, u) {
  let best = null, bd = TILE * 2.5;
  const tx = tileOf(u.x), ty = tileOf(u.y);
  for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) continue;
    const id = s.occ[y * s.W + x]; if (!id) continue;
    const e = s.byId.get(id); if (!e || e.dead || e.k !== 'b' || !isEnemy(s, u.o, e.o)) continue;
    const d = rectDist(u.x, u.y, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nextFoundation(s, u, near) {
  let best = null, bd = TILE * 6;
  for (const e of s.blds) if (e.o === u.o && !e.built && !e.dead) { const d = rectDist(near.x, near.y, e); if (d < bd) { bd = d; best = e; } }
  return best;
}

function updUnit(s, u) {
  u.px = u.x; u.py = u.y;
  if (u.cd > 0) u.cd--;
  const p = s.players[u.o], st = uStat(p, u.t);
  // unstick
  if (blocked(s, u.x, u.y, u.o)) { const f = nearestFreeTile(s, tileOf(u.x), tileOf(u.y), u.o); u.x = u.px = f[0] * TILE + 16; u.y = u.py = f[1] * TILE + 16; u.path = null; }
  switch (u.st) {
    case 'idle': {
      if (st.cls !== 'vil' && (s.tick + u.id) % 5 === 0) {
        const rad = u.sn === 2 ? (st.rng > 0 ? st.rng * TILE : TILE) : st.los * TILE;
        const e = findEnemy(s, u.o, u.x, u.y, rad, st.onlyBld);
        if (e && canAttack(s, u, e) && !(u.sn === 2 && edgeDist(u, e) > (st.rng > 0 ? st.rng * TILE : 6))) {
          if (u.sn === 1 && Math.abs(u.x - u.gx) + Math.abs(u.y - u.gy) > TILE * 2) { u.gx = u.x; u.gy = u.y; }
          u.st = 'attack'; u.tgt = e.id; u.path = null; u.forced = false;
        } else if (u.sn === 1 && Math.abs(u.x - u.gx) + Math.abs(u.y - u.gy) > TILE * 1.5) {
          u.st = 'move'; u.dest = { x: u.gx, y: u.gy }; u.path = null; u.ret = true;
        }
      } else if (st.cls === 'vil' && u.bt === 0 && (s.tick + u.id) % 20 === 0 && !p.ai) {
        for (const e of s.ents) if (e.k === 'b' && e.o === u.o && !e.built && !e.dead && rectDist(u.x, u.y, e) < TILE * 3) { u.st = 'build'; u.bt = e.id; break; }
      }
      break;
    }
    case 'move': {
      if (!u.path && !goTo(s, u, tileOf(u.dest.x), tileOf(u.dest.y), null)) break;
      const mdx = u.dest.x - u.x, mdy = u.dest.y - u.y, md = mdx * mdx + mdy * mdy;
      if (u.best == null || u.apT !== -1) { u.apT = -1; u.best = md; u.np = 0; u.reps = 0; }
      else if (md < u.best - 4) { u.best = md; u.np = 0; }
      else if (++u.np > 15) { // no progress (crowd at the destination or blocked)
        u.np = 0; u.best = md;
        if (md < TILE * TILE * 9 || ++u.reps > 3) { u.st = 'idle'; u.path = null; u.ms = 0; if (!u.ret) { u.gx = u.x; u.gy = u.y; } u.ret = false; break; }
        u.path = null;
      }
      if (u.path && followPath(s, u, u.dest)) {
        u.st = 'idle'; u.path = null; u.ms = 0;
        if (!u.ret) { u.gx = u.x; u.gy = u.y; } u.ret = false;
      }
      break;
    }
    case 'attack': {
      const t = s.byId.get(u.tgt);
      if (!t || t.dead || !canAttack(s, u, t)) { u.st = 'idle'; u.path = null; u.tgt = 0; u.forced = false; break; }
      const range = st.rng > 0 ? st.rng * TILE : 5;
      if (!u.forced && u.sn === 2 && edgeDist(u, t) > range) { u.st = 'idle'; u.tgt = 0; u.path = null; break; }
      if (!u.forced && u.sn === 1) { const dx = u.x - u.gx, dy = u.y - u.gy; if (dx * dx + dy * dy > TILE * TILE * 49) { u.st = 'move'; u.dest = { x: u.gx, y: u.gy }; u.path = null; u.ret = true; u.tgt = 0; break; } }
      const r = approach(s, u, t, range);
      if (r === true) {
        if (t.x > u.x + 1) u.face = 1; else if (t.x < u.x - 1) u.face = -1;
        if (u.cd <= 0) {
          u.cd = Math.floor(st.rof * TPS); u.atkT = s.tick;
          if (st.rng > 0) s.fx.push({ k: u.t === 'mancinik' ? 'rock' : 'arrow', x: u.x, y: u.y, tx: t.x, ty: t.y });
          damage(s, u.o, st, t, u);
        }
      } else if (u.path && !u.path.ok && u.pi >= u.path.length) {
        // target unreachable (walls in the way): attack whatever blocks us
        const w = findBlocker(s, u); if (w && w.id !== t.id) { u.tgt = w.id; u.path = null; }
      }
      break;
    }
    case 'garrison': {
      const b = s.byId.get(u.tgt);
      if (!canEnter(u, b) || garCap(s, b) <= 0) { u.st = u.pgt ? 'gather' : 'idle'; u.gt = u.pgt || u.gt; u.tgt = 0; u.path = null; u.bellGo = false; break; }
      if (approach(s, u, b, 8) === true) {
        u.gar = b.id; b.gl.push(u.id); u.st = 'in'; u.path = null; u.bellIn = !!u.bellGo; u.bellGo = false; u.x = u.px = b.x; u.y = u.py = b.y;
      }
      break;
    }
    case 'gather': {
      let r = s.byId.get(u.gt);
      const farmOk = r && !r.dead && r.k === 'b' && r.t === 'ciftlik' && r.built && r.o === u.o;
      if (!r || r.dead || (r.k === 'b' && !farmOk)) {
        let n = null;
        if (u.gk === 'f') n = nearestRes(s, 'f', u.x, u.y, TILE * 9) || freeFarm(s, u.o, u.x, u.y, 0);
        else if (u.gk) n = nearestRes(s, u.gk, u.x, u.y, TILE * 12);
        if (n && n.k === 'b' && TILE * 12 < rectDist(u.x, u.y, n)) n = null;
        if (n) { u.gt = n.id; u.path = null; } else { u.gt = 0; u.st = u.carry > 0 ? 'return' : 'idle'; u.path = null; }
        break;
      }
      if (r.k === 'b') { // farm occupancy
        const f = r.farmer && r.farmer !== u.id ? s.byId.get(r.farmer) : null;
        if (f && !f.dead && f.gt === r.id && (f.st === 'gather' || f.st === 'return')) { const n = freeFarm(s, u.o, u.x, u.y, r.id); if (n) { u.gt = n.id; u.path = null; } else { u.st = 'idle'; } break; }
        r.farmer = u.id;
      }
      if (r.mob && r.live) { // hunting: throw spears from a distance
        const ha = approach(s, u, r, TILE * 2.5);
        if (ha === true) {
          if (r.x > u.x + 1) u.face = 1; else if (r.x < u.x - 1) u.face = -1;
          if (u.cd <= 0) { u.cd = 18; u.atkT = s.tick; s.fx.push({ k: 'arrow', x: u.x, y: u.y, tx: r.x, ty: r.y }); hurtAnimal(s, r, u, 6); }
        }
        break;
      }
      const a = approach(s, u, r, 5);
      if (a === 'stuck') {
        const n = r.k === 'r' ? nearestRes(s, u.gk, u.x, u.y, TILE * 12, (e) => e.id !== r.id && (e.id + s.tick) % 3 !== 0) : null;
        if (n) { u.gt = n.id; u.path = null; } else { u.st = 'idle'; }
        break;
      }
      if (a !== true) break;
      if (r.x > u.x + 1) u.face = 1; else if (r.x < u.x - 1) u.face = -1;
      const k = r.k === 'b' ? 'f' : RESK[r.t];
      if (u.ck !== k) { u.carry = 0; u.ck = k; }
      u.acc += gatherRate(p, k, r.k === 'b', !!r.mob); u.work = s.tick;
      while (u.acc >= 1) {
        u.acc -= 1; u.carry++;
        if (r.k === 'r') { r.amt--; if (r.amt <= 0) { kill(s, r); break; } }
      }
      if (u.carry >= carryCap(p)) { u.st = 'return'; u.path = null; u.drop = 0; }
      break;
    }
    case 'return': {
      let d = s.byId.get(u.drop);
      if (!d || d.dead || !d.built || d.o !== u.o) { d = nearestDrop(s, u.o, u.ck, u.x, u.y); if (!d) { u.st = 'idle'; break; } u.drop = d.id; u.path = null; }
      const a = approach(s, u, d, 5);
      if (a === true) {
        p.res[u.ck] += u.carry; p.stats.gathered += u.carry; u.carry = 0; u.path = null;
        u.st = u.gt || u.gk ? 'gather' : 'idle';
      }
      break;
    }
    case 'build': {
      const b = s.byId.get(u.bt);
      if (!b || b.dead || b.o !== u.o) { u.st = 'idle'; u.bt = 0; u.path = null; break; }
      if (b.built && b.hp >= b.maxhp) {
        u.bt = 0; u.path = null;
        const nf = nextFoundation(s, u, b);
        if (b.t === 'ciftlik' && (!b.farmer || b.farmer === u.id || !s.byId.get(b.farmer) || s.byId.get(b.farmer).gt !== b.id)) { b.farmer = u.id; u.st = 'gather'; u.gt = b.id; u.gk = 'f'; }
        else if (nf) { u.bt = nf.id; }
        else if (BT[b.t].drop && b.t !== 'tc') {
          const k = b.t === 'degirmen' ? 'f' : (u.gk && u.gk !== 'f' ? u.gk : 'w');
          const n = nearestRes(s, k, b.x, b.y, TILE * 8);
          if (n) { u.st = 'gather'; u.gt = n.id; u.gk = k; } else u.st = 'idle';
        } else u.st = 'idle';
        break;
      }
      const a = approach(s, u, b, 5);
      if (a !== true) break;
      u.work = s.tick;
      const bs = bStat(s.players[b.o], b.t), total = bs.t * TPS;
      if (!b.built) {
        b.prog++; b.hp = Math.min(b.maxhp, b.hp + b.maxhp / total);
        if (b.prog >= total) {
          b.built = true; b.hp = Math.max(1, b.hp); recalcPop(s, p);
          if (b.t === 'kapi') { const i = b.ty * s.W + b.tx; if (s.blk[i] === b.id) s.blk[i] = 0; s.gate[i] = b.o + 1; }
          s.fx.push({ k: 'done', o: b.o, x: b.x, y: b.y });
          if (b.t !== 'ciftlik' && b.t !== 'ev' && !BT[b.t].wall) s.ev.push({ o: b.o, m: bs.n + ' tamamlandı' });
        }
      } else { // repair
        if (p.res.w >= 1 && s.tick % 4 === 0) { b.hp = Math.min(b.maxhp, b.hp + b.maxhp / total * 2); if (s.tick % 20 === 0) p.res.w -= 1; }
      }
      break;
    }
  }
}

function spawnSpot(s, b, rx, ry) {
  let best = null, bd = 1e12;
  for (let ring = 1; ring <= 4 && !best; ring++) {
    for (let y = b.ty - ring; y < b.ty + b.sz + ring; y++) for (let x = b.tx - ring; x < b.tx + b.sz + ring; x++) {
      if (x >= b.tx - ring + 1 && x < b.tx + b.sz + ring - 1 && y >= b.ty - ring + 1 && y < b.ty + b.sz + ring - 1) continue;
      if (x < 0 || y < 0 || x >= s.W || y >= s.H || tileBlockedFor(s, y * s.W + x, b.o)) continue;
      const dx = x * TILE + 16 - rx, dy = y * TILE + 16 - ry, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = [x, y]; }
    }
  }
  return best;
}
function updBld(s, b) {
  if (!b.built) return;
  const p = s.players[b.o], st = bStat(p, b.t);
  if (b.gl.length && s.tick % 10 === 0) for (const id of b.gl) { const u = s.byId.get(id); if (u && u.hp < u.maxhp) u.hp = Math.min(u.maxhp, u.hp + 1); }
  if (st.atk) {
    if (b.cd > 0) b.cd--;
    else {
      const e = findEnemy(s, b.o, b.x, b.y, st.rng * TILE + b.sz * 16, false);
      if (e && e.k === 'u') {
        b.cd = st.rof * TPS; const extra = Math.min(b.gl.length, 10);
        s.fx.push({ k: 'arrow', x: b.x, y: b.y - 20, tx: e.x, ty: e.y });
        if (extra >= 3) s.fx.push({ k: 'arrow', x: b.x - 12, y: b.y - 16, tx: e.x + 6, ty: e.y });
        damage(s, b.o, st, e, null, extra, b);
      }
      else b.cd = 5;
    }
  }
  if (!b.q.length) return;
  const it = b.q[0];
  if (it.k === 'u' && p.pop >= p.popCap) { b.wait = 1; return; }
  b.wait = 0;
  if (--it.left > 0) return;
  b.q.shift();
  if (it.k === 't') { applyTech(s, p, it.id); return; }
  const rx = b.rally ? b.rally.x : b.x, ry = b.rally ? b.rally.y : b.y + b.sz * TILE;
  const sp = spawnSpot(s, b, rx, ry); if (!sp) { b.q.unshift(it); it.left = 10; return; }
  const u = addUnit(s, b.o, it.id, sp[0] * TILE + 16, sp[1] * TILE + 16);
  s.fx.push({ k: 'train', o: b.o, x: u.x, y: u.y });
  if (b.rally) {
    const rt = b.rally.r && s.byId.get(b.rally.r);
    if (rt && !rt.dead && u.t === 'koylu' && (rt.k === 'r' || (rt.t === 'ciftlik' && rt.o === b.o))) cmdGather(s, b.o, [u], rt);
    else cmdMove(s, b.o, [u], b.rally.x, b.rally.y);
  }
}

// ---------------- wild monsters ----------------
const MON_N = { yok: 0, az: 1, cok: 2 };
const CAMP_LOOT = { ork: { g: 250, s: 50 }, balcik: { f: 200, w: 100 } };
const CAMP_NAME = { ork: 'Ork kampı', balcik: 'Balçık gölü' };
const LEASH = TILE * 8;
function addMonster(s, type, tx, ty, cp) {
  if (tx < 1 || ty < 1 || tx >= s.W - 1 || ty >= s.H - 1) return null;
  if (s.blk[ty * s.W + tx]) { const f = nearestFreeTile(s, tx, ty, GAIA); tx = f[0]; ty = f[1]; }
  const st = UT[type], x = tx * TILE + 16, y = ty * TILE + 16;
  const e = addEnt(s, { k: 'u', t: type, o: GAIA, x, y, px: x, py: y, r: st.r, hp: st.hp, maxhp: st.hp, st: 'idle', tgt: 0,
    path: null, pi: 0, pathT: 0, cd: 0, face: (tx + ty) % 2 ? 1 : -1, hx: x, hy: y, cp, ret: false, wt: 0, wx: null, wy: null, sn: 0, gar: 0, ms: 0, stuck: 0 });
  s.camps[cp].m.push(e.id); return e;
}
function nearCamp(s, x, y) {
  if (!s.camps) return false;
  for (const c of s.camps) if (!c.done && Math.abs(x - c.x) < TILE * 6 && Math.abs(y - c.y) < TILE * 6) return true;
  return false;
}
function campAggro(s, m, attacker) {
  const c = s.camps[m.cp]; if (!c) return;
  if (!m.tgt) m.tgt = attacker.id;
  for (const id of c.m) { const o = s.byId.get(id); if (o && !o.dead && !o.tgt && !o.ret) o.tgt = attacker.id; }
}
function monsterDied(s, e) {
  e.dead = true; s.anyDead = true;
  s.fx.push({ k: 'die', x: e.x, y: e.y, c: '#5d8a34', t: e.t, f: e.face, r: e.r, o: GAIA });
  const st = UT[e.t], kb = e.kb == null ? -1 : e.kb, p = kb >= 0 ? s.players[kb] : null;
  if (p && st.bnt) { let txt = ''; for (const k in st.bnt) { p.res[k] += st.bnt[k]; txt += '+' + st.bnt[k] + RICON[k] + ' '; } s.fx.push({ k: 'loot', x: e.x, y: e.y - 10, s: txt.trim(), o: kb }); }
  const c = s.camps[e.cp];
  if (st.split) {
    for (let k = 0; k < 2; k++) {
      const m = addMonster(s, st.split, tileOf(e.x), tileOf(e.y), e.cp);
      if (m) { m.x = m.px = e.x + (k ? 7 : -7); m.y = m.py = e.y + (k ? 3 : -3); m.hx = c ? c.x : e.x; m.hy = c ? c.y : e.y; m.tgt = e.tgt; m.cd = 8; }
    }
  }
  if (c && !c.done && c.m.every(id => { const o = s.byId.get(id); return !o || o.dead; })) {
    c.done = true;
    if (p) {
      const loot = CAMP_LOOT[c.t]; let txt = '';
      for (const k in loot) { p.res[k] += loot[k]; txt += '+' + loot[k] + ' ' + RNAME[k] + ', '; }
      s.ev.push({ o: kb, m: CAMP_NAME[c.t] + ' temizlendi! Hazine: ' + txt.replace(/, $/, ''), x: c.x, y: c.y });
      s.fx.push({ k: 'loot', x: c.x, y: c.y - 20, s: '💰 Hazine!', o: kb, big: 1 });
    }
  }
}
function updMonster(s, m) {
  m.px = m.x; m.py = m.y;
  if (m.cd > 0) m.cd--;
  const st = monStat(m.t);
  if (blocked(s, m.x, m.y, GAIA)) { const f = nearestFreeTile(s, tileOf(m.x), tileOf(m.y), GAIA); m.x = m.px = f[0] * TILE + 16; m.y = m.py = f[1] * TILE + 16; m.path = null; }
  const hdx = m.x - m.hx, hdy = m.y - m.hy, hd2 = hdx * hdx + hdy * hdy;
  let t = m.tgt ? s.byId.get(m.tgt) : null;
  if (t && (t.dead || t.gar || t.k !== 'u' || t.o < 0)) { t = null; m.tgt = 0; }
  if (t) { const dx = t.x - m.hx, dy = t.y - m.hy; if (dx * dx + dy * dy > LEASH * LEASH * 1.4 || hd2 > LEASH * LEASH) { t = null; m.tgt = 0; m.ret = true; m.path = null; } }
  if (!t && !m.ret && (s.tick + m.id) % 5 === 0) {
    const rad = st.los * TILE; let bd = rad * rad + 1;
    nearUnits(s, m.x, m.y, rad, (e) => {
      if (e.dead || e.o < 0 || e.gar) return;
      const dx = e.x - m.x, dy = e.y - m.y, d = dx * dx + dy * dy; if (d >= bd) return;
      const ex = e.x - m.hx, ey = e.y - m.hy; if (ex * ex + ey * ey > LEASH * LEASH) return;
      bd = d; t = e;
    });
    if (t) campAggro(s, m, t);
  }
  if (t) {
    m.st = 'attack';
    const r = approach(s, m, t, 5);
    if (r === true) {
      if (t.x > m.x + 1) m.face = 1; else if (t.x < m.x - 1) m.face = -1;
      if (m.cd <= 0) { m.cd = Math.floor(st.rof * TPS); m.atkT = s.tick; damage(s, GAIA, st, t, m); }
    } else if (r === 'stuck') { m.tgt = 0; m.ret = true; m.path = null; }
    return;
  }
  if (m.ret || hd2 > TILE * TILE * 9) {
    m.st = 'move'; m.ret = true;
    if (!m.path && !goTo(s, m, tileOf(m.hx), tileOf(m.hy), null)) return;
    if (m.path && followPath(s, m, { x: m.hx, y: m.hy })) { m.path = null; m.ret = false; m.st = 'idle'; }
    else if (hd2 < TILE * TILE * 2) { m.path = null; m.ret = false; m.st = 'idle'; }
    return;
  }
  m.st = 'idle';
  if (m.hp < m.maxhp && s.tick % 10 === 0) m.hp = Math.min(m.maxhp, m.hp + Math.max(1, Math.floor(m.maxhp / 60)));
  if (--m.wt <= 0) { m.wt = 60 + ((s.rng() * 160) | 0); m.wx = m.hx + (s.rng() - 0.5) * TILE * 3; m.wy = m.hy + (s.rng() - 0.5) * TILE * 3; }
  if (m.wx != null) { m.st = 'move'; if (steer(s, m, m.wx, m.wy, st.spx * 0.4)) { m.wx = null; m.st = 'idle'; } }
}

// ---------------- animals ----------------
function hurtAnimal(s, a, hunter, dmg) {
  a.hp -= dmg;
  if (a.hp <= 0) { a.live = false; a.hp = 0; a.wx = null; a.tgt = 0; s.fx.push({ k: 'adie', x: a.x, y: a.y, t: a.t }); return; }
  if (a.t === 'boar') a.tgt = hunter.id;
  else { const dx = a.x - hunter.x, dy = a.y - hunter.y, d = Math.sqrt(dx * dx + dy * dy) || 1; a.fx = dx / d; a.fy = dy / d; a.fl = 12; }
}
function updAnimal(s, a) {
  a.px = a.x; a.py = a.y;
  if (!a.live) return;
  if (blocked(s, a.x, a.y, -1)) { const f = nearestFreeTile(s, tileOf(a.x), tileOf(a.y)); a.x = a.px = f[0] * TILE + 16; a.y = a.py = f[1] * TILE + 16; }
  if (a.cd > 0) a.cd--;
  if (a.tgt) { // angry boar
    const v = s.byId.get(a.tgt);
    if (!v || v.dead || v.gar) a.tgt = 0;
    else {
      const dx = v.x - a.x, dy = v.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > TILE * 12) a.tgt = 0;
      else if (d > v.r + a.r + 2) steer(s, a, v.x, v.y, 1.2 * TILE / TPS);
      else if (a.cd <= 0) {
        a.cd = 15; v.hp -= 4; s.fx.push({ k: 'hit', x: v.x, y: v.y, b: 0 });
        const tp = s.players[v.o]; if (tp && s.tick - tp.lastAlert > 150) { tp.lastAlert = s.tick; s.ev.push({ o: v.o, m: 'Yaban domuzu saldırıyor!', x: v.x, y: v.y, alert: 1 }); }
        if (v.hp <= 0) { kill(s, v); a.tgt = 0; }
      }
    }
  } else if (a.fl > 0) { a.fl--; steer(s, a, a.x + a.fx * 20, a.y + a.fy * 20, 1.7 * TILE / TPS); }
  else {
    if (--a.wt <= 0) { a.wt = 50 + ((s.rng() * 140) | 0); a.wx = a.hx + (s.rng() - 0.5) * TILE * 4; a.wy = a.hy + (s.rng() - 0.5) * TILE * 4; }
    if (a.wx != null && steer(s, a, a.wx, a.wy, 0.3 * TILE / TPS)) a.wx = null;
  }
  a.tx = Math.floor(a.x / TILE); a.ty = Math.floor(a.y / TILE);
}
// how easily a unit gets pushed aside: idle units make way, workers and fighters hold their spot
function mob(s, u) { if (u.work === s.tick) return 0.2; if (u.atkT && s.tick - u.atkT < 12) return 0.3; if (u.st === 'move' || u.path) return 0.5; return 1; }
function separate(s) {
  const R = TILE * 4;
  for (const u of s.ents) {
    if (u.k !== 'u' || u.dead || u.gar) continue;
    const bx = Math.max(0, Math.min(s.bw - 1, Math.floor(u.x / R))), by = Math.max(0, Math.min(s.bh - 1, Math.floor(u.y / R)));
    for (let yy = Math.max(0, by - 1); yy <= Math.min(s.bh - 1, by + 1); yy++) for (let xx = Math.max(0, bx - 1); xx <= Math.min(s.bw - 1, bx + 1); xx++) {
      for (const v of s.bk[yy * s.bw + xx]) {
        if (v.id <= u.id || v.dead) continue;
        let dx = v.x - u.x, dy = v.y - u.y; const min = (u.r + v.r) * 0.85;
        if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d >= min) continue;
        if (d < 0.01) { dx = ((v.id % 3) - 1) || 1; dy = ((u.id % 3) - 1); d = Math.sqrt(dx * dx + dy * dy); }
        const push = (min - d) * 0.5 / d;
        const mu = mob(s, u), mv = mob(s, v), su = mu / (mu + mv), sv = mv / (mu + mv);
        const ux = u.x - dx * push * su, uy = u.y - dy * push * su, vx = v.x + dx * push * sv, vy = v.y + dy * push * sv;
        if (!blocked(s, ux, uy, u.o)) { u.x = ux; u.y = uy; }
        if (!blocked(s, vx, vy, v.o)) { v.x = vx; v.y = vy; }
      }
    }
  }
}

function checkVictory(s) {
  const has = s.players.map(() => false);
  for (const e of s.ents) if (!e.dead && e.o >= 0 && (e.k === 'u' || (e.k === 'b' && e.t !== 'ciftlik' && !BT[e.t].wall && !BT[e.t].gate))) has[e.o] = true;
  s.players.forEach((p, i) => { if (p.alive && !has[i]) { p.alive = false; s.ev.push({ o: i, m: p.name + ' yenildi!', all: 1 }); } });
  const alive = s.players.filter(p => p.alive);
  if (!alive.length) { s.over = true; s.winner = -1; return; }
  const t0 = alive[0];
  if (alive.every(p => p.slot === t0.slot || (t0.team !== 0 && p.team === t0.team))) { s.over = true; s.winner = t0.slot; s.winTeam = t0.team; }
}

// cmds: array of [slot, cmd]
function step(s, cmds) {
  s.fx = []; s.ev = [];
  s.tick++;
  if (cmds) for (const [o, c] of cmds) applyCmd(s, o, c);
  rebuildBuckets(s);
  s.pathBudget = 40; s.pcache = new Map();
  for (const p of s.players) if (p.ai && p.alive && (s.tick + p.slot * 3) % 10 === 0) aiThink(s, p);
  const n = s.ents.length;
  for (let i = 0; i < n; i++) { const e = s.ents[i]; if (e.dead) continue; if (e.k === 'b') updBld(s, e); }
  for (let i = 0; i < n; i++) { const e = s.ents[i]; if (e.dead || e.gar) continue; if (e.k === 'u') { if (e.o === GAIA) updMonster(s, e); else updUnit(s, e); } }
  for (const a of s.anim) if (!a.dead) updAnimal(s, a);
  rebuildBuckets(s);
  separate(s);
  if (s.anyDead) { s.anyDead = false; s.ents = s.ents.filter(e => { if (e.dead) { s.byId.delete(e.id); return false; } return true; }); }
  if (s.tick % 20 === 0 && !s.over) checkVictory(s);
}

function simHash(s) {
  let h = s.tick | 0;
  for (const e of s.ents) { h = (Math.imul(h, 31) + e.id) | 0; if (e.k !== 'r') { h = (Math.imul(h, 31) + Math.floor(e.x * 8) + Math.floor(e.y * 8) * 7 + Math.floor(e.hp * 8)) | 0; } else h = (h + e.amt + (e.mob ? Math.floor(e.x * 8) + Math.floor(e.y * 8) * 3 : 0)) | 0; }
  for (const p of s.players) for (const k of RT) h = (Math.imul(h, 17) + Math.floor(p.res[k])) | 0;
  return h;
}

// ===================== AI =====================
function findSpot(s, type, ax, ay, rmin, rmax) {
  const sz = BT[type].sz;
  for (let r = rmin; r <= rmax; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = ax + dx - (sz >> 1), ty = ay + dy - (sz >> 1);
      if (tx < 1 || ty < 1 || tx + sz > s.W - 1 || ty + sz > s.H - 1) continue;
      let ok = true;
      for (let y = ty - 1; y <= ty + sz && ok; y++) for (let x = tx - 1; x <= tx + sz; x++) {
        const v = s.occ[y * s.W + x]; if (!v) continue;
        const inside = x >= tx && x < tx + sz && y >= ty && y < ty + sz;
        if (inside) { ok = false; break; }
        const e = s.byId.get(v); if (e && e.k === 'b') { ok = false; break; }
      }
      if (ok) return [tx, ty];
    }
  }
  return null;
}
function aiBuild(s, p, type, ax, ay, V, rmin, rmax, builder) {
  if (!afford(p, BT[type].cost) || p.age < BT[type].age) return false;
  const sp = findSpot(s, type, ax, ay, rmin, rmax); if (!sp) return false;
  let b = builder;
  if (!b) {
    let bd = 1e12;
    for (const v of V) { if (v.st === 'build') continue; const dx = v.x - sp[0] * TILE, dy = v.y - sp[1] * TILE, d = dx * dx + dy * dy + (v.gk === 'w' ? 0 : 40000); if (d < bd) { bd = d; b = v; } }
  }
  if (!b) return false;
  return !!cmdBuild(s, p.slot, [b], type, sp[0], sp[1]);
}
function aiThink(s, p) {
  const A = p.ai, me = p.slot, age = p.age, res = p.res, diff = A.diff;
  const V = [], M = [], B = []; let tc = null, vGar = 0;
  for (const e of s.ents) if (!e.dead && e.o === me) {
    if (e.k === 'u') { if (e.gar) { if (e.t === 'koylu') vGar++; continue; } if (e.t === 'koylu') V.push(e); else M.push(e); }
    else if (e.k === 'b') { B.push(e); if (e.t === 'tc' && e.built && !tc) tc = e; }
  }
  const home = tc || B[0] || V[0] || M[0]; if (!home) return;
  const hx = tileOf(home.x), hy = tileOf(home.y);
  const cnt = (t) => { let c = 0; for (const b of B) if (b.t === t) c++; return c; };
  const unbuilt = (t) => { let c = 0; for (const b of B) if (b.t === t && !b.built) c++; return c; };
  let qU = 0, qV = 0; for (const b of B) for (const it of b.q) if (it.k === 'u') { qU++; if (it.id === 'koylu') qV++; }
  const vilTotal = V.length + vGar;
  const targetVil = [[0, 16, 24, 28], [0, 22, 32, 40], [0, 24, 36, 46]][diff][age];

  // ---- threat & town bell ----
  let threat = null, td = (TILE * 15) * (TILE * 15), threatN = 0;
  for (const b of B) {
    if (b.t === 'ciftlik' || b.t === 'ev' || BT[b.t].wall) continue;
    nearUnits(s, b.x, b.y, TILE * 12, (e) => {
      if (e.dead || !isEnemy(s, me, e.o) || UT[e.t].cls === 'vil') return;
      threatN++; const dx = e.x - home.x, dy = e.y - home.y, d = dx * dx + dy * dy; if (d < td) { td = d; threat = e; }
    });
  }
  const armyN = M.filter(m => m.id !== A.scout).length;
  if (diff > 0 && tc) {
    if (!p.bell && threatN >= 4 && threatN > armyN + 1) { ringBell(s, me, true); A.bellT = s.tick; }
    else if (p.bell && threatN === 0 && s.tick - A.bellT > 150) ringBell(s, me, false);
  }

  // ---- economy ----
  if (!tc && V.length && cnt('tc') === 0) aiBuild(s, p, 'tc', hx, hy, V, 0, 12);
  const ageing = p.researching.cag2 || p.researching.cag3;
  if (tc && !ageing && vilTotal + qV < targetVil && tc.q.length < 2 && !p.bell) cmdTrain(s, me, tc, 'koylu');
  const room = p.popCap - p.pop - qU;
  if (p.popCap < s.popMax && room <= (age >= 2 ? 6 : 3) && unbuilt('ev') < (age >= 2 ? 2 : 1)) aiBuild(s, p, 'ev', hx, hy, V, 4, 22);
  if (V.length >= 5 && cnt('degirmen') === 0) {
    const br = nearestRes(s, 'f', home.x, home.y, TILE * 14);
    aiBuild(s, p, 'degirmen', br ? tileOf(br.x) : hx, br ? tileOf(br.y) : hy, V, 2, 8);
  }
  for (const k of ['w', 'g', 's']) {
    if (unbuilt('depo')) break;
    let n = 0, sample = null; for (const v of V) if (v.gk === k && (v.st === 'gather' || v.st === 'return')) { n++; if (!sample) sample = s.byId.get(v.gt); }
    if (n >= 2 && sample && !sample.dead) {
      const d = nearestDrop(s, me, k, sample.x, sample.y);
      if (!d || rectDist(sample.x, sample.y, d) > TILE * 6) aiBuild(s, p, 'depo', tileOf(sample.x), tileOf(sample.y), V, 2, 6);
    }
  }
  // age up
  A.saving = false;
  if (tc && age < 3 && !ageing) {
    const tid = age === 1 ? 'cag2' : 'cag3';
    const need = age === 1 ? vilTotal >= [12, 15, 15][diff] : vilTotal >= [20, 25, 27][diff];
    if (need && ageReqMet(s, p, tid)) { A.saving = true; if (tc.q.length === 0 || (tc.q.length && tc.q[0].k === 'u' && tc.q.length < 2)) cmdResearch(s, me, tc, tid); }
  }
  const reserve = A.saving ? (age === 1 ? { f: 500 } : { f: 800, g: 200 }) : null;
  const canSpend = (cost) => { for (const k in cost) if (res[k] < cost[k] + (reserve && reserve[k] || 0)) return false; return true; };
  // buildings
  const want = (t, cond, r0, r1) => { if (cond && cnt(t) === 0 && canSpend(BT[t].cost)) aiBuild(s, p, t, hx, hy, V, r0 || 5, r1 || 12); };
  want('kisla', V.length >= 9);
  if (age >= 2) { want('menzil', true); want('demirci', V.length >= 16); want('ahir', V.length >= 18); want('atolye', V.length >= 22); if (cnt('kule') < 2 && res.s >= 150 && V.length >= 18) aiBuild(s, p, 'kule', hx, hy, V, 3, 7); }
  if (age >= 3) { want('kale', true, 4, 10); if (res.s > 1300 && cnt('kale') < 2) aiBuild(s, p, 'kale', hx, hy, V, 5, 16); if (res.s > 400 && cnt('kule') < 5) aiBuild(s, p, 'kule', hx, hy, V, 6, 12); }
  // techs
  for (const b of B) {
    if (!b.built || b.q.length) continue;
    const T = BT[b.t].techs; if (!T) continue;
    for (const t0 of T) { const tid = techKey(p, t0); if (tid === 'cag2' || tid === 'cag3') continue; if (canResearch(s, p, b, tid) && canSpend(TECH[tid].cost) && V.length >= 12) { cmdResearch(s, me, b, tid); break; } }
  }
  // rebalance gatherers
  const ratios = [null, { f: 0.5, w: 0.42, g: 0.08, s: 0 }, { f: 0.42, w: 0.33, g: 0.18, s: 0.07 }, { f: 0.36, w: 0.28, g: 0.24, s: 0.12 }][age];
  if (V.length >= 6 && s.tick % 50 < 10 && !p.bell) {
    const h = { f: 0, w: 0, g: 0, s: 0 };
    for (const v of V) if ((v.st === 'gather' || v.st === 'return') && v.gk) h[v.gk]++;
    let over = null, ov = 1.5, under = null, un = 1.5;
    for (const k of RT) { const d = h[k] - ratios[k] * V.length; if (d > ov) { ov = d; over = k; } if (-d > un) { un = -d; under = k; } }
    if (over && under) for (const v of V) if (v.gk === over && v.st === 'gather') { resetU(v); v.st = 'idle'; v.gk = ''; v.gt = 0; break; }
  }
  const have = { f: 0, w: 0, g: 0, s: 0 };
  for (const v of V) if ((v.st === 'gather' || v.st === 'return') && v.gk) have[v.gk]++;
  if (!p.bell) for (const v of V) {
    if (v.st !== 'idle') continue;
    let k = 'w', bd = -1e9; for (const kk of RT) { const d = ratios[kk] * V.length - have[kk]; if (d > bd) { bd = d; k = kk; } }
    let tgt = null;
    if (k === 'f') {
      tgt = nearestRes(s, 'f', home.x, home.y, TILE * 16) || freeFarm(s, me, home.x, home.y, 0);
      if (!tgt) { if (aiBuild(s, p, 'ciftlik', hx, hy, V, 3, 10, v)) { have.f++; continue; } k = 'w'; }
    }
    if (!tgt) tgt = nearestRes(s, k, home.x, home.y, TILE * 60) || nearestRes(s, 'w', home.x, home.y, TILE * 80);
    if (tgt) { cmdGather(s, me, [v], tgt); have[k]++; }
  }

  // ---- know the enemy: composition and the weakest neighbour ----
  const ec = { inf: 0, arch: 0, cav: 0, siege: 0 }; const estr = {};
  for (const e of s.ents) if (e.k === 'u' && !e.dead && isEnemy(s, me, e.o)) {
    const c = UT[e.t].cls; if (c === 'vil') continue;
    const k = c === 'cav' && UT[e.t].rng > 0 ? 'arch' : c; ec[k]++; estr[e.o] = (estr[e.o] || 0) + 1;
  }
  const eTot = ec.inf + ec.arch + ec.cav + 1;
  // which of our buildings counters the enemy best
  let prio = 'kisla';
  if (ec.cav / eTot > 0.35) prio = 'kisla';           // spearmen beat cavalry
  else if (ec.arch / eTot > 0.35) prio = age >= 2 ? 'ahir' : 'kisla'; // cavalry beats archers
  else if (ec.inf / eTot > 0.4) prio = age >= 2 ? 'menzil' : 'kisla'; // archers beat infantry
  const ecoFirst = !threat && V.length < targetVil * (age === 1 ? 0.8 : 0.6);
  if (age >= 2 && res.w > 450 && !ecoFirst) { for (const t of ['kisla', 'menzil', 'ahir']) if (cnt(t) < 2 && canSpend(BT[t].cost)) { aiBuild(s, p, t, hx, hy, V, 6, 14); break; } }
  const rich = res.f + res.w + res.g > 700;
  for (const b of B) {
    if (ecoFirst && b.t !== 'kale') break;
    if (!b.built || b.q.length >= 2) continue;
    if (b.t !== prio && b.t !== 'kale' && b.t !== 'atolye' && !rich && !threat) continue;
    let ut = null;
    if (b.t === 'kisla') ut = ec.cav / eTot > 0.3 ? (A.k++ % 4 === 0 ? 'kilicli' : 'mizrakci') : (A.k++ % 3 === 0 ? 'mizrakci' : 'kilicli');
    else if (b.t === 'menzil') ut = 'okcu';
    else if (b.t === 'ahir') ut = age >= 3 && res.g > 150 && (A.k++ % 2) ? 'zirhli' : 'atli';
    else if (b.t === 'atolye') { let sc = 0; for (const m of M) if (UT[m.t].cls === 'siege') sc++; if (sc < 3) ut = age >= 3 && (A.k++ % 2) ? 'mancinik' : 'koc'; }
    else if (b.t === 'kale') ut = CIVS[p.civ].uu;
    if (ut && canTrain(s, p, b, ut) && canSpend(uStat(p, ut).cost) && (V.length >= 8 || b.t === 'kale')) cmdTrain(s, me, b, ut);
  }

  // ---- scouting with the starting horseman ----
  if (A.scout == null) { const sc = M.find(m => m.t === 'atli'); A.scout = sc ? sc.id : 0; A.si = 0; }
  const scout = A.scout ? s.byId.get(A.scout) : null;
  if (scout && !scout.dead) {
    const wps = [];
    for (let i = 0; i < s.starts.length; i++) if (i !== me) wps.push(s.starts[i]);
    wps.push([s.W >> 1, s.H >> 1], [s.starts[me][0], s.starts[me][1]]);
    if (A.si >= wps.length || threat) A.scout = 0;
    else if (scout.st === 'idle') { const w = wps[A.si++]; cmdMove(s, me, [scout], w[0] * TILE + 16, w[1] * TILE + 16); }
  } else A.scout = 0;

  // ---- army ----
  const army = M.filter(m => m.id !== A.scout);
  if (!army.length) return;
  if (A.helpTo != null && s.tick < A.helpT && !threat) { // a team-mate asked for help
    const at = s.ents.find(e => e.k === 'b' && e.o === A.helpTo && e.t === 'tc' && !e.dead) || s.ents.find(e => e.k === 'b' && e.o === A.helpTo && !e.dead);
    if (at) {
      let foe = null, fd = (TILE * 16) * (TILE * 16);
      nearUnits(s, at.x, at.y, TILE * 16, (e) => { if (!e.dead && isEnemy(s, me, e.o)) { const dx = e.x - at.x, dy = e.y - at.y, d = dx * dx + dy * dy; if (d < fd) { fd = d; foe = e; } } });
      const free = army.filter(m => m.st !== 'attack' && !UT[m.t].onlyBld);
      if (foe && free.length) cmdAttack(s, me, free, foe);
      else if (!foe) { const far = army.filter(m => m.st === 'idle' && Math.abs(m.x - at.x) + Math.abs(m.y - at.y) > TILE * 8); if (far.length) cmdMove(s, me, far, Math.floor(at.x), Math.floor(at.y + TILE * 3)); }
      return;
    }
  }
  if (threat) {
    const fighters = army.filter(m => !UT[m.t].onlyBld && (m.st !== 'attack' || !s.byId.get(m.tgt) || s.byId.get(m.tgt).k === 'b'));
    if (fighters.length) cmdAttack(s, me, fighters, threat);
    return;
  }
  const hasSiege = army.some(m => UT[m.t].cls === 'siege');
  // weakest reachable enemy, then an economic target that is not covered by towers
  const pickTarget = (fx, fy) => {
    let bestP = -1, bs = 1e15;
    for (const q of s.players) {
      if (!q.alive || !isEnemy(s, me, q.slot)) continue;
      const st = s.starts[q.slot], dx = st[0] * TILE - home.x, dy = st[1] * TILE - home.y;
      const score = Math.sqrt(dx * dx + dy * dy) / TILE + (estr[q.slot] || 0) * 2;
      if (score < bs) { bs = score; bestP = q.slot; }
    }
    let best = null, bd = 1e15;
    for (const e of s.ents) if (e.k === 'b' && !e.dead && isEnemy(s, me, e.o) && !BT[e.t].wall && !BT[e.t].gate) {
      const dx = e.x - fx, dy = e.y - fy;
      let d = dx * dx + dy * dy;
      if (e.o !== bestP) d += 4e7;
      if (e.t === 'ciftlik') d += 4e6;
      if (!hasSiege && (e.t === 'kule' || e.t === 'kale')) d += 2e7;
      if (!hasSiege) for (const t of s.ents) if (t.k === 'b' && !t.dead && t.o === e.o && (t.t === 'kule' || t.t === 'kale') && t.built && rectDist(e.x, e.y, t) < TILE * 7) { d += 1e7; break; }
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) for (const e of s.ents) if (e.k === 'u' && !e.dead && !e.gar && isEnemy(s, me, e.o)) { // hunt the last survivors
      const dx = e.x - fx, dy = e.y - fy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const waveSize = [7, 10, 12][diff] + A.wave * 3;
  if (A.attacking) {
    // retreat when the attack has been broken
    if (army.length < Math.max(3, A.waveN * 0.4)) {
      A.attacking = false; A.wave++; A.next = s.tick + [3000, 2100, 1500][diff];
      cmdMove(s, me, army, home.x, home.y);
      return;
    }
    const idle = army.filter(m => m.st === 'idle');
    if (idle.length) { const t = pickTarget(idle[0].x, idle[0].y); if (t) cmdAttack(s, me, idle, t); }
  } else if (s.tick >= A.next && (army.length >= waveSize || (A.joinT && s.tick < A.joinT && army.length >= 5))) {
    const t = pickTarget(home.x, home.y);
    if (t) { A.attacking = true; A.waveN = army.length; cmdAttack(s, me, army, t); }
  } else {
    // hard AI: horse raid on enemy villagers
    if (diff === 2 && age >= 2 && s.tick > (A.raidT || 0)) {
      const raiders = army.filter(m => UT[m.t].cls === 'cav' && m.st === 'idle');
      if (raiders.length >= 4) {
        let vt = null, vd = 1e15;
        for (const e of s.ents) if (e.k === 'u' && !e.dead && !e.gar && e.t === 'koylu' && isEnemy(s, me, e.o)) { const dx = e.x - home.x, dy = e.y - home.y, d = dx * dx + dy * dy; if (d < vd) { vd = d; vt = e; } }
        if (vt) { cmdAttack(s, me, raiders.slice(0, 6), vt); A.raidT = s.tick + 3600; return; }
      }
    }
    const cx = s.W * TILE / 2, cy = s.H * TILE / 2;
    const dx = cx - home.x, dy = cy - home.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const rx = home.x + dx / d * TILE * 6, ry = home.y + dy / d * TILE * 6;
    const idle = army.filter(m => m.st === 'idle' && (Math.abs(m.x - rx) + Math.abs(m.y - ry)) > TILE * 5);
    if (idle.length) cmdMove(s, me, idle, Math.floor(rx), Math.floor(ry));
  }
}

if (typeof module !== 'undefined') module.exports = { serializeSim, deserializeSim, QUICK, tribute, hurtAnimal, wallLine, BUILD_ECO, BUILD_MIL, newSim, step, simHash, applyCmd, UT, BT, TECH, CIVS, CIV_KEYS, uStat, bStat, canPlace, TILE };
