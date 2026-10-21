/* room/lottie.js — প্রতিটা ইউজারের পরা মুকুট (Lottie) সিট ও প্রোফাইলের ছবির চারপাশে
   মুকুটের আসল কোড shared/features.js এ (MOI.crownAttachUser) — এখানে শুধু রুমের কোন কোন ছবিতে বসবে সেটা ঠিক করা।
   ফাইল: moi/crowns/*.json • যার মুকুট নেই তার ছবিতে কিছু বসে না। */

console.log('[ROOM] lottie.js loaded');

const _crownApi = () => (window.MOI && MOI.crownAttachUser) ? MOI : null;

/* ═══ DOM থেকে মুছে যাওয়া ছবির অ্যানিমেশন বন্ধ ═══ */
function destroyAllRings(){ const m = _crownApi(); if (m) m.crownPrune(); }

/* ═══ একটা host এর মুকুট মুছে ফেলা ═══ */
function destroyRingsFor(hostEl){ const m = _crownApi(); if (m) m.crownDestroy(hostEl); }

/* ═══ একটা host এ ইউজারের মুকুট বসানো ═══ */
function attachRing(hostEl, uid){
    const m = _crownApi(); if (!m || !hostEl) return null;
    const id = uid || (myProfile && myProfile.uid);
    return m.crownAttachUser(hostEl, getUser(id));
}

/* ═══ সব জায়গায় মুকুট refresh (একই মুকুট হলে অ্যানিমেশন নতুন করে শুরু হয় না) ═══ */
function refreshAllRings(){
    const m = _crownApi(); if (!m || !myProfile) return;
    m.crownPrune();

    /* প্রতিটা seat */
    document.querySelectorAll('.seat').forEach(seatEl => {
        const idx = +seatEl.dataset.seat;
        const s = state.seats[idx];
        const av = seatEl.querySelector('.seat-avatar');
        if (!av) return;
        if (s && s.uid) attachRing(av, s.uid); else destroyRingsFor(av);
    });

    /* profile modal এ */
    const profModal = $('userProfileModal');
    if (profModal && profModal.classList.contains('active') && typeof currentProfileUid !== 'undefined' && currentProfileUid){
        const wrap = document.querySelector('.profile-avatar-wrap');
        if (wrap) attachRing(wrap, currentProfileUid);
    }
}

/* আগের কোডের সাথে মিল রাখতে (এখন উপরের বারে মুকুট বসে না) */
async function refreshTopBarRing(){ }

window.destroyAllRings = destroyAllRings;
window.destroyRingsFor = destroyRingsFor;
window.attachRing = attachRing;
window.refreshAllRings = refreshAllRings;
window.refreshTopBarRing = refreshTopBarRing;
