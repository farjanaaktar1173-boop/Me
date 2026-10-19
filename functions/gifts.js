/* functions/gifts.js — রুমে গিফট + চ্যাটে উপহার (সব হিসাব সার্ভারে) */
'use strict';
const { db, rtdb, FV, LIVE, fail, callable, userRef, assertActive, addTx, applyDelta, notify, C } = require('./lib/common');

/* রুমের লাইভ ইফেক্ট: গিফট সিগন্যাল, giftStats, সিটের coins, PK স্কোর */
async function liveEffects(roomId, sender, targets, gift, qty, unit){
    const base = LIVE + '/rooms/' + roomId;
    const ts = Date.now();
    try {
        await rtdb.ref(base + '/liveGifts').push({ senderUid: sender.uid, targetUids: targets.map(x => x.uid), giftId: gift, qty, ts });
        for (const tg of targets){
            const amount = unit * qty;
            await rtdb.ref(base + '/giftStats/' + tg.uid).update({ uid: tg.uid, name: tg.name || 'User', avatar: tg.photo || '' });
            await rtdb.ref(base + '/giftStats/' + tg.uid + '/history').push({ amount, ts });
        }
        const seatsSnap = await rtdb.ref(base + '/seats').get();
        const seats = seatsSnap.val() || {};
        for (const tg of targets){
            const idx = Object.keys(seats).find(i => seats[i] && seats[i].uid === tg.uid);
            if (idx !== undefined) await rtdb.ref(base + '/seats/' + idx + '/coins').transaction(v => (v || 0) + unit * qty);
        }
        const pk = (await rtdb.ref(base + '/pkState').get()).val();
        if (pk && pk.expiresAt > ts && pk.blue && pk.red){
            for (const tg of targets){
                if (pk.blue.uid === tg.uid) await rtdb.ref(base + '/pkState/blue/score').transaction(v => (v || 0) + unit * qty);
                if (pk.red.uid === tg.uid)  await rtdb.ref(base + '/pkState/red/score').transaction(v => (v || 0) + unit * qty);
            }
        }
    } catch(e){ console.warn('liveEffects', e.message); }
}

exports.sendGift = callable(async (data, uid) => {
    const roomId = String(data.roomId || '');
    const giftId = String(data.giftId || '');
    const qty = Math.floor(Number(data.qty));
    const targetUids = [...new Set((data.targets || []).map(String))].slice(0, 10);
    const unit = C.GIFTS[giftId];
    if (!roomId || unit === undefined || !(qty >= 1 && qty <= 9999) || !targetUids.length) fail('invalid-argument', 'INVALID');
    const total = unit * qty * targetUids.length;
    const roomRef = db.collection('rooms').doc(roomId);

    const res = await db.runTransaction(async t => {
        const sSnap = await t.get(userRef(uid));
        const room = await t.get(roomRef);
        const tSnaps = await Promise.all(targetUids.map(x => t.get(userRef(x))));
        if (!sSnap.exists || !room.exists) fail('not-found', 'NOT_FOUND');
        const s = sSnap.data(); assertActive(s);
        if (tSnaps.some(x => !x.exists)) fail('not-found', 'NOT_FOUND');
        if (!s || (s.diamonds || 0) < total) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');

        const r = applyDelta(t, uid, s, { dia: -total, xp: Math.floor(total / 2), extra: { giftsSent: FV.increment(total) }, title: 'Gift: ' + giftId + ' ×' + qty, txType: 'gift' });
        tSnaps.forEach(x => t.update(x.ref, { giftsReceived: FV.increment(unit * qty) }));
        t.update(roomRef, { points: FV.increment(total) });
        targetUids.forEach((tu, i) => t.set(db.collection('gifts').doc(), {
            senderUid: uid, senderName: s.name, targetUid: tu, targetName: tSnaps[i].data().name || '', roomId,
            giftId, giftName: giftId, qty, unitPrice: unit, totalAmount: unit * qty, isCrown: false, crownId: null, type: 'gift', createdAt: FV.serverTimestamp()
        }));
        return { sender: s, targets: tSnaps.map(x => x.data()), balance: r.diamonds };
    });

    await liveEffects(roomId, { uid, name: res.sender.name }, res.targets, giftId, qty, unit);
    /* চ্যাটে গিফট মেসেজ (সার্ভার লেখে, তাই নকল হয় না) */
    const names = res.targets.length === 1 ? res.targets[0].name : res.targets.length + ' জন';
    const id = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await roomRef.collection('messages').doc(id).set({
        id, type: 'gift', uid: uid, senderUid: uid, name: res.sender.name, senderName: res.sender.name, avatar: res.sender.photo || '',
        text: '💎 ' + (data.giftName || giftId) + ' × ' + qty + ' → ' + names, giftMeta: { giftId, qty, targetUids }, ts: Date.now(), createdAt: FV.serverTimestamp()
    }).catch(() => {});
    return { ok: true, total, balance: res.balance };
});

/* চ্যাটে বন্ধুকে উপহার: প্রেরকের ডায়মন্ড কমে, গ্রহীতার "giftsReceived" বাড়ে (ডায়মন্ড P2P ট্রান্সফার বন্ধ — কালোবাজার ঠেকাতে) */
exports.sendChatGift = callable(async (data, uid) => {
    const to = String(data.toUid || ''); const amount = Math.floor(Number(data.amount));
    if (!to || to === uid) fail('invalid-argument', 'SELF');
    if (!C.CHAT_GIFTS[amount]) fail('invalid-argument', 'INVALID');
    return db.runTransaction(async t => {
        const sSnap = await t.get(userRef(uid)); const tSnap = await t.get(userRef(to));
        if (!sSnap.exists || !tSnap.exists) fail('not-found', 'NOT_FOUND');
        const s = sSnap.data(); assertActive(s);
        if ((s.diamonds || 0) < amount) fail('failed-precondition', 'INSUFFICIENT_DIAMONDS');
        const r = applyDelta(t, uid, s, { dia: -amount, xp: Math.floor(amount / 5), extra: { giftsSent: FV.increment(amount) }, title: 'Chat gift to ' + (tSnap.data().name || ''), txType: 'gift' });
        t.update(tSnap.ref, { giftsReceived: FV.increment(amount) });
        t.set(db.collection('gifts').doc(), { senderUid: uid, senderName: s.name, targetUid: to, targetName: tSnap.data().name || '', roomId: '', giftId: 'chat_' + amount, giftName: 'Chat gift', qty: 1, unitPrice: amount, totalAmount: amount, isCrown: false, crownId: null, type: 'gift', createdAt: FV.serverTimestamp() });
        return { ok: true, balance: r.diamonds, toName: tSnap.data().name || '' };
    }).then(async r => {
        await notify(to, { icon: '🎁', title: 'আপনি একটি উপহার পেয়েছেন', text: amount + ' 💎 মূল্যের উপহার' });
        /* চ্যাটে উপহারের মেসেজ — সার্ভার লেখে */
        const chatId = [uid, to].sort().join('__'); const id = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        await db.collection('chats').doc(chatId).set({ participants: chatId.split('__'), updatedAt: FV.serverTimestamp() }, { merge: true });
        await db.collection('chats/' + chatId + '/messages').doc(id).set({ id, type: 'gift', content: '🎁 ' + amount + ' 💎', amount, senderUid: uid, senderName: '', time: '', ts: Date.now(), delivered: true, createdAt: FV.serverTimestamp() });
        return r;
    });
});
