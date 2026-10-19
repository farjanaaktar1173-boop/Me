/* room/actions.js — সব action */

console.log('[ROOM] actions.js loaded');

let _inviteCooldowns = new Set();
let currentFollowingSet = new Set();
let currentFollowersCount = 0;
let currentFollowListMode = 'followers';

/* ═══ Role hierarchy ═══ */
function _roleWeight(role){
    if (role === 'owner') return 3;
    if (role === 'admin') return 2;
    return 1;
}

function canManageUser(targetUid){
    if (!myProfile) return false;
    if (targetUid === myProfile.uid) return false;
    const myWeight = _roleWeight(getMyRole());
    const targetWeight = _roleWeight(getRoleOf(targetUid));
    return myWeight > targetWeight;
}

/* ═══ Followed rooms helpers (Home এর Following ট্যাবে দেখানোর জন্য) ═══ */
function getFollowedRooms(){
    if (!myProfile) return [];
    return ls_get('moi_followed_rooms_' + myProfile.uid, []) || [];
}
function saveFollowedRooms(list){
    if (!myProfile) return;
    ls_set('moi_followed_rooms_' + myProfile.uid, list);
}
function isRoomFollowed(roomId){
    return getFollowedRooms().indexOf(roomId) > -1;
}
function addFollowedRoom(roomId){
    if (!myProfile || !roomId) return;
    const list = getFollowedRooms();
    if (list.indexOf(roomId) === -1){
        list.push(roomId);
        saveFollowedRooms(list);
    }
}
function removeFollowedRoom(roomId){
    if (!myProfile || !roomId) return;
    const list = getFollowedRooms().filter(id => id !== roomId);
    saveFollowedRooms(list);
}

/* ═══ রুমে join (auto — room page এ ঢুকলে) ═══ */
/* ═══ উপস্থিতি (Realtime DB) — কতজন আছে, ট্যাব বন্ধ হলে নিজে থেকে মুছে যায় ═══ */
let _seatDisc = null;
function presenceEnter(){
    try {
        const FB = window.MOIFB; if (!FB || !myProfile) return;
        const base = FB.LIVE + '/roomPresence/' + ROOM_ID + '/' + myProfile.uid;
        const pr = FB.rtdb.ref(base); pr.onDisconnect().remove(); pr.set(true).catch(() => {});
        const lr = FB.rtdb.ref(FB.LIVE + '/rooms/' + ROOM_ID + '/listeners/' + myProfile.uid);
        lr.onDisconnect().remove();
    } catch(e){ console.warn('presence', e); }
}
function presenceLeave(){
    try {
        const FB = window.MOIFB; if (!FB || !myProfile) return;
        FB.rtdb.ref(FB.LIVE + '/roomPresence/' + ROOM_ID + '/' + myProfile.uid).remove();
        FB.rtdb.ref(FB.LIVE + '/rooms/' + ROOM_ID + '/listeners/' + myProfile.uid).remove();
        const idx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
        if (idx > -1) FB.rtdb.ref(FB.LIVE + '/rooms/' + ROOM_ID + '/seats/' + idx).remove();
    } catch(e){}
}
function armSeatDisconnect(i){
    try {
        const FB = window.MOIFB; if (!FB) return;
        if (_seatDisc){ _seatDisc.cancel().catch(() => {}); _seatDisc = null; }
        if (i === null || i === undefined) return;
        _seatDisc = FB.rtdb.ref(FB.LIVE + '/rooms/' + ROOM_ID + '/seats/' + i).onDisconnect();
        _seatDisc.remove();
    } catch(e){}
}
window.addEventListener('pagehide', presenceLeave);
function isBannedHere(){
    const r = getRoomInfo(ROOM_ID) || {};
    return Array.isArray(r.bannedUsers) && myProfile && r.bannedUsers.includes(myProfile.uid);
}
window.isBannedHere = isBannedHere;

