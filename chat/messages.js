/* chat/messages.js — মেসেজ পাঠানো, রেন্ডার, reply, delete */

console.log('[MOI] messages.js loaded');

let replyTarget = null;

/* ═══ রুম আইডি (দুই uid এর মধ্যে) ═══ */
function roomId(a, b){
    return [a, b].sort().join('__');
}

/* ═══ সময় ═══ */
function nowTime(){
    return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function fmtTime(sec){
    if (!isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

/* ═══ মেসেজ তালিকা লোড ═══ */
function loadMessages(){
    if (!window.me || !window.currentChatUid) return [];
    const key = 'moi_chat_' + roomId(window.me.uid, window.currentChatUid);
    const hidden = JSON.parse(localStorage.getItem('moi_chat_hidden_' + window.me.uid) || '{}');
    return (ls_get(key, []) || []).filter(m => !hidden[m.id]);
}

function saveMessages(list){
    if (!window.me || !window.currentChatUid) return;
    const key = 'moi_chat_' + roomId(window.me.uid, window.currentChatUid);
    ls_set(key, list);
}

/* ═══ সব মেসেজ আবার রেন্ডার ═══ */
function renderAllMessages(){
    const body = document.getElementById('chatBody');
    body.innerHTML = '';
    const list = loadMessages();
    list.forEach(m => appendMessage(m));
    body.scrollTop = body.scrollHeight;
}

/* ═══ একটা মেসেজ যোগ করা ═══ */
function appendMessage(data){
    const isMe = data.senderUid === window.me.uid;
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap ' + (isMe ? 'outgoing' : 'incoming');
    wrap.dataset.key = data.id || '';
    wrap.dataset.isMe = isMe ? '1' : '0';

    let tick = '';
    if (isMe){
        if (data.seen) tick = '<i class="fa-solid fa-circle-check tick tick-seen"></i>';
        else if (data.delivered) tick = '<i class="fa-solid fa-check-double tick tick-delivered"></i>';
        else tick = '<i class="fa-solid fa-check tick tick-sent"></i>';
    }

    let quote = '';
    if (data.replyTo){
        const r = data.replyTo;
        quote = `<div class="quote-box">
            <div class="qn">${esc(r.senderName || '')}</div>
            <div class="qt">${esc(r.preview || '')}</div>
        </div>`;
    }

    let inner = '';
    if (data.type === 'text' || data.type === 'gift'){
        inner = `<div class="msg-bubble ${isMe?'outgoing':'incoming'}">${quote}${esc(data.content)}<div class="msg-time">${esc(data.time||'')}${tick}</div></div>`;
    } else if (data.type === 'image'){
        inner = `<div class="msg-bubble ${isMe?'outgoing':'incoming'}">${quote}<img src="${esc(data.content)}"><div class="msg-time">${esc(data.time||'')}${tick}</div></div>`;
    } else if (data.type === 'video'){
        inner = `<div class="msg-bubble ${isMe?'outgoing':'incoming'}">${quote}<video src="${esc(data.content)}" controls></video><div class="msg-time">${esc(data.time||'')}${tick}</div></div>`;
    } else if (data.type === 'audio'){
        const dur = data.duration || 0;
        inner = `<div class="msg-bubble ${isMe?'outgoing':'incoming'}">${quote}
            <div class="voice-player">
                <button class="vp-play"><i class="fa-solid fa-play"></i></button>
                <div class="vp-bar"><div class="vp-bar-inner"></div></div>
                <span class="vp-time">${fmtTime(dur)}</span>
                <audio preload="metadata" src="${esc(data.content)}"></audio>
            </div>
            <div class="msg-time">${esc(data.time||'')}${tick}</div></div>`;
    } else if (data.type === 'emoji'){
        inner = `<div class="msg-bubble emoji-msg ${isMe?'outgoing':'incoming'}">${quote}<span class="e">${data.emoji || '😊'}</span><div class="msg-time" style="justify-content:center;opacity:.5;">${esc(data.time||'')}${tick}</div></div>`;
    }
    wrap.innerHTML = inner;

    if (data.type === 'audio') setupVoicePlayer(wrap);

    /* Long press → action sheet */
    let pressTimer = null;
    const openSheet = () => openMsgActionSheet(data.id, data, isMe);
    const clearP = () => { if (pressTimer){ clearTimeout(pressTimer); pressTimer = null; } };
    wrap.addEventListener('touchstart', () => { pressTimer = setTimeout(openSheet, 550); }, { passive: true });
    wrap.addEventListener('touchend', clearP);
    wrap.addEventListener('touchmove', clearP);
    wrap.addEventListener('touchcancel', clearP);
    wrap.addEventListener('mousedown', e => { if (e.button === 0) pressTimer = setTimeout(openSheet, 550); });
    wrap.addEventListener('mouseup', clearP);
    wrap.addEventListener('mouseleave', clearP);
    wrap.addEventListener('contextmenu', e => { e.preventDefault(); openSheet(); });

    /* Swipe to reply */
    attachSwipeReply(wrap, data);

    document.getElementById('chatBody').appendChild(wrap);
    document.getElementById('chatBody').scrollTop = document.getElementById('chatBody').scrollHeight;
}

/* ═══ Swipe reply ═══ */
function attachSwipeReply(el, data){
    let sx = 0, sy = 0, sw = false;
    el.addEventListener('touchstart', e => {
        const t = e.touches[0]; sx = t.clientX; sy = t.clientY; sw = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
        if (!sw) return;
        const t = e.touches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dy) > 30){ sw = false; return; }
        if (dx > 20 && Math.abs(dx) > Math.abs(dy)){
            el.style.transform = 'translateX(' + Math.min(dx, 60) + 'px) scale(.98)';
        }
    }, { passive: true });
    el.addEventListener('touchend', e => {
        if (!sw){ el.style.transform = ''; return; }
        const t = e.changedTouches[0];
        if (t.clientX - sx > 55){ setReply(data); if (navigator.vibrate) navigator.vibrate(20); }
        el.style.transform = '';
        sw = false;
    });
}

/* ═══ Reply সেট/বাতিল ═══ */
function setReply(data){
    let preview = '';
    if (data.type === 'text') preview = data.content || '';
    else if (data.type === 'image') preview = '📷 ছবি';
    else if (data.type === 'video') preview = '🎬 ভিডিও';
    else if (data.type === 'audio') preview = '🎤 ভয়েস';
    else if (data.type === 'gift') preview = data.content || '🎁';
    else if (data.type === 'emoji') preview = data.emoji || '😊';

    replyTarget = {
        key: data.id,
        senderName: data.senderUid === window.me.uid ? 'আপনি' : (data.senderName || ''),
        preview
    };
    document.getElementById('replyName').textContent = '↩ ' + replyTarget.senderName;
    document.getElementById('replyText').textContent = preview;
    document.getElementById('replyBar').classList.add('show');
    document.getElementById('messageInput').focus();
}

window.cancelReply = () => {
    replyTarget = null;
    document.getElementById('replyBar').classList.remove('show');
};

/* ═══ ভয়েস প্লেয়ার ═══ */
function setupVoicePlayer(wrap){
    const btn = wrap.querySelector('.vp-play');
    const audio = wrap.querySelector('audio');
    const bar = wrap.querySelector('.vp-bar');
    const barI = wrap.querySelector('.vp-bar-inner');
    const time = wrap.querySelector('.vp-time');
    const icon = btn.querySelector('i');
    if (!audio) return;
    audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) time.textContent = fmtTime(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0){
            barI.style.width = (audio.currentTime / audio.duration * 100) + '%';
            time.textContent = fmtTime(audio.currentTime);
        }
    });
    audio.addEventListener('ended', () => {
        icon.className = 'fa-solid fa-play';
        barI.style.width = '0%';
        if (audio.duration && isFinite(audio.duration)) time.textContent = fmtTime(audio.duration);
    });
    btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.voice-player audio').forEach(a => {
            if (a !== audio && !a.paused){
                a.pause(); a.currentTime = 0;
                const p = a.closest('.voice-player');
                if (p){
                    p.querySelector('.vp-play i').className = 'fa-solid fa-play';
                    p.querySelector('.vp-bar-inner').style.width = '0%';
                }
            }
        });
        if (audio.paused){
            audio.play().then(() => { icon.className = 'fa-solid fa-pause'; }).catch(() => toast('ভয়েস চালানো যায়নি'));
        } else {
            audio.pause();
            icon.className = 'fa-solid fa-play';
        }
    });
    bar.addEventListener('click', e => {
        e.stopPropagation();
        if (!audio.duration || !isFinite(audio.duration)) return;
        const r = bar.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
    });
}

