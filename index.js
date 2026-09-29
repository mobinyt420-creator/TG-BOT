const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN || '8546118189:AAGVspPraQLvZiLvXnSRLE0u8fNcDJngGPo';
const bot = new Telegraf(BOT_TOKEN);

let botInfo = { username: 'Mr_PROXYFile_Bot', first_name: 'Mr. PROXY File Locker' };

// Sole Owner & Admin (শুধুমাত্র এবং শুধুমাত্র এই একটি আইডিই এডমিন দেখতে পারবে)
const SOLE_OWNER_ID = '7553569630'; // @mrmobin9

function isAdmin(userId) {
  const uid = (userId || '').toString().trim();
  return uid === SOLE_OWNER_ID;
}

// Helper to escape HTML safely
function escapeHtml(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper to format bytes to KB / MB
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global Error Handler to prevent process crashes
bot.catch((err, ctx) => {
  console.error(`Telegram Bot Error (${ctx ? ctx.updateType : 'unknown'}):`, err.message);
});

// Helper to check channel membership
async function isUserSubscribed(userId) {
  const settings = db.getSettings();
  if (!settings.forceSubEnabled || !settings.channelId) {
    return true; // No restriction if channel not set
  }

  try {
    const member = await bot.telegram.getChatMember(settings.channelId, userId);
    return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
  } catch (err) {
    console.error(`Membership check failed for user ${userId}:`, err.message);
    return false;
  }
}

// Register Bot Commands (Clean public menu without admin references)
bot.telegram.setMyCommands([
  { command: 'start', description: '🏠 প্রধান মেনু' },
  { command: 'files', description: '📁 ফাইলসমূহ' },
  { command: 'help', description: 'ℹ️ নিয়ম ও হেল্প' },
  { command: 'myid', description: '🆔 আপনার টেলিগ্রাম আইডি' }
]).catch(() => {});

// --- Helper: Persistent Bottom Menu Keyboard (ইমোজির পাশের বাটন) ---
function getBottomMenu(isAdminUser = false) {
  const keyboard = [
    ['📁 আজকের ফাইলসমূহ', '📢 অফিশিয়াল চ্যানেল'],
    ['🛍️ ওবিন শপ (টপ-আপ)', 'ℹ️ হেল্প ও নিয়ম']
  ];
  if (isAdminUser) {
    keyboard.push(['👑 এডমিন কন্ট্রোল']);
  }
  return Markup.keyboard(keyboard).resize();
}

// --- Helper: Render Admin Dashboard ---
async function renderAdminDashboard(ctx) {
  const user = ctx.from;
  const settings = db.getSettings();
  const totalUsers = db.getTotalUsersCount();
  const allFiles = db.getAllFiles();
  const totalDownloads = allFiles.reduce((sum, f) => sum + (f.downloads || 0), 0);

  const safeName = escapeHtml(user.first_name || 'এডমিন');

  const adminText = `👑 <b>স্বাগতম এডমিন (${safeName})!</b>
━━━━━━━━━━━━━━━━━━━━━━
🤖 <b>Mr. PROXY File Locker - কন্ট্রোল প্যানেল</b>

📊 <b>লাইভ পরিসংখ্যান:</b>
• 👥 মোট সক্রিয় ইউজার: <b>${totalUsers}</b> জন
• 📁 আপলোড করা ফাইল: <b>${allFiles.length}</b> টি
• 📥 মোট ডাউনলোড সম্পন্ন: <b>${totalDownloads}</b> বার
• 📢 সংযুক্ত চ্যানেল: <b>${escapeHtml(settings.channelTitle)}</b> ${settings.channelId ? '✅' : '⚠️'}
━━━━━━━━━━━━━━━━━━━━━━
💡 <b>নতুন ফাইল আপলোড করার নিয়ম:</b>
সরাসরি যেকোনো ফাইল (Zip, 7z, Apk, Txt) এই চ্যাটে পাঠিয়ে দিন। সাথে সাথে ডাউনলোড লিংক তৈরি হয়ে যাবে!`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 ইউজারদের গতিবিধি ও তালিকা', 'admin_analytics'),
      Markup.button.callback('📁 সকল ফাইল ও লিংক', 'admin_files_list')
    ],
    [
      Markup.button.callback('📢 ব্রডকাস্ট নোটিশ', 'admin_broadcast_help'),
      Markup.button.callback('⚙️ চ্যানেল ও সেটিংস', 'admin_settings')
    ],
    [
      Markup.button.callback('👁️ সাধারণ দর্শকের ভিউ দেখুন', 'view_as_user')
    ]
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(adminText, { parse_mode: 'HTML', ...keyboard });
  } else {
    await ctx.reply(adminText, {
      parse_mode: 'HTML',
      ...keyboard,
      ...getBottomMenu(true)
    });
  }
}

