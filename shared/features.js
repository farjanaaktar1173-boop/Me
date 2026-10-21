/* shared/features.js — MOI ফিচার ইঞ্জিন
   XP/Level • Daily Check-in • Lucky Spin • Leaderboard • Store (ফ্রেম) • Badges
   নোটিফিকেশন • Theme picker • Share profile • Invite
   ডেটা Firebase-এ (MOISync), ডায়মন্ড/XP/রিওয়ার্ড সব Cloud Function-এ — এখানে শুধু UI ও সার্ভারকে অনুরোধ। */
(function(){
'use strict';

/* ═══════════════ ছোট helper ═══════════════ */
const G = (k, d) => (window.MOISync ? MOISync.get(k, d) : d);
const S = (k, v) => { if (window.MOISync) MOISync.set(k, v); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* "আজ" = Dhaka সময় (UTC+6) — সার্ভারের হিসাবের সাথে এক */
const dkey = (d = new Date()) => new Date(d.getTime() + 6 * 3600000).toISOString().slice(0, 10);
const yesterday = () => dkey(new Date(Date.now() - 86400000));
const FALLBACK = (typeof window.FALLBACK_IMG === 'string') ? window.FALLBACK_IMG : '';
const fmt = n => Number(n || 0).toLocaleString();
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h >>> 0); };

function me(){
    const cur = G('moi_user', null);
    if (!cur || !cur.uid) return null;
    const all = G('moi_demo_users', {}) || {};
    return { ...cur, ...(all[cur.uid] || {}), uid: cur.uid };
}
/* শুধু নিজের সাধারণ তথ্য (নাম, বায়ো…) বদলানো যায়; ডায়মন্ড/লেভেল সার্ভারের */
function saveMe(fields){
    const m = me(); if (!m) return;
    const all = G('moi_demo_users', {}) || {};
    all[m.uid] = { ...(all[m.uid] || {}), ...fields };
    S('moi_demo_users', all);
    const cur = G('moi_user', null);
    if (cur && cur.uid === m.uid) S('moi_user', { ...cur, ...fields });
}
const K = (name) => { const m = me(); return 'moi_' + name + '_' + (m ? m.uid : 'guest'); };

/* ═══════════════ Toast ═══════════════ */
let _tt;
function toast(msg, icon){
    let t = document.getElementById('mxToast');
    if (!t){ t = document.createElement('div'); t.id = 'mxToast'; t.className = 'mx-toast'; document.body.appendChild(t); }
    t.innerHTML = (icon ? `<span class="mx-toast-ic">${icon}</span>` : '') + `<span>${esc(msg)}</span>`;
    t.classList.add('show');
    clearTimeout(_tt);
    _tt = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ═══════════════ Sheet (bottom modal) ═══════════════ */
function sheet(title, body, opts){
    opts = opts || {};
    let ov = document.getElementById('mxOverlay');
    if (!ov){
        ov = document.createElement('div');
        ov.id = 'mxOverlay'; ov.className = 'mx-overlay';
        ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
        document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="mx-sheet ${opts.cls || ''}" role="dialog" aria-label="${esc(title)}">
        <div class="mx-grab"></div>
        <div class="mx-head"><div class="mx-title">${title}</div><button class="mx-x" onclick="MOI.close()" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="mx-body">${body}</div></div>`;
    ov.classList.add('show');
    ov.querySelector('.mx-sheet').scrollTop = 0;
    return ov;
}
function closeSheet(){
    const ov = document.getElementById('mxOverlay');
    if (ov) ov.classList.remove('show');
    if (_spinTimer){ clearTimeout(_spinTimer); _spinTimer = null; }
}
function needLogin(){
    if (!me()){ toast('আগে লগইন করুন', '🔒'); return true; }
    return false;
}

/* ═══════════════ Diamonds / XP — শুধু সার্ভারই বদলায় ═══════════════ */
/* সার্ভার ফাংশনের জবাব এলে UI জানানো; আসল সংখ্যা Firestore লাইভ আপডেটে আসে */
function addDiamonds(){ console.warn('[MOI] ডায়মন্ড ক্লায়েন্টে বদলানো যায় না — সার্ভার ফাংশন ব্যবহার হয়'); return (me() || {}).diamonds || 0; }
function addXP(){ /* XP সার্ভার দেয় */ }
async function eco(name, data){
    try { return await MOIEco.call(name, data); }
    catch(e){ toast(e.userMsg || 'সমস্যা হয়েছে', '⚠️'); return null; }
}

/* ═══════════════ XP / Level (সার্ভারের xp ফিল্ড থেকে) ═══════════════ */
const LEVEL_TITLES = ['Rookie','Rising','Star','Elite','Legend','Mythic'];
const levelFromXp = xp => Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
const xpFloor = L => 50 * L * (L - 1);
function levelInfo(){
    const m = me();
    const xp = (m && m.xp) || 0;
    const L = levelFromXp(xp);
    const lo = xpFloor(L), hi = xpFloor(L + 1);
    return { xp, level: L, title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((L - 1) / 3))],
             lo, hi, pct: Math.min(100, Math.round((xp - lo) / (hi - lo) * 100)) };
}

/* ═══════════════ Stats (Badges এর জন্য) ═══════════════ */
function stat(name, n){
    if (!me()) return;
    const s = G(K('stats'), {}) || {};
    s[name] = (s[name] || 0) + (n === undefined ? 1 : n);
    S(K('stats'), s);
}
const getStats = () => G(K('stats'), {}) || {};

const BADGES = [
    { id:'gift1',  icon:'🎁', name:'First Gift',      desc:'প্রথম গিফট পাঠান',            ok: s => (s.gifts||0) >= 1 },
    { id:'spender',icon:'💎', name:'Big Spender',     desc:'মোট ৫০০ 💎 গিফট করুন',        ok: s => (s.giftDiamonds||0) >= 500 },
    { id:'chat',   icon:'💬', name:'Chatterbox',      desc:'২০টি মেসেজ পাঠান',           ok: s => (s.msgs||0) >= 20 },
    { id:'explore',icon:'🧭', name:'Explorer',        desc:'৫টি আলাদা রুমে ঢুকুন',        ok: s => (s.rooms||0) >= 5 },
    { id:'social', icon:'🦋', name:'Social Butterfly',desc:'৫ জনকে Follow করুন',          ok: s => (s.follows||0) >= 5 },
    { id:'streak', icon:'🔥', name:'On Fire',         desc:'৭ দিনের স্ট্রিক',              ok: s => (s.bestStreak||0) >= 7 },
    { id:'lucky',  icon:'🍀', name:'Lucky Charm',     desc:'৩ বার Spin করুন',             ok: s => (s.spins||0) >= 3 },
    { id:'collect',icon:'🖼️', name:'Collector',       desc:'৩টি ফ্রেম সংগ্রহ করুন',       ok: s => (s.frames||0) >= 3 },
    { id:'lv5',    icon:'👑', name:'Level 5',         desc:'Level ৫ এ পৌঁছান',             ok: (s, li) => li.level >= 5 }
];

/* ═══════════════ Notifications ═══════════════ */
function notifs(){ return G(K('notifs'), []) || []; }
function notify(n){
    if (!me()) return;
    const list = notifs();
    list.unshift({ id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ts: Date.now(), read: false, ...n });
    S(K('notifs'), list.slice(0, 60));
    refreshBells();
}
const unread = () => notifs().filter(n => !n.read).length;
function refreshBells(){
    const c = unread();
    document.querySelectorAll('[data-moi-bell]').forEach(b => {
        let dot = b.querySelector('.mx-dot');
        if (!dot){ dot = document.createElement('span'); dot.className = 'mx-dot'; b.style.position = b.style.position || 'relative'; b.appendChild(dot); }
        dot.textContent = c > 9 ? '9+' : String(c);
        dot.style.display = c ? 'grid' : 'none';
    });
}
function ago(ts){
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'এইমাত্র';
    if (s < 3600) return Math.floor(s / 60) + ' মিনিট আগে';
    if (s < 86400) return Math.floor(s / 3600) + ' ঘণ্টা আগে';
    return Math.floor(s / 86400) + ' দিন আগে';
}
function openNotifs(){
    if (needLogin()) return;
    const list = notifs();
    const rows = list.length ? list.map(n => `<div class="mx-notif ${n.read ? '' : 'unread'}">
        <div class="mx-notif-ic">${n.icon || '🔔'}</div>
        <div class="mx-notif-tx"><b>${esc(n.title)}</b><span>${esc(n.text || '')}</span></div>
        <em>${ago(n.ts)}</em></div>`).join('')
        : `<div class="mx-empty"><div>🔔</div><p>কোনো নোটিফিকেশন নেই</p><span class="mx-muted">কেউ Follow করলে বা রিওয়ার্ড পেলে এখানে দেখাবে।</span></div>`;
    sheet('Notifications', `
        <div class="mx-row-actions"><button class="mx-btn ghost sm" onclick="MOI.readAll()"><i class="fa-solid fa-check-double"></i> সব পড়া হয়েছে</button>
        <button class="mx-btn ghost sm" onclick="MOI.clearNotifs()"><i class="fa-solid fa-trash"></i> মুছুন</button></div>
        <div class="mx-notif-list">${rows}</div>`);
}
function readAll(){ S(K('notifs'), notifs().map(n => ({ ...n, read: true }))); refreshBells(); openNotifs(); }
function clearNotifs(){ S(K('notifs'), []); refreshBells(); openNotifs(); }

/* প্রথমবার ঢুকলে স্বাগত নোটিফিকেশন */
function seedWelcome(){
    const m = me(); if (!m) return;
    if (G(K('welcomed'), false)) return;
    S(K('welcomed'), true);
    notify({ icon: '🎉', title: 'MOI তে স্বাগতম!', text: 'প্রতিদিন Check-in করে ডায়মন্ড জিতুন।' });
    notify({ icon: '🎡', title: 'Lucky Spin রেডি', text: 'আজকের ফ্রি Spin নিতে Home থেকে Spin চাপুন।' });
    notify({ icon: '🎨', title: 'থিম বদলান', text: 'Me → Theme থেকে ৪টি কালার থিম থেকে বেছে নিন।' });
}

/* ═══════════════ DAILY CHECK-IN ═══════════════ */
const CHECKIN_REWARDS = [20, 30, 40, 60, 80, 100, 250];
function checkinState(){
    const c = G(K('checkin'), { last: '', streak: 0 }) || { last: '', streak: 0 };
    const claimedToday = c.last === dkey();
    const alive = c.last === dkey() || c.last === yesterday();
    const eff = alive ? c.streak : 0;
    return { ...c, claimedToday, eff, pos: claimedToday ? ((c.streak - 1) % 7) + 1 : eff % 7 };
}
function openCheckin(){
    if (needLogin()) return;
    const st = checkinState();
    const days = CHECKIN_REWARDS.map((r, i) => {
        const cls = i < st.pos ? 'done' : (i === st.pos && !st.claimedToday ? 'today' : '');
        return `<div class="mx-day ${cls} ${i === 6 ? 'big' : ''}">
            <small>Day ${i + 1}</small><div class="mx-day-ic">${i < st.pos ? '✅' : (i === 6 ? '🎁' : '💎')}</div><b>${r}</b></div>`;
    }).join('');
    const nextReward = CHECKIN_REWARDS[st.claimedToday ? st.pos % 7 : st.pos];
    sheet('Daily Check-in', `
        <div class="mx-hero"><div class="mx-hero-n">${st.claimedToday ? st.streak : st.eff}</div>
            <div class="mx-hero-l">দিনের স্ট্রিক 🔥<span class="mx-muted">${st.claimedToday ? 'আজকের রিওয়ার্ড নেওয়া হয়েছে' : 'আজকের রিওয়ার্ড: ' + nextReward + ' 💎'}</span></div></div>
        <div class="mx-days">${days}</div>
        <button class="mx-btn wide" ${st.claimedToday ? 'disabled' : ''} onclick="MOI.claimCheckin()">
            ${st.claimedToday ? 'কাল আবার আসুন' : 'Claim ' + nextReward + ' 💎'}</button>
        <p class="mx-muted center" style="margin-top:10px">একদিন বাদ গেলে স্ট্রিক আবার ১ থেকে শুরু হবে।</p>`);
}
async function claimCheckin(){
    const st = checkinState();
    if (st.claimedToday){ toast('আজ নেওয়া হয়ে গেছে', '⏳'); return; }
    const btn = document.querySelector('.mx-sheet .mx-btn.wide'); if (btn) btn.disabled = true;
    const r = await eco('claimCheckin');
    if (!r){ openCheckin(); return; }
    stat('checkins');
    const s2 = getStats(); if (r.streak > (s2.bestStreak || 0)){ s2.bestStreak = r.streak; S(K('stats'), s2); }
    notify({ icon: '📅', title: 'Check-in সম্পন্ন', text: r.reward + ' 💎 পেয়েছেন • স্ট্রিক ' + r.streak + ' দিন' });
    toast('+' + r.reward + ' 💎  স্ট্রিক ' + r.streak, '🔥');
    confetti();
    /* সার্ভার-স্টেট লাইভ আপডেটে আসবে; তার আগে স্ক্রিন ঠিক রাখতে স্থানীয়ভাবে দেখাই */
    MOISync.push(K('checkin'), { last: dkey(), streak: r.streak });
    openCheckin();
    badgeCheck();
}

/* ═══════════════ LUCKY SPIN ═══════════════ */
const SPIN_SEGS = [10, 50, 5, 100, 20, 500, 15, 25];
const SPIN_WEIGHTS = { 5:30, 10:24, 15:15, 20:12, 25:9, 50:6, 100:3, 500:1 };
const SPIN_COST = 30;
let _spinRot = 0, _spinBusy = false, _spinTimer = null;
function spinState(){ const s = G(K('spin'), { last: '' }) || { last: '' }; return { freeLeft: s.last === dkey() ? 0 : 1 }; }
function wheelSVG(){
    const n = SPIN_SEGS.length, R = 96, cx = 100, cy = 100, step = 360 / n;
    const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
    const fills = ['rgba(var(--c1-rgb),.95)', 'rgba(var(--bg3-rgb),1)', 'rgba(var(--c2-rgb),.95)', 'rgba(var(--bg2-rgb),1)'];
    let out = '';
    SPIN_SEGS.forEach((v, i) => {
        const a0 = i * step, a1 = (i + 1) * step;
        const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
        const mid = a0 + step / 2, [tx, ty] = pt(mid, R * 0.68);
        const light = i % 2 === 0;
        out += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" style="fill:${fills[i % 4]}" stroke="rgba(255,255,255,.18)" stroke-width=".6"/>
        <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) rotate(${mid})"><text text-anchor="middle" dominant-baseline="middle" font-size="${v >= 100 ? 13 : 14}" font-weight="800" style="fill:${light ? 'var(--on)' : '#fff'};font-family:'Bricolage Grotesque','Figtree',sans-serif">${v}</text><text y="12" text-anchor="middle" font-size="8" style="fill:${light ? 'var(--on)' : '#fff'}">💎</text></g>`;
    });
    return `<svg viewBox="0 0 200 200" class="mx-wheel-svg">${out}<circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg>`;
}
function openSpin(){
    if (needLogin()) return;
    const free = spinState().freeLeft;
    sheet('Lucky Spin', `
        <div class="mx-wheel-wrap"><div class="mx-pointer"></div>
            <div class="mx-wheel" id="mxWheel" style="transform:rotate(${_spinRot}deg)">${wheelSVG()}</div>
            <div class="mx-hub">SPIN</div></div>
        <div class="mx-center" id="mxSpinMsg">${free ? 'আজকের ফ্রি Spin আছে!' : 'ফ্রি Spin শেষ — আরেকটা ' + SPIN_COST + ' 💎'}</div>
        <button class="mx-btn wide" id="mxSpinBtn" onclick="MOI.doSpin()">${free ? 'Spin (ফ্রি)' : 'Spin (' + SPIN_COST + ' 💎)'}</button>
        <p class="mx-muted center" style="margin-top:10px">সর্বোচ্চ জ্যাকপট ৫০০ 💎 • প্রতিদিন একটা ফ্রি Spin</p>`);
}
function pickPrize(){
    const total = Object.values(SPIN_WEIGHTS).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const v of SPIN_SEGS){ r -= SPIN_WEIGHTS[v]; if (r <= 0) return v; }
    return 10;
}
async function doSpin(){
    if (_spinBusy) return;
    const m = me(); if (!m) return;
    _spinBusy = true;
    const btn = document.getElementById('mxSpinBtn'); if (btn) btn.disabled = true;
    const r = await eco('doSpin');                       /* ফলাফল সার্ভার ঠিক করে — ক্লায়েন্ট শুধু ঘোরায় */
    if (!r){ _spinBusy = false; if (btn) btn.disabled = false; return; }
    const prize = r.prize;
    if (r.free) MOISync.push(K('spin'), { last: dkey() });
    const idxs = SPIN_SEGS.map((v, i) => v === prize ? i : -1).filter(i => i >= 0);
    const idx = idxs[Math.floor(Math.random() * idxs.length)];
    const step = 360 / SPIN_SEGS.length;
    const jitter = (Math.random() - .5) * step * .6;
    const target = 360 * 6 + (360 - (idx * step + step / 2 + jitter));
    _spinRot = Math.ceil(_spinRot / 360) * 360 + target;
    const w = document.getElementById('mxWheel');
    if (w){ w.style.transition = 'transform 4.6s cubic-bezier(.12,.72,.08,1)'; w.style.transform = `rotate(${_spinRot}deg)`; }
    _spinTimer = setTimeout(() => {
        _spinBusy = false;
        stat('spins');
        notify({ icon: '🎡', title: 'Lucky Spin', text: prize + ' 💎 জিতেছেন!' });
        toast('আপনি জিতেছেন ' + prize + ' 💎', prize >= 100 ? '🏆' : '🎉');
        if (prize >= 50) confetti();
        const msg = document.getElementById('mxSpinMsg');
        if (msg) msg.innerHTML = `🎉 <b>${prize} 💎</b> জিতেছেন!`;
        if (btn){ btn.disabled = false; btn.textContent = 'আবার Spin (' + SPIN_COST + ' 💎)'; }
        window.dispatchEvent(new CustomEvent('moi:diamonds'));
        badgeCheck();
    }, 4700);
}

