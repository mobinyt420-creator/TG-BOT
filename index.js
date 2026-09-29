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

// Helper to check channel membership (কাউন্টিং সিস্টেম)
async function isUserSubscribed(userId) {
  const settings = db.getSettings();
  if (!settings.forceSubEnabled) {
    return true; // No restriction if force-sub disabled
  }

  // If channelId is not set yet, files stay locked until admin connects channel
  if (!settings.channelId) {
    return false;
  }

  try {
    const member = await bot.telegram.getChatMember(settings.channelId, userId);
    return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
  } catch (err) {
    console.error(`Membership check failed for user ${userId} in ${settings.channelId}:`, err.message);
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
    ['🛍️ নূব টপ-আপ (ডায়মন্ড)', 'ℹ️ হেল্প ও নিয়ম']
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
      Markup.button.url('🛍️ নূব টপ-আপ (ডায়মন্ড কিনুন)', settings.adButtonUrl || 'https://noobtopup.com/'),
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
// Rate limiting map for anti-spam on verification clicks
const verifyCooldown = new Map();

// --- /start Handler ---
bot.start(async (ctx) => {
  const user = ctx.from;
  db.logUser(user);

  const payload = ctx.startPayload ? ctx.startPayload.trim() : null;

  // ১. ব্যাচ ফাইল লিংকে ক্লিক করলে (যেমন /start batch_101_102)
  if (payload && payload.startsWith('batch_')) {
    return handleBatchDownloadRequest(ctx, payload);
  }

  // ২. একক ফাইল লিংকে ক্লিক করলে (যেমন /start file_101)
  if (payload && payload.startsWith('file_')) {
    return handleFileDownloadRequest(ctx, payload);
  }

  // ৩. ফাইল প্যাক লিংকে ক্লিক করলে (যেমন /start files)
  if (payload === 'files' || payload === 'pack') {
    return showUserFilesList(ctx);
  }

  // ৪. এডমিন হলে এডমিন প্যানেল, সাধারণ ইউজার হলে সাধারণ হোম পেজ
  if (isAdmin(user.id)) {
    return renderAdminDashboard(ctx);
  } else {
    return renderUserHome(ctx);
  }
});

// --- Batch File Download Request Handler (একাধিক ফাইলের ১টি লিংক) ---
async function handleBatchDownloadRequest(ctx, batchPayload) {
  const user = ctx.from;
  const rawParts = batchPayload.replace(/^batch_/, '').split(/[_-]+/);
  const fileKeys = [];
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (part === 'file' && rawParts[i + 1]) {
      fileKeys.push(`file_${rawParts[i + 1]}`);
      i++;
    } else if (/^\d+$/.test(part)) {
      fileKeys.push(`file_${part}`);
    }
  }

  const validFiles = fileKeys.map(k => db.getFile(k)).filter(Boolean);
  if (validFiles.length === 0) {
    return ctx.reply('⚠️ দুঃখিত! এই প্যাকেজের ফাইলগুলো খুঁজে পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে।');
  }

  // ফোর্স সাবস্ক্রিপশন ও টাস্ক চেক
  const isMember = await isUserSubscribed(user.id);
  if (!isMember) {
    return sendBatchLockScreen(ctx, validFiles, batchPayload, false);
  }

  await deliverBatchFiles(ctx, validFiles);
}

// --- Send Batch Lock Screen ---
async function sendBatchLockScreen(ctx, files, batchPayload, isPreview = false) {
  const settings = db.getSettings();
  const fileListStr = files.map((f, i) => `${i + 1}. <b>${escapeHtml(f.fileName)}</b> (<code>${f.fileSize}</code>)`).join('\n');

  const lockMsg = `🔒 <b>ফাইল প্যাকেজটি লক করা রয়েছে! (মোট ${files.length}টি ফাইল)</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>প্যাকেজের অন্তর্ভুক্ত ফাইলসমূহ:</b>
${fileListStr}
━━━━━━━━━━━━━━━━━━━━━━
⚠️ এই ফাইলগুলো ডাউনলোড করতে আপনাকে নিচের টাস্কগুলো সম্পন্ন করতে হবে:

১️⃣ <b>টেলিগ্রাম চ্যানেলে জয়েন করুন</b> (বাধ্যতামূলক ✅)
${settings.extraTaskEnabled ? `২️⃣ <b>${escapeHtml(settings.extraTaskTitle || 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন')}</b> 🔴\n` : ''}
👇 নিচের বাটনগুলোতে ক্লিক করে টাস্ক সম্পন্ন করে <b>"সকল ফাইল আনলক করুন"</b> বাটনে চাপ দিন:`;

  const buttons = [
    [Markup.button.url('📢 ১. টেলিগ্রাম চ্যানেলে জয়েন করুন', settings.channelInviteLink)]
  ];

  if (settings.extraTaskEnabled && settings.extraTaskUrl) {
    buttons.push([
      Markup.button.url(`🔴 ২. ${settings.extraTaskTitle || 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন'}`, settings.extraTaskUrl)
    ]);
  }

  buttons.push([
    Markup.button.callback('🔄 ৩. টাস্ক সম্পন্ন করেছি, সকল ফাইল আনলক করুন 🔓', isPreview ? 'test_verify_done' : `vbatch_${batchPayload}`)
  ]);

  if (isPreview) {
    buttons.push([Markup.button.callback('🔙 এডমিন সেটিংসে ফিরুন', 'admin_settings')]);
  }

  const keyboard = Markup.inlineKeyboard(buttons);

  if (ctx.callbackQuery) {
    return ctx.editMessageText(lockMsg, { parse_mode: 'HTML', ...keyboard });
  } else {
    return ctx.reply(lockMsg, {
      parse_mode: 'HTML',
      ...keyboard,
      ...getBottomMenu(isAdmin(ctx.from.id))
    });
  }
}

// --- Deliver Batch Files ---
async function deliverBatchFiles(ctx, files) {
  await ctx.reply(`🎉 <b>ভেরিফিকেশন সফল!</b> আপনার প্যাকেজের মোট <b>${files.length}</b>টি ফাইল পাঠানো হচ্ছে...`, { parse_mode: 'HTML' });
  for (const file of files) {
    await deliverFile(ctx, file);
    await new Promise(r => setTimeout(r, 600));
  }
}

// --- File Download Request Handler (Force-Sub Check & Direct Delivery) ---
async function handleFileDownloadRequest(ctx, fileKey) {
  const user = ctx.from;
  const file = db.getFile(fileKey);

  if (!file) {
    return ctx.reply('⚠️ দুঃখিত! এই ফাইলটি খুঁজে পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে।');
  }

  // ফোর্স সাবস্ক্রিপশন ও টাস্ক চেক
  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    return sendLockScreen(ctx, file, false);
  }

  // চ্যানেলে অলরেডি জয়েন থাকলে সরাসরি ১-ক্লিকে ফাইল ডেলিভারি
  await deliverFile(ctx, file);
}

