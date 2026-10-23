/* home/rooms.js — "তোমার জন্য লাইভ রুম" কার্ড, ক্যাটাগরি, সার্চ, আবিষ্কার (দেশ), মিনি-প্লেয়ার */

console.log('[MOI] rooms.js loaded');

let hotQuery = '';
let activeCat = 'all';
let exploreCountry = 'all';
let shuffleOrder = null;          /* শাফেল বাটন চাপলে র‍্যান্ডম ক্রম */

/* ═══ ক্যাটাগরি (নাম বদলাতে চাইলে শুধু এখানে) ═══ */
const CAT_DEF = [
    ['all',    'spark', 'সেরা'],
    ['nearby', 'pin',   'পাড়া'],
    ['new',    'star',  'নতুন'],
    ['ludo',   'pawn',  'ঘুঁটি'],
    ['game',   'bolt',  'অ্যারেনা'],
    ['music',  'note',  'সুরলোক']
];
const RX_MUSIC = /music|fm|beats|pop|radio|vibes|lounge|song|গান|সুর|মিউজিক|রেডিও/i;
const RX_LUDO  = /ludo|লুডু|ঘুঁটি/i;
const RX_GAME  = /game|গেম|pk|battle|অ্যারেনা|free ?fire/i;

/* রুমটা কোন ধরনের (কার্ডের ট্যাগ + ফিল্টারের জন্য) */
function roomKind(r){
    const s = (r.name || '') + ' ' + (r.topic || '') + ' ' + (r.category || '');
    if (RX_LUDO.test(s)) return 'ludo';
    if (RX_GAME.test(s) || r.pk) return 'game';
    if (RX_MUSIC.test(s)) return 'music';
    return 'chat';
}
const KIND_LABEL = { ludo:'ঘুঁটি', game:'অ্যারেনা', music:'সুরলোক', chat:'আড্ডা' };

function isNewRoom(r){ return (Date.now() - (Number(r.createdAt) || 0)) < 7 * 86400000; }

function formatCount(n){
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.00$/, '') + 'K';
    return String(n);
}

/* ═══ ফলো / ডিসমিস করা রুম (localStorage) ═══ */
function followKey(){ return 'moi_followed_rooms_' + (window.user.uid || ''); }
function dismissKey(){ return 'moi_dismissed_rooms_' + (window.user.uid || ''); }
function getFollowedRoomIds(){
    if (!window.userReady || !window.user.uid) return [];
    return ls_get(followKey(), []) || [];
}
function setFollowed(arr){ ls_set(followKey(), arr); }
function getDismissed(){ return (window.userReady && ls_get(dismissKey(), [])) || []; }

/* ═══ সব আসল রুম — Firestore থেকে লাইভ; শ্রোতা ও ইউজার Realtime DB-র উপস্থিতি থেকে ═══ */
function allRooms(){
    const map = getAllRooms();
    const presence = (window.MOISync && MOISync.get && MOISync.get('moi_room_users', {})) || {};
    return Object.values(map).filter(r => r && r.name).map(r => ({
        id: r.id, name: r.name, logo: r.logo || '',
        country: r.country || '', topic: r.topic || '', category: r.category || '',
        ownerUid: (r.owner && r.owner.uid) || r.ownerUid || '',
        ownerName: (r.owner && r.owner.name) || r.ownerName || '',
        createdAt: r.createdAt || 0,
        pk: !!r.pkActive,
        listeners: MOISync.roomCount(r.id),
        uids: presence[r.id] || []
    }));
}
window.allRooms = allRooms;