/* ═══ Message Action Sheet ═══ */
let sheetTargetId = null, sheetTargetData = null;

function openMsgActionSheet(id, data, isMe){
    sheetTargetId = id; sheetTargetData = data;
    const body = document.getElementById('msgSheetBody');
    let html = `<button class="sheet-btn" onclick="doReply()"><i class="fa-solid fa-reply"></i> রিপ্লাই</button>`;
    html += `<button class="sheet-btn" onclick="doCopyMsg()"><i class="fa-solid fa-copy"></i> কপি</button>`;
    html += `<button class="sheet-btn danger" onclick="doDeleteForMe()"><i class="fa-solid fa-trash-can"></i> শুধু আমার জন্য ডিলিট</button>`;
    if (isMe){
        html += `<button class="sheet-btn danger" onclick="doDeleteForAll()"><i class="fa-solid fa-trash-can"></i> সবার জন্য ডিলিট</button>`;
    }
    body.innerHTML = html;
    document.getElementById('msgSheet').classList.add('show');
    if (navigator.vibrate) navigator.vibrate(40);
}

window.closeMsgSheet = () => {
    document.getElementById('msgSheet').classList.remove('show');
    sheetTargetId = null; sheetTargetData = null;
};

window.doReply = () => {
    if (sheetTargetData) setReply(sheetTargetData);
    closeMsgSheet();
};

