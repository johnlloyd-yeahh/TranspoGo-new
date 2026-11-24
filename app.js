(() => {
"use strict";
const $ = id => document.getElementById(id), $$ = s => [...document.querySelectorAll(s)];
const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const accounts = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "passenger" }
];
const API = "https://oxford.uk.eu.org/ai/oxford", TIMEOUT = 75000, KEY = "transpogo_routes_v9";
const VEH = ["Bus", "Jeepney", "Tricycle", "UV Express"];
const TYPES = { Regular: 0, Student: .2, Senior: .2, PWD: .2 };
const SAMPLE = [
  ["Tuguegarao","Aparri","Bus",150],["Tuguegarao","Ilagan","Bus",120],["Tuguegarao","Enrile","Jeepney",40],
  ["Tuguegarao","Solana","Jeepney",25],["Tuguegarao","Lallo","Bus",90],["Tuguegarao","Gattaran","Bus",60],
  ["Tuguegarao","Santo Niño","Tricycle",30],["Tuguegarao","Baguio","Bus",750],["Tuguegarao","Manila","Bus",900],
  ["Tuguegarao","Vigan","Bus",650],["Tuguegarao","Banaue","Bus",500],["Tuguegarao","Dagupan","Bus",600],
  ["Aparri","Ilagan","Bus",200],["Aparri","Lallo","Jeepney",60],["Enrile","Solana","Tricycle",20],
  ["Gattaran","Lallo","Bus",45],["Ilagan","Baguio","Bus",800],["Manila","Aparri","Bus",850],
  ["Vigan","Manila","Bus",500],["Manila","Baguio","Bus",450]
];

let routes = ls.get(KEY, []);
routes = Array.isArray(routes) ? routes.filter(r => r && typeof r.origin === "string" && typeof r.destination === "string" && typeof r.fare === "number") : [];
let user = null, lastFare = null;
const ctl = { route: null, fare: null };
const save = () => ls.set(KEY, routes);
const toast = m => { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; $("toasts").append(t); setTimeout(() => t.remove(), 3200); };

/* ---------- theme ---------- */
document.documentElement.dataset.theme = ls.get("transpogo_theme", "dark");
$("themeBtn").onclick = () => {
  const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = n; ls.set("transpogo_theme", n);
};