// --- Send Task / Lock Screen (কাউন্টিং ও আনকাউন্টিং টাস্ক সিস্টেম) ---
async function sendLockScreen(ctx, file, isPreview = false) {
  const settings = db.getSettings();
  const safeFileName = escapeHtml(file.fileName);

  const lockMsg = `🔒 <b>ফাইলটি লক করা রয়েছে! ডাউনলোড করতে টাস্ক পূরণ করুন:</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>ফাইলের নাম:</b> <code>${safeFileName}</code>
💾 <b>সাইজ:</b> <code>${file.fileSize}</code>
📥 <b>মোট ডাউনলোড:</b> ${file.downloads || 0} বার
━━━━━━━━━━━━━━━━━━━━━━
⚠️ এই ফাইলটি ডাউনলোড করতে আপনাকে নিচের টাস্কগুলো সম্পন্ন করতে হবে:

১️⃣ <b>টেলিগ্রাম চ্যানেলে জয়েন করুন</b> (বাধ্যতামূলক ✅)
${settings.extraTaskEnabled ? `২️⃣ <b>${escapeHtml(settings.extraTaskTitle || 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন')}</b> 🔴\n` : ''}
👇 নিচের বাটনগুলোতে ক্লিক করে টাস্ক সম্পন্ন করে <b>"ফাইল আনলক করুন"</b> বাটনে চাপ দিন:`;

  const buttons = [
    [Markup.button.url('📢 ১. টেলিগ্রাম চ্যানেলে জয়েন করুন', settings.channelInviteLink)]
  ];

  if (settings.extraTaskEnabled && settings.extraTaskUrl) {
    buttons.push([
      Markup.button.url(`🔴 ২. ${settings.extraTaskTitle || 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন'}`, settings.extraTaskUrl)
    ]);
  }

  buttons.push([
    Markup.button.callback('🔄 ৩. টাস্ক সম্পন্ন করেছি, ফাইল আনলক করুন 🔓', isPreview ? 'test_verify_done' : `verify_${file.key}`)
  ]);

  if (isPreview) {
    buttons.push([Markup.button.callback('🔙 এডমিন সেটিংসে ফিরুন', 'admin_settings')]);
  }

  const keyboard = Markup.inlineKeyboard(buttons);

  if (ctx.callbackQuery) {
    return ctx.editMessageText(lockMsg, { parse_mode: 'HTML', ...keyboard });
  } else {
    return ctx.reply(lockMsg, {
      parse_mode: 'HTML',
      ...keyboard,
      ...getBottomMenu(isAdmin(ctx.from.id))
    });
  }
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
    buttons.push([Markup.button.url('🛍️ নূব টপ-আপ (ডায়মন্ড কিনুন)', settings.adButtonUrl || 'https://noobtopup.com/')]);
  }
  buttons.push([
    Markup.button.url('📢 অফিশিয়াল চ্যানেল', settings.channelInviteLink),
    Markup.button.callback('📁 অন্যান্য ফাইলসমূহ', 'user_files_list')
  ]);

  const deliverOptions = {
    caption,
    parse_mode: 'HTML',
    protect_content: Boolean(settings.protectContent),
    ...Markup.inlineKeyboard(buttons)
  };

  try {
    await ctx.replyWithDocument(file.telegramFileId, deliverOptions);
  } catch (err) {
    console.error('Failed to deliver document:', err.message);
    await ctx.reply(`❌ ফাইল পাঠাতে সমস্যা হয়েছে: ${err.message}`);
  }
}

