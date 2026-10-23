/* home/home.js — Home পেজের মূল কাজ (Init, User, Chat, Nav, ট্যাব) */

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

/* ═══ আইকন বসানো (home/icons.js থেকে) ═══ */
function setupIcons(){
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('logoIc', HIC.logo);
    set('diaIc', HIC.gem);
    set('searchToggle', HIC.search);
    set('bellBtn', HIC.bell);
    set('segRooms', HIC.live + 'লাইভ রুম');
    set('segExplore', HIC.compass + 'আবিষ্কার');
    set('btnShuffle', HIC.shuffle);
    set('navRoom', HIC.room + '<span>রুম</span>');
    set('navChat', HIC.chat + '<em id="chatBadge">0</em><span>মেসেজ</span>');
    set('navMe', HIC.user + '<span>আমি</span>');
}
setupIcons();

/* ═══ ইউজার সেট করা (Firebase প্রোফাইল থেকে) ═══ */
function initUser(){
    const p = MOIAuth.profile;
    if (!p || !MOIAuth.user) return false;
    Object.assign(window.user, {
        uid: MOIAuth.user.uid, name: p.name || 'User', photo: p.photo || '', email: '',
        country: p.country || '', voice: p.voice || '', moiId: p.moiId || '',
        myRoomUid: p.myRoomUid || '', diamonds: p.diamonds || 0, role: p.role || 'user', isGuest: MOIAuth.isGuest
    });
    window.userReady = true;
    return true;
}

/* ═══ ইউজার রেন্ডার (উপরের গোল প্রোফাইল ছবি) ═══ */
function renderUser(){
    const ring = document.getElementById('btnProfile');
    const img = document.getElementById('userAvatar');
    const init = document.getElementById('meInit');
    if (init) init.textContent = ((window.user.name || 'U').trim()[0] || 'U').toUpperCase();
    if (img && window.user.photo){
        img.src = window.user.photo;
        if (ring) ring.classList.add('has');
    } else if (ring) ring.classList.remove('has');
}

/* ═══ বেল, ডায়মন্ড, কুইক-অ্যাকশন ডট ═══ */
function refreshHomeStats(){
    if (!window.MOI || !MOI.me()) return;
    const m = MOI.me();
    const dv = document.getElementById('diaVal'); if (dv) dv.textContent = MOI.fmt(m.diamonds || 0);
    refreshQuickDots();
    MOI.refreshBells();
}
function initFeatures(){
    initQuickActions();
    if (!window.MOI) return;
    MOI.bindBell(document.getElementById('bellBtn'));
    const pill = document.getElementById('diaPill');
    if (pill) pill.addEventListener('click', () => { location.href = window.LINKS.me + '#wallet'; });
    ['moi:diamonds','moi:xp','moi:followers'].forEach(ev => window.addEventListener(ev, refreshHomeStats));
    document.addEventListener('click', () => setTimeout(refreshHomeStats, 400));
    refreshHomeStats();
}

/* ═══ Nav Active State ═══ */
function setNavActive(which){
    const room = document.getElementById('navRoom');
    const chat = document.getElementById('navChat');
    const me   = document.getElementById('navMe');
    if (room) room.classList.toggle('on', which === 'room');
    if (chat) chat.classList.toggle('on', which === 'chat');
    if (me)   me.classList.toggle('on', which === 'me');
}

/* ═══ উপরের ট্যাব: লাইভ রুম / আবিষ্কার ═══ */
function showView(which){
    document.getElementById('v-home').hidden = which !== 'rooms';
    document.getElementById('v-explore').hidden = which !== 'explore';
    document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === which));
}
function initTabs(){
    document.getElementById('seg').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        showView(b.dataset.t);
        window.scrollTo({ top:0 });
    });
    document.getElementById('btnProfile').addEventListener('click', () => { location.href = window.LINKS.me; });
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
        showView('rooms');
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
        if (!ok){ return; }

        renderUser();
        initTabs();
        initMyRail();
        initRoomsUI();
        renderMyRail();
        initModal();
        initNav();
        initFeatures();
        /* প্যানেল বাটন এখন Me পেজে */

        setNavActive('room');

        /* লাইভ আপডেট: রুম লিস্ট, প্রোফাইল, শ্রোতার সংখ্যা, রুমে কে কে আছে */
        window.addEventListener('moi:sync', (e) => {
            const k = e.detail && e.detail.key;
            if (k === 'moi_demo_rooms' || k === 'moi_room_counts' || k === 'moi_room_users'){ renderHotRooms(); renderMyRail(); }
            if (k === 'moi_demo_users'){ initUser(); renderUser(); renderHotRooms(); renderMyRail(); refreshHomeStats(); }
        });
        MOISync.watch('moi_room_counts');
        MOISync.watch('moi_room_users');

        console.log('%c[MOI HOME] ✅ ready — ' + window.user.name + ' (' + window.user.moiId + ')', 'color:#20e3b2;font-weight:800');
    } catch(err){
        console.error('[INIT] fatal:', err);
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
