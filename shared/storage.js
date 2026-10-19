/* ═══════════════════════════════════════════════════════════
   shared/storage.js
   সব ডেটা জমা রাখা আর পড়া — localStorage-এ
   ═══════════════════════════════════════════════════════════ */

console.log('[MOI] storage.js loaded');

/* ═══════════════ ডেটা পড়া/লেখা ═══════════════
   এখন সব ডেটা Firebase-এ (shared/core/sync.js)। যেসব key Firebase-এ যায় না
   (theme, lang…) সেগুলো আগের মতো localStorage-এ থাকে। */
function ls_get(key, fallback = null){
    if (window.MOISync) return window.MOISync.get(key, fallback);
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; }
}

function ls_set(key, val){
    if (window.MOISync){ window.MOISync.set(key, val); return; }
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
}

function ls_remove(key){
    if (window.MOISync){ window.MOISync.remove(key); return; }
    try { localStorage.removeItem(key); } catch(e){}
}

/* ═══════════════ KEY নামগুলো ═══════════════ */
/* সব জায়গায় যাতে একই নাম ব্যবহার হয় */
const KEY = {
    user        : 'moi_user',              // এখন লগইন থাকা ইউজার
    demoUsers   : 'moi_demo_users',        // সব ডেমো ইউজার
    demoRooms   : 'moi_demo_rooms',        // সব ডেমো রুম
    joinedRooms : 'moi_joined_rooms',      // কোন কোন রুমে ঢুকেছে
    deviceId    : 'moi_device_id',         // এই ফোনের ID
    guestUid    : 'moi_guest_uid',         // আগের guest এর uid
    lastRoom    : 'moi_last_room',         // শেষ কোন রুমে ছিল
    sampleUid   : 'moi_sample_uid_v1',     // ডেমো স্যাম্পল uid
    sessionKey  : p => `moi_demo_${p}_uid` // provider অনুযায়ী session
};

/* ═══════════════ ইউজার — পড়া / লেখা ═══════════════ */
/* এখন কে লগইন আছে */
function getCurrentUser(){
    return ls_get(KEY.user, null);
}

/* নতুন ইউজার সেট করা (লগইনের পর) */
function setCurrentUser(user){
    ls_set(KEY.user, user);
}

/* লগআউট */
function clearCurrentUser(){
    ls_remove(KEY.user);
}

/* ═══════════════ ডেমো ইউজার — সব ইউজার ═══════════════ */
/* সব ইউজার যাদের ডেটা জমা আছে */
function getAllUsers(){
    return ls_get(KEY.demoUsers, {}) || {};
}

/* একজন ইউজার পাওয়া uid দিয়ে */
function getUser(uid){
    if (!uid) return null;
    const all = getAllUsers();
    if (!all[uid] && window.MOISync && MOISync.wantUser) MOISync.wantUser(uid);   /* ক্যাশে নেই → পেছনে এনে দেবে */
    return all[uid] || null;
}

/* একজন ইউজার সেভ/আপডেট করা */
function saveUser(uid, data){
    if (!uid) return;
    const all = getAllUsers();
    all[uid] = { ...(all[uid] || {}), ...data };
    ls_set(KEY.demoUsers, all);
    return all[uid];
}

/* পুরো ইউজার list আপডেট */
function setAllUsers(obj){
    ls_set(KEY.demoUsers, obj);
}

/* ═══════════════ রুম — পড়া / লেখা ═══════════════ */
/* সব রুম */
function getAllRooms(){
    return ls_get(KEY.demoRooms, {}) || {};
}

/* একটা রুম পাওয়া */
function getRoom(roomId){
    if (!roomId) return null;
    const all = getAllRooms();
    return all[roomId] || null;
}

/* একটা রুম সেভ/আপডেট */
function saveRoom(roomId, data){
    if (!roomId) return;
    const all = getAllRooms();
    all[roomId] = { ...(all[roomId] || {}), ...data };
    ls_set(KEY.demoRooms, all);
    return all[roomId];
}

/* রুম ডিলিট */
function deleteRoom(roomId){
    if (!roomId) return;
    const all = getAllRooms();
    delete all[roomId];
    ls_set(KEY.demoRooms, all);
}

/* ═══════════════ যেসব রুমে ঢুকেছে ═══════════════ */
function getJoinedRooms(){
    return new Set(ls_get(KEY.joinedRooms, []) || []);
}
function markRoomJoined(roomId){
    if (!roomId) return;
    const set = getJoinedRooms();
    set.add(roomId);
    ls_set(KEY.joinedRooms, [...set]);
}

/* ═══════════════ ডিভাইস ID (গেস্টের জন্য) ═══════════════ */
function getDeviceId(){
    let id = ls_get(KEY.deviceId, null);
    if (!id){
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        ls_set(KEY.deviceId, id);
    }
    return id;
}

/* ═══════════════ সব উইন্ডোতে পাওয়া যাবে ═══════════════ */
window.ls_get          = ls_get;
window.ls_set          = ls_set;
window.ls_remove       = ls_remove;
window.KEY             = KEY;
window.getCurrentUser  = getCurrentUser;
window.setCurrentUser  = setCurrentUser;
window.clearCurrentUser= clearCurrentUser;
window.getAllUsers     = getAllUsers;
window.getUser         = getUser;
window.saveUser        = saveUser;
window.setAllUsers     = setAllUsers;
window.getAllRooms     = getAllRooms;
window.getRoom         = getRoom;
window.saveRoom        = saveRoom;
window.deleteRoom      = deleteRoom;
window.getJoinedRooms  = getJoinedRooms;
window.markRoomJoined  = markRoomJoined;
window.getDeviceId     = getDeviceId;