/* shared/core/sync-routes.js — কোন key Firebase-এর কোথায় যাবে (ম্যাপ)
   Firestore (স্থায়ী): users, rooms, রুম/চ্যাট মেসেজ, বন্ধু, ফলো, ব্লক, প্রাইভেট ডেটা
   Realtime DB (লাইভ) : সিট, শ্রোতা, PK, মিউজিক, নোটিফিকেশন, উপস্থিতি */
console.log('[MOI] sync-routes.js loaded');

(function(){
    'use strict';
    const FB = window.MOIFB, S = window.MOISync;
    if (!FB || !S) return;
    const { db, rtdb, TS } = FB;
    const LIVE = FB.LIVE;
    const me = () => S.uid;
    const J = S.clone, norm = S.norm, same = S.same;
    const warn = (what) => (e) => console.warn('[sync] ' + what + ' ✗', e && (e.code || e.message || e));
    const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };

    /* ───────── ১) users ───────── */
    const USER_WRITABLE = ['name','photo','bio','country','gender','birthday','voice','lastSeen','lastActiveRoomId',
        'fcmToken','profileComplete','prefs','theme'];
    const usersMap = {};
    const wanted = new Set();
    let wantTimer = null;
    function pushUsers(){ S.push('moi_demo_users', Object.assign({}, usersMap)); }

    /* যে ইউজার ক্যাশে নেই তাকে পেছনে এনে ফেলা */
    function wantUser(uid){
        if (!uid || usersMap[uid] || wanted.has(uid) || String(uid).length < 5) return;
        wanted.add(uid);
        clearTimeout(wantTimer);
        wantTimer = setTimeout(async () => {
            const ids = [...wanted].slice(0, 40); ids.forEach(i => wanted.delete(i));
            const res = await Promise.all(ids.map(i => db.collection('users').doc(i).get().catch(() => null)));
            res.forEach((d, k) => { if (d && d.exists){ usersMap[ids[k]] = norm(d.data()); } else usersMap[ids[k]] = { uid: ids[k], name: 'User', _missing: true }; });
            pushUsers();
        }, 60);
    }
    S.wantUser = wantUser;

    S.addRoute({
        match: k => k === 'moi_demo_users' ? {} : null,
        sub(key, ctx, push){
            const stops = [];
            /* নিজের ডক — ডায়মন্ড/লেভেল সাথে সাথে বদলায় */
            stops.push(db.collection('users').doc(me()).onSnapshot(d => {
                if (d.exists){ usersMap[me()] = norm(d.data()); pushUsers(); }
                else { usersMap[me()] = usersMap[me()] || undefined; pushUsers(); }
            }, warn('own user')));
            /* সাম্প্রতিক সক্রিয় ইউজার (লিডারবোর্ড, Discover) */
            stops.push(db.collection('users').orderBy('lastSeen', 'desc').limit(120).onSnapshot(snap => {
                snap.forEach(d => { if (d.id !== me()) usersMap[d.id] = norm(d.data()); });
                pushUsers();
            }, warn('users list')));
            return () => stops.forEach(f => f());
        },
        write(key, ctx, next, prev){
            const uid = me(); const n = next[uid]; if (!n) return;
            const p = (prev || {})[uid] || {};
            const fields = {};
            USER_WRITABLE.forEach(f => { if (n[f] !== undefined && !same(n[f], p[f])) fields[f] = n[f]; });
            if (!Object.keys(fields).length) return;
            db.collection('users').doc(uid).set(fields, { merge: true }).catch(warn('user write'));
        }
    });

    /* ───────── ২) rooms ───────── */
    const ROOM_WRITABLE = ['id','name','logo','wallpaper','country','language','owner','ownerUid','ownerName','ownerAvatar',
        'topic','tags','category','micSeatCount','rules','isLive','mutedUsers','bannedUsers'];
    S.addRoute({
        match: k => k === 'moi_demo_rooms' ? {} : null,
        sub(key, ctx, push){
            return db.collection('rooms').limit(300).onSnapshot(snap => {
                const m = {}; snap.forEach(d => { m[d.id] = norm(d.data()); }); push(m);
            }, warn('rooms'));
        },
        write(key, ctx, next, prev){
            prev = prev || {};
            Object.keys(next).forEach(id => {
                const r = next[id]; if (!r) return;
                const ownerUid = (r.owner && r.owner.uid) || r.ownerUid;
                const p = prev[id];
                const mine = ownerUid === me();
                const isAdminOfIt = p && Array.isArray(p.admins) && p.admins.includes(me());
                if (!mine && !isAdminOfIt) return;
                const fields = {};
                ROOM_WRITABLE.forEach(f => { if (r[f] !== undefined && (!p || !same(r[f], p[f]))) fields[f] = r[f]; });
                if (!p){ fields.ownerUid = ownerUid; fields.ownerName = (r.owner && r.owner.name) || ''; fields.ownerAvatar = (r.owner && r.owner.avatar) || ''; fields.createdAt = TS(); fields.id = id; fields.level = 1; fields.points = 0; }
                else delete fields.createdAt;
                if (!Object.keys(fields).length) return;
                if (!mine) Object.keys(fields).forEach(f => { if (['admins','topic','rules','mutedUsers','bannedUsers','wallpaper','logo','name'].indexOf(f) < 0) delete fields[f]; });
                db.collection('rooms').doc(id).set(fields, { merge: true }).catch(warn('room write'));
            });
            Object.keys(prev).forEach(id => {
                if (!next[id] && prev[id] && ((prev[id].owner && prev[id].owner.uid) || prev[id].ownerUid) === me())
                    db.collection('rooms').doc(id).delete().catch(warn('room delete'));
            });
        }
    });

    /* ───────── ৩) রুমের লাইভ ডেটা (Realtime DB) ───────── */
    const ROOM_RT = /^moi_room_([A-Za-z0-9]+)_(seats|listeners|activity|info|topic|giftStats|wallpaper|joinedUsers|pkState|musicState|roomLayout)$/;
    const LB = /^moi_luckybox_([A-Za-z0-9]+)$/;
    const rtPath = ctx => LIVE + '/rooms/' + ctx.room + '/' + ctx.name;

    const decode = {
        seats(v){
            if (!v) return null;
            const idx = Object.keys(v).map(Number).filter(n => !isNaN(n));
            const len = Math.max(10, (idx.length ? Math.max.apply(null, idx) + 1 : 0));
            const a = new Array(len).fill(null);
            idx.forEach(i => { a[i] = v[i]; });
            return a;
        },
        listeners(v){
            if (!v) return null;
            return Object.keys(v).map(k => Object.assign({ uid: k }, v[k])).sort((a, b) => (a.joined || 0) - (b.joined || 0));
        },
        joinedUsers(v){ return v ? Object.keys(v) : null; },
        giftStats(v){
            if (!v) return null;
            const o = {};
            Object.keys(v).forEach(u => { const g = v[u] || {}; const h = g.history; o[u] = Object.assign({}, g, { history: Array.isArray(h) ? h : Object.values(h || {}) }); });
            return o;
        }
    };
    function diffChildren(ref, next, prev, keyOf){
        const nm = {}, pm = {};
        (next || []).forEach((x, i) => { if (x) nm[keyOf(x, i)] = x; });
        (prev || []).forEach((x, i) => { if (x) pm[keyOf(x, i)] = x; });
        Object.keys(nm).forEach(k => { if (!same(nm[k], pm[k])) ref.child(k).set(J(nm[k])).catch(warn('rt set ' + k)); });
        Object.keys(pm).forEach(k => { if (!(k in nm)) ref.child(k).remove().catch(warn('rt rm ' + k)); });
    }
    S.addRoute({
        match(k){ const m = ROOM_RT.exec(k); return m ? { room: m[1], name: m[2] } : null; },
        sub(key, ctx, push){
            const ref = rtdb.ref(rtPath(ctx));
            const cb = snap => { const v = snap.val(); push(decode[ctx.name] ? decode[ctx.name](v) : v); };
            ref.on('value', cb, warn('rt sub')); return () => ref.off('value', cb);
        },
        write(key, ctx, next, prev){
            const ref = rtdb.ref(rtPath(ctx));
            if (ctx.name === 'seats') return diffChildren(ref, next, prev, (x, i) => String(i));
            if (ctx.name === 'listeners') return diffChildren(ref, next, prev, x => x.uid);
            if (ctx.name === 'joinedUsers') return diffChildren(ref, next, prev, x => x);
            if (ctx.name === 'giftStats') return;          /* গিফট স্ট্যাট শুধু সার্ভার লেখে */
            if (next && typeof next === 'object' && !Array.isArray(next) && prev && typeof prev === 'object' && !Array.isArray(prev)){
                Object.keys(next).forEach(k => { if (!same(next[k], prev[k])) ref.child(k).set(J(next[k])).catch(warn('rt set')); });
                Object.keys(prev).forEach(k => { if (!(k in next)) ref.child(k).remove().catch(warn('rt rm')); });
                return;
            }
            ref.set(J(next)).catch(warn('rt set'));
        },
        remove(key, ctx){
            /* সিট/শ্রোতা নোড পুরো মুছতে হবে না — সব ক্লায়েন্টের ডেটা নষ্ট হবে। শুধু নিজের অংশ অন্য কোডে মোছা হয়। */
            if (ctx.name === 'seats' || ctx.name === 'listeners') return;
            rtdb.ref(rtPath(ctx)).remove().catch(warn('rt remove'));
        }
    });
    S.addRoute({
        match(k){ const m = LB.exec(k); return m ? { room: m[1] } : null; },
        sub(key, ctx, push){
            const ref = rtdb.ref(LIVE + '/rooms/' + ctx.room + '/luckybox');
            const cb = snap => { const v = snap.val(); push(v && typeof v === 'object' ? (Array.isArray(v) ? v : Object.values(v)) : v); };
            ref.on('value', cb, warn('lb sub')); return () => ref.off('value', cb);
        },
        write(key, ctx, next){ rtdb.ref(LIVE + '/rooms/' + ctx.room + '/luckybox').set(J(next)).catch(warn('lb set')); },
        remove(key, ctx){ rtdb.ref(LIVE + '/rooms/' + ctx.room + '/luckybox').remove().catch(warn('lb rm')); }
    });

    /* ───────── ৪) মেসেজ (রুম + ১-টু-১ চ্যাট) — Firestore সাবকালেকশন ───────── */
    const ROOM_MSG = /^moi_room_([A-Za-z0-9]+)_messages$/;
    const CHAT_MSG = /^moi_chat_([A-Za-z0-9]+__[A-Za-z0-9]+)$/;
    function msgRoute(re, colPath, onFirstWrite, limit){
        S.addRoute({
            match(k){ const m = re.exec(k); return m ? { id: m[1] } : null; },
            sub(key, ctx, push){
                return db.collection(colPath(ctx.id)).orderBy('ts', 'desc').limit(limit).onSnapshot(snap => {
                    const a = []; snap.forEach(d => a.push(Object.assign({ id: d.id }, norm(d.data()))));
                    push(a.reverse());
                }, warn('msgs'));
            },
            write(key, ctx, next, prev){
                const pm = {}; (prev || []).forEach(m => { if (m && m.id) pm[m.id] = m; });
                const col = db.collection(colPath(ctx.id));
                let first = true;
                (next || []).forEach(m => {
                    if (!m || !m.id) return;
                    const old = pm[m.id];
                    if (old && same(old, m)) return;
                    const data = J(m); delete data.createdAt; if (!data.ts) data.ts = Date.now();
                    if (!old){
                        if (first && onFirstWrite){ onFirstWrite(ctx.id); first = false; }
                        if (data.senderUid && data.senderUid !== me()) return;     /* অন্যের মেসেজ নতুন করে লেখা যাবে না */
                        data.createdAt = TS();
                        col.doc(m.id).set(data).catch(warn('msg add'));
                    } else {
                        /* শুধু পরিবর্তিত ফিল্ড (seen, reactions…) মার্জ */
                        const diff = {}; Object.keys(data).forEach(f => { if (!same(data[f], old[f])) diff[f] = data[f]; });
                        if (Object.keys(diff).length) col.doc(m.id).update(diff).catch(warn('msg upd'));
                    }
                });
            }
        });
    }
    msgRoute(ROOM_MSG, id => 'rooms/' + id + '/messages', null, 80);
    msgRoute(CHAT_MSG, id => 'chats/' + id + '/messages', id => {
        db.collection('chats').doc(id).set({ participants: id.split('__'), updatedAt: TS() }, { merge: true }).catch(warn('chat doc'));
    }, 150);
    /* মেসেজ ডিলিট (স্পষ্ট ডাকলেই) */
    S.deleteMessage = (kind, id, msgId) => {
        const p = kind === 'room' ? 'rooms/' + id + '/messages' : 'chats/' + id + '/messages';
        return db.collection(p).doc(msgId).delete().catch(warn('msg del'));
    };

    /* ───────── ৫) বন্ধু / রিকোয়েস্ট / ফলো / ব্লক / চ্যাট-মেটা — সাবকালেকশনের মানচিত্র ───────── */
    const enc = v => (v && typeof v === 'object' && !Array.isArray(v)) ? J(v) : { v: J(v) };
    const dec = d => { const x = norm(d.data()); return (x && Object.keys(x).length === 1 && 'v' in x) ? x.v : x; };
    function childMap(re, path, opt){
        opt = opt || {};
        S.addRoute({
            match(k){ const m = re.exec(k); return m ? { uid: m[1] } : null; },
            sub(key, ctx, push){
                if (opt.ownOnly && ctx.uid !== me()){ if (opt.foreignDoc) return opt.foreignDoc(ctx, push); push(opt.asArray ? [] : {}); return null; }
                return db.collection(path(ctx.uid)).onSnapshot(snap => {
                    const rows = []; snap.forEach(d => rows.push([d.id, dec(d), norm(d.data()).since || 0]));
                    if (opt.asArray){ rows.sort((a, b) => a[2] - b[2]); push(rows.map(r => r[0])); }
                    else { const m = {}; rows.forEach(r => { m[r[0]] = r[1]; }); push(m); }
                }, warn(path(ctx.uid)));
            },
            write(key, ctx, next, prev){
                if (opt.noWrite) return;
                const mineList = ctx.uid === me();
                const toMap = x => { if (Array.isArray(x)) { const m = {}; x.forEach(i => { m[i] = true; }); return m; } return x || {}; };
                const nm = toMap(next), pm = toMap(prev);
                const col = db.collection(path(ctx.uid));
                Object.keys(nm).forEach(k => {
                    if (same(nm[k], pm[k])) return;
                    if (!mineList && k !== me()) return;                   /* অন্যের লিস্টে শুধু নিজেকে যোগ */
                    const data = opt.asArray ? { since: TS() } : Object.assign(enc(nm[k]), { since: TS() });
                    col.doc(k).set(data).catch(warn('map set'));
                    if (mineList && opt.mirror) opt.mirror(k, true);
                });
                Object.keys(pm).forEach(k => {
                    if (k in nm) return;
                    if (!mineList && k !== me()) return;
                    col.doc(k).delete().catch(warn('map del'));
                    if (mineList && opt.mirror) opt.mirror(k, false);
                });
            }
        });
    }
    const mirrorTo = (path) => (other, add) => {
        const ref = db.collection(path(other)).doc(me());
        (add ? ref.set({ since: TS() }) : ref.delete()).catch(warn('mirror'));
    };
    childMap(/^moi_friends_([A-Za-z0-9]+)$/, u => 'friends/' + u + '/list', { mirror: mirrorTo(u => 'friends/' + u + '/list') });
    childMap(/^moi_friend_requests_([A-Za-z0-9]+)$/, u => 'friendRequests/' + u + '/incoming', {});
    childMap(/^moi_sent_requests_([A-Za-z0-9]+)$/, u => 'sentRequests/' + u + '/list', { ownOnly: true });
    childMap(/^moi_follow_([A-Za-z0-9]+)_following$/, u => 'follows/' + u + '/following', { asArray: true, mirror: mirrorTo(u => 'follows/' + u + '/followers') });
    childMap(/^moi_follow_([A-Za-z0-9]+)_followers$/, u => 'follows/' + u + '/followers', { asArray: true, noWrite: true });
    childMap(/^moi_chat_meta_([A-Za-z0-9]+)$/, u => 'chatMeta/' + u + '/with', { ownOnly: true });
    childMap(/^moi_blocked_([A-Za-z0-9]+)$/, u => 'blocked/' + u + '/list', {
        ownOnly: true,
        /* অন্যের ব্লক লিস্ট দেখা যায় না — শুধু "সে আমাকে ব্লক করেছে কি না" */
        foreignDoc(ctx, push){
            return db.collection('blocked/' + ctx.uid + '/list').doc(me()).onSnapshot(d => push(d.exists ? { [me()]: true } : {}), warn('blocked doc'));
        }
    });
    /* চ্যাট-মেটা: আমার মেসেজ পাঠালে পার্টনারের মেটায় "unread" বাড়াতে হয় */
    S.setPartnerMeta = (partner, meta) => {
        const m = Object.assign({}, meta); const inc = m.unreadInc; delete m.unreadInc;
        const d = J(m); d.since = TS();
        if (inc) d.unread = firebase.firestore.FieldValue.increment(1);
        return db.collection('chatMeta/' + partner + '/with').doc(me()).set(d, { merge: true }).catch(warn('partner meta'));
    };

    /* ───────── ৬) প্রাইভেট KV (ক্লায়েন্ট লিখতে পারে) ও সার্ভার-স্টেট (শুধু পড়া) ───────── */
    const KV_NAMES = ['prefs','stats','badges','welcomed','rooms_seen','followed_rooms','rating','support','visitors','bag','chatclr','achievements'];
    const ST_NAMES = ['checkin','spin','frames','redeemed','invited','bag_daily'];
    let kvStarted = false;
    function startKV(){
        if (kvStarted) return; kvStarted = true;
        const u = me();
        const mk = (name) => 'moi_' + name + '_' + u;
        const stopKV = db.collection('userKV/' + u + '/items').onSnapshot(snap => {
            snap.forEach(d => { const x = norm(d.data()); S.push(mk(d.id), x && 'v' in x ? x.v : x); });
            S.kvReady = true; S.schedule('moi_kv_ready');
        }, warn('kv'));
        const stopST = db.collection('userState/' + u + '/items').onSnapshot(snap => {
            snap.forEach(d => {
                const x = norm(d.data()); const v = x && 'v' in x ? x.v : x;
                const m = /^missions_(.+)$/.exec(d.id);
                S.push(m ? 'moi_missions_' + u + '_' + m[1] : mk(d.id), v);
            });
            S.stateReady = true; S.schedule('moi_state_ready');
        }, warn('state'));
        S.onStop(() => { kvStarted = false; S.kvReady = false; S.stateReady = false; stopKV(); stopST(); });
    }
    S.startKV = startKV;
    const reKV = new RegExp('^moi_(' + KV_NAMES.join('|') + ')_([A-Za-z0-9]+)$');
    const reST = new RegExp('^moi_(' + ST_NAMES.join('|') + ')_([A-Za-z0-9]+)$');
    const reMis = /^moi_missions_([A-Za-z0-9]+)_(\d{4}-\d{2}-\d{2})$/;
    S.addRoute({
        match(k){ const m = reKV.exec(k); return m && m[2] === me() ? { name: m[1] } : null; },
        sub(){ startKV(); return null; },
        write(key, ctx, next){ db.collection('userKV/' + me() + '/items').doc(ctx.name).set({ v: J(next) }).catch(warn('kv set')); },
        remove(key, ctx){ db.collection('userKV/' + me() + '/items').doc(ctx.name).delete().catch(warn('kv del')); }
    });
    S.addRoute({
        match(k){ let m = reST.exec(k); if (m && m[2] === me()) return { name: m[1] }; m = reMis.exec(k); return m && m[1] === me() ? { name: 'missions_' + m[2] } : null; },
        sub(){ startKV(); return null; }          /* শুধু পড়া — লেখা যায় না */
    });

    /* ───────── ৭) নোটিফিকেশন (Realtime DB) ───────── */
    S.addRoute({
        match(k){ const m = /^moi_notifs_([A-Za-z0-9]+)$/.exec(k); return m ? { uid: m[1] } : null; },
        sub(key, ctx, push){
            if (ctx.uid !== me()){ push([]); return null; }
            const ref = rtdb.ref(LIVE + '/notifications/' + ctx.uid);
            const cb = snap => { const v = snap.val() || {}; push(Object.keys(v).map(k => Object.assign({ id: k }, v[k])).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 60)); };
            ref.on('value', cb, warn('notifs')); return () => ref.off('value', cb);
        },
        write(key, ctx, next, prev){
            const ref = rtdb.ref(LIVE + '/notifications/' + ctx.uid);
            const pm = {}; (prev || []).forEach(n => { pm[n.id] = n; });
            const nm = {}; (next || []).forEach(n => { nm[n.id] = n; });
            Object.keys(nm).forEach(k => { if (!same(nm[k], pm[k])){ const d = J(nm[k]); delete d.id; ref.child(k).set(d).catch(warn('notif set')); } });
            if (ctx.uid === me()) Object.keys(pm).forEach(k => { if (!(k in nm)) ref.child(k).remove().catch(warn('notif rm')); });
        }
    });

    /* ───────── ৮) ওয়ালেট ইতিহাস (শুধু পড়া — সার্ভার লেখে) ───────── */
    S.addRoute({
        match(k){ const m = /^moi_wallet_tx_([A-Za-z0-9]+)$/.exec(k); return m && m[1] === me() ? {} : null; },
        sub(key, ctx, push){
            return db.collection('transactions').where('participants', 'array-contains', me()).limit(100).onSnapshot(snap => {
                const a = []; snap.forEach(d => {
                    const t = norm(d.data()); const amt = t.toUid === me() ? t.amount : -t.amount;
                    a.push({ title: t.title || t.type, amount: amt, ts: t.createdAt || 0, type: t.type });
                });
                a.sort((x, y) => y.ts - x.ts); push(a.slice(0, 50));
            }, warn('tx'));
        }
    });

    /* ───────── ৯) কোন রুমে কতজন (লাইভ উপস্থিতি) ───────── */
    S.addRoute({
        match: k => k === 'moi_room_counts' ? {} : null,
        sub(key, ctx, push){
            const ref = rtdb.ref(LIVE + '/roomPresence');
            const cb = snap => { const v = snap.val() || {}; const c = {}; Object.keys(v).forEach(r => { c[r] = Object.keys(v[r] || {}).length; }); push(c); };
            ref.on('value', cb, warn('presence')); return () => ref.off('value', cb);
        }
    });

    /* ───────── ৯.৫) কোন রুমে কে কে আছে (হোমের কার্ডে ছবি দেখানোর জন্য) — { roomId: [uid, uid, ...] } ───────── */
    S.addRoute({
        match: k => k === 'moi_room_users' ? {} : null,
        sub(key, ctx, push){
            const ref = rtdb.ref(LIVE + '/roomPresence');
            const cb = snap => { const v = snap.val() || {}; const c = {}; Object.keys(v).forEach(r => { c[r] = Object.keys(v[r] || {}).slice(0, 12); }); push(c); };
            ref.on('value', cb, warn('presence users')); return () => ref.off('value', cb);
        }
    });
    S.roomCount = id => (S.get('moi_room_counts', {}) || {})[id] || 0;
})();