// --- Verify Button Callback (একক ফাইল) ---
bot.action(/^verify_(file_\d+)$/, async (ctx) => {
  const fileKey = ctx.match[1];
  const user = ctx.from;
  const file = db.getFile(fileKey);
  const settings = db.getSettings();

  // Rate limiting / anti-spam cooldown
  const lastClick = verifyCooldown.get(user.id) || 0;
  const now = Date.now();
  if (now - lastClick < 2500) {
    return ctx.answerCbQuery('⏳ অনুগ্রহ করে ২ সেকেন্ড অপেক্ষা করুন, চেক হচ্ছে...', { show_alert: false });
  }
  verifyCooldown.set(user.id, now);

  if (!file) {
    return ctx.answerCbQuery('⚠️ ফাইলটি খুঁজে পাওয়া যায়নি।', { show_alert: true });
  }

  // If channelId is not set in database yet
  if (!settings.channelId) {
    if (isAdmin(user.id)) {
      return ctx.answerCbQuery('⚠️ এডমিন ভাই, আপনি এখনও চ্যানেলের আইডি সেট করেননি! চ্যানেল থেকে একটি পোস্ট বটে Forward করুন।', { show_alert: true });
    } else {
      // Allow download if admin hasn't configured channel yet
      await ctx.answerCbQuery('✅ ফাইলটি পাঠানো হচ্ছে...');
      try { await ctx.deleteMessage(); } catch (e) {}
      return deliverFile(ctx, file);
    }
  }

  const isMember = await isUserSubscribed(user.id);

  if (!isMember) {
    if (isAdmin(user.id)) {
      try {
        await bot.telegram.getChatMember(settings.channelId, botInfo.id || (await bot.telegram.getMe()).id);
      } catch (err) {
        return ctx.answerCbQuery('⚠️ বট আপনার চ্যানেলে Admin হিসেবে যুক্ত নেই! চ্যানেলে গিয়ে বটকে Admin করুন।', { show_alert: true });
      }
    }
    return ctx.answerCbQuery('❌ আপনি এখনও ১ নম্বর টেলিগ্রাম চ্যানেলে জয়েন করেননি! দয়া করে চ্যানেলে জয়েন করে আবার চাপ দিন।', { show_alert: true });
  }

  await ctx.answerCbQuery('🎉 অসাধারণ! সকল টাস্ক ভেরিফিকেশন সফল হয়েছে!');
  try {
    await ctx.deleteMessage();
  } catch (e) {}

  await deliverFile(ctx, file);
});

