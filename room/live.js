/* room/live.js — Room-এর নতুন ফিচার
   • ডান পাশে অ্যাকশন রেল: Like ❤, Raise Hand ✋, Share 🔗, More ⋯
   • More: ভলিউম, Mute, Rules, Invite friends, Report, Room info
   • রিয়েলটাইম: লাইক (RTDB), হাত তোলা (RTDB), রুলস (Firestore), রিপোর্ট (Firestore) */

console.log('[ROOM] live.js loaded');

(function(){
'use strict';

const REPORT_REASONS = ['অশ্লীল বা আপত্তিকর কনটেন্ট', 'স্প্যাম বা বিজ্ঞাপন', 'হয়রানি বা গালাগাল', 'ভুয়া তথ্য', 'অন্য কারণ'];
const DEFAULT_RULES = ['সবার সাথে ভদ্র আচরণ করুন 🤝', 'গালাগাল, হয়রানি ও অশ্লীলতা নিষিদ্ধ', 'অন্যের কথার মাঝে বাধা দেবেন না', 'স্প্যাম ও বিজ্ঞাপন দেবেন না', 'নিয়ম না মানলে মাইক বা রুম থেকে সরানো হতে পারে'];

const G = (k, d) => { const v = ls_get(k, null); return v === null || v === undefined ? d : v; };
const S = (k, v) => ls_set(k, v);
const LG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };   /* শুধু ডিভাইসের সেটিং (ভলিউম) */
const LS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const FB = () => window.MOIFB;
const rt = (n) => FB().rtdb.ref(FB().LIVE + '/rooms/' + ROOM_ID + '/' + n);
const rk = n => 'moi_room_' + ROOM_ID + '_' + n;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const isMe = uid => myProfile && uid === myProfile.uid;

let handRaised = false, handsMap = {}, likeCount = 0;

function ready(){
    return typeof state !== 'undefined' && state && Array.isArray(state.seats) && typeof myProfile !== 'undefined' && myProfile && typeof joined !== 'undefined' && joined;
}
const poll = setInterval(() => { if (ready()){ clearInterval(poll); init(); } }, 300);
setTimeout(() => clearInterval(poll), 15000);

/* ═══════════════ init ═══════════════ */
function init(){
    buildRail();
    applyVolume();
    refreshHandIcon();
    listenLikes();
    listenHands();
    window.addEventListener('moi:diamonds', () => { if (window.MOI){ const m = MOI.me(); if (m) myProfile.diamonds = m.diamonds; } });
    window.addEventListener('moi:sync', (e) => {
        const k = e.detail && e.detail.key;
        if (k === KEY.seats){ if (handRaised && mySeatIdx() > -1){ handRaised = false; rt('hands/' + myProfile.uid).remove().catch(() => {}); toastMsg('🎤 হোস্ট আপনাকে মাইকে ডেকেছেন!'); if (typeof armSeatDisconnect === 'function') armSeatDisconnect(mySeatIdx()); } refreshHandIcon(); }
    });
    if (window.MOI){
        const k = 'moi_rooms_seen_' + myProfile.uid;
        const seen = G(k, []);
        if (!seen.includes(ROOM_ID)){ seen.push(ROOM_ID); S(k, seen); }
    }
}

/* ═══════════════ অ্যাকশন রেল ═══════════════ */
function buildRail(){
    const app = document.querySelector('.app-container'); if (!app || document.getElementById('rxRail')) return;
    const likes = likeCount;
    const rail = document.createElement('div');
    rail.className = 'rx-rail'; rail.id = 'rxRail';
    rail.innerHTML = `
        <button class="rx-btn rx-like" id="rxLike" aria-label="Like"><i class="fa-solid fa-heart"></i><b id="rxLikeN">${fmtN(likes)}</b></button>
        <button class="rx-btn" id="rxHand" aria-label="Raise hand"><i class="fa-solid fa-hand"></i><em id="rxHandBadge"></em></button>
        <button class="rx-btn" id="rxShare" aria-label="Share"><i class="fa-solid fa-share-nodes"></i></button>
        <button class="rx-btn" id="rxMore" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button>`;
    app.appendChild(rail);
    const hearts = document.createElement('div'); hearts.className = 'rx-hearts'; hearts.id = 'rxHearts'; app.appendChild(hearts);
    document.getElementById('rxLike').addEventListener('click', () => like(true));
    document.getElementById('rxHand').addEventListener('click', onHand);
    document.getElementById('rxShare').addEventListener('click', openShareRoom);
    document.getElementById('rxMore').addEventListener('click', openMore);
}
const fmtN = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);

