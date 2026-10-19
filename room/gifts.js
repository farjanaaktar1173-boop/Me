/* ═══════════════════════════════════════════════════════════
   room/gifts.js — Gift System (Part 1/3)
   ═══════════════════════════════════════════════════════════ */

console.log('[ROOM] gifts.js loaded');

var GIFT_URL_DIAMOND_OLD = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/adf7bc4019f616641b0a2b2e391a4ba705d7eabb/gift%20(Diamond).json';
var GIFT_URL_DIAMOND_NEW = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/45c1e03df3058c40d91ccab3faf3fe7d07a0e493/Diamond%20(1).json';
var GIFT_URL_CAKE        = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/43f9fccc28fd603902525a0caadbe28e4344f2e0/%230101J_S_07.json';
var GIFT_URL_POOP        = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/81cbc0d2d09adb279fd61348b54160368d6a46a4/Poop%20Emoji.json';
var GIFT_URL_KISS        = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/5e7a3520d96a28bd05cd5249ff24223022019cac/kiss%20heart.json';
var GIFT_URL_PRESENT     = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/881e25d092b54ef588413c1c89cbd29c95d35dfa/Present%20poop.json';
var GIFT_URL_ROSE        = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/88185067b0fbcd2f71506e0ae8b30b94427c996f/rose.json';
var GIFT_URL_TREASURE    = 'https://raw.githubusercontent.com/farjanaaktar1173-boop/Gift/92930e19f61b4e877ff1829552d75068b3d7bea4/Treasure%20Chest.json';

var GIFT_CATALOG = {
    hot: [
        { id:'diamond',    name:'ডায়মন্ড',           price:5,  url:GIFT_URL_DIAMOND_OLD, filter:[], scale:1.0,  anim:'standard' },
        { id:'diamond_v2', name:'ডায়মন্ড স্পেশাল',  price:1,  url:GIFT_URL_DIAMOND_NEW, filter:['BG','Back Glow','Back Glow 2'], scale:1.0, anim:'standard' },
        { id:'diamond_v3', name:'ডায়মন্ড প্লাটিনাম', price:10, url:GIFT_URL_DIAMOND_OLD, filter:['Pillow','Layer 1','shadow'], scale:1.0, anim:'standard' },
        { id:'cake',       name:'কেক',              price:10, url:GIFT_URL_CAKE,        filter:[], scale:1.35, anim:'standard' },
        { id:'rose',       name:'ফুল',              price:1,  url:GIFT_URL_ROSE,        filter:[], scale:1.2,  anim:'standard' },
        { id:'kiss',       name:'চুমু',              price:1,  url:GIFT_URL_KISS,        filter:[], scale:1.2,  anim:'standard' },
        { id:'present',    name:'প্রেজেন্ট পটি',     price:5,  url:GIFT_URL_PRESENT,     filter:[], scale:1.2,  anim:'standard' },
        { id:'treasure',   name:'গোল্ড বক্স',        price:15, url:GIFT_URL_TREASURE,    filter:[], scale:0.9,  anim:'standard' },
        { id:'poop',       name:'পটি',              price:2,  url:GIFT_URL_POOP,        filter:[], scale:0.6,  anim:'sticky' }
    ],
    recent: [
        { id:'rose',       name:'ফুল',              price:1,  url:GIFT_URL_ROSE,        filter:[], scale:1.2,  anim:'standard' },
        { id:'kiss',       name:'চুমু',              price:1,  url:GIFT_URL_KISS,        filter:[], scale:1.2,  anim:'standard' },
        { id:'present',    name:'প্রেজেন্ট পটি',     price:5,  url:GIFT_URL_PRESENT,     filter:[], scale:1.2,  anim:'standard' },
        { id:'poop',       name:'পটি',              price:2,  url:GIFT_URL_POOP,        filter:[], scale:0.6,  anim:'sticky' }
    ],
    activity: [
        { id:'treasure',   name:'গোল্ড বক্স',        price:15, url:GIFT_URL_TREASURE,    filter:[], scale:0.9,  anim:'standard' },
        { id:'cake',       name:'কেক',              price:10, url:GIFT_URL_CAKE,        filter:[], scale:1.35, anim:'standard' }
    ],
    svip: []
};

