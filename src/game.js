'use strict';
// ===================== CLIENT: menus, lockstep, render, input =====================
const $ = (id) => document.getElementById(id);
const TURN_MS = 100;
const store = { get(k, d) { try { const v = localStorage.getItem('dd_' + k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('dd_' + k, v); } catch (e) {} } };
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;
let G = null;

function show(id) { document.querySelectorAll('.scr').forEach(e => e.classList.toggle('on', e.id === id)); if (id === 'mp') mpOpen(); }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function costStr(c) { return RT.filter(k => c[k]).map(k => c[k] + RES_INFO[k].i).join(' '); }
function rndCiv() { return CIV_KEYS[(Math.random() * 4) | 0]; }

function civCards(el, sel, pick) {
  el.innerHTML = CIV_KEYS.map(k => { const c = CIVS[k]; return `<button class="civ ${k === sel ? 'sel' : ''}" data-c="${k}"><span class="fl">${c.flag}</span><b>${c.n}</b><small>Lider: ${c.lead}</small><small>${c.d}</small></button>`; }).join('');
  el.querySelectorAll('.civ').forEach(b => b.onclick = () => pick(b.dataset.c));
}
$('helpCivs').innerHTML = CIV_KEYS.map(k => `<p><b>${CIVS[k].flag} ${CIVS[k].n}</b> — ${CIVS[k].lead}<br>${CIVS[k].d}</p>`).join('');

// ---------------- single player setup ----------------
const SP = { civ: store.get('civ', 'bozkir'), opps: [{ civ: 'rnd', diff: 1 }] };
$('spName').value = store.get('name', T('Komutan'));
$('mpName').value = store.get('name', T('Komutan'));
function civSelect(v) { return `<select data-k="civ"><option value="rnd">🎲 Rastgele</option>${CIV_KEYS.map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${CIVS[k].flag} ${CIVS[k].n}</option>`).join('')}</select>`; }
function diffSelect(v) { return `<select data-k="diff">${['Kolay', 'Normal', 'Zor'].map((n, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`; }
function spRender() {
  civCards($('spCivs'), SP.civ, (k) => { SP.civ = k; store.set('civ', k); spRender(); });
  let h = `<div class="slot"><span class="dot" style="background:${COLORS[0]}"></span><span class="nm">Sen</span><span class="ctl">${CIVS[SP.civ].flag}</span></div>`;
  SP.opps.forEach((o, i) => {
    h += `<div class="slot" data-i="${i}"><span class="dot" style="background:${COLORS[i + 1]}"></span><span class="nm">🤖 Yapay zeka</span><span class="ctl">${civSelect(o.civ)}${diffSelect(o.diff)}${SP.opps.length > 1 ? '<button class="tb" data-del>✕</button>' : ''}</span></div>`;
  });
  $('spSlots').innerHTML = h;
  $('spSlots').querySelectorAll('.slot[data-i]').forEach(r => {
    const o = SP.opps[+r.dataset.i];
    r.querySelectorAll('select').forEach(s => s.onchange = () => { o[s.dataset.k] = s.dataset.k === 'diff' ? +s.value : s.value; });
    const d = r.querySelector('[data-del]'); if (d) d.onclick = () => { SP.opps.splice(+r.dataset.i, 1); spRender(); };
  });
  $('spAdd').style.display = SP.opps.length >= 3 ? 'none' : '';
}
$('spAdd').onclick = () => { if (SP.opps.length < 3) { SP.opps.push({ civ: 'rnd', diff: 1 }); spRender(); } };
$('spStart').onclick = () => {
  const name = ($('spName').value || T('Komutan')).slice(0, 14); store.set('name', name);
  const teams = $('spTeams').checked && SP.opps.length >= 2;
  const players = [{ civ: SP.civ, name, team: teams ? 1 : 0 }];
  SP.opps.forEach((o, i) => players.push({ civ: o.civ === 'rnd' ? rndCiv() : o.civ, ai: true, diff: o.diff, team: teams ? (i === 0 ? 1 : 2) : 0, }));
  players.forEach((p, i) => { if (p.ai) p.name = CIVS[p.civ].lead; });
  store.set('map', $('spMap').value);
  ['Size', 'Res', 'Pop', 'Mon'].forEach(k => store.set('sp' + k, $('sp' + k).value));
  startGame({ players, seed: (Math.random() * 2e9) | 0, me: 0, mode: 'sp', map: $('spMap').value, size: $('spSize').value, res: $('spRes').value, pop: +$('spPop').value, mon: $('spMon').value });
};
spRender();

// ===================== MULTIPLAYER (room capability) =====================
const NET = { room: null, tried: false, failed: false, me: null, gr: null, code: '', host: false, slots: null, teams: false, civ: store.get('civ', 'bozkir'), started: false };
(async function netInit() {
  try {
    let r;
    if (!window.claude || typeof window.claude.use !== 'function') { if (typeof P2P === 'undefined' || !window.RTCPeerConnection) { NET.failed = true; return; } r = P2P.lobby; NET.p2p = true; $('mpHint').textContent = 'Oyun kurunca çıkan 4 harfli kodu arkadaşlarına gönder. Onlar bu sitenin aynı adresini açıp kodu yazarak katılır. İnternet bağlantısı gerekir.'; }
    else r = await window.claude.use('room');
    if (!r) { NET.failed = true; return; }
    NET.room = r;
    r.onPeers((ch) => { for (const p of ch.peers) if (p.isMe && p.sameTab) NET.me = p.peer; renderGameList(); }, () => { NET.failed = true; NET.room = null; mpOpen(); });
  } catch (e) { NET.failed = true; }
  finally { NET.tried = true; if ($('mp').classList.contains('on')) mpOpen(); }
})();
function mpOpen() {
  const ok = !!NET.room;
  $('mpNo').style.display = !ok && (NET.tried || NET.failed) ? '' : 'none';
  $('mpLobby').style.display = ok && !NET.gr ? '' : 'none';
  $('mpRoom').style.display = ok && NET.gr ? '' : 'none';
  if (!NET.tried && !ok) $('mpList').innerHTML = '<p class="hint">Bağlanıyor…</p>';
  renderGameList();
}
function renderGameList() {
  if (!NET.room) return;
  const games = NET.room.peers().filter(p => !p.isMe && p.presence && p.presence.adv && typeof p.presence.adv.code === 'string');
  $('mpList').innerHTML = games.length ? '' : NET.p2p ? '<p class="hint">Oyun kur ve 4 harfli oda kodunu arkadaşlarına gönder; onlar kodu yazıp katılsın.</p>' : '<p class="hint">Şu an açık oyun yok. Yeni bir oyun kur ya da kodla katıl.</p>';
  for (const p of games) {
    const a = p.presence.adv, b = document.createElement('button');
    b.textContent = `🏰 ${String(a.nm || 'Oyuncu').slice(0, 14)} — ${(a.n | 0)}/4 oyuncu — Kod ${String(a.code).slice(0, 6)}`;
    b.onclick = () => joinRoom(String(a.code), false); $('mpList').appendChild(b);
  }
}
function myName() { const n = ($('mpName').value || T('Komutan')).slice(0, 14); store.set('name', n); return n; }
$('mpHost').onclick = () => { const A = 'ABCDEFGHJKLMNPRSTUVYZ'; let c = ''; for (let i = 0; i < 4; i++) c += A[(Math.random() * A.length) | 0]; joinRoom(c, true); };
$('mpJoin').onclick = () => { const c = $('mpCode').value.trim().toUpperCase(); if (/^[A-Z0-9]{3,6}$/.test(c)) joinRoom(c, false); };
async function ensureMe() {
  for (let i = 0; i < 30 && !NET.me; i++) { const m = NET.room.peers().find(p => p.isMe && p.sameTab); if (m) NET.me = m.peer; else await new Promise(r => setTimeout(r, 100)); }
  return NET.me;
}
async function joinRoom(code, host) {
  if (!NET.room) return;
  if (!(await ensureMe())) { $('mpState').textContent = 'Bağlantı kurulamadı, tekrar dene.'; return; }
  try {
    if (NET.p2p) { $('mpState').textContent = 'Bağlanıyor…'; $('mpList').innerHTML = '<p class="hint">Bağlanıyor…</p>'; }
    NET.gr = await NET.room.join('dd-' + code.toLowerCase(), { create: host });
  } catch (e) {
    NET.gr = null;
    const t = String(e && (e.type || e.message) || '');
    const msg = t === 'peer-unavailable' ? 'Bu kodla açık oyun bulunamadı. Kodu kontrol et.' : t === 'unavailable-id' ? 'Bu oda kodu kullanımda, tekrar dene.' : t === 'lib' ? 'Bağlantı kütüphanesi yüklenemedi (internet bağlantını kontrol et).' : 'Odaya girilemedi.';
    $('mpState').textContent = msg; if (NET.p2p) { renderGameList(); $('mpList').insertAdjacentHTML('afterbegin', '<p class="hint" style="color:#ffb36b">' + msg + '</p>'); }
    return;
  }
  NET.code = code; NET.host = host; NET.started = false; NET.teams = false;
  $('mpRoomCode').textContent = code;
  if (host) {
    NET.slots = [{ k: 'h', peer: NET.me, nm: myName(), civ: NET.civ, team: 1 }, { k: 'open' }, { k: 'open' }, { k: 'open' }];
    NET.room.presence({ adv: { code, nm: myName(), n: 1 } }).catch(() => {});
  } else NET.slots = null;
  NET.gr.onPeers(roomPeers, () => { addMsg('Bağlantı koptu', 1); });
  pushLobby(); mpOpen(); renderRoom();
}
function pushLobby() {
  if (!NET.gr) return;
  const lob = NET.host ? { host: 1, nm: myName(), slots: NET.slots, teams: NET.teams, map: NET.map || 'ova', set: mpSettings(), go: NET.go || null } : { nm: myName(), civ: NET.civ, team: NET.team || 1 };
  NET.gr.presence({ lob }).catch(() => {});
  if (NET.host && NET.room && !NET.started) NET.room.presence({ adv: { code: NET.code, nm: myName(), n: NET.slots.filter(s => s.k === 'h').length } }).catch(() => {});
}
$('mpLeave').onclick = () => leaveRoom();
function leaveRoom() {
  if (NET.gr) NET.gr.leave().catch(() => {});
  NET.gr = null; NET.slots = null; NET.go = null; NET.started = false;
  if (NET.room) NET.room.presence({ adv: null }).catch(() => {});
  mpOpen();
}
$('mpMap').onchange = () => { if (NET.host) { NET.map = $('mpMap').value; pushLobby(); } };
function mpSettings() { return { size: $('mpSize').value, res: $('mpRes').value, pop: +$('mpPop').value, mon: $('mpMon').value }; }
['mpSize', 'mpRes', 'mpPop', 'mpMon'].forEach(id => $(id).onchange = () => { if (NET.host) pushLobby(); });
$('mpTeams').onchange = () => { if (NET.host) { NET.teams = $('mpTeams').checked; pushLobby(); renderRoom(); } };
function hostPeer() { return NET.gr ? NET.gr.peers().find(p => p.presence && p.presence.lob && p.presence.lob.host && !p.isMe) : null; }
function roomPeers(ch) {
  if (G && G.mode === 'mp') { netGamePeers(ch); return; }
  if (!NET.gr) return;
  const peers = NET.gr.peers();
  if (NET.host) {
    let changed = false;
    for (const p of ch.left) { const i = NET.slots.findIndex(s => s.k === 'h' && s.peer === p.peer); if (i > 0) { NET.slots[i] = { k: 'open' }; changed = true; } }
    for (const p of peers) {
      if (p.isMe || p.kind !== 'viewer') continue;
      const lob = p.presence && p.presence.lob; if (!lob || lob.host) continue;
      let i = NET.slots.findIndex(s => s.k === 'h' && s.peer === p.peer);
      if (i < 0) { i = NET.slots.findIndex(s => s.k === 'open'); if (i < 0) continue; NET.slots[i] = { k: 'h', peer: p.peer }; changed = true; }
      const s = NET.slots[i], civ = CIVS[lob.civ] ? lob.civ : 'bozkir', nm = String(lob.nm || 'Oyuncu').slice(0, 14), team = Math.max(1, Math.min(4, lob.team | 0));
      if (s.civ !== civ || s.nm !== nm || s.team !== team) { s.civ = civ; s.nm = nm; s.team = team; changed = true; }
    }
    if (changed) pushLobby();
  } else {
    const h = hostPeer();
    if (!h) { $('mpState').textContent = 'Oda kurucusu bekleniyor…'; NET.slots = null; }
    else {
      const lob = h.presence.lob; NET.slots = Array.isArray(lob.slots) ? lob.slots.slice(0, 4) : null; NET.teams = !!lob.teams; NET.map = ['ova', 'nehir', 'yayla'].indexOf(lob.map) >= 0 ? lob.map : 'ova'; NET.set = lob.set && typeof lob.set === 'object' ? lob.set : null;
      if (lob.go && !NET.started && NET.slots) { startMP(lob.go); return; }
    }
  }
  renderRoom();
}
function renderRoom() {
  if (!NET.gr) return;
  civCards($('mpCivs'), NET.civ, (k) => { NET.civ = k; store.set('civ', k); if (NET.host) { NET.slots[0].civ = k; } pushLobby(); renderRoom(); });
  $('mpTeams').checked = NET.teams; $('mpTeams').disabled = !NET.host; $('mpMap').value = NET.map || 'ova'; $('mpMap').disabled = !NET.host;
  if (!NET.host && NET.set) { $('mpSize').value = NET.set.size || 'orta'; $('mpRes').value = NET.set.res || 'dusuk'; $('mpPop').value = String(NET.set.pop || 150); $('mpMon').value = NET.set.mon || 'az'; }
  ['mpSize', 'mpRes', 'mpPop', 'mpMon'].forEach(id => $(id).disabled = !NET.host);
  const sl = NET.slots || [];
  let h = '';
  sl.forEach((s, i) => {
    let nm, ctl = '';
    const teamSel = NET.teams && s.k !== 'open' && s.k !== 'closed' ? `<select data-k="team">${[1, 2, 3, 4].map(t => `<option value="${t}" ${s.team === t ? 'selected' : ''}>Takım ${t}</option>`).join('')}</select>` : '';
    if (s.k === 'h') { nm = esc(s.nm || 'Oyuncu') + (s.peer === NET.me ? ' (sen)' : '') + (i === 0 ? ' 👑' : ''); ctl = (CIVS[s.civ] ? CIVS[s.civ].flag : '❔') + ' ' + (s.peer === NET.me || NET.host ? teamSel : (NET.teams ? 'T' + (s.team || 1) : '')); if (NET.host && i > 0) ctl += '<button class="tb" data-kick>✕</button>'; }
    else if (s.k === 'ai') { nm = '🤖 Yapay zeka'; ctl = NET.host ? civSelect(s.civ) + diffSelect(s.diff) + teamSel + '<button class="tb" data-open>✕</button>' : (s.civ === 'rnd' ? '🎲' : CIVS[s.civ].flag); }
    else if (s.k === 'open') { nm = '<span style="color:var(--mut)">Açık — oyuncu bekleniyor</span>'; ctl = NET.host ? '<button class="tb" data-ai>+ YZ</button><button class="tb" data-close>Kapat</button>' : ''; }
    else { nm = '<span style="color:var(--mut)">Kapalı</span>'; ctl = NET.host ? '<button class="tb" data-open>Aç</button>' : ''; }
    h += `<div class="slot" data-i="${i}"><span class="dot" style="background:${COLORS[i]}"></span><span class="nm">${nm}</span><span class="ctl">${ctl}</span></div>`;
  });
  $('mpSlots').innerHTML = h;
  $('mpSlots').querySelectorAll('.slot').forEach(r => {
    const i = +r.dataset.i, s = sl[i];
    const on = (sel, fn) => { const e = r.querySelector(sel); if (e) e.onclick = fn; };
    on('[data-ai]', () => { sl[i] = { k: 'ai', civ: 'rnd', diff: 1, team: 2 }; pushLobby(); renderRoom(); });
    on('[data-close]', () => { sl[i] = { k: 'closed' }; pushLobby(); renderRoom(); });
    on('[data-open]', () => { sl[i] = { k: 'open' }; pushLobby(); renderRoom(); });
    on('[data-kick]', () => { sl[i] = { k: 'closed' }; pushLobby(); renderRoom(); });
    r.querySelectorAll('select').forEach(e => e.onchange = () => {
      if (e.dataset.k === 'team') { const t = +e.value; if (s.peer === NET.me) NET.team = t; if (NET.host) s.team = t; }
      else if (NET.host) s[e.dataset.k] = e.dataset.k === 'diff' ? +e.value : e.value;
      pushLobby();
    });
  });
  const n = sl.filter(s => s.k === 'h' || s.k === 'ai').length;
  $('mpStart').style.display = NET.host ? '' : 'none';
  $('mpStart').disabled = n < 2;
  if (NET.host) $('mpState').textContent = n < 2 ? 'Başlamak için en az 2 oyuncu (insan veya yapay zeka) gerekli.' : 'Hazır olduğunda başlat.';
  else if (NET.slots) $('mpState').textContent = 'Kurucunun başlatması bekleniyor…';
}
$('mpStart').onclick = () => {
  if (!NET.host) return;
  const slots = NET.slots.filter(s => s.k === 'h' || s.k === 'ai').map(s => Object.assign({}, s, { civ: s.civ === 'rnd' || !CIVS[s.civ] ? rndCiv() : s.civ }));
  if (slots.length < 2) return;
  NET.go = Object.assign({ seed: (Math.random() * 2e9) | 0, slots, teams: NET.teams, map: NET.map || 'ova' }, mpSettings());
  pushLobby();
  NET.room.presence({ adv: null }).catch(() => {});
  startMP(NET.go);
};
function startMP(go) {
  const slots = go.slots; if (!Array.isArray(slots)) return;
  const me = slots.findIndex(s => s.k === 'h' && s.peer === NET.me);
  if (me < 0) { $('mpState').textContent = 'Oyun sensiz başladı.'; return; }
  NET.started = true;
  const players = slots.map(s => ({ civ: CIVS[s.civ] ? s.civ : 'bozkir', ai: s.k === 'ai', diff: s.diff | 0, team: go.teams ? (s.team || 1) : 0, name: s.k === 'ai' ? '🤖 ' + CIVS[CIVS[s.civ] ? s.civ : 'bozkir'].lead : String(s.nm || 'Oyuncu').slice(0, 14) }));
  const peerSlot = {}; const humans = [];
  slots.forEach((s, i) => { if (s.k === 'h') { peerSlot[s.peer] = i; humans.push(i); } });
  startGame({ players, seed: go.seed | 0, me, mode: 'mp', humans, peerSlot, gid: NET.code + ':' + (go.seed | 0), map: ['ova', 'nehir', 'yayla'].indexOf(go.map) >= 0 ? go.map : 'ova', size: ['kucuk', 'orta', 'buyuk'].indexOf(go.size) >= 0 ? go.size : 'orta', res: ['dusuk', 'orta', 'yuksek'].indexOf(go.res) >= 0 ? go.res : 'dusuk', pop: [75, 100, 150, 200].indexOf(go.pop) >= 0 ? go.pop : 150, mon: ['yok', 'az', 'cok'].indexOf(go.mon) >= 0 ? go.mon : 'az' });
}

// ===================== SOUND (WebAudio, synthesized — no files) =====================
const SND = { ctx: null, on: store.get('snd', '1') === '1', mus: store.get('mus', '1') === '1', last: {}, musT: 0, step: 0 };
function sndInit() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {}); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = SND.ctx = new C();
    SND.master = c.createGain(); SND.master.gain.value = 0.55; SND.master.connect(c.destination);
    SND.sfx = c.createGain(); SND.sfx.gain.value = SND.on ? 1 : 0; SND.sfx.connect(SND.master);
    SND.musG = c.createGain(); SND.musG.gain.value = SND.mus ? 0.2 : 0;
    const dl = c.createDelay(); dl.delayTime.value = 0.36; const fb = c.createGain(); fb.gain.value = 0.35;
    dl.connect(fb); fb.connect(dl); SND.musG.connect(SND.master); SND.musG.connect(dl); dl.connect(SND.master);
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    SND.noise = buf;
  } catch (e) { SND.ctx = null; }
}
addEventListener('pointerdown', sndInit, true); addEventListener('keydown', sndInit, true);
function sndSet() { store.set('snd', SND.on ? '1' : '0'); store.set('mus', SND.mus ? '1' : '0'); if (SND.ctx) { SND.sfx.gain.value = SND.on ? 1 : 0; SND.musG.gain.value = SND.mus ? 0.2 : 0; } sndLabels(); }
function sndLabels() { document.querySelectorAll('.btnSnd').forEach(b => b.textContent = SND.on ? '🔊 Ses açık' : '🔇 Ses kapalı'); document.querySelectorAll('.btnMus').forEach(b => b.textContent = SND.mus ? '🎵 Müzik açık' : '🎵 Müzik kapalı'); }
function envG(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type, f0, f1, dur, vol, dest, t0) {
  const c = SND.ctx, t = t0 || c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  envG(g, t, 0.006, vol, dur); o.connect(g); g.connect(dest || SND.sfx); o.start(t); o.stop(t + dur + 0.05);
}
function noiseB(dur, vol, ft, freq, q, t0) {
  const c = SND.ctx, t = t0 || c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = SND.noise; f.type = ft; f.frequency.value = freq; f.Q.value = q || 1;
  envG(g, t, 0.003, vol, dur); src.connect(f); f.connect(g); g.connect(SND.sfx); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function sfx(name, vol) {
  if (!SND.ctx || !SND.on || SND.ctx.state !== 'running') return;
  const now = performance.now(), gap = { sword: 70, arrow: 60, chop: 380, pick: 380, build: 420, die: 90, thud: 120, click: 30 }[name] || 160;
  if (now - (SND.last[name] || 0) < gap) return; SND.last[name] = now;
  const v = vol == null ? 1 : vol, r = 0.9 + Math.random() * 0.2, t = SND.ctx.currentTime;
  switch (name) {
    case 'sword': noiseB(0.06, 0.22 * v, 'bandpass', 3200 * r, 4); tone('square', 1800 * r, 1350 * r, 0.08, 0.035 * v); break;
    case 'arrow': noiseB(0.13, 0.11 * v, 'highpass', 2500 * r, 0.7); break;
    case 'thud': tone('sine', 120 * r, 45, 0.25, 0.32 * v); noiseB(0.15, 0.14 * v, 'lowpass', 500, 1); break;
    case 'die': tone('triangle', 300 * r, 120, 0.18, 0.07 * v); break;
    case 'boom': noiseB(0.9, 0.45 * v, 'lowpass', 380, 0.7); tone('sine', 70, 30, 0.8, 0.35 * v); break;
    case 'chop': noiseB(0.05, 0.2 * v, 'bandpass', 900 * r, 3); tone('sine', 220 * r, 160, 0.06, 0.07 * v); break;
    case 'pick': tone('square', 2400 * r, 2000, 0.05, 0.03 * v); noiseB(0.04, 0.1 * v, 'highpass', 3000, 1); break;
    case 'build': tone('sine', 300 * r, 180, 0.07, 0.13 * v); noiseB(0.05, 0.13 * v, 'bandpass', 700, 2); break;
    case 'done': tone('triangle', 660, 0, 0.18, 0.11); tone('triangle', 880, 0, 0.3, 0.11, null, t + 0.12); break;
    case 'train': tone('triangle', 520, 620, 0.12, 0.07); break;
    case 'click': tone('sine', 900, 700, 0.04, 0.04); break;
    case 'alert': for (let i = 0; i < 2; i++) { tone('sawtooth', 196, 0, 0.35, 0.07, null, t + i * 0.42); tone('sawtooth', 247, 0, 0.35, 0.05, null, t + i * 0.42); } break;
    case 'age': [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, 0, 0.35, 0.11, null, t + i * 0.14)); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.5, 0.13, null, t + i * 0.18)); break;
    case 'lose': [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, 0, 0.5, 0.11, null, t + i * 0.25)); break;
  }
}
// procedural background music: low drone + plucked pentatonic notes with echo
const SCALE = [146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392, 440];
function pluck(f, t, v) {
  const c = SND.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 1700;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(fl); fl.connect(g); g.connect(SND.musG); o.start(t); o.stop(t + 1);
}
setInterval(() => {
  if (!SND.ctx || SND.ctx.state !== 'running' || !SND.mus) return;
  const c = SND.ctx; if (SND.musT < c.currentTime) SND.musT = c.currentTime + 0.1;
  while (SND.musT < c.currentTime + 0.6) {
    const t = SND.musT, b = SND.step++;
    if (b % 16 === 0) { const root = [73.42, 65.41, 87.31, 73.42][(b / 16 | 0) % 4]; tone('sine', root, 0, 4.4, 0.2, SND.musG, t); tone('sine', root * 1.5, 0, 4.4, 0.1, SND.musG, t); }
    if (Math.random() < (b % 4 === 0 ? 0.8 : 0.4)) pluck(SCALE[(Math.random() * SCALE.length) | 0], t, 0.12);
    SND.musT += 0.3;
  }
}, 200);
document.querySelectorAll('.btnSnd').forEach(b => b.onclick = () => { sndInit(); SND.on = !SND.on; sndSet(); });
document.querySelectorAll('.btnMus').forEach(b => b.onclick = () => { sndInit(); SND.mus = !SND.mus; sndSet(); });
sndLabels();

let workT = 0;


// ===================== GAME CONTROLLER (lockstep) =====================
function startGame(o) {
  const sim = o.sim || newSim({ seed: o.seed, players: o.players, map: o.map || 'ova', size: o.size, res: o.res, pop: o.pop, mon: o.mon || 'az' });
  const humans = o.humans || [o.me];
  const delay = o.mode === 'mp' ? 4 : 1;
  G = {
    sim, me: o.me, mode: o.mode, humans, peerSlot: o.peerSlot || {}, gid: o.gid, delay,
    inputs: sim.players.map(() => new Map()), upTo: sim.players.map(() => sim.tick + delay - 1), exec: sim.players.map(() => sim.tick),
    pending: [], acc: 0, speed: 1, paused: false, last: performance.now(),
    lost: {}, reports: {}, dropAt: {}, hashes: new Map(), stallT: 0,
    sel: [], groups: {}, placing: null, ghost: null, rally: false, boxMode: false, box: null, bpage: 'eco',
    fx: [], marks: [], decals: [], pings: [], chatLog: [], unread: 0, pinging: false, z: IS_TOUCH ? 0.85 : 1, cam: { x: 0, y: 0 }, keys: {}, mouse: { x: 0, y: 0, in: false },
    vis: new Uint8Array(sim.W * sim.H), exp: new Uint8Array(sim.W * sim.H), endShown: false, revealAll: false,
  };
  buildGround(); fogCanvas(); mmInit();
  computeVis();
  const tc = sim.ents.find(e => e.k === 'b' && e.o === G.me && e.t === 'tc');
  resize();
  if (tc) centerOn(tc.x, tc.y);
  $('omSpeed').style.display = G.mode === 'sp' ? '' : 'none';
  $('ovEnd').classList.remove('on'); $('ovMenu').classList.remove('on');
  show('game');
  resize(); if (tc) centerOn(tc.x, tc.y);
  addMsg(`${CIVS[sim.players[G.me].civ].flag} ${CIVS[sim.players[G.me].civ].n} — ${COLOR_NAMES[G.me]} renktesin. Kaynak toplamaya başla!`);
  G.tut = o.tut ? { i: 0 } : null;
  if (o.exp) G.exp.set(o.exp);
  if (o.groups) G.groups = o.groups;
  chatSetup();
  if (o.tut) { const ai = sim.players[1].ai; ai.next = 1e9; }
  tutShow();
  hudSig = ''; requestAnimationFrame(frame);
  if (G.mode === 'mp') netPublish();
}
function quitGame() {
  if (G && G.mode === 'mp') leaveRoom();
  G = null; $('tut').style.display = 'none'; document.body.classList.remove('tutOn'); ['sbTC', 'sbArmy'].forEach(id => $(id).classList.remove('pulse')); show('menu');
}
function issue(cmd) { if (G && (G.sim.players[G.me].alive || cmd[0] === 'ch' || cmd[0] === 'qm')) G.pending.push(cmd); }

function tryTurn() {
  const s = G.sim, T = s.tick + 1;
  let dirty = false;
  while (G.upTo[G.me] < T + G.delay - 1) { const t = ++G.upTo[G.me]; G.inputs[G.me].set(t, G.pending.length ? G.pending.splice(0) : []); dirty = true; }
  if (G.mode === 'mp') {
    if (dirty) netPublish();
    checkDrops();
    const wait = [];
    for (const h of G.humans) { if (G.dropAt[h] != null && T > G.dropAt[h]) continue; if (G.upTo[h] < T) wait.push(h); }
    if (wait.length) { G.waitFor = wait; return false; }
  }
  G.waitFor = null;
  const cmds = [];
  for (const h of G.humans) {
    if (G.dropAt[h] != null && T > G.dropAt[h]) { if (T === G.dropAt[h] + 1) cmds.push([h, ['ai']]); continue; }
    const c = G.inputs[h].get(T); if (c) for (const x of c) cmds.push([h, x]);
  }
  step(s, cmds);
  G.exec[G.me] = s.tick;
  for (const f of s.fx) { f.t0 = performance.now(); if (f.k !== 'hit' && f.k !== 'done' && f.k !== 'train' && f.k !== 'stump' && f.k !== 'adie') G.fx.push(f); }
  fxSounds(s);
  for (const e of s.ev) { if (e.chat) chatIn(e.chat); else if (e.ping) pingIn(e.ping); else if (e.all || e.o === G.me) addMsg(e.m, e.alert); }
  if (G.mode === 'sp' && s.tick % 1800 === 0 && !s.over && !G.tut) autoSave();
  if (s.tick % 3 === 0) computeVis();
  if (G.mode === 'mp' && s.tick % 100 === 0) { G.hashes.set(s.tick, simHash(s)); if (G.hashes.size > 30) G.hashes.delete(G.hashes.keys().next().value); G.lastHash = [s.tick, G.hashes.get(s.tick)]; netPublish(); }
  if (G.mode === 'sp') { for (const [t] of G.inputs[G.me]) if (t <= s.tick) G.inputs[G.me].delete(t); }
  checkEnd();
  return true;
}
function advance(dt) {
  G.acc += dt * G.speed;
  let n = 0;
  if (G.mode === 'mp') { // catch up if others are ahead of us
    let mx = 0; for (const h of G.humans) if (h !== G.me && G.dropAt[h] == null) mx = Math.max(mx, G.exec[h]);
    if (mx - G.sim.tick > 2) G.acc += TURN_MS;
  }
  while (G.acc >= TURN_MS && n < 12) {
    if (!tryTurn()) { G.acc = Math.min(G.acc, TURN_MS); G.stallT += dt; break; }
    G.stallT = 0; G.acc -= TURN_MS; n++;
  }
  const w = $('wait');
  if (G.waitFor && G.stallT > 800) { w.style.display = 'block'; w.textContent = 'Bekleniyor: ' + G.waitFor.map(h => G.sim.players[h].name).join(', ') + ' …'; }
  else w.style.display = 'none';
}
function netPublish() {
  if (!NET.gr || !G || G.mode !== 'mp') return;
  let floor = G.sim.tick;
  for (const h of G.humans) if (G.lost[h] == null && G.dropAt[h] == null) floor = Math.min(floor, G.exec[h]);
  for (const h of G.humans) for (const t of G.inputs[h].keys()) if (t <= floor) G.inputs[h].delete(t);
  const build = (onlyMe) => {
    const up = {}, c = {};
    for (const h of G.humans) {
      if (onlyMe && h !== G.me) continue;
      up['s' + h] = G.upTo[h];
      const m = {}; let any = false;
      for (const [t, cm] of G.inputs[h]) if (t > floor && t <= G.upTo[h] && cm.length) { m['t' + t] = cm; any = true; }
      if (any) c['s' + h] = m;
    }
    const lost = {}; for (const k in G.lost) lost['s' + k] = G.lost[k];
    return { id: G.gid, sl: G.me, ex: G.sim.tick, up, c, lost, h: G.lastHash || null };
  };
  let gm = build(false);
  if (JSON.stringify(gm).length > 3300) gm = build(true);
  NET.gr.presence({ gm }).catch(() => {});
}
function netGamePeers(ch) {
  if (!G) return;
  for (const p of ch.left) {
    const sl = G.peerSlot[p.peer];
    if (sl != null && sl !== G.me && G.lost[sl] == null) { G.lost[sl] = G.upTo[sl]; addMsg(G.sim.players[sl].name + ' oyundan ayrıldı — yerini yapay zeka alacak', 1); netPublish(); }
  }
  for (const p of NET.gr.peers()) {
    if (p.isMe) continue;
    const gm = p.presence && p.presence.gm; if (!gm || gm.id !== G.gid) continue;
    const sl = G.peerSlot[p.peer]; if (sl == null || G.lost[sl] != null) continue;
    G.exec[sl] = Math.max(G.exec[sl], gm.ex | 0);
    if (gm.lost) { G.reports[sl] = gm.lost; if (gm.lost['s' + G.me] != null && !G.kicked) { G.kicked = true; addMsg('Bağlantın koptu, diğer oyuncular devam ediyor.', 1); } }
    const up = gm.up || {}, c = gm.c || {};
    for (const key in up) {
      const s = +key.slice(1); if (!(s >= 0) || s === G.me || G.humans.indexOf(s) < 0) continue;
      const u = up[key] | 0; if (u <= G.upTo[s]) continue;
      const m = c[key] || {};
      for (let t = G.upTo[s] + 1; t <= u; t++) G.inputs[s].set(t, Array.isArray(m['t' + t]) ? m['t' + t] : []);
      G.upTo[s] = u;
    }
    if (Array.isArray(gm.h) && G.hashes.has(gm.h[0]) && G.hashes.get(gm.h[0]) !== gm.h[1] && !G.desync) { G.desync = true; addMsg('Uyarı: oyuncular arasında senkron farkı oluştu.', 1); }
  }
}
function checkDrops() {
  for (const k in G.lost) {
    const s = +k; if (G.dropAt[s] != null) continue;
    let D = -1, ok = true;
    for (const h of G.humans) {
      if (G.lost[h] != null) continue;
      const v = h === G.me ? G.lost[s] : (G.reports[h] ? G.reports[h]['s' + s] : undefined);
      if (v == null) { ok = false; break; } D = Math.max(D, v | 0);
    }
    if (ok) G.dropAt[s] = D;
  }
}
function checkEnd() {
  const s = G.sim, p = s.players[G.me];
  if (G.endShown) return;
  if (s.over || !p.alive) {
    G.endShown = true; G.revealAll = true;
    const win = s.over && (s.winner === G.me || (p.team && s.winTeam === p.team));
    sfx(win ? 'win' : 'lose');
    $('endT').textContent = win ? '🏆 Zafer!' : (p.alive ? 'Oyun bitti' : '💀 Yenildin');
    $('endB').innerHTML = `<table class="res-t"><tr><th>Oyuncu</th><th>Öldürdü</th><th>Kaybetti</th><th>Topladı</th></tr>${s.players.map(q => `<tr><td><span style="color:${q.color}">●</span> ${esc(q.name)} ${CIVS[q.civ].flag}</td><td>${q.stats.kills}</td><td>${q.stats.lost}</td><td>${q.stats.gathered}</td></tr>`).join('')}</table>`;
    $('endWatch').style.display = s.over ? 'none' : '';
    $('ovEnd').classList.add('on');
  }
}

// ===================== RENDER =====================
const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false });
let DPR = 1, VW = 0, VH = 0;
// graphics quality: auto lowers resolution, then effects, when frames get slow
const Q = { mode: store.get('gfx', 'auto'), lite: false, dprCap: 2, ema: 16, n: 0 };
function gfxApply() { if (Q.mode === 'high') { Q.dprCap = 2; Q.lite = false; } else if (Q.mode === 'low') { Q.dprCap = 1; Q.lite = true; } else { Q.dprCap = 2; Q.lite = false; } Q.ema = 16; Q.n = 0; if (G) resize(); $('omGfx').textContent = 'Grafik: ' + { auto: 'Otomatik', high: 'Yüksek', low: 'Düşük' }[Q.mode]; }
function gfxAuto(dt) {
  if (Q.mode !== 'auto' || G.paused) return;
  Q.ema = Q.ema * 0.95 + Math.min(100, dt) * 0.05;
  if (++Q.n % 120 !== 0) return;
  if (Q.ema > 25) { if (Q.dprCap > 1 && (window.devicePixelRatio || 1) > 1) { Q.dprCap = 1; resize(); } else Q.lite = true; Q.ema = 16; }
}
function resize() {
  DPR = Math.min(Q.dprCap, window.devicePixelRatio || 1);
  VW = cv.clientWidth || innerWidth; VH = cv.clientHeight || innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const m = $('mini'); const ms = m.clientWidth || 170; m.width = ms * DPR; m.height = ms * DPR;
}
addEventListener('resize', () => { if (G) resize(); });




const GROUND_COLS = [[92, 122, 52], [86, 116, 47], [98, 128, 57], [80, 108, 43]];
let groundCv = null;
// ===================== TINY SWORDS ART (Pixel Frog) + hand-drawn extras =====================
const ART = { ok: false, img: {}, M: ART_META };
(function loadArt() {
  const files = { c0: 'assets/units_0.png', c1: 'assets/units_1.png', c2: 'assets/units_2.png', c3: 'assets/units_3.png', common: 'assets/common.png', terrain: 'assets/terrain.png' };
  let left = Object.keys(files).length, failed = false;
  for (const k in files) {
    const im = new Image();
    im.onload = () => { if (--left === 0 && !failed) { ART.ok = true; SPR.clear(); if (G) { buildGround(); } } };
    im.onerror = () => { failed = true; };
    im.src = files[k]; ART.img[k] = im;
  }
})();
const OUTL = '#262335';
function aFrame(c, img, a, i, x, y, flip, sc) {
  i = ((i % a.n) + a.n) % a.n;
  const sx = a.x + i * (a.w + 2);
  if (flip) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(img, sx, a.y, a.w, a.h, -a.ax * sc, -a.ay * sc, a.w * sc, a.h * sc); c.restore(); }
  else c.drawImage(img, sx, a.y, a.w, a.h, x - a.ax * sc, y - a.ay * sc, a.w * sc, a.h * sc);
}
const ART_UNIT = { koylu: ['pawn', 0.5], kilicli: ['warrior', 0.5], kalkanli: ['warrior', 0.56], dagdevi: ['warrior', 0.7], mizrakci: ['lancer', 0.5], okcu: ['archer', 0.5], golgeokcu: ['archer', 0.56] };
const UNIT_H = { ork: 36, orkreis: 44, balcik: 20, devbalcik: 34, koylu: 34, kilicli: 40, kalkanli: 44, dagdevi: 48, mizrakci: 40, okcu: 40, golgeokcu: 44, atli: 44, zirhli: 46, kurtatli: 44, koc: 34, mancinik: 38 };
function pawnAnim(u, moving, tick) {
  const res = { w: 'Wood', g: 'Gold', s: 'Gold', f: 'Meat' }[u.ck] || '';
  const tool = u.st === 'build' ? 'Hammer' : u.st === 'attack' ? 'Knife' : (u.st === 'gather' || u.st === 'return') ? ({ w: 'Axe', g: 'Pick', s: 'Pick', f: 'Knife' }[u.gk] || '') : '';
  if (u.work != null && tick - u.work <= 1 && tool) return 'work' + tool;
  if (u.st === 'attack' && u.atkT && tick - u.atkT < 6) return 'workKnife';
  const carrying = u.carry > 0 && u.st === 'return';
  if (moving) return carrying && res ? 'run' + res : tool ? 'run' + tool : 'run';
  return u.carry > 0 && res ? 'idle' + res : 'idle';
}
function ownerCol(o) { return o === GAIA ? '#5d8a34' : G.sim.players[o] ? G.sim.players[o].color : '#888'; }
// extra character packs: Free Characters (shield soldier, slime) and Tiny RPG (soldier, orc)
const ART_X = { kalkanli: ['shield', 0.8], golgeokcu: ['shadow', 0.7], dagdevi: ['giant', 1.05] };
const ART_MON = { ork: ['orc', 0.8], orkreis: ['orcChief', 1.0], balcik: ['slime', 0.62], devbalcik: ['slime', 1.05] };
function artSet(u) {
  const m = ART_MON[u.t]; if (m && ART.M.common[m[0]]) return { M: ART.M.common[m[0]], img: ART.img.common, sc: m[1] };
  const x = ART_X[u.t], ci = u.o >= 0 ? u.o : 0; if (x && ART.M['c' + ci][x[0]]) return { M: ART.M['c' + ci][x[0]], img: ART.img['c' + ci], sc: x[1] };
  return null;
}
function drawXArt(c, u, x, y, A, now, f) {
  const M = A.M, tick = G.sim.tick, moving = Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 0.05, id = u.id || 0;
  const since = u.atkT ? (tick - u.atkT) * 100 + (G.acc || 0) : 1e9;
  const atkA = M.atk2 && u.atkT % 2 ? M.atk2 : M.atk, fd = u.t === 'golgeokcu' ? 60 : 75;
  let a, fr;
  if (since < atkA.n * fd) { a = atkA; fr = Math.floor(since / fd); }
  else if (moving) { a = M.run; fr = Math.floor(now / 95) + id; }
  else { a = u.t === 'kalkanli' && u.st === 'attack' && M.guard ? M.guard : M.idle; fr = Math.floor(now / 130) + id * 2; }
  aFrame(c, A.img, a, fr, x, y, f < 0, A.sc);
}
function drawUnitArt(c, u, x, y, colIdx, now, f, flat) {
  const xa = artSet(u); if (xa) { drawXArt(c, u, x, y, xa, now, f); return; }
  const map = ART_UNIT[u.t];
  if (!map) { drawUnitHD(c, u, x, y, G.sim.players[u.o] ? G.sim.players[u.o].color : '#888', now, f, flat); return; }
  const [kind, sc] = map, M = ART.M['c' + colIdx][kind], img = ART.img['c' + colIdx];
  const tick = G.sim.tick, moving = Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 0.05;
  const id = u.id || 0;
  let a, fr;
  if (kind === 'pawn') { const k = pawnAnim(u, moving, tick); a = M[k] || M.idle; fr = Math.floor(now / (k.startsWith('work') ? 95 : 90)) + id * 3; }
  else {
    const since = u.atkT ? (tick - u.atkT) * 100 + (G.acc || 0) : 1e9;
    const atkA = kind === 'warrior' ? (u.atkT % 2 ? M.atk2 : M.atk) : M.atk;
    const fd = kind === 'archer' ? 55 : 75;
    if (since < atkA.n * fd) { a = atkA; fr = Math.floor(since / fd); }
    else if (moving) { a = M.run; fr = Math.floor(now / 85) + id; }
    else { a = u.t === 'kalkanli' && M.guard ? M.guard : M.idle; fr = Math.floor(now / 120) + id * 2; }
  }
  aFrame(c, img, a, fr, x, y, f < 0, sc);
  if (u.t === 'golgeokcu') { c.fillStyle = '#1f3d22'; c.beginPath(); c.moveTo(x - 7 * f, y - 26); c.lineTo(x - 2 * f, y - 34); c.lineTo(x + 4 * f, y - 27); c.fill(); }
  if (false) { c.fillStyle = '#f2c84b'; c.beginPath(); c.arc(x + 9 * f, y - UNIT_H[u.t] + 4, 2.4, 0, TAU); c.fill(); }
}
// ---------- hand-drawn (HD) cavalry, siege and boar in a matching chunky outlined style ----------
function oFill(c, col) { c.fillStyle = col; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUTL; c.stroke(); }
function oEll(c, x, y, rx, ry, rot, col) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); oFill(c, col); }
function drawUnitHD(c, u, x, y, col, now, f, flat) {
  const st = UT[u.t], cls = st.cls, tick = G.sim.tick;
  const moving = Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 0.05;
  const since = u.atkT ? (tick - u.atkT) * 100 + (G.acc || 0) : 1e9;
  if (!flat) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 1, cls === 'siege' ? 17 : 15, 5, 0, 0, TAU); c.fill(); }
  c.save(); c.translate(x, y); if (f < 0) c.scale(-1, 1); c.scale(1.15, 1.15);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (cls === 'cav') {
    const horse = u.t === 'kurtatli' ? '#8d8a86' : u.t === 'zirhli' ? '#5a3e2b' : '#8a5a34', dark = shade(horse, -0.3);
    const ph = moving ? now / 75 + (u.id || 0) : 0, g = moving ? 1 : 0;
    // legs (gallop)
    const legs = [[-8, 0], [-4, 1.6], [6, 0.8], [10, 2.4]];
    c.lineWidth = 3.4; c.strokeStyle = OUTL;
    for (const [lx, p] of legs) { const sw = Math.sin(ph + p) * 4 * g; c.beginPath(); c.moveTo(lx, -9); c.lineTo(lx + sw, -1); c.stroke(); }
    c.lineWidth = 2; c.strokeStyle = dark;
    for (const [lx, p] of legs) { const sw = Math.sin(ph + p) * 4 * g; c.beginPath(); c.moveTo(lx, -9); c.lineTo(lx + sw, -1.5); c.stroke(); }
    // tail
    c.beginPath(); c.moveTo(-12, -14); c.quadraticCurveTo(-19, -12 + Math.sin(ph) * 2, -17, -4); c.lineWidth = 3.5; c.strokeStyle = OUTL; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#2b1d14'; c.stroke();
    // body + neck + head
    const bob = moving ? Math.sin(ph * 2) * 1.2 : Math.sin(now / 400 + (u.id || 0)) * 0.4;
    c.save(); c.translate(0, bob);
    oEll(c, 0, -14, 13, 6.5, 0, horse);
    c.beginPath(); c.moveTo(7, -17); c.lineTo(13, -27); c.lineTo(17, -25); c.lineTo(12, -13); c.closePath(); oFill(c, horse);
    oEll(c, 16, -26, 5.5, 3.6, 0.35, horse);
    c.fillStyle = '#2b1d14'; c.beginPath(); c.moveTo(9, -18); c.lineTo(12, -28); c.lineTo(10, -28); c.lineTo(7, -18); c.fill();
    c.fillStyle = OUTL; c.beginPath(); c.arc(17, -27, 0.9, 0, TAU); c.fill();
    if (u.t === 'zirhli') { c.beginPath(); c.moveTo(-11, -18); c.lineTo(9, -18); c.lineTo(10, -9); c.lineTo(-12, -9); c.closePath(); oFill(c, col); c.fillStyle = '#e8d38a'; c.fillRect(-11, -11, 21, 1.5); }
    else { c.beginPath(); c.moveTo(-6, -20); c.lineTo(5, -20); c.lineTo(5, -12); c.lineTo(-6, -12); c.closePath(); oFill(c, col); }
    // rider
    const lunge = since < 300 ? Math.sin(since / 300 * Math.PI) * 4 : 0;
    c.translate(lunge * 0.3, 0);
    oEll(c, -1, -27, 5.5, 6.5, 0, col);
    oEll(c, 0, -36, 4.6, 4.6, 0, '#efc39a');
    if (u.t === 'kurtatli') { c.beginPath(); c.arc(0, -37.5, 5.2, Math.PI, 0); c.lineTo(5, -36); c.lineTo(-5, -36); c.closePath(); oFill(c, '#7d7a74'); c.fillStyle = '#efe9dd'; c.fillRect(-4, -40, 2, 2); c.fillRect(2, -40, 2, 2); }
    else { c.beginPath(); c.arc(0, -37, 5, Math.PI, 0); c.closePath(); oFill(c, u.t === 'zirhli' ? '#c9ccd2' : shade(col, -0.25)); if (u.t === 'zirhli') { c.fillStyle = '#e44'; c.fillRect(-1, -45, 2, 4); } }
    if (u.t === 'kurtatli') { c.lineWidth = 2; c.strokeStyle = '#6b3f1f'; c.beginPath(); c.arc(6, -28, 7, -1.2, 1.2); c.stroke(); c.lineWidth = 0.8; c.strokeStyle = '#eee'; c.beginPath(); c.moveTo(6 + Math.cos(-1.2) * 7 - lunge, -28 + Math.sin(-1.2) * 7); c.lineTo(6 + Math.cos(1.2) * 7 - lunge, -28 + Math.sin(1.2) * 7); c.stroke(); }
    else if (u.t === 'zirhli') { c.lineWidth = 3.2; c.strokeStyle = OUTL; c.beginPath(); c.moveTo(-4, -26); c.lineTo(22 + lunge, -33); c.stroke(); c.lineWidth = 1.8; c.strokeStyle = '#d9dde4'; c.stroke(); }
    else { c.lineWidth = 3.2; c.strokeStyle = OUTL; c.beginPath(); c.moveTo(4, -27); c.lineTo(13 + lunge, -35 + lunge); c.stroke(); c.lineWidth = 1.8; c.strokeStyle = '#e5e8ee'; c.stroke(); }
    c.restore();
  } else if (u.t === 'koc') {
    const ph = moving ? now / 140 : 0, hit = since < 400 ? Math.sin(since / 400 * Math.PI) * 6 : 0;
    for (const wx of [-10, 9]) { oEll(c, wx, -4, 5, 5, 0, '#5a3d22'); c.strokeStyle = '#b08a5a'; c.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const a = ph + k * 2.09; c.beginPath(); c.moveTo(wx, -4); c.lineTo(wx + Math.cos(a) * 4, -4 + Math.sin(a) * 4); c.stroke(); } }
    c.beginPath(); c.moveTo(-15, -6); c.lineTo(15, -6); c.lineTo(15, -18); c.lineTo(-15, -18); c.closePath(); oFill(c, '#8a5f35');
    c.beginPath(); c.moveTo(-17, -17); c.lineTo(0, -30); c.lineTo(17, -17); c.closePath(); oFill(c, shade(col, -0.15));
    c.strokeStyle = shade(col, -0.45); c.lineWidth = 1; for (let k = -12; k <= 12; k += 6) { c.beginPath(); c.moveTo(k, -18 + Math.abs(k) * 0.05); c.lineTo(k * 0.4, -27); c.stroke(); }
    c.beginPath(); c.rect(8 + hit, -14, 14, 5); oFill(c, '#6b4626'); oEll(c, 23 + hit, -11.5, 3.6, 3.6, 0, '#8e939b');
  } else if (u.t === 'mancinik') {
    for (const wx of [-10, 10]) oEll(c, wx, -4, 4.5, 4.5, 0, '#5a3d22');
    c.beginPath(); c.rect(-14, -11, 28, 6); oFill(c, '#8a5f35'); c.fillStyle = col; c.fillRect(-13, -9, 26, 2);
    c.beginPath(); c.moveTo(-6, -11); c.lineTo(0, -24); c.lineTo(6, -11); c.lineWidth = 3.5; c.strokeStyle = OUTL; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#6b4626'; c.stroke();
    const k = since < 500 ? Math.min(1, since / 180) : 0, a = -2.3 + k * 1.9;
    c.save(); c.translate(0, -22); c.rotate(a + Math.PI / 2);
    c.beginPath(); c.rect(-2, -22, 4, 26); oFill(c, '#7a5230');
    oEll(c, 0, -23, 4.5, 3, 0, '#5a3d22'); if (k < 0.5) oEll(c, 0, -25, 3, 3, 0, '#8e939b');
    c.restore();
  }
  c.restore();
}
function drawBoar(c, a, x, y, now) {
  if (!a.live) { oEll(c, x, y - 3, 11, 4.5, 0.1, '#4a3a30'); c.fillStyle = '#9b3a2e'; c.beginPath(); c.ellipse(x - 2, y - 4, 4.5, 2, 0.1, 0, TAU); c.fill(); return; }
  const moving = Math.abs(a.x - a.px) + Math.abs(a.y - a.py) > 0.05;
  const f = ISO ? (a._fv || 1) : a.face, ph = moving ? now / 60 + a.id : 0;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 1, 13, 4, 0, 0, TAU); c.fill();
  c.save(); c.translate(x, y); if (f < 0) c.scale(-1, 1); c.lineJoin = 'round'; c.lineCap = 'round';
  c.lineWidth = 3.2; c.strokeStyle = OUTL; for (const [lx, p] of [[-7, 0], [-3, 1.5], [5, 0.7], [8, 2.2]]) { c.beginPath(); c.moveTo(lx, -6); c.lineTo(lx + (moving ? Math.sin(ph + p) * 3 : 0), 0); c.stroke(); }
  oEll(c, 0, -10, 12, 7, 0, '#5a463a');
  c.beginPath(); c.moveTo(8, -15); c.lineTo(17, -9); c.lineTo(16, -5); c.lineTo(8, -5); c.closePath(); oFill(c, '#4a3a30');
  c.fillStyle = '#2b201a'; for (let i = -8; i <= 6; i += 3) c.fillRect(i, -18, 1.6, 3);
  c.lineWidth = 1.6; c.strokeStyle = '#f1ead8'; c.beginPath(); c.moveTo(14, -7); c.quadraticCurveTo(17, -10, 15, -13); c.stroke();
  c.fillStyle = a.tgt ? '#ff4040' : '#111'; c.beginPath(); c.arc(12, -11, 1.1, 0, TAU); c.fill();
  c.restore();
  if (a.tgt) { c.fillStyle = '#ff5050'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('!', x, y - 24); }
}
function drawSheep(c, a, x, y, now) {
  const C = ART.M.common, img = ART.img.common;
  if (!a.live) { aFrame(c, img, C.meat, 0, x, y, false, 0.55); return; }
  const moving = Math.abs(a.x - a.px) + Math.abs(a.y - a.py) > 0.05;
  if (moving) a._fv = (ISO ? ((a.x - a.px) - (a.y - a.py)) : (a.x - a.px)) < 0 ? -1 : 1;
  const flip = (a._fv || 1) < 0;
  if (moving) aFrame(c, img, C.sheepMove, Math.floor(now / 110) + a.id, x, y, flip, 0.45);
  else { const g = (Math.floor(now / 3000) + a.id) % 3 === 0; aFrame(c, img, g ? C.sheepGrass : C.sheepIdle, Math.floor(now / 140) + a.id, x, y, flip, 0.45); }
}
function drawResArt(c, e, vx, vy, now) {
  const C = ART.M.common, img = ART.img.common;
  if (e.t === 'tree') { const tr = C.trees[e.v % 4], sc = e.v < 2 ? 0.29 : 0.34; aFrame(c, img, tr, Math.floor(now / 160) + e.id * 5, vx, vy + 8, (e.id % 2) === 1, sc); return; }
  if (e.t === 'gold' || e.t === 'stone') {
    const arr = C[e.t], frac = e.amt / RES_AMT[e.t], idx = Math.max(0, Math.min(5, Math.ceil(frac * 4) + 1 + (e.v % 2) - 1));
    aFrame(c, img, arr[idx], 0, vx, vy + 6, e.v > 1, 0.42); return;
  }
  drawRes(c, e, vx, vy, true);
}
// buildings: Tiny Swords sprites for the ones the pack has, composed variants for the rest
const BLD_ART = { tc: ['Monastery', 1.0], kale: ['Castle', 1.12], kisla: ['Barracks', 1.08], menzil: ['Archery', 1.08], kule: ['Tower', 1.05], ev: ['House', 1.05],
  depo: ['House3', 1.1], degirmen: ['House2', 1.1], ahir: ['House3', 1.0], demirci: ['House2', 0.95], atolye: ['House1', 0.95] };
const BLD_SIGN = { depo: '📦', degirmen: '🌾', ahir: '🐴', demirci: '⚒️', atolye: '⚙️' };
function bldSprite(e) {
  const m = BLD_ART[e.t]; if (!m) return null;
  let name = m[0]; if (name === 'House') name = 'House' + (1 + e.id % 3);
  return { spr: ART.M['c' + e.o]['b_' + name], img: ART.img['c' + e.o], k: m[1] };
}
function drawBldArt(c, e, now) {
  const b = bldSprite(e); if (!b) return false;
  const S = e.sz * TILE, sc = S * b.k / b.spr.w, w = b.spr.w * sc, h = b.spr.h * sc;
  let bx, by; // bottom-centre of the sprite
  if (ISO) { bx = e._vx; by = e._vy + e.sz * 16 * 0.75; } else { bx = e.x; by = (e.ty + e.sz) * TILE + 4; }
  const P = G.sim.players[e.o];
  if (!e.built) {
    const prog = e.prog / (bStat(P, e.t).t * TPS);
    c.fillStyle = 'rgba(70,50,25,.55)'; c.fillRect(bx - w * 0.45, by - 10, w * 0.9, 10);
    const ph = Math.max(0.06, prog), sh = b.spr.h * ph;
    c.globalAlpha = 0.55 + 0.45 * prog;
    c.drawImage(b.img, b.spr.x, b.spr.y + b.spr.h - sh, b.spr.w, sh, bx - w / 2, by - h * ph, w, h * ph);
    c.globalAlpha = 1;
    c.strokeStyle = '#6b4626'; c.lineWidth = 2;
    for (const k of [-0.42, 0, 0.42]) { c.beginPath(); c.moveTo(bx + w * k, by); c.lineTo(bx + w * k, by - h * Math.min(1, ph + 0.25)); c.stroke(); }
    c.beginPath(); c.moveTo(bx - w * 0.45, by - h * ph); c.lineTo(bx + w * 0.45, by - h * ph); c.stroke();
    c.fillStyle = '#000a'; c.fillRect(bx - S * 0.4, by - h - 10, S * 0.8, 5); c.fillStyle = '#e8c35a'; c.fillRect(bx - S * 0.4, by - h - 10, S * 0.8 * prog, 5);
    return true;
  }
  c.drawImage(b.img, b.spr.x, b.spr.y, b.spr.w, b.spr.h, bx - w / 2, by - h, w, h);
  // composed details
  if (e.t === 'degirmen') {
    const a = Q.lite ? 0.4 : now / 900 + e.id, cx = bx + w * 0.02, cy = by - h * 0.78;
    for (let i = 0; i < 4; i++) { const ang = a + i * Math.PI / 2; c.save(); c.translate(cx, cy); c.rotate(ang); c.fillStyle = '#efe4c8'; c.strokeStyle = OUTL; c.lineWidth = 1.2; c.beginPath(); c.rect(2, -2.5, 20, 5); c.fill(); c.stroke(); c.restore(); }
    oEll(c, cx, cy, 2.8, 2.8, 0, '#5a3d22');
  } else if (e.t === 'depo') {
    const C = ART.M.common; aFrame(c, ART.img.common, C.wood, 0, bx - w * 0.42, by - 2, false, 0.45); aFrame(c, ART.img.common, C.gold[1], 0, bx + w * 0.42, by + 2, false, 0.32);
  } else if (e.t === 'demirci') {
    c.beginPath(); c.rect(bx + w * 0.18, by - h * 0.98, 7, 14); oFill(c, '#7a7570');
    if (!Q.lite) for (let i = 0; i < 3; i++) { const ph = (now / 1600 + i / 3 + e.id * 0.1) % 1; c.globalAlpha = (1 - ph) * 0.5; circ(c, bx + w * 0.18 + 3.5 + ph * 6, by - h * 0.98 - ph * 26, 3 + ph * 6, '#9a958e'); }
    c.globalAlpha = 1;
    c.beginPath(); c.rect(bx - w * 0.5, by - 10, 13, 6); oFill(c, '#4f4c49');
  } else if (e.t === 'ahir') {
    c.strokeStyle = '#7a5230'; c.lineWidth = 2; for (const k of [-0.5, -0.3, 0.3, 0.5]) { c.beginPath(); c.moveTo(bx + w * k, by + 2); c.lineTo(bx + w * k, by - 9); c.stroke(); }
    c.beginPath(); c.moveTo(bx - w * 0.5, by - 6); c.lineTo(bx - w * 0.3, by - 6); c.moveTo(bx + w * 0.3, by - 6); c.lineTo(bx + w * 0.5, by - 6); c.stroke();
    oEll(c, bx - w * 0.38, by - 3, 6, 4, 0, '#e2c25a');
  } else if (e.t === 'atolye') {
    for (const k of [-0.42, 0.42]) { oEll(c, bx + w * k, by - 5, 6, 6, 0, '#5a3d22'); c.strokeStyle = '#b08a5a'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx + w * k - 5, by - 5); c.lineTo(bx + w * k + 5, by - 5); c.moveTo(bx + w * k, by - 10); c.lineTo(bx + w * k, by); c.stroke(); }
  }
  const sign = BLD_SIGN[e.t];
  if (sign) { const sx = bx + w * 0.36, sy = by - h * 0.32; c.fillStyle = '#7a5230'; c.fillRect(sx - 1, sy, 2, 10); c.beginPath(); c.rect(sx - 9, sy - 9, 18, 13); oFill(c, '#c9a36a'); c.font = '10px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sign, sx, sy - 2.5); }
  // fire on badly damaged buildings
  const fr = e.hp / e.maxhp;
  if (fr < 0.5) {
    const C = ART.M.common, n = fr < 0.25 ? 3 : 2;
    for (let i = 0; i < n; i++) { const px = bx + w * (-0.25 + i * 0.25), py = by - h * (0.35 + (i % 2) * 0.25); aFrame(c, ART.img.common, C.fire[i % 3], Math.floor(now / 90) + i * 3 + e.id, px, py, false, 0.7); }
  }
  if (e.gl && e.gl.length && allied(e.o)) { c.fillStyle = '#000b'; c.fillRect(bx - w / 2, by - 18, 30, 16); c.fillStyle = '#fff'; c.font = 'bold 11px Inter,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('🛡' + e.gl.length, bx - w / 2 + 3, by - 10); }
  if (e.q.length && e.o === G.me) { const it = e.q[0]; c.fillStyle = '#000a'; c.fillRect(bx - S * 0.45, by + 2, S * 0.9, 4); c.fillStyle = '#7fd36b'; c.fillRect(bx - S * 0.45, by + 2, S * 0.9 * (1 - it.left / it.tot), 4); }
  e._top = by - h;
  return true;
}
// ---------- ground from the Tiny Swords tileset (auto-tiled shores, hills and cliffs) ----------
function buildGroundArt() {
  const s = G.sim, W = s.W, H = s.H, P = W * 32 <= 2600 ? 32 : 24, img = ART.img.terrain;
  const c = document.createElement('canvas'); c.width = W * P; c.height = H * P;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = ART.M.water; g.fillRect(0, 0, c.width, c.height);
  const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : s.terr[y * W + x];
  const Hh = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : (s.terr[y * W + x] === 1 ? -1 : s.hgt[y * W + x]);
  const tile = (sx, sy, x, y) => g.drawImage(img, sx, sy, 64, 64, x * P, y * P, P, P);
  const pick = (n, s2, w, e) => [w && e ? 3 : w ? 0 : e ? 2 : 1, n && s2 ? 3 : n ? 0 : s2 ? 2 : 1];
  const rng = mulberry32(s.seed + 5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tr = s.terr[y * W + x];
    if (tr === 1) continue;
    if (tr === 2) { // shallow ford
      g.fillStyle = '#7fc0b4'; g.fillRect(x * P, y * P, P, P);
      for (let k = 0; k < 4; k++) { g.fillStyle = rng() < 0.5 ? '#a9a48a' : '#c4be9f'; g.fillRect(x * P + ((rng() * (P - 6)) | 0), y * P + ((rng() * (P - 5)) | 0), 5, 3); }
      continue;
    }
    const w = (dx, dy) => T(x + dx, y + dy) === 1;
    const [cx, cy] = pick(w(0, -1), w(0, 1), w(-1, 0), w(1, 0));
    tile(cx * 64, cy * 64, x, y);
  }
  // hills: elevated grass with cliffs on the lower (south) side
  for (let lv = 1; lv <= 2; lv++) {
    const oy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = Hh(x, y);
      if (h >= lv) {
        const lo = (dx, dy) => Hh(x + dx, y + dy) < lv;
        const [cx, cy] = pick(lo(0, -1), lo(0, 1), lo(-1, 0), lo(1, 0));
        tile(320 + cx * 64, oy + cy * 64, x, y);
      } else if (Hh(x, y - 1) >= lv && T(x, y) !== 1) {
        const lo = (dx) => Hh(x + dx, y - 1) < lv;
        const cx = lo(-1) && lo(1) ? 3 : lo(-1) ? 0 : lo(1) ? 2 : 1;
        tile(320 + cx * 64, oy + 256, x, y);
      }
    }
  }
  groundCv = c;
}

// ===================== VIEW: top-down or isometric =====================
let ISO = store.get('view', 'top') === 'iso';
function w2v(x, y) { return ISO ? [x - y, (x + y) / 2] : [x, y]; }
function v2w(vx, vy) { return ISO ? [vy + vx / 2, vy - vx / 2] : [vx, vy]; }
function flatT(c) { if (ISO) c.transform(1, 0.5, -1, 0.5, 0, 0); }
function clampCam() {
  const s = G.sim, ww = s.W * TILE, hh = s.H * TILE, vw = VW / G.z, vh = VH / G.z;
  const b = ISO ? [-hh, ww, 0, (ww + hh) / 2] : [0, ww, 0, hh];
  G.cam.x = Math.max(b[0] - vw * 0.3, Math.min(b[1] - vw * 0.7, G.cam.x));
  G.cam.y = Math.max(b[2] - vh * 0.2, Math.min(b[3] - vh * 0.6, G.cam.y));
}
function centerOn(x, y) { const [vx, vy] = w2v(x, y); G.cam.x = vx - VW / G.z / 2; G.cam.y = vy - (VH - 120) / G.z / 2; clampCam(); }
function toWorld(sx, sy) { return v2w(G.cam.x + sx / G.z, G.cam.y + sy / G.z); }
function toScreen(x, y) { const [vx, vy] = w2v(x, y); return [(vx - G.cam.x) * G.z, (vy - G.cam.y) * G.z]; }
function setView(iso) {
  if (!G) { ISO = iso; store.set('view', iso ? 'iso' : 'top'); return; }
  const [wx, wy] = toWorld(VW / 2, (VH - 120) / 2);
  ISO = iso; store.set('view', iso ? 'iso' : 'top'); centerOn(wx, wy); hudSig = '';
}
const ISO_H = { tc: [30, 24], ev: [14, 16], degirmen: [18, 14], depo: [12, 10], kisla: [22, 18], menzil: [20, 18], ahir: [18, 18], demirci: [22, 14], atolye: [22, 16], kule: [64, 22], kale: [40, 0] };
function isoHt(t) { const h = ISO_H[t] || [16, 0]; return h[0] + h[1]; }

function buildGround() {
  if (ART.ok) { buildGroundArt(); return; }
  const s = G.sim, P = 16, W = s.W, c = document.createElement('canvas'); c.width = s.W * P; c.height = s.H * P;
  const g = c.getContext('2d'), rng = mulberry32(s.seed + 99);
  const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= s.H) ? 0 : s.terr[y * W + x];
  const Hh = (x, y) => (x < 0 || y < 0 || x >= W || y >= s.H) ? 0 : s.hgt[y * W + x];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, tr = s.terr[i], h = s.hgt[i];
    if (tr === 1) {
      let land = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(x + dx, y + dy) !== 1) land++;
      const k = Math.min(1, land / 4), r = 40 + 40 * k, gg = 102 + 46 * k, b = 150 + 22 * k;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(x * P, y * P, P, P);
      for (let q = 0; q < 3; q++) { g.fillStyle = 'rgba(200,230,255,.35)'; g.fillRect(x * P + ((rng() * 12) | 0), y * P + ((rng() * 14) | 0), 4, 1); }
      continue;
    }
    if (tr === 2) {
      g.fillStyle = '#7fa59a'; g.fillRect(x * P, y * P, P, P);
      for (let q = 0; q < 4; q++) { g.fillStyle = rng() < 0.5 ? '#9c9a86' : '#b6b39c'; g.fillRect(x * P + ((rng() * 13) | 0), y * P + ((rng() * 13) | 0), 3, 2); }
      continue;
    }
    let [r, gg, b] = GROUND_COLS[s.ground[i]];
    let dirt = 0; for (const [sx, sy] of s.starts) { const dx = x - sx, dy = y - sy, d = dx * dx + dy * dy; if (d < 40) dirt = Math.max(dirt, 1 - d / 40); }
    r = r + (150 - r) * dirt * 0.55; gg = gg + (124 - gg) * dirt * 0.55; b = b + (78 - b) * dirt * 0.55;
    let shore = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(x + dx, y + dy) === 1) shore = 1;
    if (shore) { r = r + (196 - r) * 0.6; gg = gg + (178 - gg) * 0.6; b = b + (116 - b) * 0.6; }
    r += h * 16; gg += h * 14; b += h * 4;
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(x * P, y * P, P, P);
    for (let k = 0; k < 5; k++) { const v = rng() < 0.5 ? -14 : 12; g.fillStyle = `rgb(${(r + v) | 0},${(gg + v) | 0},${(b + v * 0.6) | 0})`; g.fillRect(x * P + ((rng() * 14) | 0), y * P + ((rng() * 14) | 0), 2, 2); }
    if (rng() < 0.04 && !dirt && !shore) { g.fillStyle = ['#d9d26a', '#e6e6e6', '#c98bd6'][(rng() * 3) | 0]; g.fillRect(x * P + 6, y * P + 6, 2, 2); }
    // hill slopes: dark edge on the lower south/east side, light on the north/west
    g.fillStyle = 'rgba(40,30,10,.35)';
    if (h > Hh(x, y + 1)) g.fillRect(x * P, y * P + P - 4, P, 4);
    if (h > Hh(x + 1, y)) g.fillRect(x * P + P - 4, y * P, 4, P);
    g.fillStyle = 'rgba(255,250,210,.25)';
    if (h > Hh(x, y - 1)) g.fillRect(x * P, y * P, P, 3);
    if (h > Hh(x - 1, y)) g.fillRect(x * P, y * P, 3, P);
  }
  groundCv = c;
}
let fogCv = null, fogImg = null;
function fogCanvas() { const s = G.sim; fogCv = document.createElement('canvas'); fogCv.width = s.W; fogCv.height = s.H; fogImg = fogCv.getContext('2d').createImageData(s.W, s.H); }
function allied(o) { if (o < 0) return false; const p = G.sim.players[o], m = G.sim.players[G.me]; return o === G.me || (m.team !== 0 && p.team === m.team); }
function computeVis() {
  const s = G.sim, W = s.W, H = s.H, vis = G.vis, exp = G.exp; vis.fill(0);
  for (const e of s.ents) {
    if (e.dead || e.o < 0 || e.gar || !allied(e.o)) continue;
    const st = e.k === 'u' ? uStat(s.players[e.o], e.t) : bStat(s.players[e.o], e.t);
    const tx0 = Math.max(0, Math.min(W - 1, Math.floor(e.x / TILE))), ty0 = Math.max(0, Math.min(H - 1, Math.floor(e.y / TILE)));
    const r = e.k === 'b' && !e.built ? 2 : st.los + (e.k === 'b' ? e.sz / 2 : 0) + s.hgt[ty0 * W + tx0];
    const cx = e.x / TILE, cy = e.y / TILE, r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.floor(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.floor(cx + r)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) { vis[y * W + x] = 1; exp[y * W + x] = 1; }
      }
  }
  const d = fogImg.data;
  for (let i = 0; i < W * H; i++) { d[i * 4] = 8; d[i * 4 + 1] = 9; d[i * 4 + 2] = 12; d[i * 4 + 3] = G.revealAll || vis[i] ? 0 : exp[i] ? 120 : 255; }
  fogCv.getContext('2d').putImageData(fogImg, 0, 0);
}
function isVis(x, y) { if (G.revealAll) return true; const s = G.sim, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return tx >= 0 && ty >= 0 && tx < s.W && ty < s.H && G.vis[ty * s.W + tx] === 1; }
function isExp(e) { if (G.revealAll) return true; const s = G.sim; for (let y = e.ty; y < e.ty + e.sz; y++) for (let x = e.tx; x < e.tx + e.sz; x++) if (G.exp[y * s.W + x]) return true; return false; }
function canSee(e) { if (e.k === 'u') return !e.gar && (allied(e.o) || isVis(e.x, e.y)); if (e.mob) return isVis(e.x, e.y); if (e.k === 'b' && allied(e.o)) return true; return isExp(e); }

const shadeCache = {};
function shade(hex, f) {
  const k = hex + f; if (shadeCache[k]) return shadeCache[k];
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return (shadeCache[k] = `rgb(${r | 0},${g | 0},${b | 0})`);
}
const TAU = Math.PI * 2;
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }

function drawRes(c, e, vx, vy, raw) {
  if (ART.ok && !raw && e.t !== 'berry') { drawResArt(c, e, vx, vy, performance.now()); return; }
  const n = e.t === 'berry' ? Math.max(1, Math.ceil(e.amt / 25)) : 0;
  const sc = e.t === 'gold' || e.t === 'stone' ? Math.max(1, Math.ceil(4 * e.amt / RES_AMT[e.t])) : 4; // mines shrink as they are dug out
  blit(c, sprite('r' + e.t + e.v + n + sc, 44, 52, 22, 30, (g) => { if (sc < 4) g.scale(0.55 + sc * 0.11, 0.55 + sc * 0.11); resBody(g, e.t, e.v, n); }), vx, vy);
}
// ---------- animals ----------
function drawAnimal(c, a, x, y, now) {
  if (ART.ok) { if (a.t === 'boar') drawBoar(c, a, x, y, now); else drawSheep(c, a, x, y, now); return; }
  const deer = a.t === 'deer';
  if (!a.live) {
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y + 3, 12, 4, 0, 0, TAU); c.fill();
    c.fillStyle = deer ? '#7d5130' : '#3f3229'; c.beginPath(); c.ellipse(x, y, 11, 4.5, 0.15, 0, TAU); c.fill();
    c.fillStyle = '#7a2a22'; c.beginPath(); c.ellipse(x - 2, y - 1, 5, 2.2, 0.15, 0, TAU); c.fill();
    c.strokeStyle = deer ? '#5b4630' : '#2c231c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 6, y + 2); c.lineTo(x - 9, y + 6); c.moveTo(x + 4, y + 2); c.lineTo(x + 8, y + 5); c.stroke();
    return;
  }
  const moving = Math.abs(a.x - a.px) + Math.abs(a.y - a.py) > 0.05;
  const f = ISO ? (moving ? Math.sign((a.x - a.px) - (a.y - a.py)) || a._fv || 1 : a._fv || 1) : a.face;
  if (moving) a._fv = f;
  const lg = moving && !Q.lite ? Math.sin(now / 60 + a.id) * 3 : 0;
  if (!Q.lite) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 4, 10, 3.5, 0, 0, TAU); c.fill(); }
  c.save(); c.translate(x, y); if (f < 0) c.scale(-1, 1);
  c.lineCap = 'round';
  if (deer) {
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(-6 - lg, 3); c.moveTo(-3, -4); c.lineTo(-3 + lg, 3); c.moveTo(4, -4); c.lineTo(4 + lg, 3); c.moveTo(7, -4); c.lineTo(7 - lg, 3); c.stroke();
    c.fillStyle = '#a56f3d'; c.beginPath(); c.ellipse(0, -7, 9, 4.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#d9b48a'; c.beginPath(); c.ellipse(1, -5, 6, 2, 0, 0, TAU); c.fill();
    c.fillStyle = '#a56f3d'; c.beginPath(); c.moveTo(6, -9); c.lineTo(9, -15); c.lineTo(12, -14); c.lineTo(9, -7); c.fill();
    c.beginPath(); c.ellipse(11, -15, 3.6, 2.4, 0.3, 0, TAU); c.fill();
    c.strokeStyle = '#5b4630'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(10, -17); c.lineTo(8, -23); c.moveTo(9, -20); c.lineTo(6, -21); c.moveTo(12, -17); c.lineTo(14, -23); c.moveTo(13.5, -20); c.lineTo(16, -21); c.stroke();
    circ(c, -9, -9, 1.8, '#f2ece0');
  } else {
    c.strokeStyle = '#2c231c'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5, -3); c.lineTo(-5 - lg, 3); c.moveTo(5, -3); c.lineTo(5 + lg, 3); c.stroke();
    c.fillStyle = '#4b3b30'; c.beginPath(); c.ellipse(0, -6, 10, 5.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#3a2d24'; c.beginPath(); c.moveTo(7, -9); c.lineTo(14, -5); c.lineTo(7, -2); c.fill();
    c.strokeStyle = '#2c231c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-8, -10); c.lineTo(6, -11); c.stroke();
    c.strokeStyle = '#f1ead8'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(11, -5); c.lineTo(13, -9); c.stroke();
    if (a.tgt) { c.fillStyle = '#ff5050'; c.font = 'bold 9px sans-serif'; c.fillText('!', -2, -14); }
  }
  c.restore();
}
// ---------- isometric buildings ----------
function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
function isoBox(c, hw, hh, H, cTop, cL, cR, ox, oy) {
  ox = ox || 0; oy = oy || 0;
  const L = [ox - hw, oy], B = [ox, oy + hh], R = [ox + hw, oy], T = [ox, oy - hh];
  poly(c, [L, B, [B[0], B[1] - H], [L[0], L[1] - H]], cL);
  poly(c, [B, R, [R[0], R[1] - H], [B[0], B[1] - H]], cR);
  poly(c, [[T[0], T[1] - H], [R[0], R[1] - H], [B[0], B[1] - H], [L[0], L[1] - H]], cTop);
}
function isoRoof(c, hw, hh, H, R, col, ox, oy) {
  ox = ox || 0; oy = oy || 0; const pk = [ox, oy - H - R];
  const L = [ox - hw, oy - H], B = [ox, oy + hh - H], Rr = [ox + hw, oy - H], T = [ox, oy - hh - H];
  poly(c, [T, L, pk], shade(col, 0.1)); poly(c, [T, Rr, pk], shade(col, -0.1)); poly(c, [L, B, pk], shade(col, -0.2)); poly(c, [B, Rr, pk], shade(col, -0.42));
}
function isoDoor(c, hw, hh, w, h, col) { // on the left (front-left) face
  const bx = -hw / 2, by = hh / 2, len = Math.sqrt(hw * hw + hh * hh), dx = hw / len, dy = hh / len;
  poly(c, [[bx - dx * w, by - dy * w], [bx + dx * w, by + dy * w], [bx + dx * w, by + dy * w - h], [bx - dx * w, by - dy * w - h]], col);
}
function isoBody(c, t, col, sz) {
  const hw0 = sz * 32, hh0 = sz * 16, k = t === 'kule' ? 0.5 : t === 'ev' ? 0.78 : 0.86, hw = hw0 * k, hh = hh0 * k;
  const [H, R] = ISO_H[t] || [20, 16];
  const stone = t === 'tc' || t === 'kale' || t === 'kule' || t === 'demirci';
  const wl = stone ? '#a3977f' : '#86603a', wr = stone ? '#c9bda3' : '#a67d4b', wt = stone ? '#d8ccb2' : '#b48a56';
  poly(c, [[-hw0 + 8, 2], [8, hh0 + 2], [hw0 + 10, 2], [10, -hh0 + 2]], 'rgba(0,0,0,.2)');
  if (t === 'kale') {
    isoBox(c, hw, hh, H, wt, wl, wr);
    for (let i = 1; i < 6; i++) { const f = i / 6; isoBox(c, 4, 2, 6, wt, wl, wr, -hw + hw * f, hh * f - H); isoBox(c, 4, 2, 6, wt, wl, wr, hw * f, hh - hh * f - H); }
    for (const [ox, oy] of [[0, -hh], [-hw, 0], [hw, 0], [0, hh]]) { isoBox(c, 13, 6.5, H + 16, wt, wl, wr, ox, oy); isoRoof(c, 15, 7.5, H + 16, 16, col, ox, oy); }
    isoDoor(c, hw, hh, 9, 18, '#2a1d10');
  } else if (t === 'kule') {
    isoBox(c, hw, hh, H, wt, wl, wr); isoRoof(c, hw * 1.25, hh * 1.25, H, R, col);
    isoDoor(c, hw, hh, 4, 10, '#2a1d10');
    poly(c, [[hw / 2 - 2, hh / 2 - H + 10], [hw / 2 + 2, hh / 2 - H + 8], [hw / 2 + 2, hh / 2 - H + 16], [hw / 2 - 2, hh / 2 - H + 18]], '#2a1d10');
  } else if (t === 'depo') {
    isoBox(c, hw, hh, H, wt, wl, wr);
    isoBox(c, hw * 1.05, hh * 1.05, 3, shade(col, -0.15), shade(col, -0.35), shade(col, -0.2), 0, -H);
    isoBox(c, 6, 3, 8, '#c49a62', '#8a6438', '#a67d4b', hw * 0.55, hh * 0.3 + 6); isoBox(c, 5, 2.5, 7, '#9a9a90', '#77776d', '#8a8a80', -hw * 0.2, hh * 0.75 + 4);
  } else {
    isoBox(c, hw, hh, H, wt, wl, wr); isoRoof(c, hw, hh, H, R, col);
    isoDoor(c, hw, hh, sz > 2 ? 7 : 5, sz > 2 ? 14 : 10, '#2a1d10');
    if (t === 'tc') { isoBox(c, 9, 4.5, H + 26, wt, wl, wr, -hw * 0.45, -hh * 0.45); isoRoof(c, 11, 5.5, H + 26, 14, col, -hw * 0.45, -hh * 0.45); }
    if (t === 'demirci') { isoBox(c, 5, 2.5, H + R + 6, '#6d6a66', '#4f4c49', '#5d5a57', hw * 0.4, -hh * 0.2); }
  }
  // team banner
  const bx = t === 'kale' ? 0 : hw * 0.55, by = t === 'kale' ? -hh - H - 30 : -hh * 0.2 - H - (R ? R * 0.4 : 2);
  c.strokeStyle = '#3a2a16'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by - 18); c.stroke();
  poly(c, [[bx, by - 18], [bx + 13, by - 15], [bx, by - 11]], col);
  if (t !== 'kale' && t !== 'kule') { c.font = `${9 + sz * 3}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(BT[t].ico, hw * 0.5, hh * 0.5 - H * 0.5); }
}
function isoWallBody(c, t, col, arms) {
  const stone = t !== 'palisat', H = t === 'palisat' ? 13 : 15;
  const cl = stone ? '#a3977f' : '#6b4626', cr = stone ? '#c9bda3' : '#8a5a2e', ct = stone ? '#ddd2b8' : '#a0703c';
  const segs = arms.length ? arms.slice() : [[1, 0], [-1, 0]];
  segs.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(3, 3, 14, 6, 0, 0, TAU); c.fill();
  for (const [dx, dy] of segs) {
    const ex = (dx - dy) * 16, ey = (dx + dy) * 8, th = stone ? 3 : 2;
    poly(c, [[-th, th / 2], [ex - th, ey + th / 2], [ex - th, ey + th / 2 - H], [-th, th / 2 - H]], cl);
    poly(c, [[th, th / 2], [ex + th, ey + th / 2], [ex + th, ey + th / 2 - H], [th, th / 2 - H]], (dx - dy) > 0 ? cr : cl);
    c.strokeStyle = ct; c.lineWidth = stone ? 5 : 3; c.beginPath(); c.moveTo(0, -H); c.lineTo(ex, ey - H); c.stroke();
    if (!stone) { c.fillStyle = '#5b3a1e'; for (let i = 1; i <= 3; i++) { const f = i / 4; poly(c, [[ex * f - 2, ey * f - H], [ex * f, ey * f - H - 4], [ex * f + 2, ey * f - H]], '#5b3a1e'); } }
    else { c.fillStyle = cl; for (let i = 1; i <= 3; i += 2) { const f = i / 4; c.fillRect(ex * f - 2, ey * f - H - 4, 4, 4); } }
  }
  isoBox(c, 5, 2.5, H + 3, ct, cl, cr);
  if (t === 'kapi') {
    const hor = arms.some(a => a[1] === 0) || !arms.length;
    const ex = hor ? 10 : -10, ey = 5;
    poly(c, [[-ex, -ey + 1], [ex, ey + 1], [ex, ey + 1 - 12], [-ex, -ey + 1 - 12]], '#6b4a2b');
    poly(c, [[-ex, -ey - 5], [ex, ey - 5], [ex, ey - 3], [-ex, -ey - 3]], col);
  }
  c.fillStyle = col; c.fillRect(-2, -H - 6, 4, 3);
}
function wallArms(e) {
  const arms = []; let mask = 0;
  [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy], i) => { if (wallNb(e, dx, dy) && !(dx && dy && (wallNb(e, dx, 0) || wallNb(e, 0, dy)))) { arms.push([dx, dy]); mask |= 1 << i; } });
  return [arms, mask];
}
function drawWall(c, e) {
  const P = G.sim.players[e.o], [arms, mask] = wallArms(e);
  if (!e.built) c.globalAlpha = 0.5;
  if (ISO) blit(c, sprite('iw' + e.t + P.color + mask, 48, 52, 24, 34, (g) => isoWallBody(g, e.t, P.color, arms)), e._vx, e._vy);
  else blit(c, sprite('w' + e.t + P.color + mask, 44, 48, 22, 26, (g) => wallBody(g, e.t, P, arms)), e.tx * TILE + 16, e.ty * TILE + 16);
  c.globalAlpha = 1;
  if (!e.built) { const cx = e._vx, cy = e._vy - (ISO ? 10 : 0), prog = e.prog / (bStat(P, e.t).t * TPS); c.fillStyle = '#000a'; c.fillRect(cx - 12, cy - 20, 24, 4); c.fillStyle = '#e8c35a'; c.fillRect(cx - 12, cy - 20, 24 * prog, 4); }
}
function drawFarm(c, e) { // called inside the flat (ground) transform
  const P = G.sim.players[e.o], S = e.sz * TILE, x0 = e.tx * TILE, y0 = e.ty * TILE;
  blit(c, sprite('f' + P.color + e.built, S, S, 0, 0, (g) => farmBody(g, P.color, e.built)), x0, y0);
  if (!e.built) { const prog = e.prog / (bStat(P, e.t).t * TPS); c.globalAlpha = 0.7; c.fillStyle = '#000'; c.fillRect(x0 + 4, y0 + S - 9, S - 8, 5); c.fillStyle = '#e8c35a'; c.fillRect(x0 + 4, y0 + S - 9, (S - 8) * prog, 5); c.globalAlpha = 1; }
}
function drawBld(c, e, now) {
  if (BT[e.t].wall || BT[e.t].gate) { drawWall(c, e); return; }
  if (ART.ok && drawBldArt(c, e, now)) return;
  if (!ISO) { drawBldTop(c, e, now); return; }
  const P = G.sim.players[e.o], col = P.color, vx = e._vx, vy = e._vy, hw0 = e.sz * 32, hh0 = e.sz * 16;
  const [H, R] = ISO_H[e.t] || [20, 16];
  if (!e.built) {
    const prog = e.prog / (bStat(P, e.t).t * TPS);
    c.save(); c.translate(vx, vy);
    poly(c, [[-hw0 + 4, 0], [0, hh0 - 2], [hw0 - 4, 0], [0, -hh0 + 2]], '#7d6440');
    c.globalAlpha = 0.85; const k = 0.86, hw = hw0 * k, hh = hh0 * k;
    isoBox(c, hw, hh, Math.max(2, H * prog), '#b8976a', '#86603a', '#a67d4b');
    c.globalAlpha = 1; c.strokeStyle = '#4a3418'; c.lineWidth = 2;
    for (const [px, py] of [[-hw, 0], [0, hh], [hw, 0]]) { c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - H - 4); c.stroke(); }
    c.font = `${10 + e.sz * 4}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.7; c.fillText(BT[e.t].ico, 0, -H * prog - 6); c.globalAlpha = 1;
    c.fillStyle = '#000a'; c.fillRect(-hw0 * 0.5, -H - 16, hw0, 5); c.fillStyle = '#e8c35a'; c.fillRect(-hw0 * 0.5, -H - 16, hw0 * prog, 5);
    c.restore(); return;
  }
  blit(c, sprite('i' + e.t + col, hw0 * 2 + 48, hh0 * 2 + H + R + 90, hw0 + 24, hh0 + H + R + 70, (g) => isoBody(g, e.t, col, e.sz)), vx, vy);
  if (e.t === 'degirmen') { // turning windmill sails
    const a = Q.lite ? 0.5 : now / 900 + e.id, cx = vx + 6, cy = vy - H - R + 6;
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) { const ang = a + i * Math.PI / 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20 * 0.85); c.stroke(); }
    circ(c, cx, cy, 2.5, '#5b3a1e');
  }
  if (e.gl && e.gl.length && allied(e.o)) { c.fillStyle = '#000b'; c.fillRect(vx - hw0 * 0.6, vy - 8, 30, 16); c.fillStyle = '#fff'; c.font = 'bold 11px Inter,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('🛡' + e.gl.length, vx - hw0 * 0.6 + 3, vy); }
  if (e.q.length && e.o === G.me) { const it = e.q[0]; c.fillStyle = '#000a'; c.fillRect(vx - hw0 * 0.45, vy + hh0 * 0.6, hw0 * 0.9, 4); c.fillStyle = '#7fd36b'; c.fillRect(vx - hw0 * 0.45, vy + hh0 * 0.6, hw0 * 0.9 * (1 - it.left / it.tot), 4); }
}
function bldTop(e) { if (ART.ok && e._top != null && BLD_ART[e.t]) return [ISO ? e._vx : e.x, e._top + 14]; if (ISO) return [e._vx, e._vy - isoHt(e.t) - 6]; return [e.x, e.ty * TILE + 4]; }
// stateless smoke and fire on damaged buildings
function smokeFire(c, e, now) {
  if (!e.built || e.t === 'ciftlik' || BT[e.t].wall || BT[e.t].gate) return;
  const f = e.hp / e.maxhp; if (f > 0.66) return;
  const [x, y] = bldTop(e), t = now / 1000, n = Q.lite ? 2 : f < 0.33 ? 6 : 3;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.55 + i / n + e.id * 0.137) % 1, ox = Math.sin(i * 2.1 + e.id) * e.sz * 7 + ph * 10, oy = -ph * 50;
    c.globalAlpha = (1 - ph) * 0.45; circ(c, x + ox, y + oy, 4 + ph * 12, f < 0.33 ? '#2f2b28' : '#7a756e');
  }
  c.globalAlpha = 1;
  if (f < 0.33) for (let j = 0; j < 3; j++) {
    const fx = x + (j - 1) * e.sz * 7, fh = 9 + Math.sin(t * 13 + j * 2 + e.id) * 3, fy = y + 6;
    poly(c, [[fx - 5, fy], [fx, fy - fh], [fx + 5, fy]], '#ff7a1a'); poly(c, [[fx - 2.5, fy], [fx, fy - fh * 0.6], [fx + 2.5, fy]], '#ffd24d');
  }
}
// ---------- persistent ground decals: stumps, rubble, arrows ----------
function addDecal(d) { G.decals.push(d); if (G.decals.length > 900) G.decals.splice(0, G.decals.length - 900); }
function drawDecals(c, now, vx0, vy0, vx1, vy1) {
  let keep = false;
  for (const d of G.decals) {
    const [vx, vy] = w2v(d.x, d.y); if (vx < vx0 - 60 || vx > vx1 + 60 || vy < vy0 - 60 || vy > vy1 + 60) continue;
    if (!G.revealAll && !G.exp[Math.floor(d.y / TILE) * G.sim.W + Math.floor(d.x / TILE)]) continue;
    if (d.k === 'stump' && ART.ok) { aFrame(c, ART.img.common, ART.M.common.stumps[(d.v || 0) % 4], 0, vx, vy + 8, false, 0.36); }
    else if (d.k === 'stump') { c.fillStyle = '#5a3d22'; c.beginPath(); c.ellipse(vx, vy + 4, 5, 2.6, 0, 0, TAU); c.fill(); c.fillStyle = '#b08a5a'; c.beginPath(); c.ellipse(vx, vy + 2.5, 4, 2, 0, 0, TAU); c.fill(); }
    else if (d.k === 'rubble') {
      for (const p of d.p) { const [px, py] = w2v(d.x + p[0], d.y + p[1]); c.fillStyle = p[2]; c.fillRect(px - p[3] / 2, py - p[3] / 4, p[3], p[3] / 2); }
    } else if (d.k === 'mark') {
      const age = (now - d.t0) / 1000; if (age < 0) continue; if (age > 14) { d.dead = 1; keep = true; continue; }
      c.globalAlpha = Math.min(1, (14 - age) / 4); c.strokeStyle = '#3a2814'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + d.a * 4, vy - 5); c.stroke(); c.globalAlpha = 1;
    }
  }
  if (keep) G.decals = G.decals.filter(d => !d.dead);
}
function resBody(c, t, v, n) {
  const x = 0, y = 0, e = { t, v };
  if (e.t === 'tree') {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 3, y + 10, 13, 5, 0, 0, TAU); c.fill();
    c.fillStyle = '#5a3d22'; c.fillRect(x - 2, y + 1, 4, 10);
    const g = [['#24501c', '#336b25', '#4a8a33'], ['#1f4a22', '#2d6430', '#43803f'], ['#2b5a1a', '#3c7424', '#57913a'], ['#22461b', '#30602a', '#467d36']][v];
    if (v === 1) { c.fillStyle = g[0]; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 13, y + 5); c.lineTo(x - 13, y + 5); c.fill(); c.fillStyle = g[1]; c.beginPath(); c.moveTo(x, y - 24); c.lineTo(x + 9, y - 4); c.lineTo(x - 9, y - 4); c.fill(); }
    else { circ(c, x - 5, y - 2, 9, g[0]); circ(c, x + 5, y - 3, 9, g[0]); circ(c, x, y - 9, 10, g[1]); circ(c, x - 3, y - 12, 5, g[2]); }
  } else if (e.t === 'gold' || e.t === 'stone') {
    const base = e.t === 'gold' ? '#6f6a5c' : '#8d8d86', hi = e.t === 'gold' ? '#8b8574' : '#b9b9b2';
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 2, y + 9, 14, 5, 0, 0, TAU); c.fill();
    circ(c, x - 6, y + 2, 8, base); circ(c, x + 6, y + 3, 7, base); circ(c, x, y - 4, 9, hi);
    if (e.t === 'gold') { circ(c, x - 4, y - 4, 2.6, '#f4cf4f'); circ(c, x + 4, y - 1, 2.2, '#ffe28a'); circ(c, x - 1, y + 4, 2.4, '#e9b93a'); circ(c, x + 7, y + 4, 1.8, '#f4cf4f'); }
    else { circ(c, x - 5, y - 6, 2.5, '#d8d8d2'); circ(c, x + 4, y + 2, 2, '#d0d0ca'); }
  } else if (e.t === 'berry') {
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x + 2, y + 8, 12, 4, 0, 0, TAU); c.fill();
    circ(c, x - 5, y + 1, 8, '#2f6a2a'); circ(c, x + 5, y + 1, 8, '#2f6a2a'); circ(c, x, y - 5, 9, '#3e7d34');
    const cols = ['#c2304a', '#7b3fb0', '#c2304a'];
    for (let i = 0; i < n; i++) circ(c, x - 6 + (i * 5) % 13, y - 6 + ((i * 7) % 11), 2.2, cols[i % 3]);
  }
}
function wallNb(e, dx, dy) {
  const s = G.sim, x = e.tx + dx, y = e.ty + dy; if (x < 0 || y < 0 || x >= s.W || y >= s.H) return false;
  const id = s.occ[y * s.W + x]; if (!id) return false; const o = s.byId.get(id);
  return !!(o && o.k === 'b' && o.o === e.o && (BT[o.t].wall || BT[o.t].gate));
}

function wallBody(c, t, P, arms) {
  const cx = 0, cy = 0, stone = t === 'sur' || t === 'kapi', e = { t };
  const hasNb = (dx, dy) => arms.some(a => a[0] === dx && a[1] === dy);
  const w = stone ? 15 : 9;
  c.lineCap = 'butt';
  const seg = (col, lw, oy) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); if (!arms.length) { c.moveTo(cx - 10, cy + oy); c.lineTo(cx + 10, cy + oy); } for (const [dx, dy] of arms) { c.moveTo(cx, cy + oy); c.lineTo(cx + dx * 16, cy + dy * 16 + oy); } c.stroke(); };
  seg('rgba(0,0,0,.28)', w, 5);
  if (e.t === 'kapi') {
    const hor = hasNb(1, 0) || hasNb(-1, 0) || !(hasNb(0, 1) || hasNb(0, -1));
    c.save(); c.translate(cx, cy); if (!hor) c.rotate(Math.PI / 2);
    c.fillStyle = '#8d826c'; c.fillRect(-16, -9, 6, 16); c.fillRect(10, -9, 6, 16);
    c.fillStyle = '#6b4a2b'; c.fillRect(-10, -6, 20, 11); c.strokeStyle = '#4a3218'; c.lineWidth = 1; for (let i = -6; i <= 6; i += 4) { c.beginPath(); c.moveTo(i, -6); c.lineTo(i, 5); c.stroke(); }
    c.fillStyle = P.color; c.fillRect(-10, -2, 20, 3);
    c.fillStyle = '#c8c1b0'; c.fillRect(-16, -12, 6, 4); c.fillRect(10, -12, 6, 4);
    c.restore();
  } else if (stone) {
    seg('#8d867a', w, 0); seg('#b9b2a2', w - 6, -3);
    c.fillStyle = '#a29a8a'; c.fillRect(cx - 8, cy - 11, 16, 16); c.fillStyle = '#cdc6b5'; c.fillRect(cx - 8, cy - 13, 4, 4); c.fillRect(cx + 4, cy - 13, 4, 4);
    c.fillStyle = P.color; c.fillRect(cx - 8, cy + 1, 16, 2);
  } else {
    seg('#5d3d1f', w, 0); c.strokeStyle = '#8a5a2e'; c.lineWidth = 5; c.setLineDash([3, 2]); c.beginPath();
    if (!arms.length) { c.moveTo(cx - 10, cy - 2); c.lineTo(cx + 10, cy - 2); } for (const [dx, dy] of arms) { c.moveTo(cx, cy - 2); c.lineTo(cx + dx * 16, cy + dy * 16 - 2); } c.stroke(); c.setLineDash([]);
    circ(c, cx, cy - 4, 4.5, '#7a5230'); c.fillStyle = P.color; c.fillRect(cx - 3, cy - 1, 6, 2);
  }
}
// ---------- sprite cache: static art is drawn once into offscreen canvases ----------
const SPR = new Map(), SPR_K = 2.5;
function sprite(key, w, h, ox, oy, draw) {
  let s = SPR.get(key); if (s) return s;
  const cv2 = document.createElement('canvas'); cv2.width = Math.ceil(w * SPR_K); cv2.height = Math.ceil(h * SPR_K);
  const g = cv2.getContext('2d'); g.scale(SPR_K, SPR_K); g.translate(ox, oy); draw(g);
  s = { c: cv2, w, h, ox, oy }; SPR.set(key, s); return s;
}
function blit(c, s, x, y) { c.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h); }
function bldBody(c, t, col, sz) {
  const S = sz * TILE, x0 = 0, y0 = 0;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x0 + 6, y0 + 8, S - 4, S - 4);
  const stone = t === 'tc' || t === 'kale' || t === 'kule';
  const wall = stone ? '#bfb39a' : '#a27a4a', wallD = stone ? '#8d826c' : '#7a5a35';
  if (t === 'kule') {
    c.fillStyle = wallD; c.fillRect(x0 + 10, y0 + 6, S - 20, S - 8);
    c.fillStyle = wall; c.fillRect(x0 + 12, y0 - 14, S - 24, S - 6);
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(x0 + 8, y0 - 12); c.lineTo(x0 + S / 2, y0 - 34); c.lineTo(x0 + S - 8, y0 - 12); c.fill();
    c.fillStyle = '#2a1d10'; c.fillRect(x0 + S / 2 - 3, y0 + 2, 6, 9);
  } else if (t === 'kale') {
    c.fillStyle = wallD; c.fillRect(x0 + 2, y0 + 10, S - 4, S - 12);
    c.fillStyle = wall; c.fillRect(x0 + 6, y0 + 4, S - 12, S - 16);
    for (let i = 0; i < 9; i++) c.fillRect(x0 + 6 + i * (S - 16) / 8, y0 - 2, 6, 7);
    for (const [tx, ty] of [[x0 + 2, y0 - 6], [x0 + S - 22, y0 - 6]]) { c.fillStyle = wallD; c.fillRect(tx, ty, 20, S - 6); c.fillStyle = shade(col, -0.2); c.beginPath(); c.moveTo(tx - 3, ty); c.lineTo(tx + 10, ty - 18); c.lineTo(tx + 23, ty); c.fill(); }
    c.fillStyle = '#2a1d10'; c.beginPath(); c.arc(x0 + S / 2, y0 + S - 12, 11, Math.PI, 0); c.fill(); c.fillRect(x0 + S / 2 - 11, y0 + S - 12, 22, 8);
  } else {
    const roofY = y0 + S * 0.42;
    c.fillStyle = wallD; c.fillRect(x0 + 3, roofY - 2, S - 6, S - (roofY - y0) - 1);
    c.fillStyle = wall; c.fillRect(x0 + 5, roofY, S - 10, S - (roofY - y0) - 5);
    c.fillStyle = shade(col, -0.3);
    c.beginPath(); c.moveTo(x0 + 1, roofY + 2); c.lineTo(x0 + S * 0.22, y0 + 1); c.lineTo(x0 + S * 0.78, y0 + 1); c.lineTo(x0 + S - 1, roofY + 2); c.fill();
    c.fillStyle = shade(col, -0.05); c.beginPath(); c.moveTo(x0 + S * 0.22, y0 + 1); c.lineTo(x0 + S * 0.78, y0 + 1); c.lineTo(x0 + S * 0.7, roofY - 6); c.lineTo(x0 + S * 0.3, roofY - 6); c.fill();
    c.fillStyle = '#2a1d10'; c.fillRect(x0 + S / 2 - 5, y0 + S - 18, 10, 13);
  }
  c.strokeStyle = '#3a2a16'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + S - 6, y0 + 4); c.lineTo(x0 + S - 6, y0 - 14); c.stroke();
  c.font = `${12 + sz * 5}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(BT[t].ico, x0 + S / 2, t === 'kule' ? y0 - 2 : y0 + S * 0.66);
}
function farmBody(c, col, built) {
  const S = 2 * TILE;
  c.fillStyle = '#7a5a33'; c.fillRect(2, 2, S - 4, S - 4);
  c.strokeStyle = '#5f4426'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(4, 8 + i * 9.5); c.lineTo(S - 4, 8 + i * 9.5); c.stroke(); }
  if (built) { c.fillStyle = '#9ac24a'; for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) c.fillRect(6 + j * 8, 5 + i * 9.5, 3, 3); }
  c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(2, 2, S - 4, S - 4);
}
function drawBldTop(c, e, now) {
  if (BT[e.t].wall || BT[e.t].gate) { drawWall(c, e); return; }
  const P = G.sim.players[e.o], col = P.color, S = e.sz * TILE, x0 = e.tx * TILE, y0 = e.ty * TILE;
  const prog = e.built ? 1 : e.prog / (bStat(P, e.t).t * TPS);
  if (e.t === 'ciftlik') {
    blit(c, sprite('f' + col + e.built, S, S, 0, 0, (g) => farmBody(g, col, e.built)), x0, y0);
    if (!e.built) { c.globalAlpha = 0.7; c.fillStyle = '#000'; c.fillRect(x0 + 4, y0 + S - 9, S - 8, 5); c.fillStyle = '#e8c35a'; c.fillRect(x0 + 4, y0 + S - 9, (S - 8) * prog, 5); c.globalAlpha = 1; }
    return;
  }
  if (!e.built) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x0 + 6, y0 + 8, S - 4, S - 4);
    c.fillStyle = '#7d6440'; c.fillRect(x0 + 2, y0 + 2, S - 4, S - 4);
    const h = (S - 8) * prog;
    c.fillStyle = '#a88a5c'; c.fillRect(x0 + 5, y0 + S - 4 - h, S - 10, h);
    c.strokeStyle = '#4a3418'; c.lineWidth = 2;
    for (let i = 0; i <= e.sz; i++) { c.beginPath(); c.moveTo(x0 + 4 + i * (S - 8) / e.sz, y0 + 3); c.lineTo(x0 + 4 + i * (S - 8) / e.sz, y0 + S - 3); c.stroke(); }
    c.beginPath(); c.moveTo(x0 + 4, y0 + S / 2); c.lineTo(x0 + S - 4, y0 + S / 2); c.stroke();
    c.font = `${10 + e.sz * 5}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.6; c.fillText(BT[e.t].ico, x0 + S / 2, y0 + S / 2); c.globalAlpha = 1;
    c.fillStyle = '#000a'; c.fillRect(x0 + 4, y0 - 8, S - 8, 5); c.fillStyle = '#e8c35a'; c.fillRect(x0 + 4, y0 - 8, (S - 8) * prog, 5);
    return;
  }
  blit(c, sprite('b' + e.t + col, S + 22, S + 52, 6, 40, (g) => bldBody(g, e.t, col, e.sz)), x0, y0);
  const wv = Q.lite ? 0 : Math.sin(now / 300 + e.id) * 2;
  c.fillStyle = col; c.beginPath(); c.moveTo(x0 + S - 6, y0 - 14); c.lineTo(x0 + S + 8, y0 - 11 + wv); c.lineTo(x0 + S - 6, y0 - 7); c.fill();
  if (e.gl && e.gl.length && allied(e.o)) { c.fillStyle = '#000b'; c.fillRect(x0 + 2, y0 + 2, 30, 16); c.fillStyle = '#fff'; c.font = 'bold 11px Inter,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('🛡' + e.gl.length, x0 + 5, y0 + 10); }
  if (e.q.length && e.o === G.me) { const it = e.q[0]; c.fillStyle = '#000a'; c.fillRect(x0 + 4, y0 + S - 7, S - 8, 4); c.fillStyle = '#7fd36b'; c.fillRect(x0 + 4, y0 + S - 7, (S - 8) * (1 - it.left / it.tot), 4); }
}
const SKIN = '#e1b38a';
// monster camps: an orc camp (tent, totem, campfire, treasure chest) or a bubbling slime pool
function drawCamp(c, cp, now) {
  const [x, y] = w2v(cp.x, cp.y);
  if (cp.t === 'balcik') {
    c.fillStyle = cp.done ? 'rgba(60,90,50,.35)' : 'rgba(57,123,68,.75)'; c.beginPath(); c.ellipse(x, y + 6, 34, 15, 0, 0, TAU); c.fill();
    c.fillStyle = cp.done ? 'rgba(80,110,60,.3)' : 'rgba(113,170,52,.6)'; c.beginPath(); c.ellipse(x - 4, y + 4, 22, 9, 0, 0, TAU); c.fill();
    if (!cp.done && !Q.lite) for (let i = 0; i < 3; i++) { const k = ((now / 900 + i * 0.37) % 1); c.fillStyle = 'rgba(203,219,252,' + (0.7 * (1 - k)) + ')'; c.beginPath(); c.arc(x - 16 + i * 14, y + 6 - k * 10, 2 + k * 2, 0, TAU); c.fill(); }
    if (!cp.done) chest(c, x + 22, y - 2, false);
    return;
  }
  // tent
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x - 18, y + 4, 22, 8, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(x - 38, y + 4); c.lineTo(x - 18, y - 30); c.lineTo(x + 2, y + 4); c.closePath(); oFill(c, cp.done ? '#6b5a48' : '#8a5a3a');
  c.beginPath(); c.moveTo(x - 24, y + 4); c.lineTo(x - 18, y - 12); c.lineTo(x - 12, y + 4); c.closePath(); oFill(c, '#3a2618');
  // skull totem
  c.fillStyle = '#4a3020'; c.fillRect(x + 25, y - 26, 3, 30); c.beginPath(); c.arc(x + 26.5, y - 28, 5, 0, TAU); oFill(c, '#e8e0cc');
  c.fillStyle = '#262335'; c.fillRect(x + 24, y - 29, 2, 2); c.fillRect(x + 28, y - 29, 2, 2);
  // campfire
  c.fillStyle = '#5a4636'; c.fillRect(x - 6, y + 12, 14, 3);
  if (!cp.done) { if (ART.ok) { const F = ART.M.common.fire[0]; aFrame(c, ART.img.common, F, Math.floor(now / 90), x + 1, y + 15, false, 0.42); } else circ(c, x + 1, y + 8, 5, '#f39a2b'); chest(c, x + 16, y + 10, false); }
  else chest(c, x + 16, y + 10, true);
}
function chest(c, x, y, open) {
  c.beginPath(); c.rect(x - 7, y - 6, 14, 9); oFill(c, '#8b5a2b');
  if (open) { c.beginPath(); c.rect(x - 7, y - 12, 14, 5); oFill(c, '#6e4520'); }
  else { c.beginPath(); c.rect(x - 7, y - 9, 14, 4); oFill(c, '#a26a33'); c.fillStyle = '#f2c84b'; c.fillRect(x - 1.5, y - 6, 3, 4); }
}
function drawUnit(c, u, x, y, col, now, fo, flat) {
  if (ART.ok && (u.o >= 0 || u.o === GAIA)) { drawUnitArt(c, u, x, y, u.o, now, fo || u.face || 1, flat); return; }
  const st = UT[u.t], cls = st.cls, f = fo || u.face || 1, tick = G.sim.tick;
  const moving = Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 0.05;
  const bob = moving ? Math.sin(now / 85 + u.id) * 1.3 : 0;
  const atk = u.atkT && tick - u.atkT < 3 ? 1 : 0;
  const work = u.work && tick - u.work < 2;
  if (!Q.lite && !flat) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + u.r * 0.75, u.r * (cls === 'cav' || cls === 'siege' ? 1.2 : 0.9), u.r * 0.38, 0, 0, TAU); c.fill(); }
  c.save(); c.translate(x, y + bob); if (f < 0) c.scale(-1, 1);
  const dark = shade(col, -0.35);
  c.lineCap = 'round';
  if (cls === 'cav') {
    const horse = u.t === 'kurtatli' ? '#7c7a76' : u.t === 'zirhli' ? '#4a3524' : '#6b4a2b';
    c.strokeStyle = shade(horse, -0.3); c.lineWidth = 2.2;
    const lg = moving ? Math.sin(now / 70 + u.id) * 3 : 0;
    for (const lx of [-7, -3, 5, 9]) { c.beginPath(); c.moveTo(lx, 2); c.lineTo(lx + (lx > 0 ? lg : -lg), 9); c.stroke(); }
    c.fillStyle = horse; c.beginPath(); c.ellipse(1, 0, 11, 5.5, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(11, -6, 4.5, 3, -0.6, 0, TAU); c.fill(); c.fillRect(8, -6, 4, 6);
    if (u.t === 'zirhli') { c.fillStyle = col; c.fillRect(-9, -3, 18, 6); }
    c.fillStyle = '#2b1d10'; c.beginPath(); c.moveTo(-10, -2); c.lineTo(-15, 4); c.lineTo(-11, 0); c.fill();
    c.fillStyle = col; c.fillRect(-4, -14 - atk, 8, 10);
    circ(c, 0, -17 - atk, 3.6, SKIN);
    c.fillStyle = u.t === 'zirhli' ? '#c9c9c9' : dark; c.beginPath(); c.arc(0, -18 - atk, 3.8, Math.PI, 0); c.fill();
    if (u.t === 'kurtatli') { c.strokeStyle = '#6b3f1f'; c.lineWidth = 1.6; c.beginPath(); c.arc(6, -11, 6, -1.3, 1.3); c.stroke(); }
    else { c.strokeStyle = u.t === 'zirhli' ? '#dcdcdc' : '#c0c0c0'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, -10); c.lineTo(14 + atk * 3, -18 + atk * 6); c.stroke(); }
  } else if (cls === 'siege') {
    c.fillStyle = '#3a2a18'; for (const wx of [-9, 9]) { circ(c, wx, 8, 4, '#3a2a18'); circ(c, wx, 8, 1.6, '#8c6a3f'); }
    if (u.t === 'koc') {
      c.fillStyle = '#7a5530'; c.fillRect(-12, -8, 24, 15);
      c.fillStyle = dark; c.beginPath(); c.moveTo(-14, -6); c.lineTo(0, -16); c.lineTo(14, -6); c.fill();
      c.fillStyle = '#5a3d22'; c.fillRect(8 + atk * 4, -2, 10, 5); circ(c, 18 + atk * 4, 0, 3.2, '#888');
    } else {
      c.fillStyle = '#7a5530'; c.fillRect(-12, 0, 24, 6); c.fillStyle = col; c.fillRect(-12, 3, 24, 2);
      c.strokeStyle = '#5a3d22'; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, 2); c.lineTo(0, -10); c.lineTo(6, 2); c.stroke();
      const a = atk ? -0.2 : -1.2; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(Math.cos(a) * 16, -8 + Math.sin(a) * 16); c.stroke();
      circ(c, Math.cos(a) * 16, -8 + Math.sin(a) * 16, 3, '#555');
    }
  } else {
    const big = u.t === 'dagdevi' ? 1.35 : u.t === 'kalkanli' ? 1.1 : 1;
    c.scale(big, big);
    const lg = moving ? Math.sin(now / 80 + u.id) * 2.5 : 0;
    c.strokeStyle = '#3b2a1a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-2, 2); c.lineTo(-2 - lg, 8); c.moveTo(2, 2); c.lineTo(2 + lg, 8); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(-5, -7); c.lineTo(5, -7); c.lineTo(6, 3); c.lineTo(-6, 3); c.fill();
    circ(c, 0, -10, 3.6, SKIN);
    if (cls === 'vil') {
      c.fillStyle = '#d8b35a'; c.beginPath(); c.ellipse(0, -12.5, 6, 2, 0, 0, TAU); c.fill(); circ(c, 0, -13.5, 2.6, '#c9a248');
      if (u.carry > 0) { c.fillStyle = { f: '#d65a4a', w: '#8a5a2b', g: '#f2c84b', s: '#aaa' }[u.ck] || '#999'; c.fillRect(-9, -6, 5, 6); }
      const sw = work ? Math.sin(now / 70) * 0.9 : 0;
      c.save(); c.translate(4, -4); c.rotate(-0.6 + sw); c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -10); c.stroke();
      c.fillStyle = '#9a9a9a'; c.fillRect(-3, -11, 6, 2.5); c.restore();
    } else if (cls === 'arch') {
      c.fillStyle = u.t === 'golgeokcu' ? '#1f3a1c' : dark; c.beginPath(); c.arc(0, -11, 4.2, Math.PI * 0.95, Math.PI * 2.05); c.fill();
      c.strokeStyle = '#6b3f1f'; c.lineWidth = 1.8; c.beginPath(); c.arc(5, -4, u.t === 'golgeokcu' ? 8 : 7, -1.3, 1.3); c.stroke();
      c.strokeStyle = '#ddd'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(5 + Math.cos(-1.3) * 7 - atk * 2, -4 + Math.sin(-1.3) * 7); c.lineTo(5 + Math.cos(1.3) * 7 - atk * 2, -4 + Math.sin(1.3) * 7); c.stroke();
    } else {
      c.fillStyle = '#9fa3a8'; c.beginPath(); c.arc(0, -11, 4, Math.PI, 0); c.fill();
      if (u.t === 'mizrakci') { c.strokeStyle = '#7a5530'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(6 + atk * 3, 6); c.lineTo(6 + atk * 3, -20); c.stroke(); c.fillStyle = '#ccc'; c.beginPath(); c.moveTo(4 + atk * 3, -19); c.lineTo(6 + atk * 3, -25); c.lineTo(8 + atk * 3, -19); c.fill(); }
      else if (u.t === 'dagdevi') { c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.4; c.save(); c.translate(5, -3); c.rotate(atk ? 0.8 : -0.4); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -14); c.stroke(); c.fillStyle = '#777'; c.fillRect(-4, -18, 8, 6); c.restore(); }
      else { c.strokeStyle = '#d6d6d6'; c.lineWidth = 2; c.beginPath(); c.moveTo(5, -3); c.lineTo(12 + atk * 3, -10 + atk * 6); c.stroke(); }
      if (u.t === 'kalkanli') { c.fillStyle = dark; c.fillRect(-9, -9, 6, 12); c.strokeStyle = '#e2c26a'; c.lineWidth = 1; c.strokeRect(-9, -9, 6, 12); }
      else if (u.t === 'kilicli') circ(c, -6, -2, 3.6, dark);
    }
  }
  c.restore();
}
function hpBar(c, x, y, w, frac, own) {
  c.fillStyle = '#000b'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  c.fillStyle = frac > 0.5 ? (own ? '#4cc35a' : '#e05252') : frac > 0.25 ? '#e6b33a' : '#e05252';
  c.fillRect(x - w / 2, y, w * Math.max(0, frac), 3);
}

function faceV(e) {
  if (!ISO) return e.face;
  const mv = (e.x - e.px) - (e.y - e.py);
  if (Math.abs(e.x - e.px) + Math.abs(e.y - e.py) > 0.05 && Math.abs(mv) > 0.01) e._fv = mv > 0 ? 1 : -1;
  else if (e.st === 'attack' || e.st === 'gather' || e.st === 'build') {
    const t = G.sim.byId.get(e.st === 'attack' ? e.tgt : e.st === 'gather' ? e.gt : e.bt);
    if (t) { const d = (t.x - e.x) - (t.y - e.y); if (Math.abs(d) > 2) e._fv = d > 0 ? 1 : -1; }
  }
  return e._fv || e.face;
}
function depthOf(e) {
  if (e.k === 'b') { if (BT[e.t].wall || BT[e.t].gate) return e._vy; return ISO ? e._vy + e.sz * 6 : (e.ty + e.sz) * TILE - 4; }
  return e._vy;
}
function render(now) {
  const s = G.sim, c = ctx, z = G.z;
  const alpha = Math.max(0, Math.min(1, G.acc / TURN_MS));
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = '#0b0d10'; c.fillRect(0, 0, VW, VH);
  c.setTransform(DPR * z, 0, 0, DPR * z, -G.cam.x * z * DPR, -G.cam.y * z * DPR);
  const vx0 = G.cam.x, vy0 = G.cam.y, vx1 = G.cam.x + VW / z, vy1 = G.cam.y + VH / z;
  c.imageSmoothingEnabled = !ART.ok;
  c.save(); flatT(c); c.drawImage(groundCv, 0, 0, s.W * TILE, s.H * TILE); c.restore();
  drawDecals(c, now, vx0, vy0, vx1, vy1);
  const list = [], selSet = new Set(G.sel), farms = [];
  for (const e of s.ents) {
    if (e.dead || !canSee(e)) continue;
    let ex = e.x, ey = e.y;
    if (e.k === 'u' || e.mob) { ex = e.px + (e.x - e.px) * alpha; ey = e.py + (e.y - e.py) * alpha; }
    const v = w2v(ex, ey); e._vx = v[0]; e._vy = v[1];
    const pad = e.k === 'b' ? e.sz * 40 + 60 : 50;
    if (v[0] < vx0 - pad || v[0] > vx1 + pad || v[1] < vy0 - pad || v[1] > vy1 + pad + 40) continue;
    if (e.k === 'b' && e.t === 'ciftlik') { farms.push(e); continue; }
    list.push(e);
  }
  if (farms.length) { c.save(); flatT(c); for (const e of farms) drawFarm(c, e); c.restore(); }
  if (s.camps) for (const cp of s.camps) { const tx = Math.floor(cp.x / TILE), ty = Math.floor(cp.y / TILE); if (isExpTile(tx - 1, ty - 1, 3)) drawCamp(c, cp, now); }
  // selection rings (on the ground)
  for (const id of G.sel) {
    const e = s.byId.get(id); if (!e || !canSee(e) || e._vx == null) continue;
    const own = e.o === G.me, colr = own ? '#7CFC7C' : e.o === GAIA ? '#ff9a3c' : e.o < 0 ? '#ffe680' : '#ff6b6b';
    c.strokeStyle = colr; c.lineWidth = 1.6 / Math.max(0.6, z);
    if (e.k === 'u' || e.mob) { c.beginPath(); c.ellipse(e._vx, e._vy + e.r * 0.7, e.r + 3, (e.r + 3) * 0.45, 0, 0, TAU); c.stroke(); }
    else { c.save(); flatT(c); c.lineWidth = 2; c.strokeRect(e.tx * TILE + 1, e.ty * TILE + 1, e.sz * TILE - 2, e.sz * TILE - 2); c.restore(); }
  }
  for (const e of list) e._d = depthOf(e);
  list.sort((a, b) => a._d - b._d || a.id - b.id);
  for (const e of list) {
    if (e.k === 'r') { if (e.mob) drawAnimal(c, e, e._vx, e._vy, now); else drawRes(c, e, e._vx, e._vy); }
    else if (e.k === 'b') drawBld(c, e, now);
    else drawUnit(c, e, e._vx, e._vy, ownerCol(e.o), now, faceV(e));
  }
  for (const e of list) if (e.k === 'b' && e.hp < e.maxhp * 0.66) smokeFire(c, e, now);
  // fx
  const keep = [];
  for (const f of G.fx) {
    const t = Math.max(0, (now - f.t0) / 1000);
    if (f.k === 'arrow' || f.k === 'rock') {
      const dur = f.k === 'rock' ? 0.6 : 0.28; if (t > dur) continue; keep.push(f);
      const [sx, sy] = w2v(f.x, f.y), [tx, ty] = w2v(f.tx, f.ty);
      const k = t / dur, x = sx + (tx - sx) * k, y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * (f.k === 'rock' ? 40 : 14) - 8;
      if (f.k === 'rock') circ(c, x, y, 4, '#555');
      else if (ART.ok) { const A = ART.M.common.arrow; c.save(); c.translate(x, y); c.rotate(Math.atan2((ty - sy) - 14 * Math.PI * Math.cos(k * Math.PI), tx - sx)); c.drawImage(ART.img.common, A.x, A.y, A.w, A.h, -A.ax * 0.45, -A.ay * 0.45, A.w * 0.45, A.h * 0.45); c.restore(); }
      else { const dx = tx - sx, dy = ty - sy, d = Math.sqrt(dx * dx + dy * dy) || 1; c.strokeStyle = '#2b1b0c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx / d * 8, y - dy / d * 8); c.stroke(); }
    } else if (f.k === 'die') {
      if (t > 4) continue; keep.push(f);
      const [x, y] = w2v(f.x, f.y);
      const xa = ART.ok && f.t && artSet({ t: f.t, o: f.o });
      if (xa && xa.M.die) { // play the character's own death animation
        c.globalAlpha = t < 2.5 ? 1 : 1 - (t - 2.5) / 1.5;
        aFrame(c, xa.img, xa.M.die, Math.min(xa.M.die.n - 1, Math.floor(t / 0.09)), x, y, (f.f || 1) < 0, xa.sc);
        c.globalAlpha = 1;
      } else if (f.t && UT[f.t]) { // the unit falls over and fades away
        const fall = Math.min(1, t / 0.3), fd = f.f || 1;
        c.save(); c.globalAlpha = t < 2.5 ? 1 : 1 - (t - 2.5) / 1.5; c.translate(x, y + 4); c.rotate(fd * fall * Math.PI / 2 * 0.95);
        drawUnit(c, { t: f.t, o: f.o, face: fd, x: 0, y: 0, px: 0, py: 0, r: f.r || 8, id: 0, atkT: 0, work: 0, carry: 0, st: 'idle' }, 0, -4, shade(f.c, -0.15), now, fd, true);
        c.restore(); c.globalAlpha = 1;
      } else { c.globalAlpha = 1 - t / 4; circ(c, x, y - t * 4, 6 + t * 2, '#bbb8'); c.globalAlpha = 1; }
    } else if (f.k === 'loot') {
      if (t > 1.8 || f.o !== G.me) continue; keep.push(f);
      const [x, y] = w2v(f.x, f.y);
      c.globalAlpha = t < 1.2 ? 1 : 1 - (t - 1.2) / 0.6; c.font = (f.big ? 'bold 17px' : 'bold 12px') + ' Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.lineWidth = 3; c.strokeStyle = '#000a'; const ls = T(f.s); c.strokeText(ls, x, y - t * 22); c.fillStyle = f.big ? '#ffd84a' : '#fff3b0'; c.fillText(ls, x, y - t * 22); c.globalAlpha = 1;
    } else if (f.k === 'boom' && ART.ok) {
      if (t > 0.9) continue; keep.push(f); const [x, y] = w2v(f.x, f.y), A = ART.M.common.boom;
      for (let i = 0; i < Math.min(3, f.sz); i++) aFrame(c, ART.img.common, A, Math.floor(t / 0.9 * A.n), x + (i - 1) * f.sz * 9, y - 10 - (i % 2) * 12, false, 0.45 + f.sz * 0.12);
    } else if (f.k === 'boom') {
      if (t > 1.4) continue; keep.push(f); c.globalAlpha = 1 - t / 1.4;
      const [x, y] = w2v(f.x, f.y);
      for (let i = 0; i < 7; i++) circ(c, x + Math.cos(i) * f.sz * 10 * (0.5 + t), y - t * 20 + Math.sin(i * 1.7) * f.sz * 6 * (0.5 + t), f.sz * 7 * (1 + t), i % 2 ? '#8a7a66' : '#5e5245');
      c.globalAlpha = 1;
    }
  }
  G.fx = keep;
  if (!G.revealAll) { c.save(); flatT(c); c.imageSmoothingEnabled = true; c.drawImage(fogCv, 0, 0, s.W * TILE, s.H * TILE); c.restore(); }
  tutMark(c, now);
  // hp bars
  for (const e of list) {
    if (e.k === 'r') continue;
    const sel = selSet.has(e.id);
    if (e.k === 'u') { if (sel || e.hp < e.maxhp) hpBar(c, e._vx, e._vy - (ART.ok ? (UNIT_H[e.t] || 36) + 4 : e.r + 16), 18, e.hp / e.maxhp, allied(e.o)); }
    else if (e.built && (sel || e.hp < e.maxhp)) { const [hx, hy] = ART.ok && e._top != null && BLD_ART[e.t] ? [ISO ? e._vx : e.x, e._top - 6] : ISO ? [e._vx, e._vy - isoHt(e.t) - 14] : [e.x, e.ty * TILE - 6]; hpBar(c, hx, hy, Math.min(80, e.sz * 18), e.hp / e.maxhp, allied(e.o)); }
  }
  // rally flag
  if (G.sel.length === 1) {
    const b = s.byId.get(G.sel[0]);
    if (b && b.k === 'b' && b.o === G.me && b.rally) {
      const [ax, ay] = w2v(b.x, b.y), [rx, ry] = w2v(b.rally.x, b.rally.y);
      c.strokeStyle = '#fff8'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(rx, ry); c.stroke(); c.setLineDash([]);
      c.font = '18px serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('🚩', rx + 4, ry - 2);
    }
  }
  // placement ghost
  if (G.placing && G.ghost && BT[G.placing].wall) {
    const st = G.wallStart || G.ghost, line = wallLine(st[0], st[1], G.ghost[0], G.ghost[1]);
    let n = 0;
    c.save(); flatT(c);
    for (const [tx, ty] of line) { const ok = canPlace(s, G.me, G.placing, tx, ty); if (ok) n++; c.fillStyle = ok ? 'rgba(80,220,100,.45)' : 'rgba(230,60,60,.45)'; c.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); }
    c.restore();
    const cost = BT[G.placing].cost, k = Object.keys(cost)[0], [lx, ly0] = w2v(G.ghost[0] * TILE + 16, G.ghost[1] * TILE + 16), ly = ly0 - 26;
    c.font = 'bold 13px Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000a';
    const txt = T(n + ' parça · ' + n * cost[k] + ' ' + RES_INFO[k].i); c.fillRect(lx - 50, ly - 10, 100, 18); c.fillStyle = '#fff'; c.fillText(txt, lx, ly);
  } else if (G.placing && G.ghost) {
    const [tx, ty] = G.ghost, sz = BT[G.placing].sz, ok = canPlace(s, G.me, G.placing, tx, ty) && isExpTile(tx, ty, sz);
    c.save(); flatT(c);
    c.fillStyle = ok ? 'rgba(80,220,100,.35)' : 'rgba(230,60,60,.4)'; c.fillRect(tx * TILE, ty * TILE, sz * TILE, sz * TILE);
    c.strokeStyle = ok ? '#7CFC7C' : '#ff6b6b'; c.lineWidth = 2; c.strokeRect(tx * TILE, ty * TILE, sz * TILE, sz * TILE);
    c.restore();
    const [gx, gy] = w2v((tx + sz / 2) * TILE, (ty + sz / 2) * TILE);
    c.font = `${12 + sz * 6}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(BT[G.placing].ico, gx, gy - (ISO ? 10 : 0));
  }
  // drag-to-command preview
  if (G.drag) {
    const [dx, dy] = G.drag, t = pick(dx, dy, true), [ddx, ddy] = w2v(dx, dy);
    const col = t && t.k !== 'r' && isEnemy(s, G.me, t.o) ? '#ff5050' : t && t.k === 'r' ? '#ffe066' : '#7CFC7C';
    c.strokeStyle = col; c.lineWidth = 2.5 / z; c.setLineDash([8 / z, 6 / z]);
    for (const id of G.sel) { const u = s.byId.get(id); if (!u || u.k !== 'u' || u._vx == null) continue; c.beginPath(); c.moveTo(u._vx, u._vy); c.lineTo(ddx, ddy); c.stroke(); }
    c.setLineDash([]);
    if (t) { c.lineWidth = 3 / z; if (t.k === 'u' || t.mob) { const [tx, ty] = w2v(t.x, t.y); c.beginPath(); c.ellipse(tx, ty + t.r * 0.7, t.r + 5, (t.r + 5) * 0.5, 0, 0, TAU); c.stroke(); } else { c.save(); flatT(c); c.strokeRect(t.tx * TILE, t.ty * TILE, t.sz * TILE, t.sz * TILE); c.restore(); } }
    else { c.beginPath(); c.ellipse(ddx, ddy, 14, 7, 0, 0, TAU); c.stroke(); }
  }
  // command marks
  G.marks = G.marks.filter(m => now - m.t < 600);
  for (const m of G.marks) { const k = (now - m.t) / 600, [mx, my] = w2v(m.x, m.y); c.strokeStyle = m.c; c.lineWidth = 2; c.globalAlpha = 1 - k; c.beginPath(); c.ellipse(mx, my, 12 * (1 - k * 0.5), 6 * (1 - k * 0.5), 0, 0, TAU); c.stroke(); c.globalAlpha = 1; }
  G.pings = G.pings.filter(p => now - p.t0 < 4500);
  for (const p of G.pings) { const [px, py] = w2v(p.x, p.y), k = ((now - p.t0) % 900) / 900; c.strokeStyle = p.c; c.lineWidth = 3 / z; c.globalAlpha = 1 - k; c.beginPath(); c.ellipse(px, py, 10 + k * 40, (10 + k * 40) * 0.5, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; c.font = 'bold 20px serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('📍', px, py - 4); }
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.box) { const b = G.box; c.strokeStyle = '#7CFC7C'; c.lineWidth = 1; c.fillStyle = 'rgba(124,252,124,.08)'; const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0); c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); }
}
function isExpTile(tx, ty, sz) { if (G.revealAll) return true; const s = G.sim; for (let y = ty; y < ty + sz; y++) for (let x = tx; x < tx + sz; x++) if (x >= 0 && y >= 0 && x < s.W && y < s.H && G.exp[y * s.W + x]) return true; return false; }