// --- Helper: Render User Home Screen (১০০% ক্লিন, সাধারণ ইউজারদের জন্য কোনো এডমিন অপশন ছাড়া) ---
async function renderUserHome(ctx) {
  const user = ctx.from;
  const settings = db.getSettings();
  const safeName = escapeHtml(user.first_name || 'বন্ধু');
  const safeBotName = escapeHtml(botInfo.first_name || 'Mr. PROXY File Locker');

  const welcomeText = `👋 আসসালামু আলাইকুম <b>${safeName}</b>!

🤖 <b>${safeBotName}</b> বটে আপনাকে স্বাগতম! ⚡

এখানে আপনি ইউটিউব ভিডিওর প্রয়োজনীয় সকল ফাইল, কনফিগ ও এপিকে কোনো বিরক্তিকর লিংক শর্টনার বা পপআপ ছাড়াই <b>১০০% ফ্রিতে ও সরাসরি ১ ক্লিকে</b> ডাউনলোড করতে পারবেন।

👇 নিচের মেনু থেকে আপনার পছন্দের অপশন বেছে নিন:`;

  const inlineButtons = [
    [
      Markup.button.callback('📁 আজকের ভিডিও ফাইলসমূহ', 'user_files_list'),
      Markup.button.url('📢 অফিশিয়াল চ্যানেল', settings.channelInviteLink)
    ],
    [
      Markup.button.url('🛍️ ওবিন শপ (ডায়মন্ড টপ-আপ)', settings.adButtonUrl),
      Markup.button.callback('ℹ️ কীভাবে ডাউনলোড করবেন?', 'how_to_download')
    ]
  ];

  // সাধারণ ইউজারদের জন্য কোনো এডমিন বাটন থাকবে না। শুধু ওনার টেস্ট করার সময় দেখতে পারবে
  if (isAdmin(user.id)) {
    inlineButtons.push([Markup.button.callback('👑 এডমিন প্যানেলে ফিরুন', 'back_to_admin')]);
  }

  const keyboard = Markup.inlineKeyboard(inlineButtons);
  const bottomMenu = getBottomMenu(isAdmin(user.id));

  if (ctx.callbackQuery) {
    await ctx.editMessageText(welcomeText, { parse_mode: 'HTML', ...keyboard });
  } else {
    await ctx.reply(welcomeText, {
      parse_mode: 'HTML',
      ...keyboard,
      ...bottomMenu
    });
  }
}

// --- /start Handler ---
bot.start(async (ctx) => {
  const user = ctx.from;
  db.logUser(user);

  const payload = ctx.startPayload ? ctx.startPayload.trim() : null;

  // ১. সরাসরি ফাইল লিংকে ক্লিক করলে (যেমন /start file_101)
  if (payload && payload.startsWith('file_')) {
    return handleFileDownloadRequest(ctx, payload);
  }

  // ২. ফাইল প্যাক লিংকে ক্লিক করলে (যেমন /start files)
  if (payload === 'files' || payload === 'pack') {
    return showUserFilesList(ctx);
  }

  // ৩. এডমিন হলে এডমিন প্যানেল, সাধারণ ইউজার হলে সাধারণ হোম পেজ
  if (isAdmin(user.id)) {
    return renderAdminDashboard(ctx);
  } else {
    return renderUserHome(ctx);
  }
});