var _giftCat = 'hot';
var _selectedGift = null;
var _selectedQty = 1;
var _selectedTargets = new Set();
var _jsonCache = {};
var _thumbAnims = [];
var _lastGift = null;
var _comboTimer = null;
var _comboDuration = 6000;
var COMBO_CIRC = 2 * Math.PI * 26;
var RAINBOW = ['#22d3ee', '#a855f7', '#ec4899', '#fbbf24', '#34d399', '#60a5fa'];
var _stickyGifts = {};

async function giftLoadJSON(url, filter){
    var filterArr = filter || [];
    var sig = url + '||' + filterArr.slice().sort().join(',');
    if (_jsonCache[sig]) return _jsonCache[sig];
    try {
        var res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var json = await res.json();
        if (json && Array.isArray(json.layers) && filterArr.length > 0){
            json.layers = json.layers.filter(function(l){ return filterArr.indexOf(l.nm) === -1; });
        }
        _jsonCache[sig] = json;
        return json;
    } catch(err){
        console.error('❌ Gift JSON failed:', err);
        return null;
    }
}

async function giftPreloadAll(){
    var seen = new Set();
    var list = [];
    Object.keys(GIFT_CATALOG).forEach(function(k){
        GIFT_CATALOG[k].forEach(function(g){ list.push(g); });
    });
    var promises = [];
    list.forEach(function(g){
        var sig = g.url + '||' + (g.filter || []).slice().sort().join(',');
        if (!seen.has(sig)){
            seen.add(sig);
            promises.push(giftLoadJSON(g.url, g.filter));
        }
    });
    await Promise.all(promises);
}

window.openGiftPanel = function(){
    var p = document.getElementById('giftPanel');
    if (!p) return;
    if (!_selectedGift){
        var first = (GIFT_CATALOG[_giftCat] || [])[0];
        if (first) _selectedGift = first;
    }
    if (_selectedTargets.size === 0){
        var firstSeat = state.seats.find(function(s){ return s && s.uid; });
        if (firstSeat) _selectedTargets.add(firstSeat.uid);
    }
    p.classList.add('open');
    giftRenderGrid();
    giftRenderTargetList();
    giftRenderQtyDropdown();
    giftUpdateTargetUI();
    giftUpdateBalance();
    giftUpdateComboUI();
};

window.closeGiftPanel = function(){
    var p = document.getElementById('giftPanel');
    if (p) p.classList.remove('open');
    var dd = document.getElementById('giftTargetDropdown');
    if (dd) dd.classList.remove('open');
    var qd = document.getElementById('giftQtyDropdown');
    if (qd) qd.classList.remove('open');
};

window.switchGiftCat = function(cat){
    _giftCat = cat;
    document.querySelectorAll('.gp-tab').forEach(function(t){
        t.classList.toggle('active', t.dataset.cat === cat);
    });
    giftRenderGrid();
};

function giftRenderGrid(){
    _thumbAnims.forEach(function(a){ try{ a.destroy(); }catch(e){} });
    _thumbAnims = [];
    var grid = document.getElementById('giftGrid');
    if (!grid) return;
    var list = GIFT_CATALOG[_giftCat] || [];
    if (!list.length){
        grid.innerHTML = '<div style="grid-column:1/-1;padding:40px 20px;text-align:center;color:#999;font-size:12px;">এই ক্যাটাগরিতে এখনো কিছু নেই</div>';
        return;
    }
    grid.innerHTML = list.map(function(g){
        return '<div class="gift-card ' + (_selectedGift && _selectedGift.id === g.id ? 'selected' : '') + '" ' +
               'data-id="' + g.id + '" onclick="selectGift(\'' + g.id + '\')">' +
               '<div class="gift-thumb" id="giftThumb_' + g.id + '"></div>' +
               '<div class="gift-name">' + g.name + '</div>' +
               '<div class="gift-price"><i class="fa-solid fa-gem dia"></i> ' + g.price + '</div>' +
               '</div>';
    }).join('');
    list.forEach(function(g){
        var el = document.getElementById('giftThumb_' + g.id);
        if (el) giftRenderThumb(el, g);
    });
}

async function giftRenderThumb(el, gift){
    var json = await giftLoadJSON(gift.url, gift.filter);
    if (!json || !window.lottie){ el.innerHTML = '<div style="font-size:32px">💎</div>'; return; }
    try {
        var anim = lottie.loadAnimation({
            container: el, renderer: 'svg', loop: true, autoplay: true,
            animationData: JSON.parse(JSON.stringify(json))
        });
        _thumbAnims.push(anim);
    } catch(e){
        el.innerHTML = '<div style="font-size:32px">💎</div>';
    }
}

