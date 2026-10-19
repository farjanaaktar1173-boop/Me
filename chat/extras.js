/* chat/extras.js — Chat এর নতুন ফিচার
   ⋮ মেনু (Pin, Mute, Search, Clear, Block, Remove, Report, Profile) • টাইপিং ইন্ডিকেটর
   ডাবল-ট্যাপ রিঅ্যাকশন • কুইক রিপ্লাই • গিফট পাঠানো (💎) • Discover ট্যাব • লং-প্রেসে লিস্ট মেনু */

console.log('[MOI] chat/extras.js loaded');

(function(){
'use strict';
const $ = id => document.getElementById(id);
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uidNow = () => window.currentChatUid;
const userOf = uid => (getAllUsers()[uid]) || (window.currentChatUser && window.currentChatUser.uid === uid ? window.currentChatUser : { name:'User' });
const row = (ic, cls, title, sub, fn) => `<button class="cx-row ${cls||''}" onclick="${fn}"><span class="cx-ic"><i class="fa-solid ${ic}"></i></span><span class="cx-tx"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span></button>`;
function meta(uid){ chatMetas[uid] = chatMetas[uid] || {}; return chatMetas[uid]; }

/* ───────────── হেডার বাটন ───────────── */
function injectHeader(){
    const box = $('chatHeaderBtns');
    if (!box || $('chatMoreBtn')) return;
    box.insertAdjacentHTML('afterbegin', '<div class="icon-btn" id="chatSearchBtn" title="খুঁজুন" onclick="cxSearchToggle()"><i class="fa-solid fa-magnifying-glass"></i></div>');
    box.insertAdjacentHTML('beforeend', '<div class="icon-btn" id="chatMoreBtn" title="আরও" onclick="cxMenu()"><i class="fa-solid fa-ellipsis-vertical"></i></div>');
    const hdr = document.querySelector('.chat-header');
    hdr.insertAdjacentHTML('afterend', '<div class="cx-search" id="cxSearch"><i class="fa-solid fa-magnifying-glass"></i><input id="cxSearchInput" placeholder="এই চ্যাটে খুঁজুন..." oninput="cxSearchRun()"><span id="cxSearchCount"></span></div>');
}

/* ───────────── ⋮ মেনু ───────────── */
window.cxMenu = () => {
    const uid = uidNow(); if (!uid) return;
    const m = meta(uid), u = userOf(uid), blocked = !!myBlocked[uid], friend = !!myFriends[uid];
    MOI.sheet(E(u.name || 'Chat'), `<div class="cx-list">
        ${row('fa-user','','View profile','নাম, আইডি ও Follow','cxProfile()')}
        ${row('fa-thumbtack','',m.pinned?'Unpin chat':'Pin chat','লিস্টের উপরে রাখুন','cxPin()')}
        ${row(m.muted?'fa-bell':'fa-bell-slash','',m.muted?'Unmute':'Mute notifications','নতুন মেসেজে শব্দ বন্ধ','cxMute()')}
        ${row('fa-gift','','Send diamonds','বন্ধুকে 💎 উপহার দিন','cxGiftSheet()')}
        ${row('fa-eraser','','Clear chat','শুধু আপনার দিক থেকে মুছুন','cxClear()')}
        ${friend?row('fa-user-minus','','Remove friend','বন্ধু তালিকা থেকে সরান','cxUnfriend()'):''}
        ${row(blocked?'fa-unlock':'fa-ban','danger',blocked?'Unblock':'Block','মেসেজ ও রিকুয়েস্ট বন্ধ','cxBlock()')}
        ${row('fa-flag','danger','Report','অনুপযুক্ত আচরণ জানান','cxReport()')}
    </div>`);
};
window.cxPin = () => { const m = meta(uidNow()); m.pinned = !m.pinned; saveFriendsData(); MOI.close(); MOI.toast(m.pinned ? 'Chat pinned' : 'Chat unpinned', '📌'); renderList(); };
window.cxMute = () => { const m = meta(uidNow()); m.muted = !m.muted; saveFriendsData(); MOI.close(); MOI.toast(m.muted ? 'Notifications muted' : 'Notifications on', m.muted ? '🔕' : '🔔'); renderList(); };
window.cxClear = () => {
    if (!confirm('এই চ্যাটের সব মেসেজ আপনার দিক থেকে মুছে যাবে। ঠিক আছে?')) return;
    const hk = 'moi_chat_hidden_' + window.me.uid;
    try { const h = JSON.parse(localStorage.getItem(hk) || '{}'); loadMessages().forEach(x => { h[x.id] = 1; }); localStorage.setItem(hk, JSON.stringify(h)); } catch(e){}
    renderAllMessages();
    const m = meta(uidNow()); m.lastMessage = ''; m.lastTime = 0; saveFriendsData(); renderList();
    MOI.close(); MOI.toast('Chat cleared', '🧹');
};
window.cxUnfriend = () => {
    const uid = uidNow(), me = window.me.uid;
    if (!confirm('বন্ধু তালিকা থেকে সরাবেন?')) return;
    delete myFriends[uid]; saveFriendsData();
    const t = ls_get('moi_friends_' + uid, {}) || {}; delete t[me]; ls_set('moi_friends_' + uid, t);
    MOI.close(); MOI.toast('বন্ধু তালিকা থেকে সরানো হয়েছে', '👋'); updateFriendStatus(); renderList(); syncQuick();
};
window.cxBlock = () => {
    const uid = uidNow();
    if (myBlocked[uid]){ delete myBlocked[uid]; MOI.toast('Unblocked', '✅'); }
    else {
        if (!confirm('ব্লক করলে মেসেজ করা যাবে না। ব্লক করবেন?')) return;
        myBlocked[uid] = true; MOI.toast('ব্লক করা হয়েছে', '🚫');
    }
    saveFriendsData(); MOI.close(); updateFriendStatus(); renderList(); syncQuick();
};
window.cxReport = () => {
    const reasons = ['স্প্যাম বা বিজ্ঞাপন','হয়রানি বা গালাগাল','অশ্লীল কনটেন্ট','ভুয়া অ্যাকাউন্ট','অন্য কারণ'];
    MOI.sheet('Report', `<div class="cx-list">${reasons.map(r => row('fa-flag','',r,'',`cxReportSend('${r}')`)).join('')}</div>`);
};
window.cxReportSend = (r) => {
    try { MOIFB.db.collection('reports').add({ reporterUid: window.me.uid, targetUid: uidNow(), reason: r, createdAt: MOIFB.TS() }); } catch(e){}
    MOI.close(); MOI.toast('রিপোর্ট জমা হয়েছে, ধন্যবাদ', '🛡️');
};
window.cxProfile = () => {
    const uid = uidNow(), u = userOf(uid);
    const fol = (ls_get('moi_follow_' + window.me.uid + '_following', []) || []).includes(uid);
    const fc = (ls_get('moi_follow_' + uid + '_followers', []) || []).length;
    MOI.sheet('Profile', `<div class="cx-prof">
        <img src="${E(u.photo || u.avatar || GUEST_AVATAR)}" alt="">
        <h3>${E(u.name || 'User')}</h3>
        <p>ID: ${E(u.moiId || String(uid).slice(0,10))}</p>
        <div class="cx-stats"><span><b>${fc}</b> Followers</span><span><b>${myFriends[uid] ? 'Friend' : 'Not friend'}</b></span></div>
        <div class="cx-actions">
            <button class="mx-btn" onclick="cxFollow()">${fol ? 'Following' : 'Follow'}</button>
            <button class="mx-btn ghost" onclick="MOI.close()">Close</button>
        </div></div>`);
};
window.cxFollow = () => {
    const uid = uidNow(), me = window.me.uid;
    let mine = ls_get('moi_follow_' + me + '_following', []) || [];
    if (mine.includes(uid)){ mine = mine.filter(x => x !== uid); MOI.toast('Unfollowed', '👋'); }
    else { mine.push(uid); MOI.toast('Following', '✨'); if (MOI.onFollowed) MOI.onFollowed(uid); }
    ls_set('moi_follow_' + me + '_following', mine); cxProfile();
};

/* ───────────── গিফট (💎) ───────────── */
window.cxGiftSheet = () => {
    const bal = (MOI.me() || {}).diamonds || 0;
    MOI.sheet('Send diamonds', `<div class="cx-bal">Balance <b>${MOI.fmt(bal)}</b> 💎</div>
        <div class="cx-amts">${[10,50,100,500,1000].map(n => `<button onclick="cxSendGift(${n})"><b>${n}</b><span>💎</span></button>`).join('')}</div>`);
};
window.cxSendGift = async (n) => {
    const uid = uidNow(); if (!uid) return;
    const r = await MOIEco.try('sendChatGift', { toUid: uid, amount: n });   /* ডায়মন্ড কাটা ও চ্যাট মেসেজ সার্ভার করে */
    if (!r) return;
    MOI.close(); MOI.toast(n + ' 💎 পাঠানো হয়েছে', '🎁');
};

/* ───────────── মেসেজে খোঁজা ───────────── */
window.cxSearchToggle = () => {
    const bar = $('cxSearch'); bar.classList.toggle('show');
    if (bar.classList.contains('show')) setTimeout(() => $('cxSearchInput').focus(), 80);
    else { $('cxSearchInput').value = ''; cxSearchRun(); }
};
window.cxSearchRun = () => {
    const q = ($('cxSearchInput').value || '').trim().toLowerCase();
    let n = 0;
    document.querySelectorAll('#chatBody .msg-wrap').forEach(w => {
        const hit = !q || w.innerText.toLowerCase().includes(q);
        w.style.display = hit ? '' : 'none'; if (q && hit) n++;
    });
    $('cxSearchCount').textContent = q ? n + ' found' : '';
};

/* ───────────── টাইপিং ইন্ডিকেটর ───────────── */
window.cxTyping = (on) => {
    const body = $('chatBody'); let r = $('cxTypingRow');
    if (on){
        if (!r){
            r = document.createElement('div'); r.id = 'cxTypingRow'; r.className = 'msg-wrap incoming';
            r.innerHTML = '<div class="msg-bubble incoming cx-typing"><i></i><i></i><i></i></div>';
            body.appendChild(r);
        }
        body.scrollTop = body.scrollHeight;
        $('chatStatus').textContent = 'typing…';
    } else {
        if (r) r.remove();
        const online = $('chatAvWrap').classList.contains('online');
        $('chatStatus').textContent = online ? '● Online' : 'অফলাইন';
    }
};

/* ───────────── ডাবল-ট্যাপ রিঅ্যাকশন ───────────── */
function react(wrap){
    const id = wrap.dataset.key; if (!id) return;
    const list = loadMessages(); const m = list.find(x => x.id === id); if (!m) return;
    m.reaction = m.reaction ? '' : '❤️'; saveMessages(list); renderAllMessages();
    if (m.reaction) MOI.toast('❤️', '');
}
const _append = window.appendMessage;
window.appendMessage = function(data){
    _append.apply(this, arguments);
    if (data && data.reaction){
        const w = $('chatBody').lastElementChild;
        if (w && !w.querySelector('.cx-react')){
            const b = document.createElement('span'); b.className = 'cx-react'; b.textContent = data.reaction;
            w.querySelector('.msg-bubble') && w.querySelector('.msg-bubble').appendChild(b);
        }
    }
};
document.addEventListener('dblclick', e => { const w = e.target.closest && e.target.closest('#chatBody .msg-wrap'); if (w) react(w); });
let lastTap = 0;
document.addEventListener('touchend', e => {
    const w = e.target.closest && e.target.closest('#chatBody .msg-wrap'); if (!w) return;
    const now = Date.now(); if (now - lastTap < 300){ react(w); lastTap = 0; } else lastTap = now;
}, { passive: true });

/* ───────────── কুইক রিপ্লাই ───────────── */
const QUICK = ['👋 হাই!', 'কেমন আছেন?', '😂😂', 'ধন্যবাদ 🙏', 'রুমে আসুন 🎙️', 'পরে কথা বলি'];
function injectQuick(){
    if ($('cxQuick')) return;
    const f = $('chatFooter');
    f.insertAdjacentHTML('beforebegin', `<div class="cx-quick" id="cxQuick">${QUICK.map(q => `<button onclick="cxQuick(this)">${q}</button>`).join('')}</div>`);
    const acts = f.querySelector('.actions');
    if (acts && !$('cxGiftBtn')) acts.insertAdjacentHTML('beforeend', '<button class="act-btn" id="cxGiftBtn" title="Send diamonds" onclick="cxGiftSheet()"><i class="fa-solid fa-gift"></i></button>');
}
window.cxQuick = (b) => { pushMsg({ type: 'text', content: b.textContent.trim() }); };
function syncQuick(){ const q = $('cxQuick'), f = $('chatFooter'); if (q && f) q.style.display = (f.style.display === 'none') ? 'none' : ''; }

/* updateFriendStatus এর পরে quick row সিঙ্ক */
const _ufs = window.updateFriendStatus;
window.updateFriendStatus = function(){ _ufs.apply(this, arguments); injectQuick(); syncQuick(); };

/* ───────────── Discover ট্যাব ───────────── */
function discoverUsers(){
    const me = window.me.uid, out = {};
    const users = getAllUsers();
    Object.keys(users).forEach(uid => { if (uid !== me && users[uid].name) out[uid] = { uid, name: users[uid].name, photo: users[uid].photo || users[uid].avatar, moiId: users[uid].moiId }; });
    for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (!/^moi_room_.*_(listeners|seats)$/.test(k)) continue;
        (ls_get(k, []) || []).forEach(x => { if (x && x.uid && x.uid !== me && x.name && !out[x.uid]) out[x.uid] = { uid: x.uid, name: x.name, photo: x.avatar || x.photo }; });
    }
    return Object.values(out).filter(u => !myBlocked[u.uid]).sort((a,b) => a.name.localeCompare(b.name)).slice(0, 40);
}
function renderDiscover(){
    const area = $('listArea'), list = discoverUsers();
    if (!list.length){ area.innerHTML = '<div class="empty"><div class="big">🧭</div>কেউ পাওয়া যায়নি<br><br>কোনো রুমে ঢুকলে এখানে মানুষ দেখা যাবে</div>'; return; }
    area.innerHTML = '<div class="section-title">People you may know</div>' + list.map(u => {
        const isF = !!myFriends[u.uid], sent = !!mySentRequests[u.uid];
        return `<div class="user-item" onclick="openChatWith('${E(u.uid)}')">
            <div class="u-avatar"><img src="${E(u.photo || GUEST_AVATAR)}" onerror="this.src='${GUEST_AVATAR}'"></div>
            <div class="u-info"><div class="u-name">${E(u.name)}</div><div class="u-last">${isF ? 'আপনার বন্ধু' : sent ? 'Request sent' : 'নতুন পরিচয়ের সুযোগ'}</div></div>
            <div class="u-meta"><span class="cx-chip ${isF ? 'on' : ''}">${isF ? 'Friend' : 'Chat'}</span></div></div>`;
    }).join('');
}
function injectDiscoverTab(){
    const tabs = document.querySelector('.tabs');
    if (!tabs || tabs.querySelector('[data-tab="discover"]')) return;
    tabs.insertAdjacentHTML('beforeend', '<div class="tab" data-tab="discover" onclick="switchTab(\'discover\')">Discover</div>');
}
const _rl = window.renderList;
window.renderList = function(){
    if (typeof activeTab !== 'undefined' && activeTab === 'discover'){ if (window.me) renderDiscover(); return; }
    _rl.apply(this, arguments);
};

/* ───────────── লিস্টে লং-প্রেস মেনু (Pin / Mute) ───────────── */
function rowUid(el){ const m = (el.getAttribute('onclick') || '').match(/openChatWith\('([^']+)'\)/); return m ? m[1] : null; }
let lp = null;
function listMenu(uid){
    const m = meta(uid), u = userOf(uid);
    MOI.sheet(E(u.name || 'Chat'), `<div class="cx-list">
        ${row('fa-thumbtack','',m.pinned?'Unpin chat':'Pin chat','','cxListPin(\''+uid+'\')')}
        ${row(m.muted?'fa-bell':'fa-bell-slash','',m.muted?'Unmute':'Mute','','cxListMute(\''+uid+'\')')}
        ${row('fa-eraser','danger','Clear chat','','cxListClear(\''+uid+'\')')}</div>`);
}
window.cxListPin = uid => { const m = meta(uid); m.pinned = !m.pinned; saveFriendsData(); MOI.close(); renderList(); };
window.cxListMute = uid => { const m = meta(uid); m.muted = !m.muted; saveFriendsData(); MOI.close(); renderList(); };
window.cxListClear = uid => {
    if (!confirm('এই চ্যাট মুছবেন?')) return;
    ls_remove('moi_chat_' + roomId(window.me.uid, uid)); const m = meta(uid); m.lastMessage = ''; m.lastTime = 0; saveFriendsData(); MOI.close(); renderList();
};
document.addEventListener('contextmenu', e => { const r = e.target.closest && e.target.closest('#listArea .user-item'); const uid = r && rowUid(r); if (uid && myFriends[uid]){ e.preventDefault(); listMenu(uid); } });
document.addEventListener('touchstart', e => { const r = e.target.closest && e.target.closest('#listArea .user-item'); const uid = r && rowUid(r); if (uid && myFriends[uid]) lp = setTimeout(() => { listMenu(uid); lp = null; }, 600); }, { passive: true });
['touchend','touchmove','touchcancel'].forEach(ev => document.addEventListener(ev, () => { if (lp){ clearTimeout(lp); lp = null; } }, { passive: true }));

/* ───────────── শুরু ───────────── */
function boot(){ injectHeader(); injectQuick(); injectDiscoverTab(); syncQuick(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
setTimeout(boot, 400);
})();