/* ═══ ছোট HTML টুকরো ═══ */
const HUES = [[255,138,92,255,61,129],[63,194,160,24,120,200],[255,200,60,255,120,40],[120,110,255,200,80,230],[90,200,120,20,140,110],[255,110,140,160,60,200],[60,170,255,40,90,220],[240,120,70,180,40,70]];
function hashStr(s){ let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function gradFor(seed){ const h = HUES[hashStr(seed) % HUES.length]; return `linear-gradient(135deg,rgb(${h[0]},${h[1]},${h[2]}),rgb(${h[3]},${h[4]},${h[5]}))`; }

/* রুমের ছবি — না থাকলে/লোড না হলে নিজের আঁকা কভার (roomArt) */
function coverImg(r){
    const src = r.logo || roomArt(r.id, r.name);
    return `<img class="cimg" src="${esc(src)}" alt="" loading="lazy" data-fb="1" data-rid="${esc(r.id)}" data-rn="${esc(r.name)}">`;
}
document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset && t.dataset.rid && !t.dataset.ra){
        t.dataset.ra = '1';
        t.src = roomArt(t.dataset.rid, t.dataset.rn || '');
    }
}, true);

/* ইউজারের গোল ছবি (host=true হলে মাথায় মুকুট) */
function avatarHTML(uid, host){
    const u = getUser(uid) || {};
    const nm = (u.name || '?').trim();
    const inner = u.photo ? `<img src="${esc(u.photo)}" alt="" data-fb="1">` : esc(nm[0] || '?');
    return `<div class="av" data-uid="${esc(uid)}" style="${u.photo ? '' : 'background:' + gradFor(uid)}" title="${esc(nm)}">${inner}${host ? `<span class="hc">${HIC.crown}</span>` : ''}</div>`;
}

/* রুমে এখন যারা আছে — মালিক সবার আগে, সর্বোচ্চ ৫ জন */
function roomUsers(r){
    const list = r.uids.slice();
    const oi = list.indexOf(r.ownerUid);
    if (oi > 0){ list.splice(oi, 1); list.unshift(r.ownerUid); }
    if (!list.length && r.ownerUid) list.push(r.ownerUid);
    return list.slice(0, 5);
}

/* ═══ রুম কার্ড ═══ */
function hotCardHTML(r){
    const kind = roomKind(r);
    const users = roomUsers(r);
    const topic = r.topic || (r.ownerName ? 'হোস্ট: ' + r.ownerName : 'স্বাগতম! রুমে ঢুকে আড্ডা দিন।');
    const flag = getFlag(r.country);
    const cname = cleanCountry(r.country) || 'Unknown';
    const live = r.listeners > 0;
    return `
    <button class="hot" data-id="${esc(r.id)}">
      <div class="cov">${coverImg(r)}${live ? '<span class="lv">LIVE</span>' : ''}</div>
      <div class="hot-body">
        <div class="l1"><div class="hn">${esc(r.name)}</div><div class="cnt">${HIC.userSm}${formatCount(r.listeners)}</div></div>
        <div class="tp">${esc(topic)}</div>
        <div class="l3">
          <div class="stack">${users.map((uid, k) => avatarHTML(uid, uid === r.ownerUid && k === 0)).join('')}</div>
          <div class="chips">${r.pk ? '<span class="chip pk">PK</span>' : ''}<span class="chip cn" title="${esc(cname)}"><span class="fl">${flag}</span><span>${KIND_LABEL[kind]}</span></span></div>
        </div>
      </div>
    </button>`;
}

/* প্রথম কার্ডের পর "আজকের বোনাস" ব্যানার → আগের চেক-ইন স্ক্রিন */
function bonusBannerHTML(){
    return `<button class="mission" data-bonus><span class="gem">${HIC.gem}</span><span class="tx"><b>আজকের বোনাস</b><small>চেক-ইন করে ফ্রি ডায়মন্ড নিন</small></span><span class="go">নিন</span></button>`;
}

function emptyHTML(msg, sub, back){
    return `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div><h3>${esc(msg)}</h3><p>${esc(sub)}</p>${back ? '<button class="back-hot-btn" data-backhot><i class="fa-solid fa-arrow-left"></i> সব রুম দেখুন</button>' : ''}</div>`;
}

