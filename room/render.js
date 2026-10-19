/* room/render.js — সব রেন্ডারিং */

console.log('[ROOM] render.js loaded');

/* ═══ Role flag আপডেট ═══ */
function updateRoleFlag(){
    const flag = $('roleFlag'), txt = $('roleFlagText');
    if (!flag || !txt) return;
    if (state.myRole === 'owner'){
        flag.className = 'role-flag show';
        txt.textContent = 'OWNER';
        flag.querySelector('i').className = 'fa-solid fa-crown';
    } else if (state.myRole === 'admin'){
        flag.className = 'role-flag show admin';
        txt.textContent = 'ADMIN';
        flag.querySelector('i').className = 'fa-solid fa-shield-halved';
    } else {
        flag.className = 'role-flag show visitor';
        txt.textContent = 'VISITOR';
        flag.querySelector('i').className = 'fa-solid fa-user';
    }
}

/* ═══ Settings button দেখানো ═══ */
function updateSettingsVisibility(){
    const btn = $('settingsBtn');
    if (!btn) return;
    if (state.myRole === 'owner' || state.myRole === 'admin'){
        btn.classList.add('show');
    } else {
        btn.classList.remove('show');
    }
}

/* ═══ Join button ═══ */
function updateJoinButton(){
    if (!myProfile) return;
    const btn = $('joinRoomBtn'), txt = $('joinBtnText');
    if (!btn || !txt) return;
    if (state.myRole === 'owner'){
        btn.style.display = 'none';
        return;
    }
    btn.style.display = '';
    if (state.joinedUsers.has(myProfile.uid)){
        btn.classList.add('joined');
        txt.textContent = 'Joined';
        btn.querySelector('i').className = 'fa-solid fa-check';
    } else {
        btn.classList.remove('joined');
        txt.textContent = 'Join';
        btn.querySelector('i').className = 'fa-solid fa-plus';
    }
}

/* ═══ Top Gifters (উপরে ৩টি avatar) ═══ */
function renderTopGifters(){
    const wrap = $('topGiftersAvatars');
    if (!wrap) return;
    const top3 = computeGifterStats('month').slice(0, 3);
    if (!top3.length){
        wrap.innerHTML = `<div class="tg-empty">No gifts yet</div>`;
        return;
    }
    wrap.innerHTML = top3.map((u, i) => `
        <div class="tg-av-wrap" data-rank="${i+1}" title="${esc(u.name)}">
            <img src="${esc(u.avatar)}" onerror="this.src='${GUEST_AVATAR}'">
            <div class="tg-rank">${i+1}</div>
        </div>
    `).reverse().join('');
}

/* ═══ Gifter range (১ দিন / ১ মাস) ═══ */
window.setGifterRange = (range) => {
    state.gifterRange = range;
    $('timeDay').classList.toggle('active', range === 'day');
    $('timeMonth').classList.toggle('active', range === 'month');
    $('gifterSub').textContent = range === 'day'
        ? 'গত ১ দিনে সবচেয়ে বেশি গিফট পেয়েছেন'
        : 'গত ১ মাসে সবচেয়ে বেশি গিফট পেয়েছেন';
    renderGifterBody();
};

