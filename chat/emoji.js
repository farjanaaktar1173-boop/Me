/* chat/emoji.js — Emoji picker */

console.log('[MOI] emoji.js loaded');

const EMOJI_CATS = [
    { name: '😀 স্মাইলি', list: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'] },
    { name: '❤️ ভালোবাসা', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','😻','🫶','🤝','👫','👬','👭','💐','🌹','🌷','🌺','🌸','🌼','🌻'] },
    { name: '👋 হাত', list: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','👀'] },
    { name: '🎉 সেলিব্রেশন', list: ['🎉','🎊','🎈','🎁','🎀','🎂','🍰','🧁','🥳','🎆','🎇','✨','⭐','🌟','💫','🔥','💥','⚡','🌈','☀️','🌙','💎','👑','🏆','🥇','🥈','🥉','🎯','🎮','🎲','🎭','🎨'] },
    { name: '🍕 খাবার', list: ['🍕','🍔','🍟','🌭','🍿','🥓','🥚','🍳','🧇','🥞','🍞','🥐','🥨','🥯','🍩','🍪','🍰','🍫','🍬','🍭','🍮','🍯','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🥭','🍍','🥥','🥝','🍅','🥑'] },
    { name: '🐶 প্রাণী', list: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🐢','🐍','🦎','🐙'] }
];

/* ═══ Emoji Picker রেন্ডার ═══ */
function renderEmojiPicker(){
    const p = document.getElementById('emojiPicker');
    let html = '';
    EMOJI_CATS.forEach(cat => {
        html += `<div class="ep-cat">${cat.name}</div>`;
        cat.list.forEach(e => { html += `<div class="ei" onclick="pickEmoji('${e}')">${e}</div>`; });
    });
    p.innerHTML = html;
}

/* ═══ Picker দেখানো / লুকানো ═══ */
window.toggleEmojiPicker = (e) => {
    if (e) e.stopPropagation();
    document.getElementById('emojiPicker').classList.toggle('show');
};

/* ═══ Emoji পাঠানো ═══ */
window.pickEmoji = (emoji) => {
    const input = document.getElementById('messageInput');
    const cur = input.value.trim();

    /* ইনপুট খালি এবং emoji একা — সরাসরি emoji message */
    if (!cur && emoji && !emoji.match(/[\w\u0980-\u09FF]/)){
        if (typeof pushMsg === 'function'){
            pushMsg({ type: 'emoji', emoji });
        }
        document.getElementById('emojiPicker').classList.remove('show');
        return;
    }

    /* নাহলে ইনপুটে যোগ */
    input.value = cur + emoji;
    input.focus();
};

/* ═══ বাইরে চাপলে picker বন্ধ ═══ */
document.addEventListener('click', e => {
    const p = document.getElementById('emojiPicker');
    if (p.classList.contains('show') && !p.contains(e.target) && !e.target.closest('.emoji-trigger')){
        p.classList.remove('show');
    }
});

window.renderEmojiPicker = renderEmojiPicker;