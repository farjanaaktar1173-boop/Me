/* functions/roles.js — রোল, ব্যান, ডায়মন্ড তৈরি/বিক্রি, ব্যাজ/মুকুট দেওয়া (কড়া নিয়ম) */
'use strict';
const { db, rtdb, FV, LIVE, fail, callable, userRef, getUserDoc, assertActive, rank, addTx, notify, C } = require('./lib/common');

/* ধরন: moiId বা uid যেকোনোটা দিয়ে ইউজার খোঁজা */
async function findUser(idOrUid){
    const k = String(idOrUid || '').trim(); if (!k) fail('invalid-argument', 'INVALID');
    if (/^\d{6,}$/.test(k)){
        const m = await db.collection('moiIds').doc(k).get();
        if (m.exists) return m.data().uid;
    }
    const s = await userRef(k).get();
    if (s.exists) return k;
    fail('not-found', 'NOT_FOUND');
}
async function mirrorStaff(uid, role){
    const ref = rtdb.ref(LIVE + '/staff/' + uid);
    if (C.RANK[role] >= C.RANK.superadmin) await ref.set(role); else await ref.remove();
}

/* ─── রোল দেওয়া ─── developer: যেকোনো (developer ছাড়া) • superadmin: admin/vip/user */
exports.setRole = callable(async (data, uid) => {
    const target = await findUser(data.target); const role = String(data.role || '');
    if (!C.ROLES.includes(role) || role === 'developer' || role === 'guest') fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); assertActive(me);
    const myRole = me.role;
    if (myRole !== 'developer' && myRole !== 'superadmin') fail('permission-denied', 'PERMISSION_DENIED');
    const tu = await getUserDoc(target);
    if (tu.role === 'developer') fail('permission-denied', 'PERMISSION_DENIED');
    if (myRole === 'superadmin'){
        if (!['admin', 'vip', 'user'].includes(role) || rank(tu.role) >= C.RANK.superadmin || tu.role === 'distributor') fail('permission-denied', 'PERMISSION_DENIED');
    }
    if (tu.isGuest && role !== 'user') fail('failed-precondition', 'GUEST_NOT_ALLOWED');
    await userRef(target).update({ role, isGuest: false });
    await mirrorStaff(target, role);
    await notify(target, { icon: '🛡️', title: 'আপনার রোল বদলেছে', text: 'নতুন রোল: ' + role });
    return { ok: true, role };
});

/* ─── ব্যান / আনব্যান ─── developer ও superadmin */
exports.banUser = callable(async (data, uid) => {
    const target = await findUser(data.target); const hours = Math.max(0, Math.floor(Number(data.hours) || 0));
    const me = await getUserDoc(uid); assertActive(me);
    if (!['developer', 'superadmin'].includes(me.role)) fail('permission-denied', 'PERMISSION_DENIED');
    const tu = await getUserDoc(target);
    if (target === uid || tu.role === 'developer' || (me.role === 'superadmin' && rank(tu.role) >= C.RANK.superadmin)) fail('permission-denied', 'PERMISSION_DENIED');
    await userRef(target).update({ isBanned: true, banReason: String(data.reason || '').slice(0, 200), banExpiresAt: hours ? new Date(Date.now() + hours * 3600000) : null });
    return { ok: true };
});
exports.unbanUser = callable(async (data, uid) => {
    const target = await findUser(data.target);
    const me = await getUserDoc(uid); assertActive(me);
    if (!['developer', 'superadmin'].includes(me.role)) fail('permission-denied', 'PERMISSION_DENIED');
    await userRef(target).update({ isBanned: false, banReason: null, banExpiresAt: null });
    return { ok: true };
});