// --- File Download Request Handler (Force-Sub Check & Direct Delivery) ---
async function handleFileDownloadRequest(ctx, fileKey) {
  const user = ctx.from;
  const file = db.getFile(fileKey);
  const settings = db.getSettings();

  if (!file) {
    return ctx.reply('⚠️ দুঃখিত! এই ফাইলটি খুঁজে পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে।');
  }

  // ফোর্স সাবস্ক্রিপশন চেক
  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    const safeFileName = escapeHtml(file.fileName);
    const lockedMsg = `🔒 <b>ফাইলটি লক করা রয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইলের নাম:</b> <code>${safeFileName}</code>
💾 <b>সাইজ:</b> <code>${file.fileSize}</code>
━━━━━━━━━━━━━━━━━━━━━━
⚠️ এই ফাইলটি ডাউনলোড করতে আপনাকে আমাদের অফিশিয়াল চ্যানেলে যুক্ত থাকতে হবে।

১. নিচে <b>"📢 চ্যানেলে জয়েন করুন"</b> বাটনে চাপ দিয়ে যুক্ত হোন।
২. এরপর <b>"🔄 জয়েন করেছি, ফাইল ডাউনলোড করুন"</b> বাটনে চাপ দিন।`;

    const lockKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 চ্যানেলে জয়েন করুন', settings.channelInviteLink)],
      [Markup.button.callback('🔄 জয়েন করেছি, ফাইল ডাউনলোড করুন', `verify_${file.key}`)]
    ]);

    return ctx.reply(lockedMsg, {
      parse_mode: 'HTML',
      ...lockKeyboard,
      ...getBottomMenu(isAdmin(user.id))
    });
  }

  // চ্যানেলে অলরেডি জয়েন থাকলে সরাসরি ফাইল পাঠিয়ে দেওয়া হবে (নো মিনি অ্যাপ, নো অ্যাড)
  await deliverFile(ctx, file);
}

// --- Direct 1-Click File Delivery (নো অ্যাড, নো মিনি অ্যাপ - সুপারফাস্ট সিডিএন ডাউনলোড) ---
async function deliverFile(ctx, file) {
  const settings = db.getSettings();
  db.incrementDownload(file.key, ctx.from.id);

  const safeFileName = escapeHtml(file.fileName);
  const caption = `✅ <b>ফাইল ডাউনলোড সম্পন্ন!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইলের নাম:</b> <code>${safeFileName}</code>
💾 <b>সাইজ:</b> <code>${file.fileSize}</code>
📥 <b>মোট ডাউনলোড:</b> ${file.downloads} বার
━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>১০০% ডিরেক্ট ফাইল • কোনো লিংক শর্টনার নেই!</b>
🤖 Powered by @${botInfo.username || 'Mr_PROXYFile_Bot'}`;

  const buttons = [];
  if (settings.adButtonUrl) {
    buttons.push([Markup.button.url('🛍️ ওবিন শপ (ডায়মন্ড টপ-আপ)', settings.adButtonUrl)]);
  }
  buttons.push([
    Markup.button.url('📢 অফিশিয়াল চ্যানেল', settings.channelInviteLink),
    Markup.button.callback('📁 অন্যান্য ফাইলসমূহ', 'user_files_list')
  ]);

  try {
    if (ctx.callbackQuery) {
      await ctx.replyWithDocument(file.telegramFileId, {
        caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    } else {
      await ctx.replyWithDocument(file.telegramFileId, {
        caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    }
  } catch (err) {
    console.error('Failed to deliver document:', err.message);
    await ctx.reply(`❌ ফাইল পাঠাতে সমস্যা হয়েছে: ${err.message}`);
  }
}

// --- Verify Button Callback ---
bot.action(/^verify_(file_\d+)$/, async (ctx) => {
  const fileKey = ctx.match[1];
  const user = ctx.from;
  const file = db.getFile(fileKey);

  if (!file) {
    return ctx.answerCbQuery('⚠️ ফাইলটি খুঁজে পাওয়া যায়নি।', { show_alert: true });
  }

  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    return ctx.answerCbQuery('❌ আপনি এখনও চ্যানেলে জয়েন করেননি! দয়া করে চ্যানেলে জয়েন করে আবার চাপ দিন।', { show_alert: true });
  }

  await ctx.answerCbQuery('✅ ভেরিফিকেশন সফল! ফাইলটি পাঠানো হচ্ছে...');
  try {
    await ctx.deleteMessage();
  } catch (e) {}

  await deliverFile(ctx, file);
});

// --- User Action: Show All Files in Multi-File Pack ---
bot.action('user_files_list', async (ctx) => {
  await ctx.answerCbQuery();
  showUserFilesList(ctx);
});

async function showUserFilesList(ctx) {
  const files = db.getAllFiles();
  const settings = db.getSettings();
  const user = ctx.from;

  if (files.length === 0) {
    const emptyText = `📁 <b>ফাইল কালেকশন</b>\n━━━━━━━━━━━━━━━━━━━━━━\nবর্তমানে কোনো ফাইল আপলোড করা নেই। শীঘ্রই নতুন ভিডিওর সাথে ফাইল যুক্ত করা হবে!`;
    const emptyKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 চ্যানেলে যুক্ত থাকুন', settings.channelInviteLink)]
    ]);
    if (ctx.callbackQuery) {
      return ctx.editMessageText(emptyText, { parse_mode: 'HTML', ...emptyKeyboard });
    } else {
      return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKeyboard, ...getBottomMenu(isAdmin(user.id)) });
    }
  }

  const buttons = files.slice(0, 10).map((f, index) => {
    return [Markup.button.callback(`📥 ${index + 1}. ${f.fileName} (${f.fileSize})`, `pick_${f.key}`)];
  });

  buttons.push([Markup.button.callback('🏠 হোম পেজে ফিরুন', 'back_to_home')]);

  const listText = `🎬 <b>আজকের ও সাম্প্রতিক ভিডিওর ফাইলসমূহ:</b>
━━━━━━━━━━━━━━━━━━━━━━
নিচের তালিকা থেকে আপনার প্রয়োজনীয় ফাইলটিতে ক্লিক করে সরাসরি ডাউনলোড করে নিন:`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(listText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } else {
    await ctx.reply(listText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons), ...getBottomMenu(isAdmin(user.id)) });
  }
}