window.selectGift = function(id){
    var list = GIFT_CATALOG[_giftCat] || [];
    _selectedGift = list.find(function(g){ return g.id === id; });
    document.querySelectorAll('.gift-card').forEach(function(c){
        c.classList.toggle('selected', c.dataset.id === id);
    });
};

window.toggleGiftTargetDropdown = function(e){
    if (e) e.stopPropagation();
    var dd = document.getElementById('giftTargetDropdown');
    var qd = document.getElementById('giftQtyDropdown');
    if (qd) qd.classList.remove('open');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) giftRenderTargetList();
};

function giftRenderTargetList(){
    var list = document.getElementById('giftTdList');
    if (!list) return;
    var occupied = state.seats.filter(function(s){ return s && s.uid; });
    list.innerHTML = occupied.map(function(s){
        var isSel = _selectedTargets.has(s.uid);
        var combo = (state.giftCombo && state.giftCombo[s.uid]) || 0;
        var roleTag = s.role === 'owner' ? '<span class="gtd-role">হোস্ট</span>' :
                      s.role === 'admin' ? '<span class="gtd-role admin">অ্যাডমিন</span>' : '';
        return '<div class="gtd-item ' + (isSel ? 'selected' : '') + '" onclick="toggleGiftTarget(\'' + esc(s.uid) + '\', event)">' +
            '<img src="' + esc(s.avatar || GUEST_AVATAR) + '" onerror="this.src=\'' + GUEST_AVATAR + '\'">' +
            '<div class="gtd-info">' +
                '<div class="gtd-name">' +
                    esc(s.name || 'User') + ' ' + roleTag +
                    (combo > 0 ? ' <span style="font-size:9.5px;color:#ef4444;font-weight:800;">❤️+' + combo + '</span>' : '') +
                '</div>' +
                '<div class="gtd-seat">seat ' + (state.seats.indexOf(s) + 1) + '</div>' +
            '</div>' +
            '<div class="gtd-check">' + (isSel ? '<i class="fa-solid fa-check"></i>' : '') + '</div>' +
        '</div>';
    }).join('');
    var allSel = occupied.length > 0 && occupied.every(function(s){ return _selectedTargets.has(s.uid); });
    var btn = document.getElementById('giftSelectAllBtn');
    if (btn) btn.textContent = allSel ? 'Unselect All' : 'Select All';
}

window.toggleGiftTarget = function(uid, e){
    if (e) e.stopPropagation();
    if (_selectedTargets.has(uid)){
        if (_selectedTargets.size === 1) return;
        _selectedTargets.delete(uid);
    } else {
        _selectedTargets.add(uid);
    }
    giftRenderTargetList();
    giftUpdateTargetUI();
    giftUpdateComboUI();
};

window.toggleGiftSelectAll = function(e){
    if (e) e.stopPropagation();
    var occupied = state.seats.filter(function(s){ return s && s.uid; });
    var allSel = occupied.every(function(s){ return _selectedTargets.has(s.uid); });
    if (allSel){
        _selectedTargets.clear();
        _selectedTargets.add(occupied[0].uid);
    } else {
        _selectedTargets.clear();
        occupied.forEach(function(s){ _selectedTargets.add(s.uid); });
    }
    giftRenderTargetList();
    giftUpdateTargetUI();
    giftUpdateComboUI();
};

function giftUpdateTargetUI(){
    var selected = state.seats.filter(function(s){ return s && _selectedTargets.has(s.uid); });
    var avWrap = document.getElementById('giftTargetAvatars');
    var nameEl = document.getElementById('giftTargetName');
    var countEl = document.getElementById('giftTargetCount');
    var comboEl = document.getElementById('giftComboBox');
    if (avWrap){
        avWrap.innerHTML = selected.slice(0, 3).map(function(s){
            return '<img src="' + esc(s.avatar || GUEST_AVATAR) + '" onerror="this.src=\'' + GUEST_AVATAR + '\'">';
        }).join('');
    }
    if (selected.length === 1){
        if (nameEl) nameEl.textContent = selected[0].name || 'User';
        if (countEl) countEl.style.display = 'none';
        if (comboEl) comboEl.style.display = '';
    } else {
        if (nameEl) nameEl.textContent = 'সবাই';
        if (countEl){ countEl.textContent = '+' + selected.length; countEl.style.display = ''; }
        if (comboEl) comboEl.style.display = 'none';
    }
}