/* ═══════════════ Like / হার্ট ═══════════════ */
let _myLikeRun = 0, _likeInit = false;
function listenLikes(){
    rt('likes').on('value', snap => {
        const n = Number(snap.val()) || 0;
        if (_likeInit && n > likeCount){ const d = Math.min(3, n - likeCount); for (let i = 0; i < d; i++) setTimeout(() => spawnHeart(false), i * 200); }
        likeCount = n; _likeInit = true;
        const el = document.getElementById('rxLikeN'); if (el) el.textContent = fmtN(n);
    });
}
function like(mine){
    if (myProfile.isGuest){ toastMsg('গেস্ট লাইক দিতে পারে না — লগইন করুন'); return; }
    rt('likes').transaction(v => (Number(v) || 0) + 1).catch(() => {});   /* সবার স্ক্রিনে আসল সংখ্যা */
    spawnHeart(mine);
    if (mine){
        const b = document.getElementById('rxLike'); if (b){ b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
        _myLikeRun++;
    }
}
function spawnHeart(mine){
    const box = document.getElementById('rxHearts'); if (!box) return;
    const h = document.createElement('i');
    h.className = 'rx-heart';
    h.textContent = pick(mine ? ['❤️', '💖', '💗', '💕'] : ['❤️', '🧡', '💜', '💙', '💛', '💖']);
    h.style.setProperty('--dx', (rand(-46, 46)).toFixed(0) + 'px');
    h.style.setProperty('--rot', (rand(-24, 24)).toFixed(0) + 'deg');
    h.style.fontSize = rand(20, 32).toFixed(0) + 'px';
    h.style.animationDuration = rand(1.7, 2.6).toFixed(2) + 's';
    box.appendChild(h);
    setTimeout(() => h.remove(), 2800);
}

/* ═══════════════ Raise Hand / Mic requests ═══════════════ */
function mySeatIdx(){ return state.seats.findIndex(s => s && s.uid === myProfile.uid); }
function freeSeatIdx(){ return state.seats.findIndex(s => !s); }
function refreshHandIcon(){
    const b = document.getElementById('rxHand'); if (!b) return;
    b.classList.toggle('on', handRaised);
    const staff = typeof isAdminOrOwner === 'function' && isAdminOrOwner();
    b.title = staff ? 'Mic requests' : (mySeatIdx() > -1 ? 'Leave mic' : 'Raise hand');
}
function listenHands(){
    rt('hands').on('value', snap => { handsMap = snap.val() || {}; refreshHandIcon(); const b = document.getElementById('rxHandBadge');
        const n = Object.keys(handsMap).length; const staff = typeof isAdminOrOwner === 'function' && isAdminOrOwner();
        if (b){ b.textContent = staff && n ? n : ''; b.style.display = staff && n ? '' : 'none'; } });
}
function onHand(){
    const staff = typeof isAdminOrOwner === 'function' && isAdminOrOwner();
    if (staff) return openRequests();
    if (myProfile.isGuest){ toastMsg('গেস্ট মাইকে উঠতে পারে না — লগইন করুন'); return; }
    const idx = mySeatIdx();
    if (idx > -1){
        if (typeof leaveMic === 'function') leaveMic(idx);
        toastMsg('মাইক ছেড়ে দিয়েছেন'); return;
    }
    if (handRaised){ handRaised = false; rt('hands/' + myProfile.uid).remove().catch(() => {}); refreshHandIcon(); toastMsg('হাত নামানো হয়েছে'); return; }
    handRaised = true; refreshHandIcon();
    const h = rt('hands/' + myProfile.uid);
    h.set({ name: myProfile.name, avatar: myProfile.avatar, ts: Date.now() }).catch(() => {}); h.onDisconnect().remove();
    toastMsg('✋ হোস্টকে মাইকের অনুরোধ পাঠানো হয়েছে');
}
function openRequests(){
    const onSeat = new Set(state.seats.filter(Boolean).map(s => s.uid));
    const reqs = Object.keys(handsMap).filter(u => !onSeat.has(u)).map(u => Object.assign({ uid: u }, handsMap[u])).sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(0, 20);
    const rows = reqs.length ? reqs.map(u => `<div class="rx-row"><img src="${esc(u.avatar || GUEST_AVATAR)}" alt=""><div class="rx-row-n"><b>${esc(u.name || 'User')}</b><span>✋ মাইকে আসতে চান</span></div>
        <button class="mx-btn sm" onclick="RXLive.accept('${esc(u.uid)}')">Accept</button></div>`).join('')
        : `<div class="mx-empty"><div>✋</div><p>কোনো অনুরোধ নেই</p><span class="mx-muted">কেউ হাত তুললে এখানে দেখাবে।</span></div>`;
    MOI.sheet('Mic requests', `<div class="rx-list">${rows}</div>`);
}
function accept(uid){
    const u = handsMap[uid]; if (!u) return;
    const free = freeSeatIdx();
    if (free < 0){ MOI.toast('সব সিট ভর্তি — একটা সিট খালি করুন', '😕'); return; }
    state.seats[free] = { uid, name: u.name, avatar: u.avatar, role: 'member', mic: true, locked: false, coins: 0, started: Date.now() };
    S(KEY.seats, state.seats); renderSeats();
    rt('hands/' + uid).remove().catch(() => {});
    MOI.toast((u.name || 'User') + ' মাইকে এসেছেন', '🎤'); openRequests();
}

/* ═══════════════ Share Room ═══════════════ */
function roomLink(){ return location.origin + location.pathname + '?room=' + encodeURIComponent(ROOM_ID); }
function openShareRoom(){
    const lis = state.listeners.length;
    MOI.sheet('Share room', `
        <div class="rx-roomcard">
            <div class="rx-roomlogo">${typeof brandInner === 'function' ? brandInner() : ''}</div>
            <div><b>${esc(state.roomName || 'Room')}</b><span>ID ${esc(ROOM_ID)} • 🎧 ${lis} জন শুনছে</span></div>
        </div>
        <div class="mx-two"><button class="mx-btn" onclick="MOI.copy('${esc(roomLink())}','রুমের লিংক কপি হয়েছে')"><i class="fa-solid fa-link"></i> লিংক কপি</button>
        <button class="mx-btn ghost" onclick="MOI.copy('${esc(ROOM_ID)}','রুম ID কপি হয়েছে')"><i class="fa-solid fa-hashtag"></i> ID কপি</button></div>
        <div class="mx-two" style="margin-top:10px"><button class="mx-btn" onclick="RXLive.nativeShare()"><i class="fa-solid fa-share-nodes"></i> Share</button>
        <button class="mx-btn ghost" onclick="RXLive.invite()"><i class="fa-solid fa-user-plus"></i> বন্ধুকে ইনভাইট</button></div>`);
}
function nativeShare(){
    const d = { title: state.roomName, text: '🎙️ ' + state.roomName + ' রুমে আসুন — MOI', url: roomLink() };
    if (navigator.share) navigator.share(d).catch(() => {}); else MOI.copy(d.text + ' ' + d.url, 'শেয়ার টেক্সট কপি হয়েছে');
}

/* ═══════════════ Invite friends (চ্যাটে মেসেজ যায়) ═══════════════ */
function invite(){
    const meUid = myProfile.uid;
    const friends = Object.keys(G('moi_friends_' + meUid, {}) || {});
    const users = ls_get('moi_demo_users', {}) || {};
    const rows = friends.map(uid => { const u = users[uid] || getUser(uid) || { name: 'User' };
        return `<div class="rx-row"><img src="${esc(u.photo || u.avatar || GUEST_AVATAR)}" alt=""><div class="rx-row-n"><b>${esc(u.name || 'User')}</b><span>বন্ধু</span></div>
        <button class="mx-btn sm" id="inv_${esc(uid)}" onclick="RXLive.sendInvite('${esc(uid)}')">Invite</button></div>`; }).join('');
    MOI.sheet('বন্ধুকে ইনভাইট', `<div class="rx-list">${rows || '<div class="mx-empty"><p>কোনো বন্ধু নেই — আগে চ্যাটে বন্ধু যোগ করুন</p></div>'}</div>`);
}
function sendInvite(uid){
    const meUid = myProfile.uid;
    const key = 'moi_chat_' + [meUid, uid].sort().join('__');
    const msgs = G(key, []) || [];
    const lastMessage = '🎙️ রুম ইনভাইট', now = Date.now();
    msgs.push({ id: 'm_' + now + '_' + Math.random().toString(36).slice(2, 6), type: 'text',
        content: '🎙️ আমার সাথে "' + (state.roomName || 'Room') + '" রুমে আসুন! ' + roomLink(),
        senderUid: meUid, senderName: myProfile.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ts: now, delivered: true });
    S(key, msgs);
    try { MOISync.setPartnerMeta(uid, { lastMessage, lastTime: now, lastSender: meUid, lastType: 'text', unreadInc: true }); } catch(e){}
    const b = document.getElementById('inv_' + uid); if (b){ b.textContent = 'Sent ✓'; b.disabled = true; b.classList.add('ghost'); }
    MOI.toast('ইনভাইট পাঠানো হয়েছে', '📨');
}

/* ═══════════════ More sheet ═══════════════ */
function vol(){ const v = LG('moi_room_volume', null); return v === null ? { v: 80, mute: false } : v; }
function applyVolume(){
    const { v, mute } = vol(); const level = mute ? 0 : v / 100;
    try { if (typeof _mpAudio !== 'undefined' && _mpAudio) _mpAudio.volume = level; } catch(e){}
    document.querySelectorAll('audio,video').forEach(a => { try { a.volume = level; } catch(e){} });
}
function openMore(){
    const { v, mute } = vol();
    const staff = typeof isAdminOrOwner === 'function' && isAdminOrOwner();
    MOI.sheet('Room options', `
        <div class="rx-vol"><i class="fa-solid ${mute ? 'fa-volume-xmark' : 'fa-volume-high'}" id="rxVolIc"></i>
            <input type="range" id="rxVol" min="0" max="100" value="${v}" oninput="RXLive.setVol(this.value)">
            <button class="mx-btn sm ${mute ? '' : 'ghost'}" id="rxMuteBtn" onclick="RXLive.toggleMute()">${mute ? 'Unmute' : 'Mute'}</button></div>
        <div class="rx-menu">
            <button onclick="RXLive.rules()"><span class="ic a"><i class="fa-solid fa-scroll"></i></span><div><b>Room rules</b><small>রুমের নিয়মকানুন</small></div></button>
            <button onclick="RXLive.invite()"><span class="ic b"><i class="fa-solid fa-user-plus"></i></span><div><b>Invite friends</b><small>বন্ধুকে রুমে ডাকুন</small></div></button>
            <button onclick="RXLive.info()"><span class="ic c"><i class="fa-solid fa-circle-info"></i></span><div><b>Room info</b><small>হোস্ট, লেভেল ও পরিসংখ্যান</small></div></button>
            <button onclick="MOI.openLeaderboard('gifters')"><span class="ic d"><i class="fa-solid fa-ranking-star"></i></span><div><b>Leaderboard</b><small>টপ গিফটার ও র‍্যাঙ্কিং</small></div></button>
            <button onclick="RXLive.report()"><span class="ic e"><i class="fa-solid fa-flag"></i></span><div><b>Report room</b><small>সমস্যা জানান</small></div></button>
            ${staff ? `<button onclick="RXLive.clearChat()"><span class="ic e"><i class="fa-solid fa-broom"></i></span><div><b>Clear chat</b><small>সব মেসেজ মুছুন (Host)</small></div></button>` : ''}
        </div>`);
}
function setVol(x){
    const o = vol(); o.v = +x; o.mute = o.v === 0; LS('moi_room_volume', o); applyVolume();
    const ic = document.getElementById('rxVolIc'); if (ic) ic.className = 'fa-solid ' + (o.mute ? 'fa-volume-xmark' : o.v < 40 ? 'fa-volume-low' : 'fa-volume-high');
}
function toggleMute(){
    const o = vol(); o.mute = !o.mute; if (!o.mute && o.v === 0) o.v = 60; LS('moi_room_volume', o); applyVolume(); openMore();
}
function rules(){
    const staff = typeof isAdminOrOwner === 'function' && isAdminOrOwner();
    const rr = (getRoomInfo(ROOM_ID) || {}).rules; const list = (Array.isArray(rr) && rr.length) ? rr : DEFAULT_RULES;
    MOI.sheet('Room rules', `<ol class="rx-rules">${list.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
        ${staff ? `<button class="mx-btn ghost" style="width:100%;margin-top:12px" onclick="RXLive.editRules()"><i class="fa-solid fa-pen"></i> Rules এডিট করুন</button>` : ''}`);
}
function editRules(){
    const rr = (getRoomInfo(ROOM_ID) || {}).rules;
    const cur = ((Array.isArray(rr) && rr.length) ? rr : DEFAULT_RULES).join('\n');
    const t = prompt('প্রতি লাইনে একটি নিয়ম লিখুন:', cur);
    if (t === null) return;
    const arr = t.split('\n').map(x => x.trim().slice(0, 120)).filter(Boolean).slice(0, 10);
    saveRoomInfo(ROOM_ID, { rules: arr.length ? arr : DEFAULT_RULES });
    MOI.toast('Rules আপডেট হয়েছে', '📜'); setTimeout(rules, 250);
}
function info(){
    const own = state.owner || {};
    const mics = state.seats.filter(s => s && s.uid).length;
    MOI.sheet('Room info', `
        <div class="rx-roomcard"><div class="rx-roomlogo">${typeof brandInner === 'function' ? brandInner() : ''}</div><div><b>${esc(state.roomName || '')}</b><span>ID ${esc(ROOM_ID)}</span></div></div>
        <div class="rx-stats">
            <div><b>${state.listeners.length}</b><span>শ্রোতা</span></div>
            <div><b>${mics}</b><span>মাইকে</span></div>
            <div><b>${fmtN(likeCount)}</b><span>লাইক</span></div>
        </div>
        <div class="rx-row" style="margin-top:12px"><img src="${esc(own.avatar || GUEST_AVATAR)}" alt=""><div class="rx-row-n"><b>${esc(own.name || 'Owner')}</b><span>হোস্ট 👑</span></div></div>
        <p class="mx-muted center" style="margin-top:10px">আপনার ভূমিকা: ${esc(state.myRole || 'member')}</p>`);
}
function report(){
    MOI.sheet('Report room', `<p class="mx-muted" style="margin-bottom:10px">কী সমস্যা হয়েছে বেছে নিন:</p>
        <div class="rx-reasons">${REPORT_REASONS.map((r, i) => `<label><input type="radio" name="rxr" value="${i}" ${i === 0 ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>
        <button class="mx-btn wide" style="margin-top:14px" onclick="RXLive.submitReport()">Report পাঠান</button>`);
}
function submitReport(){
    const sel = document.querySelector('input[name="rxr"]:checked');
    const reason = REPORT_REASONS[sel ? +sel.value : 0];
    try { FB().db.collection('reports').add({ reporterUid: myProfile.uid, roomId: ROOM_ID, reason, createdAt: FB().TS() }); } catch(e){}
    MOI.close(); MOI.toast('Report পাঠানো হয়েছে — ধন্যবাদ', '🚩');
}
function clearChat(){
    if (!confirm('সব মেসেজ মুছে ফেলবেন?')) return;
    (state.messages || []).forEach(m => { if (m && m.id) MOISync.deleteMessage('room', ROOM_ID, m.id); });
    state.messages = []; renderMessageFeed(); MOI.close(); MOI.toast('চ্যাট পরিষ্কার হয়েছে', '🧹');
}

/* জয়েন বাটনে ভলিউম প্রয়োগ */
(function(){
    const t = setInterval(() => {
        const o = window.toggleJoinRoom; if (typeof o !== 'function') return; clearInterval(t);
        window.toggleJoinRoom = function(){ const r = o.apply(this, arguments); applyVolume(); return r; };
    }, 400);
    setTimeout(() => clearInterval(t), 8000);
})();

window.RXLive = { accept, invite, sendInvite, nativeShare, setVol, toggleMute, rules, editRules, info, report, submitReport, clearChat, like };
})();
