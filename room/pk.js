/* room/pk.js — 1vs1 PK সিস্টেম */

console.log('[ROOM] pk.js loaded');

let _pkTimerInterval = null;
let _pkSelectedBlue = null;
let _pkSelectedRed = null;
let _pkCurrentPick = 'blue';
let _pkSelectedTime = 10;

/* ═══ Setup Panel খোলা/বন্ধ ═══ */
window.openPKSetup = () => {
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin PK শুরু করতে পারবে');
        return;
    }
    closeSheet();
    _pkSelectedBlue = null;
    _pkSelectedRed = null;
    _pkCurrentPick = 'blue';
    _pkSelectedTime = 10;

    $('pkBlueSlot').innerHTML = '<i class="fa-solid fa-user" style="color:#555"></i>';
    $('pkBlueSlot').classList.remove('blue-active');
    $('pkBlueName').innerText = 'খালি';
    $('pkBlueUid').innerText = 'UID: ---';

    $('pkRedSlot').innerHTML = '<i class="fa-solid fa-user" style="color:#555"></i>';
    $('pkRedSlot').classList.remove('red-active');
    $('pkRedName').innerText = 'খালি';
    $('pkRedUid').innerText = 'UID: ---';

    $('pkSelectTitle').innerText = 'নীল সদস্য নির্বাচন করুন';
    $('pkSelectTitle').style.color = '#F5D76E';
    $('pkTimeVal').innerHTML = '১০ মিনিট <i class="fa-solid fa-chevron-right"></i>';
    $('pkStartBtn').disabled = true;

    renderPKMembers();
    $('pkSetupPanel').classList.add('active');
};

window.closePKSetup = () => {
    $('pkSetupPanel').classList.remove('active');
    _pkSelectedBlue = null;
    _pkSelectedRed = null;
    _pkCurrentPick = 'blue';
};

/* ═══ সদস্য লিস্ট রেন্ডার ═══ */
function renderPKMembers(){
    const list = $('pkMemberList');
    if (!list) return;
    const members = state.seats
        .filter(s => s && s.uid)
        .map(s => ({ uid: s.uid, name: s.name || 'User', avatar: s.avatar || GUEST_AVATAR }));

    if (!members.length){
        list.innerHTML = `<div style="text-align:center;color:#777;font-size:13px;padding:20px">মাইকে কেউ নেই</div>`;
        return;
    }
    list.innerHTML = members.map(m => `
        <div class="pk-member-item" data-uid="${esc(m.uid)}" onclick="pkSelectMember('${esc(m.uid)}')">
            <img src="${esc(m.avatar)}" onerror="this.src='${GUEST_AVATAR}'">
            <span>${esc(m.name)}</span>
        </div>
    `).join('');
}