function giftUpdateComboUI(){
    var el = document.getElementById('giftComboCount');
    if (!el) return;
    if (_selectedTargets.size !== 1){ el.textContent = '0'; return; }
    var uid = Array.from(_selectedTargets)[0];
    el.textContent = (state.giftCombo && state.giftCombo[uid]) || 0;
}

var GIFT_QTY_OPTIONS = [1, 10, 100, 188, 1000];

window.toggleGiftQtyDropdown = function(e){
    if (e) e.stopPropagation();
    var dd = document.getElementById('giftQtyDropdown');
    var td = document.getElementById('giftTargetDropdown');
    if (td) td.classList.remove('open');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) giftRenderQtyDropdown();
};

function giftRenderQtyDropdown(){
    var dd = document.getElementById('giftQtyDropdown');
    if (!dd) return;
    dd.innerHTML = GIFT_QTY_OPTIONS.map(function(q){
        return '<div class="gqd-item ' + (q === _selectedQty ? 'selected' : '') + '" onclick="pickGiftQty(' + q + ')">' + q + '</div>';
    }).join('');
}

window.pickGiftQty = function(q){
    _selectedQty = q;
    var el = document.getElementById('giftQtyVal');
    if (el) el.textContent = q;
    giftRenderQtyDropdown();
    var dd = document.getElementById('giftQtyDropdown');
    if (dd) dd.classList.remove('open');
};

document.addEventListener('click', function(){
    var td = document.getElementById('giftTargetDropdown');
    var qd = document.getElementById('giftQtyDropdown');
    if (td) td.classList.remove('open');
    if (qd) qd.classList.remove('open');
});

function giftUpdateBalance(){
    var el = document.getElementById('giftBalance');
    if (!el) return;
    var live = (typeof getUser === 'function' && myProfile) ? getUser(myProfile.uid) : null;
    if (live && typeof live.diamonds === 'number') myProfile.diamonds = live.diamonds;
    var bal = (myProfile && myProfile.diamonds) || 0;
    el.textContent = bal.toLocaleString();
}
/* সব হিসাব সার্ভারে: ডায়মন্ড কাটা, giftStats, সিটের coins, PK স্কোর, চ্যাট মেসেজ */
async function giftServerSend(gift, targets, qty){
    var r = await MOIEco.try('sendGift', {
        roomId: ROOM_ID, targets: targets.map(function(t){ return t.uid; }),
        giftId: gift.id, qty: qty, giftName: gift.name
    });
    if (!r) return false;
    if (typeof r.balance === 'number'){ myProfile.diamonds = r.balance; giftUpdateBalance(); }
    return true;
}
window.sendGift = async function(){
    if (!_selectedGift){ toastMsg('প্রথমে গিফট সিলেক্ট করুন'); return; }
    if (myProfile.isGuest){ toastMsg('গেস্ট গিফট পাঠাতে পারে না — লগইন করুন'); return; }
    var targets = state.seats.filter(function(s){ return s && s.uid && _selectedTargets.has(s.uid); });
    if (!targets.length){ toastMsg('টার্গেট সিলেক্ট করুন'); return; }
    var total = _selectedGift.price * _selectedQty * targets.length;
    if ((myProfile.diamonds || 0) < total){
        toastMsg('পর্যাপ্ত ডায়মন্ড নেই! প্রয়োজন: ' + total);
        return;
    }
    var gift = _selectedGift, qty = _selectedQty;
    closeGiftPanel();
    if (!(await giftServerSend(gift, targets, qty))) return;
    if (!state.giftCombo) state.giftCombo = {};
    targets.forEach(function(t){ state.giftCombo[t.uid] = (state.giftCombo[t.uid] || 0) + qty; });
    _lastGift = { gift: gift, targets: targets.slice(), qty: qty };
    var names = targets.length === 1 ? targets[0].name : (targets.length + ' জন');
    if (typeof logActivity === 'function') logActivity('heart', null, { target: names });
    setTimeout(function(){
        giftPlayAnimation(gift, targets, qty);
        giftShowComboResend();
    }, 380);
};

