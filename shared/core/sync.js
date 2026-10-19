/* shared/core/sync.js — localStorage-এর জায়গায় Firebase (রিয়েল-টাইম ক্যাশ ইঞ্জিন)
   পুরনো কোড ls_get / ls_set ব্যবহার করে — এখান থেকে সেগুলো Firebase-এ যায়।
   ▸ পড়া  : মেমোরি-ক্যাশ থেকে সাথে সাথে (Firebase থেকে লাইভ আপডেট হয়)
   ▸ লেখা  : ক্যাশে সাথে সাথে + Firebase-এ পেছনে
   ▸ রুট নেই এমন key (theme, lang ...) → আগের মতো localStorage */
console.log('[MOI] sync.js loaded');

(function(){
    'use strict';
    const cache = Object.create(null);     /* key → মান */
    const subs  = Object.create(null);     /* key → বন্ধ করার ফাংশন */
    const routes = [];
    const pending = new Set();
    let myUid = null, flushTimer = null;
    const stopFns = [];

    const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    const same  = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    /* Firestore Timestamp → মিলিসেকেন্ড (গভীরে গিয়ে) */
    function norm(v){
        if (v == null) return v;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (Array.isArray(v)) return v.map(norm);
        if (typeof v === 'object'){ const o = {}; for (const k in v) o[k] = norm(v[k]); return o; }
        return v;
    }

    /* ক্যাশ বদলালে পেজকে জানানো (পুরনো 'storage' ইভেন্টের মতো + নতুন moi:sync) */
    function schedule(key){
        pending.add(key);
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            const keys = [...pending]; pending.clear();
            keys.forEach(k => {
                try { window.dispatchEvent(new StorageEvent('storage', { key: k })); } catch(e){}
                window.dispatchEvent(new CustomEvent('moi:sync', { detail: { key: k } }));
            });
        }, 40);
    }

    /* রুট ইঞ্জিন → ক্যাশে নতুন মান ঢোকানো */
    function push(key, val){
        if (val === null || val === undefined){
            if (cache[key] !== undefined){ delete cache[key]; schedule(key); }
            else schedule(key);          /* প্রথম "খালি" স্ন্যাপশটও জানাই */
            return;
        }
        if (same(cache[key], val)) return;
        cache[key] = clone(val);
        schedule(key);
    }

    function matchRoute(key){
        if (typeof key !== 'string' || key.indexOf('moi_') !== 0) return null;
        for (const r of routes){ const ctx = r.match(key); if (ctx) return { r, ctx }; }
        return null;
    }

    function ensure(key, m){
        if (!myUid || subs[key] || !m.r.sub) return;
        subs[key] = true;
        try {
            const stop = m.r.sub(key, m.ctx, v => push(key, v));
            subs[key] = stop || true;
        } catch(e){ console.warn('[sync] sub failed', key, e); }
    }

    /* ═══ পাবলিক API ═══ */
    const local = {
        get(key, fb){ try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } },
        set(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} },
        remove(key){ try { localStorage.removeItem(key); } catch(e){} }
    };

    const MOISync = {
        addRoute(r){ routes.push(r); },
        get(key, fb){
            const m = matchRoute(key);
            if (!m) return local.get(key, fb === undefined ? null : fb);
            ensure(key, m);
            const v = cache[key];
            return v === undefined ? (fb === undefined ? null : fb) : clone(v);
        },
        set(key, val){
            const m = matchRoute(key);
            if (!m){ local.set(key, val); return; }
            const prev = cache[key];
            const next = clone(val);
            if (next === undefined) return;
            cache[key] = next;
            if (myUid && m.r.write){
                try { m.r.write(key, m.ctx, next, prev); } catch(e){ console.warn('[sync] write failed', key, e); }
            }
        },
        remove(key){
            const m = matchRoute(key);
            if (!m){ local.remove(key); return; }
            const prev = cache[key]; delete cache[key];
            if (myUid && m.r.remove){ try { m.r.remove(key, m.ctx, prev); } catch(e){ console.warn('[sync] remove failed', key, e); } }
        },
        /* ক্যাশে সরাসরি ঢোকানো (রুট ইঞ্জিন বা একটানা লিসেনারের জন্য) */
        push, norm, clone, same, schedule,
        has: key => cache[key] !== undefined,
        peek: key => cache[key],
        onStop(fn){ stopFns.push(fn); },
        get uid(){ return myUid; },
        /* লগইনের পর চালু */
        async start(uid, coreKeys){
            if (myUid === uid) return;
            this.stop();
            myUid = uid;
            const waits = [];
            (coreKeys || []).forEach(k => {
                const m = matchRoute(k);
                if (!m) return;
                waits.push(new Promise(res => {
                    ensure(k, m);
                    const t = setTimeout(res, 9000);
                    const h = e => { if (e.detail && e.detail.key === k){ clearTimeout(t); window.removeEventListener('moi:sync', h); res(); } };
                    window.addEventListener('moi:sync', h);
                    if (cache[k] !== undefined){ clearTimeout(t); window.removeEventListener('moi:sync', h); res(); }
                }));
            });
            await Promise.all(waits);
        },
        stop(){
            Object.keys(subs).forEach(k => { try { if (typeof subs[k] === 'function') subs[k](); } catch(e){} delete subs[k]; });
            stopFns.splice(0).forEach(f => { try { f(); } catch(e){} });
            Object.keys(cache).forEach(k => delete cache[k]);
            myUid = null;
        },
        /* এক-লাইনে রুম/চ্যাট ওপেন হলে লাইভ সাবস্ক্রিপশন নিশ্চিত করা */
        watch(key){ const m = matchRoute(key); if (m) ensure(key, m); }
    };
    window.MOISync = MOISync;
})();
