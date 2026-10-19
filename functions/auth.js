/* functions/auth.js — নতুন ইউজারের প্রোফাইল বানানো (moiId সহ) */
'use strict';
const { db, FV, callable, userRef } = require('./lib/common');

const cleanName = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 24);
const okUrl = s => /^https:\/\/[^\s]{4,400}$/.test(String(s || '')) ? String(s) : '';

/* ক্লায়েন্ট লগইনের পর এটা ডাকে। প্রোফাইল আগে থাকলে কিছু করে না। */
exports.ensureProfile = callable(async (data, uid, req) => {
    const provider = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
    const isGuest = provider === 'anonymous';
    return db.runTransaction(async t => {
        const ref = userRef(uid);
        const snap = await t.get(ref);
        if (snap.exists) return { created: false };

        /* ৬ ডিজিটের ইউনিক moiId — কাউন্টার থেকে */
        const cRef = db.collection('meta').doc('counters');
        const c = await t.get(cRef);
        const next = ((c.exists && c.data().moiId) || 100000) + 1 + Math.floor(Math.random() * 7);
        const moiId = String(next);
        t.set(cRef, { moiId: next }, { merge: true });
        t.set(db.collection('moiIds').doc(moiId), { uid });

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
});
