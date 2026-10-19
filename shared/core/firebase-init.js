/* shared/core/firebase-init.js — Firebase চালু করা (সব সার্ভিস এক জায়গায়) */
console.log('[MOI] firebase-init.js loaded');

(function(){
    'use strict';

    /* ⚠️ আপনার Firebase প্রজেক্টের কনফিগ (Console → Project settings → Your apps) */
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyCTn3QEYtRMxm7Y91RSFSvbRJSRHcXMEdI',
        authDomain: 'room-7fbf7.firebaseapp.com',
        databaseURL: 'https://room-7fbf7-default-rtdb.firebaseio.com',
        projectId: 'room-7fbf7',
        storageBucket: 'room-7fbf7.firebasestorage.app',
        messagingSenderId: '417946695868',
        appId: '1:417946695868:web:34c6f63269aaf659b2b8b9'
    };
    /* Cloud Functions যে রিজিয়নে ডিপ্লয় হবে (functions/index.js এর সাথে মিলতে হবে) */
    const FUNCTIONS_REGION = 'us-central1';

    if (typeof firebase === 'undefined'){
        console.error('[MOI] Firebase SDK লোড হয়নি — ইন্টারনেট চেক করুন');
        window.MOIFB = null;
        return;
    }

    try {
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        const db = firebase.firestore();
        try { db.settings({ ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true, merge: true }); } catch(e){}
        window.MOIFB = {
            app,
            auth: firebase.auth(),
            db,
            rtdb: firebase.database(),
            storage: firebase.storage ? firebase.storage() : null,
            fn: app.functions ? app.functions(FUNCTIONS_REGION) : null,
            TS: () => firebase.firestore.FieldValue.serverTimestamp(),
            RTS: () => firebase.database.ServerValue.TIMESTAMP,
            LIVE: 'moi-live'               /* Realtime Database-এর রুট নোড */
        };
    } catch(err){
        console.error('[MOI] Firebase init error', err);
        window.MOIFB = null;
    }
})();
