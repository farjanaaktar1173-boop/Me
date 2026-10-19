/* shared/core/economy.js — সংবেদনশীল কাজ (ডায়মন্ড, গিফট, রোল…) সব Cloud Function-এ।
   ক্লায়েন্ট কখনও নিজে ডায়মন্ড বাড়াতে/কমাতে পারে না — এখান থেকে শুধু সার্ভারকে অনুরোধ যায়। */
console.log('[MOI] economy.js loaded');

(function(){
    'use strict';
    const FB = window.MOIFB;
    const MSG = {
        INSUFFICIENT_DIAMONDS: 'পর্যাপ্ত ডায়মন্ড নেই',
        ALREADY_CLAIMED: 'আজ নেওয়া হয়ে গেছে',
        GUEST_NOT_ALLOWED: 'গেস্ট এই কাজ করতে পারে না — লগইন করুন',
        PERMISSION_DENIED: 'আপনার এই কাজের অনুমতি নেই',
        NOT_FOUND: 'খুঁজে পাওয়া যায়নি',
        BANNED: 'এই অ্যাকাউন্ট নিষিদ্ধ',
        INVALID: 'ভুল অনুরোধ',
        ALREADY_OWNED: 'এটি আগেই আপনার কাছে আছে',
        NOT_READY: 'এখনও শর্ত পূরণ হয়নি',
        SELF: 'নিজের সাথে এটা করা যাবে না',
        UNAUTHENTICATED: 'আগে লগইন করুন'
    };
    function friendly(e){
        const raw = (e && (e.message || e.code)) || 'ERROR';
        const key = Object.keys(MSG).find(k => String(raw).toUpperCase().indexOf(k) >= 0
            || String((e && e.code) || '').toUpperCase().replace(/[-/]/g, '_').indexOf(k) >= 0);
        const err = new Error(key ? MSG[key] : 'সার্ভার সমস্যা: ' + raw);
        err.code = key || 'ERROR'; err.userMsg = err.message; return err;
    }
    const MOIEco = {
        async call(name, data){
            if (!FB || !FB.fn) throw friendly({ message: 'Firebase চালু নেই' });
            try { const r = await FB.fn.httpsCallable(name)(data || {}); return r.data; }
            catch(e){ console.warn('[eco]', name, e); throw friendly(e); }
        },
        /* সফল/ব্যর্থ — দুই ক্ষেত্রেই টোস্ট ঠিক রেখে */
        async try(name, data, fail){
            try { return await this.call(name, data); }
            catch(e){ if (fail !== false){ (window.MOI && MOI.toast ? MOI.toast(e.userMsg, '⚠️') : (window.toastMsg && toastMsg(e.userMsg))); } return null; }
        }
    };
    window.MOIEco = MOIEco;
})();
