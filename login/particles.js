/* login/particles.js — ব্যাকগ্রাউন্ড এফেক্ট */

console.log('[MOI] particles.js loaded');

/* ═══ ভেসে বেড়ানো তারা ═══ */
(function(){
    const cv = document.getElementById('fx');
    if (!cv) return;
    const ctx = cv.getContext('2d', { alpha:true });
    let W = 0, H = 0, DPR = 1;

    const mk = rgb => {
        const s = document.createElement('canvas');
        s.width = s.height = 64;
        const c = s.getContext('2d');
        const g = c.createRadialGradient(32,32,0,32,32,32);
        g.addColorStop(0, `rgba(${rgb},1)`);
        g.addColorStop(.22, `rgba(${rgb},.6)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = g;
        c.fillRect(0,0,64,64);
        return s;
    };

    const SP = [mk('0,242,254'), mk('255,42,133'), mk('167,139,250')];
    const P = [];

    const seed = () => {
        P.length = 0;
        const n = window.innerWidth < 640 ? 34 : 62;
        for (let i = 0; i < n; i++){
            P.push({
                x: Math.random() * W, y: Math.random() * H,
                r: Math.random() * 2.2 + .7,
                vx: (Math.random() - .5) * .16,
                vy: (Math.random() - .5) * .16 - .05,
                a: Math.random() * .5 + .18,
                t: (Math.random() * 3) | 0,
                ph: Math.random() * 6.28
            });
        }
    };

    const resize = () => {
        DPR = Math.min(devicePixelRatio || 1, 2);
        W = innerWidth; H = innerHeight;
        cv.width = W * DPR; cv.height = H * DPR;
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        ctx.setTransform(DPR,0,0,DPR,0,0);
        seed();
    };

    const frame = () => {
        ctx.clearRect(0,0,W,H);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of P){
            p.x += p.vx; p.y += p.vy; p.ph += .02;
            if (p.x < -40) p.x = W + 40;
            if (p.x > W + 40) p.x = -40;
            if (p.y < -40) p.y = H + 40;
            if (p.y > H + 40) p.y = -40;
            const tw = .65 + Math.sin(p.ph) * .35;
            const sz = p.r * 11;
            ctx.globalAlpha = p.a * tw;
            ctx.drawImage(SP[p.t], p.x - sz/2, p.y - sz/2, sz, sz);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        requestAnimationFrame(frame);
    };

    addEventListener('resize', resize, { passive:true });
    resize();
    requestAnimationFrame(frame);
})();

/* ═══ ফোন 3D কাত হওয়া (শুধু ডেস্কটপ) ═══ */
(function(){
    const phone = document.getElementById('phone');
    if (!phone) return;
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;

    const root = document.documentElement;
    let tX = 0, tY = 0, cX = 0, cY = 0, active = false;

    addEventListener('pointermove', e => {
        const nx = e.clientX / innerWidth - .5;
        const ny = e.clientY / innerHeight - .5;
        tY = nx * 15; tX = -ny * 11;
        root.style.setProperty('--px', nx.toFixed(4));
        root.style.setProperty('--py', ny.toFixed(4));
        active = true;
    }, { passive:true });

    addEventListener('pointerleave', () => {
        tX = 0; tY = 0;
        root.style.setProperty('--px', 0);
        root.style.setProperty('--py', 0);
    });

    (function loop(){
        cX += (tX - cX) * .075;
        cY += (tY - cY) * .075;
        if (active || Math.abs(cX) > .01 || Math.abs(cY) > .01){
            phone.style.transform = `rotateX(${cX.toFixed(3)}deg) rotateY(${cY.toFixed(3)}deg)`;
        }
        requestAnimationFrame(loop);
    })();
})();