function joinRoom(){
    if (!myProfile || joined) return;
    if (isBannedHere()){ toastMsg('⛔ আপনাকে এই রুম থেকে নিষিদ্ধ করা হয়েছে'); setTimeout(() => location.href = '../home/index.html', 1200); return; }
    joined = true;
    const myRole = state.myRole || 'member';
    presenceEnter();

    /* পুরনো role ঠিক করা */
    const mySeatIdx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (mySeatIdx > -1){
        state.seats[mySeatIdx].role = myRole;
        state.seats[mySeatIdx].name = myProfile.name;
        state.seats[mySeatIdx].avatar = myProfile.avatar;
        ls_set(KEY.seats, state.seats);
        armSeatDisconnect(mySeatIdx);
    }

    /* Listeners এ নিজে */
    const list = state.listeners.filter(l => l.uid !== myProfile.uid);
    list.push({
        uid: myProfile.uid, name: myProfile.name, avatar: myProfile.avatar,
        role: myRole, joined: Date.now(), isMe: true
    });
    state.listeners = list;
    ls_set(KEY.listeners, list);

    if (myRole === 'owner' && !(state.seats[0] && state.seats[0].uid && state.seats[0].uid !== myProfile.uid)){
        armSeatDisconnect(0);
        state.seats[0] = {
            uid: myProfile.uid, name: myProfile.name, avatar: myProfile.avatar,
            role:'owner', mic:true, locked:false,
            coins:(state.seats[0] && state.seats[0].coins) || 0,
            started: Date.now()
        };
        ls_set(KEY.seats, state.seats);
        state.owner = { uid: myProfile.uid, name: myProfile.name, avatar: myProfile.avatar };
    } else {
        state.joinedUsers.add(myProfile.uid);
        ls_set(KEY.joined, [...state.joinedUsers]);
        if (state.owner && state.owner.uid === myProfile.uid){
            state.owner = null;
        }
    }

    updateRoleFlag();
    updateSettingsVisibility();
    updateJoinButton();
    logActivity('join', null);
    renderListeners();
    renderMembers();
    renderSeats();
    renderTopGifters();
    updateMicButton();
    $('userCountBadge').textContent = state.listeners.length;
    $('listenerTotalCount').textContent = state.listeners.length;

    console.log('%c[ROLE] ' + myRole.toUpperCase() + ' হিসেবে ঢুকেছেন', 'color:#00E5FF;font-weight:bold');
}

/* ═══ Join / Unjoin (নিচের Join বাটনে চাপলে) ═══ */
window.toggleJoinRoom = () => {
    if (!myProfile) return;

    /* নিজের রুম হলে Join button কার্যকর নয় */
    if (state.owner && state.owner.uid === myProfile.uid){
        toastMsg('👑 এটা আপনার রুম, Join লাগবে না');
        return;
    }

    const isJoined = state.joinedUsers.has(myProfile.uid);

    if (isJoined){
        /* Unjoin */
        state.joinedUsers.delete(myProfile.uid);
        removeFollowedRoom(ROOM_ID);
        toastMsg('❌ Unjoin হয়েছেন · Following থেকে সরানো হয়েছে');
    } else {
        /* Join */
        if (state.joinedUsers.size >= 4000){
            toastMsg('❌ Room Full — ৪০০০/৪০০০');
            return;
        }
        state.joinedUsers.add(myProfile.uid);
        addFollowedRoom(ROOM_ID);
        toastMsg('✅ Room এ Join হয়েছেন · Following এ যোগ হয়েছে');
    }
    ls_set(KEY.joined, [...state.joinedUsers]);
    updateJoinButton();
};

/* ═══ Invite ═══ */
window.inviteUser = (uid) => {
    const u = state.listeners.find(x => x.uid === uid);
    if (!u) return;
    if (_inviteCooldowns.has(uid)){
        toastMsg('⏱️ অপেক্ষা করুন...');
        return;
    }
    _inviteCooldowns.add(uid);
    renderListeners();
    toastMsg(`📨 ${u.name} কে ইনভাইট পাঠানো হয়েছে`);
    setTimeout(() => {
        _inviteCooldowns.delete(uid);
        renderListeners();
    }, 5000);
};