/* ═══════════════ LEADERBOARD ═══════════════ */
let _lbTab = 'rich', _lbRange = 'week';
function lbData(){
    const users = G('moi_demo_users', {}) || {};
    const rooms = G('moi_demo_rooms', {}) || {};
    const real = Object.values(users).filter(u => u && u.uid && !u._missing && u.role !== 'guest' && u.name);
    let rows = [];
    if (_lbTab === 'rich') rows = real.map(u => ({ id: u.uid, name: u.name, photo: u.photo, score: u.diamonds || 0, sub: u.country || '' }));
    else if (_lbTab === 'gifters') rows = real.map(u => ({ id: u.uid, name: u.name, photo: u.photo, score: u.giftsSent || 0, sub: u.country || '' }));
    else rows = Object.values(rooms).filter(r => r && r.name).map(r => ({ id: r.id, name: r.name, photo: r.logo, score: r.points || 0, sub: r.country || '' }));
    rows = rows.filter(r => r.score > 0 || _lbTab === 'rich');
    rows.sort((a, b) => b.score - a.score);
    return rows;
}
function openLeaderboard(tab){
    if (tab) _lbTab = tab;
    const m = me();
    const rows = lbData();
    const top = rows.slice(0, 3), rest = rows.slice(3, 10);
    const myIdx = m ? rows.findIndex(r => r.id === m.uid) : -1;
    const unit = _lbTab === 'rooms' ? '🔥' : '💎';
    const av = (r, big) => `<img src="${esc(r.photo || FALLBACK)}" alt="" class="${big ? 'big' : ''}" onerror="this.src='${FALLBACK}'">`;
    const pod = [top[1], top[0], top[2]].map((r, i) => r ? `<div class="mx-pod p${[2,1,3][i]}">
        <div class="mx-pod-av">${[2,1,3][i] === 1 ? '<span class="mx-crown">👑</span>' : ''}${av(r, [2,1,3][i] === 1)}<i>${[2,1,3][i]}</i></div>
        <b>${esc(r.name)}</b><span>${unit} ${fmt(r.score)}</span></div>` : '').join('');
    const list = rest.map((r, i) => `<div class="mx-lb-row ${m && r.id === m.uid ? 'me' : ''}"><em>${i + 4}</em>${av(r)}<div class="mx-lb-n"><b>${esc(r.name)}</b><span>${esc(r.sub)}</span></div><strong>${unit} ${fmt(r.score)}</strong></div>`).join('');
    const mine = (m && _lbTab !== 'rooms') ? `<div class="mx-lb-row me sticky"><em>${myIdx >= 0 ? myIdx + 1 : '—'}</em><img src="${esc(m.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"><div class="mx-lb-n"><b>আপনি</b><span>আপনার র‍্যাঙ্ক</span></div><strong>${unit} ${fmt((rows[myIdx] || {}).score || 0)}</strong></div>` : '';
    sheet('Leaderboard', `
        <div class="mx-seg">${[['rich','Rich'],['gifters','Gifters'],['rooms','Rooms']].map(([k, l]) => `<button class="${_lbTab === k ? 'on' : ''}" onclick="MOI.lb('${k}')">${l}</button>`).join('')}</div>
        <div class="mx-podium">${pod}</div>
        <div class="mx-lb-list">${list}</div>${mine}`);
}

