/* login/login.js — আসল লগইন: Phone OTP, Google, Guest (Firebase Authentication) */
console.log('[MOI] login.js loaded');

const views = { login: $('view-login'), profile: $('view-profile'), phone: $('view-phone') };
const redirectOverlay = $('redirectOverlay');
let selectedVoice = '';
let currentProfile = null;

function showView(name){ Object.keys(views).forEach(k => views[k].classList.toggle('hidden', k !== name)); }
function showRedirect(on){ redirectOverlay.classList.toggle('show', on); }
function busy(btn, on, html){ if (on){ btn._h = btn.innerHTML; btn.innerHTML = '<span class="loading"></span><span>' + (html || 'Please wait…') + '</span>'; btn.disabled = true; } else { if (btn._h) btn.innerHTML = btn._h; btn.disabled = false; } }

/* Firebase এরর → সহজ বাংলা */
function errText(e){
    const c = (e && e.code) || '';
    const m = {
        'auth/invalid-phone-number': 'ফোন নম্বরটি সঠিক নয়। দেশের কোড সহ লিখুন।',
        'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
        'auth/invalid-verification-code': 'কোডটি ভুল। আবার চেষ্টা করুন।',
        'auth/code-expired': 'কোডের মেয়াদ শেষ। নতুন কোড পাঠান।',
        'auth/popup-closed-by-user': 'লগইন বাতিল করা হয়েছে।',
        'auth/network-request-failed': 'ইন্টারনেট সংযোগ চেক করুন।',
        'auth/operation-not-allowed': 'এই লগইন পদ্ধতি Firebase Console-এ চালু করা নেই।',
        'auth/unauthorized-domain': 'এই ডোমেইন Firebase → Authentication → Settings → Authorized domains এ যোগ করুন।',
        'auth/captcha-check-failed': 'reCAPTCHA যাচাই ব্যর্থ। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।'
    };
    if (e && e.code === 'BANNED') return 'এই অ্যাকাউন্ট নিষিদ্ধ করা হয়েছে' + ((e.profile && e.profile.banReason) ? ': ' + e.profile.banReason : '।');
    return m[c] || ('সমস্যা হয়েছে: ' + ((e && e.message) || c || 'অজানা'));
}

/* লগইন সফল → রোল অনুযায়ী পেজ */
function redirectFor(p){
    showRedirect(true);
    $('redirectWho').textContent = 'স্বাগতম, ' + (p.name || 'User') + '! নিয়ে যাওয়া হচ্ছে…';
    $('redirectCounter').textContent = '';
    const panel = MOIAuth.panelFor(p.role);
    const url = panel ? '../' + panel : '../home/index.html';
    setTimeout(() => location.replace(url), 700);
}

/* লগইনের পর: প্রোফাইল অসম্পূর্ণ হলে সেটআপ, নইলে সরাসরি */
function afterLogin(p){
    if (!p){ alert('প্রোফাইল লোড হয়নি। আবার চেষ্টা করুন।'); return; }
    currentProfile = p;
    if (!p.profileComplete && p.role !== 'guest'){
        $('profileName').textContent = p.name || 'User';
        $('profileAvatar').innerHTML = '<img src="' + esc(p.photo || GUEST_AVATAR) + '" alt="" onerror="this.src=\'' + GUEST_AVATAR + '\'">';
        $('countrySelect').value = p.country || '';
        selectedVoice = p.voice || '';
        document.querySelectorAll('.voice-btn').forEach(b => b.classList.toggle('active', b.dataset.voice === selectedVoice));
        showView('profile'); return;
    }
    redirectFor(p);
}

/* বাটন রিপল */
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('pointermove', e => { const r = btn.getBoundingClientRect(); btn.style.setProperty('--mx', (e.clientX - r.left) + 'px'); btn.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    btn.addEventListener('pointerdown', e => {
        const r = btn.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
        s.className = 'ripple'; s.style.width = s.style.height = d + 'px';
        s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
        btn.appendChild(s); setTimeout(() => s.remove(), 760);
    });
});

document.querySelectorAll('.voice-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); selectedVoice = btn.dataset.voice;
}));

/* ═══ Google ═══ */
$('googleBtn').addEventListener('click', async () => {
    const b = $('googleBtn'); busy(b, true, 'Connecting…');
    try { afterLogin(await MOIAuth.google()); } catch(e){ alert(errText(e)); } finally { busy(b, false); }
});

/* ═══ Guest (Anonymous) ═══ */
$('guestBtn').addEventListener('click', async () => {
    const b = $('guestBtn'); busy(b, true, 'Please wait…');
    try { afterLogin(await MOIAuth.guest()); } catch(e){ alert(errText(e)); } finally { busy(b, false); }
});

