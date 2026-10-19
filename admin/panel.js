/* admin/panel.js — তিনটি প্যানেলের সব কাজ (রোল অনুযায়ী ট্যাব)। সব কাজ সার্ভার ফাংশনে হয়; এখানে শুধু ফর্ম। */
(function(){
'use strict';
const ROLE = window.PANEL_ROLE;                      /* developer | superadmin | distributor */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FB = () => window.MOIFB;
let me = null, found = null, tab = null;

const BADGES = ['official_host','top_gifter','verified','early_bird','moderator'];
const CROWNS = ['bronze','silver','gold','diamond','royal'];
const TABS = {
    developer:   [['users','ইউজার'],['money','ডায়মন্ড'],['reports','রিপোর্ট'],['tx','লেনদেন']],
    superadmin:  [['users','ইউজার'],['reports','রিপোর্ট']],
    distributor: [['sell','বিক্রি'],['tx','আমার লেনদেন']]
};
let tt; function toast(m, bad){ const t = $('toast'); t.textContent = m; t.className = 'toast show'; clearTimeout(tt); tt = setTimeout(() => t.className = 'toast', 2600); }
async function call(name, data){
    try { const r = await MOIEco.call(name, data); return r; }
    catch(e){ toast('❌ ' + (e.userMsg || e.message || 'ব্যর্থ')); return null; }
}

function userCard(u){
    return `<div class="user"><img src="${esc(u.photo || '')}" onerror="this.style.visibility='hidden'" alt="">
        <div><b>${esc(u.name || 'User')}</b><span>ID ${esc(u.moiId || '')} • ${esc(u.country || '')}</span><br>
        <span class="chip">${esc(u.role)}</span><span class="chip">Lv ${u.level || 1}</span><span class="chip">💎 ${Number(u.diamonds || 0).toLocaleString()}</span>${u.isBanned ? '<span class="chip" style="background:#ef4444">BANNED</span>' : ''}</div></div>`;
}

/* ───── ট্যাব: ইউজার ───── */
function viewUsers(){
    const roles = ROLE === 'developer' ? ['user','vip','admin','superadmin','distributor'] : ['user','vip','admin'];
    $('view').innerHTML = `<div class="card"><label>ইউজার খুঁজুন (6 ডিজিট MOI ID বা UID)</label>
        <div class="row"><input id="q" placeholder="যেমন 123456"><button class="btn" id="qgo" style="flex:0 0 90px">খুঁজুন</button></div></div>
        <div id="ures"></div>`;
    $('qgo').onclick = async () => {
        const r = await call('lookupUser', { target: $('q').value.trim() }); if (!r) return;
        found = r; const dev = ROLE === 'developer';
        $('ures').innerHTML = `<div class="card">${userCard(r)}
            <label>রোল পরিবর্তন</label><div class="row"><select id="rsel">${roles.map(x => `<option ${x === r.role ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn" id="rset" style="flex:0 0 90px">সেট</button></div>
            <label>ব্যান (ঘণ্টা; ০ = স্থায়ী)</label><div class="row"><input id="bh" type="number" value="24" min="0"><input id="br" placeholder="কারণ"></div>
            <div class="actions"><button class="btn bad" id="ban">ব্যান</button><button class="btn ok" id="unban">আনব্যান</button></div>
            ${dev ? `<label>ব্যাজ</label><div class="row"><select id="bsel">${BADGES.map(b => `<option>${b}</option>`).join('')}</select><button class="btn ghost" id="bon" style="flex:0 0 70px">দিন</button><button class="btn ghost" id="boff" style="flex:0 0 70px">নিন</button></div>
            <label>মুকুট</label><div class="row"><select id="csel">${CROWNS.map(b => `<option>${b}</option>`).join('')}</select><button class="btn ghost" id="con" style="flex:0 0 70px">দিন</button><button class="btn ghost" id="coff" style="flex:0 0 70px">নিন</button></div>` : ''}
            <p class="mut">ব্যাজ: ${esc((r.badges || []).join(', ') || '—')} • মুকুট: ${esc((r.ownedCrowns || []).join(', ') || '—')}</p></div>`;
        const t = found.uid;
        $('rset').onclick = async () => { if (await call('setRole', { target: t, role: $('rsel').value })) { toast('✅ রোল বদলেছে'); $('qgo').click(); } };
        $('ban').onclick = async () => { if (confirm('ব্যান করবেন?') && await call('banUser', { target: t, hours: +$('bh').value || 0, reason: $('br').value })) { toast('✅ ব্যান হয়েছে'); $('qgo').click(); } };
        $('unban').onclick = async () => { if (await call('unbanUser', { target: t })) { toast('✅ আনব্যান'); $('qgo').click(); } };
        if (dev){
            $('bon').onclick = async () => { if (await call('grantBadge', { target: t, badge: $('bsel').value, on: true })) { toast('✅ ব্যাজ দেওয়া হয়েছে'); $('qgo').click(); } };
            $('boff').onclick = async () => { if (await call('grantBadge', { target: t, badge: $('bsel').value, on: false })) { toast('✅ ব্যাজ সরানো হয়েছে'); $('qgo').click(); } };
            $('con').onclick = async () => { if (await call('grantCrown', { target: t, id: $('csel').value, on: true })) { toast('✅ মুকুট দেওয়া হয়েছে'); $('qgo').click(); } };
            $('coff').onclick = async () => { if (await call('grantCrown', { target: t, id: $('csel').value, on: false })) { toast('✅ মুকুট সরানো হয়েছে'); $('qgo').click(); } };
        }
    };
}

/* ───── ট্যাব: ডায়মন্ড (developer) ───── */
function viewMoney(){
    $('view').innerHTML = `<div class="card"><label>ইউজার ID</label><input id="mt" placeholder="MOI ID / UID">
        <label>পরিমাণ (ঋণাত্মক হলে কাটা হবে)</label><input id="ma" type="number" placeholder="1000">
        <label>নোট</label><input id="mn" placeholder="যেমন: Distributor stock">
        <button class="btn" id="mgo" style="width:100%;margin-top:12px">💎 যোগ/কাটুন</button>
        <p class="mut">এটাই একমাত্র জায়গা যেখান থেকে নতুন ডায়মন্ড তৈরি হয় (শুধু Developer)। সব লেনদেন লগ হয়।</p></div>`;
    $('mgo').onclick = async () => {
        const amount = parseInt($('ma').value, 10); if (!amount) return toast('পরিমাণ দিন');
        if (!confirm(amount + ' 💎 — নিশ্চিত?')) return;
        const r = await call('adminAddDiamonds', { target: $('mt').value.trim(), amount, note: $('mn').value }); if (r) toast('✅ নতুন ব্যালেন্স: ' + r.balance);
    };
}

/* ───── ট্যাব: বিক্রি (distributor) ───── */
function viewSell(){
    $('view').innerHTML = `<div class="card"><div class="mut">আপনার ডায়মন্ড স্টক</div><h1 id="stock">💎 ${Number(me.diamonds || 0).toLocaleString()}</h1></div>
      <div class="card"><label>ক্রেতার MOI ID</label><input id="st" placeholder="123456">
        <div class="row"><div><label>ডায়মন্ড</label><input id="sa" type="number"></div><div><label>দাম (৳)</label><input id="sp" type="number"></div></div>
        <div class="row"><div><label>পেমেন্ট মাধ্যম</label><select id="sm"><option>bkash</option><option>nagad</option><option>rocket</option><option>cash</option></select></div><div><label>ট্রানজেকশন রেফ</label><input id="sr"></div></div>
        <button class="btn ok" id="sgo" style="width:100%;margin-top:12px">ডায়মন্ড পাঠান</button>
        <p class="mut">আপনার স্টক থেকে কাটা হবে। স্টক কম হলে Developer-এর কাছ থেকে নিন।</p></div>`;
    $('sgo').onclick = async () => {
        const amount = parseInt($('sa').value, 10); if (!(amount > 0)) return toast('ডায়মন্ড লিখুন');
        if (!confirm(amount + ' 💎 পাঠাবেন?')) return;
        const r = await call('distributorTransfer', { target: $('st').value.trim(), amount, priceBDT: +$('sp').value || 0, method: $('sm').value, ref: $('sr').value });
        if (r){ toast('✅ ' + (r.toName || '') + ' কে পাঠানো হয়েছে'); }
    };
}
window.addEventListener('moi:diamonds', () => { const s = $('stock'); const u = MOIAuth.profile; if (s && u) s.textContent = '💎 ' + Number(u.diamonds || 0).toLocaleString(); });

/* ───── ট্যাব: রিপোর্ট ───── */
async function viewReports(){
    $('view').innerHTML = '<div class="card list" id="rl">লোড হচ্ছে…</div>';
    try {
        const snap = await FB().db.collection('reports').orderBy('createdAt', 'desc').limit(50).get();
        const rows = []; snap.forEach(d => { const r = d.data(); rows.push(`<div><span>${esc(r.reason || '')}<br><span class="mut">রিপোর্টার ${esc(r.reporterUid || '')} → ${esc(r.targetUid || r.roomId || '')}</span></span><span class="mut">${r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : ''}</span></div>`); });
        $('rl').innerHTML = rows.join('') || '<span class="mut">কোনো রিপোর্ট নেই</span>';
    } catch(e){ $('rl').innerHTML = '<span class="err">পড়া যায়নি: ' + esc(e.message) + '</span>'; }
}

/* ───── ট্যাব: লেনদেন ───── */
async function viewTx(){
    $('view').innerHTML = '<div class="card list" id="tl">লোড হচ্ছে…</div>';
    try {
        const q = ROLE === 'developer' ? FB().db.collection('transactions').orderBy('createdAt', 'desc').limit(60)
                                       : FB().db.collection('transactions').where('participants', 'array-contains', me.uid).limit(60);
        const snap = await q.get(); const rows = [];
        snap.forEach(d => { const t = d.data(); rows.push(`<div><span>${esc(t.title || t.type)}<br><span class="mut">${esc(t.type)} • ${esc(t.fromUid || '')} → ${esc(t.toUid || '')}${t.priceBDT ? ' • ৳' + t.priceBDT : ''}</span></span><b>${Number(t.amount || 0).toLocaleString()} 💎</b></div>`); });
        $('tl').innerHTML = rows.join('') || '<span class="mut">কোনো লেনদেন নেই</span>';
    } catch(e){ $('tl').innerHTML = '<span class="err">পড়া যায়নি (ইনডেক্স লাগতে পারে): ' + esc(e.message) + '</span>'; }
}

const VIEWS = { users: viewUsers, money: viewMoney, sell: viewSell, reports: viewReports, tx: viewTx };
function show(t){
    tab = t;
    $('tabs').innerHTML = TABS[ROLE].map(([k, l]) => `<button class="btn ghost ${k === t ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
    $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.k));
    VIEWS[t]();
}

(window.MOIReady || Promise.resolve()).then(() => {
    me = window.MOIAuth && MOIAuth.profile;
    if (!me && window.MOIAuth){ MOIAuth.require(); return; }
    const ok = me && (me.role === ROLE || (ROLE !== 'developer' && me.role === 'developer'));
    if (!ok){ document.body.innerHTML = '<div class="card" style="margin-top:60px;text-align:center"><h1>⛔ প্রবেশাধিকার নেই</h1><p class="mut">এই প্যানেল শুধু ' + esc(ROLE) + ' এর জন্য।</p><a class="btn" href="../../home/index.html" style="text-decoration:none;display:inline-block">হোমে ফিরুন</a></div>'; return; }
    $('who').textContent = (me.name || '') + ' • ' + me.role;
    show(TABS[ROLE][0][0]);
});
})();