/* ---------- data helpers ---------- */
const places = () => [...new Set(routes.flatMap(r => [r.origin, r.destination]))].sort();
const avg = () => routes.length ? Math.round(routes.reduce((s, r) => s + r.fare, 0) / routes.length) : 0;
const popular = () => { const c = {}; routes.forEach(r => c[r.origin] = (c[r.origin] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5); };
const fillPlaces = () => { $("places").innerHTML = places().map(p => `<option value="${esc(p)}">`).join(""); };
const hk = () => "transpogo_hist_" + (user ? user.username : "");
const hist = () => ls.get(hk(), []);
const addHist = (o, d) => {
  const h = hist().filter(x => !(x.o.toLowerCase() === o.toLowerCase() && x.d.toLowerCase() === d.toLowerCase()));
  h.unshift({ o, d }); ls.set(hk(), h.slice(0, 8));
};
const refTxt = () => routes.length ? "\n\nLocal route database for reference:\n" + routes.map(r => `${r.origin} -> ${r.destination} (${r.vehicle}, PHP ${r.fare})`).join("\n") : "";
const refresh = () => { fillPlaces(); dash(); adminList(); };

/* ---------- login ---------- */
let fails = 0, lockUntil = 0;
function tick() {
  const s = Math.ceil((lockUntil - Date.now()) / 1000), b = $("loginBtn");
  if (s > 0) { $("loginError").textContent = `Too many attempts. Try again in ${s}s.`; b.disabled = true; setTimeout(tick, 500); }
  else { $("loginError").textContent = ""; b.disabled = false; }
}
$("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  if (Date.now() < lockUntil) return;
  const u = $("username").value.trim().toLowerCase(), p = $("password").value;
  const a = accounts.find(x => x.username === u && x.password === p);
  if (!a) {
    fails++;
    const card = $("loginCard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    if (fails >= 5) { fails = 0; lockUntil = Date.now() + 30000; tick(); }
    else $("loginError").textContent = `Wrong username or password. ${5 - fails} ${5 - fails === 1 ? "try" : "tries"} left.`;
    $("password").value = ""; $("password").focus(); return;
  }
  fails = 0; $("loginError").textContent = "";
  const b = $("loginBtn"); b.disabled = true; b.classList.add("busy");
  setTimeout(() => {
    b.disabled = false; b.classList.remove("busy");
    user = a;
    try { ($("remember").checked ? localStorage : sessionStorage).setItem("transpogo_user", JSON.stringify({ username: a.username, role: a.role })); } catch {}
    enter();
  }, 500);
});
$("eye").onclick = () => { const p = $("password"); p.type = p.type === "password" ? "text" : "password"; };
$("password").addEventListener("keyup", e => $("caps").classList.toggle("hidden", !(e.getModifierState && e.getModifierState("CapsLock"))));
$$("[data-u]").forEach(b => b.onclick = () => { $("username").value = b.dataset.u; $("password").value = b.dataset.p; });

function enter() {
  $("loginPage").classList.add("hidden"); $("appPage").classList.remove("hidden");
  $("welcomeUser").textContent = user.username + " · " + (user.role === "admin" ? "Admin" : "Passenger");
  $$(".admin-only").forEach(b => b.classList.toggle("hidden", user.role !== "admin"));
  go("dashboard");
}
$("logoutBtn").onclick = () => {
  try { localStorage.removeItem("transpogo_user"); sessionStorage.removeItem("transpogo_user"); } catch {}
  Object.values(ctl).forEach(c => c && c.abort());
  user = null; $("appPage").classList.add("hidden"); $("loginPage").classList.remove("hidden");
  $("loginForm").reset(); $("loginError").textContent = ""; $("username").focus();
};

/* ---------- navigation ---------- */
function go(p) {
  if (p === "manage" && (!user || user.role !== "admin")) return;
  $$(".page").forEach(x => x.classList.add("hidden")); $(p).classList.remove("hidden");
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === p));
  fillPlaces(); if (p === "dashboard") dash(); if (p === "manage") adminList();
}
$$("[data-swap]").forEach(b => b.onclick = () => { const [a, c] = b.dataset.swap.split(",").map($); [a.value, c.value] = [c.value, a.value]; });

document.addEventListener("click", e => {
  const t = e.target.closest("[data-page],[data-act],[data-o],[data-from],[data-fo],[data-del]");
  if (!t) return;
  const d = t.dataset, adm = user && user.role === "admin";
  if (d.page) go(d.page);
  else if (d.act === "export" && adm) exportJSON();
  else if (d.act === "sample" && adm) loadSample();
  else if (d.act === "reset" && adm) { if (confirm("Remove all routes?")) { routes = []; save(); refresh(); toast("Routes cleared"); } }
  else if (d.o !== undefined) { $("dFrom").value = d.o; $("dTo").value = d.d; }
  else if (d.from !== undefined) { $("dFrom").value = d.from; $("dTo").focus(); }
  else if (d.fo !== undefined) { $("fareOrigin").value = d.fo; $("fareDestination").value = d.fd; go("fare"); $("fareBtn").focus(); }
  else if (d.del && adm) { routes = routes.filter(r => String(r.id) !== d.del); save(); refresh(); toast("Route deleted"); }
});

