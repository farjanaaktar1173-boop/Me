/* functions/store.js — ফ্রেম ও মুকুট কেনা/পরা */
'use strict';
const { db, FV, fail, callable, userRef, assertActive, applyDelta, notify, C } = require('./lib/common');

const stRef = (uid, name) => db.collection('userState/' + uid + '/items').doc(name);

/* ফ্রেম কেনা (দাম 0 হলে বা আগে কেনা থাকলে শুধু পরা) */
exports.buyFrame = callable(async (data, uid) => {
    const id = String(data.id || ''); const price = C.FRAMES[id];
    if (price === undefined) fail('invalid-argument', 'INVALID');
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (!uS.exists) fail('not-found', 'NOT_FOUND');
        const u = uS.data(); assertActive(u);
        const fS = await t.get(stRef(uid, 'frames'));
        const fs = (fS.exists && fS.data().v) || { owned: ['basic'], equipped: 'basic' };
        let bought = false;
        if (!fs.owned.includes(id)){
            if ((u.diamonds || 0) < price) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
            fs.owned.push(id); bought = true;
        }
        fs.equipped = id;
        t.set(stRef(uid, 'frames'), { v: fs });
        let balance = u.diamonds || 0;
        if (bought) balance = applyDelta(t, uid, u, { dia: -price, xp: 10, extra: { frame: id }, title: 'Store: ' + id + ' frame', txType: 'spend' }).diamonds;
        else t.update(userRef(uid), { frame: id });
        return { bought, balance, state: fs };
    });
});

/* মুকুট কেনা — শুধু ব্যাগে যায়; পরতে হলে equipCrown (ব্যাগের Use বাটন) */
exports.buyCrown = callable(async (data, uid) => {
    const id = String(data.id || ''); const c = C.CROWNS[id];
    if (!c || !c.purchasable || c.adminOnly) fail('invalid-argument', 'INVALID');
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
        const owned = u.ownedCrowns || [];
        if (owned.includes(id)) fail('failed-precondition', 'ALREADY_OWNED');
        if ((u.diamonds || 0) < c.price) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        const r = applyDelta(t, uid, u, { dia: -c.price, xp: Math.floor(c.price / 100), extra: { ownedCrowns: FV.arrayUnion(id) }, title: 'Crown: ' + c.name, txType: 'spend' });
        return { balance: r.diamonds };
    });
});

/* মুকুট পরা — কেনা থাকা মুকুটই; 'official' শুধু Developer; '' দিলে খুলে ফেলা */
exports.equipCrown = callable(async (data, uid) => {
    const id = String(data.id || '');
    const u = await userRef(uid).get(); if (!u.exists) fail('not-found', 'NOT_FOUND');
    const d = u.data(); assertActive(d);
    const isDev = d.role === 'developer';
    if (id === 'official'){ if (!isDev) fail('permission-denied', 'PERMISSION_DENIED'); }
    else if (id){ if (!C.CROWNS[id] || !(d.ownedCrowns || []).includes(id)) fail('permission-denied', 'PERMISSION_DENIED'); }
    /* খুলে ফেলা: Developer এর ক্ষেত্রে 'none' (না হলে ডিফল্ট official ফিরে আসত) */
    const val = id || (isDev ? 'none' : '');
    await userRef(uid).update({ crown: val });
    return { ok: true, crown: val };
});

/* অন্য বন্ধুকে মুকুট গিফট (giftable মুকুট) */
exports.sendCrown = callable(async (data, uid) => {
    const id = String(data.id || ''); const to = String(data.toUid || ''); const c = C.CROWNS[id];
    if (!c || !c.giftable || c.adminOnly || !to || to === uid) fail('invalid-argument', 'INVALID');
    const r = await db.runTransaction(async t => {
        const sS = await t.get(userRef(uid)); const tS = await t.get(userRef(to));
        if (!sS.exists || !tS.exists) fail('not-found', 'NOT_FOUND');
        const s = sS.data(); assertActive(s);
        if ((tS.data().ownedCrowns || []).includes(id)) fail('failed-precondition', 'ALREADY_OWNED');
        if ((s.diamonds || 0) < c.price) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        const rr = applyDelta(t, uid, s, { dia: -c.price, xp: Math.floor(c.price / 100), title: 'Crown gift: ' + c.name, txType: 'gift' });
        t.update(tS.ref, { ownedCrowns: FV.arrayUnion(id) });
        t.set(db.collection('gifts').doc(), { senderUid: uid, senderName: s.name, targetUid: to, targetName: tS.data().name || '', roomId: '', giftId: 'crown_' + id, giftName: c.name, qty: 1, unitPrice: c.price, totalAmount: c.price, isCrown: true, crownId: id, type: 'crown', createdAt: FV.serverTimestamp() });
        return { balance: rr.diamonds };
    });
    await notify(to, { icon: '👑', title: 'আপনি মুকুট উপহার পেয়েছেন', text: c.name });
    return r;
});
