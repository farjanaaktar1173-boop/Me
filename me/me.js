/* me/me.js — Me পেজের মূল কাজ */

console.log('[MOI ME]');

/* ═══ Me স্টেট ═══ */
window.me = { uid:'', name:'User', photo:'', email:'', moiId:'', diamonds:0 };

/* ═══ Init ═══ */
function init(){
    document.getElementById('loadingText').textContent = 'প্রোফাইল লোড হচ্ছে...';

    const stored = getCurrentUser();
    if (!stored || !stored.uid){
        document.getElementById('loadingCover').classList.add('hidden');
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('loginFallback').classList.add('show');
        document.getElementById('profileContent').style.display = 'none';
        return;
    }

    window.me.uid = stored.uid;
    window.me.name = stored.name || 'User';
    window.me.photo = stored.photo || stored.avatar || GUEST_AVATAR;
    window.me.email = stored.email || '';
    window.me.moiId = stored.moiId || '';
    window.me.diamonds = stored.diamonds ?? 0;

    const fresh = getUser(window.me.uid);
    if (fresh){
        window.me.name = fresh.name || window.me.name;
        window.me.photo = fresh.photo || fresh.avatar || window.me.photo;
        window.me.email = fresh.email || window.me.email;
        window.me.moiId = fresh.moiId || window.me.moiId;
        window.me.diamonds = fresh.diamonds ?? window.me.diamonds;
    }

    renderProfile();
    loadFollowCounts();

    document.getElementById('loadingCover').classList.add('hidden');
    document.getElementById('appContainer').style.display = 'block';
}

/* ═══ Logout ═══ */
window.confirmLogout = () => {
    if (!confirm('সাইন আউট করতে চান?')) return;
    (window.MOIAuth ? MOIAuth.signOut() : Promise.resolve()).finally(() => { clearCurrentUser(); location.href = URLS.login; });
};

/* ═══ Toast (icon সহ override) ═══ */
let _meToastTimer;
window.toastMsg = (msg, icon='fa-circle-check') => {
    const t = document.getElementById('toast');
    document.getElementById('toastText').textContent = msg;
    document.getElementById('toastIcon').className = 'fa-solid ' + icon;
    t.classList.add('show');
    clearTimeout(_meToastTimer);
    _meToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
};

/* ═══ মডালের বাইরে চাপলে বন্ধ ═══ */
function initModalBackdrop(){
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) m.classList.remove('show');
        });
    });
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV — Room / Messages / Me
   ═══════════════════════════════════════════════════════════════ */
function initNav(){
    const navRoom = document.getElementById('navRoom');
    const navChat = document.getElementById('navChat');
    const navMe   = document.getElementById('navMe');

    if (navRoom){
        navRoom.addEventListener('click', () => {
            location.href = URLS.home;
        });
    }

    if (navChat){
        navChat.addEventListener('click', () => {
            location.href = URLS.chat;
        });
    }

    if (navMe){
        navMe.addEventListener('click', () => {
            /* ইতিমধ্যে Me পেজেই আছি — কিছু করার নেই */
            navMe.classList.add('active');
        });
    }
}

/* ═══ শুরু ═══ */
(window.MOIReady || Promise.resolve()).then(() => {
    try {
        init();
        if (typeof initCropper === 'function') initCropper();
        if (typeof initNameChange === 'function') initNameChange();
        initModalBackdrop();
        initNav();
        ['moi:diamonds','moi:xp'].forEach(ev => window.addEventListener(ev, () => { const u = window.MOI && MOI.me(); if (u){ window.me.diamonds = u.diamonds; } renderMeExtras(); }));
        window.addEventListener('moi:followers', () => loadFollowCounts());
        window.addEventListener('moi:sync', () => { const u = getUser(window.me.uid); if (u){ window.me.name = u.name || window.me.name; window.me.photo = u.photo || window.me.photo; window.me.diamonds = u.diamonds ?? window.me.diamonds; } });
        document.addEventListener('click', () => setTimeout(renderMeExtras, 350));
        if (location.hash === '#wallet' && window.openWallet) setTimeout(openWallet, 400);
    } catch(err){
        console.error('[Me init error]', err);
        document.getElementById('loadingCover').classList.add('hidden');
        document.getElementById('appContainer').style.display = 'block';
    }
});

setTimeout(() => {
    const lc = document.getElementById('loadingCover');
    if (lc && !lc.classList.contains('hidden')){
        lc.classList.add('hidden');
        document.getElementById('appContainer').style.display = 'block';
    }
}, 8000);

console.log('%c👤 Me page loaded', 'color:#20e3b2;font-weight:bold;font-size:14px');