bot.action(/^pick_(file_\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const fileKey = ctx.match[1];
  await handleFileDownloadRequest(ctx, fileKey);
});

bot.action('how_to_download', async (ctx) => {
  await ctx.answerCbQuery();
  const howText = `ℹ️ <b>কীভাবে ফাইল ডাউনলোড করবেন?</b>
━━━━━━━━━━━━━━━━━━━━━━
১. তালিকা থেকে বা ইউটিউব ভিডিওর লিংক থেকে ফাইলে চাপ দিন।
২. আমাদের অফিসিয়াল চ্যানেলে জয়েন না থাকলে <b>"📢 চ্যানেলে জয়েন করুন"</b> বাটনে চাপ দিয়ে যুক্ত হোন।
৩. এরপর <b>"🔄 জয়েন করেছি, ফাইল ডাউনলোড করুন"</b> চাপলেই ফাইলটি সরাসরি আপনার চ্যাটে চলে আসবে!

কোনো বিরক্তিকর শর্টনারের ঝামেলা নেই, কোনো পপআপ নেই! 🚀`;

  await ctx.editMessageText(howText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔙 ফিরে যান', 'back_to_home')]
    ])
  });
});

bot.action('back_to_home', async (ctx) => {
  await ctx.answerCbQuery();
  await renderUserHome(ctx);
});

bot.action('view_as_user', async (ctx) => {
  await ctx.answerCbQuery('ইউজার ভিউ প্রিভিউ');
  await renderUserHome(ctx);
});

bot.action('back_to_admin', async (ctx) => {
  await ctx.answerCbQuery();
  await renderAdminDashboard(ctx);
});

// --- Persistent Bottom Menu Keyboard Hears Handlers ---
bot.hears('📁 আজকের ফাইলসমূহ', async (ctx) => {
  return showUserFilesList(ctx);
});