/* ═══════════════ STORE (ফ্রেম) ═══════════════ */
const FRAMES = [
    { id:'basic',  name:'Classic',  price:0,    cls:'f-basic' },
    { id:'aurora', name:'Aurora',   price:500,  cls:'f-aurora' },
    { id:'flame',  name:'Flame',    price:1200, cls:'f-flame' },
    { id:'ocean',  name:'Ocean',    price:2000, cls:'f-ocean' },
    { id:'royal',  name:'Royal',    price:3500, cls:'f-royal' },
    { id:'galaxy', name:'Galaxy',   price:6000, cls:'f-galaxy' }
];
const frameState = () => { const f = G(K('frames'), null) || { owned: ['basic'], equipped: 'basic' }; const m = me(); if (m && m.frame && !f.equipped) f.equipped = m.frame; return f; };
function applyFrame(){
    const f = me() ? (frameState().equipped || (me().frame) || 'basic') : 'basic';
    document.documentElement.setAttribute('data-frame', f);
}
function openStore(){
    if (needLogin()) return;
    const m = me(), fs = frameState();
    const cards = FRAMES.map(f => {
        const owned = fs.owned.includes(f.id), eq = fs.equipped === f.id;
        return `<div class="mx-frame ${eq ? 'eq' : ''}">
            <div class="mx-frame-prev"><div class="mx-ring ${f.cls}"><img src="${esc(m.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"></div></div>
            <b>${f.name}</b>
            <button class="mx-btn sm ${owned ? 'ghost' : ''}" ${eq ? 'disabled' : ''} onclick="MOI.frame('${f.id}')">${eq ? 'Equipped' : owned ? 'Equip' : (f.price + ' 💎')}</button></div>`;
    }).join('');
    sheet('Store', `<div class="mx-bal"><span>আপনার ব্যালেন্স</span><b>💎 ${fmt(m.diamonds)}</b></div>
        <div class="mx-sec">অবতার ফ্রেম</div><div class="mx-frames">${cards}</div>
        <div class="mx-sec">মুকুট</div><div class="mx-frames">${crownCards(m)}</div>
        <p class="mx-muted center" style="margin-top:12px">ফ্রেম Me, Home ও রুমে আপনার ছবির চারপাশে দেখাবে। মুকুট কিনলে ব্যাগে যাবে — Me → My Bag থেকে Use করুন।</p>`);
    setTimeout(mountCrownPreviews, 0);
}
/* ═══════════════ মুকুট (Lottie) ═══════════════
   ফাইল: moi/crowns/<file>.json • দাম সার্ভারে (functions/catalog.js) — এখানকার দাম শুধু দেখানোর জন্য, দুই জায়গায় একই রাখুন।
   কেনা = ব্যাগে যায় • ব্যাগের Use বাটনে পরা হয় • পরা মুকুট সবার কাছে ছবির চারপাশে দেখায়। */