async function giftPlayAnimation(gift, targets, qty){
    var style = gift.anim || 'standard';
    if (style === 'sticky'){
        return giftPlaySticky(gift, targets, qty);
    }
    return giftPlayStandard(gift, targets, qty);
}

async function giftPlayStandard(gift, targets, qty){
    var layer = document.getElementById('giftAnimLayer');
    if (!layer) return;
    layer.classList.add('active');
    var appEl = document.querySelector('.app-container');
    var appRect = appEl.getBoundingClientRect();
    var centerX = appRect.width / 2;
    var centerY = appRect.height / 2;
    var scale = gift.scale || 1.0;
    var mainSize = 220 * scale;
    var flySize = 70 * scale;
    var positions = targets.map(function(t){
        var el = document.querySelector('.seat[data-uid="' + t.uid + '"] .seat-avatar');
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { uid: t.uid, name: t.name, x: r.left - appRect.left + r.width / 2, y: r.top - appRect.top + r.height / 2 };
    }).filter(Boolean);
    if (!positions.length){ layer.classList.remove('active'); return; }
    var json = await giftLoadJSON(gift.url, gift.filter);
    if (!json){
        toastMsg('গিফট লোড হয়নি');
        layer.classList.remove('active');
        return;
    }
    var main = document.createElement('div');
    main.className = 'gift-lottie-main';
    main.style.left = centerX + 'px';
    main.style.top = centerY + 'px';
    main.style.width = mainSize + 'px';
    main.style.height = mainSize + 'px';
    layer.appendChild(main);
    var mainAnim = lottie.loadAnimation({
        container: main, renderer: 'svg', loop: false, autoplay: true,
        animationData: JSON.parse(JSON.stringify(json))
    });
    main.animate([
        { transform: 'translate(-50%,-50%) scale(0)',    opacity: 0, offset: 0 },
        { transform: 'translate(-50%,-50%) scale(0.4)',  opacity: 1, offset: 0.10 },
        { transform: 'translate(-50%,-50%) scale(1.4)',  opacity: 1, offset: 0.40 },
        { transform: 'translate(-50%,-50%) scale(1.75)', opacity: 1, offset: 0.70 },
        { transform: 'translate(-50%,-50%) scale(1.75)', opacity: 1, offset: 1 }
    ], { duration: 1800, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' });
    var hasFlown = false;
    function startFlying(){
        if (hasFlown) return;
        hasFlown = true;
        main.animate([
            { transform: 'translate(-50%,-50%) scale(1.75)', opacity: 1, filter: 'blur(0px)' },
            { transform: 'translate(-50%,-50%) scale(2.4)',  opacity: 0, filter: 'blur(8px)' }
        ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
        setTimeout(function(){
            try { mainAnim.destroy(); } catch(e){}
            main.remove();
        }, 550);
        positions.forEach(function(p, idx){
            setTimeout(function(){
                giftFlyToTarget(json, centerX, centerY, p, qty, layer, flySize);
            }, idx * 100);
        });
    }
    mainAnim.addEventListener('complete', startFlying);
    setTimeout(startFlying, 8000);
    setTimeout(function(){
        giftShowAnnounce(gift, positions[0], qty, positions.length);
    }, 2400 + positions.length * 100);
    setTimeout(function(){
        layer.classList.remove('active');
        layer.innerHTML = '';
    }, 12000);
}

function giftFlyToTarget(json, cx, cy, target, qty, layer, size){
    var dx = target.x - cx;
    var dy = target.y - cy;
    var ball = document.createElement('div');
    ball.className = 'gift-fly-diamond';
    ball.style.left = cx + 'px';
    ball.style.top = cy + 'px';
    ball.style.width = size + 'px';
    ball.style.height = size + 'px';
    layer.appendChild(ball);
    var ballAnim = lottie.loadAnimation({
        container: ball, renderer: 'svg', loop: true, autoplay: true,
        animationData: JSON.parse(JSON.stringify(json))
    });
    ball.animate([
        { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0, offset: 0 },
        { transform: 'translate(calc(-50% + ' + (dx * 0.25) + 'px), calc(-50% + ' + (dy * 0.25 - 80) + 'px)) scale(1.15)', opacity: 1, offset: 0.35 },
        { transform: 'translate(calc(-50% + ' + (dx * 0.6) + 'px), calc(-50% + ' + (dy * 0.6 - 50) + 'px)) scale(1)', opacity: 1, offset: 0.65 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.6)', opacity: 1, offset: 0.95 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.15)', opacity: 0, offset: 1 }
    ], { duration: 1300, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' });
    setTimeout(function(){
        giftSpawnSparkles(target.x, target.y, layer);
        giftShowFloatCombo(target.x, target.y, '💎×' + qty, layer);
    }, 1150);
    setTimeout(function(){
        try { ballAnim.destroy(); } catch(e){}
        ball.remove();
    }, 1400);
}

async function giftPlaySticky(gift, targets, qty){
    var layer = document.getElementById('giftAnimLayer');
    if (!layer) return;
    layer.classList.add('active');
    var appEl = document.querySelector('.app-container');
    var appRect = appEl.getBoundingClientRect();
    var centerX = appRect.width / 2;
    var centerY = appRect.height / 2;
    var positions = targets.map(function(t){
        var el = document.querySelector('.seat[data-uid="' + t.uid + '"] .seat-avatar');
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { uid: t.uid, name: t.name, x: r.left - appRect.left + r.width / 2, y: r.top - appRect.top + r.height / 2 };
    }).filter(Boolean);
    if (!positions.length){ layer.classList.remove('active'); return; }
    var json = await giftLoadJSON(gift.url, gift.filter);
    if (!json){
        toastMsg('গিফট লোড হয়নি');
        layer.classList.remove('active');
        return;
    }
    var main = document.createElement('div');
    main.className = 'gift-lottie-main';
    main.style.left = centerX + 'px';
    main.style.top = centerY + 'px';
    main.style.width = '220px';
    main.style.height = '220px';
    layer.appendChild(main);
    var mainAnim = lottie.loadAnimation({
        container: main, renderer: 'svg', loop: false, autoplay: true,
        animationData: JSON.parse(JSON.stringify(json))
    });
    main.animate([
        { transform: 'translate(-50%,-50%) scale(0)',    opacity: 0, offset: 0 },
        { transform: 'translate(-50%,-50%) scale(0.5)',  opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,-50%) scale(1.4)',  opacity: 1, offset: 0.60 },
        { transform: 'translate(-50%,-50%) scale(1.5)',  opacity: 1, offset: 1 }
    ], { duration: 1600, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' });
    var hasFlown = false;
    function startFlying(){
        if (hasFlown) return;
        hasFlown = true;
        main.animate([
            { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1 },
            { transform: 'translate(-50%,-50%) scale(2.0)', opacity: 0 }
        ], { duration: 400, easing: 'ease-out', fill: 'forwards' });
        setTimeout(function(){
            try { mainAnim.destroy(); } catch(e){}
            main.remove();
        }, 450);
        positions.forEach(function(p, idx){
            setTimeout(function(){
                giftFlyToTarget(json, centerX, centerY, p, qty, layer, 60);
            }, idx * 100);
        });
        setTimeout(function(){
            positions.forEach(function(p){
                giftAttachSticky(p.uid, gift);
            });
        }, 1500);
    }
    mainAnim.addEventListener('complete', startFlying);
    setTimeout(startFlying, 8000);
    setTimeout(function(){
        giftShowAnnounce(gift, positions[0], qty, positions.length);
    }, 2500);
    setTimeout(function(){
        layer.classList.remove('active');
        layer.innerHTML = '';
    }, 12000);
}

async function giftAttachSticky(uid, gift){
    giftDetachSticky(uid);
    var seatEl = document.querySelector('.seat[data-uid="' + uid + '"] .seat-avatar');
    if (!seatEl) return;
    var json = await giftLoadJSON(gift.url, gift.filter);
    if (!json) return;
    var el = document.createElement('div');
    el.className = 'gift-sticky-overlay';
    el.setAttribute('data-uid', uid);
    seatEl.appendChild(el);
    var anim = lottie.loadAnimation({
        container: el, renderer: 'svg', loop: true, autoplay: true,
        animationData: JSON.parse(JSON.stringify(json))
    });
    _stickyGifts[uid] = { gift: gift, lottieAnim: anim, el: el };
    console.log('🎯 Sticky gift attached to: ' + uid);
}

function giftDetachSticky(uid){
    var existing = _stickyGifts[uid];
    if (existing){
        try { existing.lottieAnim.destroy(); } catch(e){}
        if (existing.el) existing.el.remove();
        delete _stickyGifts[uid];
        console.log('🎯 Sticky gift detached from: ' + uid);
    }
}
(function hookStickyRerender(){
    var _origRenderSeats = window.renderSeats;
    if (typeof _origRenderSeats === 'function'){
        window.renderSeats = function(){
            _origRenderSeats.apply(this, arguments);
            setTimeout(function(){
                Object.keys(_stickyGifts).forEach(function(uid){
                    var existing = _stickyGifts[uid];
                    if (!existing) return;
                    var stillSeated = state.seats.find(function(s){ return s && s.uid === uid; });
                    if (!stillSeated){
                        giftDetachSticky(uid);
                        return;
                    }
                    var newSeatEl = document.querySelector('.seat[data-uid="' + uid + '"] .seat-avatar');
                    if (newSeatEl && existing.el){
                        if (existing.el.parentNode !== newSeatEl){
                            newSeatEl.appendChild(existing.el);
                            console.log('🎯 Sticky moved with user: ' + uid);
                        }
                    } else if (newSeatEl && !existing.el){
                        giftAttachSticky(uid, existing.gift);
                    }
                });
            }, 80);
        };
    }
})();

function giftSpawnSparkles(x, y, layer){
    var total = 10;
    for (var i = 0; i < total; i++){
        (function(i){
            var angle = (Math.PI * 2 * i) / total + Math.random() * 0.4;
            var distance = 60 + Math.random() * 50;
            var dx = Math.cos(angle) * distance;
            var dy = Math.sin(angle) * distance;
            var color = RAINBOW[i % RAINBOW.length];
            var size = 6 + Math.random() * 6;
            setTimeout(function(){
                var s = document.createElement('div');
                s.className = 'gift-sparkle';
                s.style.left = x + 'px';
                s.style.top = y + 'px';
                s.style.width = size + 'px';
                s.style.height = size + 'px';
                s.style.background = color;
                s.style.boxShadow = '0 0 8px ' + color + ', 0 0 16px ' + color;
                layer.appendChild(s);
                s.animate([
                    { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: 0 },
                    { transform: 'translate(calc(-50% + ' + (dx * 0.7) + 'px), calc(-50% + ' + (dy * 0.7) + 'px)) scale(0.8)', opacity: 0.8, offset: 0.6 },
                    { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.1)', opacity: 0, offset: 1 }
                ], { duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
                setTimeout(function(){ s.remove(); }, 950);
            }, i * 25);
        })(i);
    }
}

function giftShowFloatCombo(x, y, text, layer){
    var fc = document.createElement('div');
    fc.className = 'gift-float-combo';
    fc.textContent = text;
    fc.style.left = x + 'px';
    fc.style.top = (y - 30) + 'px';
    layer.appendChild(fc);
    fc.animate([
        { opacity: 0, transform: 'translate(-50%,0) scale(.3)' },
        { opacity: 1, transform: 'translate(-50%,-25px) scale(1.3)', offset: 0.2 },
        { opacity: 1, transform: 'translate(-50%,-40px) scale(1.15)', offset: 0.5 },
        { opacity: 0, transform: 'translate(-50%,-95px) scale(1)' }
    ], { duration: 2000, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    setTimeout(function(){ fc.remove(); }, 2050);
}

function giftShowAnnounce(gift, target, qty, count){
    var app = document.querySelector('.app-container');
    if (!app) return;
    var ann = document.createElement('div');
    ann.className = 'gift-room-announce';
    var nameText = count === 1 ? target.name : (count + ' জন');
    ann.innerHTML = '<img src="' + esc(myProfile.avatar || GUEST_AVATAR) + '" alt="">' +
                    '<span>💎 ' + esc(gift.name) + ' × ' + qty + ' → ' + esc(nameText) + '</span>';
    app.appendChild(ann);
    setTimeout(function(){ ann.remove(); }, 3600);
}

function giftShowComboResend(){
    var el = document.getElementById('giftComboResend');
    if (!el) return;
    el.classList.add('show');
    var ring = document.getElementById('giftComboRingFill');
    if (ring){
        ring.style.strokeDasharray = COMBO_CIRC;
        ring.style.strokeDashoffset = 0;
        ring.style.transition = 'none';
        void ring.offsetWidth;
        ring.style.transition = 'stroke-dashoffset .06s linear';
    }
    var timer = document.getElementById('giftComboTimer');
    if (timer) timer.textContent = '6';
    giftStartComboCountdown();
}

function giftStartComboCountdown(){
    if (_comboTimer) clearInterval(_comboTimer);
    var startTime = Date.now();
    var ring = document.getElementById('giftComboRingFill');
    var timerEl = document.getElementById('giftComboTimer');
    var btn = document.getElementById('giftComboResend');
    if (ring){
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = 0;
        void ring.offsetWidth;
        ring.style.transition = 'stroke-dashoffset .06s linear';
    }
    _comboTimer = setInterval(function(){
        var elapsed = Date.now() - startTime;
        var remain = Math.max(0, _comboDuration - elapsed);
        var ratio = remain / _comboDuration;
        if (ring) ring.style.strokeDashoffset = (COMBO_CIRC * (1 - ratio)).toFixed(2);
        if (timerEl) timerEl.textContent = Math.ceil(remain / 1000);
        if (btn) btn.classList.toggle('pulse', remain < 1500);
        if (remain <= 0){
            clearInterval(_comboTimer);
            _comboTimer = null;
            giftHideComboResend();
        }
    }, 50);
}

function giftHideComboResend(){
    var el = document.getElementById('giftComboResend');
    if (el) el.classList.remove('show', 'pulse');
    if (_comboTimer){ clearInterval(_comboTimer); _comboTimer = null; }
    _lastGift = null;
}

window.resendGift = async function(){
    if (!_lastGift) return;
    var gift = _lastGift.gift, targets = _lastGift.targets, qty = _lastGift.qty;
    var total = gift.price * qty * targets.length;
    if ((myProfile.diamonds || 0) < total){
        toastMsg('পর্যাপ্ত ডায়মন্ড নেই!');
        giftHideComboResend();
        return;
    }
    if (!(await giftServerSend(gift, targets, qty))){ giftHideComboResend(); return; }
    if (!state.giftCombo) state.giftCombo = {};
    targets.forEach(function(t){ state.giftCombo[t.uid] = (state.giftCombo[t.uid] || 0) + qty; });
    giftPlayAnimation(gift, targets, qty);
    if (navigator.vibrate) navigator.vibrate(15);
    giftStartComboCountdown();
};

/* অন্যদের পাঠানো গিফটের এনিমেশন আমার স্ক্রিনেও দেখাও (সার্ভার liveGifts-এ সিগন্যাল লেখে) */
function giftFindById(id){
    var found = null;
    Object.keys(GIFT_CATALOG).forEach(function(k){ GIFT_CATALOG[k].forEach(function(g){ if (g.id === id) found = g; }); });
    return found;
}
window.giftListenLive = function(){
    try {
        var FB = window.MOIFB; if (!FB || window._giftLiveOn) return; window._giftLiveOn = true;
        var since = Date.now() - 2000;
        FB.rtdb.ref(FB.LIVE + '/rooms/' + ROOM_ID + '/liveGifts').orderByChild('ts').startAt(since).on('child_added', function(snap){
            var v = snap.val(); if (!v || v.senderUid === myProfile.uid) return;
            var g = giftFindById(v.giftId); if (!g) return;
            var tg = state.seats.filter(function(s){ return s && (v.targetUids || []).indexOf(s.uid) > -1; });
            if (tg.length) giftPlayAnimation(g, tg, v.qty || 1);
        });
    } catch(e){ console.warn('liveGifts', e); }
};

window.openGiftPicker = function(){ openGiftPanel(); };
window.openGiftSheet = function(uid, name){
    if (uid){ _selectedTargets.clear(); _selectedTargets.add(uid); }
    openGiftPanel();
};
window.pickGiftTarget = function(uid, name){ window.openGiftSheet(uid, name); };

window.addEventListener('load', function(){
    giftPreloadAll().then(function(){
        var count = 0;
        Object.keys(GIFT_CATALOG).forEach(function(k){ count += GIFT_CATALOG[k].length; });
        console.log('%c💎 Gift System Ready — ' + count + ' gifts loaded', 'color:#22d3ee;font-weight:800;font-size:14px');
    });
});