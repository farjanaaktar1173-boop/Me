/* functions/lib/common.js — সবার কাজে লাগা হেল্পার */
'use strict';
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const C = require('../catalog');

if (!admin.apps.length) admin.initializeApp({ databaseURL: 'https://room-7fbf7-default-rtdb.firebaseio.com' });
const db = admin.firestore();
const rtdb = admin.database();
const FV = admin.firestore.FieldValue;
const LIVE = 'moi-live';

const fail = (code, msg) => { throw new HttpsError(code, msg || code); };

/* প্রতিটি ফাংশন এই মোড়কে: লগইন চেক → হ্যান্ডলার → এরর ঠিকঠাক ফেরত */
function callable(handler){
    return onCall({ cors: true, region: 'us-central1' }, async (req) => {
        if (!req.auth || !req.auth.uid) fail('unauthenticated', 'UNAUTHENTICATED');
        try { return await handler(req.data || {}, req.auth.uid, req); }
        catch (e){
            if (e instanceof HttpsError) throw e;
            console.error('[fn error]', e);
            throw new HttpsError('internal', String(e && e.message || 'ERROR'));
        }
    });
}

const userRef = uid => db.collection('users').doc(uid);
async function getUserDoc(uid){
    const s = await userRef(uid).get();
    if (!s.exists) fail('not-found', 'NOT_FOUND');
    return s.data();
}
/* ইউজার যাচাই: নিষিদ্ধ না, গেস্ট না (দরকার হলে) */
function assertActive(u, { allowGuest } = {}){
    if (u.isBanned && (!u.banExpiresAt || u.banExpiresAt.toMillis() > Date.now())) fail('permission-denied', 'BANNED');
    if (!allowGuest && (u.role === 'guest' || u.isGuest)) fail('permission-denied', 'GUEST_NOT_ALLOWED');
}
const rank = role => C.RANK[role] || 0;
const isStaff = role => rank(role) >= C.RANK.superadmin;

/* লেনদেনের রেকর্ড (ওয়ালেট ইতিহাস) — t হলো Firestore transaction */
function addTx(t, o){
    const ref = db.collection('transactions').doc();
    t.set(ref, Object.assign({
        type: 'spend', title: '', fromUid: '', toUid: '', amount: 0, priceBDT: 0, commission: 0,
        paymentMethod: '', paymentRef: '', status: 'completed', note: null, createdAt: FV.serverTimestamp()
    }, o, { participants: [o.fromUid, o.toUid].filter(x => x && x !== 'system') }));
    return ref.id;
}

/* ডায়মন্ড/XP বদল একসাথে (লেভেল-আপ বোনাস সহ) — user হলো আগের ডক ডেটা */
function applyDelta(t, uid, user, { dia = 0, xp = 0, extra = {}, title = '', txType = 'reward' }){
    const newXp = (user.xp || 0) + xp;
    const oldLv = user.level || C.levelFromXp(user.xp || 0);
    const newLv = Math.max(oldLv, C.levelFromXp(newXp));
    let bonus = 0;
    for (let L = oldLv + 1; L <= newLv; L++) bonus += L * 25;
    const total = dia + bonus;
    const upd = Object.assign({}, extra);
    if (xp) upd.xp = newXp;
    if (newLv !== oldLv) upd.level = newLv;
    if (total) upd.diamonds = FV.increment(total);
    if (Object.keys(upd).length) t.update(userRef(uid), upd);
    if (dia) addTx(t, { type: txType, title, fromUid: dia < 0 ? uid : 'system', toUid: dia < 0 ? 'system' : uid, amount: Math.abs(dia) });
    if (bonus) addTx(t, { type: 'reward', title: 'Level ' + newLv + ' bonus', fromUid: 'system', toUid: uid, amount: bonus });
    return { level: newLv, xp: newXp, bonus, diamonds: (user.diamonds || 0) + total };
}

/* অ্যাপের ভেতরের নোটিফিকেশন (Realtime DB) */
async function notify(uid, n){
    try { await rtdb.ref(LIVE + '/notifications/' + uid).push(Object.assign({ read: false, ts: Date.now() }, n)); } catch(e){ console.warn('notify fail', e.message); }
}

module.exports = { admin, db, rtdb, FV, LIVE, fail, callable, userRef, getUserDoc, assertActive, rank, isStaff, addTx, applyDelta, notify, C, HttpsError };