// ---------------- minimap ----------------
let mmCv = null, mmImg = null, mmT = 0;
function mmInit() { const s = G.sim; mmCv = document.createElement('canvas'); mmCv.width = s.W; mmCv.height = s.H; mmImg = mmCv.getContext('2d').createImageData(s.W, s.H); }
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function drawMini(now) {
  const m = $('mini'), c = m.getContext('2d'), s = G.sim, W = s.W, H = s.H, d = mmImg.data;
  if (now - mmT > 400) {
    mmT = now;
    for (let i = 0; i < W * H; i++) {
      const tr = s.terr[i], g = tr === 1 ? [52, 112, 160] : tr === 2 ? [120, 160, 150] : GROUND_COLS[s.ground[i]], h = tr ? 0 : s.hgt[i] * 16;
      d[i * 4] = Math.min(255, g[0] + h); d[i * 4 + 1] = Math.min(255, g[1] + h); d[i * 4 + 2] = g[2]; d[i * 4 + 3] = 255;
    }
    const put = (i, rgb) => { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; };
    const RC = { tree: [30, 66, 24], gold: [240, 200, 70], stone: [170, 170, 165], berry: [190, 60, 80] };
    for (const e of s.ents) {
      if (e.dead) continue;
      if (e.k === 'r') { if (!e.mob) put(e.ty * W + e.tx, RC[e.t]); }
      else if (e.k === 'b') { if (!canSee(e)) continue; const col = hexRGB(s.players[e.o].color); for (let y = e.ty; y < e.ty + e.sz; y++) for (let x = e.tx; x < e.tx + e.sz; x++) put(y * W + x, col); }
    }
    for (const e of s.ents) if (e.k === 'u' && !e.dead && canSee(e)) { const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE); if (tx >= 0 && ty >= 0 && tx < W && ty < H) put(ty * W + tx, e.o === GAIA ? [150, 60, 40] : hexRGB(shadeHex(s.players[e.o].color))); }
    if (!G.revealAll) for (let i = 0; i < W * H; i++) { if (!G.exp[i]) { d[i * 4] = 8; d[i * 4 + 1] = 9; d[i * 4 + 2] = 12; } else if (!G.vis[i]) { d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.55; } }
    mmCv.getContext('2d').putImageData(mmImg, 0, 0);
  }
  c.imageSmoothingEnabled = false; c.drawImage(mmCv, 0, 0, m.width, m.height);
  const k = m.width / (W * TILE);
  c.strokeStyle = '#fff'; c.lineWidth = 1.5 * DPR; c.beginPath();
  [[0, 0], [VW, 0], [VW, VH], [0, VH]].forEach(([sx, sy], i) => { const [wx, wy] = toWorld(sx, sy); if (i) c.lineTo(wx * k, wy * k); else c.moveTo(wx * k, wy * k); });
  c.closePath(); c.stroke();
  for (const p of G.pings) { const k = ((now - p.t0) % 900) / 900; c.strokeStyle = p.c; c.lineWidth = 2 * DPR; c.globalAlpha = 1 - k; c.beginPath(); c.arc(p.x * (m.width / (W * TILE)), p.y * (m.width / (W * TILE)), (3 + k * 10) * DPR, 0, TAU); c.stroke(); c.globalAlpha = 1; }
}
const lighter = {}; function shadeHex(h) { if (lighter[h]) return lighter[h]; const [r, g, b] = hexRGB(h); return (lighter[h] = '#' + [r, g, b].map(v => Math.min(255, (v + (255 - v) * 0.35) | 0).toString(16).padStart(2, '0')).join('')); }

