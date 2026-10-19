/* room/data.js — রুমের state লোড */

console.log('[ROOM] data.js loaded');

/* ═══ Room info লোড (Firestore rooms/<id> থেকে) ═══ */
function loadRoomInfo(){
    const info = (ls_get('moi_demo_rooms', {}) || {})[ROOM_ID];
    if (!info){ state.roomName = 'Room ' + ROOM_ID; return false; }
    state.roomName = info.name || 'Room';
    state.roomLogo = info.logo || null;
    state.roomId = info.id || ROOM_ID;
    state.owner = info.owner && info.owner.uid ? { uid: info.owner.uid, name: info.owner.name || info.ownerName, avatar: info.owner.avatar || info.ownerAvatar }
                : (info.ownerUid ? { uid: info.ownerUid, name: info.ownerName, avatar: info.ownerAvatar } : null);
    state.admins = Array.isArray(info.admins) ? info.admins : [];
    if (info.topic && !ls_get(KEY.topic)) state.topic = info.topic;
    return true;
}

/* ═══ State init — সব আসল ডেটা, কোনো ফেক নেই ═══ */
function initState(){
    loadRoomInfo();
    state.topic = ls_get(KEY.topic) || state.topic || '';
    const seats = ls_get(KEY.seats) || [];
    const n = Math.max(10, seats.length);
    state.seats = new Array(n).fill(null).map((_, i) => seats[i] || null);
    state.listeners = ls_get(KEY.listeners) || [];
    state.messages = ls_get(KEY.messages) || [];
    state.giftStats = ls_get(KEY.giftStats) || {};
    state.roomLayout = ls_get(KEY.roomLayout) || state.roomLayout;
    const wp = ls_get(KEY.wallpaper);
    if (wp && wp.dataUrl) applyWallpaper(wp.dataUrl);
    state.joinedUsers = new Set(ls_get(KEY.joined, []) || []);
}

/* ═══ Gifter হিসাব (১ দিন / ১ মাস) ═══ */
function computeGifterStats(range){
    const now = Date.now();
    const cutoff = range === 'day' ? now - 24*60*60*1000 : now - 30*24*60*60*1000;
    const result = [];
    Object.values(state.giftStats || {}).forEach(u => {
        if (!u || !u.uid || !Array.isArray(u.history)) return;
        let total = 0, count = 0;
        u.history.forEach(h => {
            if (h && h.ts >= cutoff){ total += (h.amount || 0); count += 1; }
        });
        if (total > 0) result.push({ uid: u.uid, name: u.name || 'User', avatar: u.avatar || GUEST_AVATAR, total, count });
    });
    return result.sort((a, b) => b.total - a.total);
}

window.loadRoomInfo = loadRoomInfo;
window.initState = initState;
window.computeGifterStats = computeGifterStats;