// --- Verify Button Callback (ব্যাচ ফাইলসমূহ) ---
bot.action(/^vbatch_(.+)$/, async (ctx) => {
  const batchPayload = ctx.match[1];
  const user = ctx.from;
  const settings = db.getSettings();

  // Rate limiting / anti-spam cooldown
  const lastClick = verifyCooldown.get(user.id) || 0;
  const now = Date.now();
  if (now - lastClick < 2500) {
    return ctx.answerCbQuery('⏳ অনুগ্রহ করে ২ সেকেন্ড অপেক্ষা করুন, চেক হচ্ছে...', { show_alert: false });
  }
  verifyCooldown.set(user.id, now);

  const rawParts = batchPayload.replace(/^batch_/, '').split(/[_-]+/);
  const fileKeys = [];
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (part === 'file' && rawParts[i + 1]) {
      fileKeys.push(`file_${rawParts[i + 1]}`);
      i++;
    } else if (/^\d+$/.test(part)) {
      fileKeys.push(`file_${part}`);
    }
  }

  const validFiles = fileKeys.map(k => db.getFile(k)).filter(Boolean);
  if (validFiles.length === 0) {
    return ctx.answerCbQuery('⚠️ ফাইলগুলো খুঁজে পাওয়া যায়নি।', { show_alert: true });
  }

  if (!settings.channelId) {
    if (isAdmin(user.id)) {
      return ctx.answerCbQuery('⚠️ এডমিন ভাই, আপনি এখনও চ্যানেলের আইডি সেট করেননি! চ্যানেল থেকে একটি পোস্ট বটে Forward করুন।', { show_alert: true });
    } else {
      await ctx.answerCbQuery('✅ ফাইলগুলো পাঠানো হচ্ছে...');
      try { await ctx.deleteMessage(); } catch (e) {}
      return deliverBatchFiles(ctx, validFiles);
    }
  }

  const isMember = await isUserSubscribed(user.id);
  if (!isMember) {
    if (isAdmin(user.id)) {
      try {
        await bot.telegram.getChatMember(settings.channelId, botInfo.id || (await bot.telegram.getMe()).id);
      } catch (err) {
        return ctx.answerCbQuery('⚠️ বট আপনার চ্যানেলে Admin হিসেবে যুক্ত নেই! চ্যানেলে গিয়ে বটকে Admin করুন।', { show_alert: true });
      }
    }
    return ctx.answerCbQuery('❌ আপনি এখনও টেলিগ্রাম চ্যানেলে জয়েন করেননি! চ্যানেলে জয়েন করে আবার চাপ দিন।', { show_alert: true });
  }

  await ctx.answerCbQuery('🎉 অসাধারণ! সকল টাস্ক ভেরিফিকেশন সফল হয়েছে!');
  try { await ctx.deleteMessage(); } catch (e) {}
  return deliverBatchFiles(ctx, validFiles);
});

