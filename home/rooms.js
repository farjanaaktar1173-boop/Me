/* home/rooms.js — Hot Rooms গ্রিড, ফিল্টার, সার্চ */

console.log('[MOI] rooms.js loaded');

let hotQuery = '';
let activeFilter = 'all';
let selectedCountry = 'all';
let activeCategory = 'all';

/* ═══ রুমের ক্যাটাগরি (নাম থেকে) ═══ */
function roomCategory(room){
    const n = (room.name || '').toLowerCase();
    if (/party|night|mix|club|dance/.test(n)) return 'party';
    if (/music|fm|beats|pop|radio|vibes|lounge|song/.test(n)) return 'music';
    return 'chat';
}
function isNewRoom(room){
    return (Date.now() - (room.createdAt || 0) < 7 * 86400000);
}

/* ═══ সংখ্যা সুন্দর করা (1.2K, 3.4M) ═══ */
function formatCount(n){
    n = Number(n) || 0;
    if (n >= 1000000) return (n/1000000).toFixed(2).replace(/\.00$/,'') + 'M';
    if (n >= 1000) return (n/1000).toFixed(2).replace(/\.00$/,'') + 'K';
    return String(n);
}

/* ═══ Followed rooms — localStorage থেকে পড়া ═══ */
function getFollowedRoomIds(){
    if (!window.userReady || !window.user.uid) return [];
    return ls_get('moi_followed_rooms_' + window.user.uid, []) || [];
}

/* ═══ একটা রুম কার্ডের HTML ═══ */
function hotCardHTML(room, rank, isDemo){
    const title = esc(room.name || 'Untitled Room');
    const isMine = room.ownerUid === window.user.uid;
    const listeners = Number(room.listeners || 0);
    const img = room.logo || room.img || roomArt(room.id, room.name || room.title);
    const level = Number(room.level || 0);
    const flag = getFlag(room.country);
    const countryClean = cleanCountry(room.country) || 'Unknown';

    let rankHTML = '';
    if (rank <= 3 && listeners > 0 && !isMine){
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
        const cls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
        rankHTML = `<div class="rank-badge-outside ${cls}">${medal}</div>`;
    }

    let topBadge = '';
    if (isMine) topBadge = `<span class="badge-mine"><i class="fa-solid fa-crown"></i> You</span>`;
    else topBadge = `<span class="badge-level"><i class="fa-solid fa-bolt"></i> L.${level}</span>`;

    return `
    <div class="room-card" data-id="${esc(room.id)}" data-demo="${isDemo ? '1' : '0'}">
      ${rankHTML}
      <div class="gold-frame">
        <div class="card-inner">
          <img src="${esc(img)}" alt="${title}" loading="lazy"
               onerror="this.onerror=null;this.src=roomArt('${esc(room.id)}','${esc(title)}')">
          <div class="card-overlay"></div>
          <div class="card-top">${topBadge}<span class="live-pill"><span class="eq"><i></i><i></i><i></i></span>LIVE</span></div>
          <div class="room-info">
            <div class="room-title">${title}</div>
            <div class="room-stats">
              <span class="flag-country"><span class="flag">${flag}</span><span class="cname">${esc(countryClean)}</span></span>
              <span class="count"><i class="fa-solid fa-headphones"></i> ${formatCount(listeners)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ═══ খালি অবস্থার মেসেজ ═══ */
function renderHotEmpty(msg, sub, showBackBtn){
    const backBtn = showBackBtn ? `<button class="back-hot-btn" id="backToHotBtn"><i class="fa-solid fa-arrow-left"></i> Back to Hot</button>` : '';
    document.getElementById('hotGrid').innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div><h3>${esc(msg)}</h3><p>${esc(sub)}</p>${backBtn}</div>`;
    if (showBackBtn){
        const b = document.getElementById('backToHotBtn');
        if (b) b.addEventListener('click', () => {
            activeFilter = 'all';
            const fb = document.getElementById('followingBtn');
            if (fb) fb.classList.remove('active');
            renderHotRooms();
        });
    }
}