bot.hears('📢 অফিশিয়াল চ্যানেল', async (ctx) => {
  const settings = db.getSettings();
  const msg = `📢 <b>আমাদের অফিসিয়াল টেলিগ্রাম চ্যানেল:</b>\n\nফ্রি ফায়ারের নতুন সব কনফিগ, এপিকে ও এক্সক্লুসিভ ফাইল সবার আগে পেতে যুক্ত হোন! ⚡`;
  return ctx.reply(msg, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('👉 চ্যানেলে জয়েন করুন', settings.channelInviteLink)]
    ])
  });
});

bot.hears('🛍️ ওবিন শপ (টপ-আপ)', async (ctx) => {
  const settings = db.getSettings();
  const msg = `💎 <b>OBIN SHOP - ১০০% বিশ্বস্ত ডায়মন্ড শপ</b>\n━━━━━━━━━━━━━━━━━━━━━━\nসবচেয়ে কম মূল্যে ও নিরাপদে ফ্রি ফায়ার ডায়মন্ড ও মেম্বারশিপ টপ-আপ করতে আমাদের অফিশিয়াল শপে ভিজিট করুন:`;
  return ctx.reply(msg, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('🛍️ ওবিন শপে যান', settings.adButtonUrl || 'https://t.me/ObinShop_Bot')]
    ])
  });
});

bot.hears('ℹ️ হেল্প ও নিয়ম', async (ctx) => {
  const helpText = `ℹ️ <b>Mr. PROXY File Locker - হেল্প মেনু</b>
━━━━━━━━━━━━━━━━━━━━━━
<b>ফাইল ডাউনলোড করার নিয়ম:</b>
• ইউটিউব ডেসক্রিপশন থেকে দেওয়া লিংকে ক্লিক করুন।
• চ্যানেল সাবস্ক্রাইব না থাকলে চ্যানেলে যুক্ত হোন।
• ১ ক্লিকে কোনো শর্টনার ছাড়াই সরাসরি ফাইল ডাউনলোড করুন!

<b>সাপোর্ট ও যোগাযোগ:</b>
• যেকোনো প্রয়োজনে যোগাযোগ করুন: @mrmobin9`;

  return ctx.reply(helpText, { parse_mode: 'HTML' });
});

bot.hears('👑 এডমিন কন্ট্রোল', async (ctx) => {
  if (isAdmin(ctx.from.id)) {
    return renderAdminDashboard(ctx);
  }
});


// --- Admin Analytics & Live User Tracking ---
bot.action('admin_analytics', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const totalUsers = db.getTotalUsersCount();
  const recentUsers = db.getRecentUsers(8);
  const allFiles = db.getAllFiles();
  const totalDownloads = allFiles.reduce((sum, f) => sum + (f.downloads || 0), 0);

  let msg = `📊 <b>ইউজারদের লাইভ গতিবিধি ও অ্যানালিটিক্স</b>
━━━━━━━━━━━━━━━━━━━━━━
👥 <b>মোট রেজিস্টার্ড ইউজার:</b> ${totalUsers} জন
📥 <b>সর্বমোট ফাইল ডাউনলোড:</b> ${totalDownloads} বার
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>সাম্প্রতিক সক্রিয় ইউজারদের তালিকা:</b>\n`;

  if (recentUsers.length === 0) {
    msg += `<i>এখনো কোনো সাধারণ ইউজার যুক্ত হয়নি।</i>\n`;
  } else {
    recentUsers.forEach((u, i) => {
      const uName = escapeHtml(u.name || 'Unknown');
      const uHandle = u.username ? ` (${escapeHtml(u.username)})` : '';
      const dCount = u.downloadsCount || 0;
      msg += `<b>${i + 1}. ${uName}</b>${uHandle}\n   • আইডি: <code>${u.id}</code> | ডাউনলোড: <b>${dCount}</b> বার\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n💡 <i>ইউটিউবে লিংক শেয়ার করলে এখানে ইউজার সংখ্যা দ্রুত বাড়তে থাকবে!</i>`;

  await ctx.editMessageText(msg, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 রিফ্রেশ করুন', 'admin_analytics')],
      [Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')]
    ])
  });
});