// ===================== FRAME =====================
function frame(now) {
  if (!G) return;
  const dt = Math.min(250, now - G.last); G.last = now; G.lastFrame = now; gfxAuto(dt);
  if (!G.paused) advance(dt);
  // camera keys / edge scroll
  const sp = 700 * dt / 1000 / G.z;
  if (G.keys.ArrowLeft) G.cam.x -= sp; if (G.keys.ArrowRight) G.cam.x += sp; if (G.keys.ArrowUp) G.cam.y -= sp; if (G.keys.ArrowDown) G.cam.y += sp;
  if (G.mouse.in && !IS_TOUCH && document.hasFocus()) { const m = G.mouse, e = 10; if (m.x < e) G.cam.x -= sp; if (m.x > VW - e) G.cam.x += sp; if (m.y < e) G.cam.y -= sp; if (m.y > VH - e) G.cam.y += sp; }
  clampCam();
  G.sel = G.sel.filter(id => { const e = G.sim.byId.get(id); return e && !e.dead && canSee(e); });
  render(now); drawMini(now); hud(now); workSounds(now); tutTick(now);
  requestAnimationFrame(frame);
}

// keep the simulation going when the tab is hidden (requestAnimationFrame stops there)
setInterval(() => { if (!G || G.paused) return; const now = performance.now(); if (now - (G.lastFrame || 0) > 300) { const dt = Math.min(1000, now - G.last); G.last = now; advance(dt); } }, 100);
// ===================== HUD =====================
let hudT = 0, hudSig = '', delArm = 0;
function addMsg(t, al) { const d = document.createElement('div'); d.className = 'msg' + (al ? ' al' : ''); d.textContent = t; $('msgs').appendChild(d); setTimeout(() => d.remove(), 4000); while ($('msgs').children.length > 4) $('msgs').firstChild.remove(); }
function selEnts() { return G.sel.map(id => G.sim.byId.get(id)).filter(Boolean); }
function hud(now) {
  if (now - hudT < 120) return; hudT = now;
  const s = G.sim, p = s.players[G.me];
  const set = (id, v) => { const e = $(id).lastChild; if (e.textContent !== v) e.textContent = v; };
  set('rf', '' + Math.floor(p.res.f)); set('rw', '' + Math.floor(p.res.w)); set('rg', '' + Math.floor(p.res.g)); set('rst', '' + Math.floor(p.res.s));
  set('rp', p.pop + '/' + p.popCap); $('rp').style.color = p.pop >= p.popCap ? '#ff8a8a' : '';
  $('age').textContent = CIVS[p.civ].flag + ' ' + AGE_NAMES[p.age];
  const sec = Math.floor(s.tick / TPS); $('clock').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  let idle = 0; for (const e of s.ents) if (e.k === 'u' && e.o === G.me && e.t === 'koylu' && e.st === 'idle') idle++;
  const n = $('sbIdle').firstElementChild; n.style.display = idle ? '' : 'none'; n.textContent = idle;
  $('sbBox').classList.toggle('on', G.boxMode);
  $('place').style.display = G.placing && IS_TOUCH ? 'flex' : 'none';
  infoPanel(); grpUpdate();
  const sig = cmdSig(); if (sig !== hudSig) { hudSig = sig; cmdPanel(); }
}
function infoPanel() {
  const s = G.sim, es = selEnts(), el = { set innerHTML(h) { const d = $('info'); if (d._h !== h) { d._h = h; d.innerHTML = h; } }, querySelectorAll() { return []; } };
  if (!es.length) { const p = s.players[G.me]; el.innerHTML = `<div class="inf-h"><div class="inf-ic" style="border-color:${p.color}">${CIVS[p.civ].flag}</div><div><div class="inf-n">${esc(CIVS[p.civ].n)}</div><div class="inf-s">${esc(p.name)} · ${AGE_NAMES[p.age]}</div></div></div><div class="stats" style="color:var(--mut)">${G.placing ? 'Binayı yerleştirmek için haritaya ' + (IS_TOUCH ? 'dokun' : 'tıkla') : (IS_TOUCH ? 'Birime dokunarak seç' : 'Seçmek için tıkla veya sürükle')}</div>`; return; }
  const e = es[0];
  if (es.length > 1) {
    const cnt = {}; for (const u of es) cnt[u.t] = (cnt[u.t] || 0) + 1;
    el.innerHTML = `<div class="inf-n">${es.length} birim seçili</div><div class="multi">${Object.keys(cnt).map(t => `<span class="mu" data-t="${t}">${UT[t] ? UT[t].ico : '❔'} ${cnt[t]}</span>`).join('')}</div>`;
    el.querySelectorAll('.mu').forEach(m => m.onclick = () => { G.sel = es.filter(u => u.t === m.dataset.t).map(u => u.id); hudSig = ''; });
    return;
  }
  const owner = e.o >= 0 ? s.players[e.o] : null, bc = owner ? owner.color : e.o === GAIA ? '#c0532c' : '#777';
  if (e.k === 'r') { const k = RESK[e.t]; const hint = e.mob && e.live ? (e.t === 'boar' ? 'Tehlikeli! Birkaç köylüyle avla.' : 'Köylüyle kes, sonra eti topla.') : ''; el.innerHTML = `<div class="inf-h"><div class="inf-ic">${{ tree: '🌳', gold: '🪙', stone: '🪨', berry: '🫐', deer: '🐑', boar: '🐗' }[e.t]}</div><div><div class="inf-n">${{ tree: 'Ağaç', gold: 'Altın madeni', stone: 'Taş ocağı', berry: 'Meyve çalısı', deer: 'Koyun', boar: 'Yaban domuzu' }[e.t]}${e.mob && !e.live ? ' (av)' : ''}</div><div class="inf-s">${e.amt} ${RES_INFO[k].n}</div></div></div>${hint ? `<div class="stats" style="color:var(--mut)">${hint}</div>` : ''}`; return; }
  if (e.k === 'u') {
    const st = owner ? uStat(owner, e.t) : monStat(e.t);
    let extra = '';
    if (e.t === 'koylu' && e.o === G.me) extra = e.carry ? `Taşıyor: ${e.carry} ${RES_INFO[e.ck].i}` : ({ idle: 'Boşta', gather: 'Topluyor', build: 'İnşa ediyor', move: 'Yürüyor', return: 'Taşıyor', attack: 'Saldırıyor' }[e.st] || '');
    if (e.t !== 'koylu' && e.o === G.me) extra = ['Saldırgan', 'Savunma', 'Yerinde'][e.sn] || '';
    el.innerHTML = `<div class="inf-h"><div class="inf-ic" style="border-color:${bc}">${st.ico}</div><div><div class="inf-n">${st.n}</div><div class="inf-s">${e.o === G.me ? '' : esc(owner ? owner.name : '🐾 Vahşi')}</div><div class="hpb"><i style="width:${100 * e.hp / e.maxhp}%"></i></div><div class="inf-s">${Math.ceil(e.hp)}/${e.maxhp}</div></div></div><div class="stats"><span>⚔️ ${st.atk}</span><span>🛡️ ${st.ar}/${st.pa}</span>${st.rng ? `<span>🎯 ${st.rng}</span>` : ''}<span>${extra}</span>${e.o === G.me ? '<button class="tb mini" data-all="1">👥 Tümü</button>' : ''}</div>`;
    return;
  }
  const st = bStat(owner, e.t);
  let h = `<div class="inf-h"><div class="inf-ic" style="border-color:${bc}">${st.ico}</div><div><div class="inf-n">${st.n}</div><div class="inf-s">${e.o === G.me ? '' : esc(owner ? owner.name : '🐾 Vahşi')}</div><div class="hpb"><i style="width:${100 * e.hp / e.maxhp}%"></i></div><div class="inf-s">${Math.ceil(e.hp)}/${e.maxhp}</div></div></div>`;
  if (e.built && st.gar && allied(e.o)) h += `<div class="stats"><span>🛡 Garnizon ${e.gl.length}/${st.gar}</span>${st.atk ? `<span>⚔️ ${st.atk}${e.gl.length ? '+' + Math.min(10, e.gl.length) : ''}</span><span>🎯 ${st.rng}</span>` : ''}</div>`;
  if (!e.built) h += `<div class="stats">İnşaat: %${Math.floor(100 * e.prog / (st.t * TPS))}</div>`;
  else if (e.o === G.me && e.q.length) {
    h += `<div class="q">${e.q.map((it, i) => `<div class="qi" data-i="${i}" title="İptal">${it.k === 'u' ? UT[it.id].ico : TECH[it.id].ico}${i === 0 ? `<i style="width:${100 * (1 - it.left / it.tot)}%"></i>` : ''}</div>`).join('')}</div>`;
    if (e.wait) h += `<div class="stats" style="color:#ff9b9b">Nüfus dolu — ev inşa et!</div>`;
  } else if (st.atk && !st.gar) h += `<div class="stats"><span>⚔️ ${st.atk}</span><span>🎯 ${st.rng}</span></div>`;
  el.innerHTML = h;
  el.querySelectorAll('.qi').forEach(q => q.onclick = () => issue(['cq', e.id, +q.dataset.i]));
}
// --- command buttons ---
const HK = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v'];
let CMDS = [];
function cmdList() {
  const s = G.sim, p = s.players[G.me], es = selEnts().filter(e => e.o === G.me);
  const out = [];
  if (!es.length) return out;
  const vil = es.filter(e => e.k === 'u' && e.t === 'koylu');
  const units = es.filter(e => e.k === 'u');
  const mil = units.filter(u => u.t !== 'koylu');
  if (vil.length) {
    const list = G.bpage === 'eco' ? BUILD_ECO : BUILD_MIL;
    for (const t of list) { const b = BT[t]; out.push({ key: t, ic: b.ico, lb: b.n, cost: b.cost, lock: p.age < b.age ? AGE_NAMES[b.age] : '', tip: `<b>${b.n}</b> — ${costStr(b.cost)}${b.wall ? ' (her parça)' : ''}<br>${bldDesc(t)}`, on: G.placing === t, fn: () => startPlace(t) }); }
    out.push(G.bpage === 'eco' ? { key: 'page_mil', ic: '⚔️', lb: 'Askeri ›', tip: 'Askeri binalar', fn: () => { G.bpage = 'mil'; hudSig = ''; } } : { key: 'page_eco', ic: '🏠', lb: '‹ Ekonomi', tip: 'Ekonomik binalar', fn: () => { G.bpage = 'eco'; hudSig = ''; } });
  }
  if (units.length) {
    if (mil.length) {
      const sn = mil.every(u => u.sn === mil[0].sn) ? mil[0].sn : -1;
      const ST = [['⚔️', 'Saldırgan', 'Görüş alanındaki düşmanı kovalar'], ['🛡️', 'Savunma', 'Saldırır ama yerinden fazla uzaklaşmaz'], ['🧱', 'Yerinde', 'Hiç hareket etmez, sadece menzildekine saldırır']];
      ST.forEach(([ic, lb, d], i) => out.push({ key: 'sn' + i, ic, lb, on: sn === i, tip: `<b>${lb}</b><br>${d}`, fn: () => issue(['sn', mil.map(u => u.id), i]) }));
    }
    out.push({ key: 'gar', ic: '🏰', lb: 'Gir', tip: '<b>Garnizon</b><br>En yakın Şehir Merkezi, kule veya kaleye girer. İçerideki her birim bina oklarını güçlendirir ve iyileşir.', fn: () => garrisonNearest(units) });
    out.push({ key: 'stop', ic: '✋', lb: 'Dur', tip: 'Dur', fn: () => issue(['st', units.map(u => u.id)]) });
    out.push({ key: 'del', ic: '🗑️', lb: 'Sil', tip: 'Seçili birimleri sil (iki kez bas)', fn: () => armDelete(units.map(u => u.id)) });
    return out;
  }
  if (es.length === 1 && es[0].k === 'b') {
    const b = es[0], bt = BT[b.t];
    if (b.built) {
      for (const t0 of bt.trains || []) {
        const t = trainType(p, t0), u = uStat(p, t);
        out.push({ key: t, ic: u.ico, lb: u.n, cost: u.cost, lock: p.age < UT[t].age ? AGE_NAMES[UT[t].age] : '', tip: `<b>${u.n}</b> — ${costStr(u.cost)}<br>${unitDesc(p, t)}`, fn: (ev) => trainBtn(b, t, ev && ev.shiftKey ? 5 : 1) });
      }
      for (const t0 of bt.techs || []) {
        const tid = techKey(p, t0);
        if (p.tech[tid] || (tid === 'cag2' && p.age >= 2) || (tid === 'cag3' && p.age >= 3)) continue;
        const T = TECH[tid], busy = !!p.researching[tid];
        let lock = tid === 'cag3' && p.age < 2 ? AGE_NAMES[2] : (tid !== 'cag2' && tid !== 'cag3' && p.age < T.age) ? AGE_NAMES[T.age] : '';
        if (!lock && T.req && !p.tech[T.req]) lock = TECH[T.req].n;
        out.push({ key: tid, ic: T.ico, lb: busy ? '…' : T.n, cost: T.cost, lock, tip: `<b>${T.n}</b> — ${costStr(T.cost)}<br>${T.d}`, fn: () => techBtn(b, tid) });
      }
      if (b.t === 'tc') out.push(p.bell ? { key: 'bell', ic: '🔕', lb: 'Alarmı bitir', tip: 'Saklanan köylüler işlerine döner', fn: () => issue(['bell', 0]) } : { key: 'bell', ic: '🔔', lb: 'Alarm', tip: '<b>Kasaba alarmı</b><br>Yakındaki tüm köylüler en yakın Şehir Merkezi, kule veya kaleye saklanır', fn: () => issue(['bell', 1]) });
      if (b.gl && b.gl.length) out.push({ key: 'ug', ic: '⏏️', lb: 'Çıkar (' + b.gl.length + ')', tip: 'İçerideki birimleri dışarı çıkar', fn: () => issue(['ug', b.id]) });
      if (bt.trains) out.push({ key: 'rally', ic: '🚩', lb: 'Toplanma', tip: 'Toplanma noktası: sonra haritaya ' + (IS_TOUCH ? 'dokun' : 'tıkla (veya sağ tık)'), on: G.rally, fn: () => { G.rally = !G.rally; G.placing = null; hudSig = ''; } });
    }
    out.push({ key: 'del', ic: '🗑️', lb: 'Yık', tip: 'Binayı yık (iki kez bas)', fn: () => armDelete([b.id]) });
  }
  return out;
}
function garrisonNearest(units) {
  const s = G.sim; let best = null, bd = 1e15;
  const u0 = units[0];
  for (const b of s.ents) if (b.k === 'b' && !b.dead && b.o === G.me && b.built && BT[b.t].gar && units.some(u => canEnter(u, b)) && garCap(s, b) > 0) {
    const dx = b.x - u0.x, dy = b.y - u0.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; }
  }
  if (!best) { addMsg('Girilecek bina yok (Şehir Merkezi, kule veya kale)'); return; }
  issue(['gr', units.map(u => u.id), best.id]); G.marks.push({ x: best.x, y: best.y, c: '#7CFC7C', t: performance.now() });
}
function bldDesc(t) { return { ev: '+5 nüfus', ciftlik: 'Sonsuz yemek kaynağı (1 köylü)', degirmen: 'Yemek bırakma noktası; çiftlik teknolojileri', depo: 'Odun, altın, taş bırakma noktası; teknolojiler', tc: 'Köylü üretir, çağ atlatır, ok atar, +5 nüfus, 10 kişilik garnizon', kisla: 'Kılıçlı ve mızrakçı', menzil: 'Okçu', ahir: 'Atlı birimler', atolye: 'Koçbaşı ve mancınık', demirci: 'Saldırı ve zırh geliştirmeleri', kule: 'Yakındaki düşmanlara ok atar, 5 kişilik garnizon', kale: 'Özel birim ve özel teknoloji, güçlü savunma, 20 kişilik garnizon', palisat: 'Ucuz ahşap duvar. ' + (IS_TOUCH ? 'Başlangıç ve bitiş noktasına dokun, sonra ✓.' : 'Başlangıca tıkla, bitişe tıkla.'), sur: 'Sağlam taş duvar. ' + (IS_TOUCH ? 'Başlangıç ve bitiş noktasına dokun, sonra ✓.' : 'Başlangıca tıkla, bitişe tıkla.'), kapi: 'Senin ve müttefiklerinin birimleri geçer, düşman geçemez' }[t] || ''; }
function unitDesc(p, t) { const u = uStat(p, t); const b = Object.keys(u.bonus || {}).map(k => ({ cav: 'atlılara', arch: 'okçulara', inf: 'piyadeye', bld: 'binalara', siege: 'kuşatmaya' }[k] + ' +' + u.bonus[k])).join(', '); return `Can ${u.hp} · Saldırı ${u.atk}${u.rng ? ' · Menzil ' + u.rng : ''} · Zırh ${u.ar}/${u.pa}${b ? '<br>Bonus: ' + b : ''}${u.onlyBld ? '<br>Sadece binalara saldırır' : ''}`; }
function cmdSig() {
  const p = G.sim.players[G.me];
  let s = G.sel.join(',') + '|' + G.bpage + '|' + p.age + '|' + (G.placing || '') + G.rally + '|' + Object.keys(p.tech).join() + Object.keys(p.researching).join();
  for (const e of selEnts()) { if (e.k === 'b') s += (e.built ? 'B' : 'u') + e.gl.length; else s += e.sn; }
  s += p.bell ? 'bell' : '' ; s += G.tut ? 'T' + G.tut.i : '';
  // affordability bits
  const c = CMDS.map(x => x.cost ? (afford(p, x.cost) ? 1 : 0) : 2).join('');
  return s + c + ':' + CMDS.length;
}
function cmdPanel() {
  CMDS = cmdList();
  if (!IS_TOUCH) hideTip();
  const p = G.sim.players[G.me], el = $('cmds');
  el.innerHTML = '';
  CMDS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'cb' + (c.lock ? ' lock' : c.cost && !afford(p, c.cost) ? ' no' : '') + (c.on ? ' on' : '');
    b.innerHTML = `<span class="hk">${(HK[i] || '').toUpperCase()}</span><span class="ic">${c.ic}</span><span class="lb">${c.lock ? '🔒 ' + c.lock : c.cost ? costStr(c.cost) : c.lb}</span>`;
    if (G.tut && tutHL(c.key)) b.classList.add('pulse');
    b.onclick = (ev) => { sfx('click'); if (c.lock) { addMsg(c.lock + ' gerekli'); return; } c.fn(ev); hudSig = ''; if (IS_TOUCH) showTip(c.tip, 1600); };
    b.onpointerenter = (ev) => { if (ev.pointerType === 'mouse' && !IS_TOUCH) showTip(c.tip); };
    b.onpointerleave = () => hideTip();
    el.appendChild(b);
  });
  // recompute signature after build
  hudSig = cmdSig();
}
let tipTO = 0;
function showTip(h, ms) { const t = $('tip'); t.innerHTML = h || ''; t.style.display = h ? 'block' : 'none'; clearTimeout(tipTO); if (ms) tipTO = setTimeout(hideTip, ms); }
function hideTip() { $('tip').style.display = 'none'; }
function armDelete(ids) {
  if (Date.now() - delArm < 2500) { issue(['dl', ids]); delArm = 0; G.sel = []; }
  else { delArm = Date.now(); addMsg('Silmek için tekrar bas'); }
}
function trainBtn(b, t, n) {
  const p = G.sim.players[G.me], u = uStat(p, t);
  if (!afford(p, u.cost)) { addMsg('Yetersiz kaynak: ' + costStr(u.cost)); return; }
  if (b.q.length >= 5) { addMsg('Üretim sırası dolu'); return; }
  issue(['tr', b.id, t, n]);
}
function techBtn(b, tid) {
  const p = G.sim.players[G.me], T = TECH[tid];
  if (p.researching[tid]) { addMsg('Zaten araştırılıyor'); return; }
  if (!ageReqMet(G.sim, p, tid)) { addMsg(tid === 'cag2' ? 'Önce 2 bina gerekli: Depo, Değirmen veya Kışla' : 'Önce 2 bina gerekli: Menzil, Ahır veya Atölye', 1); return; }
  if (!afford(p, T.cost)) { addMsg('Yetersiz kaynak: ' + costStr(T.cost)); return; }
  issue(['rs', b.id, tid]);
}
function startPlace(t) {
  const p = G.sim.players[G.me];
  if (!afford(p, BT[t].cost)) { addMsg('Yetersiz kaynak: ' + costStr(BT[t].cost)); return; }
  G.placing = G.placing === t ? null : t; G.rally = false; G.wallStart = null;
  if (G.placing && BT[t].wall) addMsg(IS_TOUCH ? 'Duvarın başlangıcına, sonra bitişine dokun ve ✓ bas' : 'Duvarın başlangıcına tıkla, sonra bitişine tıkla');
  if (G.placing && IS_TOUCH) {
    // start the ghost on the nearest free spot around the screen centre
    const [wx, wy] = toWorld(VW / 2, (VH - 130) / 2), sz = BT[t].sz, gx = Math.floor(wx / TILE) - (sz >> 1), gy = Math.floor(wy / TILE) - (sz >> 1);
    G.ghost = [gx, gy];
    if (!BT[t].wall) for (const [dx, dy] of SPIRAL) { const x = gx + dx, y = gy + dy; if (canPlace(G.sim, G.me, t, x, y) && isExpTile(x, y, sz)) { G.ghost = [x, y]; break; } }
  }
}
function tryPlace(keep, confirm) {
  if (!G.placing || !G.ghost) return;
  const s = G.sim, t = G.placing, [tx, ty] = G.ghost;
  const vils = selEnts().filter(e => e.k === 'u' && e.o === G.me && e.t === 'koylu');
  if (!vils.length) { G.placing = null; return; }
  if (BT[t].wall) {
    if (!G.wallStart && !confirm) { G.wallStart = [tx, ty]; return; }
    const st = G.wallStart || [tx, ty];
    const tiles = wallLine(st[0], st[1], tx, ty).filter(([x, y]) => canPlace(s, G.me, t, x, y));
    if (!tiles.length) { addMsg('Buraya duvar yapılamaz', 1); return; }
    if (!afford(s.players[G.me], BT[t].cost)) { addMsg('Yetersiz kaynak'); return; }
    issue(['wl', vils.map(v => v.id), t, st[0], st[1], tx, ty]);
    G.marks.push({ x: tx * TILE + 16, y: ty * TILE + 16, c: '#7CFC7C', t: performance.now() });
    G.wallStart = null; if (!keep) G.placing = null; hudSig = ''; return;
  }
  if (!canPlace(s, G.me, t, tx, ty) || !isExpTile(tx, ty, BT[t].sz)) { addMsg('Buraya inşa edilemez', 1); return; }
  if (!afford(s.players[G.me], BT[t].cost)) { addMsg('Yetersiz kaynak'); G.placing = null; return; }
  issue(['bd', vils.map(v => v.id), t, tx, ty]);
  G.marks.push({ x: (tx + BT[t].sz / 2) * TILE, y: (ty + BT[t].sz / 2) * TILE, c: '#7CFC7C', t: performance.now() });
  if (!keep) G.placing = null;
  hudSig = '';
}