/* ─── ডায়মন্ড তৈরি (শুধু developer) ─── */
exports.adminAddDiamonds = callable(async (data, uid) => {
    const target = await findUser(data.target); const amount = Math.floor(Number(data.amount));
    if (!(Math.abs(amount) >= 1 && Math.abs(amount) <= 100000000)) fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); assertActive(me);
    if (me.role !== 'developer') fail('permission-denied', 'PERMISSION_DENIED');
    return db.runTransaction(async t => {
        const tS = await t.get(userRef(target)); if (!tS.exists) fail('not-found', 'NOT_FOUND');
        const bal = tS.data().diamonds || 0;
        if (amount < 0 && bal + amount < 0) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        t.update(tS.ref, { diamonds: FV.increment(amount) });
        addTx(t, { type: amount > 0 ? 'reward' : 'refund', title: String(data.note || 'Admin adjustment').slice(0, 80), fromUid: amount > 0 ? 'system' : target, toUid: amount > 0 ? target : 'system', amount: Math.abs(amount), note: 'by ' + uid });
        return { ok: true, balance: bal + amount };
    });
});

/* ─── ডিস্ট্রিবিউটর বিক্রি (developer ও distributor) ─── ডিস্ট্রিবিউটরের নিজের ডায়মন্ড কমে, ক্রেতার বাড়ে */
exports.distributorTransfer = callable(async (data, uid) => {
    const target = await findUser(data.target); const amount = Math.floor(Number(data.amount));
    if (!(amount >= 1 && amount <= 10000000) || target === uid) fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); assertActive(me);
    if (!['developer', 'distributor'].includes(me.role)) fail('permission-denied', 'PERMISSION_DENIED');
    const priceBDT = Math.max(0, Math.floor(Number(data.priceBDT) || 0));
    return db.runTransaction(async t => {
        const mS = await t.get(userRef(uid)); const tS = await t.get(userRef(target));
        if (!tS.exists) fail('not-found', 'NOT_FOUND');
        const buyer = tS.data(); assertActive(buyer);
        if (me.role === 'distributor' && (mS.data().diamonds || 0) < amount) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        if (me.role === 'distributor') t.update(mS.ref, { diamonds: FV.increment(-amount) });
        t.update(tS.ref, { diamonds: FV.increment(amount) });
        addTx(t, { type: 'sell', title: 'Diamond purchase', fromUid: uid, toUid: target, amount, priceBDT, paymentMethod: String(data.method || 'cash').slice(0, 20), paymentRef: String(data.ref || '').slice(0, 60) });
        return { ok: true, toName: buyer.name };
    }).then(async r => { await notify(target, { icon: '💎', title: 'ডায়মন্ড যোগ হয়েছে', text: amount + ' 💎 পেয়েছেন' }); return r; });
});

/* ─── ডিস্ট্রিবিউটরকে স্টক দেওয়া = adminAddDiamonds; ডিস্ট্রিবিউটর বানানো = setRole('distributor') ─── */

/* ─── ব্যাজ / মুকুট দেওয়া (শুধু developer) ─── */
exports.grantBadge = callable(async (data, uid) => {
    const target = await findUser(data.target); const badge = String(data.badge || ''); const on = data.on !== false;
    if (!C.BADGES.includes(badge)) fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); if (me.role !== 'developer') fail('permission-denied', 'PERMISSION_DENIED');
    await userRef(target).update({ badges: on ? FV.arrayUnion(badge) : FV.arrayRemove(badge) });
    return { ok: true };
});
exports.grantCrown = callable(async (data, uid) => {
    const target = await findUser(data.target); const id = String(data.id || '');
    if (!C.CROWNS[id]) fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); if (me.role !== 'developer') fail('permission-denied', 'PERMISSION_DENIED');
    await userRef(target).update({ ownedCrowns: data.on === false ? FV.arrayRemove(id) : FV.arrayUnion(id) });
    return { ok: true };
});

/* ইউজার খোঁজা (admin প্যানেলের সার্চ) — staff ও distributor ব্যবহার করবে */
exports.lookupUser = callable(async (data, uid) => {
    const me = await getUserDoc(uid);
    if (rank(me.role) < C.RANK.distributor) fail('permission-denied', 'PERMISSION_DENIED');
    const target = await findUser(data.target);
    const u = await getUserDoc(target);
    return { uid: target, name: u.name, photo: u.photo, moiId: u.moiId, role: u.role, diamonds: u.diamonds || 0, level: u.level || 1, isBanned: !!u.isBanned, badges: u.badges || [], ownedCrowns: u.ownedCrowns || [], country: u.country || '' };
});
