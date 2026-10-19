/* me/panels.js — Followers/Following, Wallet, Bag, User Control, Help,
   Notifications, Privacy, Language, About — সব বাটনের আসল কাজ */

console.log('[MOI] panels.js loaded');

const _$ = (id) => document.getElementById(id);
const _esc = (s) => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const _needLogin = () => {
    if (!window.me.uid){ toastMsg('লগইন করুন', 'fa-lock'); return true; }
    return false;
};

/* ═══ সাধারণ Panel মডাল ═══ */
function openPanel(title, icon, html){
    _$('panelTitle').innerHTML = (icon ? `<i class="fa-solid ${icon}" style="-webkit-text-fill-color:initial;color:#f4dc8a;margin-right:6px"></i>` : '') + _esc(title);
    _$('panelBody').innerHTML = html;
    _$('panelBody').scrollTop = 0;
    _$('panelModal').classList.add('show');
}
window.closePanel = () => _$('panelModal').classList.remove('show');

/* ═══ ইউজারের পরিবর্তন সেভ (diamonds ইত্যাদি) ═══ */
function persistMe(fields){
    Object.assign(window.me, fields);
    saveUser(window.me.uid, fields);
    const cur = getCurrentUser();
    if (cur && cur.uid === window.me.uid){ setCurrentUser({ ...cur, ...fields }); }
}

/* ═══ Prefs (toggle) স্টোরেজ ═══ */
const PREF_DEFAULTS = {
    /* notifications */
    n_push: true, n_messages: true, n_follow: true, n_room: true, n_sound: true,
    /* privacy */
    p_online: true, p_dm: true, p_followers: true, p_following: true, p_search: true,
    /* user control */
    c_autoplay: true, c_effects: true, c_gift_anim: true, c_data_saver: false
};
function prefsKey(){ return 'moi_prefs_' + (window.me.uid || 'guest'); }
function getPrefs(){ return { ...PREF_DEFAULTS, ...(ls_get(prefsKey(), {}) || {}) }; }
window.setPref = (k, v) => {
    const p = getPrefs(); p[k] = !!v; ls_set(prefsKey(), p);
    toastMsg(v ? 'চালু হয়েছে' : 'বন্ধ হয়েছে', v ? 'fa-toggle-on' : 'fa-toggle-off');
    if (window.me.uid) saveUser(window.me.uid, { prefs: p });
};
function toggleRow(key, icon, name, desc){
    const on = getPrefs()[key];
    return `<label class="pref-row">
        <div class="menu-icon control"><i class="fa-solid ${icon}"></i></div>
        <div class="menu-info"><div class="menu-name">${name}</div><div class="menu-desc">${desc}</div></div>
        <span class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="setPref('${key}', this.checked)"><i></i></span>
    </label>`;
}

/* ═══════════════════════════════════════════════════════════════
   FOLLOWERS / FOLLOWING
   ═══════════════════════════════════════════════════════════════ */
/* ইউজার খোঁজা — আগে users, না পেলে রুমের listeners/seats থেকে */
function lookupUser(uid){
    const all = getAllUsers();
    if (all[uid] && all[uid].name && !all[uid]._missing) return all[uid];
    getUser(uid);                                   /* ক্যাশে না থাকলে পেছনে এনে দেয় */
    return all[uid] || { name: 'User', photo: GUEST_AVATAR };
}
let _flMode = 'following';
const fKey = (uid, type) => `moi_follow_${uid}_${type}`;
const fGet = (uid, type) => ls_get(fKey(uid, type), []) || [];

window.openFollowList = (mode) => {
    if (_needLogin()) return;
    _flMode = mode === 'followers' ? 'followers' : 'following';
    renderFollowList();
};

