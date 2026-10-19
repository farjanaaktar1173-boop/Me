/* chat/friends.js — বন্ধু তালিকা, রিকুয়েস্ট, সার্চ */

console.log('[MOI] friends.js loaded');

/* ═══ স্টেট ═══ */
let activeTab = 'friends';
let allUsers = {};
let myFriends = {};
let myRequests = {};
let mySentRequests = {};
let myBlocked = {};
let chatMetas = {};

function isOnline(u){
    if (!u || !u.lastSeen) return false;
    const p = u.prefs && u.prefs.p_online === false;
    return !p && (Date.now() - Number(u.lastSeen)) < 180000;
}
window.isOnline = isOnline;

/* ═══ localStorage থেকে পড়া ═══ */
function loadFriendsData(){
    const uid = window.me ? window.me.uid : null;
    if (!uid) return;

    myFriends = ls_get('moi_friends_' + uid, {}) || {};
    myRequests = ls_get('moi_friend_requests_' + uid, {}) || {};
    mySentRequests = ls_get('moi_sent_requests_' + uid, {}) || {};
    myBlocked = ls_get('moi_blocked_' + uid, {}) || {};
    chatMetas = ls_get('moi_chat_meta_' + uid, {}) || {};

    /* সব ইউজার — ডেমো + লগইন করা */
    allUsers = getAllUsers() || {};
    if (window.me) allUsers[uid] = { ...allUsers[uid], ...window.me };
    /* বন্ধু/অনুরোধের ইউজারদের তথ্য পেছনে এনে নাও */
    Object.keys(myFriends).concat(Object.keys(myRequests)).forEach(x => { if (!allUsers[x] || !allUsers[x].name) getUser(x); });
}

/* ═══ সেভ ═══ */
function saveFriendsData(){
    const uid = window.me ? window.me.uid : null;
    if (!uid) return;
    ls_set('moi_friends_' + uid, myFriends);
    ls_set('moi_friend_requests_' + uid, myRequests);
    ls_set('moi_sent_requests_' + uid, mySentRequests);
    ls_set('moi_blocked_' + uid, myBlocked);
    ls_set('moi_chat_meta_' + uid, chatMetas);
}

/* ═══ Tab পরিবর্তন ═══ */
window.switchTab = (t) => {
    activeTab = t;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
    document.getElementById('searchWrap').style.display = (t === 'friends') ? '' : 'none';
    renderList();
};

function updateReqBadge(){
    const n = Object.keys(myRequests).length;
    const b = document.getElementById('reqBadge');
    b.textContent = n;
    b.classList.toggle('show', n > 0);
}

/* ═══ তালিকা রেন্ডার ═══ */
function renderList(){
    const area = document.getElementById('listArea');
    if (!window.me) return;

    if (activeTab === 'requests'){
        const list = Object.values(myRequests);
        if (!list.length){
            area.innerHTML = '<div class="empty"><div class="big">📩</div>এখনো কোনো বন্ধুর অনুরোধ নেই</div>';
            return;
        }
        area.innerHTML = list.map(r => `
            <div class="req-card">
                <img src="${esc(r.fromPhoto || GUEST_AVATAR)}">
                <div class="req-info">
                    <div class="rn">${esc(r.fromName || 'User')}</div>
                    <div class="rt">আপনাকে বন্ধু হতে চায়</div>
                </div>
                <div class="req-actions">
                    <button class="acc" onclick="acceptRequest('${esc(r.fromUid)}')">✓ Accept</button>
                    <button class="blk" onclick="blockRequest('${esc(r.fromUid)}')">Block</button>
                </div>
            </div>`).join('');
        return;
    }

    /* বন্ধু tab */
    const search = (document.getElementById('searchInput').value || '').trim().toLowerCase();
    const friendUids = Object.keys(myFriends).filter(uid => !myBlocked[uid]);

    const friends = friendUids.map(uid => {
        const u = allUsers[uid] || {};
        const meta = chatMetas[uid] || {};
        return {
            uid,
            name: u.name || 'User',
            photo: u.photo || u.avatar || GUEST_AVATAR,
            online: isOnline(u),
            lastMsg: meta.lastMessage || '',
            lastType: meta.lastType || 'text',
            lastSender: meta.lastSender || '',
            lastTime: meta.lastTime || 0,
            unread: meta.unread || 0,
            pinned: !!meta.pinned,
            muted: !!meta.muted
        };
    }).filter(f => !search || f.name.toLowerCase().includes(search));

    friends.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.unread !== b.unread) return b.unread - a.unread;
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (b.lastTime !== a.lastTime) return b.lastTime - a.lastTime;
        return a.name.localeCompare(b.name);
    });

    if (!friends.length){
        if (search) area.innerHTML = '<div class="empty"><div class="big">🔍</div>কোনো বন্ধু পাওয়া যায়নি</div>';
        else area.innerHTML = '<div class="empty"><div class="big">👥</div>এখনো কোনো বন্ধু নেই<br><br>রুমে কারো Profile-এ গিয়ে<br>Add Friend দিন</div>';
        return;
    }

    const onlineL = friends.filter(f => f.online);
    const offlineL = friends.filter(f => !f.online);

    let html = '';
    if (onlineL.length){
        html += '<div class="section-title">🟢 অনলাইন (' + onlineL.length + ')</div>';
        onlineL.forEach(f => html += friendRowHTML(f));
    }
    if (offlineL.length){
        html += '<div class="section-title" style="margin-top:6px">⚪ অফলাইন (' + offlineL.length + ')</div>';
        offlineL.forEach(f => html += friendRowHTML(f));
    }
    area.innerHTML = html;
}

