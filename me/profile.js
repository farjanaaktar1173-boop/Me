/* me/profile.js — নাম, ছবি বদলানো, Cropper */

console.log('[MOI] profile.js loaded');

const DEFAULT_AV = GUEST_AVATAR;
let cropper = null;

/* ═══ প্রোফাইল রেন্ডার ═══ */
function renderProfile(){
    document.getElementById('userName').textContent = window.me.name || 'User';
    document.getElementById('userUid').textContent = window.me.moiId || (window.me.uid ? window.me.uid.slice(0, 12) : '— — — — — —');
    const img = document.getElementById('profileImage');
    img.src = window.me.photo || DEFAULT_AV;
    img.onerror = () => { img.src = DEFAULT_AV; };
    renderMeExtras();
}

/* ═══ নতুন: bio, level card, pill ═══ */
function renderMeExtras(){
    if (!window.MOI) return;
    const m = MOI.me();
    const bio = (m && m.bio) || '';
    const bt = document.getElementById('bioText');
    if (bt){ bt.textContent = bio || 'আপনার সম্পর্কে কিছু লিখুন…'; bt.classList.toggle('is-empty', !bio); }
    const li = MOI.levelInfo();
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    let idc = document.getElementById('idChips');
    if (!idc){ const n = document.getElementById('userName'); if (n){ idc = document.createElement('div'); idc.id = 'idChips'; idc.style.cssText = 'margin-top:4px;display:flex;gap:4px;justify-content:center;align-items:center;flex-wrap:wrap'; n.parentNode.insertBefore(idc, n.nextSibling); } }
    if (idc) idc.innerHTML = MOI.identityHTML(m);
    const aw = document.querySelector('.avatar-wrap'); if (aw && MOI.crownAttachUser) MOI.crownAttachUser(aw, m);
    set('lvlNum', li.level); set('lvlTitle', li.title);
    set('lvlXp', MOI.fmt(li.xp) + ' / ' + MOI.fmt(li.hi) + ' XP');
    const bar = document.getElementById('lvlBar'); if (bar) bar.style.width = li.pct + '%';
    const pc = document.getElementById('pillCheckin'); if (pc) pc.style.display = MOI.canCheckin() ? '' : 'none';
    const ps = document.getElementById('pillSpin'); if (ps) ps.style.display = MOI.canSpin() ? '' : 'none';
    const un = MOI.unread(), pn = document.getElementById('pillNotif');
    if (pn){ pn.textContent = un; pn.style.display = un ? '' : 'none'; }
}
window.renderMeExtras = renderMeExtras;

window.openBio = () => {
    if (!window.me.uid){ toastMsg('লগইন করুন','fa-lock'); return; }
    const cur = (MOI.me() || {}).bio || '';
    MOI.sheet('Bio', `<textarea id="bioInput" class="mx-textarea" maxlength="90" placeholder="যেমন: গান ভালোবাসি 🎶 | রাতে রুমে পাবেন">${MOI.esc(cur)}</textarea>
        <div class="mx-muted" style="text-align:right;margin:4px 2px 12px"><span id="bioCount">${cur.length}</span>/90</div>
        <button class="mx-btn" style="width:100%" onclick="saveBio()">Save</button>`);
    const t = document.getElementById('bioInput'); t.addEventListener('input', () => document.getElementById('bioCount').textContent = t.value.length);
    setTimeout(() => t.focus(), 250);
};
window.saveBio = () => {
    const v = document.getElementById('bioInput').value.trim();
    MOI.saveMe({ bio: v });
    MOI.close(); renderMeExtras();
    toastMsg(v ? 'Bio আপডেট হয়েছে' : 'Bio মুছে ফেলা হয়েছে');
};

/* ═══ Follow সংখ্যা ═══ */
function loadFollowCounts(){
    const followers = ls_get('moi_follow_' + window.me.uid + '_followers', []) || [];
    const following = ls_get('moi_follow_' + window.me.uid + '_following', []) || [];
    document.getElementById('statFollowers').textContent = followers.length;
    document.getElementById('statFollowing').textContent = following.length;
}

/* ═══ Back button ═══ */
window.goBack = () => {
    if (history.length > 1) history.back();
    else location.href = URLS.home;
};

/* ═══ ছবি বদলানো (Cropper) ═══ */
function initCropper(){
    const imageInput = document.getElementById('imageInput');
    const cropModal = document.getElementById('cropModal');

    imageInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || !files.length) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('imageToCrop').src = ev.target.result;
            cropModal.classList.add('show');
            if (cropper){ cropper.destroy(); cropper = null; }
            setTimeout(() => {
                cropper = new Cropper(document.getElementById('imageToCrop'), {
                    aspectRatio:1, viewMode:1, autoCropArea:0.9,
                    background:false, guides:false, center:false, highlight:false
                });
            }, 120);
        };
        reader.readAsDataURL(files[0]);
    });

    document.getElementById('cropBtn').addEventListener('click', async () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({ width:400, height:400, imageSmoothingQuality:'high' });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        try {
            toastMsg('আপলোড হচ্ছে...', 'fa-cloud-arrow-up');
            const url = await MOIStorage.profile(window.me.uid, dataUrl);
            window.me.photo = url;
            document.getElementById('profileImage').src = url;
            saveUser(window.me.uid, { photo: url });
            const cur = getCurrentUser();
            if (cur && cur.uid === window.me.uid){ cur.photo = url; setCurrentUser(cur); }
            toastMsg('প্রোফাইল ছবি আপডেট হয়েছে');
        } catch(e){ console.error(e); toastMsg('ছবি আপলোড ব্যর্থ হয়েছে', 'fa-triangle-exclamation'); }
        window.closeCropModal();
    });
}

window.closeCropModal = () => {
    document.getElementById('cropModal').classList.remove('show');
    if (cropper){ cropper.destroy(); cropper = null; }
    document.getElementById('imageInput').value = '';
};

/* ═══ নাম বদলানো ═══ */
window.openNameModal = () => {
    if (!window.me.uid){ toastMsg('লগইন করুন','fa-lock'); return; }
    document.getElementById('newNameInput').value = window.me.name || '';
    document.getElementById('nameModal').classList.add('show');
    setTimeout(() => document.getElementById('newNameInput').focus(), 200);
};

window.closeNameModal = () => document.getElementById('nameModal').classList.remove('show');

function initNameChange(){
    document.getElementById('saveNameBtn').addEventListener('click', () => {
        const newName = document.getElementById('newNameInput').value.trim();
        if (!newName){ toastMsg('নাম খালি রাখা যাবে না','fa-triangle-exclamation'); return; }
        if (newName.length > 24){ toastMsg('সর্বোচ্চ ২৪ অক্ষর','fa-triangle-exclamation'); return; }
        window.me.name = newName;
        document.getElementById('userName').textContent = newName;
        saveUser(window.me.uid, { name: newName });
        const cur = getCurrentUser();
        if (cur && cur.uid === window.me.uid){ cur.name = newName; setCurrentUser(cur); }
        toastMsg('নাম আপডেট হয়েছে');
        window.closeNameModal();
    });
}

/* Follow লিস্ট → panels.js */

window.initCropper = initCropper;
window.initNameChange = initNameChange;
window.renderProfile = renderProfile;
window.loadFollowCounts = loadFollowCounts;