/* ═══ Gifter modal এর body ═══ */
function renderGifterBody(){
    const body = $('gifterBody');
    const all = computeGifterStats(state.gifterRange);
    if (!all.length){
        body.innerHTML = `<div class="gifter-empty"><i class="fa-solid fa-gift"></i>এই সময়ে কেউ গিফট পায়নি<br><span style="font-size:11px;color:#555;display:block;margin-top:8px">প্রথম গিফট পাঠিয়ে টপ গিফটার হন!</span></div>`;
        return;
    }
    const top3 = all.slice(0, 3);
    const rest = all.slice(3);
    const pOrder = [];
    if (top3[1]) pOrder.push({ ...top3[1], rank: 2 });
    if (top3[0]) pOrder.push({ ...top3[0], rank: 1 });
    if (top3[2]) pOrder.push({ ...top3[2], rank: 3 });

    const podiumHTML = `
        <div class="gifter-podium">
            ${pOrder.map(u => `
                <div class="podium-item" data-rank="${u.rank}" onclick="openUserProfileFromGifter('${esc(u.uid)}')">
                    <div class="p-av-wrap">
                        ${u.rank === 1 ? '<span class="p-crown">👑</span>' : ''}
                        <img class="p-av" src="${esc(u.avatar)}" onerror="this.src='${GUEST_AVATAR}'">
                    </div>
                    <div class="p-name">${esc(u.name)}</div>
                    <div class="p-score"><i class="fa-solid fa-gem"></i> ${u.total.toLocaleString()}</div>
                </div>
            `).join('')}
        </div>`;

    const restHTML = rest.length
        ? `<div class="gifter-list-header"><span>Ranking</span><span>${rest.length} more</span></div>
           <div class="gifter-list">${rest.map((u, i) => `
               <div class="gifter-item" onclick="openUserProfileFromGifter('${esc(u.uid)}')">
                   <div class="gi-rank">${i+4}</div>
                   <img class="gi-av" src="${esc(u.avatar)}" onerror="this.src='${GUEST_AVATAR}'">
                   <div class="gi-info"><div class="gi-name">${esc(u.name)}</div><div class="gi-meta"><span class="gm-count"><i class="fa-solid fa-gift"></i> ${u.count} gift${u.count > 1 ? 's' : ''}</span></div></div>
                   <div class="gi-score"><i class="fa-solid fa-gem"></i> ${u.total.toLocaleString()}</div>
               </div>`).join('')}</div>`
        : '';
    body.innerHTML = podiumHTML + restHTML;
}

/* ═══ Activity ═══ */
const ACT_ICONS = { takeMic:'🎤',leaveMic:'🚪',lockMic:'🔒',unlockMic:'🔓',mute:'🔇',unmute:'🔊',join:'👋',leave:'👋',roomEdit:'✏️',makeAdmin:'👑',removeAdmin:'⭐',kick:'👢',heart:'❤️',react:'😊' };
const ACT_LABELS = { takeMic:'মাইকে উঠেছেন',leaveMic:'সিট ছেড়েছেন',lockMic:'লক করেছেন',unlockMic:'আনলক করেছেন',mute:'মিউট করেছেন',unmute:'আনমিউট করেছেন',join:'রুমে ঢুকলেন',leave:'রুম ছাড়লেন',roomEdit:'রুম এডিট করলেন',makeAdmin:'এডমিন বানালেন',removeAdmin:'এডমিন সরালেন',kick:'কিক করেছেন',heart:'গিফট পেয়েছেন',react:'রিঅ্যাক্ট করেছেন' };

function logActivity(action, seat, extra = {}){
    if (!myProfile) return;
    const payload = {
        uid: myProfile.uid, name: myProfile.name, avatar: myProfile.avatar,
        action, seat, ts: Date.now(), ...extra
    };
    const raw = ls_get(KEY.activity, []) || [];
    const acts = Array.isArray(raw) ? raw.slice() : Object.values(raw);
    acts.push(payload);
    if (acts.length > 30) acts.splice(0, acts.length - 30);
    ls_set(KEY.activity, acts);
    showActivity({ ...payload, self: true });
}

function showActivity(a){
    const strip = $('activityStrip');
    if (!strip) return;
    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `<span style="margin-right:5px">${ACT_ICONS[a.action] || '✨'}</span>${esc(a.name)} ${esc(ACT_LABELS[a.action] || a.action)}${(a.seat !== undefined && a.seat !== null) ? ` #${a.seat + 1}` : ''}${a.target ? ' ' + esc(a.target) : ''}`;
    strip.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity .4s, transform .4s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => el.remove(), 400);
    }, 5000);
    while (strip.children.length > 5) strip.firstChild.remove();
}