const CROWN_BASE = (() => { const s = [...document.scripts].find(x => /shared\/features\.js/.test(x.src || '')); return s ? s.src.replace(/shared\/features\.js.*$/, 'crowns/') : '../crowns/'; })();
const CROWN_SCALE = 1.72;   /* মুকুটের আকার = ছবির ১.৭২ গুণ (Lottie ক্যানভাসে ছবির গোল অংশ প্রায় ৫৮%) — বড়/ছোট করতে এই সংখ্যা বদলান */
const CROWN_LIST = [
    { id:'crown_gold',     name:'Gold Crown',     price:500,  file:'crown_gold.json' },
    { id:'royal_red',      name:'Royal Red',      price:600,  file:'royal_red.json' },
    { id:'royal_green',    name:'Royal Green',    price:700,  file:'royal_green.json' },
    { id:'royal_purple',   name:'Royal Purple',   price:800,  file:'royal_purple.json' },
    { id:'lion_vip',       name:'Lion VIP',       price:900,  file:'lion_vip.json' },
    { id:'dragon_vip',     name:'Dragon VIP',     price:1000, file:'dragon_vip.json' },
    { id:'crystal_shield', name:'Crystal Shield', price:1100, file:'crystal_shield.json' },
    { id:'ocean_pearl',    name:'Ocean Pearl',    price:1200, file:'ocean_pearl.json' }
];
const OFFICIAL_CROWN = { id:'official', name:'Official Dragon', price:0, file:'official.json', official:true };
const crownById = id => id === 'official' ? OFFICIAL_CROWN : (CROWN_LIST.find(c => c.id === id) || null);

