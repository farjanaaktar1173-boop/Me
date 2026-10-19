/* functions/rewards.js — Check-in, Spin, মিশন, ব্যাগ, ইনভাইট, লাকি বক্স */
'use strict';
const { db, rtdb, FV, LIVE, fail, callable, userRef, assertActive, applyDelta, notify, C } = require('./lib/common');

const stRef = (uid, name) => db.collection('userState/' + uid + '/items').doc(name);
const stVal = s => (s.exists && s.data().v) || null;

exports.claimCheckin = callable(async (data, uid) => {
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (!uS.exists) fail('not-found', 'NOT_FOUND');
        const u = uS.data(); assertActive(u);
        const cS = await t.get(stRef(uid, 'checkin'));
        const cur = stVal(cS) || { last: '', streak: 0 };
        const today = C.dayKey(), yest = C.dayKey(Date.now() - 86400000);
        if (cur.last === today) fail('failed-precondition', 'ALREADY_CLAIMED');
        const streak = (cur.last === yest ? cur.streak : 0) + 1;
        const reward = C.CHECKIN[(streak - 1) % 7];
        t.set(stRef(uid, 'checkin'), { v: { last: today, streak } });
        const r = applyDelta(t, uid, u, { dia: reward, xp: 20, title: 'Daily check-in' });
        return { reward, streak, balance: r.diamonds };
    });
});

function pickPrize(){
    const { weights, segs } = C.SPIN;
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const v of segs){ r -= weights[v]; if (r <= 0) return v; }
    return 10;
}
exports.doSpin = callable(async (data, uid) => {
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (!uS.exists) fail('not-found', 'NOT_FOUND');
        const u = uS.data(); assertActive(u);
        const sS = await t.get(stRef(uid, 'spin'));
        const today = C.dayKey();
        const free = (stVal(sS) || {}).last !== today;
        if (!free && (u.diamonds || 0) < C.SPIN.cost) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        const prize = pickPrize();
        if (free) t.set(stRef(uid, 'spin'), { v: { last: today } });
        const net = prize - (free ? 0 : C.SPIN.cost);
        const r = applyDelta(t, uid, u, { dia: net, xp: 5, title: free ? 'Lucky Spin (free)' : 'Lucky Spin' });
        return { prize, free, balance: r.diamonds };
    });
});

/* মিশন: শর্ত সার্ভার নিজে পরীক্ষা করে */
async function missionOk(id, uid, u){
    const cnt = async p => (await db.collection(p).limit(1).get()).size;
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
exports.claimMission = callable(async (data, uid) => {
    const id = String(data.id || ''); const m = C.MISSIONS[id];
    if (!m) fail('invalid-argument', 'INVALID');
    const day = C.dayKey();
    const name = 'missions_' + day;
    const pre = await userRef(uid).get(); if (!pre.exists) fail('not-found', 'NOT_FOUND');
    if (!(await missionOk(id, uid, pre.data()))) fail('failed-precondition', 'NOT_READY');
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
        const mS = await t.get(stRef(uid, name));
        const done = stVal(mS) || {};
        if (done[id]) fail('failed-precondition', 'ALREADY_CLAIMED');
        done[id] = true;
        t.set(stRef(uid, name), { v: done });
        const r = applyDelta(t, uid, u, { dia: m.dia, xp: m.xp, title: 'Mission: ' + id });
        return { dia: m.dia, balance: r.diamonds };
    });
});

exports.claimBagDaily = callable(async (data, uid) => {
    return db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
        const bS = await t.get(stRef(uid, 'bag_daily'));
        const today = C.dayKey();
        if ((stVal(bS) || {}).last === today) fail('failed-precondition', 'ALREADY_CLAIMED');
        t.set(stRef(uid, 'bag_daily'), { v: { last: today } });
        const r = applyDelta(t, uid, u, { dia: C.BAG_DAILY, title: 'Daily bag reward' });
        return { dia: C.BAG_DAILY, balance: r.diamonds };
    });
});

