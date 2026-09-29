const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'locker_data.json');

const defaultData = {
  lastFileNumber: 100,
  files: {}, // 'file_101' -> { id, telegramFileId, fileName, fileSize, rawSize, downloads, createdAt }
  users: {}, // userId -> { id, name, username, joinedAt, downloadsCount, lastActive }
  settings: {
    adminChatId: process.env.ADMIN_CHAT_ID || '7553569630',
    channelId: process.env.CHANNEL_ID || '', // -100xxxxxxxxxx
    channelTitle: 'অফিসিয়াল চ্যানেল',
    channelInviteLink: process.env.CHANNEL_INVITE_LINK || 'https://t.me/+0Pio7JsMT_s5MTZl',
    forceSubEnabled: true,
    adsgramBlockId: process.env.ADSGRAM_BLOCK_ID || 'bot-50561',
    adEnabled: true,
    adTitle: '🎁 স্পনসরড প্রমোশন (Sponsor Offer)',
    adText: '💎 সবচেয়ে কমদামে ডায়মন্ড ও মেম্বারশিপ পেতে আমাদের অফিসিয়াল শপ ভিজিট করুন!',
    adButtonText: '🛍️ ওবিন শপ থেকে ডায়মন্ড নিন',
    adButtonUrl: 'https://t.me/ObinShop_Bot'
  }
};

class LockerDatabase {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(content);
        return {
          ...defaultData,
          ...parsed,
          settings: { ...defaultData.settings, ...(parsed.settings || {}) }
        };
      }
    } catch (err) {
      console.error('Error loading locker database, using defaults:', err.message);
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving locker database:', err.message);
    }
  }

  // --- User Logging ---
  logUser(user) {
    const userId = user.id.toString();
    const now = new Date().toISOString();

    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        id: userId,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        username: user.username ? `@${user.username}` : null,
        joinedAt: now,
        downloadsCount: 0,
        lastActive: now
      };
    } else {
      this.data.users[userId].lastActive = now;
      if (user.first_name) {
        this.data.users[userId].name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      }
      if (user.username) {
        this.data.users[userId].username = `@${user.username}`;
      }
    }
    this.save();
    return this.data.users[userId];
  }

  getAllUserIds() {
    return Object.keys(this.data.users);
  }

  getTotalUsersCount() {
    return Object.keys(this.data.users).length;
  }

  getRecentUsers(limit = 10) {
    return Object.values(this.data.users)
      .sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0))
      .slice(0, limit);
  }

  // --- File Storage ---
  addFile(fileData) {
    this.data.lastFileNumber += 1;
    const fileKey = `file_${this.data.lastFileNumber}`;

    const newFile = {
      key: fileKey,
      telegramFileId: fileData.telegramFileId,
      fileName: fileData.fileName || `File_${this.data.lastFileNumber}`,
      fileSize: fileData.fileSize || 'N/A',
      rawSize: fileData.rawSize || 0,
      mimeType: fileData.mimeType || 'application/octet-stream',
      downloads: 0,
      createdAt: new Date().toISOString()
    };

    this.data.files[fileKey] = newFile;
    this.save();
    return newFile;
  }

  getFile(fileKey) {
    return this.data.files[fileKey] || null;
  }

  getAllFiles() {
    return Object.values(this.data.files).reverse();
  }

  incrementDownload(fileKey, userId) {
    if (this.data.files[fileKey]) {
      this.data.files[fileKey].downloads = (this.data.files[fileKey].downloads || 0) + 1;
    }
    const uid = userId.toString();
    if (this.data.users[uid]) {
      this.data.users[uid].downloadsCount = (this.data.users[uid].downloadsCount || 0) + 1;
    }
    this.save();
  }

  deleteFile(fileKey) {
    if (this.data.files[fileKey]) {
      delete this.data.files[fileKey];
      this.save();
      return true;
    }
    return false;
  }

  // --- Settings ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings
    };
    this.save();
    return this.data.settings;
  }
}

module.exports = new LockerDatabase();
