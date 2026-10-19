/* functions/rooms.js — রুম তৈরি/মোছা, অ্যাডমিন নিয়োগ (Firestore + Realtime DB মেটা একসাথে) */
'use strict';
const { db, rtdb, FV, LIVE, fail, callable, userRef, getUserDoc, assertActive, isStaff, C } = require('./lib/common');

exports.createRoom = callable(async (data, uid) => {
    const name = String(data.name || '').replace(/[<>]/g, '').trim().slice(0, 30);
    if (name.length < 2) fail('invalid-argument', 'INVALID');
    const me = await getUserDoc(uid); assertActive(me);
    if (me.myRoomUid) fail('failed-precondition', 'ALREADY_OWNED');
    let id = '';
    for (let i = 0; i < 30; i++){
        const c = String(Math.floor(100000 + Math.random() * 900000));
        if (!(await db.collection('rooms').doc(c).get()).exists){ id = c; break; }
    }
    if (!id) fail('internal', 'ERROR');
    const logo = /^https:\/\//.test(String(data.logo || '')) ? String(data.logo) : '';
    await db.runTransaction(async t => {
        const uS = await t.get(userRef(uid)); if (uS.data().myRoomUid) fail('failed-precondition', 'ALREADY_OWNED');
        t.set(db.collection('rooms').doc(id), {
            id, name, logo, wallpaper: '', country: String(data.country || 'Unknown').slice(0, 30), language: 'bn',
            ownerUid: uid, ownerName: me.name, ownerAvatar: me.photo || '', owner: { uid, name: me.name, avatar: me.photo || '' },
            admins: [], isLive: true, micSeatCount: 10, topic: '🎧FM 📻➡️SP ✨🎤Room 🎵', tags: [], category: 'chat',
            level: 1, points: 0, pkActive: false, pkId: null, rules: [], createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp()
        });
        t.update(userRef(uid), { myRoomUid: id, myRoomId: id });
    });
    await rtdb.ref(LIVE + '/roomMeta/' + id).set({ owner: uid });
    return { ok: true, id };
});

exports.deleteRoom = callable(async (data, uid) => {
    const id = String(data.id || ''); const r = await db.collection('rooms').doc(id).get();
    if (!r.exists) fail('not-found', 'NOT_FOUND');
    const me = await getUserDoc(uid);
    if (r.data().ownerUid !== uid && !isStaff(me.role)) fail('permission-denied', 'PERMISSION_DENIED');
    await db.collection('rooms').doc(id).delete();
    await userRef(r.data().ownerUid).update({ myRoomUid: '', myRoomId: '' }).catch(() => {});
    await rtdb.ref(LIVE + '/rooms/' + id).remove(); await rtdb.ref(LIVE + '/roomMeta/' + id).remove();
    return { ok: true };
});

/* রুমের অ্যাডমিন বানানো/সরানো (মালিক বা staff) */
exports.setRoomAdmin = callable(async (data, uid) => {
    const id = String(data.roomId || ''); const target = String(data.uid || ''); const on = data.on !== false;
    const rRef = db.collection('rooms').doc(id); const r = await rRef.get();
    if (!r.exists || !target) fail('not-found', 'NOT_FOUND');
    const me = await getUserDoc(uid); assertActive(me);
    if (r.data().ownerUid !== uid && !isStaff(me.role)) fail('permission-denied', 'PERMISSION_DENIED');
    if (target === r.data().ownerUid) fail('invalid-argument', 'SELF');
    await rRef.update({ admins: on ? FV.arrayUnion(target) : FV.arrayRemove(target) });
    await rtdb.ref(LIVE + '/roomMeta/' + id + '/admins/' + target).set(on ? true : null);
    return { ok: true };
});