/* ইউজার এখন কোন মুকুট পরে আছে (না থাকলে null). Developer এর ডিফল্ট = official */
function effectiveCrown(u){
    if (!u) return null;
    const c = u.crown;
    if (c === 'none') return null;
    if (c === 'official' || !c) return u.role === 'developer' ? OFFICIAL_CROWN : null;
    return (u.ownedCrowns || []).includes(c) ? crownById(c) : null;
}

let _lottieP = null;
function lottieLib(){
    if (window.lottie) return Promise.resolve(window.lottie);
    if (_lottieP) return _lottieP;
    _lottieP = new Promise(res => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
        s.onload = () => res(window.lottie || null);
        s.onerror = () => { _lottieP = null; res(null); };
        document.head.appendChild(s);
    });
    return _lottieP;
}
const _crownData = {};
function crownData(c){
    if (!_crownData[c.id]) _crownData[c.id] = fetch(CROWN_BASE + c.file).then(r => r.ok ? r.json() : Promise.reject(r.status)).catch(() => { delete _crownData[c.id]; return null; });
    return _crownData[c.id];
}
const _crownHosts = new Set();
function crownDestroy(host){
    if (!host) return;
    if (host._crownAnim){ try { host._crownAnim.destroy(); } catch(e){} host._crownAnim = null; }
    const old = host.querySelector(':scope > .moi-crown-ring'); if (old) old.remove();
    host._crownId = ''; _crownHosts.delete(host);
}
/* DOM থেকে মুছে যাওয়া ছবির অ্যানিমেশন বন্ধ (ল্যাগ ঠেকাতে) */
function crownPrune(){ _crownHosts.forEach(h => { if (!h.isConnected) crownDestroy(h); }); }
async function crownAttach(host, crown, scale){
    if (!host) return null;
    if (!crown){ crownDestroy(host); return null; }
    if (host._crownId === crown.id && host.querySelector(':scope > .moi-crown-ring')) return host._crownAnim || null;
    crownDestroy(host);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host._crownId = crown.id; _crownHosts.add(host);
    const ring = document.createElement('div'); ring.className = 'moi-crown-ring';
    ring.style.width = ring.style.height = Math.round((scale || CROWN_SCALE) * 100) + '%';
    host.appendChild(ring);
    const [lib, data] = await Promise.all([lottieLib(), crownData(crown)]);
    if (host._crownId !== crown.id || !ring.isConnected) return null;
    if (!lib || !data){ ring.remove(); host._crownId = ''; return null; }
    try {
        const anim = lib.loadAnimation({ container: ring, renderer: 'svg', loop: true, autoplay: true, animationData: JSON.parse(JSON.stringify(data)) });
        host._crownAnim = anim; return anim;
    } catch(e){ ring.remove(); host._crownId = ''; return null; }
}
const crownAttachUser = (host, user, scale) => crownAttach(host, effectiveCrown(user), scale);
/* Store/ব্যাগের প্রিভিউ: data-crown-stage="<id>" ওয়ালা সব এলিমেন্টে অ্যানিমেশন বসায় */
function mountCrownPreviews(root){
    crownPrune();
    (root || document).querySelectorAll('[data-crown-stage]').forEach(el => { const c = crownById(el.getAttribute('data-crown-stage')); if (c) crownAttach(el, c); });
}

