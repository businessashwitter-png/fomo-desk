// FOMO Desk phone app (STEP 10, plan B). Read-only: polls the published JSON under d/{private path}/.
// The private path arrives once as #d=..., is kept in localStorage and never written into this file.
// Controls go through Telegram. Every coin link comes from the data (built by links.py on the desk).
(function () {
  "use strict";
  const POLL_S = 30, STALE_MIN = 15;
  const COLORS = {scanner: "#64d2ff", analyst: "#ffd60a", brain: "#bf5af2", executor: "#00d35a", risk: "#ff6b9a"};
  const NAMES = {scanner: "Scanner", analyst: "Analyst", brain: "Brain", executor: "Executor", risk: "Risk"};
  const m = location.hash.match(/(?:^#|&)d=([A-Za-z0-9_-]{16,})/);
  if (m) { localStorage.setItem("desk_d", m[1]); history.replaceState(null, "", location.pathname + location.search); }
  const D = localStorage.getItem("desk_d");
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const safeUrl = (u, host) => { try { const x = new URL(u); return x.protocol === "https:" && x.hostname === host ? x.href : null; } catch (e) { return null; } };
  const fomo = (u, label) => { const s = safeUrl(u, "fomo.family"); return s ? `<a class="fomo" href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(label || "Open on FOMO")}</a>` : ""; };
  const tg = () => safeUrl((S.state && S.state.links && S.state.links.telegram) || "https://t.me/ashhmotion_desk_bot", "t.me");
  const ts = s => s ? new Date(String(s).replace(" ", "T")).getTime() : NaN;   // desk times are box-local (ET)
  const usd = (v, d = 2) => v == null || isNaN(v) ? "—" : (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
  const pct = v => v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  const hm = t => isNaN(t) ? "—" : new Date(t).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});
  const S = {state: null, chart: null, activity: null, positions: null, bots: null, audits: null, coins: null, tab: "home", range: "LIVE",
             lastOk: 0, fails: 0, nextAt: 0, prevBal: null};

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  async function getJson(name) {
    const r = await fetch(`d/${encodeURIComponent(D)}/${name}?t=${Date.now()}`, {cache: "no-store"});
    if (!r.ok) throw new Error(name + " " + r.status);
    return r.json();
  }
  async function poll() {
    try {
      const names = ["state", "chart", "activity", "positions", "bots", "audits", "coins"];
      const got = await Promise.all(names.map(n => getJson(n + ".json")));
      names.forEach((n, i) => S[n] = got[i]);
      S.lastOk = Date.now(); S.fails = 0;
    } catch (e) { S.fails++; }
    S.nextAt = Date.now() + POLL_S * 1000;
    render();
  }
  function errRow() {
    const el = $("#err"), pub = S.state ? Date.parse(S.state.published_at) : NaN;
    const stale = !isNaN(pub) && Date.now() - pub > STALE_MIN * 60000;
    if (S.fails || stale) {
      const n = Math.max(0, Math.round((S.nextAt - Date.now()) / 1000));
      el.textContent = `Desk offline · retrying in ${n}s · last update ${isNaN(pub) ? "never" : hm(pub)}`;
      el.classList.remove("hidden");
    } else el.classList.add("hidden");
  }
  setInterval(errRow, 1000);

  function odometer(v) {
    const txt = usd(v); return `<span class="odo">${[...txt].map((c, i) => `<span style="transition-delay:${i * 30}ms">${esc(c)}</span>`).join("")}</span>`;
  }
  function botStatus(b) {
    const st = S.state; if (!st) return ["grey", "—"];
    if (st.paused && st.paused[b]) return ["#ff9f0a", "Paused"];
    const t = ts((st.bots_hb || {})[b]); const age = (Date.now() - t) / 1000;
    return age < 180 ? [COLORS[b], "Running"] : ["#ff453a", "Down"];
  }
  function paperPill() { return S.state && S.state.mode === "PAPER" ? `<span class="pill paper">PAPER</span>` : ""; }

  // ---------- HOME ----------
  function homeView() {
    const st = S.state; if (!st) return skeleton();
    const ch = S.chart || {points: []}, open = st.open_positions || [], lo = st.last_order;
    const running = Object.keys(COLORS).filter(b => botStatus(b)[1] === "Running").length;
    const acts = (S.activity && S.activity.items || []).slice(0, 5);
    return `
    <div class="nav"><button class="avatar" data-go="account">A</button><span class="brand">Grok Bot ›</span>
      <input class="search" id="q" placeholder="Name, symbol or mint" autocomplete="off"><a class="bell" href="${esc(tg())}" target="_blank" rel="noopener">🔔${acts.length ? "<i></i>" : ""}</a></div>
    <div id="qres"></div>
    <div class="bal"><span class="big">${odometer(st.balance)}</span>${paperPill()}</div>
    <div class="sub"><span class="${(st.today_pct || 0) >= 0 ? "up" : "down"}">${pct(st.today_pct)} today</span>
      ${st.multiplier ? `<span class="pill green">${st.multiplier.toFixed(2)}×</span>` : ""}<span class="t2">cash ${usd(st.cash)}</span></div>
    <canvas class="chart" id="chart"></canvas>
    <div class="ranges">${["LIVE", "1H", "4H", "1D", "1W", "ALL"].map(r => `<button data-range="${r}" class="${S.range === r ? "on" : ""}">${r}</button>`).join("")}</div>
    <div class="screen"><div class="tl"><span class="dot"></span>Live screen: off in PAPER</div>
      <div class="tr t2">Idle</div><div class="t3" style="font-size:14px;text-align:center;padding:0 24px">No browser in PAPER. Orders fill from live quotes.</div></div>
    <div class="under">${lo ? `${lo.side === "buy" ? "Bought" : "Sold"} ${esc(lo.symbol)} · ${usd(lo.fill_usd ?? lo.usd)} · ${esc(lo.status)} · screen ${lo.screen_ok ? "✓" : "✗"} · api n/a · chain n/a` : "No orders yet"}</div>
    <div class="h"><b>Bots · ${running} running</b></div>
    <div class="carousel">${Object.keys(COLORS).map(botCard).join("")}</div>
    <div class="h"><b>Activity</b><button data-go="activity">See all</button></div>
    ${acts.length ? acts.map(actRow).join("") : `<div class="empty">Waiting for the first trade</div>`}
    ${open.length ? `<div class="h"><b>Open positions</b></div>` + open.map(p => `<div class="row" data-coin="${esc(p.mint)}"><div class="l"><div>${esc(p.symbol)}</div><div>${usd(p.size_usd)} in · stop ${(p.stop_price / p.entry_price * 100 - 100).toFixed(0)}%</div></div><div class="r">${usd(p.value_usd)}<br>${fomo(p.coin_url)}</div></div>`).join("") : ""}`;
  }
  function botCard(b) {
    const st = S.state, c = (st && st.counts) || {}, d = (S.bots && S.bots[b]) || [], [col, status] = botStatus(b);
    const head = {scanner: `${c.scanner || 0} pools`, analyst: `${c.analyst || 0} taken apart`, brain: "Sizing",
                  executor: `${c.executor || 0} trades`, risk: "Guarding"}[b];
    let body = "";
    if (b === "scanner") body = d.slice(0, 4).map(x => `<div><span class="${x.verdict === "kill" ? "strike" : ""}">${esc(x.symbol || x.mint.slice(0, 4))}</span><span class="t2">${x.verdict === "pass" ? "→ Analyst" : esc(x.reason)}</span></div>`).join("");
    if (b === "analyst") body = d.slice(0, 3).map(x => `<div><span>${esc(x.symbol || x.mint.slice(0, 4))}</span><span class="${x.pass ? "up" : "t2"}">${x.score ?? "—"} · ${esc(x.reason).slice(0, 28)}</span></div>`).join("");
    if (b === "brain") body = `<div><span>${st && st.settings ? "80+ = full size" : ""}</span><span class="t2">under 80 = half size</span></div>` + d.slice(0, 2).map(x => `<div><span>${esc(x.symbol || "")}</span><span class="t2">${x.usd ? usd(x.usd) : esc(x.subtitle || "")}</span></div>`).join("");
    if (b === "executor") body = d.slice(0, 3).map(x => `<div><span>${x.side === "buy" ? "Bought" : "Sold"} ${esc(x.symbol || "")}</span><span class="t2">${usd(x.fill_usd ?? x.usd)} · ${esc(x.status)}</span></div>`).join("") || `<div><span class="t2">Waiting for a dip -${st && st.settings ? st.settings["executor.dip_pct"] : 15}%</span></div>`;
    if (b === "risk") { const s = st && st.settings || {}; body = `<div><span class="pill red">stop -${s["risk.stop_pct"] ?? 25}%</span><span class="pill green">trail ${s["executor.trail_pct"] ?? 40}%</span></div>`; }
    return `<div class="card bot"><div class="botname"><span class="dot" style="background:${col}"></span>${NAMES[b]}<span class="t2" style="font-weight:400;margin-left:auto;font-size:14px">${esc(status)}</span></div>
      <div class="t2" style="margin-top:4px">${esc(head)}</div><div class="feed">${body || `<div><span class="t3">Nothing yet tonight</span></div>`}</div></div>`;
  }
  function actRow(a) {
    const kindTo = a.kind === "rejected" ? "audit" : "coin";
    const val = a.kind === "stopped" ? `<span class="down">${esc(a.value)}</span>` : a.kind === "sold" ? `<span class="${String(a.value).startsWith("-") ? "down" : "up"}">${esc(a.value)}</span>` : esc(a.value);
    return `<div class="row" data-${kindTo}="${esc(a.mint)}"><div class="l"><div>${esc(a.title)}</div><div>${esc(a.subtitle)} · ${hm(ts(a.ts))}</div></div><div class="r">${val}<br>${fomo(a.coin_url)}</div></div>`;
  }
  function skeleton() { return `<div class="skel" style="height:90px"></div><div class="skel" style="height:220px"></div><div class="skel"></div><div class="skel"></div>`; }

  // ---------- BOTS ----------
  function botsView() {
    if (!S.state) return skeleton();
    return `<div class="h"><b>Bots</b></div>` + Object.keys(COLORS).map(b => {
      const [col, status] = botStatus(b), d = (S.bots && S.bots[b]) || [];
      const rows = d.slice(0, 20).map(x => {
        const label = x.reason || x.subtitle || x.status || x.title || "";
        return `<div><span>${esc(x.symbol || (x.mint || "").slice(0, 4))} <span class="t2">${esc(label).slice(0, 40)}</span></span><span>${fomo(x.coin_url, "FOMO")}</span></div>`;
      }).join("");
      return `<div class="card"><div class="botname"><span class="dot" style="background:${col}"></span>${NAMES[b]}<span class="t2" style="margin-left:auto;font-weight:400;font-size:14px">${esc(status)} · ${(S.state.counts || {})[b] ?? 0} today</span></div>
        <div class="feed">${rows || `<div><span class="t3">No decisions yet</span></div>`}</div>
        <a class="btn" href="${esc(tg())}" target="_blank" rel="noopener">${status === "Paused" ? "Resume" : "Pause"} in Telegram</a>
        <div class="t3" style="font-size:12px;margin-top:6px">Send “${status === "Paused" ? "resume" : "pause"} ${b}” to the desk bot${b === "risk" ? " (Risk stays on while a position is open)" : ""}.</div></div>`;
    }).join("");
  }

  // ---------- ACTIVITY ----------
  function activityView() {
    const items = S.activity && S.activity.items; if (!items) return skeleton();
    return `<div class="h"><b>Activity</b>${paperPill()}</div>` + (items.length ? items.map(actRow).join("") : `<div class="empty">Nothing yet tonight</div>`);
  }

  // ---------- ACCOUNT ----------
  function accountView() {
    const st = S.state; if (!st) return skeleton();
    const L = st.links || {}, prof = safeUrl(L.profile, "fomo.family"), sign = safeUrl(L.signup, "fomo.family");
    const groups = {};
    Object.entries(st.settings || {}).forEach(([k, v]) => { const [g, n] = k.split("."); (groups[g] = groups[g] || []).push([n, v]); });
    return `<div class="h"><b>Account</b>${paperPill()}</div>
    <div class="card"><div class="kv"><span>Mode</span><span>${esc(st.mode)}</span></div>
      <div class="t3" style="font-size:13px;padding-top:8px">LIVE is locked: the LIVE click method isn't chosen yet.</div>
      <div class="kv"><span>Paper cash</span><span>${usd(st.cash)}</span></div>
      <div class="kv"><span>Balance</span><span>${usd(st.balance)}</span></div>
      ${prof ? `<a class="btn" href="${esc(prof)}" target="_blank" rel="noopener noreferrer">Your FOMO profile</a>` : ""}
      ${sign ? `<button class="btn" id="invite" data-url="${esc(sign)}">Invite a friend</button>` : ""}</div>
    <div class="card"><div class="kv"><span>Pushes</span><span>Telegram connected</span></div>
      <div class="kv"><span>Copy picks</span><span>${esc((st.settings || {})["copy_picks.every"] || "off")}</span></div>
      <a class="btn blue" href="${esc(tg())}" target="_blank" rel="noopener">Open the desk bot in Telegram</a>
      <div class="t3" style="font-size:12px;margin-top:6px">Change a setting: send “set stop_pct 20”, then reply yes. Test push: send “status”.</div></div>
    ${Object.entries(groups).map(([g, rows]) => `<div class="grp">${esc(g[0].toUpperCase() + g.slice(1))}</div><div class="card">${rows.map(([n, v]) => `<div class="kv"><span>${esc(n)}</span><span>${esc(v)}</span></div>`).join("")}</div>`).join("")}`;
  }

  // ---------- SHEETS: Coin, Audit ----------
  function coinSheet(mint) {
    const c = (S.coins || {})[mint], pos = [...((S.positions || {}).open || []), ...((S.positions || {}).closed || [])].find(p => p.mint === mint);
    const a = (S.audits || {})[mint], sym = (c && c.symbol) || (pos && pos.symbol) || (a && a.symbol) || mint.slice(0, 4);
    const pts = (c && c.prices || []).map(p => [p[0] * 1000, p[1]]), last = pts.length ? pts[pts.length - 1][1] : null;
    const since = pos && last ? (last / pos.entry_price - 1) * 100 : null;
    const age = c && c.migrated_at ? Math.round((Date.now() - ts(c.migrated_at)) / 3600000) : null;
    const passed = a ? a.layers.filter(l => l.pass === 1).length : null;
    open(`<div style="display:flex;gap:8px;align-items:center"><b style="font-size:22px">${esc((c && c.name) || sym)}</b>${paperPill()}</div>
      <div class="t2">${esc(sym)} · Solana${age != null ? ` · ${age}h old` : ""}${passed != null ? ` · 🛡 ${passed}/8` : ""}</div>
      <div class="big" style="font-size:44px;margin-top:8px">${last ? "$" + last.toPrecision(4) : "—"}</div>
      ${since != null ? `<div class="${since >= 0 ? "up" : "down"}">${since >= 0 ? "▲" : "▼"} ${Math.abs(since).toFixed(1)}% since entry</div>` : ""}
      <canvas class="chart" id="coinchart" style="height:180px;margin-top:10px"></canvas>
      ${pos ? `<div class="kv"><span>Your position</span><span>${usd(pos.size_usd)} in · Executor</span></div>` : ""}
      ${pos && pos.closed_at ? `<div class="kv"><span>Closed</span><span>${esc(pos.exit_reason)} · ${usd(pos.pnl_usd)}</span></div>` : ""}
      ${c && c.holders ? `<div class="kv"><span>Holders</span><span>${esc(c.holders)}</span></div>` : ""}
      ${(c && c.coin_url) || (pos && pos.coin_url) || (a && a.coin_url) ? `<a class="btn blue" href="${esc(safeUrl((c && c.coin_url) || (pos && pos.coin_url) || a.coin_url, "fomo.family") || "#")}" target="_blank" rel="noopener noreferrer">Open on FOMO</a>` : ""}
      ${pos && !pos.closed_at ? `<a class="btn" href="${esc(tg())}" target="_blank" rel="noopener">Sell now (Telegram)</a><div class="t3" style="font-size:12px;margin-top:6px">Send “sell ${esc(sym)} 25|50|100”, then reply yes.</div>` : ""}
      ${a ? `<button class="btn" data-audit="${esc(mint)}">Audit</button>` : ""}`);
    requestAnimationFrame(() => { const cv = $("#coinchart"); if (cv) drawChart(cv, pts, {exitLine: pos && !pos.closed_at ? pos.stop_price : null, empty: "No prices yet", color: "#00d35a"}); });
  }
  function auditSheet(mint) {
    const a = (S.audits || {})[mint];
    if (!a) return open(`<b>Audit</b><div class="empty">Not audited tonight</div>`);
    const sc = a.score;
    open(`<b style="font-size:22px">${esc(a.symbol)} · Audit</b>
      ${a.layers.map(l => `<div class="disc"><b class="${l.pass === 1 ? "ok" : l.pass === 0 ? "bad" : ""}">${l.pass === 1 ? "✓" : l.pass === 0 ? "✗" : l.n}</b><div><div>${esc(l.name)}</div><div class="t2" style="font-size:14px">${esc(l.value)}</div></div></div>`).join("")}
      <div style="margin-top:12px">${sc ? `Score ${esc(sc.score ?? "—")} · ${esc(sc.reason)}` : ""}</div>
      <div class="t2" style="margin-top:6px">${sc && sc.social_pts ? `Social +${esc(sc.social_pts)}` : "Social: off"}</div>
      ${fomo(a.coin_url)}`);
  }
  function open(html) { $("#sheet-body").innerHTML = html; $("#sheet").classList.remove("hidden"); }
  $("#sheet").addEventListener("click", e => { if (e.target.id === "sheet" || e.target.classList.contains("sheet-x")) $("#sheet").classList.add("hidden"); });

  // ---------- render ----------
  function chartPoints() {
    const ch = S.chart || {points: []}, now = Date.now();
    const span = {LIVE: 15 * 60e3, "1H": 36e5, "4H": 4 * 36e5, "1D": 864e5, "1W": 7 * 864e5, ALL: Infinity}[S.range];
    const pts = ch.points.map(p => [ts(p[0]), p[1]]).filter(p => !isNaN(p[0]) && now - p[0] <= span);
    const marks = (ch.marks || []).map(m => ({t: ts(m.ts), label: m.label, color: m.kind === "bought" ? "#0a84ff" : m.kind === "stopped" ? "#ff453a" : "#00d35a"}));
    return {pts, marks, start: ch.start};
  }
  function render() {
    errRow();
    if (!D) { $("#view").innerHTML = `<div class="empty" style="padding-top:30vh">Open your private desk link once on this phone.<br><span class="t3">It's in the Grok Bot chat.</span></div>`; return; }
    const v = {home: homeView, bots: botsView, activity: activityView, account: accountView}[S.tab]();
    const active = document.activeElement && document.activeElement.id === "q" ? $("#q").value : null;
    $("#view").innerHTML = v;
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
    if (S.tab === "home" && S.state) {
      const c = chartPoints(); drawChart($("#chart"), c.pts, {start: c.start, marks: c.marks});
      if (active != null) { const q = $("#q"); q.value = active; q.focus(); search(active); }
    }
  }
  function search(q) {
    q = q.trim().toLowerCase(); const out = $("#qres"); if (!out) return;
    if (!q) { out.innerHTML = ""; return; }
    const seen = new Map();
    const add = (mint, sym, url) => { if (mint && !seen.has(mint)) seen.set(mint, {mint, sym, url}); };
    Object.entries(S.audits || {}).forEach(([m, a]) => add(m, a.symbol, a.coin_url));
    ((S.activity || {}).items || []).forEach(a => add(a.mint, (a.title || "").split(" ").slice(1).join(" "), a.coin_url));
    ((S.bots || {}).scanner || []).forEach(x => add(x.mint, x.symbol, x.coin_url));
    const hits = [...seen.values()].filter(x => (x.sym || "").toLowerCase().includes(q) || x.mint.toLowerCase().startsWith(q)).slice(0, 6);
    out.innerHTML = hits.length ? hits.map(h => `<div class="row" data-coin="${esc(h.mint)}"><div class="l"><div>${esc(h.sym || h.mint.slice(0, 6))}</div><div>${esc(h.mint.slice(0, 6))}…</div></div><div class="r">${fomo(h.url)}</div></div>`).join("") : `<div class="t3" style="padding:8px 0">No coin tonight matches</div>`;
  }
  document.addEventListener("input", e => { if (e.target.id === "q") search(e.target.value); });
  document.addEventListener("click", e => {
    if (e.target.closest("a")) return;
    const t = e.target.closest("[data-tab],[data-go],[data-range],[data-coin],[data-audit],#invite");
    if (!t) return;
    if (t.dataset.tab || t.dataset.go) { S.tab = t.dataset.tab || t.dataset.go; render(); window.scrollTo(0, 0); }
    else if (t.dataset.range) { S.range = t.dataset.range; render(); }
    else if (t.dataset.coin) coinSheet(t.dataset.coin);
    else if (t.dataset.audit) auditSheet(t.dataset.audit);
    else if (t.id === "invite") {
      const url = t.dataset.url;
      if (navigator.share) navigator.share({title: "FOMO", url}).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => { t.textContent = "Link copied"; });
    }
  });
  render();
  if (D) { poll(); setInterval(poll, POLL_S * 1000); }
})();