function renderFollowList(){
    const meUid = window.me.uid;
    const ids = fGet(meUid, _flMode);
    const myFollowing = fGet(meUid, 'following');
    const tabs = `<div class="seg">
        <button class="${_flMode === 'following' ? 'active' : ''}" onclick="openFollowList('following')">Following (${fGet(meUid,'following').length})</button>
        <button class="${_flMode === 'followers' ? 'active' : ''}" onclick="openFollowList('followers')">Followers (${fGet(meUid,'followers').length})</button>
    </div>`;

    let rows = ids.map(uid => {
        const u = lookupUser(uid);
        const isF = myFollowing.includes(uid);
        return `<div class="fl-row">
            <img class="fl-av" src="${_esc(u.photo || u.avatar || GUEST_AVATAR)}" onerror="this.src='${GUEST_AVATAR}'" alt="">
            <div class="fl-info"><div class="fl-name">${_esc(u.name || 'User')}</div><div class="fl-id">ID: ${_esc(u.moiId || String(uid).slice(0, 10))}</div></div>
            <button class="fl-btn ${isF ? 'on' : ''}" onclick="flToggle('${_esc(uid)}')">${isF ? 'Following' : '<i class="fa-solid fa-plus"></i> Follow'}</button>
        </div>`;
    }).join('');

    if (!rows) rows = `<div class="empty"><i class="fa-solid fa-user-group"></i><p>${_flMode === 'followers' ? 'এখনো কোনো Follower নেই' : 'আপনি এখনো কাউকে Follow করেননি'}</p></div>`;
    openPanel(_flMode === 'followers' ? 'FOLLOWERS' : 'FOLLOWING', 'fa-users', tabs + `<div class="fl-list">${rows}</div>`);
}

window.flToggle = (uid) => {
    const meUid = window.me.uid;
    let mine = fGet(meUid, 'following');
    if (mine.includes(uid)){
        mine = mine.filter(x => x !== uid);
        toastMsg('Unfollow করা হয়েছে', 'fa-user-minus');
    } else {
        mine.push(uid);
        if (window.MOI) MOI.onFollowed(uid);
        toastMsg('Follow করা হয়েছে', 'fa-user-plus');
    }
    ls_set(fKey(meUid, 'following'), mine);             /* অন্যের followers তালিকা সিঙ্ক নিজেই আপডেট করে */
    loadFollowCounts();
    renderFollowList();
};

/* ═══════════════════════════════════════════════════════════════
   WALLET
   ═══════════════════════════════════════════════════════════════ */
const txKey = () => 'moi_wallet_tx_' + window.me.uid;
let _distributors = null;

window.openWallet = () => {
    if (_needLogin()) return;
    renderWallet();
};

async function loadDistributors(){
    try {
        const snap = await MOIFB.db.collection('users').where('role', '==', 'distributor').limit(20).get();
        _distributors = []; snap.forEach(d => { const u = d.data(); _distributors.push({ uid: d.id, name: u.name, moiId: u.moiId, photo: u.photo, country: u.country }); });
    } catch(e){ _distributors = []; }
    if (_$('panelModal').classList.contains('show') && _$('distBox')) renderDistBox();
}
function renderDistBox(){
    const box = _$('distBox'); if (!box) return;
    if (_distributors === null){ box.innerHTML = '<div class="empty small"><p>লোড হচ্ছে…</p></div>'; return; }
    box.innerHTML = _distributors.length ? _distributors.map(d => `<div class="fl-row">
        <img class="fl-av" src="${_esc(d.photo || GUEST_AVATAR)}" onerror="this.src='${GUEST_AVATAR}'" alt="">
        <div class="fl-info"><div class="fl-name">${_esc(d.name || 'Distributor')}</div><div class="fl-id">ID: ${_esc(d.moiId || '')} ${d.country ? '• ' + _esc(d.country) : ''}</div></div>
        <button class="fl-btn" onclick="copyText('${_esc(d.moiId || '')}')"><i class="fa-solid fa-copy"></i> ID</button></div>`).join('')
        : '<div class="empty small"><p>এখন কোনো অফিসিয়াল ডিস্ট্রিবিউটর নেই</p></div>';
}

