/* home/rooms.js — Home: "আমার রুম" (আমার রুম + ফলো/জয়েন করা রুম) ও "সুপারিশকৃত রুম" ফিড */

console.log('[MOI] rooms.js loaded');

let hotQuery = '';
let activeCategory = 'trending';
window.roomUsers = {};   /* roomId -> [uid, ...] (এখন রুমে কে কে আছে) */

/* ═══ ক্যাটাগরি (রুমের নাম/টপিক থেকে) ═══ */
function roomCategory(room){
    const n = ((room.name || '') + ' ' + (room.topic || '')).toLowerCase();
    if (/game|ludo|pubg|free ?fire|লুডু|গেম/.test(n)) return 'game';
    if (/party|night|mix|club|dance|পার্টি/.test(n)) return 'party';
    if (/music|fm|beats|pop|radio|vibes|lounge|song|গান|গজল/.test(n)) return 'music';
    return 'chat';
}
function isNewRoom(room){ return (Date.now() - (room.createdAt || 0) < 7 * 86400000); }

/* ═══ সংখ্যা সুন্দর করা (1.2K, 3.4M) ═══ */
function formatCount(n){
    n = Number(n) || 0;
    if (n >= 1000000) return (n/1000000).toFixed(2).replace(/\.00$/,'') + 'M';
    if (n >= 1000) return (n/1000).toFixed(2).replace(/\.00$/,'') + 'K';
    return String(n);
}

/* ═══ ফলো/জয়েন করা রুমের আইডি ═══ */
function getFollowedRoomIds(){
    if (!window.userReady || !window.user.uid) return [];
    return ls_get('moi_followed_rooms_' + window.user.uid, []) || [];
}

/* ═══ সব রুম (Firestore লাইভ) + শ্রোতা সংখ্যা ═══ */
function allRoomsList(){
    return Object.values(getAllRooms() || {})
        .filter(r => r && r.name)
        .map(r => ({
            id: r.id, name: r.name, logo: r.logo, topic: r.topic || '',
            country: r.country, level: r.level || 1,
            ownerUid: (r.owner && r.owner.uid) || r.ownerUid || '',
            ownerName: (r.owner && r.owner.name) || r.ownerName || '',
            ownerAvatar: (r.owner && r.owner.avatar) || r.ownerAvatar || '',
            createdAt: r.createdAt || 0,
            listeners: MOISync.roomCount(r.id)
        }));
}
const roomImg = r => r.logo || roomArt(r.id, r.name);
const userPhoto = uid => { const u = (typeof getUser === 'function' && getUser(uid)) || null; return (u && u.photo) || window.GUEST_AVATAR || ''; };

/* ═══ উপরের সারি: আমার রুম ═══ */
function mineTileHTML(r, mine){
    const title = esc(r.name || 'Room');
    const cnt = Number(r.listeners || 0);
    return `
    <button class="mine-tile room-card" data-id="${esc(r.id)}">
      <span class="mine-img">
        <img src="${esc(roomImg(r))}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src=roomArt('${esc(r.id)}','${title}')">
        <span class="mine-own"><img src="${esc(r.ownerAvatar || userPhoto(r.ownerUid))}" alt="" onerror="this.style.display='none'"></span>
        <span class="mine-cnt"><i class="fa-solid ${cnt ? 'fa-headphones' : 'fa-user'}"></i> ${formatCount(cnt)}</span>
        ${mine ? '<span class="mine-badge">আমার</span>' : ''}
      </span>
      <span class="mine-name">${title}</span>
    </button>`;
}
function renderMyRooms(){
    const el = document.getElementById('mineRow'); if (!el) return;
    if (!window.userReady){ el.innerHTML = ''; return; }
    const rooms = allRoomsList();
    const byId = {}; rooms.forEach(r => { byId[r.id] = r; });
    const mine = rooms.find(r => r.ownerUid === window.user.uid);
    const followed = getFollowedRoomIds().map(id => byId[id]).filter(r => r && r.ownerUid !== window.user.uid);
    const tiles = [];
    if (mine) tiles.push(mineTileHTML(mine, true));
    else tiles.push(`<button class="mine-tile create-tile" data-create="1"><span class="mine-img create"><i class="fa-solid fa-plus"></i></span><span class="mine-name">রুম বানান</span></button>`);
    followed.forEach(r => tiles.push(mineTileHTML(r, false)));
    el.innerHTML = tiles.join('');
}

