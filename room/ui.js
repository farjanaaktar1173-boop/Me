/* room/ui.js — সব UI কাজ (sheets, modals, gifts, emoji) */

console.log('[ROOM] ui.js loaded');

/* ═══ Sheet options দেখানো ═══ */
function showSheetOptions(title, options){
    $('sheetTitle').textContent = title;
    $('sheetOptions').innerHTML = options.map((o, k) =>
        `<div class="sheet-option ${o.danger?'danger':''} ${o.cls||''}" data-k="${k}">
            <span class="opt-icon"><i class="fa-solid ${o.icon}"></i></span>
            <span class="opt-label">${o.label}</span>
            <i class="fa-solid fa-chevron-right opt-arrow"></i>
        </div>`).join('');
    $('sheetOptions').querySelectorAll('.sheet-option').forEach(el => {
        el.addEventListener('click', () => options[+el.dataset.k].action());
    });
    $('sheetBackdrop').classList.add('active');
    $('seatSheet').classList.add('active');
}

/* ═══ সব sheet বন্ধ ═══ */
window.closeSheet = () => {
    $('sheetBackdrop').classList.remove('active');
    ['seatSheet','msgSheet','chatSheet','emojiSheet','gifterSheet','settingsSheet','gameSheet'].forEach(id => {
        const el = $(id);
        if (el) el.classList.remove('active','fullscreen');
    });
    closePermissionSheet();
    const cf = $('chatFrame');
    if (cf) cf.src = 'about:blank';
    const gf = $('gameFrame');
    if (gf) gf.src = 'about:blank';
};

window.closePermissionSheet = () => {
    $('permissionSheet').classList.remove('active');
    $('sheetBackdrop').classList.remove('active');
};

/* ═══ Modals ═══ */
window.closeModal = (id) => $(id).classList.remove('active');

window.toggleMemberModal = () => {
    const m = $('memberModal');
    m.classList.contains('active') ? closeModal('memberModal') : m.classList.add('active');
};

window.toggleListenersModal = () => {
    const m = $('listenersModal');
    m.classList.contains('active') ? closeModal('listenersModal') : m.classList.add('active');
};