// ===================== INPUT =====================
function pick(wx, wy, touch) {
  const s = G.sim, tol = (touch ? 18 : 6) / G.z, [px, py] = w2v(wx, wy);
  let best = null, bd = 1e9;
  for (const e of s.ents) {
    if (e.dead || !(e.k === 'u' || e.mob) || !canSee(e)) continue;
    const [vx, vy] = w2v(e.x, e.y), hh = ART.ok && e.k === 'u' ? (UNIT_H[e.t] || 34) * 0.45 : 7, dx = vx - px, dy = vy - hh - py, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= e.r + hh + tol && d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  for (const e of s.ents) {
    if (e.dead || e.k === 'u' || e.mob || !canSee(e)) continue;
    let hit = false;
    if (wx >= e.tx * TILE && wx <= (e.tx + e.sz) * TILE && wy >= e.ty * TILE && wy <= (e.ty + e.sz) * TILE) hit = true;
    else {
      const ht = e.k === 'b' ? (ISO ? isoHt(e.t) : 10) : (e.t === 'tree' ? 22 : 10), pad = e.k === 'r' ? tol * 0.6 : tol * 0.3;
      const c1 = w2v(e.tx * TILE, e.ty * TILE), c2 = w2v((e.tx + e.sz) * TILE, e.ty * TILE), c3 = w2v(e.tx * TILE, (e.ty + e.sz) * TILE), c4 = w2v((e.tx + e.sz) * TILE, (e.ty + e.sz) * TILE);
      const x0 = Math.min(c1[0], c2[0], c3[0], c4[0]) - pad, x1 = Math.max(c1[0], c2[0], c3[0], c4[0]) + pad, y0 = Math.min(c1[1], c2[1], c3[1], c4[1]) - ht - pad, y1 = Math.max(c1[1], c2[1], c3[1], c4[1]) + pad;
      if (e.k === 'b' && ISO) { const cx = (x0 + x1) / 2, w = (x1 - x0) / 2 * 0.86; if (px >= cx - w && px <= cx + w && py >= y0 && py <= y1) hit = true; }
      else if (px >= x0 && px <= x1 && py >= y0 && py <= y1) hit = true;
    }
    if (hit) { const [vx, vy] = w2v(e.x, e.y), d = Math.abs(vx - px) + Math.abs(vy - py) * 0.5 + (e.k === 'r' ? 20 : 0); if (d < bd) { bd = d; best = e; } }
  }
  return best;
}
function onScreen(e) { const [sx, sy] = toScreen(e.x, e.y); return sx >= 0 && sx <= VW && sy >= 0 && sy <= VH; }
function selectSame(e) {
  G.sel = G.sim.ents.filter(u => !u.dead && !u.gar && u.k === 'u' && u.o === G.me && u.t === e.t && onScreen(u)).map(u => u.id);
}
function boxSelect(b) {
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
  const us = G.sim.ents.filter(e => { if (e.dead || e.gar || e.k !== 'u' || e.o !== G.me) return false; const [sx, sy] = toScreen(e.x, e.y); return sx >= x0 && sx <= x1 && sy - 6 >= y0 - 8 && sy - 6 <= y1 + 8; });
  if (us.length) { G.sel = us.map(u => u.id); G.bpage = 'eco'; }
}
function miniNav(e) { if (!G) return; const m = $('mini'), r = m.getBoundingClientRect(); const k = (G.sim.W * TILE) / r.width; centerOn((e.clientX - r.left) * k, (e.clientY - r.top) * k); }
function tutMark(c, now) {
  if (!G.tut) return; const st = TUT[G.tut.i]; if (!st.mark) return;
  const e = st.mark(); if (!e) return;
  const [ex, ey] = w2v(e.x, e.y);
  const b = Math.sin(now / 160) * 6, y = (e.k === 'u' ? ey - 30 : ey - 36) + b, x = ex, k = 1 / Math.max(0.6, G.z);
  c.fillStyle = '#ffd34d'; c.strokeStyle = '#3a2a10'; c.lineWidth = 2 * k;
  c.beginPath(); c.moveTo(x, y + 12 * k); c.lineTo(x - 10 * k, y - 2 * k); c.lineTo(x - 4 * k, y - 2 * k); c.lineTo(x - 4 * k, y - 14 * k); c.lineTo(x + 4 * k, y - 14 * k); c.lineTo(x + 4 * k, y - 2 * k); c.lineTo(x + 10 * k, y - 2 * k); c.closePath(); c.fill(); c.stroke();
}
function fxSounds(s) {
  const inV = (f) => { const [sx, sy] = toScreen(f.x, f.y); return sx > -80 && sx < VW + 80 && sy > -80 && sy < VH + 80; };
  for (const f of s.fx) {
    if (f.k === 'done' || f.k === 'train') { if (f.o === G.me) sfx(f.k); continue; }
    if (f.k === 'stump') { addDecal({ k: 'stump', x: f.x, y: f.y, v: (Math.random() * 4) | 0 }); continue; }
    if (f.k === 'boom') { const p = []; const n = 6 + f.sz * 4; for (let i = 0; i < n; i++) p.push([(Math.random() - 0.5) * f.sz * 30, (Math.random() - 0.5) * f.sz * 30, ['#8d826c', '#6e655a', '#a39a86', '#5a3d22'][(Math.random() * 4) | 0], 3 + Math.random() * 6]); addDecal({ k: 'rubble', x: f.x, y: f.y, p }); }
    if (f.k === 'arrow' && Math.random() < 0.4) addDecal({ k: 'mark', x: f.tx + (Math.random() - 0.5) * 18, y: f.ty + (Math.random() - 0.5) * 18, t0: performance.now() + 280, a: Math.random() < 0.5 ? -1 : 1 });
    if (!inV(f) || !(G.revealAll || isVis(f.x, f.y))) continue;
    if (f.k === 'arrow') sfx('arrow', 0.6); else if (f.k === 'rock') sfx('thud'); else if (f.k === 'hit') sfx(f.b ? 'thud' : 'sword', f.b ? 0.5 : 1);
    else if (f.k === 'die' || f.k === 'adie') sfx('die'); else if (f.k === 'boom') sfx('boom');
  }
  for (const e of s.ev) { if (e.alert && e.o === G.me) sfx('alert'); if (e.age) sfx('age'); }
}
function workSounds(now) {
  if (now - workT < 420 || !SND.on) return; workT = now;
  const s = G.sim, [cx, cy] = toWorld(VW / 2, VH / 2), r = Math.max(VW, VH) / G.z / 2;
  let best = null, bd = r * r;
  for (const e of s.ents) if (e.k === 'u' && !e.gar && e.work === s.tick && allied(e.o)) { const dx = e.x - cx, dy = e.y - cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } }
  if (!best) return;
  const v = 0.45 * (1 - Math.sqrt(bd) / r) + 0.15;
  if (best.st === 'build') sfx('build', v); else if (best.ck === 'w') sfx('chop', v); else if (best.ck === 'g' || best.ck === 's') sfx('pick', v);
}