function renderWallet(){
    const tx = (ls_get(txKey(), []) || []).slice(0, 20);
    const hist = tx.length ? tx.map(t => `<div class="tx-row">
        <div class="tx-ic ${t.amount >= 0 ? 'in' : 'out'}"><i class="fa-solid ${t.amount >= 0 ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></div>
        <div class="menu-info"><div class="menu-name">${_esc(t.title)}</div><div class="menu-desc">${new Date(t.ts).toLocaleString()}</div></div>
        <b class="tx-amt ${t.amount >= 0 ? 'in' : 'out'}">${t.amount >= 0 ? '+' : ''}${Number(t.amount).toLocaleString()}</b></div>`).join('')
        : `<div class="empty small"><p>কোনো লেনদেন নেই</p></div>`;
    openPanel('WALLET', 'fa-wallet', `
        <div class="wallet-card">
            <div class="wc-label">Diamond Balance</div>
            <div class="wc-amt"><i class="fa-solid fa-gem"></i> <span id="walletBal">${(window.me.diamonds || 0).toLocaleString()}</span></div>
            <div class="wc-sub">ডায়মন্ড শুধু অফিসিয়াল ডিস্ট্রিবিউটর বা রিওয়ার্ড থেকে পাওয়া যায়</div>
        </div>
        <div class="sec-label">Buy diamonds</div>
        <div class="input-hint"><i class="fa-solid fa-circle-info"></i><span>নিচের অফিসিয়াল ডিস্ট্রিবিউটরের ID কপি করে চ্যাটে যোগাযোগ করুন। শুধু এদের থেকেই কিনুন।</span></div>
        <div class="fl-list" id="distBox"></div>
        <div class="sec-label">History</div>
        <div class="tx-list" id="txBox">${hist}</div>`);
    renderDistBox();
    if (_distributors === null) loadDistributors();
}

window.addEventListener('moi:sync', e => {
    if (!e.detail || e.detail.key !== txKey()) return;
    const box = _$('txBox'); if (!box || !_$('panelModal').classList.contains('show')) return;
    renderWallet();
});
window.addEventListener('moi:diamonds', () => { const b = _$('walletBal'); if (b){ const u = getUser(window.me.uid) || {}; b.textContent = (u.diamonds || 0).toLocaleString(); } });

/* ═══════════════════════════════════════════════════════════════
   MY BAG
   ═══════════════════════════════════════════════════════════════ */
const bagKey = () => 'moi_bag_' + window.me.uid;
const dailyKey = () => 'moi_bag_daily_' + window.me.uid;
let _bagTab = 'all';

window.openBag = () => {
    if (_needLogin()) return;
    renderBag();
};

function bagItems(){
    const u = getUser(window.me.uid) || {};
    const fs = (window.MOI && MOI.frameState && MOI.frameState()) || { owned: ['basic'] };
    const items = [];
    (fs.owned || []).forEach(id => { const f = (MOI.FRAMES || []).find(x => x.id === id); if (f) items.push({ name: f.name + ' Frame', emoji: '🖼️', type: 'frame', qty: 1 }); });
    (u.ownedCrowns || []).forEach(c => items.push({ name: c + ' Crown', emoji: '👑', type: 'crown', qty: 1 }));
    (u.badges || []).forEach(b => items.push({ name: b, emoji: '🏅', type: 'badge', qty: 1 }));
    return items;
}
function renderBag(){
    const items = bagItems();
    const claimed = ((ls_get(dailyKey(), null) || {}).last) === (window.MOI ? new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10) : '');
    const list = items.filter(i => _bagTab === 'all' || i.type === _bagTab);
    const grid = list.length ? list.map(i => `<div class="bag-item">
        <div class="bag-emoji">${i.emoji}</div><div class="bag-name">${_esc(i.name)}</div>
        <div class="bag-qty">×${i.qty}</div></div>`).join('')
        : `<div class="empty"><i class="fa-solid fa-bag-shopping"></i><p>ব্যাগ খালি আছে — Store থেকে ফ্রেম/মুকুট কিনুন</p></div>`;
    openPanel('MY BAG', 'fa-bag-shopping', `
        <button class="daily-btn" ${claimed ? 'disabled' : ''} onclick="claimDaily()">
            <i class="fa-solid fa-gift"></i> ${claimed ? 'আজকের Reward নেওয়া হয়েছে' : 'Daily Reward নিন (+25 💎)'}</button>
        <div class="seg">
            ${['all','frame','crown','badge'].map(t => `<button class="${_bagTab === t ? 'active' : ''}" onclick="bagTab('${t}')">${t === 'all' ? 'All' : t === 'frame' ? 'Frames' : t === 'crown' ? 'Crowns' : 'Badges'}</button>`).join('')}
        </div>
        <div class="bag-grid">${grid}</div>`);
}
window.bagTab = (t) => { _bagTab = t; renderBag(); };