/* ═══ Wallpaper ═══ */
function applyWallpaper(dataUrl){
    const wp = $('roomWallpaper');
    if (!wp) return;
    wp.style.backgroundImage = 'url("' + String(dataUrl).replace(/["\\\n]/g, '') + '")';
    wp.classList.add('has-wallpaper');
}

window.openWallpaperPicker = () => {
    closeSheet();
    setTimeout(() => $('wallpaperInput').click(), 200);
};

window.handleWallpaperSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024){
        toastMsg('❌ ছবি ৪.৫ MB এর কম হতে হবে');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
        toastMsg('⏳ আপলোড হচ্ছে...');
        const url = await MOIStorage.roomWallpaper(ROOM_ID, ev.target.result);
        if (url.indexOf('data:') === 0){ toastMsg('❌ আপলোড ব্যর্থ হয়েছে'); return; }
        applyWallpaper(url);
        ls_set(KEY.wallpaper, { dataUrl: url, ts: Date.now() });      /* সবার রুমে একসাথে বদলায় */
        toastMsg('✅ Wallpaper পরিবর্তন হয়েছে');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

/* ═══ Settings menu ═══ */
window.openSettingsMenu = () => {
    if (!isAdminOrOwner()){
        toastMsg('শুধু Owner/Admin Settings ব্যবহার করতে পারবে');
        return;
    }
    closeSheet();
    $('sheetBackdrop').classList.add('active');
    $('settingsSheet').classList.add('active');
};

window.settingsNotReady = (name) => {
    toastMsg(`⚙️ ${name} — শীঘ্রই আসছে`);
};

/* ═══ Gifter leaderboard ═══ */
window.openGifterLeaderboard = () => {
    closeSheet();
    renderGifterBody();
    $('sheetBackdrop').classList.add('active');
    $('gifterSheet').classList.add('active');
};

window.openUserProfileFromGifter = (uid) => {
    closeSheet();
    setTimeout(() => {
        const u = state.listeners.find(x => x.uid === uid);
        if (u) openUserProfile(uid);
        else toastMsg('ইউজার এখন রুমে নেই');
    }, 250);
};

/* ═══ Gift record — gifts.js এইটাকে call করে ═══ */
/* গিফট স্ট্যাট এখন সার্ভার লেখে (Realtime DB giftStats) — ক্লায়েন্টে আর হাতে রেকর্ড হয় না */
function recordGift(){ }

/* ═══════════════════════════════════════════════════════════════
   ⚠️ পুরনো gift system মুছে ফেলা হয়েছে:
   - window.openGiftPicker
   - window.pickGiftTarget
   - openGiftSheet
   - window.sendGiftDemo
   - getSeatCenterPx
   - playGiftAnimation
   
   নতুন gift system এখন gifts.js এ
   ═══════════════════════════════════════════════════════════════ */

/* ═══ Emoji sheet ═══ */
function buildEmojiCategories(){
    $('emojiCategories').innerHTML = EMOJI_CATEGORIES.map((c, i) =>
        `<button class="emoji-cat-chip ${i===0?'active':''}" onclick="switchEmojiCat(${i})">${c.label}</button>`).join('');
}

function renderEmojiGrid(){
    const cat = EMOJI_CATEGORIES[activeEmojiCat];
    if (!cat) return;
    $('emojiGrid').innerHTML = cat.items.map(code => {
        const src = EMOJI_BASE + code + '/512.gif';
        return `<div class="emoji-grid-item" onclick="sendEmojiReaction('${code}')"><img src="${src}" loading="lazy" alt="" onerror="this.parentElement.innerHTML='<div style=\\'font-size:32px;text-align:center\\'>${emojiFallback(code)}</div>'"></div>`;
    }).join('');
}

window.switchEmojiCat = (i) => {
    activeEmojiCat = i;
    document.querySelectorAll('.emoji-cat-chip').forEach((c, k) => c.classList.toggle('active', k === i));
    renderEmojiGrid();
};

window.openEmojiSheet = () => {
    if (!myProfile){
        toastMsg('লগইন করুন');
        return;
    }
    const seatIdx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (seatIdx === -1){
        toastMsg('আগে একটা সিটে উঠুন 🎤');
        return;
    }
    closeSheet();
    buildEmojiCategories();
    renderEmojiGrid();
    $('sheetBackdrop').classList.add('active');
    $('emojiSheet').classList.add('active');
};

window.sendEmojiReaction = (code) => {
    if (!myProfile) return;
    const idx = state.seats.findIndex(s => s && s.uid === myProfile.uid);
    if (idx === -1){
        toastMsg('আগে একটা সিটে উঠুন');
        return;
    }
    const src = EMOJI_BASE + code + '/512.gif';
    closeSheet();
    showSeatReaction(idx, code, src);
    logActivity('react', idx);
};

/* ═══════════════════════════════════════════════════════════════
   ⬇️⬇️⬇️ Room Profile Edit / Exit Menu / Chat / Game ⬇️⬇️⬇️
   ═══════════════════════════════════════════════════════════════ */

/* ═══ Edit Room Profile ═══ */
let _cropperInstance = null;

window.openEditRoom = () => {
    if (!isOwner()){
        toastMsg('শুধু Owner রুম এডিট করতে পারবে');
        return;
    }
    closeModal('memberModal');

    $('roomNameInput').value = state.roomName || '';
    $('roomIdInput').value = state.roomId || ROOM_ID;

    const preview = $('room-logo-edit-preview');
    if (state.roomLogo){
        preview.innerHTML = `<img src="${state.roomLogo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
        const parts = esc(state.roomName || 'HOUR FM').split(/\s+/).slice(0, 2).join('<br>');
        preview.innerHTML = `<span class="cassette-text">${parts}</span>`;
    }

    $('editRoomModal').classList.add('active');
};

window.previewRoomImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        $('cropImage').src = ev.target.result;
        $('cropModal').classList.add('active');

        setTimeout(() => {
            if (_cropperInstance){
                _cropperInstance.destroy();
                _cropperInstance = null;
            }
            _cropperInstance = new Cropper($('cropImage'), {
                aspectRatio: 1,
                viewMode: 1,
                background: false,
                autoCropArea: 0.85
            });
        }, 150);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

window.cancelCrop = () => {
    $('cropModal').classList.remove('active');
    if (_cropperInstance){
        _cropperInstance.destroy();
        _cropperInstance = null;
    }
};

window.applyCrop = () => {
    if (!_cropperInstance) return;
    const canvas = _cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const preview = $('room-logo-edit-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    preview.dataset.newLogo = dataUrl;

    $('cropModal').classList.remove('active');
    _cropperInstance.destroy();
    _cropperInstance = null;
};

window.saveRoomProfile = async () => {
    if (!isOwner()) return;

    const newName = ($('roomNameInput').value || '').trim().slice(0, 30);
    if (newName.length < 2){
        toastMsg('রুমের নাম কমপক্ষে ২ অক্ষর');
        return;
    }

    const preview = $('room-logo-edit-preview');
    let newLogo = preview.dataset.newLogo || state.roomLogo;
    if (newLogo && String(newLogo).indexOf('data:') === 0){
        toastMsg('⏳ লোগো আপলোড হচ্ছে...');
        newLogo = await MOIStorage.roomLogo(ROOM_ID, newLogo);
        if (String(newLogo).indexOf('data:') === 0){ toastMsg('❌ লোগো আপলোড ব্যর্থ'); return; }
    }

    state.roomName = newName;
    if (newLogo) state.roomLogo = newLogo;
    saveRoomInfo(ROOM_ID, newLogo ? { name: newName, logo: newLogo } : { name: newName });

    renderBranding();
    closeModal('editRoomModal');
    toastMsg('✅ রুম প্রোফাইল আপডেট হয়েছে');
};

/* ═══ Exit menu (Keep / Exit) ═══ */
window.toggleExitMenu = (event) => {
    if (event) event.stopPropagation();
    const m = $('exitMenu');
    if (!m) return;
    m.classList.toggle('show');
};

document.addEventListener('click', (e) => {
    const m = $('exitMenu');
    if (m && m.classList.contains('show')){
        if (!e.target.closest('.exit-wrapper')) m.classList.remove('show');
    }
});

window.keepRoom = () => {
    $('exitMenu').classList.remove('show');
    toastMsg('📌 রুম ব্যাকগ্রাউন্ডে রাখা হয়েছে');
    setTimeout(() => {
        location.href = '../home/index.html';
    }, 600);
};

window.exitRoom = () => {
    $('exitMenu').classList.remove('show');
    if (!confirm('রুম থেকে বের হতে চান?')) return;
    if (typeof presenceLeave === 'function') presenceLeave();
    location.href = '../home/index.html';
};

/* ═══ Chat sheet (iframe) ═══ */
window.openChatSheet = (uid, name) => {
    closeSheet();

    const frame = $('chatFrame');
    const loading = $('chatLoading');

    let url = '../chat/index.html';
    if (uid){
        const u = new URL(url, location.href);
        u.searchParams.set('targetUid', uid);
        if (name) u.searchParams.set('targetName', name);
        url = u.toString();
    }

    loading.classList.remove('hidden');
    frame.src = url;
    frame.onload = () => loading.classList.add('hidden');

    $('sheetBackdrop').classList.add('active');
    $('chatSheet').classList.add('active');
};

/* ═══ Game sheet (iframe) ═══ */
window.openGameSheet = () => {
    closeSheet();

    const frame = $('gameFrame');
    const loading = $('gameLoading');

    const gameUrl = 'about:blank';

    loading.classList.remove('hidden');
    frame.src = gameUrl;
    frame.onload = () => loading.classList.add('hidden');

    $('sheetBackdrop').classList.add('active');
    $('gameSheet').classList.add('active');
};

/* ═══ Fullscreen toggle ═══ */
window.toggleIframeFullscreen = (sheetId) => {
    const el = $(sheetId);
    if (!el) return;
    el.classList.toggle('fullscreen');
};

/* ═══ Exports ═══ */
window.buildEmojiCategories = buildEmojiCategories;
window.renderEmojiGrid = renderEmojiGrid;
window.recordGift = recordGift;