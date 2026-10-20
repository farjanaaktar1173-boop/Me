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
