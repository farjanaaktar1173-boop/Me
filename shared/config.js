/* ═══════════════════════════════════════════════════════════
   shared/config.js
   সব ঠিকানা, সেটিংস, আর ছোট ছোট হেল্পার
   ═══════════════════════════════════════════════════════════ */

console.log('[MOI] config.js loaded');

/* ═══════════════ পেজের ঠিকানা ═══════════════ */
const URLS = {
    login : '../login/index.html',
    home  : '../home/index.html',
    me    : '../me/index.html',
    chat  : '../chat/index.html',
    room  : '../room/index.html'
};

/* ═══════════════ রুম আইডি বের করা ═══════════════ */
function resolveRoomId(){
    const p = new URLSearchParams(location.search);
    const h = location.hash.replace(/^#\/?/, '');
    const fromUrl = p.get('room') || p.get('id') || p.get('roomId') || h;
    if (fromUrl){
        try { localStorage.setItem('moi_last_room', fromUrl); } catch(e){}
        return fromUrl;
    }
    let last = null;
    try { last = localStorage.getItem('moi_last_room'); } catch(e){}
    return last || 'S1001';
}
const ROOM_ID = resolveRoomId();

/* ═══════════════ হেল্পার: এলিমেন্ট ধরা ═══════════════ */
/* $('myId')  →  document.getElementById('myId') */
const $ = id => document.getElementById(id);

/* ═══════════════ হেল্পার: নিরাপদ লেখা ═══════════════ */
/* ইউজারের লেখা HTML-এ বসানোর আগে পরিষ্কার করে */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
}[c]));

/* ═══════════════ গেস্ট অ্যাভাটার ═══════════════ */
/* কারো ছবি না থাকলে এটা দেখাবে */
const GUEST_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill="#3b2a4f"/>
        <circle cx="50" cy="40" r="18" fill="#7a6a8f"/>
        <ellipse cx="50" cy="88" rx="30" ry="22" fill="#7a6a8f"/>
    </svg>`
);

/* ═══════════════ দেশের পতাকা ═══════════════ */
const FLAGS = {
    'Bangladesh':'🇧🇩','India':'🇮🇳','Pakistan':'🇵🇰','Nepal':'🇳🇵','Sri Lanka':'🇱🇰',
    'Myanmar':'🇲🇲','Malaysia':'🇲🇾','Indonesia':'🇮🇩','Saudi Arabia':'🇸🇦','UAE':'🇦🇪',
    'Qatar':'🇶🇦','Kuwait':'🇰🇼','Turkey':'🇹🇷','Egypt':'🇪🇬','UK':'🇬🇧',
    'USA':'🇺🇸','Canada':'🇨🇦','Germany':'🇩🇪','France':'🇫🇷','Italy':'🇮🇹',
    'Spain':'🇪🇸','Russia':'🇷🇺','China':'🇨🇳','Japan':'🇯🇵','South Korea':'🇰🇷',
    'Philippines':'🇵🇭','Thailand':'🇹🇭','Vietnam':'🇻🇳','Brazil':'🇧🇷','Mexico':'🇲🇽',
    'Australia':'🇦🇺','Singapore':'🇸🇬','Other':'🌍'
};

function getFlag(country){
    if (!country) return '🌍';
    const clean = String(country).replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '').trim();
    return FLAGS[clean] || FLAGS[country] || '🌍';
}

function cleanCountry(c){
    return String(c || '').replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '').trim();
}

/* ═══════════════ টোস্ট (ছোট নোটিফিকেশন) ═══════════════ */
let _toastTimer = null;
function toastMsg(msg){
    let t = document.getElementById('globalToast');
    if (!t){
        t = document.createElement('div');
        t.id = 'globalToast';
        t.style.cssText = `
            position:fixed;left:50%;bottom:100px;
            transform:translateX(-50%) translateY(20px);
            background:rgba(30,15,50,.96);
            border:1px solid rgba(245,215,110,.45);
            color:#fff;font-size:13px;font-weight:600;
            padding:11px 20px;border-radius:22px;
            opacity:0;pointer-events:none;transition:.3s;
            z-index:9999;max-width:88%;text-align:center;
            font-family:'Segoe UI',system-ui,sans-serif;
            box-shadow:0 10px 28px rgba(0,0,0,.6);
        `;
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2200);
}

/* ═══════════════ সময় সুন্দর করে দেখানো ═══════════════ */
function timeAgo(ts){
    if (!ts) return '';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'এইমাত্র';
    if (m < 60) return m + ' মিনিট আগে';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' ঘণ্টা আগে';
    const d = Math.floor(h / 24);
    if (d < 7) return d + ' দিন আগে';
    return new Date(ts).toLocaleDateString('bn-BD');
}

function nowTime(){
    return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

/* ═══════════════ সব ফাইলে ব্যবহার করা যাবে ═══════════════ */
window.URLS          = URLS;
window.ROOM_ID       = ROOM_ID;
window.$             = $;
window.esc           = esc;
window.GUEST_AVATAR  = GUEST_AVATAR;
window.FLAGS         = FLAGS;
window.getFlag       = getFlag;
window.cleanCountry  = cleanCountry;
window.toastMsg      = toastMsg;
window.timeAgo       = timeAgo;
window.nowTime       = nowTime;
window.resolveRoomId = resolveRoomId;