/* ═══ Listener/Member ট্যাপ ═══ */
window.handleListenerTap = (uid) => {
    closeModal('listenersModal');
    setTimeout(() => openUserProfile(uid), 150);
};

window.handleMemberTap = (uid) => {
    if (!myProfile) return;
    const target = state.listeners.find(u => u.uid === uid);
    if (!target) return;
    const me = uid === myProfile.uid;

    if (me){
        closeModal('memberModal');
        setTimeout(() => openUserProfile(uid), 150);
        return;
    }

    const myRole = getMyRole();
    const targetRole = getRoleOf(target.uid);
    const canManage = canManageUser(uid);

    if (canManage){
        currentPermUid = uid;
        $('permAvatar').src = target.avatar || GUEST_AVATAR;
        $('permName').textContent = target.name;
        $('optAdmin').classList.toggle('selected', targetRole === 'admin');
        $('optMember').classList.toggle('selected', targetRole === 'member');

        const ownerCanEditRole = (myRole === 'owner');
        $('optAdmin').style.pointerEvents = ownerCanEditRole ? '' : 'none';
        $('optMember').style.pointerEvents = ownerCanEditRole ? '' : 'none';
        $('optAdmin').style.opacity = ownerCanEditRole ? '' : '.4';
        $('optMember').style.opacity = ownerCanEditRole ? '' : '.4';

        document.querySelector('#permissionSheet .perm-remove-btn').style.display = '';

        closeModal('memberModal');
        $('sheetBackdrop').classList.add('active');
        $('permissionSheet').classList.add('active');
        return;
    }

    closeModal('memberModal');
    setTimeout(() => openUserProfile(uid), 150);
};

/* ═══ Role সেট (Owner only) ═══ */
window.setPermissionRole = async (role) => {
    if (!currentPermUid) return;
    if (!isOwner() && !(window.myProfile && ['developer','superadmin'].includes(myProfile.role))){
        toastMsg('শুধু Owner role পরিবর্তন করতে পারবে');
        return;
    }
    const target = state.listeners.find(u => u.uid === currentPermUid);
    if (!target) return;
    const on = role === 'admin';
    const r = await MOIEco.try('setRoomAdmin', { roomId: ROOM_ID, uid: currentPermUid, on });   /* সার্ভার রুলে সত্যিকারের অ্যাডমিন সেট করে */
    if (!r) return;
    state.admins = (state.admins || []).filter(x => x !== currentPermUid);
    if (on) state.admins.push(currentPermUid);
    target.role = role;
    const seatIdx = state.seats.findIndex(s => s && s.uid === currentPermUid);
    renderListeners(); renderMembers(); renderSeats();
    logActivity(on ? 'makeAdmin' : 'removeAdmin', seatIdx > -1 ? seatIdx : null, { target: target.name });
    toastMsg(on ? `👑 ${target.name} এখন Admin` : `⭐ ${target.name} এখন User`);
    closePermissionSheet();
};

/* ═══ Remove from room ═══ */
window.removeUserFromRoom = () => {
    if (!currentPermUid) return;
    const target = state.listeners.find(u => u.uid === currentPermUid);
    if (!target) return;
    if (!canManageUser(currentPermUid)){
        toastMsg('❌ আপনার এই ইউজারকে সরানোর অনুমতি নেই');
        return;
    }
    if (!confirm(`${target.name} কে রুম থেকে সরিয়ে দেবেন?`)) return;

    const banned2 = ((getRoomInfo(ROOM_ID) || {}).bannedUsers || []).filter(x => x !== currentPermUid); banned2.push(currentPermUid);
    saveRoomInfo(ROOM_ID, { bannedUsers: banned2 });
    state.listeners = state.listeners.filter(u => u.uid !== currentPermUid);
    ls_set(KEY.listeners, state.listeners);

    const seatIdx = state.seats.findIndex(s => s && s.uid === currentPermUid);
    if (seatIdx > -1) state.seats[seatIdx] = null;
    ls_set(KEY.seats, state.seats);

    renderListeners();
    renderMembers();
    renderSeats();
    toastMsg(`🚪 ${target.name} কে সরানো হয়েছে`);
    currentPermUid = null;
    closePermissionSheet();
};

