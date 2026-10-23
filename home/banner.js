/* home/banner.js — "আমার রুম" রেল (আমার রুম / জয়েন করা রুম / নতুন রুম পছন্দ-করার তালিকা) + কুইক অ্যাকশন বাটন */

console.log('[MOI] banner.js loaded');

/* ═══ কুইক অ্যাকশন — প্রতিটা বাটন আগের আসল স্ক্রিন খোলে ═══ */
const QA_DEF = [
    { cls:'a', ic:'gift',  name:'দৈনিক পুরস্কার', dot:'canCheckin', act:() => MOI.openCheckin() },
    { cls:'b', ic:'wheel', name:'ভাগ্যচক্র',        dot:'canSpin',    act:() => MOI.openSpin() },
    { cls:'c', ic:'store', name:'মুকুট ঘর',        dot:null,         act:() => MOI.openStore() },
    { cls:'d', ic:'medal', name:'ব্যাজ',            dot:null,         act:() => MOI.openBadges() }
];
function initQuickActions(){
    const box = document.getElementById('qa');
    if (!box) return;
    box.innerHTML = QA_DEF.map((q, i) => `<button class="${q.cls}" data-qi="${i}" aria-label="${q.name}" title="${q.name}">${HIC[q.ic]}<i class="pip" id="qaDot${i}" style="display:none"></i></button>`).join('');
    box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-qi]'); if (!b) return;
        if (!window.MOI){ if (window.toastMsg) toastMsg('একটু অপেক্ষা করুন…'); return; }
        QA_DEF[+b.dataset.qi].act();
    });
}
/* গোলাপি ডট: আজ নেওয়ার মতো কিছু আছে কিনা */
function refreshQuickDots(){
    if (!window.MOI || !MOI.me || !MOI.me()) return;
    QA_DEF.forEach((q, i) => {
        const d = document.getElementById('qaDot' + i);
        if (d) d.style.display = (q.dot && MOI[q.dot]()) ? 'block' : 'none';
    });
}

/* ═══ রেলের একেকটা কার্ড ═══ */
function railCap(r){
    return `<span class="live-cap">${r.listeners > 0 ? '<span class="eq"><i></i><i></i><i></i></span>' : HIC.userSm}${formatCount(r.listeners)}</span>`;
}
function railCard(r, badge, extra){
    return `<div class="rc ${badge === 'crown' ? 'mine' : ''}"><button class="rc-img" data-id="${esc(r.id)}">${coverImg(r)}${badge === 'crown' ? `<span class="bdg crown">${HIC.crown}</span>` : badge === 'join' ? `<span class="bdg join">${HIC.check}</span>` : ''}${extra || ''}${railCap(r)}</button><div class="rc-name">${esc(r.name)}</div></div>`;
}

/* ═══ রেল আঁকা ═══ */
function renderMyRail(){
    const box = document.getElementById('myRail');
    if (!box || !window.userReady) return;
    const uid = window.user.uid;
    const rooms = allRooms();
    const byId = {}; rooms.forEach(r => { byId[r.id] = r; });

    /* ১) আমার রুম — না থাকলে তৈরির বক্স */
    const mine = rooms.find(r => r.ownerUid === uid);
    window.user.myRoomUid = mine ? mine.id : (window.user.myRoomUid || '');
    let h = mine
        ? railCard(mine, 'crown')
        : `<div class="rc"><button class="rc-img empty" id="createBox" aria-label="নতুন রুম তৈরি করুন">${HIC.plus}</button><div class="rc-name hint">নতুন রুম</div></div>`;

    /* ২) যে রুমগুলোতে জয়েন/ফলো করেছি */
    const followed = getFollowedRoomIds();
    const joined = new Set(followed);
    try { getJoinedRooms().forEach(id => joined.add(id)); } catch (e) {}
    const joinedList = [...joined].map(id => byId[id]).filter(r => r && r.ownerUid !== uid).slice(0, 12);
    joinedList.forEach(r => { h += railCard(r, 'join'); });

    /* ৩) পছন্দ করার মতো অন্য রুম (❤ = ফলো, ✕ = সরান) */
    const dismissed = new Set(getDismissed());
    const taken = new Set(joinedList.map(r => r.id));
    rooms.filter(r => r.ownerUid !== uid && !taken.has(r.id) && !dismissed.has(r.id))
         .sort((a, b) => b.listeners - a.listeners).slice(0, 6)
         .forEach(r => {
            h += railCard(r, 'heart',
                `<span class="bdg heart" data-like="${esc(r.id)}" role="button" aria-label="ফলো করুন">${HIC.heart}</span><span class="x" data-dismiss="${esc(r.id)}" role="button" aria-label="সরান">${HIC.close}</span>`);
         });
    box.innerHTML = h;
}

function initMyRail(){
    const box = document.getElementById('myRail');
    box.addEventListener('click', (e) => {
        const like = e.target.closest('[data-like]');
        if (like){
            e.stopPropagation();
            const id = like.dataset.like;
            const f = getFollowedRoomIds();
            if (f.indexOf(id) < 0) f.push(id);
            setFollowed(f);
            if (window.toastMsg) toastMsg('রুমটি আপনার তালিকায় যোগ হয়েছে');
            renderMyRail();
            return;
        }
        const dm = e.target.closest('[data-dismiss]');
        if (dm){
            e.stopPropagation();
            const d = getDismissed(); d.push(dm.dataset.dismiss);
            ls_set(dismissKey(), d);
            renderMyRail();
            return;
        }
        if (e.target.closest('#createBox')){ if (window.openCreateRoom) openCreateRoom(); return; }
        const card = e.target.closest('.rc-img[data-id]');
        if (card) enterRoom(card.dataset.id);
    });
}

/* পুরনো নামগুলো অন্য ফাইলের জন্য রাখা হয়েছে */
function loadMyRoom(){ renderMyRail(); }
function renderBannerEmpty(){ renderMyRail(); }

window.initQuickActions = initQuickActions;
window.refreshQuickDots = refreshQuickDots;
window.renderMyRail = renderMyRail;
window.initMyRail = initMyRail;
window.loadMyRoom = loadMyRoom;
window.renderBannerEmpty = renderBannerEmpty;