window.updateRoleFlag = updateRoleFlag;
window.updateSettingsVisibility = updateSettingsVisibility;
window.updateJoinButton = updateJoinButton;
window.renderTopGifters = renderTopGifters;
window.renderGifterBody = renderGifterBody;
window.logActivity = logActivity;
window.showActivity = showActivity;
/* ═══ Message feed ═══ */
function renderMessageFeed(){
    $('topicText').textContent = state.topic || 'কোনো টপিক নেই';
    const list = $('messagesList');
    if (!state.messages.length){
        list.innerHTML = `<div class="msg-empty">এখনো কোনো মেসেজ নেই...</div>`;
        return;
    }
    list.innerHTML = state.messages.slice(-60).map(m => {
        if (m.type === 'gift') return `<div class="msg-item gift-msg">🎁 <span class="msg-name">${esc(m.name)}</span>${esc(m.text)}</div>`;
        return `<div class="msg-item"><span class="msg-name">${esc(m.name)}</span>${esc(m.text)}</div>`;
    }).join('');
    $('messageFeed').scrollTop = $('messageFeed').scrollHeight;
}

function pushMessage(payload){
    if (myProfile && myProfile.isGuest){ toastMsg('গেস্ট মেসেজ পাঠাতে পারে না — লগইন করুন'); return; }
    const id = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    state.messages.push({ ...payload, id, senderUid: myProfile ? myProfile.uid : '', ts: Date.now() });
    if (state.messages.length > 100) state.messages.splice(0, state.messages.length - 100);
    ls_set(KEY.messages, state.messages);
    renderMessageFeed();
}

/* ═══ Branding (room logo, name, id) ═══ */
function brandInner(){
    if (state.roomLogo) return `<img src="${esc(state.roomLogo)}" alt="">`;
    const parts = esc(state.roomName || 'HOUR FM').split(/\s+/).slice(0, 2).join('<br>');
    return `<span class="cassette-text">${parts}</span>`;
}

function renderBranding(){
    $('room-logo-preview').innerHTML = brandInner();
    $('room-name-display').textContent = state.roomName;
    $('room-logo-modal-container').innerHTML = brandInner();
    $('room-name-modal-display').textContent = state.roomName;
    $('room-id-modal').textContent = 'ID:' + state.roomId;
    const oi = $('owner-info-modal');
    if (state.owner && state.owner.name){
        oi.style.display = 'flex';
        oi.innerHTML = `<img src="${esc(state.owner.avatar || GUEST_AVATAR)}"><div class="oi-text"><div class="oi-name">${esc(state.owner.name)}</div><div class="oi-uid">UID: ${esc(state.owner.uid)}</div></div><i class="fa-solid fa-crown oi-crown"></i>`;
    } else {
        oi.style.display = 'none';
    }
}

