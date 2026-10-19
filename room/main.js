/* room/main.js — Room বুট + init */

console.log('[ROOM] main.js loaded');

/* ═══ User bootstrap — আসল লগইন ছাড়া রুমে ঢোকা যায় না ═══ */
(window.MOIReady || Promise.resolve()).then(function bootstrapUser(){
    const u = (window.MOIAuth && MOIAuth.profile) || getCurrentUser();
    if (!u || !u.uid){ location.href = '../login/index.html'; return; }
    if (!ROOM_ID){ location.href = '../home/index.html'; return; }

    myProfile = {
        uid: u.uid,
        name: u.name || 'User',
        avatar: u.photo || u.avatar || GUEST_AVATAR,
        email: u.email || '',
        moiId: u.moiId || '',
        country: u.country || '',
        voice: u.voice || '',
        diamonds: u.diamonds ?? 0,
        role: u.role || 'user',
        isGuest: !!(window.MOIAuth && MOIAuth.isGuest)
    };
    const av = $('my-avatar-top');
    if (av) av.src = myProfile.avatar;
    if (typeof refreshTopBarRing === 'function') refreshTopBarRing();

    /* রুমের ডেটা Firestore থেকে আসা পর্যন্ত অপেক্ষা (সর্বোচ্চ ৬ সেকেন্ড) */
    const t0 = Date.now();
    (function waitRoom(){
        const info = (ls_get('moi_demo_rooms', {}) || {})[ROOM_ID];
        if (info || Date.now() - t0 > 6000){
            if (!info){ toastMsg('রুমটি পাওয়া যায়নি'); setTimeout(() => location.href = '../home/index.html', 1200); return; }
            finishInit();
        } else setTimeout(waitRoom, 150);
    })();
});

/* ═══ আমার রোল এই রুমে ═══ */
function computeMyRole(){
    if (!myProfile) return 'member';
    if (state.owner && state.owner.uid === myProfile.uid) return 'owner';
    if ((state.admins || []).includes(myProfile.uid)) return 'admin';
    return 'member';
}
window.computeMyRole = computeMyRole;