/* ---------- dashboard (bento for passengers, split overview for admin) ---------- */
function dash() {
  if (!user) return;
  const adm = user.role === "admin";
  $("dashPassenger").classList.toggle("hidden", adm); $("dashAdmin").classList.toggle("hidden", !adm);
  $("greet").textContent = "Good day, " + user.username;
  const pop = popular();
  if (!adm) {
    $("pRoutes").textContent = routes.length; $("pAvg").textContent = routes.length ? "₱" + avg() : "—";
    $("pRecent").innerHTML = hist().slice(0, 5).map(h => `<button class="chip" data-o="${esc(h.o)}" data-d="${esc(h.d)}">${esc(h.o)} → ${esc(h.d)}</button>`).join("") || '<span class="dim">Your searches show up here.</span>';
    $("pPop").innerHTML = pop.map(([n, c]) => `<button class="chip" data-from="${esc(n)}">${esc(n)} · ${c}</button>`).join("") || '<span class="dim">No routes yet. Ask an admin to add some.</span>';
    return;
  }
  const total = routes.length, counts = VEH.map(v => routes.filter(r => r.vehicle === v).length), C = 2 * Math.PI * 40;
  let off = 0;
  const segs = counts.map((n, i) => { const l = total ? n / total * C : 0; const s = `<circle cx="50" cy="50" r="40" fill="none" stroke="var(--c${i})" stroke-width="12" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"/>`; off += l; return s; }).join("");
  $("ring").innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="Routes by vehicle"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--field)" stroke-width="12"/>${segs}<text x="50" y="57" text-anchor="middle" class="rt">${total}</text></svg>`;
  $("legend").innerHTML = VEH.map((v, i) => `<li><i style="background:var(--c${i})"></i>${v}<b>${counts[i]}</b></li>`).join("");
  $("aRoutes").textContent = total; $("aPlaces").textContent = places().length; $("aAvg").textContent = total ? "₱" + avg() : "—";
  $("aPop").innerHTML = pop.map(([n, c]) => `<li><span>${esc(n)}</span><b>${c}</b></li>`).join("") || '<li class="dim">No routes yet.</li>';
  $("aEmpty").classList.toggle("hidden", total > 0);
}

