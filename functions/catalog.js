/* functions/catalog.js — দাম, রিওয়ার্ড, রোল ক্রম (সার্ভারই সত্য; ক্লায়েন্টের সংখ্যা বিশ্বাস করা হয় না) */
'use strict';

/* রুমে পাঠানো গিফট (id → দাম 💎) — room/gifts.js এর GIFT_CATALOG এর সাথে মিলিয়ে রাখুন */
exports.GIFTS = { diamond: 5, diamond_v2: 1, diamond_v3: 10, cake: 10, rose: 1, kiss: 1, present: 5, treasure: 15, poop: 2 };

/* চ্যাটে বন্ধুকে ছোট উপহার */
exports.CHAT_GIFTS = { 10: 10, 50: 50, 100: 100, 500: 500, 1000: 1000 };

/* প্রোফাইল ফ্রেম */
exports.FRAMES = { basic: 0, aurora: 500, flame: 1200, ocean: 2000, royal: 3500, galaxy: 6000 };

/* মুকুট — Lottie অ্যানিমেশন (ফাইল: moi/crowns/<file>)
   price = 💎 দাম (সার্ভারই সত্য; ক্লায়েন্টের shared/features.js এর CROWN_LIST এ একই দাম রাখুন)
   official = শুধু Developer রোল পায় (কেনা যায় না, দেওয়া যায় না) */
exports.CROWNS = {
    crown_gold:     { name: 'Gold Crown',     price: 500,  rarity: 'common',    purchasable: true,  giftable: true,  adminOnly: false, file: 'crown_gold.json' },
    royal_red:      { name: 'Royal Red',      price: 600,  rarity: 'common',    purchasable: true,  giftable: true,  adminOnly: false, file: 'royal_red.json' },
    royal_green:    { name: 'Royal Green',    price: 700,  rarity: 'common',    purchasable: true,  giftable: true,  adminOnly: false, file: 'royal_green.json' },
    royal_purple:   { name: 'Royal Purple',   price: 800,  rarity: 'rare',      purchasable: true,  giftable: true,  adminOnly: false, file: 'royal_purple.json' },
    lion_vip:       { name: 'Lion VIP',       price: 900,  rarity: 'rare',      purchasable: true,  giftable: true,  adminOnly: false, file: 'lion_vip.json' },
    dragon_vip:     { name: 'Dragon VIP',     price: 1000, rarity: 'rare',      purchasable: true,  giftable: true,  adminOnly: false, file: 'dragon_vip.json' },
    crystal_shield: { name: 'Crystal Shield', price: 1100, rarity: 'legendary', purchasable: true,  giftable: true,  adminOnly: false, file: 'crystal_shield.json' },
    ocean_pearl:    { name: 'Ocean Pearl',    price: 1200, rarity: 'legendary', purchasable: true,  giftable: true,  adminOnly: false, file: 'ocean_pearl.json' },
    official:       { name: 'Official Dragon', price: 0,   rarity: 'official',  purchasable: false, giftable: false, adminOnly: true, officialOnly: true, file: 'official.json' }
};

/* অফিসিয়াল ব্যাজ (Developer দেয়) */
exports.BADGES = ['official_host', 'top_gifter', 'verified', 'early_bird', 'moderator'];

exports.CHECKIN = [20, 30, 40, 60, 80, 100, 250];
exports.SPIN = { segs: [10, 50, 5, 100, 20, 500, 15, 25], weights: { 5: 30, 10: 24, 15: 15, 20: 12, 25: 9, 50: 6, 100: 3, 500: 1 }, cost: 30 };
exports.INVITE_BONUS = 200;
exports.BAG_DAILY = 25;
exports.LUCKY_TAX = 0.05;

/* মিশন — ধাপ পূরণ হয়েছে কিনা সার্ভার নিজে যাচাই করে (rewards.js) */
exports.MISSIONS = {
    login:   { dia: 20, xp: 10 },
    name:    { dia: 30, xp: 15 },
    details: { dia: 50, xp: 20 },
    friend:  { dia: 40, xp: 20 },
    follow:  { dia: 30, xp: 15 },
    rich:    { dia: 25, xp: 10 }
};

/* রোল ও ক্রম */
exports.RANK = { developer: 100, superadmin: 90, distributor: 60, admin: 50, vip: 40, user: 10, guest: 0 };
exports.ROLES = Object.keys(exports.RANK);

/* লেভেল ফর্মুলা (ক্লায়েন্ট features.js এর সাথে এক) */
exports.levelFromXp = xp => Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));

/* সময়ের অঞ্চল: Dhaka (UTC+6) — "আজ" এর হিসাব */
exports.TZ_OFFSET_MIN = 360;
exports.dayKey = (ms) => new Date((ms === undefined ? Date.now() : ms) + exports.TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);
