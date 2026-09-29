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

// Register Bot Commands
bot.telegram.setMyCommands([
  { command: 'start', description: '🏠 প্রধান মেনু' },
  { command: 'help', description: 'ℹ️ সাহায্য ও নির্দেশিকা' },
  { command: 'files', description: '📁 ফাইল ক্যাটালগ' },
  { command: 'myid', description: '🆔 আপনার আইডি দেখুন' },
  { command: 'stats', description: '📊 অ্যানালিটিক্স (এডমিন)' }
]).catch(() => {});

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
    await ctx.reply(adminText, { parse_mode: 'HTML', ...keyboard });
  }
}

// --- Helper: Render User Home Screen ---
async function renderUserHome(ctx) {
  const user = ctx.from;
  const settings = db.getSettings();
  const safeName = escapeHtml(user.first_name || 'বন্ধু');
  const safeBotName = escapeHtml(botInfo.first_name || 'Mr. PROXY File Locker');

  const welcomeText = `👋 আসসালামু আলাইকুম <b>${safeName}</b>!

🤖 <b>${safeBotName}</b> বটে আপনাকে স্বাগতম! ⚡

এখানে আপনি ফ্রি ফায়ারসহ বিভিন্ন গেমের প্রয়োজনীয় সকল কনফিগ, রেজএডিট ও ফাইল কোনো বিরক্তিকর শর্টনার ছাড়াই <b>১০০% ফ্রিতে ও ১ ক্লিকে</b> ডাউনলোড করতে পারবেন।

👇 আপনার পছন্দের অপশনটি বেছে নিন:`;

  const userButtons = [
    [
      Markup.button.callback('📁 আজকের ভিডিও ফাইলসমূহ (ফাইল প্যাক)', 'user_files_list'),
      Markup.button.url('📢 অফিশিয়াল চ্যানেল', settings.channelInviteLink)
    ],
    [
      Markup.button.url('🛍️ ওবিন শপ (ডায়মন্ড কিনুন)', settings.adButtonUrl),
      Markup.button.callback('ℹ️ কীভাবে ডাউনলোড করবেন?', 'how_to_download')
    ]
  ];

  if (isAdmin(user.id)) {
    userButtons.push([Markup.button.callback('👑 এডমিন প্যানেলে ফিরুন', 'back_to_admin')]);
  }

  const keyboard = Markup.inlineKeyboard(userButtons);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(welcomeText, { parse_mode: 'HTML', ...keyboard });
  } else {
    await ctx.reply(welcomeText, { parse_mode: 'HTML', ...keyboard });
  }
}

// --- /start Handler ---
bot.start(async (ctx) => {
  const user = ctx.from;
  db.logUser(user);

  const payload = ctx.startPayload ? ctx.startPayload.trim() : null;

  // If user clicked a direct file link (e.g. /start file_101)
  if (payload && payload.startsWith('file_')) {
    return handleFileDownloadRequest(ctx, payload);
  }

  // If user clicked a pack link (e.g. /start pack or /start files)
  if (payload === 'files' || payload === 'pack') {
    return showUserFilesList(ctx);
  }

  // If user unlocked from Mini App (e.g. /start unlocked_file_102)
  if (payload && payload.startsWith('unlocked_')) {
    const fileKey = payload.replace('unlocked_', '');
    const file = db.getFile(fileKey);
    if (file) {
      db.incrementDownload(file.key, user.id);
      await ctx.reply('🎉 <b>ভিডিও বিজ্ঞাপন সফলভাবে দেখা হয়েছে!</b>\n\nআপনার ফাইলটি আনলক করা হয়েছে, সরাসরি পাঠানো হচ্ছে...', { parse_mode: 'HTML' });
      return ctx.replyWithDocument(file.telegramFileId, {
        caption: `✅ <b>ফাইল ডাউনলোড সফল!</b>\n📦 ফাইলের নাম: <code>${escapeHtml(file.fileName)}</code>\n💾 সাইজ: <code>${file.fileSize}</code>\n\n🤖 Powered by @${botInfo.username}`,
        parse_mode: 'HTML'
      });
    } else {
      return ctx.reply('✅ আপনার ফাইল আনলক হয়েছে! সকল ফাইল দেখতে /files চাপুন।');
    }
  }

  // If user redirected back from Adsgram reward (e.g. /start reward_...)
  if (payload && payload.startsWith('reward_')) {
    const allFiles = db.getAllFiles();
    const lastFile = allFiles[0];
    await ctx.reply('🎉 <b>বিজ্ঞাপন ভেরিফিকেশন সম্পন্ন হয়েছে!</b>\n\nআপনার ফাইলটি সরাসরি পাঠানো হচ্ছে...', { parse_mode: 'HTML' });
    if (lastFile) {
      db.incrementDownload(lastFile.key, user.id);
      return ctx.replyWithDocument(lastFile.telegramFileId, {
        caption: `✅ <b>ফাইল ডাউনলোড সফল!</b>\n📦 ফাইলের নাম: <code>${escapeHtml(lastFile.fileName)}</code>\n💾 সাইজ: <code>${lastFile.fileSize}</code>\n\n🤖 Powered by @${botInfo.username}`,
        parse_mode: 'HTML'
      });
    } else {
      return ctx.reply('✅ আপনার রিওয়ার্ড নিশ্চিত হয়েছে! ফাইলসমূহ দেখতে /files চাপুন।');
    }
  }

  // Check if Admin or Normal User
  if (isAdmin(user.id)) {
    return renderAdminDashboard(ctx);
  } else {
    return renderUserHome(ctx);
  }
});

