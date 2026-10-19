/* ═══ ছবি লোড না হলে নিজে থেকেই সুন্দর fallback avatar ═══ */
(function(){
    const FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a8a"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="38" r="17" fill="rgba(255,255,255,.9)"/><path d="M16 92c4-22 19-32 34-32s30 10 34 32z" fill="rgba(255,255,255,.9)"/></svg>');
    window.FALLBACK_IMG = FALLBACK;
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.src !== FALLBACK && !t.dataset.fb){
            t.dataset.fb = '1';
            t.src = FALLBACK;
        }
    }, true);
})();

/* ═══ রুমের কভার আর্ট — নেটওয়ার্ক ছাড়াই, সবসময় ক্রিস্প (SVG) ═══ */
(function(){
    const PAL = [['#ff5f7e','#ffb25a'],['#8b5cf6','#ff6bd6'],['#20e3b2','#00b4ff'],['#f0b429','#ff6a3d'],['#5b8cff','#b45cff'],['#ff7ab6','#ffd166'],['#00c2a8','#7dffa1'],['#ff8a5c','#d946ef']];
    function hash(s){ let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    window.roomArt = function(id, title){
        const h = hash(id), p = PAL[h % PAL.length];
        const a = 20 + (h % 50), b = 55 + ((h >> 4) % 40), r1 = 90 + (h % 70), r2 = 60 + ((h >> 8) % 60);
        const ch = (String(title || id).trim().match(/[A-Za-zঀ-৿0-9]/) || ['♪'])[0].toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient>
<radialGradient id="v" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#12061f" stop-opacity=".55"/></radialGradient></defs>
<rect width="400" height="460" fill="url(#g)"/>
<circle cx="${a * 6}" cy="${b * 3}" r="${r1}" fill="#fff" opacity=".13"/><circle cx="${400 - a * 3}" cy="${460 - b}" r="${r2 + 40}" fill="#fff" opacity=".1"/>
<circle cx="${b * 4}" cy="${a * 7}" r="${r2}" fill="#12061f" opacity=".12"/>
<g fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"><circle cx="200" cy="190" r="86"/><circle cx="200" cy="190" r="122"/><circle cx="200" cy="190" r="160"/></g>
<text x="200" y="228" text-anchor="middle" font-family="Bricolage Grotesque,Figtree,Hind Siliguri,sans-serif" font-size="140" font-weight="800" fill="#fff" fill-opacity=".92">${ch}</text>
<rect width="400" height="460" fill="url(#v)"/></svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };
})();