/* ---------- AI helper ---------- */
function parseJSON(t) {
  if (!t) return null;
  t = String(t).replace(/```(?:json)?/gi, "").trim();
  const s = t.indexOf("{"); if (s < 0) return null;
  let c = t.slice(s); const l = c.lastIndexOf("}"); if (l >= 0) c = c.slice(0, l + 1);
  try { return JSON.parse(c); } catch {}
  const st = []; let q = false, e = false;
  for (const ch of c) {
    if (e) { e = false; continue; }
    if (ch === "\\") { e = true; continue; }
    if (ch === '"') { q = !q; continue; }
    if (q) continue;
    if (ch === "{" || ch === "[") st.push(ch); else if (ch === "}" || ch === "]") st.pop();
  }
  if (q) c += '"';
  c = c.replace(/,\s*$/, "");
  while (st.length) c += st.pop() === "{" ? "}" : "]";
  try { return JSON.parse(c); } catch { return null; }
}
async function ai(k, prompt, max, out, done) {
  const fail = m => { out.innerHTML = `<div class="note err">${esc(m)}</div>`; };
  if (prompt.length > 24000) return fail("Input too long. Use shorter place names.");
  ctl[k] && ctl[k].abort();
  const c = ctl[k] = new AbortController(), to = setTimeout(() => c.abort(), TIMEOUT);
  const b = $(k + "Btn"), x = $(k + "Cancel");
  out.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  b.disabled = true; b.classList.add("busy"); x.classList.remove("hidden");
  try {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: max }), signal: c.signal });
    let d; try { d = await res.json(); } catch { return fail("The service returned an unreadable response. Try again."); }
    if (!res.ok) return fail({ 403: "Service is available only in the Philippines.", 429: "Too many requests. Wait a minute and try again.", 413: "Request too large. Use shorter place names." }[res.status] || (res.status >= 500 ? "The service is temporarily unavailable. Try again shortly." : d.error || "Something went wrong. Try again."));
    const r = d.reply || d.assistant || "";
    if (!r.trim()) return fail("No response received. Try different places.");
    done(parseJSON(r), r);
  } catch (err) {
    fail(err.name === "AbortError" ? "The request timed out or was cancelled. Try again." : "Network error. Check your connection and try again.");
  } finally {
    clearTimeout(to);
    if (ctl[k] === c) { ctl[k] = null; b.disabled = false; b.classList.remove("busy"); x.classList.add("hidden"); }
  }
}
$("routeCancel").onclick = () => ctl.route && ctl.route.abort();
$("fareCancel").onclick = () => ctl.fare && ctl.fare.abort();

/* ---------- find routes ---------- */
const rcard = (r, tag) => {
  const f = Number(r.fare);
  return `<article class="tile rc"><header><span class="ico">${ic("route")}</span><div><b>${esc(r.origin || "?")} → ${esc(r.destination || "?")}</b><small>${esc(r.vehicle || "—")}</small></div><em class="tag">${tag}</em></header>
<dl><dt>Fare</dt><dd class="fare">${f > 0 ? "₱" + f.toFixed(2) : "—"}</dd>${r.travelTime ? `<dt>Travel time</dt><dd>${esc(r.travelTime)}</dd>` : ""}${r.transfers ? `<dt>Transfers</dt><dd>${esc(r.transfers)}</dd>` : ""}</dl>
${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}<button class="btn" data-fo="${esc(r.origin || "")}" data-fd="${esc(r.destination || "")}">${ic("cash")}Estimate fare</button></article>`;
};
function findRoute() {
  const o = $("origin").value.trim(), d = $("destination").value.trim(), out = $("routeResults");
  if (!o || !d) { out.innerHTML = '<p class="note">Enter a starting point and a destination.</p>'; return; }
  addHist(o, d);
  const l = routes.filter(r => r.origin.toLowerCase().includes(o.toLowerCase()) && r.destination.toLowerCase().includes(d.toLowerCase()));
  $("routeLocal").innerHTML = l.length ? `<h3 class="sec">In your database</h3><div class="grid">${l.map(r => rcard(r, "In database")).join("")}</div><h3 class="sec">AI estimate</h3>` : "";
  ai("route", `You are a transportation route expert for the Philippines. A user wants to travel from "${o}" to "${d}".${refTxt()}\n\nReply with ONLY a valid JSON object, no markdown, no code fences. Use this exact shape:\n{"routes":[{"origin":"","destination":"","vehicle":"","fare":0,"travelTime":"","transfers":"","note":""}]}\nProvide 1-3 route options. Keep each field SHORT: vehicle <= 8 words, travelTime <= 10 words, note <= 25 words. If no route is possible, return {"routes":[],"error":"reason"}.`, 1200, out, (p, raw) => {
    const l2 = p && Array.isArray(p.routes) ? p.routes.filter(r => r && (r.origin || r.destination || r.vehicle)) : [];
    out.innerHTML = l2.length ? `<div class="grid">${l2.map(r => rcard(r, "AI estimate")).join("")}</div>` : `<div class="note${p && p.error ? " err" : ""}">${esc((p && p.error) || raw)}</div>`;
  });
}

/* ---------- fare calculator ---------- */
function calcFare() {
  const o = $("fareOrigin").value.trim(), d = $("fareDestination").value.trim(), out = $("fareResult");
  if (!o || !d) { out.innerHTML = '<p class="note">Enter a starting point and a destination.</p>'; return; }
  addHist(o, d); lastFare = null;
  ai("fare", `You are a fare estimation expert for Philippine transportation. A user wants to know the estimated fare from "${o}" to "${d}".${refTxt()}\n\nReply with ONLY a valid JSON object, no markdown, no code fences. Use this exact shape:\n{"totalFare":0,"travelTime":"","route":"","breakdown":[{"item":"","cost":0}],"additionalCosts":"","note":""}\nKeep fields SHORT. If no estimate is possible, return {"error":"reason"}.`, 800, out, (p, raw) => { lastFare = { p, raw }; showFare(); });
}
function showFare() {
  if (!lastFare) return;
  const { p, raw } = lastFare, out = $("fareResult");
  if (!p || (p.totalFare == null && !p.breakdown)) { out.innerHTML = `<div class="note${p && p.error ? " err" : ""}">${esc((p && p.error) || raw)}</div>`; return; }
  const base = Number(p.totalFare) || 0, disc = TYPES[$("ptype").value] || 0, n = Math.max(1, parseInt($("pcount").value) || 1), per = base * (1 - disc);
  const m = x => x > 0 ? "₱" + x.toFixed(2) : "—";
  const rows = (Array.isArray(p.breakdown) ? p.breakdown : []).map(b => `<div class="line"><span>${esc(b.item || "Item")}</span><b>${Number.isFinite(+b.cost) ? "₱" + (+b.cost).toFixed(2) : "—"}</b></div>`).join("");
  out.innerHTML = `<div class="grid3"><div class="tile"><span class="lb">Total for ${n}</span><div class="big">${m(per * n)}</div></div><div class="tile"><span class="lb">Per passenger</span><div class="big">${m(per)}</div></div><div class="tile"><span class="lb">Travel time</span><div class="big sm">${esc(p.travelTime || "—")}</div></div></div>
<div class="tile">${p.route ? `<p class="dim">${esc(p.route)}</p>` : ""}${rows}${disc ? `<div class="line"><span>${$("ptype").value} discount (20%)</span><b>-₱${(base * disc).toFixed(2)}</b></div>` : ""}${p.additionalCosts ? `<p class="note">${esc(p.additionalCosts)}</p>` : ""}${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}</div>`;
}
["ptype", "pcount"].forEach(id => $(id).addEventListener("input", showFare));

$("heroForm").onsubmit = e => {
  e.preventDefault();
  const o = $("dFrom").value.trim(), d = $("dTo").value.trim();
  if (!o || !d) return toast("Enter a start and a destination");
  $("origin").value = o; $("destination").value = d; go("routes"); findRoute();
};
$("routeForm").onsubmit = e => { e.preventDefault(); findRoute(); };
$("fareForm").onsubmit = e => { e.preventDefault(); calcFare(); };

/* ---------- manage routes (admin) ---------- */
$("addRouteBtn").onclick = () => {
  if (!user || user.role !== "admin") return;
  const o = $("newOrigin").value.trim(), d = $("newDestination").value.trim(), v = $("newVehicle").value, f = Number($("newFare").value);
  if (!o || !d || !(f > 0)) return toast("Fill in every field with a valid fare");
  if (routes.some(r => r.origin.toLowerCase() === o.toLowerCase() && r.destination.toLowerCase() === d.toLowerCase() && r.vehicle === v)) return toast("That route already exists");
  routes.push({ id: Date.now(), origin: o, destination: d, vehicle: v, fare: f }); save();
  ["newOrigin", "newDestination", "newFare"].forEach(i => $(i).value = "");
  refresh(); toast("Route added");
};
function adminList() {
  const q = $("mSearch").value.trim().toLowerCase(), v = $("mVeh").value;
  const l = routes.filter(r => (!v || r.vehicle === v) && (r.origin + " " + r.destination).toLowerCase().includes(q));
  $("adminRouteList").innerHTML = l.length ? l.map(r => `<div class="row tile"><div><b>${esc(r.origin)} → ${esc(r.destination)}</b><small>${esc(r.vehicle)} · ₱${Number(r.fare).toFixed(2)}</small></div><button class="btn danger" data-del="${r.id}">${ic("x")}Delete</button></div>`).join("") : `<p class="note">${routes.length ? "No routes match." : "No routes yet. Add one above or load sample routes."}</p>`;
}
$("mSearch").addEventListener("input", adminList); $("mVeh").addEventListener("change", adminList);
function loadSample() {
  let n = 0;
  SAMPLE.forEach(([o, d, v, f]) => [[o, d], [d, o]].forEach(([a, b]) => {
    if (!routes.some(r => r.origin === a && r.destination === b && r.vehicle === v)) routes.push({ id: Date.now() + n++, origin: a, destination: b, vehicle: v, fare: f });
  }));
  save(); refresh(); toast("Sample routes loaded");
}
function exportJSON() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(routes, null, 2)], { type: "application/json" }));
  a.download = "transpogo-routes.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- init ---------- */
fillPlaces();
try {
  const s = JSON.parse(localStorage.getItem("transpogo_user") || sessionStorage.getItem("transpogo_user") || "null");
  const a = s && accounts.find(x => x.username === s.username && x.role === s.role);
  if (a) { user = a; enter(); }
} catch {}
})();
