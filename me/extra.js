/* me/extra.js — Me পেজের নতুন বাটনগুলো: Profile Details, Friends, Blocked,
   My Rooms, Daily Missions, Visitors, Rate, Terms, Export Data */
console.log('[MOI] extra.js loaded');

const _av = (u) => _esc((u && (u.photo || u.avatar)) || GUEST_AVATAR);
const _uRow = (u, uid, right) => `<div class="fl-row"><img class="fl-av" src="${_av(u)}" onerror="this.src='${GUEST_AVATAR}'">
    <div class="fl-info"><div class="fl-name">${_esc((u && u.name) || 'User')}</div><div class="fl-id">ID: ${_esc((u && u.moiId) || String(uid).slice(0, 10))}</div></div>${right || ''}</div>`;
const _empty = (icon, t) => `<div class="empty"><i class="fa-solid ${icon}"></i><p>${t}</p></div>`;

/* ═══ Profile Details ═══ */
window.openDetails = () => {
    if (_needLogin()) return;
    const u = getUser(window.me.uid) || {};
    openPanel('PROFILE DETAILS', 'fa-id-card', `
        <div class="sec-label" style="margin-top:0">Gender</div>
        <div class="seg" id="gSeg">${['Male', 'Female', 'Other'].map(g => `<button class="${u.gender === g ? 'active' : ''}" onclick="pickGender('${g}')">${g}</button>`).join('')}</div>
        <div class="sec-label">Birthday</div>
        <input class="input-field" type="date" id="dBirth" value="${_esc(u.birthday || '')}" max="${new Date().toISOString().slice(0, 10)}">
        <div class="sec-label">Country</div>
        <input class="input-field" id="dCountry" maxlength="30" placeholder="যেমন: Bangladesh" value="${_esc(u.country || '')}">
        <button class="btn btn-primary wide" style="margin-top:6px" onclick="saveDetails()"><i class="fa-solid fa-check"></i> Save</button>`);
    window._gender = u.gender || '';
};
window.pickGender = (g) => {
    window._gender = g;
    document.querySelectorAll('#gSeg button').forEach(b => b.classList.toggle('active', b.textContent === g));
};
window.saveDetails = () => {
    const f = { gender: window._gender || '', birthday: _$('dBirth').value, country: _$('dCountry').value.trim() };
    persistMe(f);
    
    toastMsg('প্রোফাইল তথ্য সেভ হয়েছে');
    closePanel();
};

/* ═══ Friends ═══ */
window.openFriends = () => {
    if (_needLogin()) return;
    const ids = Object.keys(ls_get('moi_friends_' + window.me.uid, {}) || {});
    const rows = ids.map(id => { const u = lookupUser(id) || {};
        return _uRow(u, id, `<button class="fl-btn" onclick="location.href=URLS.chat+'?targetUid=${encodeURIComponent(id)}&targetName='+encodeURIComponent('${_esc(u.name || '').replace(/'/g, '')}')"><i class="fa-solid fa-comment"></i></button>`); }).join('');
    openPanel('FRIENDS (' + ids.length + ')', 'fa-user-group', ids.length ? `<div class="fl-list">${rows}</div>` : _empty('fa-user-group', 'এখনও কোনো বন্ধু নেই। Chat → Discover থেকে বন্ধু বানান।'));
};

/* ═══ Blocked users ═══ */
window.openBlocked = () => {
    if (_needLogin()) return;
    const b = ls_get('moi_blocked_' + window.me.uid, {}) || {};
    const ids = Array.isArray(b) ? b : Object.keys(b).filter(k => b[k]);
    const rows = ids.map(id => _uRow(lookupUser(id), id, `<button class="fl-btn on" onclick="unblockUser('${id}')">Unblock</button>`)).join('');
    openPanel('BLOCKED USERS', 'fa-ban', ids.length ? `<div class="fl-list">${rows}</div>` : _empty('fa-shield-heart', 'কাউকে ব্লক করা নেই'));
};
window.unblockUser = (id) => {
    const k = 'moi_blocked_' + window.me.uid;
    let b = ls_get(k, {}) || {};
    if (Array.isArray(b)) b = b.filter(x => x !== id); else delete b[id];
    ls_set(k, b);
    toastMsg('Unblock করা হয়েছে', 'fa-unlock');
    openBlocked();
};