function selectAt(wx, wy, add, dbl, touch) {
  const e = pick(wx, wy, touch);
  if (!e) { if (!add) G.sel = []; hudSig = ''; return; }
  if (dbl && e.k === 'u' && e.o === G.me) { selectSame(e); return; }
  if (add && e.o === G.me && e.k === 'u') {
    const own = G.sel.every(id => { const x = G.sim.byId.get(id); return x && x.o === G.me && x.k === 'u'; });
    if (!own) G.sel = [];
    const i = G.sel.indexOf(e.id); if (i >= 0) G.sel.splice(i, 1); else G.sel.push(e.id);
  } else G.sel = [e.id];
  G.bpage = 'eco'; G.placing = null; G.rally = false;
}

function command(wx, wy, touch) {
  const s = G.sim, es = selEnts().filter(e => e.o === G.me);
  if (!es.length) return;
  const t = pick(wx, wy, touch);
  const units = es.filter(e => e.k === 'u');
  const now = performance.now();
  if (!units.length) { // rally for building
    const b = es[0]; if (b.k === 'b' && b.built && BT[b.t].trains) { issue(['ry', b.id, Math.round(wx), Math.round(wy), t && (t.k === 'r' || (t.t === 'ciftlik' && t.o === G.me)) ? t.id : 0]); G.marks.push({ x: wx, y: wy, c: '#fff', t: now }); }
    return;
  }
  const ids = units.map(u => u.id);
  if (t && t.k !== 'r' && isEnemy(s, G.me, t.o)) { issue(['at', ids, t.id]); G.marks.push({ x: t.x, y: t.y, c: '#ff5050', t: now }); return; }
  if (t && t.k === 'r') { issue(['ga', ids, t.id]); G.marks.push({ x: t.x, y: t.y, c: '#ffe066', t: now }); return; }
  if (t && t.k === 'b' && t.o === G.me) {
    const vil = units.filter(u => u.t === 'koylu');
    if (vil.length && (!t.built || t.hp < t.maxhp || t.t === 'ciftlik')) {
      issue(['hb', vil.map(v => v.id), t.id]);
      const rest = units.filter(u => u.t !== 'koylu'); if (rest.length) issue(['mv', rest.map(u => u.id), Math.round(wx), Math.round(wy)]);
      G.marks.push({ x: t.x, y: t.y, c: '#7CFC7C', t: now }); return;
    }
    if (t.built && BT[t.t].gar && units.some(u => canEnter(u, t))) { issue(['gr', ids, t.id]); G.marks.push({ x: t.x, y: t.y, c: '#7CFC7C', t: now }); return; }
    if (vil.length && BT[t.t].drop) { // drop off cargo
      issue(['mv', ids, Math.round(t.x), Math.round(t.y + t.sz * 16 + 8)]); return;
    }
  }
  issue(['mv', ids, Math.round(wx), Math.round(wy)]);
  G.marks.push({ x: wx, y: wy, c: '#7CFC7C', t: now });
}