function crownCards(m){
    const owned = m.ownedCrowns || [];
    return CROWN_LIST.map(c => {
        const has = owned.includes(c.id);
        return `<div class="mx-frame mx-crown-card">
            <div class="mx-crown-stage" data-crown-stage="${c.id}"><img src="${esc(m.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"></div>
            <b>${esc(c.name)}</b>
            <button class="mx-btn sm ${has ? 'ghost' : ''}" ${has ? 'disabled' : ''} onclick="MOI.crown('${c.id}')">${has ? 'Owned ✓' : (c.price + ' 💎')}</button></div>`;
    }).join('');
}
/* কেনা — শুধু ব্যাগে যায় */
async function crown(id){
    const m = me(), c = CROWN_LIST.find(x => x.id === id); if (!m || !c) return;
    if ((m.ownedCrowns || []).includes(id)){ toast('এই মুকুট আপনার ব্যাগে আছে', '👑'); return; }
    if ((m.diamonds || 0) < c.price){ toast('পর্যাপ্ত ডায়মন্ড নেই', '💎'); return; }
    const r = await eco('buyCrown', { id }); if (!r) return;
    toast(c.name + ' কেনা হয়েছে — Me → My Bag থেকে Use করুন', '👑'); confetti();
    setTimeout(openStore, 600);
}
/* পরা (ব্যাগের Use) — id '' দিলে খুলে ফেলা */
async function useCrown(id){
    const m = me(); if (!m) return false;
    const r = await eco('equipCrown', { id: id || '' }); if (!r) return false;
    const want = (r && typeof r.crown === 'string') ? r.crown : (id || '');
    for (let i = 0; i < 20; i++){ const cur = me(); if (cur && (cur.crown || '') === want) break; await new Promise(res => setTimeout(res, 150)); }
    return true;
}
/* ইউজারের পরিচয়-চিহ্ন (রোল, মুকুট, অফিসিয়াল ব্যাজ) — সব পেজে একই */
const ROLE_CHIP = { developer:['DEV','#ff4d6d'], superadmin:['SUPER ADMIN','#f5b301'], distributor:['DISTRIBUTOR','#22c55e'], admin:['ADMIN','#38bdf8'], vip:['VIP','#c084fc'] };
const BADGE_ICON = { official_host:'🎙️', top_gifter:'🎁', verified:'✅', early_bird:'🐦', moderator:'🛡️' };
function identityHTML(u){
    if (!u) return '';
    let h = '';
    const r = ROLE_CHIP[u.role]; if (r) h += `<span style="background:${r[1]};color:#111;font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;margin:0 3px;letter-spacing:.04em">${r[0]}</span>`;
    (u.badges || []).forEach(b => { if (BADGE_ICON[b]) h += `<span title="${b}">${BADGE_ICON[b]}</span>`; });
    return h;
}
async function frame(id){
    const m = me(), f = FRAMES.find(x => x.id === id); if (!m || !f) return;
    const fs = frameState();
    if (!fs.owned.includes(id) && (m.diamonds || 0) < f.price){ toast('পর্যাপ্ত ডায়মন্ড নেই — Check-in বা Spin করুন', '💎'); return; }
    const r = await eco('buyFrame', { id });
    if (!r) return;
    MOISync.push(K('frames'), r.state);
    if (r.bought){
        stat('frames');
        notify({ icon: '🖼️', title: f.name + ' ফ্রেম কেনা হয়েছে', text: 'এখনই Equip করা হয়েছে।' });
        toast(f.name + ' ফ্রেম কেনা হয়েছে', '🖼️'); confetti();
    }
    applyFrame(); openStore(); badgeCheck();
}

/* ═══════════════ LEVEL & BADGES ═══════════════ */
function openBadges(){
    if (needLogin()) return;
    const li = levelInfo(), s = getStats();
    const earned = G(K('badges'), []) || [];
    const grid = BADGES.map(b => { const on = earned.includes(b.id) || b.ok(s, li);
        return `<div class="mx-badge ${on ? 'on' : ''}"><div class="mx-badge-ic">${b.icon}</div><b>${b.name}</b><span>${b.desc}</span></div>`; }).join('');
    const doneCount = BADGES.filter(b => earned.includes(b.id) || b.ok(s, li)).length;
    sheet('Level & Badges', `
        <div class="mx-level"><div class="mx-level-n">${li.level}</div><div class="mx-level-i"><b>${li.title}</b>
        <div class="mx-bar"><i style="width:${li.pct}%"></i></div><span class="mx-muted">${fmt(li.xp)} / ${fmt(li.hi)} XP • পরের লেভেলে বোনাস ${(li.level + 1) * 25} 💎</span></div></div>
        <div class="mx-sec">XP কিভাবে পাবেন</div>
        <div class="mx-chips"><span class="mx-chip">Check-in +20</span><span class="mx-chip">গিফট +দাম/২</span><span class="mx-chip">Spin +5</span><span class="mx-chip">স্টোর +10</span><span class="mx-chip">মিশন +১০-২০</span></div>
        <div class="mx-sec">Badges (${doneCount}/${BADGES.length})</div><div class="mx-badges">${grid}</div>`);
}
function badgeCheck(){
    if (!me()) return;
    const li = levelInfo(), s = getStats();
    const earned = G(K('badges'), []) || [];
    BADGES.forEach(b => {
        if (!earned.includes(b.id) && b.ok(s, li)){
            earned.push(b.id); S(K('badges'), earned);
            notify({ icon: b.icon, title: 'নতুন Badge: ' + b.name, text: b.desc });
            toast('Badge পেয়েছেন: ' + b.name, b.icon);
        }
    });
}

