// ===================== P2P ROOMS (for copies hosted outside claude.ai, e.g. GitHub Pages) =====================
// Same presence-room interface the game uses on claude.ai, built on WebRTC data channels (PeerJS).
// The player who creates a room is its hub: everyone connects to the hub, which relays presence to all.
const P2P = (() => {
  const PREFIX = 'dorddiyar-13-';
  const LIBS = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  const TOKEN = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  let libP = null;
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= LIBS.length) { libP = null; rej(new Error('lib')); return; }
        const sc = document.createElement('script'); sc.src = LIBS[i++]; sc.async = true;
        sc.onload = () => (window.Peer ? res() : next()); sc.onerror = next; document.head.appendChild(sc);
      };
      next();
    });
    return libP;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function mkRoom(name, create) {
    const R = { my: {}, others: new Map(), hs: [], errs: [], hub: false, conns: new Map(), tok: new Map(), up: null, peer: null, dead: false };
    const entry = (p, v, me) => ({ peer: p, isMe: !!me, sameTab: !!me, kind: 'viewer', by: null, guest: false, presence: Object.freeze(clone(v)), updatedAt: Date.now() });
    const snap = () => { const a = [entry(TOKEN, R.my, true)]; for (const [p, v] of R.others) a.push(entry(p, v, false)); return Object.freeze(a); };
    const fire = (joined, left, updated) => { const peers = snap(); for (const h of R.hs) setTimeout(() => { try { h({ peers, joined: joined || [], left: left || [], updated: updated || [] }); } catch (e) { console.error(e); } }, 0); };
    const setOther = (t, p) => { const isNew = !R.others.has(t); R.others.set(t, p); const e = entry(t, p, false); fire(isNew ? [e] : [], [], isNew ? [] : [e]); };
    const dropOther = (t) => { if (!R.others.has(t)) return; const e = entry(t, R.others.get(t), false); R.others.delete(t); fire([], [e], []); };
    const fail = () => {
      if (R.dead) return; R.dead = true;
      const left = []; for (const [t, v] of R.others) left.push(entry(t, v, false)); R.others.clear(); fire([], left, []);
      for (const e of R.errs) setTimeout(() => { try { e(); } catch (_) {} }, 0);
    };
    const send = (c, m) => { try { if (c && c.open) c.send(m); } catch (e) {} };
    const bcast = (m, except) => { for (const [id, c] of R.conns) if (id !== except) send(c, m); };
    function hubConn(c) {
      c.on('open', () => {
        R.conns.set(c.peer, c);
        const all = {}; all[TOKEN] = R.my; for (const [t, v] of R.others) all[t] = v;
        send(c, { t: 'snap', peers: all });
      });
      c.on('data', (m) => {
        if (!m || m.t !== 'p' || typeof m.me !== 'string' || m.me === TOKEN) return;
        R.tok.set(c.peer, m.me); setOther(m.me, m.p || {});
        bcast({ t: 'p', me: m.me, p: m.p || {} }, c.peer);
      });
      const gone = () => {
        if (!R.conns.has(c.peer)) return; R.conns.delete(c.peer);
        const t = R.tok.get(c.peer); R.tok.delete(c.peer);
        if (t) { dropOther(t); bcast({ t: 'left', me: t }); }
      };
      c.on('close', gone); c.on('error', gone);
    }
    const ready = loadLib().then(() => new Promise((resolve, reject) => {
      const hubId = PREFIX + name.replace(/[^a-z0-9-]/gi, '');
      let done = false; const ok = () => { if (!done) { done = true; resolve(); } }, ko = (e) => { if (!done) { done = true; try { R.peer && R.peer.destroy(); } catch (_) {} reject(e); } };
      setTimeout(() => ko(new Error('timeout')), 15000);
      if (create) {
        const p = new Peer(hubId); R.peer = p;
        p.on('open', () => { R.hub = true; ok(); });
        p.on('connection', hubConn);
        p.on('disconnected', () => { try { if (!R.dead) p.reconnect(); } catch (e) {} });
        p.on('error', (e) => { if (!done) ko(e); });
      } else {
        const p = new Peer(); R.peer = p;
        p.on('open', () => {
          const c = p.connect(hubId, { reliable: true, serialization: 'json' }); R.up = c;
          c.on('open', () => { send(c, { t: 'p', me: TOKEN, p: R.my }); ok(); });
          c.on('data', (m) => {
            if (!m) return;
            if (m.t === 'snap') { for (const t in m.peers) if (t !== TOKEN) setOther(t, m.peers[t]); }
            else if (m.t === 'p' && m.me !== TOKEN) setOther(m.me, m.p || {});
            else if (m.t === 'left') dropOther(m.me);
          });
          c.on('close', fail); c.on('error', () => { if (!done) ko(new Error('conn')); else fail(); });
        });
        p.on('disconnected', () => { try { if (!R.dead) p.reconnect(); } catch (e) {} });
        p.on('error', (e) => { if (!done) ko(e); });
      }
    }));
    R.api = {
      name,
      presence(patch) {
        for (const k in patch) { if (patch[k] === null) delete R.my[k]; else R.my[k] = clone(patch[k]); }
        if (R.hub) bcast({ t: 'p', me: TOKEN, p: R.my }); else send(R.up, { t: 'p', me: TOKEN, p: R.my });
        fire([], [], []); return Promise.resolve();
      },
      peers: snap,
      onPeers(h, err) { R.hs.push(h); if (err) R.errs.push(err); setTimeout(() => { try { h({ peers: snap(), joined: snap(), left: [], updated: [] }); } catch (e) {} }, 0); return () => { R.hs = R.hs.filter(x => x !== h); }; },
      leave() { R.dead = true; try { R.peer && R.peer.destroy(); } catch (e) {} return Promise.resolve(); },
    };
    return ready.then(() => R.api);
  }
  // a "lobby" with just me: without a server there is no public list of open games, players share the room code
  const lobby = {
    p2p: true,
    peers: () => Object.freeze([{ peer: TOKEN, isMe: true, sameTab: true, kind: 'viewer', presence: Object.freeze({}), updatedAt: Date.now() }]),
    presence: () => Promise.resolve(),
    onPeers(h) { setTimeout(() => h({ peers: lobby.peers(), joined: [], left: [], updated: [] }), 0); return () => {}; },
    join: (n, opt) => mkRoom(n, !!(opt && opt.create)),
    leave: () => Promise.resolve(),
  };
  return { lobby, loadLib, TOKEN };
})();