bot.action('test_verify_done', async (ctx) => {
  await ctx.answerCbQuery('🧪 টেস্ট মোড: টাস্ক সফলভাবে সম্পন্ন দেখানো হচ্ছে!');
  const allFiles = db.getAllFiles();
  const sampleFile = allFiles[0] || { key: 'file_test', fileName: 'FreeFire_Config_VIP.zip', fileSize: '4.2 MB', downloads: 128 };
  return deliverFile(ctx, sampleFile);
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

bot.hears(['🛍️ নূব টপ-আপ (ডায়মন্ড)', '🛍️ ওবিন শপ (টপ-আপ)'], async (ctx) => {
  const settings = db.getSettings();
  const shopUrl = settings.adButtonUrl || 'https://noobtopup.com/';
  const msg = `💎 <b>NOOB TOP UP - অফিসিয়াল ডায়মন্ড টপ-আপ ওয়েবসাইট</b>\n━━━━━━━━━━━━━━━━━━━━━━\nসবচেয়ে কম মূল্যে ও নিরাপদে ফ্রি ফায়ার ডায়মন্ড, উইকলি ও মান্থলি মেম্বারশিপ টপ-আপ করতে আমাদের অফিশিয়াল ওয়েবসাইট ভিজিট করুন:\n\n🌐 <b>ওয়েবসাইট:</b> https://noobtopup.com/`;
  return ctx.reply(msg, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('🛍️ NoobTopUp.com ভিজিট করুন 🚀', shopUrl)]
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

// --- Admin: Settings Panel (ইন্টারেক্টিভ চ্যানেল ও টাস্ক কনফিগারেশন) ---
async function renderAdminSettings(ctx) {
  const settings = db.getSettings();

  const text = `⚙️ <b>চ্যানেল ও টাস্ক সেটিংস ড্যাশবোর্ড:</b>
━━━━━━━━━━━━━━━━━━━━━━
📢 <b>সংযুক্ত টেলিগ্রাম চ্যানেল:</b> ${escapeHtml(settings.channelTitle)}
🆔 <b>চ্যানেল আইডি:</b> <code>${settings.channelId || 'কানেক্ট করা হয়নি ⚠️'}</code>
🔗 <b>ইনভাইট লিংক:</b> <code>${settings.channelInviteLink}</code>
🔒 <b>ফোর্স সাব (কাউন্টিং টাস্ক):</b> ${settings.forceSubEnabled ? '🟢 চালু' : '🔴 বন্ধ'}
━━━━━━━━━━━━━━━━━━━━━━
🔴 <b>ইউটিউব টাস্ক (আনকাউন্টিং):</b> ${settings.extraTaskEnabled ? '🟢 চালু' : '🔴 বন্ধ'}
📝 <b>টাস্ক টাইটেল:</b> ${escapeHtml(settings.extraTaskTitle || 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন')}
🔗 <b>ইউটিউব লিংক:</b> <code>${settings.extraTaskUrl || 'সেট করা হয়নি'}</code>
━━━━━━━━━━━━━━━━━━━━━━
🛡️ <b>কনটেন্ট প্রোটেকশন (ফরওয়ার্ড/সেভ ব্লক):</b> ${settings.protectContent ? '🟢 চালু' : '🔴 বন্ধ'}
💎 <b>টপ-আপ ওয়েবসাইট:</b> NoobTopUp.com
━━━━━━━━━━━━━━━━━━━━━━
💡 <b>কমান্ড দিয়ে পরিবর্তনের নিয়ম:</b>
• চ্যানেল সেট করতে: <code>/setchannel @username</code> (বা চ্যানেল পোস্ট Forward করুন)
• ইনভাইট লিংক: <code>/setinvite https://t.me/+xxxx</code>
• ইউটিউব লিংক: <code>/setyoutube https://youtube.com/@channel</code>
• টাস্কের নাম বদলাতে: <code>/settasktitle আপনার টাইটেল</code>
• একাধিক ফাইলের ১টি ব্যাচ লিংক বানাতে: <code>/batch 101 102</code>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(settings.forceSubEnabled ? '🔒 ফোর্স সাব: [বন্ধ করুন]' : '🔓 ফোর্স সাব: [চালু করুন]', 'toggle_forcesub'),
      Markup.button.callback(settings.extraTaskEnabled ? '🔴 ইউটিউব টাস্ক: [বন্ধ করুন]' : '🔴 ইউটিউব টাস্ক: [চালু করুন]', 'toggle_extratask')
    ],
    [
      Markup.button.callback(settings.protectContent ? '🛡️ ফরওয়ার্ড ব্লক: [বন্ধ করুন]' : '🛡️ ফরওয়ার্ড ব্লক: [চালু করুন]', 'toggle_protect'),
      Markup.button.callback('🧪 লক স্ক্রিন টেস্ট', 'test_lock_screen')
    ],
    [
      Markup.button.callback('🔙 এডমিন ড্যাশবোর্ড', 'back_to_admin')
    ]
  ]);

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
  } else {
    return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  }
}

bot.action('admin_settings', async (ctx) => {
  await ctx.answerCbQuery();
  return renderAdminSettings(ctx);
});

bot.action('toggle_forcesub', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const current = db.getSettings();
  db.updateSettings({ forceSubEnabled: !current.forceSubEnabled });
  return renderAdminSettings(ctx);
});

bot.action('toggle_extratask', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const current = db.getSettings();
  db.updateSettings({ extraTaskEnabled: !current.extraTaskEnabled });
  return renderAdminSettings(ctx);
});

bot.action('toggle_protect', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const current = db.getSettings();
  db.updateSettings({ protectContent: !current.protectContent });
  return renderAdminSettings(ctx);
});

bot.action('test_lock_screen', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const allFiles = db.getAllFiles();
  const sampleFile = allFiles[0] || { key: 'file_test', fileName: 'FreeFire_VIP_Config.zip', fileSize: '3.59 MB', downloads: 12 };
  return sendLockScreen(ctx, sampleFile, true);
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

  // If Admin uploads a file/document/video/audio
  const mediaObj = ctx.message.document || ctx.message.video || ctx.message.audio;
  if (userIsAdmin && mediaObj) {
    const rawSize = mediaObj.file_size || 0;
    const fileSize = formatBytes(rawSize);
    let defaultName = `File_${Date.now()}`;
    if (ctx.message.video) defaultName = `Video_${Date.now()}.mp4`;
    else if (ctx.message.audio) defaultName = `Audio_${Date.now()}.mp3`;
    const fileName = mediaObj.file_name || defaultName;

    const newFile = db.addFile({
      telegramFileId: mediaObj.file_id,
      fileName: fileName,
      fileSize: fileSize,
      rawSize: rawSize,
      mimeType: mediaObj.mime_type
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
এই লিংকটি সরাসরি আপনার ইউটিউব ভিডিওর ডেসক্রিপশনে দিয়ে দিন!
(একাধিক ফাইল ১টি লিংকে দিতে চাইলে লিখুন: <code>/batch ${newFile.key.replace('file_', '')} ...</code>)`;

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

// --- Auto Channel Detection (বটকে চ্যানেলে এডমিন করলে স্বয়ংক্রিয় কানেক্ট) ---
bot.on('my_chat_member', async (ctx) => {
  try {
    const chat = ctx.myChatMember.chat;
    const newStatus = ctx.myChatMember.new_chat_member.status;
    if (chat && chat.type === 'channel' && ['administrator', 'creator'].includes(newStatus)) {
      const channelId = chat.id.toString();
      const channelTitle = chat.title || 'অফিসিয়াল চ্যানেল';
      let inviteLink = chat.invite_link;
      if (!inviteLink && chat.username) {
        inviteLink = `https://t.me/${chat.username}`;
      }

      db.updateSettings({
        channelId,
        channelTitle,
        ...(inviteLink ? { channelInviteLink: inviteLink } : {})
      });

      console.log(`🎉 Auto-detected channel admin: ${channelTitle} (${channelId})`);
      await bot.telegram.sendMessage(SOLE_OWNER_ID, `🎉 <b>চ্যানেল স্বয়ংক্রিয়ভাবে কানেক্ট হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📢 <b>চ্যানেল:</b> ${escapeHtml(channelTitle)}\n🆔 <b>চ্যানেল আইডি:</b> <code>${channelId}</code>\n🔗 <b>ইনভাইট লিংক:</b> ${inviteLink || db.getSettings().channelInviteLink}\n\n✅ <b>কাউন্টিং ও ফোর্স সাবস্ক্রিপশন সক্রিয় হয়েছে!</b>`, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('my_chat_member error:', e.message);
  }
});

// Auto-detect channel from channel posts
bot.on('channel_post', async (ctx) => {
  try {
    const chat = ctx.channelPost.chat;
    if (chat && chat.type === 'channel') {
      const channelId = chat.id.toString();
      const channelTitle = chat.title || 'অফিসিয়াল চ্যানেল';
      const current = db.getSettings();
      if (!current.channelId || current.channelId !== channelId) {
        db.updateSettings({ channelId, channelTitle });
        console.log(`📌 Detected channel_post from ${channelTitle} (${channelId})`);
      }
    }
  } catch (e) {}
});

// --- Channel & Task Setup Commands ---
bot.command('setchannel', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const input = ctx.message.text.replace('/setchannel', '').trim();
  if (!input) {
    return ctx.reply('⚠️ ব্যবহারের নিয়ম:\n<code>/setchannel -100xxxxxxxxxx</code>\nঅথবা\n<code>/setchannel @আপনারচ্যানেলইউজারনেম</code>\n\n(অথবা আপনার চ্যানেল থেকে যেকোনো একটি মেসেজ এখানে <b>Forward</b> করে পাঠিয়ে দিন)');
  }

  try {
    const chat = await bot.telegram.getChat(input);
    db.updateSettings({
      channelId: chat.id.toString(),
      channelTitle: chat.title || 'অফিসিয়াল চ্যানেল',
      ...(chat.invite_link ? { channelInviteLink: chat.invite_link } : {})
    });
    return ctx.reply(`✅ <b>চ্যানেল সফলভাবে সেট হয়েছে!</b>\n\n📢 <b>নাম:</b> ${escapeHtml(chat.title)}\n🆔 <b>আইডি:</b> <code>${chat.id}</code>`, { parse_mode: 'HTML' });
  } catch (err) {
    db.updateSettings({ channelId: input });
    return ctx.reply(`✅ চ্যানেল আইডি <code>${input}</code> সেভ করা হয়েছে!\n⚠️ নিশ্চিত করুন বটটি চ্যানেলে <b>Admin</b> হিসেবে যুক্ত আছে।`, { parse_mode: 'HTML' });
  }
});

bot.command('setyoutube', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const url = ctx.message.text.replace('/setyoutube', '').trim();
  if (!url) {
    return ctx.reply('⚠️ ব্যবহারের নিয়ম:\n<code>/setyoutube https://youtube.com/@আপনারচ্যানেল</code>');
  }
  db.updateSettings({
    extraTaskEnabled: true,
    extraTaskUrl: url
  });
  return ctx.reply(`✅ <b>ইউটিউব টাস্ক লিংক সফলভাবে সেট হয়েছে!</b>\n\n🔗 <code>${url}</code>`, { parse_mode: 'HTML' });
});

bot.command('setinvite', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const link = ctx.message.text.replace('/setinvite', '').trim();
  if (!link) {
    return ctx.reply('⚠️ ব্যবহারের নিয়ম:\n<code>/setinvite https://t.me/+xxxxxx</code>');
  }
  db.updateSettings({ channelInviteLink: link });
  return ctx.reply(`✅ <b>চ্যানেল ইনভাইট লিংক সফলভাবে সেট হয়েছে!</b>\n\n🔗 <code>${link}</code>`, { parse_mode: 'HTML' });
});

bot.command('settasktitle', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const title = ctx.message.text.replace('/settasktitle', '').trim();
  if (!title) {
    return ctx.reply('⚠️ ব্যবহারের নিয়ম:\n<code>/settasktitle ইউটিউব চ্যানেল সাবস্ক্রাইব করুন</code>');
  }
  db.updateSettings({ extraTaskTitle: title });
  return ctx.reply(`✅ <b>টাস্কের নাম পরিবর্তন সম্পন্ন!</b>\n\n📝 <b>নতুন নাম:</b> ${escapeHtml(title)}`, { parse_mode: 'HTML' });
});

bot.command('batch', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const args = ctx.message.text.replace('/batch', '').trim().split(/\s+/).filter(Boolean);
  if (args.length < 2) {
    return ctx.reply(`⚠️ ব্যবহারের নিয়ম:\n<code>/batch 101 102</code>\nঅথবা\n<code>/batch file_101 file_102 file_103</code>\n\n💡 একাধিক ফাইলকে ১টি ডাউনলোড লিংকে লক করতে এই কমান্ড ব্যবহার করুন।`);
  }

  const validKeys = [];
  const validFiles = [];
  for (const arg of args) {
    const file = db.getFile(arg);
    if (file) {
      validKeys.push(file.key.replace('file_', ''));
      validFiles.push(file);
    }
  }

  if (validKeys.length < 2) {
    return ctx.reply('⚠️ কমপক্ষে ২টি সঠিক ফাইল নম্বর দিন। যেমন: <code>/batch 101 102</code>');
  }

  const batchKey = `batch_${validKeys.join('_')}`;
  const batchUrl = `https://t.me/${botInfo.username}?start=${batchKey}`;

  const listStr = validFiles.map((f, i) => `${i + 1}. ${escapeHtml(f.fileName)} (${f.fileSize})`).join('\n');

  return ctx.reply(`🎁 <b>ব্যাচ ফাইল লিংক তৈরি সম্পন্ন হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>অন্তর্ভুক্ত ফাইলসমূহ (${validFiles.length}টি):</b>
${listStr}
━━━━━━━━━━━━━━━━━━━━━━
🔗 <b>শেয়ার করার লিংক:</b>
<code>${batchUrl}</code> <i>(ট্যাপ করে কপি করুন)</i>

💡 <i>এই ১টি লিংকেই ভিউয়ার সকল ফাইল পেয়ে যাবে!</i>`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('টেস্ট লিংক ওপেন করুন 🚀', batchUrl)]
    ])
  });
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

let isRunning = true;

async function startPollingWithRetry(maxRetries = 15, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxRetries && isRunning; attempt++) {
    try {
      console.log(`🚀 Starting Telegram polling (Attempt ${attempt}/${maxRetries})...`);
      await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
      await bot.launch();
      console.log('✅ Telegram Polling is active and running!');
      break;
    } catch (err) {
      console.error(`❌ Polling attempt ${attempt} error:`, err.message);
      if (attempt < maxRetries && isRunning) {
        console.log(`⏳ Waiting ${delayMs / 1000}s for previous instance handover...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

startPollingWithRetry();

// Graceful stop
process.once('SIGINT', () => {
  isRunning = false;
  server.close();
  try { bot.stop('SIGINT'); } catch (e) {}
});
process.once('SIGTERM', () => {
  isRunning = false;
  server.close();
  try { bot.stop('SIGTERM'); } catch (e) {}
});

