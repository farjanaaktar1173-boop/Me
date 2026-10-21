/* shared/core/economy.js — ডায়মন্ড, গিফট, রোল, কেনাকাটা ইত্যাদি সব কাজ এখন অ্যাপের ভিতরেই চলে
   (Cloud Functions / Blaze প্ল্যান লাগে না)। আগের মতোই MOIEco.call('নাম', ডেটা) দিয়ে ডাকা হয়।
   🔒 LOCK-LATER: অ্যাপ শেষ হলে এই কাজগুলো আবার সার্ভারে (Functions) নিয়ে গিয়ে রুলস কড়া করা হবে। */
console.log('[MOI] economy.js loaded (client mode)');

(function(){
    'use strict';
    const FB = window.MOIFB;
    const LIVE = FB && FB.LIVE;
    const FV = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue : null;

    /* ═══ দাম ও সংখ্যার ছক (functions/catalog.js এর সাথে এক) ═══ */
    const C = {
        GIFTS: { diamond: 5, diamond_v2: 1, diamond_v3: 10, cake: 10, rose: 1, kiss: 1, present: 5, treasure: 15, poop: 2 },
        CHAT_GIFTS: { 10: 10, 50: 50, 100: 100, 500: 500, 1000: 1000 },
        FRAMES: { basic: 0, aurora: 500, flame: 1200, ocean: 2000, royal: 3500, galaxy: 6000 },
        CROWNS: {
            crown_gold:     { name: 'Gold Crown',     price: 500,  purchasable: true,  giftable: true,  adminOnly: false },
            royal_red:      { name: 'Royal Red',      price: 600,  purchasable: true,  giftable: true,  adminOnly: false },
            royal_green:    { name: 'Royal Green',    price: 700,  purchasable: true,  giftable: true,  adminOnly: false },
            royal_purple:   { name: 'Royal Purple',   price: 800,  purchasable: true,  giftable: true,  adminOnly: false },
            lion_vip:       { name: 'Lion VIP',       price: 900,  purchasable: true,  giftable: true,  adminOnly: false },
            dragon_vip:     { name: 'Dragon VIP',     price: 1000, purchasable: true,  giftable: true,  adminOnly: false },
            crystal_shield: { name: 'Crystal Shield', price: 1100, purchasable: true,  giftable: true,  adminOnly: false },
            ocean_pearl:    { name: 'Ocean Pearl',    price: 1200, purchasable: true,  giftable: true,  adminOnly: false },
            official:       { name: 'Official Dragon', price: 0,   purchasable: false, giftable: false, adminOnly: true, officialOnly: true }
        },
        BADGES: ['official_host', 'top_gifter', 'verified', 'early_bird', 'moderator'],
        CHECKIN: [20, 30, 40, 60, 80, 100, 250],
        SPIN: { segs: [10, 50, 5, 100, 20, 500, 15, 25], weights: { 5: 30, 10: 24, 15: 15, 20: 12, 25: 9, 50: 6, 100: 3, 500: 1 }, cost: 30 },
        INVITE_BONUS: 200, BAG_DAILY: 25, LUCKY_TAX: 0.05,
        MISSIONS: { login: { dia: 20, xp: 10 }, name: { dia: 30, xp: 15 }, details: { dia: 50, xp: 20 }, friend: { dia: 40, xp: 20 }, follow: { dia: 30, xp: 15 }, rich: { dia: 25, xp: 10 } },
        RANK: { developer: 100, superadmin: 90, distributor: 60, admin: 50, vip: 40, user: 10, guest: 0 }
    };
    C.ROLES = Object.keys(C.RANK);
    const levelFromXp = xp => Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
    const dayKey = ms => new Date((ms === undefined ? Date.now() : ms) + 360 * 60000).toISOString().slice(0, 10);   /* ঢাকা সময় */

    /* ═══ বার্তা ═══ */
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
        const err = new Error(key ? MSG[key] : 'সমস্যা: ' + raw);
        err.code = key || 'ERROR'; err.userMsg = err.message; return err;
    }
    const fail = (code) => { throw new Error(code); };

    /* ═══ হেল্পার ═══ */
    const db = () => FB.db;
    const uidNow = () => { const u = FB.auth.currentUser; if (!u) fail('UNAUTHENTICATED'); return u.uid; };
    const userRef = uid => db().collection('users').doc(uid);
    const stRef = (uid, name) => db().collection('userState/' + uid + '/items').doc(name);
    const stVal = s => (s.exists && s.data().v) || null;
    const rank = role => C.RANK[role] || 0;
    const isStaff = role => rank(role) >= C.RANK.superadmin;
    const rnd = () => Math.random().toString(36).slice(2, 6);
    const cleanName = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 24);
    const okUrl = s => /^https:\/\/[^\s]{4,400}$/.test(String(s || '')) ? String(s) : '';

    async function getUserDoc(uid){
        const s = await userRef(uid).get();
        if (!s.exists) fail('NOT_FOUND');
        return s.data();
    }
    function assertActive(u, opt){
        const banned = u.isBanned && (!u.banExpiresAt || (u.banExpiresAt.toMillis ? u.banExpiresAt.toMillis() : +u.banExpiresAt) > Date.now());
        if (banned) fail('BANNED');
        if (!(opt && opt.allowGuest) && (u.role === 'guest' || u.isGuest)) fail('GUEST_NOT_ALLOWED');
    }
    function addTx(t, o){
        const ref = db().collection('transactions').doc();
        t.set(ref, Object.assign({
            type: 'spend', title: '', fromUid: '', toUid: '', amount: 0, priceBDT: 0, commission: 0,
            paymentMethod: '', paymentRef: '', status: 'completed', note: null, createdAt: FV.serverTimestamp()
        }, o, { participants: [o.fromUid, o.toUid].filter(x => x && x !== 'system') }));
    }
    /* ডায়মন্ড/XP বদল একসাথে (লেভেল-আপ বোনাস সহ) */
    function applyDelta(t, uid, user, o){
        const dia = o.dia || 0, xp = o.xp || 0;
        const newXp = (user.xp || 0) + xp;
        const oldLv = user.level || levelFromXp(user.xp || 0);
        const newLv = Math.max(oldLv, levelFromXp(newXp));
        let bonus = 0;
        for (let L = oldLv + 1; L <= newLv; L++) bonus += L * 25;
        const total = dia + bonus;
        const upd = Object.assign({}, o.extra || {});
        if (xp) upd.xp = newXp;
        if (newLv !== oldLv) upd.level = newLv;
        if (total) upd.diamonds = FV.increment(total);
        if (Object.keys(upd).length) t.update(userRef(uid), upd);
        if (dia) addTx(t, { type: o.txType || 'reward', title: o.title || '', fromUid: dia < 0 ? uid : 'system', toUid: dia < 0 ? 'system' : uid, amount: Math.abs(dia) });
        if (bonus) addTx(t, { type: 'reward', title: 'Level ' + newLv + ' bonus', fromUid: 'system', toUid: uid, amount: bonus });
        return { level: newLv, xp: newXp, bonus, diamonds: (user.diamonds || 0) + total };
    }
    async function notify(uid, n){
        try { await FB.rtdb.ref(LIVE + '/notifications/' + uid).push(Object.assign({ read: false, ts: Date.now() }, n)); } catch(e){}
    }
    async function findUser(idOrUid){
        const k = String(idOrUid || '').trim(); if (!k) fail('INVALID');
        if (/^\d{6,}$/.test(k)){
            const m = await db().collection('moiIds').doc(k).get();
            if (m.exists) return m.data().uid;
        }
        const s = await userRef(k).get();
        if (s.exists) return k;
        fail('NOT_FOUND');
    }
    async function mirrorStaff(uid, role){
        const ref = FB.rtdb.ref(LIVE + '/staff/' + uid);
        if (C.RANK[role] >= C.RANK.superadmin) await ref.set(role); else await ref.remove();
    }

    const H = {};

    /* ═══════════ প্রোফাইল তৈরি (লগইনের পর) ═══════════ */
    H.ensureProfile = async (data, uid) => {
        const isGuest = !!FB.auth.currentUser.isAnonymous;
        return db().runTransaction(async t => {
            const ref = userRef(uid);
            const snap = await t.get(ref);
            if (snap.exists) return { created: false };
            const cRef = db().collection('meta').doc('counters');
            const c = await t.get(cRef);
            const next = ((c.exists && c.data().moiId) || 100000) + 1 + Math.floor(Math.random() * 7);
            const moiId = String(next);
            t.set(cRef, { moiId: next }, { merge: true });
            t.set(db().collection('moiIds').doc(moiId), { uid });
            const name = cleanName(data.name) || (isGuest ? 'Guest ' : 'User ') + moiId.slice(-4);
            t.set(ref, {
                uid, moiId, name,
                photo: okUrl(data.photo) || 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(uid),
                bio: '', country: '', gender: '', birthday: '', voice: '',
                role: isGuest ? 'guest' : 'user', isGuest,
                badges: [], crown: '', ownedCrowns: [], frame: 'basic',
                diamonds: 0, level: 1, xp: 0, giftsSent: 0, giftsReceived: 0,
                myRoomUid: '', myRoomId: '', distributorId: null,
                isBanned: false, banReason: null, banExpiresAt: null,
                profileComplete: false,
                createdAt: FV.serverTimestamp(), lastSeen: FV.serverTimestamp(), lastActiveRoomId: ''
            });
            return { created: true, moiId };
        });
    };

    /* ═══════════ গিফট ═══════════ */
    async function liveEffects(roomId, sender, targets, gift, qty, unit){
        const base = LIVE + '/rooms/' + roomId;
        const ts = Date.now();
        try {
            await FB.rtdb.ref(base + '/liveGifts').push({ senderUid: sender.uid, targetUids: targets.map(x => x.uid), giftId: gift, qty, ts });
            for (const tg of targets){
                const amount = unit * qty;
                await FB.rtdb.ref(base + '/giftStats/' + tg.uid).update({ uid: tg.uid, name: tg.name || 'User', avatar: tg.photo || '' });
                await FB.rtdb.ref(base + '/giftStats/' + tg.uid + '/history').push({ amount, ts });
            }
            const seats = (await FB.rtdb.ref(base + '/seats').get()).val() || {};
            for (const tg of targets){
                const idx = Object.keys(seats).find(i => seats[i] && seats[i].uid === tg.uid);
                if (idx !== undefined) await FB.rtdb.ref(base + '/seats/' + idx + '/coins').transaction(v => (v || 0) + unit * qty);
            }
            const pk = (await FB.rtdb.ref(base + '/pkState').get()).val();
            if (pk && pk.expiresAt > ts && pk.blue && pk.red){
                for (const tg of targets){
                    if (pk.blue.uid === tg.uid) await FB.rtdb.ref(base + '/pkState/blue/score').transaction(v => (v || 0) + unit * qty);
                    if (pk.red.uid === tg.uid)  await FB.rtdb.ref(base + '/pkState/red/score').transaction(v => (v || 0) + unit * qty);
                }
            }
        } catch(e){ console.warn('liveEffects', e.message); }
    }
    H.sendGift = async (data, uid) => {
        const roomId = String(data.roomId || ''), giftId = String(data.giftId || '');
        const qty = Math.floor(Number(data.qty));
        const targetUids = [...new Set((data.targets || []).map(String))].slice(0, 10);
        const unit = C.GIFTS[giftId];
        if (!roomId || unit === undefined || !(qty >= 1 && qty <= 9999) || !targetUids.length) fail('INVALID');
        const total = unit * qty * targetUids.length;
        const roomRef = db().collection('rooms').doc(roomId);
        const res = await db().runTransaction(async t => {
            const sSnap = await t.get(userRef(uid));
            const room = await t.get(roomRef);
            const tSnaps = await Promise.all(targetUids.map(x => t.get(userRef(x))));
            if (!sSnap.exists || !room.exists) fail('NOT_FOUND');
            const s = sSnap.data(); assertActive(s);
            if (tSnaps.some(x => !x.exists)) fail('NOT_FOUND');
            if ((s.diamonds || 0) < total) fail('INSUFFICIENT_DIAMONDS');
            const r = applyDelta(t, uid, s, { dia: -total, xp: Math.floor(total / 2), extra: { giftsSent: FV.increment(total) }, title: 'Gift: ' + giftId + ' ×' + qty, txType: 'gift' });
            tSnaps.forEach(x => t.update(x.ref, { giftsReceived: FV.increment(unit * qty) }));
            t.update(roomRef, { points: FV.increment(total) });
            targetUids.forEach((tu, i) => t.set(db().collection('gifts').doc(), {
                senderUid: uid, senderName: s.name, targetUid: tu, targetName: tSnaps[i].data().name || '', roomId,
                giftId, giftName: giftId, qty, unitPrice: unit, totalAmount: unit * qty, isCrown: false, crownId: null, type: 'gift', createdAt: FV.serverTimestamp()
            }));
            return { sender: s, targets: tSnaps.map(x => x.data()), balance: r.diamonds };
        });
        await liveEffects(roomId, { uid, name: res.sender.name }, res.targets, giftId, qty, unit);
        const names = res.targets.length === 1 ? res.targets[0].name : res.targets.length + ' জন';
        const id = 'g_' + Date.now() + '_' + rnd();
        await roomRef.collection('messages').doc(id).set({
            id, type: 'gift', uid, senderUid: uid, name: res.sender.name, senderName: res.sender.name, avatar: res.sender.photo || '',
            text: '💎 ' + (data.giftName || giftId) + ' × ' + qty + ' → ' + names, giftMeta: { giftId, qty, targetUids }, ts: Date.now(), createdAt: FV.serverTimestamp()
        }).catch(() => {});
        return { ok: true, total, balance: res.balance };
    };
    H.sendChatGift = async (data, uid) => {
        const to = String(data.toUid || ''), amount = Math.floor(Number(data.amount));
        if (!to || to === uid) fail('SELF');
        if (!C.CHAT_GIFTS[amount]) fail('INVALID');
        const r = await db().runTransaction(async t => {
            const sSnap = await t.get(userRef(uid)), tSnap = await t.get(userRef(to));
            if (!sSnap.exists || !tSnap.exists) fail('NOT_FOUND');
            const s = sSnap.data(); assertActive(s);
            if ((s.diamonds || 0) < amount) fail('INSUFFICIENT_DIAMONDS');
            const rr = applyDelta(t, uid, s, { dia: -amount, xp: Math.floor(amount / 5), extra: { giftsSent: FV.increment(amount) }, title: 'Chat gift to ' + (tSnap.data().name || ''), txType: 'gift' });
            t.update(tSnap.ref, { giftsReceived: FV.increment(amount) });
            t.set(db().collection('gifts').doc(), { senderUid: uid, senderName: s.name, targetUid: to, targetName: tSnap.data().name || '', roomId: '', giftId: 'chat_' + amount, giftName: 'Chat gift', qty: 1, unitPrice: amount, totalAmount: amount, isCrown: false, crownId: null, type: 'gift', createdAt: FV.serverTimestamp() });
            return { ok: true, balance: rr.diamonds, toName: tSnap.data().name || '' };
        });
        await notify(to, { icon: '🎁', title: 'আপনি একটি উপহার পেয়েছেন', text: amount + ' 💎 মূল্যের উপহার' });
        const chatId = [uid, to].sort().join('__'), id = 'g_' + Date.now() + '_' + rnd();
        await db().collection('chats').doc(chatId).set({ participants: chatId.split('__'), updatedAt: FV.serverTimestamp() }, { merge: true });
        await db().collection('chats/' + chatId + '/messages').doc(id).set({ id, type: 'gift', content: '🎁 ' + amount + ' 💎', amount, senderUid: uid, senderName: '', time: '', ts: Date.now(), delivered: true, createdAt: FV.serverTimestamp() });
        return r;
    };

    /* ═══════════ Check-in, Spin, মিশন, ব্যাগ, ইনভাইট ═══════════ */
    H.claimCheckin = async (data, uid) => db().runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (!uS.exists) fail('NOT_FOUND');
        const u = uS.data(); assertActive(u);
        const cS = await t.get(stRef(uid, 'checkin'));
        const cur = stVal(cS) || { last: '', streak: 0 };
        const today = dayKey(), yest = dayKey(Date.now() - 86400000);
        if (cur.last === today) fail('ALREADY_CLAIMED');
        const streak = (cur.last === yest ? cur.streak : 0) + 1;
        const reward = C.CHECKIN[(streak - 1) % 7];
        t.set(stRef(uid, 'checkin'), { v: { last: today, streak } });
        const r = applyDelta(t, uid, u, { dia: reward, xp: 20, title: 'Daily check-in' });
        return { reward, streak, balance: r.diamonds };
    });
    function pickPrize(){
        const { weights, segs } = C.SPIN;
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (const v of segs){ r -= weights[v]; if (r <= 0) return v; }
        return 10;
    }
    H.doSpin = async (data, uid) => db().runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (!uS.exists) fail('NOT_FOUND');
        const u = uS.data(); assertActive(u);
        const sS = await t.get(stRef(uid, 'spin'));
        const today = dayKey();
        const free = (stVal(sS) || {}).last !== today;
        if (!free && (u.diamonds || 0) < C.SPIN.cost) fail('INSUFFICIENT_DIAMONDS');
        const prize = pickPrize();
        if (free) t.set(stRef(uid, 'spin'), { v: { last: today } });
        const r = applyDelta(t, uid, u, { dia: prize - (free ? 0 : C.SPIN.cost), xp: 5, title: free ? 'Lucky Spin (free)' : 'Lucky Spin' });
        return { prize, free, balance: r.diamonds };
    });
    async function missionOk(id, uid, u){
        const cnt = async p => (await db().collection(p).limit(1).get()).size;
        switch (id){
            case 'login': return true;
            case 'name': return !!(u.bio && u.bio.trim());
            case 'details': return !!(u.gender && u.birthday && u.country);
            case 'friend': return (await cnt('friends/' + uid + '/list')) > 0;
            case 'follow': return (await cnt('follows/' + uid + '/following')) > 0;
            case 'rich': return (u.diamonds || 0) >= 1000;
            default: return false;
        }
    }
    H.claimMission = async (data, uid) => {
        const id = String(data.id || ''), m = C.MISSIONS[id];
        if (!m) fail('INVALID');
        const name = 'missions_' + dayKey();
        const pre = await userRef(uid).get(); if (!pre.exists) fail('NOT_FOUND');
        if (!(await missionOk(id, uid, pre.data()))) fail('NOT_READY');
        return db().runTransaction(async t => {
            const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
            const mS = await t.get(stRef(uid, name));
            const done = stVal(mS) || {};
            if (done[id]) fail('ALREADY_CLAIMED');
            done[id] = true;
            t.set(stRef(uid, name), { v: done });
            const r = applyDelta(t, uid, u, { dia: m.dia, xp: m.xp, title: 'Mission: ' + id });
            return { dia: m.dia, balance: r.diamonds };
        });
    };
    H.claimBagDaily = async (data, uid) => db().runTransaction(async t => {
        const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
        const bS = await t.get(stRef(uid, 'bag_daily'));
        const today = dayKey();
        if ((stVal(bS) || {}).last === today) fail('ALREADY_CLAIMED');
        t.set(stRef(uid, 'bag_daily'), { v: { last: today } });
        const r = applyDelta(t, uid, u, { dia: C.BAG_DAILY, title: 'Daily bag reward' });
        return { dia: C.BAG_DAILY, balance: r.diamonds };
    });
    H.redeemInvite = async (data, uid) => {
        const code = String(data.code || '').replace(/\D/g, '');
        if (code.length < 4) fail('INVALID');
        const idSnap = await db().collection('moiIds').doc(code).get();
        if (!idSnap.exists) fail('NOT_FOUND');
        const ownerUid = idSnap.data().uid;
        if (ownerUid === uid) fail('SELF');
        return db().runTransaction(async t => {
            const mS = await t.get(userRef(uid)), oS = await t.get(userRef(ownerUid));
            const rS = await t.get(stRef(uid, 'redeemed')), iS = await t.get(stRef(ownerUid, 'invited'));
            if (!mS.exists || !oS.exists) fail('NOT_FOUND');
            const me = mS.data(); assertActive(me);
            if (stVal(rS)) fail('ALREADY_CLAIMED');
            t.set(stRef(uid, 'redeemed'), { v: oS.data().name || 'User' });
            const inv = stVal(iS) || []; inv.push(uid);
            t.set(stRef(ownerUid, 'invited'), { v: inv.slice(-200) });
            const r = applyDelta(t, uid, me, { dia: C.INVITE_BONUS, xp: 10, title: 'Invite bonus' });
            applyDelta(t, ownerUid, oS.data(), { dia: C.INVITE_BONUS, xp: 10, title: 'Invite bonus (friend joined)' });
            return { bonus: C.INVITE_BONUS, owner: oS.data().name || 'User', balance: r.diamonds };
        });
    };

    /* ═══════════ লাকি বক্স ═══════════ */
    async function isRoomStaff(roomId, uid){
        const r = await db().collection('rooms').doc(roomId).get();
        if (!r.exists) return false;
        const d = r.data();
        return d.ownerUid === uid || (d.admins || []).includes(uid);
    }
    H.createLuckyBox = async (data, uid) => {
        const roomId = String(data.roomId || ''), total = Math.floor(Number(data.total)), qty = Math.floor(Number(data.qty)), timer = Math.floor(Number(data.timerMin));
        if (!roomId || !(total >= 10 && total <= 1000000) || !(qty >= 1 && qty <= 100) || ![1, 3, 5, 10].includes(timer)) fail('INVALID');
        if (!(await isRoomStaff(roomId, uid))) fail('PERMISSION_DENIED');
        const tax = Math.floor(total * C.LUCKY_TAX), pool = total - tax;
        const box = await db().runTransaction(async t => {
            const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
            if ((u.diamonds || 0) < total) fail('INSUFFICIENT_DIAMONDS');
            applyDelta(t, uid, u, { dia: -total, title: 'Lucky box', txType: 'spend' });
            return { id: 'lb_' + Date.now() + '_' + rnd(), senderUid: uid, senderName: u.name, senderAvatar: u.photo || '', total, tax, pool, qty, timerMin: timer, startedAt: Date.now(), expiresAt: Date.now() + timer * 60000, createdAt: Date.now() };
        });
        await FB.rtdb.ref(LIVE + '/rooms/' + roomId + '/luckybox/' + box.id).set(box);
        return { ok: true, box };
    };
    H.openLuckyBox = async (data, uid) => {
        const roomId = String(data.roomId || ''), boxId = String(data.boxId || '');
        if (!roomId || !boxId) fail('INVALID');
        const u0 = await userRef(uid).get(); if (!u0.exists) fail('NOT_FOUND'); assertActive(u0.data());
        const ref = FB.rtdb.ref(LIVE + '/rooms/' + roomId + '/luckybox/' + boxId);
        let won = 0;
        const tr = await ref.transaction(box => {
            if (!box) return box;
            box.claimedBy = box.claimedBy ? Object.values(box.claimedBy) : [];
            box.winners = box.winners ? Object.values(box.winners) : [];
            if (Date.now() < box.expiresAt || Date.now() > box.expiresAt + 120000 || box.claimedBy.includes(uid) || box.winners.length >= box.qty || box.senderUid === uid) return undefined;
            box.claimedBy.push(uid);
            const given = box.winners.reduce((s, w) => s + w.amount, 0), left = box.pool - given;
            const slotsLeft = box.qty - box.winners.length;
            let amount = 0;
            if (Math.random() < 0.65 || slotsLeft === 1){
                const min = Math.max(1, Math.floor(box.pool / (box.qty * 3))), max = Math.max(min + 1, Math.floor(box.pool / 2));
                amount = Math.min(left, Math.floor(Math.random() * (max - min + 1)) + min);
                if (slotsLeft === 1) amount = left;
            }
            won = amount;
            if (amount > 0) box.winners.push({ uid, name: '', avatar: '', amount, ts: Date.now() });
            return box;
        });
        if (!tr.committed || !tr.snapshot.val()) fail('NOT_READY');
        if (won > 0){
            await db().runTransaction(async t => {
                const uS = await t.get(userRef(uid));
                applyDelta(t, uid, uS.data(), { dia: won, title: 'Lucky box win' });
            });
            const meDoc = (await userRef(uid).get()).data();
            const snap = (await ref.get()).val() || {};
            const wm = snap.winners || {};
            const key = Object.keys(wm).find(k => wm[k] && wm[k].uid === uid);
            if (key !== undefined) await ref.child('winners').child(key).update({ name: meDoc.name || 'User', avatar: meDoc.photo || '' });
        }
        return { won };
    };

    /* ═══════════ রোল, ব্যান, ডায়মন্ড, ব্যাজ, মুকুট (Developer / Seller) ═══════════ */
    H.setRole = async (data, uid) => {
        const target = await findUser(data.target), role = String(data.role || '');
        if (!C.ROLES.includes(role) || role === 'developer' || role === 'guest') fail('INVALID');
        const me = await getUserDoc(uid); assertActive(me);
        const myRole = me.role;
        if (myRole !== 'developer' && myRole !== 'superadmin') fail('PERMISSION_DENIED');
        const tu = await getUserDoc(target);
        if (tu.role === 'developer') fail('PERMISSION_DENIED');
        if (myRole === 'superadmin'){
            if (!['admin', 'vip', 'user'].includes(role) || rank(tu.role) >= C.RANK.superadmin || tu.role === 'distributor') fail('PERMISSION_DENIED');
        }
        if (tu.isGuest && role !== 'user') fail('GUEST_NOT_ALLOWED');
        await userRef(target).update({ role, isGuest: false });
        await mirrorStaff(target, role);
        await notify(target, { icon: '🛡️', title: 'আপনার রোল বদলেছে', text: 'নতুন রোল: ' + role });
        return { ok: true, role };
    };
    H.banUser = async (data, uid) => {
        const target = await findUser(data.target), hours = Math.max(0, Math.floor(Number(data.hours) || 0));
        const me = await getUserDoc(uid); assertActive(me);
        if (!['developer', 'superadmin'].includes(me.role)) fail('PERMISSION_DENIED');
        const tu = await getUserDoc(target);
        if (target === uid || tu.role === 'developer' || (me.role === 'superadmin' && rank(tu.role) >= C.RANK.superadmin)) fail('PERMISSION_DENIED');
        await userRef(target).update({ isBanned: true, banReason: String(data.reason || '').slice(0, 200), banExpiresAt: hours ? new Date(Date.now() + hours * 3600000) : null });
        return { ok: true };
    };
    H.unbanUser = async (data, uid) => {
        const target = await findUser(data.target);
        const me = await getUserDoc(uid); assertActive(me);
        if (!['developer', 'superadmin'].includes(me.role)) fail('PERMISSION_DENIED');
        await userRef(target).update({ isBanned: false, banReason: null, banExpiresAt: null });
        return { ok: true };
    };
    H.adminAddDiamonds = async (data, uid) => {
        const target = await findUser(data.target), amount = Math.floor(Number(data.amount));
        if (!(Math.abs(amount) >= 1 && Math.abs(amount) <= 100000000)) fail('INVALID');
        const me = await getUserDoc(uid); assertActive(me);
        if (me.role !== 'developer') fail('PERMISSION_DENIED');
        return db().runTransaction(async t => {
            const tS = await t.get(userRef(target)); if (!tS.exists) fail('NOT_FOUND');
            const bal = tS.data().diamonds || 0;
            if (amount < 0 && bal + amount < 0) fail('INSUFFICIENT_DIAMONDS');
            t.update(tS.ref, { diamonds: FV.increment(amount) });
            addTx(t, { type: amount > 0 ? 'reward' : 'refund', title: String(data.note || 'Admin adjustment').slice(0, 80), fromUid: amount > 0 ? 'system' : target, toUid: amount > 0 ? target : 'system', amount: Math.abs(amount), note: 'by ' + uid });
            return { ok: true, balance: bal + amount };
        });
    };
    /* সেলার বিক্রি: সেলারের নিজের ডায়মন্ড কমে, ক্রেতার বাড়ে (Developer এর কমে না) */
    H.distributorTransfer = async (data, uid) => {
        const target = await findUser(data.target), amount = Math.floor(Number(data.amount));
        if (!(amount >= 1 && amount <= 10000000) || target === uid) fail('INVALID');
        const me = await getUserDoc(uid); assertActive(me);
        if (!['developer', 'distributor'].includes(me.role)) fail('PERMISSION_DENIED');
        const priceBDT = Math.max(0, Math.floor(Number(data.priceBDT) || 0));
        const r = await db().runTransaction(async t => {
            const mS = await t.get(userRef(uid)), tS = await t.get(userRef(target));
            if (!tS.exists) fail('NOT_FOUND');
            const buyer = tS.data(); assertActive(buyer);
            if (me.role === 'distributor' && (mS.data().diamonds || 0) < amount) fail('INSUFFICIENT_DIAMONDS');
            if (me.role === 'distributor') t.update(mS.ref, { diamonds: FV.increment(-amount) });
            t.update(tS.ref, { diamonds: FV.increment(amount) });
            addTx(t, { type: 'sell', title: 'Diamond purchase', fromUid: uid, toUid: target, amount, priceBDT, paymentMethod: String(data.method || 'cash').slice(0, 20), paymentRef: String(data.ref || '').slice(0, 60) });
            return { ok: true, toName: buyer.name };
        });
        await notify(target, { icon: '💎', title: 'ডায়মন্ড যোগ হয়েছে', text: amount + ' 💎 পেয়েছেন' });
        return r;
    };
    H.grantBadge = async (data, uid) => {
        const target = await findUser(data.target), badge = String(data.badge || ''), on = data.on !== false;
        if (!C.BADGES.includes(badge)) fail('INVALID');
        const me = await getUserDoc(uid); if (me.role !== 'developer') fail('PERMISSION_DENIED');
        await userRef(target).update({ badges: on ? FV.arrayUnion(badge) : FV.arrayRemove(badge) });
        return { ok: true };
    };
    H.grantCrown = async (data, uid) => {
        const target = await findUser(data.target), id = String(data.id || '');
        if (!C.CROWNS[id] || C.CROWNS[id].officialOnly) fail('INVALID');
        const me = await getUserDoc(uid); if (me.role !== 'developer') fail('PERMISSION_DENIED');
        await userRef(target).update({ ownedCrowns: data.on === false ? FV.arrayRemove(id) : FV.arrayUnion(id) });
        return { ok: true };
    };
    H.lookupUser = async (data, uid) => {
        const me = await getUserDoc(uid);
        if (rank(me.role) < C.RANK.distributor) fail('PERMISSION_DENIED');
        const target = await findUser(data.target);
        const u = await getUserDoc(target);
        return { uid: target, name: u.name, photo: u.photo, moiId: u.moiId, role: u.role, diamonds: u.diamonds || 0, level: u.level || 1, isBanned: !!u.isBanned, badges: u.badges || [], ownedCrowns: u.ownedCrowns || [], country: u.country || '' };
    };

    /* ═══════════ রুম ═══════════ */
    H.createRoom = async (data, uid) => {
        const name = String(data.name || '').replace(/[<>]/g, '').trim().slice(0, 30);
        if (name.length < 2) fail('INVALID');
        const me = await getUserDoc(uid); assertActive(me);
        if (me.myRoomUid) fail('ALREADY_OWNED');
        let id = '';
        for (let i = 0; i < 30; i++){
            const c = String(Math.floor(100000 + Math.random() * 900000));
            if (!(await db().collection('rooms').doc(c).get()).exists){ id = c; break; }
        }
        if (!id) fail('ERROR');
        const logo = /^https:\/\//.test(String(data.logo || '')) ? String(data.logo) : '';
        await db().runTransaction(async t => {
            const uS = await t.get(userRef(uid)); if (uS.data().myRoomUid) fail('ALREADY_OWNED');
            t.set(db().collection('rooms').doc(id), {
                id, name, logo, wallpaper: '', country: String(data.country || 'Unknown').slice(0, 30), language: 'bn',
                ownerUid: uid, ownerName: me.name, ownerAvatar: me.photo || '', owner: { uid, name: me.name, avatar: me.photo || '' },
                admins: [], isLive: true, micSeatCount: 10, topic: '🎧FM 📻➡️SP ✨🎤Room 🎵', tags: [], category: 'chat',
                level: 1, points: 0, pkActive: false, pkId: null, rules: [], createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp()
            });
            t.update(userRef(uid), { myRoomUid: id, myRoomId: id });
        });
        await FB.rtdb.ref(LIVE + '/roomMeta/' + id).set({ owner: uid });
        return { ok: true, id };
    };
    H.deleteRoom = async (data, uid) => {
        const id = String(data.id || ''); const r = await db().collection('rooms').doc(id).get();
        if (!r.exists) fail('NOT_FOUND');
        const me = await getUserDoc(uid);
        if (r.data().ownerUid !== uid && !isStaff(me.role)) fail('PERMISSION_DENIED');
        await db().collection('rooms').doc(id).delete();
        await userRef(r.data().ownerUid).update({ myRoomUid: '', myRoomId: '' }).catch(() => {});
        await FB.rtdb.ref(LIVE + '/rooms/' + id).remove(); await FB.rtdb.ref(LIVE + '/roomMeta/' + id).remove();
        return { ok: true };
    };
    H.setRoomAdmin = async (data, uid) => {
        const id = String(data.roomId || ''), target = String(data.uid || ''), on = data.on !== false;
        const rRef = db().collection('rooms').doc(id); const r = await rRef.get();
        if (!r.exists || !target) fail('NOT_FOUND');
        const me = await getUserDoc(uid); assertActive(me);
        if (r.data().ownerUid !== uid && !isStaff(me.role)) fail('PERMISSION_DENIED');
        if (target === r.data().ownerUid) fail('SELF');
        await rRef.update({ admins: on ? FV.arrayUnion(target) : FV.arrayRemove(target) });
        await FB.rtdb.ref(LIVE + '/roomMeta/' + id + '/admins/' + target).set(on ? true : null);
        return { ok: true };
    };

    /* ═══════════ স্টোর: ফ্রেম ও মুকুট ═══════════ */
    H.buyFrame = async (data, uid) => {
        const id = String(data.id || ''), price = C.FRAMES[id];
        if (price === undefined) fail('INVALID');
        return db().runTransaction(async t => {
            const uS = await t.get(userRef(uid)); if (!uS.exists) fail('NOT_FOUND');
            const u = uS.data(); assertActive(u);
            const fS = await t.get(stRef(uid, 'frames'));
            const fs = (fS.exists && fS.data().v) || { owned: ['basic'], equipped: 'basic' };
            let bought = false;
            if (!fs.owned.includes(id)){
                if ((u.diamonds || 0) < price) fail('INSUFFICIENT_DIAMONDS');
                fs.owned.push(id); bought = true;
            }
            fs.equipped = id;
            t.set(stRef(uid, 'frames'), { v: fs });
            let balance = u.diamonds || 0;
            if (bought) balance = applyDelta(t, uid, u, { dia: -price, xp: 10, extra: { frame: id }, title: 'Store: ' + id + ' frame', txType: 'spend' }).diamonds;
            else t.update(userRef(uid), { frame: id });
            return { bought, balance, state: fs };
        });
    };
    H.buyCrown = async (data, uid) => {
        const id = String(data.id || ''), c = C.CROWNS[id];
        if (!c || !c.purchasable || c.adminOnly) fail('INVALID');
        return db().runTransaction(async t => {
            const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
            if ((u.ownedCrowns || []).includes(id)) fail('ALREADY_OWNED');
            if ((u.diamonds || 0) < c.price) fail('INSUFFICIENT_DIAMONDS');
            const r = applyDelta(t, uid, u, { dia: -c.price, xp: Math.floor(c.price / 100), extra: { ownedCrowns: FV.arrayUnion(id) }, title: 'Crown: ' + c.name, txType: 'spend' });
            return { balance: r.diamonds };
        });
    };
    H.equipCrown = async (data, uid) => {
        const id = String(data.id || '');
        const u = await userRef(uid).get(); if (!u.exists) fail('NOT_FOUND');
        const d = u.data(); assertActive(d);
        const isDev = d.role === 'developer';
        if (id === 'official'){ if (!isDev) fail('PERMISSION_DENIED'); }
        else if (id){ if (!C.CROWNS[id] || !(d.ownedCrowns || []).includes(id)) fail('PERMISSION_DENIED'); }
        const val = id || (isDev ? 'none' : '');
        await userRef(uid).update({ crown: val });
        return { ok: true, crown: val };
    };
    H.sendCrown = async (data, uid) => {
        const id = String(data.id || ''), to = String(data.toUid || ''), c = C.CROWNS[id];
        if (!c || !c.giftable || c.adminOnly || !to || to === uid) fail('INVALID');
        const r = await db().runTransaction(async t => {
            const sS = await t.get(userRef(uid)), tS = await t.get(userRef(to));
            if (!sS.exists || !tS.exists) fail('NOT_FOUND');
            const s = sS.data(); assertActive(s);
            if ((tS.data().ownedCrowns || []).includes(id)) fail('ALREADY_OWNED');
            if ((s.diamonds || 0) < c.price) fail('INSUFFICIENT_DIAMONDS');
            const rr = applyDelta(t, uid, s, { dia: -c.price, xp: Math.floor(c.price / 100), title: 'Crown gift: ' + c.name, txType: 'gift' });
            t.update(tS.ref, { ownedCrowns: FV.arrayUnion(id) });
            t.set(db().collection('gifts').doc(), { senderUid: uid, senderName: s.name, targetUid: to, targetName: tS.data().name || '', roomId: '', giftId: 'crown_' + id, giftName: c.name, qty: 1, unitPrice: c.price, totalAmount: c.price, isCrown: true, crownId: id, type: 'crown', createdAt: FV.serverTimestamp() });
            return { balance: rr.diamonds };
        });
        await notify(to, { icon: '👑', title: 'আপনি মুকুট উপহার পেয়েছেন', text: c.name });
        return r;
    };

    /* ═══════════ আগের মতোই MOIEco.call / MOIEco.try ═══════════ */
    const MOIEco = {
        async call(name, data){
            if (!FB || !FB.db) throw friendly({ message: 'Firebase চালু নেই' });
            const fn = H[name]; if (!fn) throw friendly({ message: 'INVALID' });
            try { return await fn(data || {}, uidNow()); }
            catch(e){ console.warn('[eco]', name, e); throw friendly(e); }
        },
        async try(name, data, failToast){
            try { return await this.call(name, data); }
            catch(e){ if (failToast !== false){ (window.MOI && MOI.toast ? MOI.toast(e.userMsg, '⚠️') : (window.toastMsg && toastMsg(e.userMsg))); } return null; }
        }
    };
    window.MOIEco = MOIEco;
})();