/* ═══ Seats grid ═══ */
function renderSeats(){
    if (typeof destroyAllRings === 'function') destroyAllRings();
    $('seatsGrid').innerHTML = state.seats.map((s, i) => {
        let cls = 'seat-avatar', roleBadge = '', badge = '', contentHTML = '', muteHTML = '', lockHTML = '';

        if (s && s.locked && !s.uid){
            cls += ' locked';
            lockHTML = `<div class="seat-lock-overlay"><i class="fa-solid fa-lock"></i></div>`;
        } else if (s && s.uid){
            cls += ' occupied';
            if (myProfile && s.uid === myProfile.uid) cls += ' is-me';
            const r = (myProfile && s.uid === myProfile.uid) ? (state.myRole || 'member') : getRoleOf(s.uid);
            if (r === 'owner'){ cls += ' is-owner'; roleBadge = `<span class="role-badge-seat owner"><i class="fa-solid fa-crown"></i></span>`; }
            else if (r === 'admin'){ cls += ' is-admin'; roleBadge = `<span class="role-badge-seat admin"><i class="fa-solid fa-shield-halved"></i></span>`; }
            contentHTML = `<div class="seat-content"><img src="${s.avatar || GUEST_AVATAR}" alt=""></div>`;
            if (!s.mic) muteHTML = `<div class="seat-mute-overlay"><i class="fa-solid fa-microphone-slash"></i></div>`;
            if (s.locked) lockHTML = `<div class="seat-lock-overlay"><i class="fa-solid fa-lock"></i></div>`;
            else badge = `<span class="mic-badge ${s.mic ? 'on' : 'off'}"><i class="fa-solid fa-microphone${s.mic ? '' : '-slash'}"></i></span>`;
        }
        const label = s && s.name ? esc(s.name) : (s && s.locked ? 'Locked' : (i + 1));
        const coins = (s && s.coins) ? s.coins : 0;
        return `<div class="seat" data-seat="${i}" data-uid="${s && s.uid ? esc(s.uid) : ''}">
            <div class="${cls}" onclick="openSeatSheet(${i})">
                <img class="seat-bg" src="https://raw.githubusercontent.com/farjanaaktar1173-boop/Owner-room/main/seat-bg.jpg" alt="" loading="lazy">
                ${contentHTML}${muteHTML}${lockHTML}
                <div class="seat-reaction-layer" id="reactLayer${i}"></div>
                ${roleBadge}${badge}
            </div>
            <div class="seat-meta">
                <div class="seat-number ${s && s.name ? 'taken' : ''}">${label}</div>
                <div class="seat-coins"><i class="fa-solid fa-gem"></i> ${coins.toLocaleString('en-IN')}</div>
            </div>
        </div>`;
    }).join('');
    updateRoomPoints();
    setTimeout(refreshAllRings, 0);
}

function getTotalRoomCoins(){
    return state.seats.reduce((sum, x) => sum + (x && x.coins ? x.coins : 0), 0);
}

function updateRoomPoints(){
    $('roomPointsVal').textContent = getTotalRoomCoins().toLocaleString('en-IN');
}

/* ═══ Mic button (bottom bar) ═══ */
function updateMicButton(){
    const btn = $('micToggleBtn');
    if (!btn) return;
    if (!myProfile){
        btn.classList.remove('mic-on','mic-off');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        return;
    }
    const idx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (idx === -1){
        btn.classList.remove('mic-on','mic-off');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        return;
    }
    const on = state.seats[idx].mic;
    btn.classList.toggle('mic-on', on);
    btn.classList.toggle('mic-off', !on);
    btn.innerHTML = on ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
}

window.renderMessageFeed = renderMessageFeed;
window.pushMessage = pushMessage;
window.brandInner = brandInner;
window.renderBranding = renderBranding;
window.renderSeats = renderSeats;
window.updateRoomPoints = updateRoomPoints;
window.updateMicButton = updateMicButton;
/* ═══ Listeners modal ═══ */
function renderListeners(){
    if (!state.listeners.length){
        $('listenerList').innerHTML = `<div class="empty-msg">এখনো কেউ অনলাইনে নেই</div>`;
        return;
    }
    const joining = state.listeners.filter(u => state.joinedUsers.has(u.uid) || (myProfile && u.uid === myProfile.uid));
    const notJoining = state.listeners.filter(u => !state.joinedUsers.has(u.uid) && !(myProfile && u.uid === myProfile.uid));

    const cardHTML = (u) => {
        const me = myProfile && u.uid === myProfile.uid;
        const r = me ? (state.myRole || 'member') : getRoleOf(u.uid);
        const cooling = (typeof _inviteCooldowns !== 'undefined') && _inviteCooldowns.has(u.uid);
        const click = me ? '' : `onclick="handleListenerTap('${esc(u.uid)}')"`;
        return `<div class="listener-user-card" data-uid="${esc(u.uid)}" ${click} style="cursor:pointer">
            <img src="${u.avatar || GUEST_AVATAR}" class="listener-user-avatar ${roleBorderClass(r)}">
            <div style="flex:1;min-width:0">
                <div class="listener-user-name">${esc(u.name)} ${roleBadgeHTML(r, 12)}</div>
                <div class="listener-user-sub">${esc(u.uid.slice(0, 12))}</div>
            </div>
            ${me ? `<span class="listener-user-role ${roleBadgeClass(r, me)}">${roleLabel(r, me)}</span>` : `<button class="invite-btn ${cooling ? 'cooldown' : ''}" onclick="event.stopPropagation();inviteUser('${esc(u.uid)}')"><i class="fa-solid ${cooling ? 'fa-clock' : 'fa-paper-plane'}"></i> ${cooling ? 'Wait' : 'Invite'}</button>`}
        </div>`;
    };

    let html = joining.map(cardHTML).join('');
    if (notJoining.length){
        html += `<div class="listener-group-label">Not Joining</div><div class="listener-divider"></div>`;
        html += notJoining.map(cardHTML).join('');
    }
    $('listenerList').innerHTML = html;
    setTimeout(refreshAllRings, 0);
}