/* ═══ প্রোফাইল সেটআপ সেভ ═══ */
$('saveProfileBtn').addEventListener('click', async () => {
    if (!currentProfile){ showView('login'); return; }
    const country = $('countrySelect').value;
    if (!country) return alert('অনুগ্রহ করে আপনার দেশ সিলেক্ট করুন।');
    if (!selectedVoice) return alert('অনুগ্রহ করে ভয়েস প্রেফারেন্স সিলেক্ট করুন।');
    const b = $('saveProfileBtn'); busy(b, true, 'Saving…');
    try {
        saveUser(currentProfile.uid, { country, voice: selectedVoice, profileComplete: true });
        await new Promise(r => setTimeout(r, 700));                 /* Firestore-এ লেখা শেষ হওয়ার সময় */
        redirectFor(Object.assign({}, currentProfile, { country, voice: selectedVoice }));
    } catch(e){ alert('সেভ করতে সমস্যা: ' + e.message); busy(b, false); }
});

/* ═══ Phone OTP ═══ */
(function(){
    let phoneFull = '', tickId = null;
    const boxes = () => [...document.querySelectorAll('#otpRow .otp-box')];
    const step = n => {
        $('phoneStep1').style.display = n === 1 ? '' : 'none'; $('phoneStep2').style.display = n === 2 ? '' : 'none';
        $('phoneSubmitText').textContent = n === 1 ? 'Send code' : 'Verify & continue';
        $('phoneTitle').textContent = n === 1 ? 'PHONE LOGIN' : 'ENTER CODE';
        $('phoneSub').textContent = n === 1 ? "We'll send you a code" : 'Sent to ' + phoneFull;
    };
    function startTimer(){
        clearInterval(tickId); let left = 30; const rb = $('otpResend'); rb.disabled = true; $('otpTimer').textContent = 'Resend in ' + left + 's';
        tickId = setInterval(() => { left--; if (left <= 0){ clearInterval(tickId); rb.disabled = false; $('otpTimer').textContent = ''; } else $('otpTimer').textContent = 'Resend in ' + left + 's'; }, 1000);
    }
    async function sendCode(){
        const btn = $('phoneSubmit'); busy(btn, true, 'Sending…');
        try {
            await MOIAuth.phoneStart(phoneFull.replace(/\s/g, ''), 'recaptcha-container');
            boxes().forEach(b => { b.value = ''; b.classList.remove('filled'); }); $('otpRow').classList.remove('err');
            busy(btn, false); step(2); startTimer(); setTimeout(() => boxes()[0].focus(), 80);
        } catch(e){ busy(btn, false); alert(errText(e)); }
    }
    $('phoneBtn').addEventListener('click', () => { step(1); showView('phone'); setTimeout(() => $('phoneNum').focus(), 120); });
    $('phoneBack').addEventListener('click', () => { if ($('phoneStep2').style.display !== 'none'){ step(1); clearInterval(tickId); return; } clearInterval(tickId); showView('login'); });
    $('phoneNum').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
    $('phoneNum').addEventListener('keydown', e => { if (e.key === 'Enter') $('phoneSubmit').click(); });
    $('otpResend').addEventListener('click', sendCode);
    boxes().forEach((b, i, all) => {
        b.addEventListener('input', () => {
            b.value = b.value.replace(/\D/g, '').slice(0, 1); b.classList.toggle('filled', !!b.value); $('otpRow').classList.remove('err');
            if (b.value && all[i + 1]) all[i + 1].focus();
            if (i === all.length - 1 && all.every(x => x.value)) $('phoneSubmit').click();
        });
        b.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !b.value && all[i - 1]){ all[i - 1].focus(); all[i - 1].value = ''; all[i - 1].classList.remove('filled'); }
            if (e.key === 'Enter') $('phoneSubmit').click();
        });
        b.addEventListener('paste', e => {
            const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault();
            t.split('').forEach((c, k) => { if (all[k]){ all[k].value = c; all[k].classList.add('filled'); } }); all[Math.min(t.length, 5)].focus();
            if (t.length === 6) $('phoneSubmit').click();
        });
    });
    $('phoneSubmit').addEventListener('click', async () => {
        if ($('phoneStep1').style.display !== 'none'){
            const num = $('phoneNum').value.replace(/^0+/, '');
            if (num.length < 7 || num.length > 12){ alert('সঠিক মোবাইল নম্বর দিন।'); return; }
            phoneFull = $('phoneCc').value + num; sendCode(); return;
        }
        const code = boxes().map(b => b.value).join(''); if (code.length < 6) return;
        const btn = $('phoneSubmit'); busy(btn, true, 'Verifying…');
        try { clearInterval(tickId); const p = await MOIAuth.phoneConfirm(code); busy(btn, false); afterLogin(p); }
        catch(e){ busy(btn, false); $('otpRow').classList.add('err'); if (navigator.vibrate) navigator.vibrate(60); alert(errText(e)); }
    });
})();

/* আগে থেকেই লগইন থাকলে সরাসরি ভেতরে (পেজ খোলার সময়) */
(async () => {
    try {
        const u = await MOIReady;
        if (u){ const p = await MOIAuth.whenReady(); if (p) afterLogin(p); }
    } catch(e){ if (e && e.code === 'BANNED') alert(errText(e)); }
})();
