/* shared/core/economy.js — সংবেদনশীল কাজ (ডায়মন্ড, গিফট, রোল…) সব Cloud Function-এ।
   ক্লায়েন্ট কখনও নিজে ডায়মন্ড বাড়াতে/কমাতে পারে না — এখান থেকে শুধু সার্ভারকে অনুরোধ যায়। */
console.log('[MOI] economy.js loaded');

(function(){
    'use strict';
    const FB = window.MOIFB;
    const MSG = {
        INSUFFICIENT_DIAMONDS: 'পর্যাপ্ত ডায়মন্ড নেই',
        ALREADY_CLAIMED: 'আজ নেওয়া হয়ে গেছে',
        GUEST_NOT_ALLOWED: 'গেস্ট এই কাজ করতে পারে না — লগইন করুন',
        PERMISSION_DENIED: 'আপনার এই কাজের অনুমতি নেই',
        NOT_FOUND: 'খুঁজে পাওয়া যায়নি',
        BANNED: 'এই অ্যাকাউন্ট নিষিদ্ধ',
        INVALID: 'ভুল অনুরোধ',
        ALREADY_OWNED: 'এটি আগেই আপনার কাছে আছে',
        NOT_READY: 'এখনও শর্ত পূরণ হয়নি',
        SELF: 'নিজের সাথে এটা করা যাবে না',
        UNAUTHENTICATED: 'আগে লগইন করুন'
    };
    function friendly(e){
        const raw = (e && (e.message || e.code)) || 'ERROR';
        const key = Object.keys(MSG).find(k => String(raw).toUpperCase().indexOf(k) >= 0
            || String((e && e.code) || '').toUpperCase().replace(/[-/]/g, '_').indexOf(k) >= 0);
        const err = new Error(key ? MSG[key] : 'সার্ভার সমস্যা: ' + raw);
        err.code = key || 'ERROR'; err.userMsg = err.message; return err;
    }
    /* ═══ Cloud Functions (Blaze) ছাড়া চালাতে: কিছু কাজ সরাসরি ক্লায়েন্ট থেকে (Firestore রুল খোলা থাকতে হবে) ═══
       ফাংশন ডিপ্লয় না থাকলে (internal / not-found) তবেই এগুলো চলে।
       ডায়মন্ড-সংক্রান্ত কাজ (গিফট, স্পিন, মিশন, লাকি বক্স…) এখানে নেই — সেগুলো ফাংশন ছাড়া চলবে না। */
    const CLIENT = {
        async createRoom(data){
            const u = FB.auth.currentUser; if (!u) throw friendly({ message: 'UNAUTHENTICATED' });
            const db = FB.db, FV = firebase.firestore.FieldValue, uRef = db.collection('users').doc(u.uid);
            const name = String(data.name || '').replace(/[<>]/g, '').trim().slice(0, 30);
            if (name.length < 2) throw friendly({ message: 'INVALID' });
            const meS = await uRef.get(); if (!meS.exists) throw friendly({ message: 'NOT_FOUND' });
            const me = meS.data();
            if (me.isBanned) throw friendly({ message: 'BANNED' });
            if (me.role === 'guest' || me.isGuest) throw friendly({ message: 'GUEST_NOT_ALLOWED' });
            if (me.myRoomUid) throw friendly({ message: 'ALREADY_OWNED' });
            let id = '';
            for (let i = 0; i < 30; i++){
                const c = String(Math.floor(100000 + Math.random() * 900000));
                if (!(await db.collection('rooms').doc(c).get()).exists){ id = c; break; }
            }
            if (!id) throw friendly({ message: 'ERROR' });
            const logo = /^https:\/\//.test(String(data.logo || '')) ? String(data.logo) : '';
            await db.runTransaction(async t => {
                const uS = await t.get(uRef); if (uS.data().myRoomUid) throw friendly({ message: 'ALREADY_OWNED' });
                t.set(db.collection('rooms').doc(id), {
                    id, name, logo, wallpaper: '', country: String(data.country || 'Unknown').slice(0, 30), language: 'bn',
                    ownerUid: u.uid, ownerName: me.name, ownerAvatar: me.photo || '', owner: { uid: u.uid, name: me.name, avatar: me.photo || '' },
                    admins: [], isLive: true, micSeatCount: 10, topic: '🎧FM 📻➡️SP ✨🎤Room 🎵', tags: [], category: 'chat',
                    level: 1, points: 0, pkActive: false, pkId: null, rules: [], createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp()
                });
                t.update(uRef, { myRoomUid: id, myRoomId: id });
            });
            try { await FB.rtdb.ref(FB.LIVE + '/roomMeta/' + id).set({ owner: u.uid }); } catch(e){ console.warn('[eco] roomMeta', e); }
            return { ok: true, id };
        },
        async deleteRoom(data){
            const u = FB.auth.currentUser; if (!u) throw friendly({ message: 'UNAUTHENTICATED' });
            const db = FB.db, id = String(data.id || '');
            const r = await db.collection('rooms').doc(id).get(); if (!r.exists) throw friendly({ message: 'NOT_FOUND' });
            const me = (await db.collection('users').doc(u.uid).get()).data() || {};
            if (r.data().ownerUid !== u.uid && ['developer', 'superadmin'].indexOf(me.role) < 0) throw friendly({ message: 'PERMISSION_DENIED' });
            await db.collection('rooms').doc(id).delete();
            await db.collection('users').doc(r.data().ownerUid).update({ myRoomUid: '', myRoomId: '' }).catch(() => {});
            try { await FB.rtdb.ref(FB.LIVE + '/rooms/' + id).remove(); await FB.rtdb.ref(FB.LIVE + '/roomMeta/' + id).remove(); } catch(e){}
            return { ok: true };
        },
        async setRoomAdmin(data){
            const u = FB.auth.currentUser; if (!u) throw friendly({ message: 'UNAUTHENTICATED' });
            const db = FB.db, FV = firebase.firestore.FieldValue;
            const id = String(data.roomId || ''), target = String(data.uid || ''), on = data.on !== false;
            const rRef = db.collection('rooms').doc(id), r = await rRef.get();
            if (!r.exists || !target) throw friendly({ message: 'NOT_FOUND' });
            const me = (await db.collection('users').doc(u.uid).get()).data() || {};
            if (r.data().ownerUid !== u.uid && ['developer', 'superadmin'].indexOf(me.role) < 0) throw friendly({ message: 'PERMISSION_DENIED' });
            if (target === r.data().ownerUid) throw friendly({ message: 'SELF' });
            await rRef.update({ admins: on ? FV.arrayUnion(target) : FV.arrayRemove(target) });
            try { await FB.rtdb.ref(FB.LIVE + '/roomMeta/' + id + '/admins/' + target).set(on ? true : null); } catch(e){}
            return { ok: true };
        }
    };
    /* ফাংশন নেই/অচল হলে true (সার্ভারের নিজের লেখা এরর — যেমন ALREADY_OWNED — এখানে পড়ে না) */
    const fnMissing = e => {
        const m = String((e && e.message) || '').toLowerCase();
        return m === 'internal' || m === 'not-found' || m === 'unavailable' || /fetch|network|cors/.test(m);
    };
    const MOIEco = {
        async call(name, data){
            if (!FB) throw friendly({ message: 'Firebase চালু নেই' });
            if (FB.fn){
                try { const r = await FB.fn.httpsCallable(name)(data || {}); return r.data; }
                catch(e){
                    console.warn('[eco]', name, e);
                    if (!(CLIENT[name] && fnMissing(e))) throw friendly(e);
                }
            } else if (!CLIENT[name]) throw friendly({ message: 'Firebase চালু নেই' });
            try { return await CLIENT[name](data || {}); }
            catch(e2){ console.warn('[eco:client]', name, e2); throw (e2 && e2.userMsg) ? e2 : friendly(e2); }
        },
        /* সফল/ব্যর্থ — দুই ক্ষেত্রেই টোস্ট ঠিক রেখে */
        async try(name, data, fail){
            try { return await this.call(name, data); }
            catch(e){ if (fail !== false){ (window.MOI && MOI.toast ? MOI.toast(e.userMsg, '⚠️') : (window.toastMsg && toastMsg(e.userMsg))); } return null; }
        }
    };
    window.MOIEco = MOIEco;
})();