function friendRowHTML(f){
    let preview;
    if (f.lastType === 'image') preview = '📷 ছবি';
    else if (f.lastType === 'video') preview = '🎬 ভিডিও';
    else if (f.lastType === 'audio') preview = '🎤 ভয়েস';
    else preview = f.lastMsg || '';

    const senderTag = f.lastSender === window.me.uid ? '<span class="lbl-sender">আপনি: </span>' : '';
    const statusLine = f.online
        ? '<span class="lbl-online">● Online</span>'
        : '<span class="lbl-offline">' + (f.lastTime ? timeAgo(f.lastTime) : 'অফলাইন') + '</span>';

    const previewHtml = preview ? `${statusLine} · ${senderTag}${esc(preview)}` : statusLine;
    const timeStr = f.lastTime ? timeAgo(f.lastTime) : '';
    const unreadHtml = f.unread > 0 ? `<div class="u-unread${f.muted ? ' muted' : ''}">${f.unread > 99 ? '99+' : f.unread}</div>` : '';

    return `<div class="user-item" onclick="openChatWith('${esc(f.uid)}')">
        <div class="u-avatar">
            <img src="${esc(f.photo)}" onerror="this.src='${GUEST_AVATAR}'">
            <div class="status-dot ${f.online ? 'online' : ''}"></div>
        </div>
        <div class="u-info">
            <div class="u-name">${esc(f.name)}${f.pinned ? ' <i class="fa-solid fa-thumbtack cx-pin"></i>' : ''}${f.muted ? ' <i class="fa-solid fa-bell-slash cx-pin"></i>' : ''}</div>
            <div class="u-last">${previewHtml}</div>
        </div>
        <div class="u-meta">
            <div class="u-time">${esc(timeStr)}</div>
            ${unreadHtml}
        </div>
    </div>`;
}

/* ═══ বন্ধু রিকুয়েস্ট পাঠানো ═══ */
window.sendFriendRequest = () => {
    if (!window.me || !window.currentChatUid) return;
    if (myFriends[window.currentChatUid]) return;
    if (window.MOIAuth && MOIAuth.isGuest){ toast('গেস্ট বন্ধু যোগ করতে পারে না — লগইন করুন'); return; }
    if (mySentRequests[window.currentChatUid]){ toast('✅ ইতিমধ্যে অনুরোধ পাঠানো হয়েছে'); return; }

    mySentRequests[window.currentChatUid] = true;
    saveFriendsData();

    /* প্রাপক পাশে রিকুয়েস্ট সেভ */
    const theirReqs = ls_get('moi_friend_requests_' + window.currentChatUid, {}) || {};
    theirReqs[window.me.uid] = {
        fromUid: window.me.uid,
        fromName: window.me.name,
        fromPhoto: window.me.photo,
        ts: Date.now()
    };
    ls_set('moi_friend_requests_' + window.currentChatUid, theirReqs);

    toast('✅ বন্ধুর অনুরোধ পাঠানো হয়েছে');
    if (typeof updateFriendStatus === 'function') updateFriendStatus();
};

/* ═══ Accept ═══ */
window.acceptRequest = (fromUid) => {
    if (!window.me || !fromUid) return;

    myFriends[fromUid] = true;
    delete myRequests[fromUid];
    saveFriendsData();

    /* অন্যপাশে বন্ধু যোগ */
    const theirFriends = ls_get('moi_friends_' + fromUid, {}) || {};
    theirFriends[window.me.uid] = true;
    ls_set('moi_friends_' + fromUid, theirFriends);

    /* অন্যপাশের sentRequests সরানো */
    const theirSent = ls_get('moi_sent_requests_' + fromUid, {}) || {};
    delete theirSent[window.me.uid];
    ls_set('moi_sent_requests_' + fromUid, theirSent);

    toast('🎉 আপনি এখন বন্ধু');
    loadFriendsData();
    renderList();
    updateReqBadge();
};

/* ═══ Block ═══ */
window.blockRequest = (fromUid) => {
    if (!fromUid) return;
    myBlocked[fromUid] = true;
    delete myRequests[fromUid];
    saveFriendsData();

    const theirSent = ls_get('moi_sent_requests_' + fromUid, {}) || {};
    delete theirSent[window.me.uid];
    ls_set('moi_sent_requests_' + fromUid, theirSent);

    toast('🚫 ব্লক করা হয়েছে');
    loadFriendsData();
    renderList();
    updateReqBadge();
};

/* ═══ সার্চ ═══ */
function initSearch(){
    const inp = document.getElementById('searchInput');
    if (inp) inp.addEventListener('input', renderList);
}

window.loadFriendsData = loadFriendsData;
window.saveFriendsData = saveFriendsData;
window.renderList = renderList;
window.updateReqBadge = updateReqBadge;
window.initSearch = initSearch;