/* ═══ My Rooms ═══ */
window.openMyRooms = () => {
    if (_needLogin()) return;
    const rooms = Object.values(ls_get('moi_demo_rooms', {}) || {}).filter(r => r.owner && r.owner.uid === window.me.uid);
    const rows = rooms.map(r => `<div class="fl-row"><img class="fl-av" src="${_esc(r.logo || (window.roomArt ? roomArt(r.id, r.name) : GUEST_AVATAR))}" onerror="this.src='${GUEST_AVATAR}'">
        <div class="fl-info"><div class="fl-name">${_esc(r.name || 'Room')}</div><div class="fl-id">ID: ${_esc(r.id)}</div></div>
        <button class="fl-btn" onclick="location.href=URLS.room+'?room=${encodeURIComponent(r.id)}'">Enter</button></div>`).join('');
    openPanel('MY ROOMS (' + rooms.length + ')', 'fa-door-open', rooms.length ? `<div class="fl-list">${rows}</div>` : _empty('fa-door-open', 'আপনি এখনও কোনো রুম বানাননি। Home থেকে রুম তৈরি করুন।'));
};

/* ═══ Daily Missions ═══ */
const MISSIONS = [
    { id: 'login', icon: 'fa-right-to-bracket', name: 'Open the app', desc: 'আজ অ্যাপে ঢুকুন', dia: 20, xp: 10, auto: true },
    { id: 'name', icon: 'fa-pen', name: 'Update your bio', desc: 'Bio লিখুন', dia: 30, xp: 15, check: u => !!u.bio },
    { id: 'details', icon: 'fa-id-card', name: 'Complete profile', desc: 'Gender, Birthday ও Country দিন', dia: 50, xp: 20, check: u => u.gender && u.birthday && u.country },
    { id: 'friend', icon: 'fa-user-group', name: 'Make a friend', desc: 'অন্তত ১ জন বন্ধু রাখুন', dia: 40, xp: 20, check: () => Object.keys(ls_get('moi_friends_' + window.me.uid, {}) || {}).length > 0 },
    { id: 'follow', icon: 'fa-heart', name: 'Follow someone', desc: 'কাউকে Follow করুন', dia: 30, xp: 15, check: () => (ls_get('moi_follow_' + window.me.uid + '_following', []) || []).length > 0 },
    { id: 'rich', icon: 'fa-gem', name: 'Hold 1,000 💎', desc: 'ব্যালেন্স ১০০০+ রাখুন', dia: 25, xp: 10, check: () => (window.me.diamonds || 0) >= 1000 }
];
const _mKey = () => 'moi_missions_' + window.me.uid + '_' + new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
window.openMissions = () => {
    if (_needLogin()) return;
    const done = ls_get(_mKey(), {}) || {};
    const u = getUser(window.me.uid) || {};
    const rows = MISSIONS.map(m => {
        const ok = m.auto || (m.check && m.check(u));
        const claimed = !!done[m.id];
        const btn = claimed ? `<button class="fl-btn on" disabled>Claimed</button>`
            : ok ? `<button class="fl-btn" onclick="claimMission('${m.id}')">+${m.dia} 💎</button>`
            : `<button class="fl-btn on" onclick="toastMsg('মিশন এখনও সম্পূর্ণ হয়নি','fa-lock')">Locked</button>`;
        return `<div class="fl-row"><div class="menu-icon bag"><i class="fa-solid ${m.icon}"></i></div>
            <div class="fl-info"><div class="fl-name">${m.name}</div><div class="fl-id">${m.desc} • +${m.xp} XP</div></div>${btn}</div>`;
    }).join('');
    const n = Object.keys(done).length;
    openPanel('DAILY MISSIONS', 'fa-list-check', `<div class="input-hint"><i class="fa-solid fa-circle-info"></i><span>আজকের অগ্রগতি: ${n}/${MISSIONS.length}</span></div><div class="fl-list">${rows}</div>`);
};
window.claimMission = async (id) => {
    const r = await MOIEco.try('claimMission', { id });
    if (!r) return;
    toastMsg('+' + r.dia + ' 💎 পেয়েছেন', 'fa-gem');
    setTimeout(openMissions, 300);
};

