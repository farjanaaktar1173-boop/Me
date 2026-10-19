/* room/theme.js — Room Theme (সিট লেআউট) */

console.log('[ROOM] theme.js loaded');

(function(){
'use strict';

/* ═══ লেআউট ডেফিনিশন ═══ */
var RT_LAYOUTS = {
    'basic-10': {
        title:'Basic 10 mic seat', category:'Basic',
        rows: [{ count:5, mult:1.0 }, { count:5, mult:1.0 }]
    },
    'basic-6': {
        title:'Basic 6 mic seat', category:'Basic',
        rows: [{ count:1, mult:1.45 }, { count:5, mult:1.0 }]
    },
    'basic-11': {
        title:'Basic 11 mic seat', category:'Basic',
        rows: [{ count:1, mult:1.35 }, { count:5, mult:1.0 }, { count:5, mult:1.0 }]
    },
    'basic-20': {
        title:'Basic 20 mic seat', category:'Basic',
        rows: [{ count:5, mult:1.0 }, { count:5, mult:1.0 }, { count:5, mult:1.0 }, { count:5, mult:1.0 }]
    },
    'special-11': {
        title:'Special 11 mic seat', category:'Special',
        rows: [
            { count:1, mult:1.1, align:'left' },
            { count:2, mult:1.6 },
            { count:4, mult:1.0 },
            { count:4, mult:1.0 }
        ]
    }
};

var _rtCurrent = 'basic-10';
var _rtTab = 'quantity';
var _rtPending = null;
var _origRenderSeats = null;

/* ═══ Storage থেকে লোড ═══ */
function rtLoad(){
    try {
        var saved = (typeof ls_get === 'function') ? ls_get(KEY.roomLayout) : null;
        if (saved && RT_LAYOUTS[saved]) _rtCurrent = saved;
        if (typeof state !== 'undefined') state.roomLayout = _rtCurrent;
    } catch(e){ console.warn('[THEME] load', e); }
}

/* ═══ সিট রেন্ডার (overridden) ═══ */
function rtRenderSeats(){
    var grid = document.getElementById('seatsGrid');
    if (!grid) return;
    if (typeof destroyAllRings === 'function') destroyAllRings();

    var layout = RT_LAYOUTS[_rtCurrent] || RT_LAYOUTS['basic-10'];
    grid.removeAttribute('style');
    grid.className = 'seats-grid';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.justifyContent = 'space-evenly';
    grid.style.alignItems = 'center';
    grid.style.height = '215px';
    grid.style.minHeight = '215px';
    grid.style.padding = '6px 6px';
    grid.style.gap = '6px';
    grid.style.marginTop = '8px';
    grid.innerHTML = '';

    var W = grid.clientWidth || 380;
    var H = 215;
    var numRows = layout.rows.length;
    var maxCount = 1;
    layout.rows.forEach(function(r){ if (r.count > maxCount) maxCount = r.count; });

    var padX = 8, gapX = 4, rowGap = 6;
    var sizeByW = (W - padX * 2 - (maxCount - 1) * gapX) / maxCount;
    var totalMult = 0;
    layout.rows.forEach(function(r){ totalMult += r.mult; });
    var sizeByH = (H - 12 - (numRows - 1) * rowGap) / (1.45 * totalMult);
    var baseSize = Math.min(sizeByW, sizeByH);
    baseSize = Math.max(18, Math.min(baseSize, 80));

    var idx = 0;
    layout.rows.forEach(function(row){
        var rowDiv = document.createElement('div');
        rowDiv.style.display = 'flex';
        rowDiv.style.justifyContent = row.align === 'left' ? 'flex-start' : 'space-around';
        rowDiv.style.alignItems = 'center';
        rowDiv.style.width = '100%';
        rowDiv.style.gap = '4px';
        if (row.align === 'left') rowDiv.style.paddingLeft = '6px';

        var seatSize = baseSize * row.mult;
        for (var i = 0; i < row.count; i++){
            rowDiv.appendChild(rtBuildSeat(idx, seatSize));
            idx++;
        }
        grid.appendChild(rowDiv);
    });

    if (typeof updateRoomPoints === 'function') updateRoomPoints();
    setTimeout(function(){
        if (typeof refreshAllRings === 'function') refreshAllRings();
    }, 0);
}

/* ═══ একটা সিট বানানো ═══ */
function rtBuildSeat(idx, sizePx){
    var seats = (typeof state !== 'undefined' && state.seats) ? state.seats : [];
    var s = seats[idx];
    var cls = 'seat-avatar';
    var contentHTML = '', lockHTML = '', muteHTML = '', roleBadge = '', badge = '';

    if (s && s.locked && !s.uid){
        cls += ' locked';
        lockHTML = '<div class="seat-lock-overlay"><i class="fa-solid fa-lock"></i></div>';
    } else if (s && s.uid){
        cls += ' occupied';
        if (typeof myProfile !== 'undefined' && myProfile && s.uid === myProfile.uid) cls += ' is-me';
        var r = s.role || (typeof getRoleOf === 'function' ? getRoleOf(s.uid) : 'member');
        if (r === 'owner'){
            cls += ' is-owner';
            roleBadge = '<span class="role-badge-seat owner"><i class="fa-solid fa-crown"></i></span>';
        } else if (r === 'admin'){
            cls += ' is-admin';
            roleBadge = '<span class="role-badge-seat admin"><i class="fa-solid fa-shield-halved"></i></span>';
        }
        contentHTML = '<div class="seat-content"><img src="' + (s.avatar || GUEST_AVATAR) + '" alt=""></div>';
        if (!s.mic) muteHTML = '<div class="seat-mute-overlay"><i class="fa-solid fa-microphone-slash"></i></div>';
        if (s.locked) lockHTML = '<div class="seat-lock-overlay"><i class="fa-solid fa-lock"></i></div>';
        else badge = '<span class="mic-badge ' + (s.mic ? 'on' : 'off') + '"><i class="fa-solid fa-microphone' + (s.mic ? '' : '-slash') + '"></i></span>';
    }

    var label = (s && s.name) ? (typeof esc === 'function' ? esc(s.name) : s.name) : (s && s.locked ? 'Locked' : (idx + 1));
    var coins = (s && s.coins) ? s.coins : 0;
    var bgImg = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Owner-room/main/seat-bg.jpg';

    var div = document.createElement('div');
    div.className = 'seat';
    div.dataset.seat = idx;
    div.dataset.uid = (s && s.uid) ? s.uid : '';
    div.style.width = sizePx + 'px';
    div.style.maxWidth = sizePx + 'px';
    div.style.flexShrink = '0';
    div.innerHTML = ''
        + '<div class="' + cls + '" onclick="openSeatSheet(' + idx + ')" style="width:' + sizePx + 'px;height:' + sizePx + 'px;max-width:' + sizePx + 'px;aspect-ratio:1/1;border-radius:50%">'
        +   '<img class="seat-bg" src="' + bgImg + '" alt="" loading="lazy">'
        +   contentHTML + muteHTML + lockHTML
        +   '<div class="seat-reaction-layer" id="reactLayer' + idx + '"></div>'
        +   roleBadge + badge
        + '</div>'
        + '<div class="seat-meta">'
        +   '<div class="seat-number ' + (s && s.name ? 'taken' : '') + '" style="font-size:' + Math.max(8, sizePx * 0.22) + 'px">' + label + '</div>'
        +   '<div class="seat-coins" style="font-size:' + Math.max(7, sizePx * 0.18) + 'px"><i class="fa-solid fa-gem"></i> ' + coins.toLocaleString('en-IN') + '</div>'
        + '</div>';
    return div;
}

/* ═══ Room Theme Panel খোলা/বন্ধ ═══ */
window.openRoomTheme = function(){
    if (typeof isAdminOrOwner === 'function' && !isAdminOrOwner()){
        if (typeof toastMsg === 'function') toastMsg('শুধু Owner/Admin পারবে');
        return;
    }
    if (typeof closeSheet === 'function') closeSheet();
    var p = document.getElementById('rtPanel');
    if (p) p.classList.add('active');
    rtRenderBody();
};

window.closeRoomTheme = function(){
    var p = document.getElementById('rtPanel');
    if (p) p.classList.remove('active');
};

window.rtSwitchTab = function(tab){
    _rtTab = tab;
    var tabs = document.querySelectorAll('.rt-tab');
    for (var i = 0; i < tabs.length; i++){
        var isQ = (tab === 'quantity');
        tabs[i].classList.toggle('active', (i === 0 && isQ) || (i === 1 && !isQ));
    }
    rtRenderBody();
};

/* ═══ Panel body ═══ */
function rtRenderBody(){
    var body = document.getElementById('rtBody');
    if (!body) return;

    if (_rtTab === 'skin'){
        body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#7a6a8f;font-size:13px">'
            + '<i class="fa-solid fa-palette" style="font-size:36px;opacity:.4;margin-bottom:14px;display:block"></i>'
            + 'Skin অপশন শীঘ্রই আসছে...</div>';
        return;
    }

    var cats = { 'Basic': [], 'Special': [] };
    Object.keys(RT_LAYOUTS).forEach(function(key){
        var l = RT_LAYOUTS[key];
        cats[l.category].push({ key: key, title: l.title, rows: l.rows, category: l.category });
    });

    var html = '';
    ['Basic', 'Special'].forEach(function(catName){
        if (!cats[catName].length) return;
        html += '<div class="rt-section-lbl">' + catName + '</div><div class="rt-grid">';
        cats[catName].forEach(function(item){
            var selected = _rtCurrent === item.key;
            html += '<div class="rt-card ' + (selected ? 'selected' : '') + '" onclick="rtSelectLayout(\'' + item.key + '\')">'
                + '<div class="check-mark"><i class="fa-solid fa-check"></i></div>'
                + '<div class="card-title">' + item.title + '</div>'
                + '<div class="rt-card-preview" id="rtPrev-' + item.key + '"></div>'
                + '</div>';
        });
        html += '</div>';
    });
    body.innerHTML = html;

    requestAnimationFrame(function(){
        Object.keys(RT_LAYOUTS).forEach(function(key){
            var l = RT_LAYOUTS[key];
            var prev = document.getElementById('rtPrev-' + key);
            if (!prev) return;
            var w = prev.clientWidth, h = prev.clientHeight;
            var numRows = l.rows.length;
            var maxCount = 1;
            l.rows.forEach(function(r){ if (r.count > maxCount) maxCount = r.count; });
            var totalMult = 0;
            l.rows.forEach(function(r){ totalMult += r.mult; });
            var sizeByW = (w - 6) / maxCount * 0.75;
            var sizeByH = (h - 6) / (1.4 * totalMult);
            var baseSize = Math.min(sizeByW, sizeByH, 14);

            l.rows.forEach(function(row, r){
                var rowH = h / numRows;
                var y = rowH * (r + 0.5);
                var sz = baseSize * row.mult;
                var totalSeats = row.count;
                var spacing = w / (totalSeats + 1);
                var startOffset = row.align === 'left' ? 6 : 0;
                for (var i = 0; i < totalSeats; i++){
                    var x = row.align === 'left' ? startOffset + spacing * (i + 0.4) : spacing * (i + 1);
                    var dot = document.createElement('div');
                    dot.className = 'rt-prev-dot';
                    dot.style.left = x + 'px';
                    dot.style.top = y + 'px';
                    dot.style.width = sz + 'px';
                    dot.style.height = sz + 'px';
                    prev.appendChild(dot);
                }
            });
        });
    });
}

/* ═══ লেআউট সিলেক্ট ═══ */
window.rtSelectLayout = function(key){
    if (key === _rtCurrent){
        if (typeof toastMsg === 'function') toastMsg('✅ এই লেআউটটি ইতিমধ্যে সিলেক্ট করা আছে');
        return;
    }
    _rtPending = key;
    var p = document.getElementById('rtConfirmPopup');
    if (p) p.classList.add('active');
};

window.rtCloseConfirm = function(){
    _rtPending = null;
    var p = document.getElementById('rtConfirmPopup');
    if (p) p.classList.remove('active');
};

window.rtConfirmChange = function(){
    if (_rtPending){
        _rtCurrent = _rtPending;
        if (typeof state !== 'undefined') state.roomLayout = _rtCurrent;
        if (typeof ls_set === 'function') ls_set(KEY.roomLayout, _rtCurrent);
        rtRenderSeats();
        rtRenderBody();
        if (typeof toastMsg === 'function') toastMsg('✅ ' + RT_LAYOUTS[_rtPending].title + ' প্রয়োগ করা হয়েছে');
    }
    _rtPending = null;
    var p = document.getElementById('rtConfirmPopup');
    if (p) p.classList.remove('active');
};

/* ═══ renderSeats override ═══ */
if (typeof window.renderSeats === 'function'){
    _origRenderSeats = window.renderSeats;
}
window.renderSeats = function(){
    try {
        rtRenderSeats();
    } catch(e){
        console.warn('[THEME] rtRenderSeats failed, fallback:', e);
        if (_origRenderSeats) _origRenderSeats.apply(this, arguments);
    }
};
console.log('[THEME] renderSeats overridden successfully');

rtLoad();

/* ═══ গিফট hook ═══ */
(function(){
    var _origSendGift = window.sendGiftDemo;
    if (typeof _origSendGift === 'function'){
        window.sendGiftDemo = function(emoji, name, price, targetUid, targetName){
            _origSendGift.apply(this, arguments);
            try {
                if (typeof window.pkHandleGift === 'function'){
                    window.pkHandleGift(targetUid, price);
                }
            } catch(e){ console.warn('[THEME] pk hook:', e); }
        };
    }
})();

/* ═══ Resize এ re-render ═══ */
window.addEventListener('resize', function(){
    if (typeof myProfile !== 'undefined' && myProfile) rtRenderSeats();
});

})();