/* ═══ Permission sheet এ ⓘ চাপলে profile ═══ */
window.openCurrentProfileFromSheet = () => {
    if (!currentPermUid) return;
    const uid = currentPermUid;
    closePermissionSheet();
    setTimeout(() => openUserProfile(uid), 180);
};

window.canManageUser = canManageUser;

/* ═══ Mic নেওয়া / ছাড়া / লক / আনলক ═══ */
function takeMic(i){
    if (!myProfile) return;
    if (myProfile.isGuest){ toastMsg('গেস্ট মাইকে উঠতে পারে না — লগইন করুন'); closeSheet(); return; }
    const prev = state.seats[i];
    if (prev && prev.uid && prev.uid !== myProfile.uid){ toastMsg('সিটটি আগে থেকেই নেওয়া'); closeSheet(); return; }
    if (prev && prev.locked && !isAdminOrOwner()){
        toastMsg('সিটটি লক করা 🔒');
        closeSheet();
        return;
    }
    const old = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (old > -1 && old !== i) state.seats[old] = null;
    state.seats[i] = {
        uid: myProfile.uid, name: myProfile.name, avatar: myProfile.avatar,
        role: getMyRole(), mic: true, locked: false,
        coins: (prev && prev.coins) || 0,
        started: Date.now()
    };
    ls_set(KEY.seats, state.seats);
    armSeatDisconnect(i);
    renderSeats();
    updateMicButton();
    logActivity('takeMic', i);
    closeSheet();
}

function leaveMic(i){
    if (!state.seats[i] || state.seats[i].uid !== myProfile.uid) return;
    state.seats[i] = null;
    ls_set(KEY.seats, state.seats);
    armSeatDisconnect(null);
    renderSeats();
    updateMicButton();
    logActivity('leaveMic', i);
    closeSheet();
}

function lockMic(i){
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin পারবে');
        closeSheet();
        return;
    }
    const s = state.seats[i];
    if (!s) state.seats[i] = { locked:true, by:myProfile.name };
    else state.seats[i].locked = true;
    ls_set(KEY.seats, state.seats);
    renderSeats();
    logActivity('lockMic', i);
    closeSheet();
}

function unlockMic(i){
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin পারবে');
        closeSheet();
        return;
    }
    const s = state.seats[i];
    if (!s || !s.locked) return;
    if (s.uid) state.seats[i].locked = false;
    else state.seats[i] = null;
    ls_set(KEY.seats, state.seats);
    renderSeats();
    logActivity('unlockMic', i);
    closeSheet();
}

/* ═══ Mic toggle (bottom bar) ═══ */
window.toggleMyMicFromBar = () => {
    if (!myProfile) return;
    const idx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (idx === -1){
        toastMsg('আগে একটা সিটে উঠুন 🎤');
        return;
    }
    const on = !state.seats[idx].mic;
    state.seats[idx].mic = on;
    ls_set(KEY.seats, state.seats);
    renderSeats();
    updateMicButton();
    logActivity(on ? 'unmute' : 'mute', idx);
    toastMsg(on ? 'আনমিউট 🔊' : 'মিউট 🔇');
};

