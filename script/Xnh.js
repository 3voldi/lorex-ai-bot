const axios = require('axios');

// === FONT STYLING FUNCTION ===
function convertToBold(text) {
  const boldMap = {
    'a': '𝗮','b': '𝗯','c': '𝗰','d': '𝗱','e': '𝗲','f': '𝗳','g': '𝗴','h': '𝗵','i': '𝗶','j': '𝗷',
    'k': '𝗸','l': '𝗹','m': '𝗺','n': '𝗻','o': '𝗼','p': '𝗽','q': '𝗾','r': '𝗿','s': '𝘀','t': '𝘁',
    'u': '𝘂','v': '𝘃','w': '𝘄','x': '𝘅','y': '𝘆','z': '𝘇',
    'A': '𝗔','B': '𝗕','C': '𝗖','D': '𝗗','E': '𝗘','F': '𝗙','G': '𝗚','H': '𝗛','I': '𝗜','J': '𝗝',
    'K': '𝗞','L': '𝗟','M': '𝗠','N': '𝗡','O': '𝗢','P': '𝗣','Q': '𝗤','R': '𝗥','S': '𝗦','T': '𝗧',
    'U': '𝗨','V': '𝗩','W': '𝗪','X': '𝗫','Y': '𝗬','Z': '𝗭',
  };
  return text.split('').map(c => boldMap[c] || c).join('');
}

// === PLANS ===
const plans = {
  0: { name: 'Free Plan', usageLimit: 3, durationDays: 4 },
  1: { name: 'Plan 10', usageLimit: 10, durationDays: 30 },
  2: { name: 'Plan 50', usageLimit: 50, durationDays: 30 },
  3: { name: 'Plan 100', usageLimit: 100, durationDays: 30 },
  4: { name: 'Daily Plan', usageLimit: 5, durationDays: 1 },
  5: { name: 'Plan 300', usageLimit: 300, durationDays: 30 },
  6: { name: 'Promo Express 5', usageLimit: 4000, durationDays: 30 },
  7: { name: 'Promo Plan 1000', usageLimit: 1000, durationDays: 30 },
  8: { name: 'Promo Plan 6000', usageLimit: 6000, durationDays: 30 },
};