/* ═══ সদস্য সিলেক্ট ═══ */
window.pkSelectMember = (uid) => {
    const member = state.seats.find(s => s && s.uid === uid);
    if (!member) return;

    if (_pkCurrentPick === 'blue'){
        if (_pkSelectedRed && _pkSelectedRed.uid === uid){
            toastMsg('❌ এই সদস্য লাল দলে আছে!');
            return;
        }
        _pkSelectedBlue = { uid: member.uid, name: member.name, avatar: member.avatar };
        $('pkBlueSlot').innerHTML = `<img src="${esc(member.avatar)}">`;
        $('pkBlueSlot').classList.add('blue-active');
        $('pkBlueName').innerText = member.name;
        $('pkBlueUid').innerText = 'UID: ' + (member.moiId || member.uid.slice(0, 8));
        document.querySelectorAll('#pkMemberList .pk-member-item').forEach(el => el.classList.remove('selected-blue'));
        const el = document.querySelector(`#pkMemberList .pk-member-item[data-uid="${uid}"]`);
        if (el) el.classList.add('selected-blue');

        if (!_pkSelectedRed){
            _pkCurrentPick = 'red';
            $('pkSelectTitle').innerText = 'লাল সদস্য নির্বাচন করুন';
            $('pkSelectTitle').style.color = '#ff2a74';
        }
    } else {
        if (_pkSelectedBlue && _pkSelectedBlue.uid === uid){
            toastMsg('❌ এই সদস্য নীল দলে আছে!');
            return;
        }
        _pkSelectedRed = { uid: member.uid, name: member.name, avatar: member.avatar };
        $('pkRedSlot').innerHTML = `<img src="${esc(member.avatar)}">`;
        $('pkRedSlot').classList.add('red-active');
        $('pkRedName').innerText = member.name;
        $('pkRedUid').innerText = 'UID: ' + (member.moiId || member.uid.slice(0, 8));
        document.querySelectorAll('#pkMemberList .pk-member-item').forEach(el => el.classList.remove('selected-red'));
        const el = document.querySelector(`#pkMemberList .pk-member-item[data-uid="${uid}"]`);
        if (el) el.classList.add('selected-red');
    }

    if (_pkSelectedBlue && _pkSelectedRed){
        $('pkStartBtn').disabled = false;
        $('pkSelectTitle').innerText = '✅ উভয় সদস্য নির্বাচিত!';
        $('pkSelectTitle').style.color = '#7dffa1';
    }
};

/* ═══ সময় Sheet ═══ */
window.openPKTimeSheet = () => {
    $('pkTimeSheet').classList.add('active');
    _updatePKTimeOptions();
};

window.closePKTimeSheet = () => {
    $('pkTimeSheet').classList.remove('active');
};

window.pkSetTime = (mins) => {
    _pkSelectedTime = mins;
    _updatePKTimeOptions();
    $('pkTimeVal').innerHTML = `${mins} মিনিট <i class="fa-solid fa-chevron-right"></i>`;
    closePKTimeSheet();
};

function _updatePKTimeOptions(){
    [5, 10, 15].forEach(m => {
        const el = $('pkOpt' + m);
        if (el) el.classList.toggle('active', m === _pkSelectedTime);
    });
}

/* ═══ PK শুরু ═══ */
window.pkStart = () => {
    if (!_pkSelectedBlue || !_pkSelectedRed){
        toastMsg('❌ উভয় সদস্য নির্বাচন করুন');
        return;
    }

    const blue = _pkSelectedBlue;
    const red = _pkSelectedRed;
    const timer = _pkSelectedTime;

    closePKSetup();

    $('pkSplashBlueImg').src = blue.avatar;
    $('pkSplashRedImg').src = red.avatar;
    $('pkSplash').classList.add('active');

    setTimeout(() => {
        $('pkSplash').classList.remove('active');
        pkLaunch(blue, red, timer);
    }, 2000);
};

function pkLaunch(blue, red, timerMin){
    const now = Date.now();
    state.pk = {
        blue: { uid: blue.uid, name: blue.name, avatar: blue.avatar, score: 0 },
        red: { uid: red.uid, name: red.name, avatar: red.avatar, score: 0 },
        timerMin,
        startedAt: now,
        expiresAt: now + timerMin * 60 * 1000
    };
    ls_set(KEY.pkState, state.pk);

    $('pkBannerBlueImg').src = blue.avatar;
    $('pkBannerBlueName').innerText = blue.name;
    $('pkBannerRedImg').src = red.avatar;
    $('pkBannerRedName').innerText = red.name;
    $('pkBanner').classList.add('active');
    document.querySelector('.app-container').classList.add('pk-active');

    pkUpdateTug();
    pkStartTimer();
    toastMsg(`🔥 PK শুরু — ${blue.name} vs ${red.name}`);
    logActivity('react', null, { target: `PK: ${blue.name} vs ${red.name}` });
}

