/* room/luckybox.js — Lucky Box সিস্টেম */

console.log('[ROOM] luckybox.js loaded');

let _luckyTimerId = null;

function getLuckyBoxKey(){ return `moi_luckybox_${ROOM_ID}`; }

/* বক্স সার্ভার লেখে (Realtime DB) — ক্লায়েন্ট শুধু পড়ে। RTDB খালি অ্যারে রাখে না, তাই ঠিক করে নিই। */
function getLuckyBoxes(){
    var raw = ls_get(getLuckyBoxKey(), []) || [];
    var list = Array.isArray(raw) ? raw : Object.values(raw);
    return list.filter(Boolean).map(function(b){
        return Object.assign({}, b, {
            claimedBy: Array.isArray(b.claimedBy) ? b.claimedBy : Object.values(b.claimedBy || {}),
            winners: Array.isArray(b.winners) ? b.winners : Object.values(b.winners || {})
        });
    }).sort(function(x, y){ return (x.createdAt || 0) - (y.createdAt || 0); });
}
function saveLuckyBoxes(){ renderMessageFeed(); }

/* ═══ Lucky Box Sheet খোলা ═══ */
window.openLuckyBoxSheet = () => {
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin Lucky Box পাঠাতে পারবে');
        return;
    }
    closeSheet();
    $('sheetBackdrop').classList.add('active');
    $('luckyBoxSheet').classList.add('active');
    const bal = myProfile.diamonds || 0;
    $('luckyBalance').textContent = bal;

    ['luckyTimer','luckyDiamonds','luckyQuantity'].forEach(groupId => {
        const group = $(groupId);
        if (!group) return;
        group.querySelectorAll('.lucky-chip').forEach(chip => {
            chip.onclick = () => {
                group.querySelectorAll('.lucky-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            };
        });
    });
};

function _getChipValue(groupId){
    const group = $(groupId);
    if (!group) return 0;
    const active = group.querySelector('.lucky-chip.active');
    return active ? +active.dataset.v : 0;
}

/* ═══ Lucky Box পাঠানো ═══ */
window.sendLuckyBox = async () => {
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin পারবে');
        return;
    }
    const timer = _getChipValue('luckyTimer');
    const total = _getChipValue('luckyDiamonds');
    const qty = _getChipValue('luckyQuantity');
    if (total <= 0 || qty <= 0){
        toastMsg('❌ সেটিংস চেক করুন');
        return;
    }
    if ((myProfile.diamonds || 0) < total){
        toastMsg('❌ পর্যাপ্ত ডায়মন্ড নেই!');
        return;
    }
    closeSheet();
    const r = await MOIEco.try('createLuckyBox', { roomId: ROOM_ID, total, qty, timerMin: timer });   /* ডায়মন্ড কাটা ও বক্স তৈরি সার্ভারে */
    if (!r) return;
    toastMsg(`🎁 Lucky Box পাঠানো হয়েছে (${r.box.pool} 💎)`);
    pushActivityLuckyBox(r.box);
    startLuckyBoxTimer();
};

function pushActivityLuckyBox(box){
    if (!myProfile) return;
    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `🎁 ${esc(box.senderName)} Lucky Box পাঠিয়েছেন (${box.pool}💎)`;
    const strip = $('activityStrip');
    if (!strip) return;
    strip.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity .4s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    }, 5000);
}