window.doCopyMsg = () => {
    if (sheetTargetData && sheetTargetData.type === 'text'){
        navigator.clipboard.writeText(sheetTargetData.content || '');
        toast('✅ কপি হয়েছে');
    } else {
        toast('শুধু text কপি হয়');
    }
    closeMsgSheet();
};

window.doDeleteForMe = () => {
    if (!sheetTargetId) { closeMsgSheet(); return; }
    try {
        const k = 'moi_chat_hidden_' + window.me.uid;
        const h = JSON.parse(localStorage.getItem(k) || '{}'); h[sheetTargetId] = 1;
        localStorage.setItem(k, JSON.stringify(h));
    } catch(e){}
    renderAllMessages();
    toast('✅ ডিলিট হয়েছে (শুধু আপনার জন্য)');
    closeMsgSheet();
};

window.doDeleteForAll = () => {
    if (!sheetTargetId) { closeMsgSheet(); return; }
    const m = loadMessages().find(x => x.id === sheetTargetId);
    if (!m || m.senderUid !== window.me.uid){ toast('শুধু নিজের মেসেজ সবার জন্য ডিলিট করা যায়'); closeMsgSheet(); return; }
    MOISync.deleteMessage('chat', roomId(window.me.uid, window.currentChatUid), sheetTargetId);
    saveMessages(loadMessages().filter(x => x.id !== sheetTargetId));
    renderAllMessages();
    toast('🌐 সবার জন্য ডিলিট');
    closeMsgSheet();
};