/* ═══ Seat sheet (সিটে ট্যাপ) ═══ */
window.openSeatSheet = (i) => {
    if (!myProfile) return;
    const s = state.seats[i];
    let title, options;

    if (!s){
        title = `Seat #${i + 1}`;
        options = [
            { icon:'fa-microphone-lines', label:'Take the mic', action:()=>takeMic(i) },
            { icon:'fa-user-plus', label:'Invite speakers', action:()=>{ closeSheet(); toggleListenersModal(); } }
        ];
        if (isAdminOrOwner()) options.push({ icon:'fa-lock', label:'Lock the mic', cls:'gold', action:()=>lockMic(i) });
        showSheetOptions(title, options);
    }
    else if (s.locked && !s.uid){
        title = `Seat #${i + 1} (Locked)`;
        options = [{ icon:'fa-microphone-lines', label:'Take the mic', action:()=>takeMic(i) }];
        if (isAdminOrOwner()) options.push({ icon:'fa-lock-open', label:'Unlock the mic', cls:'green', action:()=>unlockMic(i) });
        showSheetOptions(title, options);
    }
    else if (s.uid === myProfile.uid){
        title = 'My Seat';
        options = [
            { icon:'fa-user', label:'View profile', action:()=>{ closeSheet(); setTimeout(()=>openUserProfile(myProfile.uid), 120); } },
            { icon:'fa-gift', label:'Send gift (self)', cls:'purple', action:()=>{ closeSheet(); setTimeout(()=>openGiftSheet(myProfile.uid, myProfile.name), 180); } },
            { icon:'fa-microphone-slash', label:'Leave the mic', danger:true, action:()=>leaveMic(i) }
        ];
        showSheetOptions(title, options);
    }
    else {
        /* অন্যের সিট — সরাসরি profile */
        closeSheet();
        setTimeout(()=>openUserProfile(s.uid), 120);
    }
};

/* ═══ Profile খোলা ═══ */
window.openUserProfile = (uid) => {
    const u = state.listeners.find(x => x.uid === uid);
    if (!u){
        toastMsg('ইউজার পাওয়া যায়নি');
        return;
    }
    currentProfileUid = uid;
    const me = myProfile && u.uid === myProfile.uid;
    const r = me ? (state.myRole || 'member') : getRoleOf(u.uid);

    $('profileCover').src = u.avatar || GUEST_AVATAR;
    $('profileAvatar').src = u.avatar || GUEST_AVATAR;
    $('profileAvatar').className = 'profile-avatar ' + roleBorderClass(r);

    let n = esc(u.name);
    if (r === 'owner') n += ' <i class="fa-solid fa-crown owner-crown"></i>';
    else if (r === 'admin') n += ' <i class="fa-solid fa-shield-halved admin-shield"></i>';
    if (window.MOI && MOI.identityHTML) n += ' ' + MOI.identityHTML(getUser(uid));
    $('profileName').innerHTML = n;
    $('profileUid').innerHTML = `<i class="fa-solid fa-id-badge" style="font-size:11px"></i> UID: ${esc(u.moiId || (getUser(uid) || {}).moiId || u.uid.slice(0, 12))}`;

    /* Follow counts */
    try {
        const followers = ls_get(`moi_follow_${uid}_followers`, []) || [];
        currentFollowersCount = followers.length;
        const following = ls_get(`moi_follow_${uid}_following`, []) || [];
        $('profileFollowers').textContent = currentFollowersCount;
        $('profileFollowing').textContent = following.length;
    } catch(e){
        currentFollowersCount = 0;
        $('profileFollowers').textContent = '0';
        $('profileFollowing').textContent = '0';
    }
    currentFollowingSet = new Set(ls_get(`moi_follow_${myProfile ? myProfile.uid : '_'}_following`, []) || []);

    /* Follow/Message buttons */
    const followBtn = $('profileFollowBtn');
    const chatBtn = document.querySelector('.profile-btn.chat-btn');
    if (me){
        followBtn.style.display = 'none';
        chatBtn.style.display = 'none';
    } else {
        followBtn.style.display = '';
        chatBtn.style.display = '';
        updateFollowBtn(uid);
    }

    /* Bottom bar — hierarchy */
    const canMod = canManageUser(uid) && !me;
    const muteBtn = $('pbarMute'), leaveBtn = $('pbarLeave'), kickBtn = $('pbarKick');
    const sep1 = $('pbarSep1'), sep2 = $('pbarSep2');

    if (!canMod){
        muteBtn.style.display = 'none';
        leaveBtn.style.display = 'none';
        kickBtn.style.display = 'none';
        if (sep1) sep1.style.display = 'none';
        if (sep2) sep2.style.display = 'none';
    } else {
        muteBtn.style.display = 'flex';
        leaveBtn.style.display = 'flex';
        if (sep1) sep1.style.display = 'block';
        if (isOwner()){
            kickBtn.style.display = 'flex';
            if (sep2) sep2.style.display = 'block';
        } else {
            kickBtn.style.display = 'none';
            if (sep2) sep2.style.display = 'none';
        }
    }

    $('userProfileModal').classList.add('active');
    setTimeout(refreshAllRings, 50);
};