/* ═══ Members modal ═══ */
window.renderMembers = () => {
    const q = ($('memberSearch').value || '').trim().toLowerCase();
    const list = state.listeners.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );

    $('userList').innerHTML = list.length
        ? list.map(u => {
            const me = myProfile && u.uid === myProfile.uid;
            const r = me ? (state.myRole || 'member') : getRoleOf(u.uid);
            return `<div class="user-card" data-uid="${esc(u.uid)}" onclick="handleMemberTap('${esc(u.uid)}')">
                <div class="user-avatar-box">
                    <img src="${u.avatar || GUEST_AVATAR}" class="user-avatar ${roleBorderClass(r)}">
                    <div class="user-badge ${roleBadgeClass(r, me)}">${roleLabel(r, me)}</div>
                </div>
                <div class="user-details">
                    <div class="user-name-row">${esc(u.name)}${r === 'owner' ? '<i class="fa-solid fa-crown role-crown"></i>' : ''}${r === 'admin' ? '<i class="fa-solid fa-shield-halved role-shield"></i>' : ''}</div>
                    <div class="user-desc"><span class="role-dot ${r}"></span>${esc(u.uid.slice(0, 14))}</div>
                </div>
                <i class="fa-solid fa-user" style="color:#00E5FF;font-size:18px"></i>
            </div>`;
        }).join('')
        : `<div class="empty-msg">কোনো মেম্বার পাওয়া যায়নি</div>`;

    $('memberCounter').textContent = `${state.listeners.length}/4000`;
    setTimeout(refreshAllRings, 0);
};

/* ═══ Seat Reaction (emoji ভেসে ওঠা) ═══ */
function showSeatReaction(seatIndex, code, src){
    if (seatIndex < 0 || seatIndex >= 10) return;
    const layer = $('reactLayer' + seatIndex);
    if (!layer) return;

    const burst = document.createElement('div');
    burst.className = 'seat-react-burst';
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 900);

    for (let i = 0; i < 3; i++){
        setTimeout(() => {
            const img = document.createElement('img');
            img.className = 'seat-react';
            img.src = src;
            img.onerror = () => {
                const div = document.createElement('div');
                div.className = 'seat-react';
                div.style.display = 'grid';
                div.style.placeItems = 'center';
                div.style.fontSize = '26px';
                div.style.color = '#fff';
                div.textContent = emojiFallback(code);
                img.replaceWith(div);
            };
            layer.appendChild(img);
            setTimeout(() => img.remove(), 2400);
        }, i * 80);
    }
}

/* ═══ Emoji fallback (ইন্টারনেট না থাকলে) ═══ */
function emojiFallback(code){
    const map = {
        '1f602':'😂','1f60d':'😍','1f62d':'😭','2764_fe0f':'❤️',
        '1f525':'🔥','1f44f':'👏','1f44d':'👍','2728':'✨',
        '1f389':'🎉','1f970':'🥰'
    };
    return map[code] || '😊';
}

window.renderListeners = renderListeners;
window.showSeatReaction = showSeatReaction;
window.emojiFallback = emojiFallback;