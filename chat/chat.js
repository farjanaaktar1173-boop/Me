/* chat/chat.js — Chat পেজের মূল কাজ */

console.log('[MOI CHAT]');

/* ═══ URL params ═══ */
const params = new URLSearchParams(location.search);
const TARGET_UID = params.get('targetUid') || '';
const TARGET_NAME = params.get('targetName') || '';

/* ═══ Chat state ═══ */
window.me = null;
window.currentChatUid = null;
window.currentChatUser = null;

/* ═══ Toast ═══ */
let _chatToastTimer;
function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_chatToastTimer);
    _chatToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
window.toast = toast;

/* ═══ UID কপি ═══ */
window.copyMyUid = () => {
    if (!window.me) return;
    const text = window.me.moiId || window.me.uid;
    navigator.clipboard.writeText(text)
        .then(() => toast('✅ UID কপি: ' + text))
        .catch(() => toast('UID: ' + text));
};

/* ═══ Login overlay → login পেজে যাওয়া ═══ */
window.goToLogin = () => {
    location.href = URLS.login;
};

/* ═══ Init ═══ */
function initUser(){
    const stored = getCurrentUser();
    if (!stored || !stored.uid){
        document.getElementById('loginOverlay').classList.add('show');
        document.getElementById('mainScreen').classList.remove('show');
        return false;
    }

    const fresh = getUser(stored.uid) || {};
    window.me = {
        uid: stored.uid,
        name: fresh.name || stored.name || 'User',
        photo: fresh.photo || fresh.avatar || stored.photo || GUEST_AVATAR,
        moiId: fresh.moiId || stored.moiId || ''
    };

    document.getElementById('myAvatar').src = window.me.photo;
    document.getElementById('myName').textContent = window.me.name;
    document.getElementById('myUid').textContent = '🆔 ' + (window.me.moiId || window.me.uid.slice(0,8));
    return true;
}

/* ═══ চ্যাট খোলা (কোনো ইউজারের সাথে) ═══ */
window.openChatWith = (uid) => {
    if (!window.me || !uid || uid === window.me.uid) return;

    window.currentChatUid = uid;
    const u = allUsers[uid] || {};
    window.currentChatUser = {
        uid,
        name: u.name || TARGET_NAME || 'User',
        photo: u.photo || u.avatar || GUEST_AVATAR
    };

    document.getElementById('mainScreen').classList.remove('show');
    document.getElementById('chatScreen').classList.add('show');
    document.getElementById('chatName').textContent = window.currentChatUser.name;
    document.getElementById('chatAvatar').src = window.currentChatUser.photo;
    document.getElementById('chatBody').innerHTML = '';
    document.getElementById('messageInput').value = '';
    if (typeof cancelReply === 'function') cancelReply();

    /* unread = 0 */
    if (typeof chatMetas !== 'undefined' && chatMetas[uid]){
        chatMetas[uid].unread = 0;
        if (typeof saveFriendsData === 'function') saveFriendsData();
    }

    /* অনলাইন status */
    const online = typeof isOnline === 'function' && isOnline(allUsers[uid]);
    document.getElementById('chatAvWrap').classList.toggle('online', online);
    document.getElementById('chatStatus').textContent = online ? '● Online' : 'অফলাইন';

    /* প্রোফাইল স্ট্যাটাস */
    updateFriendStatus();

    /* সব মেসেজ রেন্ডার */
    if (typeof renderAllMessages === 'function') renderAllMessages();

    setTimeout(() => document.getElementById('messageInput').focus(), 250);
};

/* ═══ পিছনে ফেরা ═══ */
window.backToList = () => {
    document.getElementById('chatScreen').classList.remove('show');
    document.getElementById('mainScreen').classList.add('show');
    window.currentChatUid = null;
    window.currentChatUser = null;
    if (typeof cancelReply === 'function') cancelReply();
    if (typeof loadFriendsData === 'function') loadFriendsData();
    if (typeof renderList === 'function') renderList();
    if (TARGET_UID) history.replaceState({}, '', location.pathname);
};