/* ═══ Message feed এ Lucky Box card ═══ */
function renderLuckyBoxCard(box){
    const now = Date.now();
    const left = Math.max(0, box.expiresAt - now);
    const expired = now >= box.expiresAt;
    const full = box.winners.length >= box.qty;
    const myWin = box.winners.find(w => w.uid === myProfile?.uid);
    const myClaimed = box.claimedBy.includes(myProfile?.uid);
    const gone = expired && (now - box.expiresAt > 2 * 60 * 1000);

    let statusHTML = '';
    if (myWin){
        statusHTML = `<div class="lb-win">🎉 আপনি পেয়েছেন ${myWin.amount} 💎</div>`;
    } else if (myClaimed){
        statusHTML = `<div class="lb-lose">😢 আপনি কিছু পাননি</div>`;
    } else if (full){
        statusHTML = `<div class="lb-full">✅ সব ডায়মন্ড বিতরণ হয়েছে</div>`;
    } else if (expired){
        statusHTML = `<div class="lb-expired">⌛ সময় শেষ</div>`;
    } else {
        const mins = Math.floor(left / 60000);
        const secs = Math.floor((left % 60000) / 1000);
        statusHTML = `<div class="lb-timer" data-box="${box.id}" data-expires="${box.expiresAt}">⏱️ ${mins}:${String(secs).padStart(2,'0')}</div>`;
    }

    const winnersHTML = box.winners.length
        ? `<div class="lb-winners">${box.winners.map(w =>
            `<div class="lb-win-row"><img src="${esc(w.avatar || GUEST_AVATAR)}"><span>${esc(w.name)}</span><b>+${w.amount}💎</b></div>`
        ).join('')}</div>`
        : '';

    return `<div class="msg-item lb-card ${gone ? 'lb-gone' : ''}" data-box="${box.id}">
        <div class="lb-head">
            <img class="lb-sender-av" src="${esc(box.senderAvatar || GUEST_AVATAR)}">
            <div class="lb-head-info">
                <div class="lb-sender-name">${esc(box.senderName)}</div>
                <div class="lb-sender-sub">🎁 Lucky Box · ${box.pool} 💎 · ${box.qty} জন</div>
            </div>
        </div>
        <div class="lb-body">
            <div class="lb-icon">🎁</div>
            <div class="lb-amount">${box.pool} <span>💎</span></div>
            <div class="lb-sub">${box.qty} জন পাবে · ${box.timerMin} min</div>
            ${statusHTML}
            ${winnersHTML}
        </div>
        ${(!myClaimed && !expired && !full) ? `<button class="lb-open-btn" onclick="tryOpenLuckyBox('${box.id}')">Open</button>` : ''}
        ${(expired && !myClaimed && !full) ? `<button class="lb-open-btn" onclick="tryOpenLuckyBox('${box.id}')">Open</button>` : ''}
    </div>`;
}

/* ═══ Lucky Box খোলা ═══ */
window.tryOpenLuckyBox = async (boxId) => {
    if (!myProfile){ toastMsg('লগইন করুন'); return; }
    if (myProfile.isGuest){ toastMsg('গেস্ট খুলতে পারে না — লগইন করুন'); return; }
    const box = getLuckyBoxes().find(b => b.id === boxId);
    if (!box) return;
    const now = Date.now();
    if (now < box.expiresAt){
        toastMsg(`⏱️ আরো ${Math.ceil((box.expiresAt - now) / 1000)}s অপেক্ষা করুন`);
        return;
    }
    if (box.claimedBy.includes(myProfile.uid)){ toastMsg('আপনি ইতিমধ্যে খুলেছেন'); return; }
    const r = await MOIEco.try('openLuckyBox', { roomId: ROOM_ID, boxId });    /* ফলাফল সার্ভার ঠিক করে */
    if (!r) return;
    toastMsg(r.won > 0 ? `🎉 আপনি পেয়েছেন ${r.won} 💎` : '😢 আপনি কিছু পাননি');
    renderMessageFeed();
};

/* ═══ Countdown timer ═══ */
function startLuckyBoxTimer(){
    if (_luckyTimerId) return;
    _luckyTimerId = setInterval(() => {
        const now = Date.now();
        let needRerender = false;

        document.querySelectorAll('.lb-timer').forEach(el => {
            const exp = +el.dataset.expires;
            const left = exp - now;
            if (left <= 0){
                needRerender = true;
                return;
            }
            const m = Math.floor(left / 60000);
            const s = Math.floor((left % 60000) / 1000);
            el.textContent = `⏱️ ${m}:${String(s).padStart(2,'0')}`;
        });

        if (needRerender) renderMessageFeed();
    }, 1000);
}

/* ═══ Message feed এ box inject ═══ */
function injectLuckyBoxesIntoFeed(){
    const list = $('messagesList');
    if (!list) return;
    const boxes = getLuckyBoxes();
    if (!boxes.length) return;
    const now = Date.now();
    const active = boxes.filter(b => now - b.expiresAt < 2 * 60 * 1000);
    if (!active.length) return;
    const html = active.map(renderLuckyBoxCard).join('');
    list.innerHTML = html + list.innerHTML;
}

window.getLuckyBoxes = getLuckyBoxes;
window.saveLuckyBoxes = saveLuckyBoxes;
window.startLuckyBoxTimer = startLuckyBoxTimer;
window.injectLuckyBoxesIntoFeed = injectLuckyBoxesIntoFeed;
window.renderLuckyBoxCard = renderLuckyBoxCard;