// --- Admin: Files List & Share Links ---
bot.action('admin_files_list', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const files = db.getAllFiles();
  if (files.length === 0) {
    return ctx.editMessageText('ℹ️ এখনো কোনো ফাইল আপলোড করা হয়নি। সরাসরি যেকোনো ফাইল এই চ্যাটে পাঠিয়ে দিন।', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')]])
    });
  }

  let text = `📁 <b>আপনার আপলোড করা ফাইলসমূহ ও লিংক:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  files.slice(0, 8).forEach((f, i) => {
    const link = `https://t.me/${botInfo.username}?start=${f.key}`;
    text += `<b>${i + 1}. ${escapeHtml(f.fileName)}</b> (${f.fileSize})\n`;
    text += `📥 ডাউনলোড হয়েছে: <b>${f.downloads}</b> বার\n`;
    text += `🔗 ইউটিউব লিংক: <code>${link}</code>\n\n`;
  });

  const packLink = `https://t.me/${botInfo.username}?start=files`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n🎁 <b>এক ক্লিকে সকল ফাইলের প্যাক লিংক:</b>\n<code>${packLink}</code>\n<i>(এই লিংকটি দিলে ইউজার একসাথে সব ফাইল দেখতে পাবে)</i>`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')]
    ])
  });
});

// --- Admin: Broadcast Instructions ---
bot.action('admin_broadcast_help', async (ctx) => {
  await ctx.answerCbQuery();
  const text = `📢 <b>ব্রডকাস্ট নোটিশ পাঠানোর নিয়ম:</b>
━━━━━━━━━━━━━━━━━━━━━━
আপনার বটের সকল ইউজারদের কাছে একসাথে মেসেজ পাঠানোর জন্য:

১. কমান্ড লিখুন:
<code>/broadcast আপনার মেসেজ এখানে লিখুন</code>

২. অথবা কোনো ছবি/ভিডিও বা ইউটিউব পোস্ট সেন্ড করে সেটিতে <b>Reply</b> করে লিখুন:
<code>/broadcast</code>

বট সাথে সাথে সকল দর্শকের কাছে নোটিফিকেশন পৌঁছে দেবে!`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')]])
  });
});

// --- Admin: Settings ---
bot.action('admin_settings', async (ctx) => {
  await ctx.answerCbQuery();
  const settings = db.getSettings();

  const text = `⚙️ <b>চ্যানেল ও প্রমোশন সেটিংস:</b>
━━━━━━━━━━━━━━━━━━━━━━
📢 <b>সংযুক্ত চ্যানেল:</b> ${escapeHtml(settings.channelTitle)}
🆔 <b>চ্যানেল আইডি:</b> <code>${settings.channelId || 'কানেক্ট করা হয়নি'}</code>
🔗 <b>ইনভাইট লিংক:</b> <code>${settings.channelInviteLink}</code>
🔒 <b>ফোর্স সাবস্ক্রিপশন:</b> 🟢 চালু
🎁 <b>স্পনসর প্রমোশন:</b> 🟢 চালু (ওবিন শপ)
━━━━━━━━━━━━━━━━━━━━━━
💡 <b>নতুন চ্যানেল কানেক্ট করতে:</b>
আপনার চ্যানেল থেকে যেকোনো একটি পোস্ট কপি করে বা ফরওয়ার্ড করে এই চ্যাটে পাঠিয়ে দিন!`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')]])
  });
});

// --- Admin Section: Automatic Channel Detection via Forwarded Post or File Upload ---
bot.on('message', async (ctx, next) => {
  const user = ctx.from;
  if (!user) return next();

  const userIsAdmin = isAdmin(user.id);

  // If Admin forwards ANY message from the target channel to the bot
  if (userIsAdmin && ctx.message.forward_from_chat) {
    const forwardChat = ctx.message.forward_from_chat;
    if (forwardChat.type === 'channel') {
      const channelId = forwardChat.id.toString();
      const channelTitle = forwardChat.title || 'সংযুক্ত চ্যানেল';

      db.updateSettings({
        channelId: channelId,
        channelTitle: channelTitle
      });

      const confirmText = `🎉 <b>চ্যানেল সফলভাবে সংযুক্ত করা হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━━━