/* ═══ টাইমার ═══ */
function pkStartTimer(){
    if (_pkTimerInterval) clearInterval(_pkTimerInterval);
    pkUpdateTimerText();
    _pkTimerInterval = setInterval(() => {
        if (!state.pk){
            clearInterval(_pkTimerInterval);
            return;
        }
        if (Date.now() >= state.pk.expiresAt){
            clearInterval(_pkTimerInterval);
            pkEnd(false);
            return;
        }
        pkUpdateTimerText();
        pkUpdateTug();
    }, 1000);
}

function pkUpdateTimerText(){
    if (!state.pk) return;
    const left = Math.max(0, state.pk.expiresAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const el = $('pkTimerText');
    if (el) el.innerText = `PK ${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ═══ Tug of War update ═══ */
function pkUpdateTug(){
    if (!state.pk) return;
    const bs = state.pk.blue.score || 0;
    const rs = state.pk.red.score || 0;
    const total = bs + rs;
    let bp = total > 0 ? (bs / total) * 100 : 50;
    bp = Math.max(5, Math.min(95, bp));

    const blueBar = $('pkTugBlue');
    const redBar = $('pkTugRed');
    const whiteLine = $('pkWhiteLine');
    if (blueBar) blueBar.style.width = bp + '%';
    if (redBar) redBar.style.width = (100 - bp) + '%';
    if (whiteLine) whiteLine.style.left = bp + '%';
}

/* ═══ PK শেষ ═══ */
window.pkEnd = (isManual) => {
    if (!state.pk) return;
    if (_pkTimerInterval) clearInterval(_pkTimerInterval);

    const blue = state.pk.blue;
    const red = state.pk.red;
    let winnerMsg = '';
    if (blue.score > red.score) winnerMsg = `🎉 ${blue.name} (নীল দল) জিতেছে!`;
    else if (red.score > blue.score) winnerMsg = `🎉 ${red.name} (লাল দল) জিতেছে!`;
    else winnerMsg = '🤝 পিকে ড্র হয়েছে!';

    $('pkBanner').classList.remove('active');
    document.querySelector('.app-container').classList.remove('pk-active');

    state.pk = null;
    if (isAdminOrOwner()) ls_set(KEY.pkState, null);

    setTimeout(() => {
        alert((isManual ? 'পিকে বন্ধ করা হয়েছে। ' : '⏰ সময় শেষ! ') + winnerMsg);
        openSettingsMenu();
    }, 200);
};

/* ═══ গিফট hook — স্কোর সার্ভার (sendGift) Realtime DB-তে বাড়ায়; ক্লায়েন্টে আর হাতে বাড়ানো হয় না ═══ */
window.pkHandleGift = () => {};

/* ═══ Realtime DB থেকে PK অবস্থা সিঙ্ক (সবার স্ক্রিনে একই) ═══ */
function pkRestoreFromStorage(){
    const saved = ls_get(KEY.pkState);
    if (!saved || !saved.blue || !saved.red || Date.now() >= saved.expiresAt){
        if (state.pk){
            state.pk = null;
            if (_pkTimerInterval){ clearInterval(_pkTimerInterval); _pkTimerInterval = null; }
            $('pkBanner').classList.remove('active');
            document.querySelector('.app-container').classList.remove('pk-active');
        }
        return;
    }
    const fresh = !state.pk;
    state.pk = saved;
    $('pkBannerBlueImg').src = saved.blue.avatar || GUEST_AVATAR;
    $('pkBannerBlueName').innerText = saved.blue.name;
    $('pkBannerRedImg').src = saved.red.avatar || GUEST_AVATAR;
    $('pkBannerRedName').innerText = saved.red.name;
    $('pkBanner').classList.add('active');
    document.querySelector('.app-container').classList.add('pk-active');
    pkUpdateTug();
    if (fresh || !_pkTimerInterval) pkStartTimer();
}

window.renderPKMembers = renderPKMembers;
window.pkUpdateTug = pkUpdateTug;
window.pkRestoreFromStorage = pkRestoreFromStorage;