/* ═══════════════ THEME PICKER ═══════════════ */
function openTheme(){
    const cur = window.getTheme ? window.getTheme() : 'golden';
    const cards = Object.entries(window.MOI_THEMES || {}).map(([k, t]) => `<button class="mx-theme ${cur === k ? 'on' : ''}" onclick="MOI.theme('${k}')">
        <div class="mx-sw" style="background:linear-gradient(135deg,${t.sw[0]},${t.sw[1]})"><i style="background:${t.sw[2]}"></i></div>
        <b>${t.name}</b><span>${t.desc}</span>${cur === k ? '<em><i class="fa-solid fa-check"></i></em>' : ''}</button>`).join('');
    sheet('Theme', `<div class="mx-themes">${cards}</div><p class="mx-muted center" style="margin-top:12px">থিম সব পেজে একসাথে বদলে যায়।</p>`);
}
function theme(k){ if (window.setTheme) window.setTheme(k); toast((window.MOI_THEMES[k] || {}).name + ' থিম চালু', '🎨'); openTheme(); }

/* ═══════════════ SHARE PROFILE + INVITE ═══════════════ */
function profileLink(){ const m = me(); return location.origin + location.pathname.replace(/\/[^/]*\/[^/]*$/, '/login/index.html') + '?ref=' + (m ? (m.moiId || m.uid) : ''); }
function codeSVG(seed){
    const N = 21; let h = hash(String(seed)), cells = '';
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
        let on;
        if (finder(x, y)){ const lx = x % (N - 7 > x ? 7 : 7), ly = y % 7; const fx = x < 7 ? x : x - (N - 7), fy = y < 7 ? y : y - (N - 7);
            on = (fx === 0 || fx === 6 || fy === 0 || fy === 6) || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); }
        else on = rnd() > .52;
        if (on) cells += `<rect x="${x}" y="${y}" width="1.02" height="1.02" rx=".18"/>`;
    }
    return `<svg viewBox="0 0 21 21" class="mx-code" fill="currentColor">${cells}</svg>`;
}
function openShare(){
    if (needLogin()) return;
    const m = me(), li = levelInfo();
    sheet('Share profile', `
        <div class="mx-idcard"><div class="mx-idcard-top"><div class="mx-ring ${(FRAMES.find(f => f.id === frameState().equipped) || FRAMES[0]).cls}"><img src="${esc(m.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'"></div>
            <div><b>${esc(m.name)}</b><span>ID ${esc(m.moiId || m.uid.slice(0, 8))}</span><span class="mx-chip">Lv ${li.level} • ${li.title}</span></div></div>
            <div class="mx-codebox">${codeSVG(m.moiId || m.uid)}</div>
            <p class="mx-muted center">আমাকে MOI তে খুঁজুন</p></div>
        <div class="mx-two"><button class="mx-btn ghost" onclick="MOI.copy('${esc(m.moiId || m.uid)}','ID কপি হয়েছে')"><i class="fa-solid fa-copy"></i> ID কপি</button>
        <button class="mx-btn ghost" onclick="MOI.copy('${esc(profileLink())}','লিংক কপি হয়েছে')"><i class="fa-solid fa-link"></i> লিংক কপি</button></div>
        <div class="mx-two" style="margin-top:10px"><button class="mx-btn" onclick="MOI.nativeShare()"><i class="fa-solid fa-share-nodes"></i> Share</button>
        <button class="mx-btn ghost" onclick="MOI.downloadCard()"><i class="fa-solid fa-download"></i> Card সেভ</button></div>`);
}
function nativeShare(){
    const m = me();
    const data = { title: 'MOI', text: m.name + ' (ID ' + (m.moiId || '') + ') — MOI তে আমাকে খুঁজুন!', url: profileLink() };
    if (navigator.share) navigator.share(data).catch(() => {});
    else copy(data.text + ' ' + data.url, 'শেয়ার টেক্সট কপি হয়েছে');
}
function copy(txt, msg){
    const done = () => toast(msg || 'কপি হয়েছে', '📋');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fb());
    else fb();
    function fb(){ const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch(e){ toast('কপি করা যায়নি', '⚠️'); } ta.remove(); }
}
function downloadCard(){
    const m = me(), li = levelInfo();
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
    const c = cv.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const g = c.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, v('--bg3')); g.addColorStop(1, v('--bg0'));
    c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
    const g2 = c.createLinearGradient(0, 0, 1080, 0); g2.addColorStop(0, v('--c1')); g2.addColorStop(1, v('--c2'));
    c.fillStyle = g2; c.fillRect(0, 0, 1080, 14);
    c.fillStyle = '#fff'; c.font = '800 64px "Bricolage Grotesque", Figtree, sans-serif'; c.fillText('MOI', 80, 140);
    const finish = (img) => {
        c.save(); c.beginPath(); c.arc(540, 420, 190, 0, Math.PI * 2); c.closePath(); c.lineWidth = 14; c.strokeStyle = g2; c.stroke(); c.clip();
        if (img) c.drawImage(img, 350, 230, 380, 380); else { c.fillStyle = v('--bg3'); c.fillRect(350, 230, 380, 380); }
        c.restore();
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 84px "Bricolage Grotesque", Figtree, sans-serif'; c.fillText(m.name, 540, 740);
        c.fillStyle = v('--c3'); c.font = '600 46px Figtree, sans-serif'; c.fillText('ID ' + (m.moiId || ''), 540, 810);
        c.fillStyle = v('--c2'); c.font = '700 40px Figtree, sans-serif'; c.fillText('Level ' + li.level + ' • ' + li.title, 540, 880);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(300, 960, 480, 480 - 130);
        c.fillStyle = '#fff'; c.font = '500 36px Figtree, sans-serif'; c.fillText('Find me on MOI', 540, 1290);
        try { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'moi-profile-card.png'; a.click(); toast('Card সেভ হয়েছে', '🖼️'); }
        catch(e){ toast('Card সেভ করা যায়নি', '⚠️'); }
    };
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => finish(img); img.onerror = () => finish(null);
    img.src = m.photo || FALLBACK;
}
function openInvite(){
    if (needLogin()) return;
    const m = me(), used = G(K('redeemed'), null), count = (G(K('invited'), []) || []).length;
    sheet('Invite & Earn', `
        <div class="mx-hero"><div class="mx-hero-n">${esc(m.moiId || '—')}</div><div class="mx-hero-l">আপনার ইনভাইট কোড<span class="mx-muted">${count} জন যোগ দিয়েছে</span></div></div>
        <div class="mx-two"><button class="mx-btn" onclick="MOI.copy('${esc(m.moiId || m.uid)}','ইনভাইট কোড কপি হয়েছে')"><i class="fa-solid fa-copy"></i> কোড কপি</button>
        <button class="mx-btn ghost" onclick="MOI.nativeShare()"><i class="fa-solid fa-share-nodes"></i> Share</button></div>
        <div class="mx-sec">বন্ধুর কোড ব্যবহার করুন</div>
        ${used ? `<div class="mx-card center">✅ আপনি <b>${esc(used)}</b> এর কোড ব্যবহার করেছেন</div>` : `
        <div class="mx-redeem"><input id="mxCode" inputmode="numeric" maxlength="12" placeholder="বন্ধুর MOI ID লিখুন"><button class="mx-btn" onclick="MOI.redeem()">Redeem</button></div>
        <p class="mx-muted center" style="margin-top:8px">সফল হলে আপনি ও বন্ধু দুজনেই ২০০ 💎 পাবেন।</p>`}`);
}
async function redeem(){
    const m = me(), inp = document.getElementById('mxCode'); if (!m || !inp) return;
    const code = inp.value.trim();
    if (!code){ toast('কোড লিখুন', '✍️'); return; }
    if (String(m.moiId) === code){ toast('নিজের কোড ব্যবহার করা যাবে না', '🚫'); return; }
    const r = await eco('redeemInvite', { code });
    if (!r) return;
    MOISync.push(K('redeemed'), r.owner);
    notify({ icon: '🤝', title: 'Invite বোনাস', text: r.owner + ' এর কোড ব্যবহার করে ' + r.bonus + ' 💎 পেয়েছেন।' });
    toast('+' + r.bonus + ' 💎 বোনাস!', '🤝'); confetti(); openInvite();
}