window.closeUserProfile = () => {
    $('userProfileModal').classList.remove('active');
    currentProfileUid = null;
    setTimeout(refreshAllRings, 50);
};

/* ═══ Chat / Gift button (profile) ═══ */
window.profileChat = () => {
    closeUserProfile();
    setTimeout(()=>openChatSheet(), 200);
};

window.profileChatNow = () => {
    if (!currentProfileUid) return;
    const uid = currentProfileUid;
    const u = state.listeners.find(x => x.uid === uid);
    const name = u ? u.name : 'User';
    closeUserProfile();
    setTimeout(() => openChatSheet(uid, name), 200);
};

window.profileGift = () => {
    closeUserProfile();
    setTimeout(()=>openGiftPicker(), 200);
};

window.profileGiftCurrent = () => {
    if (!currentProfileUid) return;
    const u = state.listeners.find(x => x.uid === currentProfileUid);
    if (!u) return;
    if (myProfile && u.uid === myProfile.uid){
        toastMsg('নিজেকে গিফট পাঠানো যাবে না');
        return;
    }
    closeUserProfile();
    setTimeout(() => openGiftSheet(u.uid, u.name), 220);
};

/* ═══ Profile actions (Mute / Leave / Kick) ═══ */
window.profileMute = () => {
    if (!currentProfileUid) return;
    if (!canManageUser(currentProfileUid)){
        toastMsg('❌ আপনার অনুমতি নেই');
        return;
    }
    const seatIdx = state.seats.findIndex(s => s && s.uid === currentProfileUid);
    if (seatIdx === -1){
        toastMsg('ইউজার মাইকে নেই');
        return;
    }
    const targetName = state.seats[seatIdx].name || 'User';
    state.seats[seatIdx].mic = !state.seats[seatIdx].mic;
    ls_set(KEY.seats, state.seats);
    renderSeats();
    toastMsg(state.seats[seatIdx].mic ? `${targetName} আনমিউট 🔊` : `${targetName} মিউট 🔇`);
    logActivity(state.seats[seatIdx].mic ? 'unmute' : 'mute', seatIdx, { target: targetName });
};

window.profileLeave = () => {
    if (!currentProfileUid) return;
    if (!canManageUser(currentProfileUid)){
        toastMsg('❌ আপনার অনুমতি নেই');
        return;
    }
    const seatIdx = state.seats.findIndex(s => s && s.uid === currentProfileUid);
    if (seatIdx === -1){
        toastMsg('ইউজার মাইকে নেই');
        return;
    }
    const targetName = state.seats[seatIdx].name || 'User';
    state.seats[seatIdx] = null;
    ls_set(KEY.seats, state.seats);
    renderSeats();
    toastMsg(`${targetName} কে মাইক থেকে নামানো হয়েছে`);
    logActivity('leaveMic', seatIdx, { target: targetName });
    closeUserProfile();
};