const ptrs = new Map();
let gest = null, lastTap = { t: 0, x: 0, y: 0 }, lpTimer = 0;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (!G) return;
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.set(e.pointerId, { x, y, sx: x, sy: y });
  hideTip();
  if (e.pointerType === 'mouse') {
    if (e.button === 2) {
      const [wx, wy] = toWorld(x, y);
      if (G.placing) { G.placing = null; G.wallStart = null; hudSig = ''; return; }
      if (G.rally) G.rally = false;
      command(wx, wy, false); return;
    }
    if (e.button === 1) { gest = { m: 'pan', x, y }; return; }
    gest = { m: 'click', x, y };
    return;
  }
  // touch / pen
  if (ptrs.size === 1) {
    gest = G.boxMode ? { m: 'box', x, y } : { m: 'tap', x, y };
    if (gest.m === 'box') G.box = { x0: x, y0: y, x1: x, y1: y };
    clearTimeout(lpTimer);
    const [wx, wy] = toWorld(x, y), hit = !G.boxMode && !G.placing && !G.rally ? pick(wx, wy, true) : null;
    if (hit && hit.k === 'u' && hit.o === G.me) gest.unit = hit; // dragging from an own unit gives an order
    else lpTimer = setTimeout(() => { if (gest && gest.m === 'tap') { gest = { m: 'box', x, y }; G.box = { x0: x, y0: y, x1: x, y1: y }; } }, 420);
  } else if (ptrs.size === 2) {
    clearTimeout(lpTimer); G.box = null;
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    gest = { m: 'pinch', d0: d, z0: G.z, w: [G.cam.x + mx / G.z, G.cam.y + my / G.z] };
  }
});
cv.addEventListener('pointermove', (e) => {
  if (!G) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (e.pointerType === 'mouse') { G.mouse.x = x; G.mouse.y = y; G.mouse.in = true; if (G.placing) { const [wx, wy] = toWorld(x, y), sz = BT[G.placing].sz; G.ghost = [Math.floor(wx / TILE - sz / 2 + 0.5), Math.floor(wy / TILE - sz / 2 + 0.5)]; } }
  const p = ptrs.get(e.pointerId); if (!p) return;
  const px = p.x, py = p.y; p.x = x; p.y = y;
  if (!gest) return;
  if (gest.m === 'click' && Math.hypot(x - gest.x, y - gest.y) > 6 && !G.placing) { gest.m = 'box'; G.box = { x0: gest.x, y0: gest.y, x1: x, y1: y }; }
  else if (gest.m === 'tap' && Math.hypot(x - gest.x, y - gest.y) > 10) {
    clearTimeout(lpTimer);
    if (gest.unit && !gest.unit.dead) { gest.m = 'drag'; if (G.sel.indexOf(gest.unit.id) < 0) { G.sel = [gest.unit.id]; G.bpage = 'eco'; } hudSig = ''; }
    else gest.m = 'pan';
  }
  if (gest.m === 'drag') { G.drag = toWorld(x, y); return; }
  if (gest.m === 'box' && G.box) { G.box.x1 = x; G.box.y1 = y; }
  else if (gest.m === 'pan') { G.cam.x -= (x - px) / G.z; G.cam.y -= (y - py) / G.z; }
  else if (gest.m === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    G.z = Math.max(0.4, Math.min(1.8, gest.z0 * d / gest.d0));
    G.cam.x = gest.w[0] - mx / G.z; G.cam.y = gest.w[1] - my / G.z;
  }
});
function endPtr(e) {
  if (!G) return;
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  clearTimeout(lpTimer);
  if (!gest || !p) return;
  const now = performance.now();
  if (gest.m === 'box') { if (G.box && Math.abs(G.box.x1 - G.box.x0) + Math.abs(G.box.y1 - G.box.y0) > 8) boxSelect(G.box); G.box = null; gest = null; if (G.boxMode && IS_TOUCH) G.boxMode = false; hudSig = ''; return; }
  if (gest.m === 'pinch') { if (ptrs.size === 1) { const [q] = [...ptrs.values()]; gest = { m: 'pan', x: q.x, y: q.y }; } else gest = null; return; }
  if (gest.m === 'drag') { const [wx, wy] = toWorld(p.x, p.y); G.drag = null; gest = null; command(wx, wy, true); hudSig = ''; return; }
  if (gest.m === 'click' && e.pointerType === 'mouse') {
    const [wx, wy] = toWorld(p.x, p.y);
    if (G.placing) tryPlace(e.shiftKey);
    else if (G.pinging) { issue(['pg', Math.round(wx), Math.round(wy)]); G.pinging = false; }
    else if (G.rally) { command(wx, wy, false); G.rally = false; }
    else { const dbl = now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 10; selectAt(wx, wy, e.shiftKey || e.ctrlKey, dbl, false); lastTap = { t: dbl ? 0 : now, x: p.x, y: p.y }; }
    hudSig = '';
  } else if (gest.m === 'tap') {
    const [wx, wy] = toWorld(p.x, p.y);
    const dbl = now - lastTap.t < 330 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 24;
    lastTap = { t: dbl ? 0 : now, x: p.x, y: p.y };
    tapAction(wx, wy, dbl);
    hudSig = '';
  }
  gest = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); gest = null; if (G) { G.box = null; G.drag = null; } });