📢 <b>চ্যানেলের নাম:</b> ${escapeHtml(channelTitle)}
🆔 <b>চ্যানেল আইডি:</b> <code>${channelId}</code>
━━━━━━━━━━━━━━━━━━━━━━
✅ <b>ফোর্স সাবস্ক্রিপশন সচল হয়েছে!</b>
এখন থেকে কোনো দর্শক ফাইল ডাউনলোড করতে আসলে তাকে প্রথমে এই চ্যানেলে সাবস্ক্রাইব করতে হবে।`;

      return ctx.reply(confirmText, { parse_mode: 'HTML' });
    }
  }

  // If Admin uploads a file/document
  if (userIsAdmin && ctx.message.document) {
    const doc = ctx.message.document;
    const rawSize = doc.file_size || 0;
    const fileSize = formatBytes(rawSize);
    const fileName = doc.file_name || `File_${Date.now()}`;

    const newFile = db.addFile({
      telegramFileId: doc.file_id,
      fileName: fileName,
      fileSize: fileSize,
      rawSize: rawSize,
      mimeType: doc.mime_type
    });

    const shareUrl = `https://t.me/${botInfo.username}?start=${newFile.key}`;
    const safeFileName = escapeHtml(newFile.fileName);

    const replyMsg = `🎉 <b>ফাইল সফলভাবে আপলোড ও লক করা হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইলের নাম:</b> <code>${safeFileName}</code>
💾 <b>সাইজ:</b> <code>${newFile.fileSize}</code>
🆔 <b>ফাইল কোড:</b> <code>${newFile.key}</code>
━━━━━━━━━━━━━━━━━━━━━━
🔗 <b>এই ফাইলের সরাসরি ডাউনলোড লিংক:</b>
<code>${shareUrl}</code> <i>(ট্যাপ করে কপি করুন)</i>

🎁 <b>সকল ফাইলের প্যাক লিংক:</b>
<code>https://t.me/${botInfo.username}?start=files</code>

💡 <b>ব্যবহারের নিয়ম:</b>
এই লিংকটি সরাসরি আপনার ইউটিউব ভিডিওর ডেসক্রিপশনে দিয়ে দিন!`;

    return ctx.reply(replyMsg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('টেস্ট লিংক ওপেন করুন 🚀', shareUrl)],
        [Markup.button.callback('👑 এডমিন ড্যাশবোর্ড', 'back_to_admin')]
      ])
    });
  }

  return next();
});

// --- Commands ---
bot.command('setadmin', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId === SOLE_OWNER_ID) {
    await ctx.reply(`👑 আপনি ইতিমধ্যে এই বটের একমাত্র প্রধান এডমিন ও ওনার (@mrmobin9 / <code>${SOLE_OWNER_ID}</code>)।`, { parse_mode: 'HTML' });
  } else {
    await ctx.reply('⚠️ দুঃখিত, এই বটের একমাত্র প্রধান এডমিন @mrmobin9। অন্য কারো এডমিন হওয়ার অনুমতি নেই।');
  }
});

