/* shared/core/db-storage.js — ছবি/ফাইল Firebase Storage-এ (ডেটাবেসে শুধু লিংক) */
console.log('[MOI] db-storage.js loaded');

(function(){
    'use strict';
    const FB = window.MOIFB;
    const MOIStorage = {
        /* dataURL (base64) → Storage-এ আপলোড → ডাউনলোড লিংক। ব্যর্থ হলে আসল dataURL ফেরত (ছোট ছবির জন্য চলে)। */
        async uploadDataUrl(path, dataUrl){
            if (!dataUrl || String(dataUrl).indexOf('data:') !== 0) return dataUrl;
            if (!FB || !FB.storage) return dataUrl;
            try {
                const ref = FB.storage.ref(path);
                const snap = await ref.putString(dataUrl, 'data_url');
                return await snap.ref.getDownloadURL();
            } catch(e){ console.warn('[storage] upload failed', e); return dataUrl; }
        },
        profile: (uid, dataUrl) => MOIStorage.uploadDataUrl('users/' + uid + '/profile_' + Date.now() + '.jpg', dataUrl),
        roomLogo: (id, dataUrl) => MOIStorage.uploadDataUrl('rooms/' + id + '/logo_' + Date.now() + '.jpg', dataUrl),
        chatMedia: (chatId, dataUrl) => MOIStorage.uploadDataUrl('chat/' + chatId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), dataUrl),
        roomWallpaper: (id, dataUrl) => MOIStorage.uploadDataUrl('rooms/' + id + '/wallpaper_' + Date.now() + '.jpg', dataUrl)
    };
    window.MOIStorage = MOIStorage;
})();