/* ═══ মেসেজ পাঠানো ═══ */
async function pushMsg(payload){
    if (!window.currentChatUid) return;
    if (payload.content && String(payload.content).indexOf('data:') === 0 && payload.type !== 'text'){
        toast('⏳ আপলোড হচ্ছে...');
        payload.content = await MOIStorage.chatMedia(roomId(window.me.uid, window.currentChatUid), payload.content);
    }
    payload.id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    payload.senderUid = window.me.uid;
    payload.senderName = window.me.name;
    payload.time = nowTime();
    payload.ts = Date.now();
    payload.delivered = true;
    if (replyTarget) payload.replyTo = replyTarget;

    let list = loadMessages();
    list.push(payload);
    saveMessages(list);

    /* চ্যাট মেটা আপডেট */
    let lastMessage = '';
    if (payload.type === 'text') lastMessage = payload.content;
    else if (payload.type === 'image') lastMessage = '📷 ছবি';
    else if (payload.type === 'video') lastMessage = '🎬 ভিডিও';
    else if (payload.type === 'audio') lastMessage = '🎤 ভয়েস';
    else if (payload.type === 'emoji') lastMessage = '😊 ইমোজি';

    const time = Date.now();
    if (typeof chatMetas !== 'undefined'){
        chatMetas[window.currentChatUid] = {
            lastMessage, lastTime: time,
            lastSender: window.me.uid, lastType: payload.type,
            unread: chatMetas[window.currentChatUid]?.unread || 0
        };
        if (typeof saveFriendsData === 'function') saveFriendsData();
    }
    /* প্রাপকের মেটা: unread বাড়ে (সার্ভার-সাইড রুলে শুধু আমার নামের ডক লেখা যায়) */
    try { MOISync.setPartnerMeta(window.currentChatUid, { lastMessage, lastTime: time, lastSender: window.me.uid, lastType: payload.type, unreadInc: true }); } catch(e){}

    appendMessage(payload);
    cancelReply();
}

window.sendText = () => {
    const inp = document.getElementById('messageInput');
    const t = inp.value.trim();
    if (!t) return;
    pushMsg({ type: 'text', content: t });
    inp.value = '';
    inp.focus();
};

window.sendFile = (e, type) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024){ alert('ফাইল বড়! ১৫ MB এর কম দিন।'); e.target.value=''; return; }
    const r = new FileReader();
    r.onload = ev => pushMsg({ type, content: ev.target.result });
    r.readAsDataURL(f);
    e.target.value = '';
};

/* ═══ Recording ═══ */
let mediaRecorder = null, audioChunks = [], isRec = false, recTimer = null, recStart = 0, recTimeout = null;

window.toggleRecording = async () => {
    if (isRec) stopRecording();
    else await startRecording();
};

async function startRecording(){
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        let mime = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';

        mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunks, { type: mime || 'audio/webm' });
            const dur = Math.round((Date.now() - recStart) / 1000);
            if (blob.size < 800 || dur < 1){ resetRec(); return; }
            const rd = new FileReader();
            rd.onload = () => {
                pushMsg({ type:'audio', content: rd.result, duration: dur, mime });
                toast('🎤 ভয়েস পাঠানো (' + dur + 's)');
            };
            rd.readAsDataURL(blob);
            resetRec();
        };
        mediaRecorder.start();
        isRec = true;
        recStart = Date.now();
        document.getElementById('micBtn').classList.add('recording');
        document.getElementById('recBar').classList.add('show');
        document.getElementById('recTime').textContent = '00:00';
        recTimer = setInterval(() => {
            document.getElementById('recTime').textContent = fmtTime(Math.floor((Date.now() - recStart) / 1000));
        }, 250);
        recTimeout = setTimeout(() => { if (isRec) stopRecording(); }, 60000);
        if (navigator.vibrate) navigator.vibrate(40);
    } catch(e){
        alert('মাইক অ্যাক্সেস নেই: ' + e.message);
        resetRec();
    }
}

window.stopRecording = () => {
    if (mediaRecorder && isRec){
        try { mediaRecorder.stop(); } catch(e){}
        isRec = false;
    }
};

window.cancelRecording = () => {
    if (mediaRecorder && isRec){
        mediaRecorder.onstop = null;
        try { mediaRecorder.stop(); } catch(e){}
        isRec = false;
    }
    resetRec();
};

function resetRec(){
    isRec = false;
    if (recTimer){ clearInterval(recTimer); recTimer = null; }
    if (recTimeout){ clearTimeout(recTimeout); recTimeout = null; }
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('recBar').classList.remove('show');
    document.getElementById('recTime').textContent = '00:00';
    mediaRecorder = null;
    audioChunks = [];
}

window.loadMessages = loadMessages;
window.saveMessages = saveMessages;
window.renderAllMessages = renderAllMessages;
window.appendMessage = appendMessage;
window.pushMsg = pushMsg;