/* ═══════════════ Follow-সংক্রান্ত নোটিফিকেশন ═══════════════ */
function onFollowed(targetUid){
    const m = me(); if (!m || !targetUid) return;
    stat('follows'); badgeCheck();
    notify_other(targetUid, { icon: '👤', title: m.name + ' আপনাকে Follow করেছেন', text: 'Follow back করুন।' });
}
/* অন্য ইউজারকে নোটিফিকেশন (Realtime DB: শুধু নতুন যোগ হয়) */
function notify_other(uid, n){
    try {
        if (!window.MOIFB || !uid) return;
        MOIFB.rtdb.ref(MOIFB.LIVE + '/notifications/' + uid).push(Object.assign({ read: false, ts: Date.now() }, n)).catch(() => {});
    } catch(e){}
}

/* ═══════════════ Confetti ═══════════════ */
function confetti(){
    const cs = getComputedStyle(document.documentElement);
    const cols = [cs.getPropertyValue('--c1'), cs.getPropertyValue('--c2'), cs.getPropertyValue('--c3'), '#fff'].map(s => s.trim() || '#fff');
    const box = document.createElement('div'); box.className = 'mx-confetti';
    for (let i = 0; i < 46; i++){
        const p = document.createElement('i');
        p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * .25}s;animation-duration:${1.3 + Math.random() * 1.1}s;transform:rotate(${Math.random() * 360}deg);width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px`;
        box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2800);
}

/* ═══════════════ Bell বাঁধা ═══════════════ */
function bindBell(el){
    if (!el) return;
    el.setAttribute('data-moi-bell', '1'); el.style.cursor = 'pointer';
    el.addEventListener('click', openNotifs);
    refreshBells();
}

/* ═══════════════ Public API ═══════════════ */
window.MOI = {
    me, saveMe, toast, sheet, close: closeSheet, copy, confetti, esc, fmt, G, S, K,
    addDiamonds, addXP, stat, levelInfo, notify, unread, bindBell, refreshBells, onFollowed, badgeCheck,
    openCheckin, claimCheckin, openSpin, doSpin, openLeaderboard, openStore, crown, useCrown, identityHTML, CROWN_LIST, crownById, effectiveCrown, crownAttach, crownAttachUser, crownDestroy, crownPrune, mountCrownPreviews, openBadges, openTheme, openShare, openInvite, openNotifs,
    lb: t => openLeaderboard(t), lbRange: r => { _lbRange = r; openLeaderboard(); },
    frame, theme, redeem, nativeShare, downloadCard, readAll, clearNotifs,
    FRAMES, BADGES, checkinState, spinState, frameState,
    canCheckin: () => me() && !checkinState().claimedToday,
    canSpin: () => me() && spinState().freeLeft > 0
};

/* শুরু — লগইন ও লাইভ সিঙ্ক তৈরি হওয়ার পর */
function boot(){
    applyFrame(); seedWelcome(); refreshBells(); badgeCheck();
    window.addEventListener('storage', e => { if (/notifs|frames/.test(e.key || '')){ refreshBells(); applyFrame(); } });
    window.addEventListener('moi:diamonds', () => {});
}
function start(){
    if (!window.MOIReady) return;
    MOIReady.then(u => {
        if (!u) return;
        let tries = 0;
        const wait = () => { if ((MOISync.kvReady && MOISync.stateReady) || ++tries > 30) boot(); else setTimeout(wait, 100); };
        wait();
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