/* ═══ Main init শেষ হলে ═══ */
function finishInit(){
    if (joined) return;

    initState();

    /* ═══ Role detect — owner/admin রুমের ডেটা থেকে, সাথে অ্যাপ-লেভেল staff ═══ */
    state.myRole = computeMyRole();

    renderBranding();
    renderSeats();
    renderMessageFeed();
    renderListeners();
    renderMembers();
    renderTopGifters();
    joinRoom();
    buildEmojiCategories();
    renderEmojiGrid();

    initDragHandle('chatDragHandle', 'chatSheet');
    initDragHandle('gameDragHandle', 'gameSheet');

    startLuckyBoxTimer();
    if (typeof giftListenLive === 'function') giftListenLive();

    /* ═══ Storage change listener (একই ব্রাউজারে অন্য ট্যাব) ═══ */
    const handleSync = (e) => {
        if (e.key === KEY.seats){
            state.seats = ls_get(KEY.seats) || new Array(10).fill(null);
            renderSeats();
            updateMicButton();
        }
        if (e.key === KEY.listeners){
            state.listeners = ls_get(KEY.listeners) || [];
            renderListeners();
            renderMembers();
            $('userCountBadge').textContent = state.listeners.length;
            $('listenerTotalCount').textContent = state.listeners.length;
        }
        if (e.key === KEY.messages){
            state.messages = ls_get(KEY.messages) || [];
            renderMessageFeed();
        }
        if (e.key === KEY.giftStats){
            state.giftStats = ls_get(KEY.giftStats) || {};
            renderTopGifters();
        }
        if (e.key === KEY.wallpaper){
            const wp = ls_get(KEY.wallpaper);
            if (wp && wp.dataUrl) applyWallpaper(wp.dataUrl);
        }
        if (e.key === KEY.activity){
            const acts = ls_get(KEY.activity, []) || [];
            const arr = Array.isArray(acts) ? acts : Object.values(acts);
            arr.filter(a => a && a.ts > (window._actSeen || Date.now()) && myProfile && a.uid !== myProfile.uid).forEach(a => showActivity(a));
            if (arr.length) window._actSeen = Math.max(window._actSeen || 0, ...arr.map(a => a.ts || 0));
        }
        if (e.key === 'moi_luckybox_' + ROOM_ID){ renderMessageFeed(); }
        if (e.key === KEY.pkState){
            if (typeof pkRestoreFromStorage === 'function') pkRestoreFromStorage();
        }
        if (e.key === KEY.joined){
            state.joinedUsers = new Set(ls_get(KEY.joined, []) || []);
            updateJoinButton();
        }
    };
    window.addEventListener('moi:sync', (ev) => handleSync({ key: ev.detail && ev.detail.key }));
    window.addEventListener('moi:sync', (ev) => {
        const k = ev.detail && ev.detail.key;
        if (k === 'moi_demo_rooms'){
            const prevRole = state.myRole; loadRoomInfo(); state.myRole = computeMyRole();
            renderBranding(); if (prevRole !== state.myRole){ updateRoleFlag(); updateSettingsVisibility(); renderSeats(); renderMembers(); }
        }
        if (k === 'moi_demo_rooms' && typeof isBannedHere === 'function' && isBannedHere()){ toastMsg('⛔ আপনাকে রুম থেকে সরানো হয়েছে'); setTimeout(() => location.href = '../home/index.html', 900); }
        if (k === 'moi_demo_users' && myProfile){ const me = getUser(myProfile.uid); if (me && typeof me.diamonds === 'number'){ myProfile.diamonds = me.diamonds; if (typeof giftUpdateBalance === 'function') giftUpdateBalance(); } }
        if (k === 'moi_demo_users'){ refreshAllRings && refreshAllRings(); }
    });

    /* ═══ Ring refresh ═══ */
    setTimeout(refreshAllRings, 100);
    setTimeout(refreshAllRings, 800);

    /* ═══ PK restore (আগে চালু থাকলে) ═══ */
    if (typeof pkRestoreFromStorage === 'function') pkRestoreFromStorage();

    console.log('[ROOM] ' + (state.myRole || 'member').toUpperCase() + ' — ' + state.roomName);
}

/* ═══ Drag handle (chat / game sheet) ═══ */
function initDragHandle(handleId, sheetId){
    const handle = $(handleId);
    const sheet = $(sheetId);
    if (!handle || !sheet) return;

    let dragging = false, startY = 0, startH = 0;

    const start = (e) => {
        dragging = true;
        startY = (e.touches ? e.touches[0].clientY : e.clientY);
        startH = sheet.offsetHeight;
        sheet.style.transition = 'none';
    };
    const move = (e) => {
        if (!dragging) return;
        const y = (e.touches ? e.touches[0].clientY : e.clientY);
        const dy = startY - y;
        let newH = startH + dy;
        const minH = window.innerHeight * 0.5;
        const maxH = window.innerHeight;
        newH = Math.max(minH, Math.min(maxH, newH));
        sheet.style.height = newH + 'px';
        sheet.style.maxHeight = newH + 'px';
    };
    const end = () => {
        if (!dragging) return;
        dragging = false;
        sheet.style.transition = '';
        const h = sheet.offsetHeight, maxH = window.innerHeight;
        sheet.style.height = '';
        sheet.style.maxHeight = '';
        if (h > maxH * 0.85) sheet.classList.add('fullscreen');
        else if (h < maxH * 0.6) sheet.classList.remove('fullscreen');
    };

    handle.addEventListener('touchstart', start, {passive:true});
    handle.addEventListener('touchmove', move, {passive:true});
    handle.addEventListener('touchend', end);
    handle.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
}

/* ═══ Lucky Box inject hook ═══ */
(function hookMessageFeed(){
    const orig = window.renderMessageFeed;
    if (typeof orig === 'function'){
        window.renderMessageFeed = function(){
            orig.apply(this, arguments);
            injectLuckyBoxesIntoFeed();
        };
    }
})();

/* ═══ Global exports ═══ */
window.initDragHandle = initDragHandle;
window.finishInit = finishInit;