/* ═══ ফিল্টার + সাজানো ═══ */
function filterRooms(list, opts){
    const q = hotQuery.trim().toLowerCase();
    if (q){
        list = list.filter(r =>
            (r.name || '').toLowerCase().includes(q) ||
            (r.country || '').toLowerCase().includes(q) ||
            (r.id || '').toLowerCase().includes(q) ||
            (r.ownerName || '').toLowerCase().includes(q) ||
            (r.topic || '').toLowerCase().includes(q));
    }
    if (opts.cat && opts.cat !== 'all'){
        const myC = cleanCountry(window.user && window.user.country).toLowerCase();
        list = list.filter(r => {
            if (opts.cat === 'new') return isNewRoom(r);
            if (opts.cat === 'nearby') return !!myC && cleanCountry(r.country).toLowerCase() === myC;
            return roomKind(r) === opts.cat;
        });
    }
    if (opts.country && opts.country !== 'all'){
        const t = opts.country.toLowerCase();
        list = list.filter(r => cleanCountry(r.country).toLowerCase() === t);
    }
    list = list.slice().sort((a, b) => {
        if (shuffleOrder) return (shuffleOrder[a.id] || 0) - (shuffleOrder[b.id] || 0);
        if (b.listeners !== a.listeners) return b.listeners - a.listeners;
        return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
    return list;
}

/* ═══ মূল রেন্ডার — হোম ফিড + আবিষ্কার + মিনি-প্লেয়ার ═══ */
function renderHotRooms(){
    const rooms = allRooms();
    const mineId = window.userReady ? window.user.uid : '';
    const forFeed = rooms.filter(r => r.ownerUid !== mineId);        /* আমার রুম আলাদা রেলে আছে */

    /* ক্যাটাগরি চিপ */
    const catsEl = document.getElementById('cats');
    if (catsEl) catsEl.innerHTML = CAT_DEF.map(([k, ic, l]) => `<button class="cat ${k === activeCat ? 'on' : ''}" data-cat="${k}">${HIC[ic]}${l}</button>`).join('');

    const list = filterRooms(forFeed, { cat: activeCat });
    const feed = document.getElementById('feed');
    if (!list.length){
        const q = hotQuery.trim();
        if (q) feed.innerHTML = emptyHTML('কিছু পাওয়া যায়নি', 'অন্য নাম বা দেশ দিয়ে খুঁজুন।', false);
        else if (activeCat !== 'all') feed.innerHTML = emptyHTML('এই ক্যাটাগরিতে কোনো রুম নেই', 'অন্য ক্যাটাগরি বেছে নিন।', true);
        else feed.innerHTML = emptyHTML('এখনো কোনো রুম নেই', 'উপরের + থেকে নিজের রুম তৈরি করুন।', false);
    } else {
        feed.innerHTML = list.map((r, i) => hotCardHTML(r) + (i === 0 ? bonusBannerHTML() : '')).join('');
    }

    /* লাইভ পরিসংখ্যান */
    const ls = document.getElementById('liveStats');
    if (ls){
        const tot = rooms.reduce((a, x) => a + (Number(x.listeners) || 0), 0);
        ls.innerHTML = rooms.length ? `<span><b>${rooms.length}</b> রুম লাইভ</span><i></i><span><b>${formatCount(tot)}</b> জন শুনছে</span>` : '';
    }

    renderExplore(rooms);
    renderDisc(rooms);
}

/* ═══ আবিষ্কার ট্যাব — দেশ বেছে রুম দেখা ═══ */
function renderExplore(rooms){
    const row = document.getElementById('countryRow');
    const feed = document.getElementById('exploreFeed');
    if (!row || !feed) return;
    const present = {};
    rooms.forEach(r => { const c = cleanCountry(r.country); if (c) present[c] = (present[c] || 0) + 1; });
    const names = Object.keys(present).sort((a, b) => present[b] - present[a]);
    row.innerHTML = `<button class="cat ${exploreCountry === 'all' ? 'on' : ''}" data-country="all">${HIC.live}সব দেশ</button>` +
        names.map(c => `<button class="cat ${exploreCountry.toLowerCase() === c.toLowerCase() ? 'on' : ''}" data-country="${esc(c)}"><span style="font-size:14px;line-height:1">${getFlag(c)}</span>${esc(c)}</button>`).join('');
    const list = filterRooms(rooms, { country: exploreCountry });
    feed.innerHTML = list.length ? list.map(hotCardHTML).join('') : emptyHTML('এই দেশে কোনো রুম নেই', 'অন্য দেশ বেছে নিন।', false);
}

/* ═══ মিনি-প্লেয়ার — আমি যে রুমে এখন আছি সেটার ঘুরন্ত ডিস্ক ═══ */
function renderDisc(rooms){
    const p = document.getElementById('player');
    if (!p) return;
    const uid = window.user && window.user.uid;
    const cur = uid ? (rooms || allRooms()).find(r => r.uids.indexOf(uid) > -1) : null;
    if (!cur){ p.hidden = true; p.dataset.id = ''; return; }
    p.hidden = false;
    p.dataset.id = cur.id;
    p.innerHTML = `<div class="in"><img class="cimg" src="${esc(cur.logo || roomArt(cur.id, cur.name))}" alt="" data-fb="1" data-rid="${esc(cur.id)}" data-rn="${esc(cur.name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div><span class="ew"><span class="eq"><i></i><i></i><i></i></span></span>`;
}

/* ═══ রুমে ঢোকা ═══ */
function enterRoom(id){
    if (!id) return;
    markRoomJoined(id);
    location.href = window.LINKS.room + '?room=' + encodeURIComponent(id);
}
window.enterRoom = enterRoom;

/* ═══ ইভেন্ট বাঁধা ═══ */
function initRoomsUI(){
    const searchToggle = document.getElementById('searchToggle');
    const searchSlide = document.getElementById('searchSlide');
    const input = document.getElementById('hotSearchInput');

    const onCard = (e) => {
        if (e.target.closest('[data-bonus]')){ if (window.MOI) MOI.openCheckin(); return; }
        const back = e.target.closest('[data-backhot]');
        if (back){ activeCat = 'all'; exploreCountry = 'all'; renderHotRooms(); return; }
        const card = e.target.closest('.hot');
        if (card) enterRoom(card.dataset.id);
    };
    document.getElementById('feed').addEventListener('click', onCard);
    document.getElementById('exploreFeed').addEventListener('click', onCard);

    document.getElementById('cats').addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        activeCat = b.dataset.cat; shuffleOrder = null; renderHotRooms();
    });
    document.getElementById('countryRow').addEventListener('click', (e) => {
        const b = e.target.closest('[data-country]'); if (!b) return;
        exploreCountry = b.dataset.country; renderHotRooms();
    });

    document.getElementById('btnShuffle').addEventListener('click', () => {
        shuffleOrder = {};
        allRooms().forEach(r => { shuffleOrder[r.id] = Math.random(); });
        const b = document.getElementById('btnShuffle');
        b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
        renderHotRooms();
    });

    searchToggle.addEventListener('click', () => {
        const open = searchSlide.classList.toggle('open');
        if (open) setTimeout(() => input.focus(), 150);
        else { input.value = ''; hotQuery = ''; renderHotRooms(); }
    });
    input.addEventListener('input', (e) => { hotQuery = e.target.value; renderHotRooms(); });

    document.getElementById('player').addEventListener('click', () => {
        const id = document.getElementById('player').dataset.id;
        if (id) location.href = window.LINKS.room + '?room=' + encodeURIComponent(id);
    });

    renderHotRooms();
}

window.renderHotRooms = renderHotRooms;
window.initRoomsUI = initRoomsUI;
window.getFollowedRoomIds = getFollowedRoomIds;
window.setFollowed = setFollowed;
window.getDismissed = getDismissed;
window.dismissKey = dismissKey;
window.avatarHTML = avatarHTML;
window.coverImg = coverImg;
window.formatCount = formatCount;