// === GLOBAL STORAGE ===
let userUsage = {}; // userID -> {used, limit, plan, planExpiry, key, keyUsedCount, name}
let bannedUsers = new Set();
let usedKeys = new Set(); // one-time use keys that are used
if (!global.keysDB) global.keysDB = {}; // keys storage (key -> plan info)
const badWords = ['bobo','tanga','gago','ulol','pakyu','puke','putangina','puta','kantot','fuckyou','];
const usageStats = { fast: [], medium: [], slow: [], };
const UPTIME_LIMIT_MINUTES = 300; // 5 hours
let uptimeStartedAt = Date.now();

// === ADMIN AND LOCK SYSTEM ===
if (!global.adminIDs) global.adminIDs = []; // Array of admin user IDs
if (!global.isLocked) global.isLocked = false; // Lock status for admin-only use

// === LOGS ===
const logs = {
  keyLog: [], // {time, userName, userID, key}
  planLog: [], // {time, userName, userID, planNumber, planName}
  genKeyLog: [], // {time, userName, userID, key, planNumber}
};

// === HELPERS ===
function getResponseCategory(ms) {
  if (ms <= 1000) return 'fast';
  if (ms <= 3000) return 'medium';
  return 'slow';
}

function getUptimeLeft() {
  const elapsed = Math.floor((Date.now() - uptimeStartedAt) / 60000);
  const remaining = Math.max(UPTIME_LIMIT_MINUTES - elapsed, 0);
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return `${h}h ${m}m`;
}

function getCurrentTime() {
  return new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

async function sendTemp(api, threadID, message) {
  return new Promise(resolve => {
    api.sendMessage(message, threadID, (err, info) => resolve(info));
  });
}

function generateKey(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format key as XXXX-XXXX-XXXX-XXXX
  return key.match(/.{1,4}/g).join('-');
}

function addLog(type, logObj) {
  if (type === 'key') logs.keyLog.push(logObj);
  else if (type === 'plan') logs.planLog.push(logObj);
  else if (type === 'genkey') logs.genKeyLog.push(logObj);
}

function isAdmin(uid) {
  return global.adminIDs.includes(uid);
}

// === MODULE CONFIG ===
module.exports.config = {
  name: 'nov4',
  version: '2.0.1',
  hasPermission: 0,
  usePrefix: true,
  aliases: ['nova', 'supernova', 'sn'],
  description: "AI command with key login, reset, ban, usage limit, dashboard, logs, admin lock, and promo plans",
  usages: "nova [command or prompt]",
  credits: 'LorexAi + SwordSlush + ChatGPT',
  cooldowns: 0,
};

// === RUN FUNCTION ===
module.exports.run = async function({ api, event, args }) {
  const uid = event.senderID;
  const threadID = event.threadID;
  const messageID = event.messageID;
  const input = args.join(' ').trim();
  const command = args[0]?.toLowerCase();

  // --- ADMIN LOCK CHECK ---
  if (global.isLocked && !isAdmin(uid)) {
    return api.sendMessage(
      "🔒 Bot is locked. Only admins can use Nova.\nContact an admin to unlock.",
      threadID, messageID
    );
  }

  // Initialize user usage record if not exist
  if (!userUsage[uid]) {
    userUsage[uid] = {
      used: 0,
      limit: plans[0].usageLimit,
      plan: 0,
      planExpiry: Date.now() + plans[0].durationDays * 24*60*60*1000,
      key: null,
      keyUsedCount: 0,
      name: event.senderName || `User_${uid}`,
    };
  }
  const user = userUsage[uid];

  // --- COMMANDS ONLY RUN IF PREFIX IS 'nova' ---
  // Assuming this command handler runs only on 'nova' prefix, so no extra check needed

  // --- HANDLE RESET ---
  if (command === 'reset') {
    userUsage[uid] = {
      used: 0,
      limit: plans[0].usageLimit,
      plan: 0,
      planExpiry: Date.now() + plans[0].durationDays * 24*60*60*1000,
      key: null,
      keyUsedCount: 0,
      name: user.name,
    };
    uptimeStartedAt = Date.now();
    return api.sendMessage(
      "✅ Usage and plan reset to Free Plan.\n🔄 Uptime reset.\n🔑 Your login key has been invalidated.",
      threadID, messageID
    );
  }

  // --- BANNED USERS ---
  if (bannedUsers.has(uid)) {
    return api.sendMessage(
      "❌ You are banned for inappropriate language.\n🔄 Type 'nova reset' to unban.",
      threadID, messageID
    );
  }

  // --- BAD WORD FILTER ---
  const lowerInput = input.toLowerCase();
  if (badWords.some(w => lowerInput.includes(w))) {
    bannedUsers.add(uid);
    return api.sendMessage(
      "🚫 Inappropriate language detected. You are now banned.\n🔄 Type 'nova reset' to unban.",
      threadID, messageID
    );
  }

  // --- CHECK UPTIME ---
  const elapsedMin = Math.floor((Date.now() - uptimeStartedAt)/60000);
  const uptimeLeft = Math.max(UPTIME_LIMIT_MINUTES - elapsedMin, 0);
  if (uptimeLeft <= 0) {
    return api.sendMessage(
      "🚫 AI is offline. Uptime ended.\nUse 'nova reset' to restart uptime.",
      threadID, messageID
    );
  }

  // --- LOCK BOT (ADMIN ONLY OR ANY IF NO ADMINS) ---
  if (command === 'lock' && args[1] === 'on') {
    if (global.adminIDs.length === 0 || isAdmin(uid)) {
      global.isLocked = true;
      return api.sendMessage(
        "🔒 Bot locked successfully. Only admins can now use Nova.",
        threadID, messageID
      );
    } else {
      return api.sendMessage("❌ Only admins can lock the bot.", threadID, messageID);
    }
  }

  // --- UNLOCK BOT (ADMIN ONLY) ---
  if (command === 'lock' && args[1] === 'off') {
    if (isAdmin(uid)) {
      global.isLocked = false;
      return api.sendMessage(
        "🔓 Bot unlocked successfully. All users can now use Nova.",
        threadID, messageID
      );
    } else {
      return api.sendMessage("❌ Only admins can unlock the bot.", threadID, messageID);
    }
  }

  // --- ADD ADMIN ---
  if (command === 'addadmin') {
    const targetID = args[1];
    if (!targetID) {
      return api.sendMessage("❌ Please provide a user ID. Usage: nova addadmin <userID>", threadID, messageID);
    }
    if (global.adminIDs.length === 0 || isAdmin(uid)) {
      if (!global.adminIDs.includes(targetID)) {
        global.adminIDs.push(targetID);
        return api.sendMessage(`✅ Added ${targetID} as admin.`, threadID, messageID);
      } else {
        return api.sendMessage("❌ User is already an admin.", threadID, messageID);
      }
    } else {
      return api.sendMessage("❌ Only admins can add other admins.", threadID, messageID);
    }
  }

  // --- REMOVE ADMIN ---
  if (command === 'removeadmin') {
    const targetID = args[1];
    if (!targetID) {
      return api.sendMessage("❌ Please provide a user ID. Usage: nova removeadmin <userID>", threadID, messageID);
    }
    if (isAdmin(uid)) {
      const index = global.adminIDs.indexOf(targetID);
      if (index > -1) {
        global.adminIDs.splice(index, 1);
        return api.sendMessage(`✅ Removed ${targetID} from admins.`, threadID, messageID);
      } else {
        return api.sendMessage("❌ User is not an admin.", threadID, messageID);
      }
    } else {
      return api.sendMessage("❌ Only admins can remove admins.", threadID, messageID);
    }
  }

  // --- LIST ADMINS ---
  if (command === 'admins') {
    if (global.adminIDs.length === 0) {
      return api.sendMessage("👥 No admins set.", threadID, messageID);
    }
    return api.sendMessage(`👥 Admins: ${global.adminIDs.join(', ')}`, threadID, messageID);
  }

  // --- LOGIN WITH KEY ---
  if (command === 'login') {
    const key = args[1]?.toUpperCase();
    if (!key) {
      return api.sendMessage("❌ Please provide a key. Usage: nova login <KEY>", threadID, messageID);
    }
    const keyData = global.keysDB[key];
    if (!keyData) {
      return api.sendMessage("❌ Invalid key.", threadID, messageID);
    }
    if (keyData.oneTimeUse && usedKeys.has(key)) {
      return api.sendMessage("❌ This key is one-time use and already used.", threadID, messageID);
    }
    // Apply plan and usage limits from key
    user.limit = keyData.usageLimit;
    user.used = 0;
    user.plan = keyData.planNumber;
    user.planExpiry = Date.now() + keyData.durationDays*24*60*60*1000;
    user.key = key;
    user.keyUsedCount = 0;
    if (keyData.oneTimeUse) usedKeys.add(key);
    // Log the key login
    addLog('key', { time: getCurrentTime(), userName: user.name, userID: uid, key });
    const isPromoLogin = keyData.planNumber >= 6;
    return api.sendMessage(
      `✅ ${convertToBold("Successfully Logged In!")}\n━━━━━━━━━━━━━━━━━━━━━\n🔑 ${convertToBold("Key")}: ${key}\n💼 ${convertToBold("Plan")}: ${plans[keyData.planNumber].name}${isPromoLogin ? ' 🔥 PROMO' : ''}\n🔢 ${convertToBold("Usage Limit")}: ${keyData.usageLimit}${isPromoLogin ? ' 🔥' : ''}\n⏳ ${convertToBold("Expires In")}: ${keyData.durationDays} day(s)${isPromoLogin ? ' 🔥' : ''}\n━━━━━━━━━━━━━━━━━━━━━`,
      threadID, messageID
    );
  }

  // --- GENERATE KEY (ANY USER CAN GENERATE) ---
  if (command === 'generate' && args[1] === 'key') {
    const planNumber = Number(args[2]);
    const usageLimit = Number(args[3]);
    const durationDays = Number(args[4]);
    const oneTimeUse = args[5] === 'true';
    if (!plans[planNumber]) {
      return api.sendMessage(`❌ Invalid plan number. Available: ${Object.keys(plans).join(', ')}`, threadID, messageID);
    }
    if (!usageLimit || usageLimit <= 0) {
      return api.sendMessage("❌ Usage limit must be a positive number.", threadID, messageID);
    }
    if (!durationDays || durationDays <= 0) {
      return api.sendMessage("❌ Duration days must be a positive number.", threadID, messageID);
    }
    const newKey = generateKey();
    global.keysDB[newKey] = { planNumber, usageLimit, durationDays, oneTimeUse: !!oneTimeUse, };
    // Log key generation
    addLog('genkey', { time: getCurrentTime(), userName: user.name, userID: uid, key: newKey, planNumber });
    const isPromoGen = planNumber >= 6;
    return api.sendMessage(
      `🎉 ${convertToBold("Key Generated Successfully!")}\n━━━━━━━━━━━━━━━━━━━━━\n🔑 ${convertToBold("Key")}: ${newKey}\n💼 ${convertToBold("Plan")}: ${plans[planNumber].name}${isPromoGen ? ' 🔥 PROMO' : ''}\n🔢 ${convertToBold("Usage Limit")}: ${usageLimit}${isPromoGen ? ' 🔥' : ''}\n⏳ ${convertToBold("Duration")}: ${durationDays} days${isPromoGen ? ' 🔥' : ''}\n🔒 ${convertToBold("One-Time Use")}: ${oneTimeUse ? "Yes" : "No"}\n━━━━━━━━━━━━━━━━━━━━━\n💡 Use: nova login ${newKey}`,
      threadID, messageID
    );
  }

  // --- CHECK PLAN EXPIRY ---
  if (Date.now() > user.planExpiry) {
    return api.sendMessage(
      `❌ Your plan (${plans[user.plan].name}) expired.\nPlease login with a key or buy a plan.`,
      threadID, messageID
    );
  }

  // --- CHECK USAGE LIMIT ---
  if (user.used >= user.limit) {
    return api.sendMessage(
      `⚠️ Usage limit reached for plan (${plans[user.plan].name}).\nPlease upgrade or buy a plan.`,
      threadID, messageID
    );
  }

  // --- SHOW PLANS ---
  if (command === 'plans') {
    let msg = `${convertToBold('💼 AVAILABLE PLANS')}:\n━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const [k, v] of Object.entries(plans)) {
      const isPromoPlan = k >= 6;
      const planEmoji = isPromoPlan ? '🔥' : '🅿️';
      msg += `${planEmoji} ${convertToBold(`Plan ${k}`)}: ${v.name}${isPromoPlan ? ' 🎉 PROMO EXPRESS' : ''}\n`;
      msg += `   🔢 ${convertToBold('Usage Limit')}: ${v.usageLimit}${isPromoPlan ? ' 🔥' : ''}\n`;
      msg += `   ⏳ ${convertToBold('Duration')}: ${v.durationDays} days${isPromoPlan ? ' 🔥' : ''}\n\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n💡 ${convertToBold('Buy a Plan')}: nova buy plan [plan number]\nExample: nova buy plan 1`;
    return api.sendMessage(msg, threadID, messageID);
  }

  // --- BUY PLAN ---
  if (command === 'buy' && args[1] === 'plan') {
    const planNumber = args[2];
    if (!plans[planNumber]) {
      return api.sendMessage(`❌ Plan ${planNumber} does not exist. Type 'nova plans'`, threadID, messageID);
    }
    user.limit = plans[planNumber].usageLimit;
    user.used = 0;
    user.plan = planNumber;
    user.planExpiry = Date.now() + plans[planNumber].durationDays * 24*60*60*1000;
    user.key = null; // clear key when buying plan
    user.keyUsedCount = 0;
    // Log plan purchase
    addLog('plan', { time: getCurrentTime(), userName: user.name, userID: uid, planNumber, planName: plans[planNumber].name });
    const isPromoBuy = planNumber >= 6;
    return api.sendMessage(
      `✅ ${convertToBold('Purchased Successfully!')} 🎉\n━━━━━━━━━━━━━━━━━━━━━\n💼 ${convertToBold('Plan')}: ${plans[planNumber].name}${isPromoBuy ? ' 🔥 PROMO EXPRESS' : ''}\n🔢 ${convertToBold('Usage Limit')}: ${plans[planNumber].usageLimit}${isPromoBuy ? ' 🔥' : ''}\n⏳ ${convertToBold('Valid For')}: ${plans[planNumber].durationDays} days${isPromoBuy ? ' 🔥' : ''}\n━━━━━━━━━━━━━━━━━━━━━`,
      threadID, messageID
    );
  }

  // --- NO PROMPT ---
  if (!input) {
    return api.sendMessage("❓ Enter a prompt to ask Nova AI.", threadID, messageID);
  }

  // --- PROCESS AI PROMPT ---
  const tempMsg = await sendTemp(api, threadID, "🔍 Processing...");
  try {
    const startTime = Date.now();
    const response = await axios.get('https://betadash-api-swordslush-production.up.railway.app/Llama70b', {
      params: { ask: input, uid }
    });
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    const category = getResponseCategory(elapsed);
    const kmNumber = usageStats[category].length + 1;
    usageStats[category].push({ user: uid, ms: elapsed, km: kmNumber });
    user.used++;
    user.keyUsedCount++;
    const timeNow = getCurrentTime();
    const uptimeLeftStr = getUptimeLeft();
    const fastCount = usageStats.fast.length;
    const mediumCount = usageStats.medium.length;
    const slowCount = usageStats.slow.length;
    const daysLeft = Math.max(0, Math.floor((user.planExpiry - Date.now())/(1000*60*60*24)));
    const isPromo = plans[user.plan].name.includes('Promo');
    // Enhanced Dashboard with better design, emojis, and bold
    const dashboard = `━━━━━━━━━━━━━━━━━━━━━\n` +
                      `📊 ${convertToBold("FAST")}: ${fastCount} 🚀 km\n` +
                      `⚖️ ${convertToBold("MEDIUM")}: ${mediumCount} ⚡ km\n` +
                      `🐢 ${convertToBold("SLOW")}: ${slowCount} 🐌 km\n` +
                      `⏱️ ${convertToBold("Uptime Left")}: ${uptimeLeftStr}\n` +
                      `📅 ${convertToBold("Date & Time")}: ${timeNow}\n` +
                      `💼 ${convertToBold("Current Plan")}: ${plans[user.plan].name}${isPromo ? ' 🔥 PROMO EXPRESS' : ''}\n` +
                      `👤 ${convertToBold("User")}: ${user.name}${isPromo ? ' 🔥' : ''}\n` +
                      `🔢 ${convertToBold("Usage")}: ${user.used}/${user.limit}${isPromo ? ' 🔥 PROMO EXPRESS' : ''}\n` +
                      `⌛ ${convertToBold("Plan Expires In")}: ${daysLeft} day(s)${isPromo ? ' 🔥' : ''}\n` +
                      (user.key ? `🔑 ${convertToBold("Key Login")}: ${user.key}\n` +
                      `🗝️ ${convertToBold("Key Used")}: ${user.keyUsedCount}` : '') +
                      `\n━━━━━━━━━━━━━━━━━━━━━`;
    return api.sendMessage(
      `${response.data.response}\n\n${dashboard}`,
      threadID, tempMsg.messageID
    );
  } catch (e) {
    return api.sendMessage(
      "❌ Error contacting AI server. Please try again later.",
      threadID, messageID
    );
  }
};
