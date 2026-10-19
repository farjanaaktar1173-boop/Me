/* me/svip.js — SVIP লেভেল মডাল */

console.log('[MOI] svip.js loaded');

/* ═══ মডাল খোলা/বন্ধ ═══ */
window.openSvipModal = () => {
    document.getElementById('svipModal').classList.add('show');
};

window.closeSvipModal = () => {
    document.getElementById('svipModal').classList.remove('show');
};

/* ═══ লেভেল পরিবর্তন ═══ */
window.switchSvipLevel = (level, total, current, needed, progress) => {
    document.getElementById('svipHeroTitle').innerHTML = `<i class="fa-solid fa-crown"></i> SVIP ${level}`;
    document.getElementById('svipBannerTitle').textContent = 'SVIP ' + level;
    document.getElementById('rechargeAmount').textContent = current.toLocaleString();
    document.getElementById('currentLevelText').textContent = 'SVIP ' + level;
    document.getElementById('nextLevelText').textContent = `→ SVIP ${level + 1} (${needed.toLocaleString()} more)`;
    document.getElementById('progressBar').style.width = progress + '%';

    document.querySelectorAll('.level-chip').forEach((c, i) => {
        c.classList.toggle('active', i + 1 === level);
    });
};

/* ═══ Settings Modal ═══ */
window.openSettingsModal = () => {
    document.getElementById('settingsModal').classList.add('show');
};

window.closeSettingsModal = () => {
    document.getElementById('settingsModal').classList.remove('show');
};

/* Menu actions (Wallet, Bag, Help ...) → panels.js */