/* ইনভাইট কোড: দুজনেই বোনাস পায়, একজন একবারই */
exports.redeemInvite = callable(async (data, uid) => {
    const code = String(data.code || '').replace(/\D/g, '');
    if (code.length < 4) fail('invalid-argument', 'INVALID');
    const idSnap = await db.collection('moiIds').doc(code).get();
    if (!idSnap.exists) fail('not-found', 'NOT_FOUND');
    const ownerUid = idSnap.data().uid;
    if (ownerUid === uid) fail('invalid-argument', 'SELF');
    return db.runTransaction(async t => {
        const mS = await t.get(userRef(uid)); const oS = await t.get(userRef(ownerUid));
        const rS = await t.get(stRef(uid, 'redeemed'));
        const iS = await t.get(stRef(ownerUid, 'invited'));
        if (!mS.exists || !oS.exists) fail('not-found', 'NOT_FOUND');
        const me = mS.data(); assertActive(me);
        if (stVal(rS)) fail('failed-precondition', 'ALREADY_CLAIMED');
        t.set(stRef(uid, 'redeemed'), { v: oS.data().name || 'User' });
        const inv = stVal(iS) || []; inv.push(uid);
        t.set(stRef(ownerUid, 'invited'), { v: inv.slice(-200) });
        const r = applyDelta(t, uid, me, { dia: C.INVITE_BONUS, xp: 10, title: 'Invite bonus' });
        applyDelta(t, ownerUid, oS.data(), { dia: C.INVITE_BONUS, xp: 10, title: 'Invite bonus (friend joined)' });
        return { bonus: C.INVITE_BONUS, owner: oS.data().name || 'User', balance: r.diamonds };
    });
});

/* লাকি বক্স — ডায়মন্ড কাটা ও জেতা দুটোই সার্ভারে */
async function isRoomStaff(roomId, uid){
    const r = await db.collection('rooms').doc(roomId).get();
    if (!r.exists) return false;
    const d = r.data();
    return d.ownerUid === uid || (d.admins || []).includes(uid);
}
exports.createLuckyBox = callable(async (data, uid) => {
    const roomId = String(data.roomId || ''); const total = Math.floor(Number(data.total)); const qty = Math.floor(Number(data.qty)); const timer = Math.floor(Number(data.timerMin));
    if (!roomId || !(total >= 10 && total <= 1000000) || !(qty >= 1 && qty <= 100) || ![1, 3, 5, 10].includes(timer)) fail('invalid-argument', 'INVALID');
    if (!(await isRoomStaff(roomId, uid))) fail('permission-denied', 'PERMISSION_DENIED');
    const tax = Math.floor(total * C.LUCKY_TAX), pool = total - tax;
    const box = await db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); const u = uS.data(); assertActive(u);
        if ((u.diamonds || 0) < total) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        applyDelta(t, uid, u, { dia: -total, title: 'Lucky box', txType: 'spend' });
        return { id: 'lb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), senderUid: uid, senderName: u.name, senderAvatar: u.photo || '', total, tax, pool, qty, timerMin: timer, startedAt: Date.now(), expiresAt: Date.now() + timer * 60000, createdAt: Date.now() };
    });
    await rtdb.ref(LIVE + '/rooms/' + roomId + '/luckybox/' + box.id).set(box);
    return { ok: true, box };
});
exports.openLuckyBox = callable(async (data, uid) => {
    const roomId = String(data.roomId || ''); const boxId = String(data.boxId || '');
    if (!roomId || !boxId) fail('invalid-argument', 'INVALID');
    const u0 = await userRef(uid).get(); if (!u0.exists) fail('not-found', 'NOT_FOUND'); assertActive(u0.data());
    const ref = rtdb.ref(LIVE + '/rooms/' + roomId + '/luckybox/' + boxId);
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
    if (!tr.committed || !tr.snapshot.val()) fail('failed-precondition', 'NOT_READY');
    if (won > 0){
        await db.runTransaction(async t => {
            const uS = await t.get(userRef(uid));
            applyDelta(t, uid, uS.data(), { dia: won, title: 'Lucky box win' });
        });
        /* বিজয়ীর নাম/ছবি বসানো (শুধু দেখানোর জন্য) */
        const meDoc = (await userRef(uid).get()).data();
        const snap = (await ref.get()).val() || {};
        const wm = snap.winners || {};
        const key = Object.keys(wm).find(k => wm[k] && wm[k].uid === uid);
        if (key !== undefined) await ref.child('winners').child(key).update({ name: meDoc.name || 'User', avatar: meDoc.photo || '' });
    }
    return { won };
});