window.profileKick = () => {
    if (!currentProfileUid) return;
    if (!isOwner()){
        toastMsg('শুধু Owner কিক করতে পারবে');
        return;
    }
    if (!canManageUser(currentProfileUid)){
        toastMsg('❌ আপনার অনুমতি নেই');
        return;
    }
    const u = state.listeners.find(x => x.uid === currentProfileUid);
    if (!u) return;
    const banned = ((getRoomInfo(ROOM_ID) || {}).bannedUsers || []).filter(x => x !== currentProfileUid); banned.push(currentProfileUid);
    saveRoomInfo(ROOM_ID, { bannedUsers: banned });               /* কিক করা ইউজার আর ঢুকতে পারবে না */
    state.listeners = state.listeners.filter(x => x.uid !== currentProfileUid);
    ls_set(KEY.listeners, state.listeners);
    const seatIdx = state.seats.findIndex(s => s && s.uid === currentProfileUid);
    if (seatIdx > -1) state.seats[seatIdx] = null;
    ls_set(KEY.seats, state.seats);
    renderListeners();
    renderMembers();
    renderSeats();
    toastMsg(`👢 ${u.name} কে কিক করা হয়েছে`);
    logActivity('kick', seatIdx > -1 ? seatIdx : null, { target: u.name });
    closeUserProfile();
};

/* ═══ ⋯ বাটনে Options ═══ */
window.openProfileMoreSheet = () => {
    if (!currentProfileUid) return;
    const u = state.listeners.find(x => x.uid === currentProfileUid);
    if (!u) return;
    const isMe = myProfile && u.uid === myProfile.uid;
    const options = [];
    options.push({
        icon:'fa-copy', label:'Copy UID', cls:'cyan',
        action:() => {
            const uidText = u.moiId || u.uid;
            try { if (navigator.clipboard) navigator.clipboard.writeText(uidText); } catch(e){}
            toastMsg('✅ UID কপি হয়েছে: ' + uidText);
            closeSheet();
        }
    });
    if (!isMe && isOwner() && canManageUser(u.uid)){
        options.push({
            icon:'fa-user-minus', label:'Kick from room', danger:true,
            action:() => { closeSheet(); profileKick(); }
        });
    }
    showSheetOptions('Options', options);
};

/* ═══ Follow button ═══ */
function updateFollowBtn(uid){
    const btn = $('profileFollowBtn');
    if (!btn) return;
    const following = currentFollowingSet.has(uid);
    btn.className = 'profile-btn follow-btn' + (following ? ' following' : '');
    btn.innerHTML = following
        ? '<i class="fa-solid fa-check"></i><span>Following</span>'
        : '<i class="fa-solid fa-plus"></i><span>Follow</span>';
}

window.toggleFollowCurrent = () => {
    if (!currentProfileUid) return;
    if (!myProfile){
        toastMsg('লগইন করুন');
        return;
    }
    const isMe = myProfile.uid === currentProfileUid;
    if (isMe) return;

    const targetUid = currentProfileUid;
    const willFollow = !currentFollowingSet.has(targetUid);
    const followKey = `moi_follow_${myProfile.uid}_following`;
    const followersKey = `moi_follow_${targetUid}_followers`;
    let myFollowing = ls_get(followKey, []) || [];
    let theirFollowers = ls_get(followersKey, []) || [];

    if (willFollow){
        if (!myFollowing.includes(targetUid)) myFollowing.push(targetUid);
        if (!theirFollowers.includes(myProfile.uid)) theirFollowers.push(myProfile.uid);
        currentFollowingSet.add(targetUid);
        currentFollowersCount++;
        toastMsg('⭐ Follow করা হয়েছে');
    } else {
        myFollowing = myFollowing.filter(u => u !== targetUid);
        theirFollowers = theirFollowers.filter(u => u !== myProfile.uid);
        currentFollowingSet.delete(targetUid);
        currentFollowersCount = Math.max(0, currentFollowersCount - 1);
        toastMsg('❌ Unfollow করা হয়েছে');
    }
    ls_set(followKey, myFollowing);
    ls_set(followersKey, theirFollowers);
    $('profileFollowers').textContent = currentFollowersCount;
    updateFollowBtn(targetUid);
};