cv.addEventListener('pointerleave', (e) => { if (G && e.pointerType === 'mouse') G.mouse.in = false; });
cv.addEventListener('wheel', (e) => {
  if (!G) return; e.preventDefault();
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, vx = G.cam.x + x / G.z, vy = G.cam.y + y / G.z;
  G.z = Math.max(0.4, Math.min(1.8, G.z * Math.exp(-e.deltaY * 0.0015)));
  G.cam.x = vx - x / G.z; G.cam.y = vy - y / G.z;
}, { passive: false });
function tapAction(wx, wy, dbl) {
  if (G.placing) {
    const sz = BT[G.placing].sz; G.ghost = [Math.floor(wx / TILE - sz / 2 + 0.5), Math.floor(wy / TILE - sz / 2 + 0.5)];
    if (BT[G.placing].wall && !G.wallStart) G.wallStart = G.ghost.slice();
    return;
  }
  if (G.pinging) { issue(['pg', Math.round(wx), Math.round(wy)]); G.pinging = false; return; }
  if (G.rally) { command(wx, wy, true); G.rally = false; return; }
  const t = pick(wx, wy, true);
  const mine = selEnts().filter(e => e.o === G.me && e.k === 'u');
  if (t && t.o === G.me && t.k === 'u') { if (dbl) selectSame(t); else { G.sel = [t.id]; G.bpage = 'eco'; } return; }
  if (t && t.o === G.me && t.k === 'b') {
    const vil = mine.filter(u => u.t === 'koylu');
    if (vil.length && (!t.built || t.t === 'ciftlik' || t.hp < t.maxhp)) { command(wx, wy, true); return; }
    const mil = mine.filter(u => u.t !== 'koylu');
    if (mil.length && t.built && BT[t.t].gar && mil.some(u => canEnter(u, t))) { command(wx, wy, true); return; }
    G.sel = [t.id]; return;
  }
  if (mine.length) { command(wx, wy, true); return; }
  if (t) { G.sel = [t.id]; return; }
  const sb = selEnts(); if (sb.length === 1 && sb[0].k === 'b' && sb[0].o === G.me) { G.sel = []; return; }
  G.sel = [];
}
// minimap navigation

$('mini').addEventListener('pointerdown', (e) => { $('mini').setPointerCapture(e.pointerId); if (e.button === 2 && G) { const m = $('mini'), r = m.getBoundingClientRect(), k = (G.sim.W * TILE) / r.width; command((e.clientX - r.left) * k, (e.clientY - r.top) * k, false); return; } miniNav(e); $('mini').dataset.d = '1'; });
$('mini').addEventListener('pointermove', (e) => { if ($('mini').dataset.d === '1') miniNav(e); });
$('mini').addEventListener('pointerup', () => { $('mini').dataset.d = ''; });
$('mini').addEventListener('contextmenu', (e) => e.preventDefault());
// keyboard
addEventListener('keydown', (e) => {
  if (!G || !$('game').classList.contains('on')) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  G.keys[e.key] = true;
  const k = e.key.toLowerCase();
  if (k === 'escape') { $('quick').classList.remove('on'); G.pinging = false; $('chat').classList.remove('on'); if (G.placing || G.rally) { G.placing = null; G.rally = false; G.wallStart = null; } else G.sel = []; hudSig = ''; return; }
  if (k === 'delete') { const es = selEnts().filter(x => x.o === G.me); if (es.length) armDelete(es.map(x => x.id)); return; }
  if (k === 'enter') { chatOpen(true); return; }
  if (k === 'h') { $('sbTC').click(); return; }
  if (k === 'b') { quickOpen(); return; }
  if (k === '.') { $('sbIdle').click(); return; }
  if (/^[0-9]$/.test(k)) {
    if (e.ctrlKey || e.metaKey) { G.groups[k] = G.sel.slice(); e.preventDefault(); addMsg('Grup ' + k + ' kaydedildi'); }
    else if (G.groups[k]) grpRecall(k);
    return;
  }
  const i = HK.indexOf(k);
  if (i >= 0 && CMDS[i] && !e.ctrlKey && !e.metaKey) { const c = CMDS[i]; if (c.lock) addMsg(c.lock + ' gerekli'); else c.fn(e); hudSig = ''; }
});
addEventListener('keyup', (e) => { if (G) G.keys[e.key] = false; });
addEventListener('blur', () => { if (G) G.keys = {}; });
// side buttons
let idleIdx = 0;
$('sbIdle').onclick = () => { const v = G.sim.ents.filter(e => e.k === 'u' && e.o === G.me && e.t === 'koylu' && e.st === 'idle'); if (!v.length) { addMsg('Boşta köylü yok'); return; } const u = v[idleIdx++ % v.length]; G.sel = [u.id]; centerOn(u.x, u.y); hudSig = ''; };
$('sbArmy').onclick = () => { const a = G.sim.ents.filter(e => e.k === 'u' && e.o === G.me && e.t !== 'koylu'); G.sel = a.map(u => u.id); if (!a.length) addMsg('Ordun yok'); hudSig = ''; };
$('sbTC').onclick = () => { const t = G.sim.ents.filter(e => e.k === 'b' && e.o === G.me && e.t === 'tc'); if (!t.length) return; const b = t[idleIdx++ % t.length]; G.sel = [b.id]; centerOn(b.x, b.y); hudSig = ''; };
$('sbBox').onclick = () => { G.boxMode = !G.boxMode; };
$('plOk').onclick = () => tryPlace(false, true);
$('plNo').onclick = () => { G.placing = null; G.wallStart = null; hudSig = ''; };
// menu
$('btnMenu').onclick = () => { $('ovMenu').classList.add('on'); if (G.mode === 'sp') G.paused = true; $('omResign').style.display = G.sim.players[G.me].alive ? '' : 'none'; $('omSave').style.display = G.mode === 'sp' ? '' : 'none'; };
$('omResume').onclick = () => { $('ovMenu').classList.remove('on'); G.paused = false; G.last = performance.now(); };
$('omSpeed').onclick = () => { const sp = [1, 1.5, 2, 3]; G.speed = sp[(sp.indexOf(G.speed) + 1) % sp.length]; $('omSpeed').textContent = 'Hız: ' + G.speed + 'x'; };
$('omResign').onclick = () => { issue(['gg']); $('ovMenu').classList.remove('on'); G.paused = false; G.last = performance.now(); };
$('omQuit').onclick = () => { $('ovMenu').classList.remove('on'); quitGame(); };
$('endQuit').onclick = () => { $('ovEnd').classList.remove('on'); quitGame(); };
$('endWatch').onclick = () => { $('ovEnd').classList.remove('on'); };
if (!IS_TOUCH) $('sbBox').style.display = 'none'; else document.body.classList.add('touch');