/* ═══ ফিডের কার্ড ═══ */
function feedCardHTML(r){
    const title = esc(r.name || 'Room');
    const topic = esc(r.topic || '🎧 কথা বলুন, আড্ডা দিন, গান শুনুন');
    const flag = getFlag(r.country), country = cleanCountry(r.country) || 'Unknown';
    const ids = (window.roomUsers[r.id] || []).slice(0, 12);
    const shown = ids.slice(0, 5), more = ids.length - shown.length;
    const people = shown.length
        ? shown.map(u => `<img src="${esc(userPhoto(u))}" alt="" onerror="this.onerror=null;this.src=window.GUEST_AVATAR||''">`).join('') + (more > 0 ? `<span class="more">+${more}</span>` : '')
        : '<span class="empty-people"><i class="fa-regular fa-clock"></i> এখনো কেউ নেই — প্রথম হোন!</span>';
    return `
    <article class="feed-card room-card" data-id="${esc(r.id)}">
      <div class="fc-head">
        <img class="fc-logo" src="${esc(roomImg(r))}" alt="" loading="lazy" onerror="this.onerror=null;this.src=roomArt('${esc(r.id)}','${title}')">
        <b class="fc-name">${title}</b>
        <span class="fc-count"><i class="fa-regular fa-user"></i> ${formatCount(r.listeners)}</span>
      </div>
      <div class="fc-topic">${topic}</div>
      <div class="fc-people">${people}</div>
      <div class="fc-foot">
        <span class="fc-chip">${flag} ${esc(country)}</span>
        <span class="fc-chip lv"><i class="fa-solid fa-bolt"></i> L.${Number(r.level) || 1}</span>
        <span class="fc-chip id"># ${esc(r.id)}</span>
      </div>
    </article>`;
}
function renderHotEmpty(msg, sub){
    document.getElementById('hotGrid').innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div><h3>${esc(msg)}</h3><p>${esc(sub || '')}</p></div>`;
}

/* ═══ মূল render ═══ */
function renderHotRooms(){
    renderMyRooms();
    let list = allRoomsList().filter(r => !(window.userReady && r.ownerUid === window.user.uid));
    const q = hotQuery.trim().toLowerCase();
    if (q) list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.topic || '').toLowerCase().includes(q) || (r.country || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q) || (r.ownerName || '').toLowerCase().includes(q));
    if (activeCategory === 'nearby'){
        const mc = cleanCountry(window.user.country || '').toLowerCase();
        list = mc ? list.filter(r => cleanCountry(r.country).toLowerCase() === mc) : list;
    } else if (activeCategory === 'new') list = list.filter(isNewRoom);
    else if (['chat', 'music', 'game', 'party'].includes(activeCategory)) list = list.filter(r => roomCategory(r) === activeCategory);
    list.sort((a, b) => (b.listeners - a.listeners) || ((b.createdAt || 0) - (a.createdAt || 0)));

    const ls = document.getElementById('liveStats');
    if (ls) ls.textContent = list.length ? list.length + ' রুম লাইভ' : '';
    if (!list.length){
        if (q) renderHotEmpty('কিছু পাওয়া যায়নি', 'অন্য নাম বা দেশ দিয়ে খুঁজুন।');
        else if (activeCategory === 'nearby') renderHotEmpty('আপনার দেশে কোনো রুম নেই', 'অন্য ট্যাব দেখুন।');
        else renderHotEmpty('এখনো কোনো রুম নেই', 'উপরে "রুম বানান" চেপে প্রথম রুমটা তৈরি করুন।');
        return;
    }
    document.getElementById('hotGrid').innerHTML = list.map(feedCardHTML).join('');
}

/* ═══ রুমে কে কে আছে (Realtime DB) ═══ */
function watchRoomUsers(){
    try {
        const ref = MOIFB.rtdb.ref(MOIFB.LIVE + '/roomPresence');
        let t = null;
        ref.on('value', snap => {
            const v = snap.val() || {}, m = {};
            Object.keys(v).forEach(r => { m[r] = Object.keys(v[r] || {}); });
            window.roomUsers = m;
            clearTimeout(t); t = setTimeout(renderHotRooms, 250);
        });
    } catch(e){ console.warn('roomUsers', e); }
}

/* ═══ ইভেন্ট ═══ */
function enterRoom(id){
    if (typeof markRoomJoined === 'function') markRoomJoined(id);
    location.href = window.LINKS.room + '?room=' + encodeURIComponent(id);
}
function initRoomsUI(){
    const onTap = (e) => {
        if (e.target.closest('[data-create]')){ document.getElementById('mineBtn').click(); return; }
        const card = e.target.closest('.room-card'); if (!card || !card.dataset.id) return;
        enterRoom(card.dataset.id);
    };
    document.getElementById('hotGrid').addEventListener('click', onTap);
    document.getElementById('mineRow').addEventListener('click', onTap);

    const searchToggle = document.getElementById('searchToggle'), searchSlide = document.getElementById('searchSlide');
    const input = document.getElementById('hotSearchInput'), clear = document.getElementById('hotClearSearch');
    searchToggle.addEventListener('click', () => {
        const open = searchSlide.classList.toggle('open');
        searchToggle.classList.toggle('active', open);
        if (open) setTimeout(() => input.focus(), 300);
        else { input.value = ''; hotQuery = ''; clear.style.display = 'none'; renderHotRooms(); }
    });
    input.addEventListener('input', e => { hotQuery = e.target.value; clear.style.display = hotQuery ? 'block' : 'none'; renderHotRooms(); });
    clear.addEventListener('click', () => { input.value = ''; hotQuery = ''; clear.style.display = 'none'; renderHotRooms(); input.focus(); });

    document.querySelectorAll('#catRow .cat').forEach(btn => btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        document.querySelectorAll('#catRow .cat').forEach(b => b.classList.toggle('on', b === btn));
        renderHotRooms();
    }));

    watchRoomUsers();
    renderHotRooms();
}

window.renderHotRooms = renderHotRooms;
window.renderMyRooms = renderMyRooms;
window.initRoomsUI = initRoomsUI;
