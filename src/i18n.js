// ===================== LANGUAGES (Türkçe / English / Nederlands) =====================
// Turkish is the source language. Visible text is translated where it appears: every text node and
// tooltip added to the page passes through T(); game data names (units, buildings, techs, civs) are
// swapped once at start-up. Dictionaries live in LANG_DATA (lang_en.js / lang_nl.js).
const LANGS = { tr: '🇹🇷 Türkçe', en: '🇬🇧 English', nl: '🇳🇱 Nederlands' };
const LANG = (() => {
  try { const l = localStorage.getItem('dd_lang'); if (LANGS[l]) return l; } catch (e) {}
  for (const n of (navigator.languages || [navigator.language || ''])) { const k = String(n).slice(0, 2).toLowerCase(); if (LANGS[k]) return k; }
  return 'tr';
})();
const LANG_DATA = { en: self.LANG_EN, nl: self.LANG_NL };
const TRX = { s: new Map(), p: [] };
function T(s) {
  if (LANG === 'tr' || s == null) return s;
  const str = String(s); if (!/[A-Za-zÀ-ɏ]/.test(str)) return str;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str), core = m[2];
  let r = TRX.s.get(core);
  if (r == null) for (const [re, rep] of TRX.p) { if (re.test(core)) { r = core.replace(re, typeof rep === 'function' ? rep : rep); break; } }
  return r == null ? str : m[1] + r + m[3];
}
function setLang(l) { try { localStorage.setItem('dd_lang', l); } catch (e) {} location.reload(); }
(function initLang() {
  document.documentElement.lang = LANG;
  const D = LANG_DATA[LANG]; if (LANG === 'tr' || !D) return;
  for (const k in D.s) TRX.s.set(k, D.s[k]);
  for (const [re, rep] of D.p || []) TRX.p.push([re, rep]);
  const alias = (a, b) => { if (a && b && a !== b && !TRX.s.has(a)) TRX.s.set(a, b); };
  const put = (obj, map, f) => { for (const k in map) if (obj[k]) f(obj[k], map[k]); };
  put(UT, D.units, (o, v) => alias(o.n, v)); put(BT, D.blds, (o, v) => alias(o.n, v));
  put(TECH, D.techs, (o, v) => { alias(o.n, v[0]); alias(o.d, v[1]); });
  put(CIVS, D.civs, (o, v) => { alias(o.n, v[0]); alias(o.lead, v[1]); alias(o.d, v[2]); alias(o.flag + ' ' + o.n, o.flag + ' ' + v[0]); });
  put(RES_INFO, D.res, (o, v) => alias(o.n, v));
  for (const k in D.quick) alias(QUICK[k], D.quick[k]); for (const k in D.camp) alias(CAMP_NAME[k], D.camp[k]);
  D.colors.forEach((c, i) => alias(COLOR_NAMES[i], c)); D.ages.forEach((c, i) => alias(AGE_NAMES[i], c));
  put(UT, D.units, (o, v) => { o.n = v; });
  put(BT, D.blds, (o, v) => { o.n = v; });
  put(TECH, D.techs, (o, v) => { o.n = v[0]; if (v[1]) o.d = v[1]; });
  put(CIVS, D.civs, (o, v) => { o.n = v[0]; o.lead = v[1]; o.d = v[2]; });
  put(RES_INFO, D.res, (o, v) => { o.n = v; });
  Object.assign(RNAME, D.rname); Object.assign(QUICK, D.quick); Object.assign(CAMP_NAME, D.camp);
  D.colors.forEach((c, i) => { COLOR_NAMES[i] = c; }); D.ages.forEach((c, i) => { AGE_NAMES[i] = c; });
  // also make reverse entries so names built from data (e.g. "Kışla tamamlandı") translate whole
})();
// ---- translate the page as it changes ----
const TR_ATTR = ['title', 'placeholder'];
function trText(n) { const v = n.nodeValue, t = T(v); if (t !== v) n.nodeValue = t; }
function trEl(el) {
  if (el.nodeType === 3) { trText(el); return; }
  if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const a of TR_ATTR) { const v = el.getAttribute(a); if (v) { const t = T(v); if (t !== v) el.setAttribute(a, t); } }
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) {
    if (n.nodeType === 3) trText(n);
    else for (const a of TR_ATTR) { const v = n.getAttribute(a); if (v) { const t = T(v); if (t !== v) n.setAttribute(a, t); } }
  }
}
if (LANG !== 'tr') {
  const go = () => {
    if (LANG_DATA[LANG] && LANG_DATA[LANG].help) { const h = document.getElementById('helpBody'); if (h) h.innerHTML = LANG_DATA[LANG].help; }
    document.title = T(document.title);
    trEl(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v) { const t = T(v); if (t !== v) m.target.setAttribute(m.attributeName, t); } }
        else for (const n of m.addedNodes) trEl(n);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TR_ATTR });
  };
  go();
}
function langPicker() {
  const el = document.getElementById('langPick'); if (!el) return;
  el.innerHTML = Object.keys(LANGS).map(k => `<button class="tb${k === LANG ? ' on' : ''}" data-l="${k}">${LANGS[k]}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.l !== LANG) setLang(b.dataset.l); });
}
langPicker();
