/* shared/theme.js — থিম সিস্টেম (সব পেজে সবার আগে লোড হয়) */
(function(){
    const THEMES = {
        golden: { name:'Golden Hour', desc:'কোরাল ও অ্যাপ্রিকট, প্লাম বেস',   sw:['#ff5f7e','#ffb25a','#170d2a'], meta:'#0f0818' },
        lagoon: { name:'Lagoon',      desc:'মিন্ট ও আকাশি, গভীর সবুজ',       sw:['#20e3b2','#00d9ff','#061c21'], meta:'#031215' },
        orchid: { name:'Orchid',      desc:'ভায়োলেট ও পিংক, নাইট ইঙ্ক',       sw:['#b45cff','#ff6bd6','#150a2a'], meta:'#0d0618' },
        royal:  { name:'Royal Gold',  desc:'গোল্ড ও অ্যাম্বার, ব্ল্যাক',        sw:['#f0b429','#ff8a3d','#14110c'], meta:'#0b0907' }
    };
    function current(){
        try { const t = localStorage.getItem('moi_theme'); if (t && THEMES[t]) return t; } catch(e){}
        return 'golden';
    }
    function apply(name){
        document.documentElement.setAttribute('data-theme', name);
        let m = document.querySelector('meta[name="theme-color"]');
        if (!m){ m = document.createElement('meta'); m.name = 'theme-color'; (document.head || document.documentElement).appendChild(m); }
        m.content = THEMES[name].meta;
    }
    function set(name){
        if (!THEMES[name]) return;
        try { localStorage.setItem('moi_theme', name); } catch(e){}
        apply(name);
        /* iframe (chat sheet ইত্যাদি) গুলোতেও জানানো */
        document.querySelectorAll('iframe').forEach(f => { try { f.contentWindow.postMessage({ moiTheme: name }, '*'); } catch(e){} });
    }
    apply(current());
    window.MOI_THEMES = THEMES;
    window.getTheme = current;
    window.setTheme = set;
    window.addEventListener('storage', e => { if (e.key === 'moi_theme') apply(current()); });
    window.addEventListener('message', e => { if (e.data && e.data.moiTheme && THEMES[e.data.moiTheme]) apply(e.data.moiTheme); });
})();
