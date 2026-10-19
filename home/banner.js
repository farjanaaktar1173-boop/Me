/* home/banner.js — রুম ব্যানার (Create / Mine) */

console.log('[MOI] banner.js loaded');

/* ═══ খালি ব্যানার (কোনো রুম নেই) ═══ */
function renderBannerEmpty(){
    document.getElementById('bannerTitle').textContent = 'Create Your Room';
    document.getElementById('bannerCountry').innerHTML = '<i class="fa-solid fa-globe"></i> <span>Tap to setup</span>';
    document.getElementById('roomLevel').textContent = 'L.0';
    document.getElementById('bannerUid').innerHTML = '<i class="fa-solid fa-hashtag"></i> ---';
    document.getElementById('roomAvatar').src = window.user.photo || GUEST_AVATAR;
    document.getElementById('roomLiveBadge').style.display = 'none';
    document.getElementById('mineBtn').innerHTML = '<i class="fa-solid fa-plus"></i><span>CREATE</span>';
}

/* ═══ ভরা ব্যানার (রুম আছে) ═══ */
function renderBannerWithRoom(info){
    document.getElementById('bannerTitle').textContent = info.name || 'My Room';
    const flag = getFlag(info.country || '');
    const countryClean = cleanCountry(info.country) || 'Unknown';
    document.getElementById('bannerCountry').innerHTML = '<span style="font-size:14px">' + flag + '</span> <span>' + esc(countryClean) + '</span>';
    document.getElementById('roomLevel').textContent = 'L.' + (Number(info.level) || 0);
    document.getElementById('bannerUid').innerHTML = '<i class="fa-solid fa-hashtag"></i> ' + esc(info.id || '---');
    document.getElementById('roomAvatar').src = info.logo || window.user.photo || GUEST_AVATAR;
    document.getElementById('roomLiveBadge').style.display = 'flex';
    document.getElementById('mineBtn').innerHTML = '<i class="fa-solid fa-microphone"></i><span>MINE</span>';
}

/* ═══ রুম লোড করা ═══ */
function loadMyRoom(){
    if (!window.user.uid) return;
    const fresh = getUser(window.user.uid) || {};
    const myRoomUid = fresh.myRoomUid || '';
    if (!myRoomUid){
        window.user.myRoomUid = '';
        renderBannerEmpty();
        return;
    }
    window.user.myRoomUid = myRoomUid;
    const info = getRoom(myRoomUid);
    if (info) renderBannerWithRoom(info);
    else renderBannerEmpty();
}

window.renderBannerEmpty = renderBannerEmpty;
window.renderBannerWithRoom = renderBannerWithRoom;
window.loadMyRoom = loadMyRoom;