window.claimDaily = async () => {
    const r = await MOIEco.try('claimBagDaily', {});
    if (!r) return;
    ls_set(dailyKey(), { last: new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10) });
    toastMsg('+' + r.dia + ' 💎 পেয়েছেন!', 'fa-gift');
    renderBag();
};

/* ═══════════════════════════════════════════════════════════════
   USER CONTROL / NOTIFICATIONS / PRIVACY
   ═══════════════════════════════════════════════════════════════ */
window.openUserControl = () => {
    if (_needLogin()) return;
    openPanel('USER CONTROL', 'fa-sliders', `
        <div class="pref-list">
            ${toggleRow('c_autoplay', 'fa-play', 'Auto-play voice', 'রুমে ঢুকলে অডিও অটো চালু')}
            ${toggleRow('c_effects', 'fa-wand-magic-sparkles', 'Room effects', 'এনিমেশন ও ইফেক্ট দেখান')}
            ${toggleRow('c_gift_anim', 'fa-gift', 'Gift animation', 'গিফট এনিমেশন দেখান')}
            ${toggleRow('c_data_saver', 'fa-gauge-high', 'Data saver', 'কম ডেটা ব্যবহার করুন')}
        </div>
        <div class="sec-label">Data</div>
        <button class="btn btn-cancel wide" onclick="resetPrefs()"><i class="fa-solid fa-rotate-left"></i> Reset all settings</button>`);
};
window.clearBagCache = () => {
    if (!confirm('Wallet history মুছে ফেলবেন?')) return;
    ls_set(txKey(), []);
    toastMsg('History মুছে গেছে', 'fa-broom');
};
window.resetPrefs = () => {
    if (!confirm('সব সেটিংস ডিফল্টে ফেরাবেন?')) return;
    ls_set(prefsKey(), {});
    toastMsg('সেটিংস রিসেট হয়েছে', 'fa-rotate-left');
    openUserControl();
};

window.openNotifications = () => {
    openPanel('NOTIFICATIONS', 'fa-bell', `<div class="pref-list">
        ${toggleRow('n_push', 'fa-bell', 'Push notifications', 'সব নোটিফিকেশন চালু/বন্ধ')}
        ${toggleRow('n_messages', 'fa-comment-dots', 'Messages', 'নতুন মেসেজের নোটিফিকেশন')}
        ${toggleRow('n_follow', 'fa-user-plus', 'New followers', 'কেউ Follow করলে জানান')}
        ${toggleRow('n_room', 'fa-microphone', 'Room invites', 'রুমের ইনভাইট ও আপডেট')}
        ${toggleRow('n_sound', 'fa-volume-high', 'Sound', 'নোটিফিকেশন সাউন্ড')}
    </div>`);
};

window.openPrivacy = () => {
    openPanel('PRIVACY', 'fa-lock', `<div class="pref-list">
        ${toggleRow('p_online', 'fa-circle', 'Show online status', 'অন্যরা দেখবে আপনি অনলাইন')}
        ${toggleRow('p_dm', 'fa-envelope', 'Allow messages', 'যে কেউ মেসেজ পাঠাতে পারবে')}
        ${toggleRow('p_followers', 'fa-users', 'Show followers', 'Followers লিস্ট পাবলিক')}
        ${toggleRow('p_following', 'fa-user-group', 'Show following', 'Following লিস্ট পাবলিক')}
        ${toggleRow('p_search', 'fa-magnifying-glass', 'Appear in search', 'সার্চে আপনাকে খুঁজে পাওয়া যাবে')}
    </div>`);
};