/* ═══ Follow list modal ═══ */
window.openFollowList = (mode) => {
    if (!currentProfileUid) return;
    currentFollowListMode = mode;
    $('flTitle').textContent = mode === 'followers' ? 'Followers' : 'Following';
    $('followListModal').classList.add('active');
    $('flBody').innerHTML = '<div class="fl-empty">Loading...</div>';

    const key = mode === 'followers'
        ? `moi_follow_${currentProfileUid}_followers`
        : `moi_follow_${currentProfileUid}_following`;
    const uids = ls_get(key, []) || [];

    if (!uids.length){
        $('flBody').innerHTML = '<div class="fl-empty">' + (mode === 'followers' ? 'এখনো কেউ Follow করেনি' : 'এখনো কাউকে Follow করা হয়নি') + '</div>';
        return;
    }

    const users = uids.map(uid => {
        const u = state.listeners.find(x => x.uid === uid);
        if (u) return { uid:u.uid, name:u.name || 'User', avatar:u.avatar || GUEST_AVATAR, moiId:u.moiId || '' };
        return { uid, name:'User', avatar:GUEST_AVATAR, moiId:'' };
    });

    const myFollowing = new Set(ls_get(`moi_follow_${myProfile.uid}_following`, []) || []);
    $('flBody').innerHTML = users.map(u => {
        const isMe = myProfile && u.uid === myProfile.uid;
        const following = myFollowing.has(u.uid);
        let btnHtml = '';
        if (!isMe){
            btnHtml = following
                ? `<button class="fl-btn following" onclick="flToggle('${u.uid}',this)">Following</button>`
                : `<button class="fl-btn follow" onclick="flToggle('${u.uid}',this)">Follow</button>`;
        }
        return `<div class="fl-item">
            <img src="${esc(u.avatar)}" onerror="this.src='${GUEST_AVATAR}'">
            <div class="fl-info">
                <div class="fl-name">${esc(u.name)}</div>
                <div class="fl-uid">UID: ${esc(u.moiId || u.uid.slice(0, 10))}</div>
            </div>
            ${btnHtml}
        </div>`;
    }).join('');
};

window.closeFollowList = () => {
    $('followListModal').classList.remove('active');
};

window.flToggle = (targetUid, btn) => {
    if (!myProfile) return;
    const following = btn.classList.contains('following');
    const followKey = `moi_follow_${myProfile.uid}_following`;
    const followersKey = `moi_follow_${targetUid}_followers`;
    let myFollowing = ls_get(followKey, []) || [];
    let theirFollowers = ls_get(followersKey, []) || [];

    if (following){
        myFollowing = myFollowing.filter(u => u !== targetUid);
        theirFollowers = theirFollowers.filter(u => u !== myProfile.uid);
        btn.classList.remove('following');
        btn.classList.add('follow');
        btn.textContent = 'Follow';
    } else {
        if (!myFollowing.includes(targetUid)) myFollowing.push(targetUid);
        if (!theirFollowers.includes(myProfile.uid)) theirFollowers.push(myProfile.uid);
        btn.classList.remove('follow');
        btn.classList.add('following');
        btn.textContent = 'Following';
    }
    ls_set(followKey, myFollowing);
    ls_set(followersKey, theirFollowers);
};

/* ═══ Search clear ═══ */
window.clearSearch = () => {
    const el = $('memberSearch');
    if (el) el.value = '';
    renderMembers();
};

/* ═══ Topic edit ═══ */
window.editTopic = () => {
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin পারবে');
        return;
    }
    const next = prompt('রুমের টপিক:', state.topic || '');
    if (next === null) return;
    state.topic = next.trim().slice(0, 120);
    ls_set(KEY.topic, state.topic);
    renderMessageFeed();
    toastMsg('টপিক আপডেট ✅');
};

/* ═══ Message input ═══ */
window.openMessageInput = () => {
    closeSheet();
    $('sheetBackdrop').classList.add('active');
    $('msgSheet').classList.add('active');
    setTimeout(()=>$('chatInput').focus(), 250);
};

window.sendChatMessage = () => {
    const text = $('chatInput').value.trim();
    if (!text) return;
    $('chatInput').value = '';
    pushMessage({
        uid: myProfile?.uid,
        name: myProfile?.name || 'User',
        avatar: myProfile?.avatar,
        text,
        type:'text'
    });
    closeSheet();
};