// ===================== TUTORIAL =====================
function ownE(f) { return G.sim.ents.filter(e => !e.dead && e.o === G.me && f(e)); }
function nearRes(k) { const tc = ownE(e => e.t === 'tc')[0]; if (!tc) return null; return nearestRes(G.sim, k, tc.x, tc.y, TILE * 30); }
const TUT = [
  { t: 'Hoş geldin, komutan!', d: () => 'Bu kısa eğitim ilk adımları gösterir. Önce haritada gezin: ' + (IS_TOUCH ? 'tek parmakla kaydır, iki parmakla yakınlaştır.' : 'ok tuşları veya fareyi ekran kenarına götürerek kaydır, tekerlekle yakınlaştır.') + ' Hazır olunca “Devam”a bas.', manual: true },
  { t: 'Köylü seç', d: () => IS_TOUCH ? 'Hasır şapkalı bir köylüye dokun.' : 'Hasır şapkalı bir köylüye sol tıkla.', ok: () => selEnts().some(e => e.o === G.me && e.t === 'koylu'), mark: () => ownE(e => e.t === 'koylu')[0] },
  { t: 'Odun topla', d: () => 'Köylü seçiliyken bir ağaca ' + (IS_TOUCH ? 'dokun' : 'sağ tıkla') + '. Köylü odunu kesip Şehir Merkezi’ne taşır.', ok: () => ownE(e => e.t === 'koylu' && e.gk === 'w' && (e.st === 'gather' || e.st === 'return')).length > 0, mark: () => nearRes('w') },
  { t: 'Yemek topla', d: () => 'Başka bir köylüyü seç ve kırmızı meyveli çalılara gönder.', ok: () => ownE(e => e.t === 'koylu' && e.gk === 'f' && (e.st === 'gather' || e.st === 'return')).length > 0, mark: () => nearRes('f') },
  { t: 'Köylü üret', d: () => 'Soldaki 🏛️ düğmesiyle Şehir Merkezi’ni seç, sonra 👷 düğmesine bas. 6 köylüye ulaş. Yeni köylüleri de işe gönder!', ok: () => ownE(e => e.t === 'koylu').length >= 6, hl: ['koylu'], side: 'sbTC' },
  { t: 'Ev inşa et', d: () => 'Bir köylü seç, 🏠 Ev düğmesine bas ve haritaya yerleştir' + (IS_TOUCH ? ' (dokun, sonra ✓)' : '') + '. Her ev nüfus sınırını 5 artırır.', ok: () => ownE(e => e.t === 'ev' && e.built).length >= 1, hl: ['ev'] },
  { t: 'Değirmen kur', d: () => 'Meyve çalılarının yanına 🌾 Değirmen kur. Köylüler yemeği daha kısa yoldan taşır.', ok: () => ownE(e => e.t === 'degirmen' && e.built).length >= 1, hl: ['degirmen'], mark: () => nearRes('f') },
  { t: 'Kışla inşa et', d: () => 'Köylü seç → “Askeri ›” sayfası → ⚔️ Kışla.', ok: () => ownE(e => e.t === 'kisla' && e.built).length >= 1, hl: ['kisla', 'page_mil'] },
  { t: 'Asker üret', d: () => 'Kışlayı seç ve 4 asker üret. 🔱 Mızrakçı atlılara karşı iyidir, 🗡️ Kılıçlı her işe yarar.', ok: () => ownE(e => e.k === 'u' && (e.t === 'kilicli' || e.t === 'mizrakci')).length >= 4, hl: ['kilicli', 'mizrakci'] },
  { t: 'Davranış seç', d: () => 'Soldaki ⚔️ düğmesiyle ordunu seç ve 🛡️ Savunma davranışına geçir. Böyle askerler düşmanı uzağa kovalamaz.', ok: () => ownE(e => e.k === 'u' && e.t !== 'koylu' && e.sn === 1).length > 0, hl: ['sn1'], side: 'sbArmy' },
  { t: 'Kale Çağı’na geç', d: () => 'Bir 📦 Depo kur (Değirmen + Depo = 2 bina), sonra Şehir Merkezi’nden 🏯 Kale Çağı’nı araştır. Sana 300 yemek hediye ettim!', on: () => { G.sim.players[G.me].res.f += 300; }, ok: () => G.sim.players[G.me].age >= 2, hl: ['depo', 'cag2'] },
  { t: 'Kendini koru', d: () => 'Köylü seç ve 🪵 Palisat ile üssünün önüne bir duvar çek. Araya bir 🚪 Kapı koy: senin birimlerin geçer, düşman geçemez.', ok: () => ownE(e => e.t === 'palisat' || e.t === 'sur').length >= 5, hl: ['palisat', 'kapi'] },
  { t: 'Düşmanı yen!', d: () => 'Ordunu büyüt (🪵 Koçbaşı binaları hızla yıkar), ⚔️ ile tümünü seç ve düşmanın Şehir Merkezi’ne saldır. Düşman haritanın karşı köşesinde. Saldırı gelirse 🔔 Alarm ile köylülerini sakla.', ok: () => G.sim.over },
];
function tutHL(key) { const st = G.tut && TUT[G.tut.i]; return !!(st && st.hl && key && st.hl.indexOf(key) >= 0); }
function tutShow() {
  const el = $('tut');
  if (!G || !G.tut) { el.style.display = 'none'; document.body.classList.remove('tutOn'); return; }
  const st = TUT[G.tut.i]; el.style.display = 'block'; document.body.classList.add('tutOn');
  $('tutN').textContent = (G.tut.i + 1) + '/' + TUT.length;
  $('tutT').textContent = st.t; $('tutD').textContent = st.d();
  $('tutSkip').textContent = st.manual ? 'Devam ›' : 'Atla ›';
  ['sbTC', 'sbArmy'].forEach(id => $(id).classList.toggle('pulse', st.side === id));
  hudSig = '';
}
function tutNext() {
  G.tut.i++;
  if (G.tut.i >= TUT.length) { G.tut = null; addMsg('🎓 Eğitim tamamlandı! Artık hazırsın.'); sfx('age'); ['sbTC', 'sbArmy'].forEach(id => $(id).classList.remove('pulse')); tutShow(); return; }
  const st = TUT[G.tut.i]; if (st.on) st.on();
  $('tut').classList.remove('min');
  tutShow();
}
let tutT = 0;
function tutTick(now) {
  if (!G.tut || now - tutT < 400) return; tutT = now;
  const st = TUT[G.tut.i];
  if (!st.manual && st.ok()) { sfx('done'); tutNext(); }
}

$('tutSkip').onclick = () => { sfx('click'); tutNext(); };
document.querySelector('#tut .th').onclick = () => { $('tut').classList.toggle('min'); };
$('tutClose').onclick = () => { G.tut = null; ['sbTC', 'sbArmy'].forEach(id => $(id).classList.remove('pulse')); tutShow(); };
$('btnTut').onclick = () => {
  const name = ($('spName').value || T('Komutan')).slice(0, 14);
  const other = CIV_KEYS.filter(k => k !== SP.civ)[(Math.random() * 3) | 0];
  startGame({ players: [{ civ: SP.civ, name }, { civ: other, ai: true, diff: 0, name: CIVS[other].lead }], seed: (Math.random() * 2e9) | 0, me: 0, mode: 'sp', tut: true });
};

$('omGfx').onclick = () => { const m = ['auto', 'high', 'low']; Q.mode = m[(m.indexOf(Q.mode) + 1) % 3]; store.set('gfx', Q.mode); gfxApply(); };
gfxApply();

// info panel clicks (delegated, so re-rendering never swallows a tap)
$('info').addEventListener('click', (ev) => {
  if (!G) return;
  const t = ev.target.closest('[data-t],[data-i],[data-all]'); if (!t) return;
  const es = selEnts();
  if (t.dataset.t) { G.sel = es.filter(u => u.t === t.dataset.t).map(u => u.id); }
  else if (t.dataset.i != null && es.length === 1 && es[0].k === 'b') issue(['cq', es[0].id, +t.dataset.i]);
  else if (t.dataset.all && es[0]) { const ty = es[0].t; G.sel = G.sim.ents.filter(u => !u.dead && !u.gar && u.k === 'u' && u.o === G.me && u.t === ty).map(u => u.id); addMsg(G.sel.length + ' ' + UT[ty].n + ' seçildi'); }
  sfx('click'); hudSig = '';
});
// ---------- quick build menu ----------
function quickOpen() {
  const q = $('quick'); if (q.classList.contains('on')) { q.classList.remove('on'); return; }
  const p = G.sim.players[G.me]; q.innerHTML = '';
  for (const t of BUILD_ECO.concat(BUILD_MIL)) {
    const b = BT[t], el = document.createElement('button'), lock = p.age < b.age;
    el.className = 'cb' + (lock ? ' lock' : !afford(p, b.cost) ? ' no' : '') + (G.tut && tutHL(t) ? ' pulse' : '');
    el.innerHTML = `<span class="ic">${b.ico}</span><span class="lb">${lock ? '🔒 ' + AGE_NAMES[b.age] : costStr(b.cost)}</span>`;
    el.onclick = () => { sfx('click'); if (lock) { addMsg(AGE_NAMES[b.age] + ' gerekli'); return; } q.classList.remove('on'); quickBuild(t); };
    el.onpointerenter = (ev) => { if (ev.pointerType === 'mouse' && !IS_TOUCH) showTip(`<b>${b.n}</b> — ${costStr(b.cost)}<br>${bldDesc(t)}`); };
    el.onpointerleave = () => hideTip();
    q.appendChild(el);
  }
  q.classList.add('on');
}
function quickBuild(t) {
  let vils = selEnts().filter(e => e.k === 'u' && e.o === G.me && e.t === 'koylu');
  if (!vils.length) {
    const [cx, cy] = toWorld(VW / 2, VH / 2);
    const all = G.sim.ents.filter(e => e.k === 'u' && e.o === G.me && e.t === 'koylu' && !e.gar && !e.dead);
    if (!all.length) { addMsg('Köylün yok'); return; }
    const score = (e) => { const dx = e.x - cx, dy = e.y - cy; return dx * dx + dy * dy + (e.st === 'idle' ? 0 : e.st === 'build' ? 4e6 : 1e6); };
    all.sort((a, b) => score(a) - score(b)); G.sel = [all[0].id];
  }
  G.bpage = BUILD_MIL.indexOf(t) >= 0 ? 'mil' : 'eco';
  startPlace(t); hudSig = '';
}
$('sbBuild').onclick = () => { sfx('click'); quickOpen(); };
cv.addEventListener('pointerdown', () => $('quick').classList.remove('on'), true);
// ---------- control groups (on-screen) ----------
function grpRecall(k) {
  const ids = (G.groups[k] || []).filter(id => { const x = G.sim.byId.get(id); return x && !x.dead && !x.gar; });
  if (!ids.length) { addMsg(IS_TOUCH ? 'Grup ' + k + ' boş — kaydetmek için basılı tut' : 'Grup ' + k + ' boş — Ctrl+' + k + ' veya basılı tut'); return; }
  if (G.sel.join() === ids.join()) { const x = G.sim.byId.get(ids[0]); centerOn(x.x, x.y); }
  G.sel = ids.slice(); hudSig = '';
}
function grpSave(k) {
  const ids = selEnts().filter(e => e.o === G.me && e.k === 'u').map(e => e.id);
  if (!ids.length) { addMsg('Önce birim seç'); return; }
  G.groups[k] = ids; addMsg('Grup ' + k + ' kaydedildi (' + ids.length + ')'); sfx('done');
}
function grpUpdate() {
  document.querySelectorAll('.gb').forEach(b => {
    const k = b.dataset.g, ids = (G.groups[k] || []).filter(id => { const x = G.sim.byId.get(id); return x && !x.dead; });
    G.groups[k] = ids; const n = b.querySelector('.n'); const v = ids.length ? '' + ids.length : '';
    if (n.textContent !== v) n.textContent = v; b.classList.toggle('empty', !ids.length);
  });
}
document.querySelectorAll('.gb').forEach(b => {
  let tmr = 0, saved = false;
  b.addEventListener('pointerdown', () => { saved = false; clearTimeout(tmr); tmr = setTimeout(() => { saved = true; grpSave(b.dataset.g); grpUpdate(); }, 500); });
  b.addEventListener('pointerup', () => { clearTimeout(tmr); if (!saved) { sfx('click'); grpRecall(b.dataset.g); } });
  b.addEventListener('pointerleave', () => clearTimeout(tmr));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

$('spMap').value = store.get('map', 'ova');
function viewLabel() { $('omView').textContent = 'Görünüm: ' + (ISO ? 'Çapraz (izometrik)' : 'Üstten'); }
$('omView').onclick = () => { setView(!ISO); viewLabel(); };
viewLabel();

// ===================== CHAT, QUICK MESSAGES, PINGS, TRIBUTE =====================
function hasAllies() { const s = G.sim, m = s.players[G.me]; return m.team !== 0 && s.players.some(p => p.slot !== G.me && p.team === m.team); }
function chatSetup() {
  $('btnChat').style.display = G.mode === 'mp' || hasAllies() ? '' : 'none';
  $('chat').classList.remove('on'); $('chLog').innerHTML = ''; $('btnChat').firstElementChild.textContent = '';
  $('chTeam').checked = G.mode !== 'mp' || hasAllies();
  $('chTeam').parentElement.style.display = hasAllies() && G.mode === 'mp' ? '' : 'none';
  const q = $('chQuick'); q.innerHTML = '';
  for (const id in QUICK) { const b = document.createElement('button'); b.textContent = QUICK[id]; b.onclick = () => { sfx('click'); issue(['qm', id]); }; q.appendChild(b); }
  const pb = document.createElement('button'); pb.textContent = '📍 İşaretle'; pb.onclick = () => { sfx('click'); G.pinging = true; $('chat').classList.remove('on'); addMsg(IS_TOUCH ? 'Haritada bir yere dokun' : 'Haritada bir yere tıkla'); }; q.appendChild(pb);
  tribUI();
}
function tribUI() {
  const el = $('chTrib'), s = G.sim, me = s.players[G.me];
  const allies = s.players.filter(p => p.slot !== G.me && p.alive && me.team !== 0 && p.team === me.team);
  if (!allies.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<b>🤝 Müttefike kaynak gönder</b>';
  for (const a of allies) {
    const row = document.createElement('div'); row.className = 'tr';
    const nm = document.createElement('span'); nm.style.color = a.color; nm.textContent = a.name; nm.style.minWidth = '70px'; row.appendChild(nm);
    for (const k of RT) { const b = document.createElement('button'); b.textContent = '+100' + RES_INFO[k].i; b.onclick = () => { if (G.sim.players[G.me].res[k] < 100) { addMsg('Yeterli ' + RES_INFO[k].n.toLowerCase() + ' yok'); return; } sfx('click'); issue(['tb', a.slot, k, 100]); }; row.appendChild(b); }
    el.appendChild(row);
  }
}
function chatOpen(focus) {
  if ($('btnChat').style.display === 'none') return;
  const c = $('chat'); const on = !c.classList.contains('on') || focus;
  c.classList.toggle('on', on);
  if (on) { G.unread = 0; $('btnChat').firstElementChild.textContent = ''; tribUI(); $('chLog').scrollTop = 1e9; if (!IS_TOUCH || focus) setTimeout(() => $('chIn').focus(), 0); }
}
function chatSend() {
  const v = $('chIn').value.trim(); if (!v) return;
  issue(['ch', v.slice(0, 80), $('chTeam').checked && hasAllies() ? 1 : 0]); $('chIn').value = '';
}
function chatLine(c) {
  const p = G.sim.players[c.from]; if (!p) return null;
  const d = document.createElement('div'); d.className = 'cl';
  const b = document.createElement('b'); b.style.color = p.color; b.textContent = p.name + (c.team && G.mode === 'mp' ? ' (takım)' : '') + ':'; d.appendChild(b);
  d.appendChild(document.createTextNode(' ' + c.text)); return d;
}
function chatIn(c) {
  if (c.team && !allied(c.from)) return;
  const line = chatLine(c); if (!line) return;
  $('chLog').appendChild(line); while ($('chLog').children.length > 60) $('chLog').firstChild.remove(); $('chLog').scrollTop = 1e9;
  if (c.from !== G.me) {
    const t = chatLine(c); t.className = 'msg'; $('msgs').appendChild(t); setTimeout(() => t.remove(), 6000); while ($('msgs').children.length > 4) $('msgs').firstChild.remove();
    sfx('train');
    if (!$('chat').classList.contains('on')) { G.unread++; $('btnChat').firstElementChild.textContent = G.unread; }
  }
}
function pingIn(p) {
  if (!allied(p.from)) return;
  G.pings.push({ x: p.x, y: p.y, t0: performance.now(), c: G.sim.players[p.from].color });
  if (p.from !== G.me) { addMsg(G.sim.players[p.from].name + ' haritada bir yer işaretledi 📍'); sfx('done'); }
}
$('btnChat').onclick = () => { sfx('click'); chatOpen(false); };
$('chClose').onclick = () => $('chat').classList.remove('on');
$('chSend').onclick = () => chatSend();
$('chIn').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { chatSend(); if (!IS_TOUCH) $('chat').classList.remove('on'); $('chIn').blur(); } else if (e.key === 'Escape') { $('chat').classList.remove('on'); $('chIn').blur(); } });
$('spSize').value = store.get('spSize', 'orta'); $('spRes').value = store.get('spRes', 'dusuk'); $('spPop').value = store.get('spPop', '150'); $('spMon').value = store.get('spMon', 'az');

// ===================== SAVE / CONTINUE =====================
// Saves go to this browser (localStorage) and, when signed in on claude.ai, to the player's own private
// space in the page's database, so a game can be continued on another device.
const SAVE = { db: null, uid: null, q: Promise.resolve(), tried: false, busy: false };
(async function saveInit() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (db && user) { const id = await user.id(); if (id) { SAVE.db = db; SAVE.uid = id; } }
  } catch (e) { SAVE.db = null; }
  finally { SAVE.tried = true; if ($('saves').classList.contains('on')) savesOpen(); }
})();
const SLOTS = ['auto', '1', '2', '3'];
function slotName(k) { return k === 'auto' ? 'Otomatik kayıt' : 'Kayıt ' + k; }
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }
async function packStr(str) {
  if (typeof CompressionStream === 'undefined') return 'J' + str;
  const buf = new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'G' + btoa(bin);
}
async function unpackStr(p) {
  if (p[0] === 'J') return p.slice(1);
  const bin = atob(p.slice(1)), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function saveCol() { return SAVE.db.collection('data/users/' + SAVE.uid); }
function enqueue(fn) { const r = SAVE.q.then(fn); SAVE.q = r.catch(() => {}); return r; }
async function saveGame(slot) {
  const s = G.sim, me = s.players[G.me];
  const [cx, cy] = toWorld(VW / 2, (VH - 120) / 2);
  const data = { sim: serializeSim(s), exp: Array.from(G.exp), me: G.me, cx, cy, z: G.z, groups: G.groups };
  const meta = { t: Date.now(), tick: s.tick, civ: me.civ, name: me.name, map: s.map, n: s.players.length, age: me.age, opp: s.players.filter(p => p.slot !== G.me).map(p => p.civ) };
  const packed = await packStr(JSON.stringify(data));
  let local = false, cloud = false;
  try { localStorage.setItem('dd_save_' + slot, JSON.stringify({ meta, packed })); local = true; } catch (e) {}
  if (SAVE.db) {
    cloud = await enqueue(async () => {
      const col = saveCol(), parts = [];
      for (let i = 0; i < packed.length; i += 200000) parts.push(packed.slice(i, i + 200000));
      for (let i = 0; i < parts.length; i++) await withTimeout(col.doc('s_' + slot + '_' + i).set({ d: parts[i] }), 15000);
      await withTimeout(col.doc('s_' + slot).set({ meta, n: parts.length }), 15000);
      return true;
    }).catch(() => false);
  }
  return { local, cloud };
}
async function autoSave() {
  if (SAVE.busy || !G) return; SAVE.busy = true;
  try { await saveGame('auto'); } catch (e) {} finally { SAVE.busy = false; }
}
async function listSaves() {
  const out = {};
  for (const k of SLOTS) { try { const l = JSON.parse(localStorage.getItem('dd_save_' + k) || 'null'); if (l && l.meta) out[k] = { meta: l.meta, src: 'local' }; } catch (e) {} }
  if (SAVE.db) {
    try {
      const col = saveCol();
      const docs = await withTimeout(Promise.all(SLOTS.map(k => col.doc('s_' + k).get())), 10000);
      docs.forEach((d, i) => { if (!d.exists) return; const v = d.data(), k = SLOTS[i]; if (v && v.meta && (!out[k] || v.meta.t > out[k].meta.t)) out[k] = { meta: v.meta, src: 'cloud', n: v.n | 0 }; });
    } catch (e) { out._err = 1; }
  }
  return out;
}
async function readSave(k, info) {
  let packed = null;
  if (info.src === 'cloud') {
    const col = saveCol(), parts = [];
    for (let i = 0; i < info.n; i++) { const d = await withTimeout(col.doc('s_' + k + '_' + i).get(), 15000); if (!d.exists) throw new Error('missing'); parts.push(d.data().d); }
    packed = parts.join('');
  } else { const l = JSON.parse(localStorage.getItem('dd_save_' + k) || 'null'); packed = l && l.packed; }
  if (!packed) throw new Error('empty');
  return JSON.parse(await unpackStr(packed));
}
async function deleteSave(k, info) {
  try { localStorage.removeItem('dd_save_' + k); } catch (e) {}
  if (SAVE.db) await enqueue(async () => { const col = saveCol(); for (let i = 0; i < Math.max(1, info.n || 1); i++) await col.doc('s_' + k + '_' + i).delete(); await col.doc('s_' + k).delete(); }).catch(() => {});
}
function saveDesc(m) {
  const d = new Date(m.t), when = d.toLocaleDateString(LANG + '-' + { tr: 'TR', en: 'GB', nl: 'NL' }[LANG]) + ' ' + d.toLocaleTimeString(LANG + '-' + { tr: 'TR', en: 'GB', nl: 'NL' }[LANG], { hour: '2-digit', minute: '2-digit' });
  const min = Math.floor(m.tick / TPS / 60);
  return `${CIVS[m.civ] ? CIVS[m.civ].flag + ' ' + CIVS[m.civ].n : ''} · ${AGE_NAMES[m.age] || ''} · ${min} dk · ${m.n} oyuncu · ${({ ova: 'Ova', nehir: 'Nehir', yayla: 'Yayla' })[m.map] || ''}<br>${when}`;
}
async function savesOpen() {
  const el = $('saveList'); el.innerHTML = '<p class="hint">Yükleniyor…</p>';
  $('saveNote').textContent = SAVE.db ? 'Kayıtların claude.ai hesabına bağlı: başka cihazdan bu sayfayı açarak da devam edebilirsin.' : (SAVE.tried ? 'Kayıtlar bu tarayıcıda tutulur.' : 'Hesap bağlantısı kontrol ediliyor…');
  const all = await listSaves();
  el.innerHTML = '';
  const keys = SLOTS.filter(k => all[k]);
  if (!keys.length) { el.innerHTML = '<p class="hint">Henüz kayıtlı oyun yok. Tek oyunculu bir oyunda menüden “Oyunu kaydet”e bas; oyun ayrıca 3 dakikada bir kendiliğinden kaydedilir.</p>'; }
  for (const k of keys) {
    const info = all[k], row = document.createElement('div'); row.className = 'save';
    row.innerHTML = `<div class="inf"><b>${slotName(k)}</b><small>${saveDesc(info.meta)}</small></div>`;
    const go = document.createElement('button'); go.className = 'tb'; go.textContent = '▶ Devam'; go.onclick = () => loadAndStart(k, info, go);
    const del = document.createElement('button'); del.className = 'tb'; del.textContent = '🗑'; del.onclick = async () => { if (del.dataset.arm !== '1') { del.dataset.arm = '1'; del.textContent = 'Emin misin?'; return; } await deleteSave(k, info); savesOpen(); };
    row.appendChild(go); row.appendChild(del); el.appendChild(row);
  }
  if (all._err) el.insertAdjacentHTML('beforeend', '<p class="hint">Hesaptaki kayıtlara şu an ulaşılamadı; bu cihazdaki kayıtlar gösteriliyor.</p>');
}
async function loadAndStart(k, info, btn) {
  btn.disabled = true; btn.textContent = 'Yükleniyor…';
  try {
    const d = await readSave(k, info);
    const sim = deserializeSim(d.sim);
    startGame({ sim, me: d.me | 0, mode: 'sp', exp: d.exp, groups: d.groups || {} });
    if (d.cx != null) centerOn(d.cx, d.cy);
    addMsg('Kayıtlı oyun yüklendi: ' + slotName(k));
  } catch (e) { btn.disabled = false; btn.textContent = '▶ Devam'; $('saveNote').textContent = 'Bu kayıt açılamadı.'; }
}
document.querySelector('[data-go="saves"]').addEventListener('click', () => savesOpen());
async function saveSlotsOpen() {
  $('ovSave').classList.add('on'); $('saveState').textContent = '';
  const el = $('saveSlots'); el.innerHTML = '<p class="hint">…</p>';
  const all = await listSaves(); el.innerHTML = '';
  for (const k of ['1', '2', '3']) {
    const b = document.createElement('button'); b.className = 'big'; b.style.fontSize = '15px';
    b.innerHTML = `💾 ${slotName(k)}<br><small style="font-family:Inter,sans-serif;font-size:11.5px;color:var(--mut)">${all[k] ? 'Üzerine yaz — ' + saveDesc(all[k].meta) : 'Boş'}</small>`;
    b.onclick = async () => {
      if (!G) return; el.querySelectorAll('button').forEach(x => x.disabled = true); $('saveState').textContent = 'Kaydediliyor…';
      const r = await saveGame(k);
      $('saveState').textContent = r.cloud ? '✓ Kaydedildi (bu cihaz + hesabın)' : r.local ? '✓ Bu cihaza kaydedildi' : 'Kaydedilemedi.';
      el.querySelectorAll('button').forEach(x => x.disabled = false); sfx('done');
    };
    el.appendChild(b);
  }
}
$('omSave').onclick = () => { $('ovMenu').classList.remove('on'); saveSlotsOpen(); };
$('saveBack').onclick = () => { $('ovSave').classList.remove('on'); if (G && G.mode === 'sp') { G.paused = false; G.last = performance.now(); } };