/* ═══════════════════════════════════════════════════════════════
   HELP & SUPPORT
   ═══════════════════════════════════════════════════════════════ */
const FAQ = [
    ['কিভাবে প্রোফাইল ছবি বদলাব?', 'প্রোফাইলের ছবিতে চাপ দিন, ছবি বাছুন, ক্রপ করে Save করুন।'],
    ['কিভাবে নাম বদলাব?', 'নামের পাশের কলম আইকনে চাপ দিয়ে নতুন নাম লিখে Save করুন (সর্বোচ্চ ২৪ অক্ষর)।'],
    ['ডায়মন্ড কিভাবে পাব?', 'Wallet থেকে Recharge করুন অথবা My Bag থেকে Daily Reward নিন।'],
    ['কিভাবে কাউকে Follow করব?', 'রুমে কারো প্রোফাইলে গিয়ে Follow চাপুন। Me পেজের Following/Followers থেকেও পরিচালনা করা যায়।'],
    ['অ্যাকাউন্ট থেকে বের হব কিভাবে?', 'Me পেজে Sign Out চাপুন।']
];
const supKey = () => 'moi_support_' + (window.me.uid || 'guest');

window.openHelp = () => {
    const faq = FAQ.map((f, i) => `<div class="faq" id="faq${i}">
        <div class="faq-q" onclick="document.getElementById('faq${i}').classList.toggle('open')"><span>${f[0]}</span><i class="fa-solid fa-chevron-down"></i></div>
        <div class="faq-a">${f[1]}</div></div>`).join('');
    const sent = (ls_get(supKey(), []) || []).length;
    openPanel('HELP & SUPPORT', 'fa-circle-question', `
        <div class="sec-label" style="margin-top:0">FAQ</div>${faq}
        <div class="sec-label">Contact us</div>
        <textarea class="input-field area" id="helpMsg" maxlength="500" placeholder="আপনার সমস্যা লিখুন..."></textarea>
        <button class="btn btn-primary wide" onclick="sendHelp()"><i class="fa-solid fa-paper-plane"></i> Send message</button>
        <div class="input-hint" style="margin-top:10px"><i class="fa-solid fa-circle-info"></i><span>${sent ? sent + 'টি মেসেজ পাঠানো হয়েছে • ' : ''}Support: support@moi.app</span></div>
        <button class="btn btn-cancel wide" style="margin-top:10px" onclick="copyText('support@moi.app')"><i class="fa-solid fa-copy"></i> Copy support email</button>`);
};
window.sendHelp = () => {
    const el = _$('helpMsg');
    const msg = el.value.trim();
    if (msg.length < 5){ toastMsg('আরও একটু বিস্তারিত লিখুন', 'fa-triangle-exclamation'); return; }
    const list = ls_get(supKey(), []) || [];
    list.push({ msg, ts: Date.now(), uid: window.me.uid || 'guest' });
    ls_set(supKey(), list);
    toastMsg('মেসেজ পাঠানো হয়েছে, ধন্যবাদ!', 'fa-paper-plane');
    openHelp();
};

/* ═══ কপি ═══ */
window.copyText = (txt) => {
    const done = () => toastMsg('কপি হয়েছে', 'fa-copy');
    if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
    } else fallbackCopy(txt, done);
};
function fallbackCopy(txt, done){
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(e){ toastMsg('কপি করা যায়নি', 'fa-triangle-exclamation'); }
    ta.remove();
}
window.copyUid = () => {
    const id = window.me.moiId || window.me.uid;
    if (!id){ _needLogin(); return; }
    copyText(String(id));
};

/* ═══════════════════════════════════════════════════════════════
   LANGUAGE
   ═══════════════════════════════════════════════════════════════ */