/* ═══ Profile Visitors ═══ */
window.openVisitors = () => {
    if (_needLogin()) return;
    const k = 'moi_visitors_' + window.me.uid;
    let v = ls_get(k, []) || [];
    const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' মিনিট আগে' : Math.round(m / 60) + ' ঘণ্টা আগে'; };
    const rows = v.map(x => _uRow(lookupUser(x.uid), x.uid, `<span class="fl-id">${ago(x.ts)}</span>`)).join('');
    openPanel('PROFILE VISITORS', 'fa-eye', v.length ? `<div class="fl-list">${rows}</div>` : _empty('fa-eye', 'এখনও কেউ প্রোফাইল দেখেনি'));
};

/* ═══ Rate the app ═══ */
window.openRate = () => {
    const cur = ls_get('moi_rating_' + (window.me.uid || 'guest'), 0) || 0;
    openPanel('RATE MOI', 'fa-star', `
        <div class="empty small"><p>অ্যাপটি কেমন লাগছে?</p></div>
        <div id="stars" style="display:flex;justify-content:center;gap:10px;font-size:34px">${[1, 2, 3, 4, 5].map(n => `<i class="fa-solid fa-star" data-n="${n}" style="cursor:pointer;color:${n <= cur ? '#ffc94d' : 'rgba(255,255,255,.2)'}" onclick="setRate(${n})"></i>`).join('')}</div>
        <textarea class="input-field area" id="rateTxt" maxlength="300" placeholder="মন্তব্য (ঐচ্ছিক)"></textarea>
        <button class="btn btn-primary wide" onclick="submitRate()"><i class="fa-solid fa-paper-plane"></i> Submit</button>`);
    window._rate = cur;
};
window.setRate = (n) => { window._rate = n; document.querySelectorAll('#stars i').forEach(s => s.style.color = (+s.dataset.n <= n) ? '#ffc94d' : 'rgba(255,255,255,.2)'); };
window.submitRate = () => {
    if (!window._rate){ toastMsg('স্টার সিলেক্ট করুন', 'fa-triangle-exclamation'); return; }
    ls_set('moi_rating_' + (window.me.uid || 'guest'), window._rate);
    toastMsg('ধন্যবাদ! ' + window._rate + '★ রেটিং দিয়েছেন', 'fa-star');
    closePanel();
};

/* ═══ Terms & Privacy Policy ═══ */
window.openTerms = () => openPanel('TERMS & PRIVACY', 'fa-file-contract', `
    <div class="faq open"><div class="faq-q"><span>Terms of Service</span></div><div class="faq-a">MOI ব্যবহার করে আপনি সম্মান ও নিরাপত্তার নিয়ম মেনে চলতে সম্মত হচ্ছেন। হয়রানি, স্প্যাম ও অবৈধ কনটেন্ট নিষিদ্ধ। নিয়ম ভাঙলে অ্যাকাউন্ট সীমিত বা বন্ধ হতে পারে।</div></div>
    <div class="faq open"><div class="faq-q"><span>Privacy Policy</span></div><div class="faq-a">আপনার প্রোফাইল তথ্য শুধু অ্যাপের ফিচার চালাতে ব্যবহৃত হয়। আপনার ডেটা নিরাপদে Firebase-এ সংরক্ষিত থাকে এবং তৃতীয় পক্ষকে বিক্রি করা হয় না।</div></div>
    <div class="faq open"><div class="faq-q"><span>Community Guidelines</span></div><div class="faq-a">রুমে ভদ্র আচরণ করুন, অন্যের গোপনীয়তা সম্মান করুন, আর কোনো সমস্যা দেখলে Report করুন।</div></div>`);

/* ═══ Export my data ═══ */
window.exportData = () => {
    if (_needLogin()) return;
    const out = {};
    for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (k.includes(window.me.uid) || k === 'moi_user') { try { out[k] = JSON.parse(localStorage.getItem(k)); } catch(e){ out[k] = localStorage.getItem(k); } }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'moi-my-data.json';
    document.body.appendChild(a); a.click(); a.remove();
    toastMsg('আপনার ডেটা ডাউনলোড হচ্ছে', 'fa-download');
};
