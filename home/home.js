/* home/home.js — Home পেজের মূল কাজ (Init, User, Chat) */

console.log('[MOI HOME] LIVE MODE (Firebase)');

/* ═══ লিংক ═══ */
window.LINKS = {
    room      : URLS.room,
    ownerRoom : URLS.room,
    chat      : URLS.chat,
    me        : URLS.me
};

/* ═══ ইউজার স্টেট ═══ */
window.user = { uid:'', name:'User', photo:'', email:'', country:'', voice:'', moiId:'', myRoomUid:'', diamonds:0, role:'user' };
window.userReady = false;

/* ═══ ইউজার সেট করা (Firebase প্রোফাইল থেকে) ═══ */
function initUser(){
    const p = MOIAuth.profile;
    if (!p || !MOIAuth.user){
        document.getElementById('userNameDisplay').textContent = 'Not Logged In';
        document.getElementById('userDisplayId').textContent = 'Please sign in';
        return false;
    }
    Object.assign(window.user, {
        uid: MOIAuth.user.uid, name: p.name || 'User', photo: p.photo || '', email: '',
        country: p.country || '', voice: p.voice || '', moiId: p.moiId || '',
        myRoomUid: p.myRoomUid || '', diamonds: p.diamonds || 0, role: p.role || 'user', isGuest: MOIAuth.isGuest
    });
    window.userReady = true;
    return true;
}

/* ═══ ইউজার রেন্ডার ═══ */
function renderUser(){
    document.getElementById('userNameDisplay').textContent = window.user.name || 'User';
    document.getElementById('userDisplayId').textContent = 'ID: ' + (window.user.moiId || (window.user.uid ? window.user.uid.slice(0,8) : '---'));
    if (window.user.photo) document.getElementById('userAvatar').src = window.user.photo;
}

/* ═══ নতুন ফিচার বাঁধা: bell, level, diamonds, quick-action dots ═══ */
function refreshHomeStats(){
    if (!window.MOI || !MOI.me()) return;
    const li = MOI.levelInfo(), m = MOI.me();
    const lc = document.getElementById('lvlChip'); if (lc) lc.textContent = 'Lv ' + li.level;
    const dv = document.getElementById('diaVal'); if (dv) dv.textContent = MOI.fmt(m.diamonds || 0);
    const d1 = document.getElementById('dotCheckin'); if (d1) d1.style.display = MOI.canCheckin() ? 'block' : 'none';
    const d2 = document.getElementById('dotSpin'); if (d2) d2.style.display = MOI.canSpin() ? 'block' : 'none';
    MOI.refreshBells();
}
function initFeatures(){
    if (!window.MOI) return;
    MOI.bindBell(document.getElementById('bellBtn'));
    const pill = document.getElementById('diaPill');
    if (pill) pill.addEventListener('click', () => { location.href = window.LINKS.me + '#wallet'; });
    ['moi:diamonds','moi:xp','moi:followers'].forEach(ev => window.addEventListener(ev, refreshHomeStats));
    const sheetOv = document.getElementById('mxOverlay');
    document.addEventListener('click', () => setTimeout(refreshHomeStats, 400));
    refreshHomeStats();
}

/* ═══ Nav Active State ঠিক করা ═══ */
function setNavActive(which){
    const room = document.getElementById('navRoom');
    const chat = document.getElementById('navChat');
    const me   = document.getElementById('navMe');
    if (room) room.classList.toggle('active', which === 'room');
    if (chat) chat.classList.toggle('active', which === 'chat');
    if (me)   me.classList.toggle('active', which === 'me');
}

/* ═══ Chat ═══ */
let chatOpen = false;

window.openChat = (targetUid, targetName) => {
    const overlay = document.getElementById('chatOverlay');
    const frame = document.getElementById('chatFrame');
    const loading = document.getElementById('chatLoading');
    loading.classList.remove('hidden');

    let url = window.LINKS.chat;
    if (targetUid){
        const u = new URL(window.LINKS.chat, location.href);
        u.searchParams.set('targetUid', targetUid);
        if (targetName) u.searchParams.set('targetName', targetName);
        url = u.toString();
    }
    frame.src = url;
    frame.onload = () => loading.classList.add('hidden');
    overlay.classList.add('show');
    chatOpen = true;
    document.body.style.overflow = 'hidden';

    setNavActive('chat');
};

window.closeChat = () => {
    document.getElementById('chatOverlay').classList.remove('show');
    chatOpen = false;
    document.body.style.overflow = '';
    setTimeout(() => { document.getElementById('chatFrame').src = 'about:blank'; }, 300);

    setNavActive('room');
};

/* ═══ Bottom Nav ═══ */
function initNav(){
    document.getElementById('navRoom').addEventListener('click', () => {
        if (chatOpen){ closeChat(); return; }
        setNavActive('room');
        window.scrollTo({ top:0, behavior:'smooth' });
    });

    document.getElementById('navChat').addEventListener('click', () => {
        if (chatOpen) closeChat();
        else window.openChat();
    });

    document.getElementById('navMe').addEventListener('click', () => {
        if (chatOpen) closeChat();
        setNavActive('me');
        setTimeout(() => location.href = window.LINKS.me, 120);
    });
}

/* ═══ সব শুরু করা ═══ */
(async () => {
    try {
        const u = await MOIReady;
        if (!u){ location.replace(URLS.login); return; }

        const ok = initUser();
        if (!ok){ renderBannerEmpty(); return; }

        renderUser();
        loadMyRoom();
        initRoomsUI();
        initModal();
        initNav();
        initFeatures();
        /* প্যানেল বাটন এখন Me পেজে */

        setNavActive('room');

        /* লাইভ আপডেট: রুম লিস্ট, প্রোফাইল, শ্রোতার সংখ্যা */
        window.addEventListener('moi:sync', (e) => {
            const k = e.detail && e.detail.key;
            if (k === 'moi_demo_rooms' || k === 'moi_room_counts') renderHotRooms();
            if (k === 'moi_demo_users'){ initUser(); renderUser(); loadMyRoom(); refreshHomeStats(); }
        });
        MOISync.watch('moi_room_counts');

        console.log('%c[MOI HOME] ✅ ready — ' + window.user.name + ' (' + window.user.moiId + ')', 'color:#20e3b2;font-weight:800');
    } catch(err){
        console.error('[INIT] fatal:', err);
        renderBannerEmpty();
    }
})();

/* ভূমিকা অনুযায়ী প্যানেলের শর্টকাট (Developer / Super Admin / Distributor) */
function initPanelLink(){
    const panel = MOIAuth.panelFor(window.user.role);
    if (!panel || document.getElementById('panelLink')) return;
    const b = document.createElement('a');
    b.id = 'panelLink'; b.href = '../' + panel; b.className = 'panel-link';
    b.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ' + (window.user.role === 'developer' ? 'Developer Panel' : window.user.role === 'superadmin' ? 'Admin Panel' : 'Distributor Panel');
    document.body.appendChild(b);
}
