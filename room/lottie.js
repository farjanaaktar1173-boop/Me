/* room/lottie.js — আগুনের রিং animation (Lottie) */

console.log('[ROOM] lottie.js loaded');

let _lottieData = null;
let _lottieDataPromise = null;
let _ringInstances = [];

/* ═══ Lottie ডেটা লোড ═══ */
async function loadLottieData(){
    if (_lottieData) return _lottieData;
    if (_lottieDataPromise) return _lottieDataPromise;

    _lottieDataPromise = fetch('fire_ring.json')
        .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
        .then(json => { _lottieData = json; return json; })
        .catch(err => {
            console.warn('[Lottie] load failed:', err);
            _lottieDataPromise = null;
            return null;
        });
    return _lottieDataPromise;
}

/* ═══ একটা host এর রিং মুছে ফেলা ═══ */
function destroyRingsFor(hostEl){
    _ringInstances = _ringInstances.filter(inst => {
        if (inst.hostEl === hostEl){
            try { inst.anim.destroy(); } catch(e){}
            return false;
        }
        return true;
    });
}

/* ═══ সব রিং মুছে ফেলা ═══ */
function destroyAllRings(){
    _ringInstances.forEach(inst => { try { inst.anim.destroy(); } catch(e){} });
    _ringInstances = [];
    document.querySelectorAll('.lottie-ring').forEach(el => el.remove());
}

/* ═══ একটা host এ রিং যোগ ═══ */
async function attachRing(hostEl){
    if (!hostEl || !window.lottie) return null;
    destroyRingsFor(hostEl);

    const old = hostEl.querySelector(':scope > .lottie-ring');
    if (old) old.remove();

    const ring = document.createElement('div');
    ring.className = 'lottie-ring';
    hostEl.appendChild(ring);

    const data = await loadLottieData();
    if (!data){ ring.remove(); return null; }

    try {
        const anim = window.lottie.loadAnimation({
            container: ring,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: JSON.parse(JSON.stringify(data))
        });
        _ringInstances.push({ hostEl, anim, ringEl: ring });
        return anim;
    } catch(e){
        console.warn('[Lottie] render failed:', e);
        ring.remove();
        return null;
    }
}

/* ═══ সব জায়গায় রিং refresh ═══ */
function refreshAllRings(){
    if (!myProfile || !window.lottie) return;
    destroyAllRings();
    const targets = [];

    /* top bar এর avatar */
    const topWrap = $('my-avatar-wrap');
    if (topWrap) targets.push(topWrap);

    /* প্রতিটা seat */
    document.querySelectorAll('.seat').forEach(seatEl => {
        const idx = +seatEl.dataset.seat;
        const s = state.seats[idx];
        if (s && s.uid){
            const av = seatEl.querySelector('.seat-avatar');
            if (av) targets.push(av);
        }
    });

    /* listeners modal এ */
    document.querySelectorAll('.listener-user-card').forEach(card => {
        const av = card.querySelector('.listener-user-avatar');
        if (av) targets.push(av);
    });

    /* members modal এ */
    document.querySelectorAll('.user-card').forEach(card => {
        const av = card.querySelector('.user-avatar-box');
        if (av) targets.push(av);
    });

    /* profile modal এ */
    const profModal = $('userProfileModal');
    if (profModal && profModal.classList.contains('active')){
        const wrap = document.querySelector('.profile-avatar-wrap');
        if (wrap) targets.push(wrap);
    }

    targets.forEach(el => attachRing(el));
}

/* ═══ শুধু top bar ring refresh ═══ */
async function refreshTopBarRing(){
    const wrap = $('my-avatar-wrap');
    if (wrap) await attachRing(wrap);
}

window.destroyAllRings = destroyAllRings;
window.destroyRingsFor = destroyRingsFor;
window.attachRing = attachRing;
window.refreshAllRings = refreshAllRings;
window.refreshTopBarRing = refreshTopBarRing;