// --- File Download Request Handler ---
async function handleFileDownloadRequest(ctx, fileKey) {
  const user = ctx.from;
  const file = db.getFile(fileKey);
  const settings = db.getSettings();

  if (!file) {
    return ctx.reply('⚠️ দুঃখিত! এই ফাইলটি খুঁজে পাওয়া যায়নি অথবা সার্ভার থেকে মুছে ফেলা হয়েছে।');
  }

  // 1. Check Channel Membership
  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    const safeFileName = escapeHtml(file.fileName);
    const lockedMsg = `🔒 <b>ফাইলটি লক করা রয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইলের নাম:</b> <code>${safeFileName}</code>
💾 <b>ফাইলের সাইজ:</b> <code>${file.fileSize}</code>
━━━━━━━━━━━━━━━━━━━━━━
⚠️ এই ফাইলটি ডাউনলোড করতে আপনাকে আমাদের অফিশিয়াল চ্যানেলে জয়েন থাকতে হবে।

১. নিচে <b>"📢 চ্যানেলে জয়েন করুন"</b> বাটনে চাপ দিয়ে চ্যানেলে যুক্ত হোন।
২. জয়েন করার পর <b>"🔄 জয়েন করেছি, আনলক করুন"</b> বাটনে চাপ দিন।`;

    const lockKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 চ্যানেলে জয়েন করুন', settings.channelInviteLink)],
      [Markup.button.callback('🔄 জয়েন করেছি, আনলক করুন', `verify_${fileKey}`)]
    ]);

    return ctx.reply(lockedMsg, {
      parse_mode: 'HTML',
      ...lockKeyboard
    });
  }

  // 2. If already member, show unlock / ad screen
  await sendUnlockScreen(ctx, file);
}

// --- Send Unlock / Ad Screen ---
async function sendUnlockScreen(ctx, file) {
  const settings = db.getSettings();
  const safeFileName = escapeHtml(file.fileName);

  let unlockMsg = `🔓 <b>আপনার ফাইল প্রস্তুত!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইল:</b> <code>${safeFileName}</code>
💾 <b>সাইজ:</b> <code>${file.fileSize}</code>
📥 <b>মোট ডাউনলোড:</b> ${file.downloads} বার
━━━━━━━━━━━━━━━━━━━━━━`;

  if (settings.adEnabled) {
    unlockMsg += `\n✨ <b>${escapeHtml(settings.adTitle)}:</b>\n${escapeHtml(settings.adText)}\n━━━━━━━━━━━━━━━━━━━━━━`;
  }

  unlockMsg += `\n👇 ফাইলটি আনলক করতে নিচের বাটনে চাপ দিন:`;

  const miniAppBase = 'https://mister-linkhub-app.web.app/';
  const miniAppUrl = `${miniAppBase}?file=${file.key}&name=${encodeURIComponent(file.fileName)}&size=${encodeURIComponent(file.fileSize)}&blockId=50561`;

  const buttons = [
    [Markup.button.webApp('🎬 ভিডিও বিজ্ঞাপন দেখুন ও আনলক করুন', miniAppUrl)],
    [Markup.button.callback('⚡ সাধারণ ১-ক্লিক ডাউনলোড (৩ সে.)', `download_${file.key}`)]
  ];

  if (settings.adEnabled && settings.adButtonText && settings.adButtonUrl) {
    buttons.push([Markup.button.url(settings.adButtonText, settings.adButtonUrl)]);
  }

  buttons.push([Markup.button.callback('🔙 অন্যান্য ফাইলসমূহ দেখুন', 'user_files_list')]);

  const keyboard = Markup.inlineKeyboard(buttons);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(unlockMsg, { parse_mode: 'HTML', ...keyboard });
    } else {
      await ctx.reply(unlockMsg, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (e) {
    await ctx.reply(unlockMsg, { parse_mode: 'HTML', ...keyboard });
  }
}

// --- Verify Button Callback ---
bot.action(/^verify_(file_\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const fileKey = ctx.match[1];
  const user = ctx.from;
  const file = db.getFile(fileKey);

  if (!file) {
    return ctx.reply('⚠️ ফাইলটি খুঁজে পাওয়া যায়নি।');
  }

  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    return ctx.answerCbQuery('❌ আপনি এখনও চ্যানেলে জয়েন করেননি! অনুগ্রহ করে আগে চ্যানেলে জয়েন করুন।', { show_alert: true });
  }

  await ctx.answerCbQuery('✅ ভেরিফিকেশন সফল হয়েছে!');
  await sendUnlockScreen(ctx, file);
});

