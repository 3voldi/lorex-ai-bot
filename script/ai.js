const axios = require('axios');

function convertToBold(text) {
  const boldMap = {
    'a': '𝗮','b': '𝗯','c': '𝗰','d': '𝗱','e': '𝗲','f': '𝗳','g': '𝗴','h': '𝗵','i': '𝗶','j': '𝗷',
    'k': '𝗸','l': '𝗹','m': '𝗺','n': '𝗻','o': '𝗼','p': '𝗽','q': '𝗾','r': '𝗿','s': '𝘀','t': '𝘁',
    'u': '𝘂','v': '𝘃','w': '𝘄','x': '𝘅','y': '𝘆','z': '𝘇',
    'A': '𝗔','B': '𝗕','C': '𝗖','D': '𝗗','E': '𝗘','F': '𝗙','G': '𝗚','H': '𝗛','I': '𝗜','J': '𝗝',
    'K': '𝗞','L': '𝗟','M': '𝗠','N': '𝗡','O': '𝗢','P': '𝗣','Q': '𝗤','R': '𝗥','S': '𝗦','T': '𝗧',
    'U': '𝗨','V': '𝗩','W': '𝗪','X': '𝗫','Y': '𝗬','Z': '𝗭',
  };
  return text.split('').map(char => boldMap[char] || char).join('');
}

const responseOpeners = [
  "🤖𝙂𝙋𝙏 𝘼𝙎𝙎𝙄𝙎𝙏𝘼𝙉𝙏"
];

module.exports.config = {
  name: 'messandra',
  version: '1.2.1',
  hasPermission: 0,
  usePrefix: false,
  aliases: ['messandra', 'lorex'],
  description: "An AI command powered by GPT-5 + Gemini Vision",
  usages: "ai [prompt]",
  credits: 'LorexAi',
  cooldowns: 0
};

async function sendTemp(api, threadID, message) {
  return new Promise((resolve, reject) => {
    api.sendMessage(message, threadID, (err, info) => {
      if (err) return reject(err);
      resolve(info);
    });
  });
}

module.exports.run = async function({ api, event, args }) {
  const input = args.join(' ');
  const uid = event.senderID;
  const threadID = event.threadID;
  const messageID = event.messageID;

  // === IMAGE HANDLING (Gemini Vision via Ary Chauhan Proxy API) ===
  const isPhotoReply = event.type === "message_reply"
    && Array.isArray(event.messageReply?.attachments)
    && event.messageReply.attachments.some(att => att.type === "photo");

  if (isPhotoReply) {
    const photoUrl = event.messageReply.attachments?.[0]?.url;
    if (!photoUrl) return api.sendMessage("❌ Could not get image URL.", threadID, messageID);
    if (!input) return api.sendMessage("📸 Please provide a prompt along with the image.", threadID, messageID);

    const tempMsg = await sendTemp(api, threadID, "🔍 Analyzing image...");

    try {
      const { data } = await axios.get('http://65.109.80.126:20409/aryan/gemini', {
        params: {
          prompt: input,
          imgUrl: photoUrl
        }
      });

      if (data?.result) {
        const opener = responseOpeners[Math.floor(Math.random() * responseOpeners.length)];
        return api.editMessage(`${opener}\n\n${data.result}`, tempMsg.messageID, threadID);
      }

      return api.editMessage("⚠️ Unexpected response from Gemini Vision API.", tempMsg.messageID, threadID);
    } catch (err) {
      console.error(err);
      return api.editMessage("❌ Error analyzing image.", tempMsg.messageID, threadID);
    }
  }

  // === GPT-5 TEXT MODE ===
  if (!input) return api.sendMessage("❌ Paki‑type ang prompt mo.\n\nExample: messandra what is love?", threadID, messageID);

  const tempMsg = await sendTemp(api, threadID, "⏳GPT-5 GENERATING....");

  try {
    const { data } = await axios.get('https://daikyu-api.up.railway.app/api/gpt-5', {
      params: {
        ask: input,
        uid: uid
      }
    });

    if (!data?.response) {
      return api.editMessage("❌ No response received. Try again.", tempMsg.messageID, threadID);
    }

    const formatted = data.response
      .replace(/\*\*(.*?)\*\*/g, (_, t) => convertToBold(t))
      .replace(/##(.*?)##/g, (_, t) => convertToBold(t))
      .replace(/###\s*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const opener = responseOpeners[Math.floor(Math.random() * responseOpeners.length)];
    return api.editMessage(`${opener}\n\n${formatted}`, tempMsg.messageID, threadID);

  } catch (err) {
    console.error(err);
    return api.editMessage("⚠️ Something went wrong. Try again later.", tempMsg.messageID, threadID);
  }
};