/* ═══ মূল render — Hot list / Following / Country filter ═══ */
function renderHotRooms(){
    /* ১) সব আসল রুম (Firestore থেকে লাইভ) — শ্রোতার সংখ্যা Realtime DB-র উপস্থিতি থেকে */
    const roomsMap = getAllRooms();
    let combined = Object.values(roomsMap)
        .filter(r => r && r.name)
        .map(r => ({
            id: r.id, name: r.name, logo: r.logo, img: null,
            country: r.country, level: r.level || 1,
            ownerUid: (r.owner && r.owner.uid) || r.ownerUid || '',
            ownerName: (r.owner && r.owner.name) || r.ownerName || '',
            createdAt: r.createdAt || 0,
            listeners: MOISync.roomCount(r.id),
            isDemo: false
        }));

    /* ৩) সার্চ ফিল্টার */
    const q = hotQuery.trim().toLowerCase();
    if (q){
        combined = combined.filter(r =>
            (r.name || '').toLowerCase().includes(q) ||
            (r.country || '').toLowerCase().includes(q) ||
            (r.id || '').toLowerCase().includes(q) ||
            (r.ownerName || '').toLowerCase().includes(q)
        );
    }

    /* ৪) Following ট্যাব — আমার রুম + join করা রুম */
    if (activeFilter === 'following'){
        const followedIds = getFollowedRoomIds();
        combined = combined.filter(r =>
            (window.userReady && r.ownerUid === window.user.uid) ||
            (followedIds.indexOf(r.id) > -1)
        );
    }

    /* ৪.৫) ক্যাটাগরি */
    if (activeCategory !== 'all'){
        combined = combined.filter(r => activeCategory === 'new' ? isNewRoom(r) : roomCategory(r) === activeCategory);
    }

    /* ৫) Country filter */
    if (selectedCountry && selectedCountry !== 'all'){
        const target = selectedCountry.toLowerCase().trim();
        combined = combined.filter(r => cleanCountry(r.country).toLowerCase() === target);
    }

    /* ৬) Sort — আমার রুম সবার উপরে, তারপর বেশি audience যার সে উপরে */
    combined.sort((a, b) => {
        const aMine = window.userReady && a.ownerUid === window.user.uid;
        const bMine = window.userReady && b.ownerUid === window.user.uid;
        if (aMine !== bMine) return aMine ? -1 : 1;
        if (b.listeners !== a.listeners) return b.listeners - a.listeners;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    /* ৭) রেন্ডার */
    if (!combined.length){
        if (activeFilter === 'following') renderHotEmpty('কোনো Following রুম নেই', 'রুমে ঢুকে Join চাপলে এখানে যোগ হবে।', true);
        else if (q) renderHotEmpty('কিছু পাওয়া যায়নি', 'অন্য নাম বা দেশ দিয়ে খুঁজুন।', false);
        else if (activeCategory !== 'all') renderHotEmpty('এই ক্যাটাগরিতে কোনো রুম নেই', 'অন্য ক্যাটাগরি বেছে নিন।', false);
        else if (selectedCountry !== 'all') renderHotEmpty('এই দেশে কোনো রুম নেই', 'দেশ পরিবর্তন করুন বা ফিল্টার ক্লিয়ার করুন।', false);
        else renderHotEmpty('এখনো কোনো রুম নেই', 'উপরের CREATE থেকে নিজের রুম তৈরি করুন।', false);
        return;
    }

    const ls = document.getElementById('liveStats');
    if (ls){
        const tot = combined.reduce((a, x) => a + (Number(x.listeners) || 0), 0);
        ls.innerHTML = `<span><b>${combined.length}</b> রুম লাইভ</span><i></i><span><b>${formatCount(tot)}</b> জন শুনছে</span>`;
    }
    document.getElementById('hotGrid').innerHTML = combined.map((r, i) => hotCardHTML(r, i + 1, r.isDemo)).join('');
}

/* ═══ সব ইভেন্ট বাঁধা ═══ */
function initRoomsUI(){
    const hotGrid = document.getElementById('hotGrid');
    const followingBtn = document.getElementById('followingBtn');
    const countryFilter = document.getElementById('countryFilter');
    const flagPreview = document.getElementById('flagPreview');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const searchToggle = document.getElementById('searchToggle');
    const searchSlide = document.getElementById('searchSlide');
    const hotSearchInput = document.getElementById('hotSearchInput');
    const hotClear = document.getElementById('hotClearSearch');

    hotGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.room-card');
        if (!card) return;
        const id = card.dataset.id;
        if (!id) return;
        markRoomJoined(id);
        location.href = window.LINKS.room + '?room=' + encodeURIComponent(id);
    });

    followingBtn.addEventListener('click', () => {
        activeFilter = (activeFilter === 'following') ? 'all' : 'following';
        followingBtn.classList.toggle('active', activeFilter === 'following');
        renderHotRooms();
        if (activeFilter === 'following') window.scrollTo({ top:0, behavior:'smooth' });
    });

    countryFilter.addEventListener('change', (e) => {
        selectedCountry = e.target.value;
        flagPreview.textContent = selectedCountry === 'all' ? '🌍' : (FLAGS[selectedCountry] || '🌍');
        clearFilterBtn.classList.toggle('show', selectedCountry !== 'all');
        renderHotRooms();
    });

    clearFilterBtn.addEventListener('click', () => {
        selectedCountry = 'all';
        countryFilter.value = 'all';
        flagPreview.textContent = '🌍';
        clearFilterBtn.classList.remove('show');
        renderHotRooms();
    });

    searchToggle.addEventListener('click', () => {
        const isOpen = searchSlide.classList.toggle('open');
        searchToggle.classList.toggle('active', isOpen);
        if (isOpen) setTimeout(() => hotSearchInput.focus(), 300);
        else {
            hotSearchInput.value = '';
            hotQuery = '';
            hotClear.style.display = 'none';
            renderHotRooms();
        }
    });

    hotSearchInput.addEventListener('input', (e) => {
        hotQuery = e.target.value;
        hotClear.style.display = hotQuery ? 'block' : 'none';
        renderHotRooms();
    });

    hotClear.addEventListener('click', () => {
        hotSearchInput.value = '';
        hotQuery = '';
        hotClear.style.display = 'none';
        renderHotRooms();
        hotSearchInput.focus();
    });

    document.querySelectorAll('#catRow .cat').forEach(btn => btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        document.querySelectorAll('#catRow .cat').forEach(b => b.classList.toggle('on', b === btn));
        renderHotRooms();
    }));

    renderHotRooms();
}

window.renderHotRooms = renderHotRooms;
window.initRoomsUI = initRoomsUI;
window.getFollowedRoomIds = getFollowedRoomIds;