/* ═══ বন্ধু status আপডেট (chat header / footer) ═══ */
function updateFriendStatus(){
    if (!window.currentChatUid) return;
    const uid = window.currentChatUid;
    const isFriend = !!myFriends[uid];
    const isBlocked = !!myBlocked[uid];
    const isSent = !!mySentRequests[uid];
    const isReqIncoming = !!myRequests[uid];

    const footer = document.getElementById('chatFooter');
    const cta = document.getElementById('addFriendCta');
    const callBtn = document.getElementById('callBtn');
    const afContainer = cta.querySelector('.af-buttons');

    if (isFriend && !isBlocked){
        footer.style.display = '';
        cta.style.display = 'none';
        callBtn.style.display = '';
        return;
    }

    footer.style.display = 'none';
    cta.style.display = '';
    callBtn.style.display = 'none';

    if (isReqIncoming){
        afContainer.innerHTML = `
            <button class="af-add" onclick="acceptRequest('${esc(uid)}')"><i class="fa-solid fa-check"></i> Accept</button>
            <button class="af-add" style="background:rgba(255,255,255,.08);color:#ff8a9c;box-shadow:none;border:1px solid rgba(239,68,68,.3);" onclick="blockRequest('${esc(uid)}')">Block</button>`;
        return;
    }

    if (isSent){
        afContainer.innerHTML = `<button class="af-add sent" disabled><i class="fa-solid fa-check"></i> Request Sent</button>`;
    } else if (isBlocked){
        afContainer.innerHTML = `<button class="af-add" disabled style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);box-shadow:none;"><i class="fa-solid fa-ban"></i> Blocked</button>`;
    } else {
        afContainer.innerHTML = `<button class="af-add" id="afAddBtn" onclick="sendFriendRequest()"><i class="fa-solid fa-user-plus"></i> Add Friend</button>`;
    }
}
window.updateFriendStatus = updateFriendStatus;

/* ═══ অডিও কল (শুধু UI — ভয়েস কল ইঞ্জিন পরে যুক্ত হবে) ═══ */
let callTimer = null;
window.startCall = () => {
    if (!window.currentChatUid) return;
    if (!myFriends[window.currentChatUid]){ toast('শুধু বন্ধুদের কল করা যাবে'); return; }
    document.getElementById('callAvatar').src = window.currentChatUser.photo;
    document.getElementById('callName').textContent = window.currentChatUser.name;
    document.getElementById('callStatusText').textContent = 'রিং হচ্ছে...';
    toast('ভয়েস কল শীঘ্রই আসছে');
    document.getElementById('callOverlay').classList.add('show');

    let sec = 0;
    callTimer = setInterval(() => {
        sec++;
        document.getElementById('callStatusText').textContent = 'সংযুক্ত · ' + Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    }, 1000);
};

window.hangupCall = () => {
    if (callTimer){ clearInterval(callTimer); callTimer = null; }
    document.getElementById('callOverlay').classList.remove('show');
    toast('কল শেষ');
};

/* ═══ সব শুরু ═══ */
(window.MOIReady || Promise.resolve()).then(function init(){
    if (!initUser()) return;
    if (window.MOIAuth && MOIAuth.isGuest){ toast('গেস্ট মোডে চ্যাট করা যাবে না — লগইন করুন'); }

    document.getElementById('mainScreen').classList.add('show');

    if (typeof renderEmojiPicker === 'function') renderEmojiPicker();
    if (typeof loadFriendsData === 'function') loadFriendsData();
    if (typeof updateReqBadge === 'function') updateReqBadge();
    if (typeof renderList === 'function') renderList();
    if (typeof initSearch === 'function') initSearch();

    /* রিয়েলটাইম: নতুন মেসেজ/অনুরোধ/ইউজার আপডেট এলে রি-রেন্ডার */
    let t = null;
    window.addEventListener('moi:sync', (e) => {
        const k = (e.detail && e.detail.key) || '';
        if (!/^moi_(chat_|friends_|friend_requests_|sent_requests_|blocked_|chat_meta_|demo_users)/.test(k)) return;
        clearTimeout(t);
        t = setTimeout(() => {
            const chatKey = window.currentChatUid ? 'moi_chat_' + [window.me.uid, window.currentChatUid].sort().join('__') : null;
            if (k === chatKey && typeof renderAllMessages === 'function'){ renderAllMessages(); return; }
            if (!window.currentChatUid || k.indexOf('moi_chat_') !== 0 || k.indexOf('moi_chat_meta_') === 0){
                loadFriendsData(); updateReqBadge();
                if (window.currentChatUid) updateFriendStatus(); else renderList();
            }
        }, 60);
    });

    /* সরাসরি target দিয়ে এলে chat খুলে দাও */
    if (TARGET_UID && TARGET_UID !== window.me.uid){
        getUser(TARGET_UID);
        setTimeout(() => openChatWith(TARGET_UID), 400);
    }

    console.log('%c💬 MOI Chat Ready — ' + window.me.name, 'color:#a855f7;font-size:14px;font-weight:bold');
});
