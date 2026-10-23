/* home/icons.js — হোমের নিজস্ব আইকন সেট (window.HIC) */
(function(){
const S=(p,w=1.9)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const F=p=>`<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const HIC_={
  star:S('<path d="M12 3.500l2.600 5.300 5.800.8-4.200 4.100 1 5.800-5.200-2.700-5.200 2.700 1-5.800L3.600 9.600l5.800-.8z"/>',1.8),
  logo:F('<path d="M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.5 6.5 20 8 13.3 3 9l6.4-.6z"/>'),
  search:S('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  bell:S('<path d="M6.5 10a5.5 5.5 0 0111 0c0 5 2 6 2 6h-15s2-1 2-6z"/><path d="M10 19.5a2 2 0 004 0"/>'),
  user:S('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.7-4 3.8-5.8 7.5-5.8s6.8 1.8 7.5 5.8"/>'),
  userSm:F('<circle cx="12" cy="8" r="4.2"/><path d="M3.8 21c.5-4.3 3.8-6.3 8.2-6.3s7.7 2 8.2 6.3z"/>'),
  crown:F('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'),
  check:S('<path d="M5 12.5l4.5 4.5L19 7.5"/>',3),
  heart:F('<path d="M12 20.5s-8-4.8-8-10.5A4.5 4.5 0 0112 7.5 4.5 4.5 0 0120 10c0 5.7-8 10.5-8 10.5z"/>'),
  plus:S('<path d="M12 5v14M5 12h14"/>',2.2),
  close:S('<path d="M7 7l10 10M17 7L7 17"/>',2.6),
  shuffle:S('<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.5 0 2.6-1.2 3.6-2.8M13 9c1-1.2 2-2 3.5-2H20"/><path d="M18 5l2 2-2 2M18 15l2 2-2 2"/>',1.8),
  live:S('<circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.5 4.5a10.5 10.5 0 000 15M19.5 4.5a10.5 10.5 0 010 15"/>',1.8),
  compass:S('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',1.8),
  room:S('<path d="M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>'),
  chat:S('<path d="M20.5 11.5a8 8 0 01-11.7 7.1L4 20l1.4-4.5A8 8 0 1120.5 11.5z"/>'),
  chev:S('<path d="M9 5l7 7-7 7"/>'),
  mic:S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'),
  gift:`<svg viewBox="0 0 28 28" class="ic"><defs><linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#e8a93c"/></linearGradient><linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="1" stop-color="#f0b84a"/></linearGradient></defs><rect x="4" y="13" width="20" height="12.500" rx="2.800" fill="url(#gA)"/><rect x="12.200" y="13" width="3.600" height="12.500" fill="#ff5d8f"/><g class="lid"><rect x="3" y="9" width="22" height="5.500" rx="2.200" fill="url(#gB)"/><rect x="12.200" y="9" width="3.600" height="5.500" fill="#ff5d8f"/><path d="M14 9C11 9.500 8 8 8.800 5.600S13 4.800 14 9zM14 9c3 .5 6-1 5.200-3.400S15 4.800 14 9z" fill="#ff5d8f"/></g><path d="M22.500 3l.7 1.700 1.700.7-1.700.7-.7 1.700-.7-1.700-1.700-.7 1.700-.7z" fill="#fff"/></svg>`,
  wheel:`<svg viewBox="0 0 28 28" class="ic"><g class="wh"><path d="M14 14L14 3A11 11 0 0 1 23.53 8.5z" fill="#ff5d8f"/><path d="M14 14L23.53 8.5A11 11 0 0 1 23.53 19.5z" fill="#ffc94a"/><path d="M14 14L23.53 19.5A11 11 0 0 1 14 25z" fill="#3fd6c1"/><path d="M14 14L14 25A11 11 0 0 1 4.47 19.5z" fill="#9b7bff"/><path d="M14 14L4.47 19.5A11 11 0 0 1 4.47 8.5z" fill="#ff8a5c"/><path d="M14 14L4.47 8.5A11 11 0 0 1 14 3z" fill="#4db8ff"/><circle cx="14" cy="14" r="11" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.600"/><circle cx="14" cy="14" r="3.200" fill="#fff"/><circle cx="14" cy="14" r="1.500" fill="#e8a93c"/></g><path d="M10.800 .8h6.400L14 6.200z" fill="#fff" stroke="#e8a93c" stroke-width=".8" stroke-linejoin="round"/></svg>`,
  store:`<svg viewBox="0 0 28 28" class="ic"><rect x="5" y="12" width="18" height="14" rx="2" fill="#7a5cff"/><rect x="11" y="17" width="6" height="9" rx="1.200" fill="#ffe08a"/><rect x="6.500" y="15" width="3" height="4.500" rx=".8" fill="#c9bcff"/><rect x="18.500" y="15" width="3" height="4.500" rx=".8" fill="#c9bcff"/><g class="awn"><path d="M5.5 6L9.75 6L8.5 11L3.0 11z" fill="#ffd36a"/><circle cx="5.75" cy="11" r="2.75" fill="#ffd36a"/><path d="M9.75 6L14.0 6L14.0 11L8.5 11z" fill="#fff3cf"/><circle cx="11.25" cy="11" r="2.75" fill="#fff3cf"/><path d="M14.0 6L18.25 6L19.5 11L14.0 11z" fill="#ffd36a"/><circle cx="16.75" cy="11" r="2.75" fill="#ffd36a"/><path d="M18.25 6L22.5 6L25.0 11L19.5 11z" fill="#fff3cf"/><circle cx="22.25" cy="11" r="2.75" fill="#fff3cf"/></g><g class="cr"><path d="M10 5.200l1.600 1.200L14 2.200l2.400 4.200L18 5.200l-.9 3.100h-6.200z" fill="#fff" stroke="#e8a93c" stroke-width=".9" stroke-linejoin="round"/></g></svg>`,
  medal:`<svg viewBox="0 0 28 28" class="ic"><defs><linearGradient id="gM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#ffc94a"/><stop offset="1" stop-color="#d4901a"/></linearGradient></defs><g class="md"><path d="M8.500 1.500h5l3.200 9-5.600 1.600z" fill="#ff5d8f"/><path d="M19.500 1.500h-5l-3.200 9 5.600 1.600z" fill="#4db8ff"/><circle cx="14" cy="18" r="8.500" fill="url(#gM)"/><circle cx="14" cy="18" r="6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/><path d="M14 13.600l1.300 2.700 3 .4-2.200 2.100.5 3-2.600-1.400-2.600 1.400.5-3-2.200-2.100 3-.4z" fill="#fff"/></g></svg>`,
  down:S('<path d="M6 9l6 6 6-6"/>',2.2),
  spark:F('<path d="M12 2l2.200 6.300L21 10l-6.800 1.700L12 18l-2.200-6.300L3 10l6.800-1.700z"/><path d="M19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z"/>'),
  pin:S('<path d="M12 21s7-5.500 7-11a7 7 0 10-14 0c0 5.500 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',2),
  pawn:F('<circle cx="12" cy="6.500" r="3.500"/><path d="M9 11h6l1.500 6h-9zM6 19h12v2.500H6z"/>'),
  bolt:F('<path d="M13 2L5 13.500h5.500L9.500 22 19 10h-6z"/>'),
  note:S('<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',2),
  gem:'<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor"/><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="rgba(60,36,0,.45)" stroke-width="1" stroke-linejoin="round"/></svg>',
};
window.HIC=HIC_;
})();