// --- Download File Callback (With 3-Second Demo Ad Verification) ---
bot.action(/^download_(file_\d+)$/, async (ctx) => {
  const fileKey = ctx.match[1];
  const user = ctx.from;
  const file = db.getFile(fileKey);

  if (!file) {
    return ctx.reply('⚠️ ফাইলটি পাওয়া যায়নি।');
  }

  await ctx.answerCbQuery('অ্যাড ভেরিফিকেশন চলছে...');

  // Show a simulated 3-second Rewarded Ad / Verification Countdown
  try {
    await ctx.editMessageText('⏳ <b>স্পনসর অ্যাড ভেরিফিকেশন চলছে... ৩ সেকেন্ড অপেক্ষা করুন...</b>\n\n<i>(ফাইলটি সরাসরি আপনার চ্যাটে পাঠানো হচ্ছে)</i>', { parse_mode: 'HTML' });
  } catch (e) {}

  setTimeout(async () => {
    // Increment download counter
    db.incrementDownload(fileKey, user.id);

    try {
      const safeFileName = escapeHtml(file.fileName);
      const caption = `✅ <b>ফাইল ডাউনলোড সফল!</b>
📦 ফাইলের নাম: <code>${safeFileName}</code>
💾 সাইজ: <code>${file.fileSize}</code>

🤖 Powered by @${botInfo.username}`;

      await ctx.replyWithDocument(file.telegramFileId, {
        caption,
        parse_mode: 'HTML'
      });

      // Quick return button
      await ctx.reply('🎉 ডাউনলোড সম্পন্ন হয়েছে! অন্য কোনো ফাইল নিতে নিচের বাটনে চাপ দিন:', Markup.inlineKeyboard([
        [Markup.button.callback('📁 অন্যান্য ফাইলসমূহ দেখুন', 'user_files_list')],
        [Markup.button.url('🛍️ ওবিন শপ (ডায়মন্ড কিনুন)', db.getSettings().adButtonUrl)]
      ]));
    } catch (err) {
      console.error('Failed to send document:', err.message);
      await ctx.reply(`❌ ফাইল পাঠাতে সমস্যা হয়েছে: ${err.message}`);
    }
  }, 2500);
});

// --- User Action: Show All Files in Multi-File Pack ---
bot.action('user_files_list', async (ctx) => {
  await ctx.answerCbQuery();
  showUserFilesList(ctx);
});

async function showUserFilesList(ctx) {
  const files = db.getAllFiles();
  const settings = db.getSettings();

  if (files.length === 0) {
    const emptyText = `📁 <b>ফাইল কালেকশন</b>\n━━━━━━━━━━━━━━━━━━━━━━\nবর্তমানে কোনো ফাইল আপলোড করা নেই। শীঘ্রই নতুন ভিডিওর সাথে ফাইল যুক্ত করা হবে!`;
    const emptyKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 চ্যানেলে যুক্ত থাকুন', settings.channelInviteLink)]
    ]);
    if (ctx.callbackQuery) {
      return ctx.editMessageText(emptyText, { parse_mode: 'HTML', ...emptyKeyboard });
    } else {
      return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKeyboard });
    }
  }

  const buttons = files.slice(0, 10).map((f, index) => {
    return [Markup.button.callback(`📥 ${index + 1}. ${f.fileName} (${f.fileSize})`, `pick_${f.key}`)];
  });

  buttons.push([Markup.button.callback('🏠 হোম পেজে ফিরুন', 'back_to_home')]);

  const listText = `🎬 <b>আজকের ও সাম্প্রতিক ভিডিওর ফাইলসমূহ:</b>
━━━━━━━━━━━━━━━━━━━━━━
নিচের তালিকা থেকে আপনার প্রয়োজনীয় ফাইলটিতে ক্লিক করে সরাসরি আনলক ও ডাউনলোড করে নিন:`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(listText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } else {
    await ctx.reply(listText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
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
১. তালিকা থেকে আপনার পছন্দের ফাইলটিতে চাপ দিন।
২. আমাদের অফিসিয়াল চ্যানেলে জয়েন না থাকলে <b>"চ্যানেলে জয়েন করুন"</b> বাটনে চাপ দিয়ে যুক্ত হোন।
৩. এরপর <b>"ভেরিফাই করুন"</b> চাপলেই ফাইলটি আনলক হয়ে যাবে।
৪. <b>"ডাউনলোড করুন"</b> চাপলে কয়েক সেকেন্ডের মধ্যে ফাইলটি সরাসরি আপনার চ্যাটে চলে আসবে!

কোনো শর্টনারের ঝামেলা নেই, কোনো আজেবাজে পপআপ নেই! 🚀`;

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
  await ctx.answerCbQuery('ইউজার ভিউ চালু করা হয়েছে');
  await renderUserHome(ctx);
});

bot.action('back_to_admin', async (ctx) => {
  await ctx.answerCbQuery();
  await renderAdminDashboard(ctx);
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