const BN = {
    'ME': 'আমি', 'Following': 'ফলোইং', 'Followers': 'ফলোয়ার্স',
    'Recharge to get SVIP privileges': 'SVIP সুবিধা পেতে রিচার্জ করুন',
    'Account': 'অ্যাকাউন্ট', 'Support': 'সাপোর্ট',
    'Wallet': 'ওয়ালেট', 'Diamonds & balance': 'ডায়মন্ড ও ব্যালেন্স',
    'My Bag': 'আমার ব্যাগ', 'Gifts & items collected': 'গিফট ও আইটেম',
    'User Control': 'ইউজার কন্ট্রোল', 'Privacy & preferences': 'প্রাইভেসি ও পছন্দ',
    'Help & Support': 'সাহায্য ও সাপোর্ট', 'Get help or contact us': 'সাহায্য নিন বা যোগাযোগ করুন',
    'Sign Out': 'সাইন আউট', 'Log out from this account': 'এই অ্যাকাউন্ট থেকে বের হন',
    'Room': 'রুম', 'Messages': 'মেসেজ', 'Me': 'আমি',
    'Notifications': 'নোটিফিকেশন', 'Manage notification settings': 'নোটিফিকেশন সেটিংস',
    'Privacy': 'প্রাইভেসি', 'Control who can see you': 'কে আপনাকে দেখবে ঠিক করুন',
    'Language': 'ভাষা', 'About': 'সম্পর্কে', 'SETTINGS': 'সেটিংস'
};
const LANG_SEL = '.page-title,.stat-lbl,.svip-sub,.menu-title,.menu-name,.menu-desc,.nav-item span:last-child,.modal-title';

function applyLanguage(lang){
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('#appContainer ' + LANG_SEL + ', #settingsModal ' + LANG_SEL).forEach(el => {
        if (el.children.length) return;
        if (el.dataset.orig === undefined) el.dataset.orig = el.textContent.trim();
        const orig = el.dataset.orig;
        el.textContent = (lang === 'bn' && BN[orig]) ? BN[orig] : orig;
    });
}
window.setLanguage = (lang) => {
    try { localStorage.setItem('moi_lang', lang); } catch(e){}
    applyLanguage(lang);
    toastMsg(lang === 'bn' ? 'ভাষা: বাংলা' : 'Language: English', 'fa-language');
    openLanguage();
};
window.openLanguage = () => {
    let cur = 'en';
    try { cur = localStorage.getItem('moi_lang') || 'en'; } catch(e){}
    const opt = (code, name, sub) => `<div class="lang-opt ${cur === code ? 'on' : ''}" onclick="setLanguage('${code}')">
        <div class="menu-info"><div class="menu-name">${name}</div><div class="menu-desc">${sub}</div></div>
        <i class="fa-solid ${cur === code ? 'fa-circle-check' : 'fa-circle'}"></i></div>`;
    openPanel('LANGUAGE', 'fa-language', opt('bn', 'বাংলা', 'Bangla') + opt('en', 'English', 'ইংরেজি'));
};

/* ═══════════════════════════════════════════════════════════════
   ABOUT
   ═══════════════════════════════════════════════════════════════ */
window.showAbout = () => {
    openPanel('ABOUT', 'fa-circle-info', `
        <div class="about">
            <div class="about-logo">MOI</div>
            <div class="about-ver">Version 1.0.0</div>
            <p>MOI একটি ভয়েস রুম ও সোশ্যাল অ্যাপ। বন্ধুদের সাথে কথা বলুন, গিফট পাঠান, আর নতুন মানুষের সাথে পরিচিত হন।</p>
            <div class="about-meta"><span>Mode</span><b>LIVE</b></div>
            <div class="about-meta"><span>Your ID</span><b>${_esc(window.me.moiId || '—')}</b></div>
        </div>`);
};

/* ═══ শুরুতে ভাষা প্রয়োগ + UID কপি ═══ */
setTimeout(() => {
    try {
        const pill = document.querySelector('.user-uid-pill');
        if (pill){ pill.style.cursor = 'pointer'; pill.title = 'Copy ID'; pill.addEventListener('click', copyUid); }
        let lang = 'en';
        try { lang = localStorage.getItem('moi_lang') || 'en'; } catch(e){}
        if (lang === 'bn' || lang === 'en') applyLanguage(lang);
    } catch(e){ console.warn('[panels init]', e); }
}, 250);
