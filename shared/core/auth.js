/* shared/core/auth.js — লগইন/লগআউট/বর্তমান ইউজার (Firebase Authentication)
   ▸ Phone OTP  ▸ Google  ▸ Guest (Anonymous)
   লগইন সফল হলে: users/{uid} ডক নিশ্চিত → লাইভ সিঙ্ক চালু → রোল অনুযায়ী পেজ */
console.log('[MOI] auth.js loaded');

(function(){
    'use strict';
    const FB = window.MOIFB, S = window.MOISync;
    const LIVE = FB && FB.LIVE;
    const LOGIN_URL = new URL('../../login/index.html', (document.currentScript && document.currentScript.src) || location.href).href;
    const readUser = () => { try { return JSON.parse(localStorage.getItem('moi_user')) || null; } catch(e){ return null; } };
    const putUser = u => { try { localStorage.setItem('moi_user', JSON.stringify(u)); } catch(e){} };
    const dropUser = () => { try { localStorage.removeItem('moi_user'); } catch(e){} };
    const PANEL = { developer: 'admin/developer/index.html', superadmin: 'admin/superadmin/index.html', distributor: 'admin/distributor/index.html' };

    let boot = null, bootUid = undefined, lastDia = null, lastXp = null, presenceStarted = false;
    let resolveFirst; const first = new Promise(r => { resolveFirst = r; });
    const profileOf = uid => ((S && S.peek('moi_demo_users')) || {})[uid] || null;

    function writeSession(p, fbUser){
        if (!p) return;
        const cur = readUser() || {};
        putUser(Object.assign({}, cur, {
            uid: p.uid || fbUser.uid, name: p.name || 'User', photo: p.photo || '', email: '',
            country: p.country || '', voice: p.voice || '', moiId: p.moiId || '',
            role: p.role || 'user', diamonds: p.diamonds || 0, isGuest: !!fbUser.isAnonymous || p.role === 'guest',
            myRoomUid: p.myRoomUid || ''
        }));
    }

    function startPresence(uid){
        if (presenceStarted) return; presenceStarted = true;
        const ref = FB.rtdb.ref(LIVE + '/presence/' + uid);
        FB.rtdb.ref('.info/connected').on('value', s => {
            if (s.val() !== true) return;
            ref.onDisconnect().update({ online: false, lastSeen: FB.RTS() });
            ref.update({ online: true, lastSeen: FB.RTS() });
        });
        const tick = () => FB.db.collection('users').doc(uid).update({ lastSeen: FB.TS() }).catch(() => {});
        tick(); setInterval(tick, 120000);
    }

    function bootstrap(u){
        const id = u ? u.uid : null;
        if (boot && bootUid === id) return boot;
        bootUid = id; boot = doBootstrap(u);
        return boot;
    }
    async function doBootstrap(u){
        if (!u){
            S.stop(); presenceStarted = false; lastDia = lastXp = null;
            dropUser();
            resolveFirst(null); return null;
        }
        /* ১) প্রোফাইল ডক আছে কিনা — না থাকলে সার্ভার বানাবে (moiId সহ) */
        let snap = null;
        try { snap = await FB.db.collection('users').doc(u.uid).get(); } catch(e){}
        if (!snap || !snap.exists){
            await MOIEco.call('ensureProfile', { name: u.displayName || '', photo: u.photoURL || '' });
        }
        /* ২) লাইভ সিঙ্ক চালু */
        await S.start(u.uid, ['moi_demo_users', 'moi_demo_rooms']);
        S.startKV();
        const p = profileOf(u.uid);
        if (p && p.isBanned){ await MOIAuth.signOut(true); throw Object.assign(new Error('BANNED'), { code: 'BANNED', profile: p }); }
        writeSession(p, u);
        if (p){ lastDia = p.diamonds; lastXp = p.xp; }
        startPresence(u.uid);
        S.watch('moi_notifs_' + u.uid);
        resolveFirst(u);
        return p;
    }

    /* ইউজার ডক বদলালে সেশন ও UI আপডেট */
    window.addEventListener('moi:sync', e => {
        if (!e.detail || e.detail.key !== 'moi_demo_users') return;
        const u = FB.auth.currentUser; if (!u) return;
        const p = profileOf(u.uid); if (!p) return;
        if (p.isBanned){ MOIAuth.signOut(true); return; }
        writeSession(p, u);
        if (lastDia !== null && p.diamonds !== lastDia){ lastDia = p.diamonds; window.dispatchEvent(new CustomEvent('moi:diamonds', { detail: { balance: p.diamonds } })); }
        if (lastXp !== null && p.xp !== lastXp){ lastXp = p.xp; window.dispatchEvent(new CustomEvent('moi:xp')); }
    });

    const MOIAuth = {
        ready: first,                                  /* প্রথম অবস্থা জানা গেলে (ইউজার বা null) */
        get user(){ return FB && FB.auth.currentUser; },
        get profile(){ return this.user ? profileOf(this.user.uid) : null; },
        get role(){ const p = this.profile; return (p && p.role) || (this.user && this.user.isAnonymous ? 'guest' : 'user'); },
        get isGuest(){ return !this.user || this.user.isAnonymous || this.role === 'guest'; },
        panelFor: role => PANEL[role] || null,
        /* লগইন সম্পন্ন হয়ে প্রোফাইল লোড না হওয়া পর্যন্ত অপেক্ষা */
        async whenReady(){
            const u = FB.auth.currentUser; if (!u) return null;
            return bootstrap(u);
        },
        /* পেজ গার্ড: লগইন না থাকলে লগইনে পাঠায় */
        async require(){
            const u = await first;
            if (!u){ location.replace(LOGIN_URL); return new Promise(() => {}); }
            return u;
        },
        async google(){
            const prov = new firebase.auth.GoogleAuthProvider();
            try { await FB.auth.signInWithPopup(prov); }
            catch(e){
                if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment'){ await FB.auth.signInWithRedirect(prov); return; }
                throw e;
            }
            return this.whenReady();
        },
        async guest(){ await FB.auth.signInAnonymously(); return this.whenReady(); },
        /* Phone OTP: ১) phoneStart  ২) phoneConfirm */
        async phoneStart(e164, containerId){
            if (this._verifier){ try { this._verifier.clear(); } catch(e){} }
            this._verifier = new firebase.auth.RecaptchaVerifier(containerId, { size: 'invisible' });
            this._confirm = await FB.auth.signInWithPhoneNumber(e164, this._verifier);
            return true;
        },
        async phoneConfirm(code){
            if (!this._confirm) throw new Error('আগে কোড পাঠান');
            await this._confirm.confirm(code);
            return this.whenReady();
        },
        async signOut(silent){
            try { const u = FB.auth.currentUser; if (u) await FB.rtdb.ref(LIVE + '/presence/' + u.uid).update({ online: false, lastSeen: FB.RTS() }); } catch(e){}
            S.stop(); dropUser();
            await FB.auth.signOut();
            if (!silent) location.href = LOGIN_URL;
        }
    };
    window.MOIAuth = MOIAuth;
    window.MOIReady = first;

    if (FB){
        FB.auth.onAuthStateChanged(u => { bootstrap(u).catch(err => { console.error('[auth] bootstrap', err); resolveFirst(null); }); });
    } else resolveFirst(null);
})();