bot.command('myid', async (ctx) => {
  await ctx.reply(`🆔 আপনার আইডি: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML' });
});

bot.command('files', async (ctx) => {
  showUserFilesList(ctx);
});

bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  renderAdminDashboard(ctx);
});

// --- Broadcast Command ---
bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  const userIds = db.getAllUserIds();
  if (userIds.length === 0) {
    return ctx.reply('⚠️ ডাটাবেজে এখনো কোনো সাধারণ ইউজার নেই ব্রডকাস্ট করার জন্য।');
  }

  const isReply = Boolean(ctx.message.reply_to_message);
  const textMsg = ctx.message.text.replace('/broadcast', '').trim();

  if (!isReply && !textMsg) {
    return ctx.reply('⚠️ ব্যবহারের নিয়ম:\n১. <code>/broadcast আপনার নোটিশ লিখুন</code>\n২. অথবা কোনো ছবি/ভিডিওতে Reply করে লিখুন <code>/broadcast</code>', { parse_mode: 'HTML' });
  }

  await ctx.reply(`🚀 ব্রডকাস্ট শুরু হচ্ছে... মোট ইউজার: ${userIds.length} জন।`);

  let successCount = 0;
  let failCount = 0;

  for (const uid of userIds) {
    try {
      if (isReply) {
        await ctx.telegram.copyMessage(uid, ctx.chat.id, ctx.message.reply_to_message.message_id);
      } else {
        await ctx.telegram.sendMessage(uid, textMsg, { parse_mode: 'HTML' });
      }
      successCount++;
    } catch (err) {
      failCount++;
    }
    await new Promise(r => setTimeout(r, 35));
  }

  await ctx.reply(`✅ <b>ব্রডকাস্ট সম্পন্ন হয়েছে!</b>\n\n• সফল: ${successCount} জন\n• ব্যর্থ/ব্লকড: ${failCount} জন`, { parse_mode: 'HTML' });
});

// --- Help Command ---
bot.command('help', async (ctx) => {
  const helpText = `ℹ️ <b>Mr. PROXY File Locker - হেল্প মেনু</b>

<b>সাধারণ দর্শকদের জন্য:</b>
• ইউটিউব থেকে দেওয়া লিংকে ক্লিক করে সরাসরি ফাইল আনলক করুন।
• কোনো ফাইল লক থাকলে চ্যানেলে সাবস্ক্রাইব করুন।

<b>এডমিনের জন্য:</b>
• <b>ফাইল আপলোড করতে:</b> সরাসরি যেকোনো ফাইল (Zip, 7z, Apk, Txt) এই চ্যাটে পাঠিয়ে দিন। সাথে সাথে ডাউনলোড লিংক পেয়ে যাবেন!
• <b>চ্যানেল কানেক্ট করতে:</b> আপনার চ্যানেল থেকে যেকোনো একটি পোস্ট এই বটে <b>Forward</b> করে পাঠিয়ে দিন।
• /start - এডমিন ড্যাশবোর্ড খুলতে।`;

  await ctx.reply(helpText, { parse_mode: 'HTML' });
});

// --- In-Memory Log Buffer for Live Remote Inspection ---
const recentLogs = [];
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => {
  recentLogs.push(`[${new Date().toISOString().substring(11, 19)}] ${args.join(' ')}`);
  if (recentLogs.length > 80) recentLogs.shift();
  origLog(...args);
};
console.error = (...args) => {
  recentLogs.push(`[${new Date().toISOString().substring(11, 19)} ERR] ${args.join(' ')}`);
  if (recentLogs.length > 80) recentLogs.shift();
  origErr(...args);
};

// Global update logger
bot.use(async (ctx, next) => {
  const sender = ctx.from ? `${ctx.from.id} (@${ctx.from.username || ctx.from.first_name})` : 'unknown';
  const text = ctx.message ? ctx.message.text : (ctx.callbackQuery ? `callback:${ctx.callbackQuery.data}` : ctx.updateType);
  console.log(`📥 [TG] ${sender} -> ${text}`);
  return next();
});

// --- HTTP Health Check Web Server (Required for Render Web Service) ---
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(recentLogs.join('\n') || 'No logs recorded yet.');
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'ONLINE',
    bot: botInfo?.username || 'Mr_PROXYFile_Bot',
    uptime: Math.floor(process.uptime()) + ' seconds',
    message: 'Mr. PROXY File Locker Bot is running 24/7!'
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web Health-Check server listening on port ${PORT} (Render OK)`);
});

// --- Fetch Bot Info and Launch ---
bot.telegram.getMe().then(me => {
  botInfo = me;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🤖 Bot Name: ${me.first_name} (@${me.username})`);
  console.log(`👑 Sole Owner & Admin: ${SOLE_OWNER_ID} (@mrmobin9)`);
  console.log(`📢 Channel Link: ${db.getSettings().channelInviteLink}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}).catch(err => {
  console.error('getMe error:', err.message);
});

bot.launch().then(() => {
  console.log('✅ Telegram Polling is ACTIVE and listening for messages!');
}).catch(err => {
  console.error('❌ Failed to launch Proxy File Locker Bot:', err.message);
});

// Graceful stop
process.once('SIGINT', () => {
  server.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  server.close();
  bot.stop('SIGTERM');
});

