// api/webhook.js - Vercel Serverless Function

const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// =============================================
// TELEGRAM API HELPERS
// =============================================

async function sendMessage(chatId, text, options = {}) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  });
}

async function sendPhoto(chatId, photo, caption = "", options = {}) {
  return axios.post(`${TELEGRAM_API}/sendPhoto`, {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...options,
  });
}

async function sendVideo(chatId, video, caption = "", options = {}) {
  return axios.post(`${TELEGRAM_API}/sendVideo`, {
    chat_id: chatId,
    video,
    caption,
    parse_mode: "HTML",
    supports_streaming: true,
    ...options,
  });
}

async function sendMediaGroup(chatId, media, options = {}) {
  return axios.post(`${TELEGRAM_API}/sendMediaGroup`, {
    chat_id: chatId,
    media,
    ...options,
  });
}

async function sendChatAction(chatId, action = "typing") {
  return axios.post(`${TELEGRAM_API}/sendChatAction`, {
    chat_id: chatId,
    action,
  });
}

async function editMessage(chatId, messageId, text, options = {}) {
  return axios.post(`${TELEGRAM_API}/editMessageText`, {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...options,
  });
}

// =============================================
// EXTRACT TWEET ID
// =============================================

function extractTweetId(url) {
  // Support x.com, twitter.com, t.co
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i,
    /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/i,
    /\/status\/(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// =============================================
// FETCH TWEET DATA VIA MULTIPLE APIs
// =============================================

async function fetchTweetData(tweetId) {
  const apis = [
    fetchViaTwitsave,
    fetchViaFxTwitter,
    fetchViaVxTwitter,
  ];

  for (const apiFn of apis) {
    try {
      const data = await apiFn(tweetId);
      if (data && (data.videos?.length > 0 || data.photos?.length > 0)) {
        return data;
      }
    } catch (err) {
      // try next
    }
  }
  return null;
}

// Method 1: fxtwitter API (most reliable, supports HD)
async function fetchViaFxTwitter(tweetId) {
  const res = await axios.get(
    `https://api.fxtwitter.com/status/${tweetId}`,
    { timeout: 10000, headers: { "User-Agent": "TelegramBot/1.0" } }
  );

  const tweet = res.data?.tweet;
  if (!tweet) return null;

  const result = {
    text: tweet.text || "",
    author: tweet.author?.name || "Unknown",
    username: tweet.author?.screen_name || "",
    videos: [],
    photos: [],
    gifs: [],
  };

  const media = tweet.media;
  if (!media) return result;

  // Videos
  if (media.videos) {
    for (const v of media.videos) {
      const variants = v.variants || [];
      // Sort by bitrate descending (HD first)
      const sorted = variants
        .filter((x) => x.content_type === "video/mp4")
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (sorted.length > 0) {
        result.videos.push({
          url: sorted[0].url, // HD
          thumb: v.thumbnail_url || "",
          duration: v.duration || 0,
          width: v.width || 0,
          height: v.height || 0,
          all_qualities: sorted.map((s) => ({
            url: s.url,
            bitrate: s.bitrate,
            label: bitrateToLabel(s.bitrate),
          })),
        });
      }
    }
  }

  // Photos
  if (media.photos) {
    for (const p of media.photos) {
      result.photos.push({
        url: p.url || "",
        width: p.width || 0,
        height: p.height || 0,
      });
    }
  }

  // GIFs
  if (media.gifs) {
    for (const g of media.gifs) {
      result.gifs.push({
        url: g.url || "",
        thumb: g.thumbnail_url || "",
      });
    }
  }

  return result;
}

// Method 2: vxtwitter
async function fetchViaVxTwitter(tweetId) {
  const res = await axios.get(
    `https://api.vxtwitter.com/status/${tweetId}`,
    { timeout: 10000, headers: { "User-Agent": "TelegramBot/1.0" } }
  );

  const data = res.data;
  if (!data) return null;

  const result = {
    text: data.text || "",
    author: data.user_name || "Unknown",
    username: data.user_screen_name || "",
    videos: [],
    photos: [],
    gifs: [],
  };

  const mediaItems = data.mediaURLs || [];
  const mediaDetails = data.media_extended || [];

  for (const m of mediaDetails) {
    if (m.type === "video" && m.url) {
      result.videos.push({
        url: m.url,
        thumb: m.thumbnail_url || "",
        duration: m.duration_millis ? Math.floor(m.duration_millis / 1000) : 0,
        width: m.size?.width || 0,
        height: m.size?.height || 0,
        all_qualities: [{ url: m.url, label: "HD" }],
      });
    } else if (m.type === "image" && m.url) {
      result.photos.push({
        url: m.url.includes("?") ? m.url + "&name=large" : m.url + "?name=large",
        width: m.size?.width || 0,
        height: m.size?.height || 0,
      });
    } else if (m.type === "gif" && m.url) {
      result.gifs.push({ url: m.url, thumb: m.thumbnail_url || "" });
    }
  }

  return result;
}

// Method 3: Twitsave scraper fallback
async function fetchViaTwitsave(tweetId) {
  const url = `https://twitsave.com/info?url=https://twitter.com/i/status/${tweetId}`;
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const cheerio = require("cheerio");
  const $ = cheerio.load(res.data);

  const result = {
    text: $('p.leading-snug').first().text().trim() || "",
    author: $('p.font-bold').first().text().trim() || "Unknown",
    username: "",
    videos: [],
    photos: [],
    gifs: [],
  };

  // Find download links
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const label = $(el).text().trim();
    if (href.includes(".mp4") || href.includes("video")) {
      if (result.videos.length === 0) {
        result.videos.push({
          url: href,
          thumb: "",
          all_qualities: [{ url: href, label: label || "HD" }],
        });
      } else {
        result.videos[0].all_qualities.push({ url: href, label });
      }
    }
  });

  return result;
}

function bitrateToLabel(bitrate) {
  if (!bitrate) return "SD";
  if (bitrate >= 2000000) return "HD (1080p)";
  if (bitrate >= 1000000) return "HD (720p)";
  if (bitrate >= 500000) return "SD (480p)";
  return "SD (360p)";
}

// =============================================
// HANDLE /start
// =============================================

async function handleStart(chatId, firstName) {
  const text =
    `🎬 <b>X Media Downloader Bot</b>\n\n` +
    `Halo ${firstName || ""}! 👋\n\n` +
    `Bot ini bisa download:\n` +
    `📹 <b>Video HD</b> dari tweet\n` +
    `📸 <b>Foto</b> (single & multi-photo)\n` +
    `🎞 <b>GIF</b> animasi\n\n` +
    `<b>Cara pakai:</b>\n` +
    `Kirim link tweet X/Twitter dan bot akan otomatis mendownload medianya!\n\n` +
    `Contoh:\n` +
    `<code>https://x.com/user/status/1234567890</code>\n\n` +
    `✅ Support multi-media tweet\n` +
    `✅ Video kualitas HD\n` +
    `✅ Download semua foto sekaligus`;

  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📌 Cara Pakai", callback_data: "help" }],
        [{ text: "ℹ️ About", callback_data: "about" }],
      ],
    },
  });
}

// =============================================
// HANDLE MEDIA DOWNLOAD
// =============================================

async function handleMediaDownload(chatId, url) {
  // Send loading message
  const loadingMsg = await sendMessage(
    chatId,
    `⏳ <b>Memproses link...</b>\n<code>${url}</code>`
  );
  const loadingMsgId = loadingMsg.data?.result?.message_id;

  try {
    const tweetId = extractTweetId(url);
    if (!tweetId) {
      await editMessage(
        chatId,
        loadingMsgId,
        `❌ <b>Link tidak valid!</b>\n\nPastikan link dari X/Twitter:\n<code>https://x.com/user/status/ID</code>`
      );
      return;
    }

    await editMessage(chatId, loadingMsgId, `🔍 <b>Mengambil data media...</b>`);
    await sendChatAction(chatId, "typing");

    const data = await fetchTweetData(tweetId);

    if (!data) {
      await editMessage(
        chatId,
        loadingMsgId,
        `❌ <b>Gagal mengambil data!</b>\n\nKemungkinan:\n• Tweet tidak ada / dihapus\n• Tweet privat / sensitif\n• Coba lagi beberapa saat`
      );
      return;
    }

    const hasMedia =
      data.videos.length > 0 || data.photos.length > 0 || data.gifs.length > 0;

    if (!hasMedia) {
      await editMessage(
        chatId,
        loadingMsgId,
        `ℹ️ <b>Tidak ada media ditemukan</b>\n\nTweet ini tidak mengandung foto, video, atau GIF.`
      );
      return;
    }

    // Delete loading message
    await axios.post(`${TELEGRAM_API}/deleteMessage`, {
      chat_id: chatId,
      message_id: loadingMsgId,
    }).catch(() => {});

    const authorLine = data.username
      ? `👤 <b>${data.author}</b> @${data.username}`
      : `👤 <b>${data.author}</b>`;

    const caption =
      `${authorLine}\n` +
      `🔗 <a href="https://x.com/i/status/${tweetId}">Lihat Tweet</a>\n\n` +
      (data.text ? `💬 ${data.text.slice(0, 200)}${data.text.length > 200 ? "..." : ""}` : "");

    // ---- SEND VIDEOS ----
    for (let i = 0; i < data.videos.length; i++) {
      const vid = data.videos[i];
      await sendChatAction(chatId, "upload_video");

      const vidCaption =
        (data.videos.length > 1 ? `🎬 Video ${i + 1}/${data.videos.length}\n` : "") +
        caption;

      // Build quality buttons
      const qualityButtons = [];
      if (vid.all_qualities && vid.all_qualities.length > 1) {
        const row = vid.all_qualities.slice(0, 4).map((q) => ({
          text: `⬇️ ${q.label}`,
          url: q.url,
        }));
        qualityButtons.push(row);
      }

      try {
        await sendVideo(chatId, vid.url, vidCaption.slice(0, 1024), {
          reply_markup:
            qualityButtons.length > 0
              ? { inline_keyboard: qualityButtons }
              : undefined,
          ...(vid.width && { width: vid.width }),
          ...(vid.height && { height: vid.height }),
          ...(vid.duration && { duration: vid.duration }),
          ...(vid.thumb && { thumb: vid.thumb }),
        });
      } catch (e) {
        // Fallback: send as link
        const links = vid.all_qualities
          .slice(0, 4)
          .map((q) => `• <a href="${q.url}">${q.label}</a>`)
          .join("\n");
        await sendMessage(
          chatId,
          `🎬 <b>Video ${i + 1}</b>\n${vidCaption}\n\n<b>Download Links:</b>\n${links}`,
          { disable_web_page_preview: false }
        );
      }
    }

    // ---- SEND GIFs ----
    for (let i = 0; i < data.gifs.length; i++) {
      const gif = data.gifs[i];
      await sendChatAction(chatId, "upload_video");
      try {
        await axios.post(`${TELEGRAM_API}/sendAnimation`, {
          chat_id: chatId,
          animation: gif.url,
          caption:
            (data.gifs.length > 1 ? `🎞 GIF ${i + 1}/${data.gifs.length}\n` : "") +
            caption.slice(0, 900),
          parse_mode: "HTML",
        });
      } catch (e) {
        await sendMessage(
          chatId,
          `🎞 <a href="${gif.url}">GIF ${i + 1}</a>\n${caption}`,
          { disable_web_page_preview: false }
        );
      }
    }

    // ---- SEND PHOTOS ----
    if (data.photos.length === 1) {
      await sendChatAction(chatId, "upload_photo");
      const ph = data.photos[0];
      try {
        await sendPhoto(chatId, ph.url, `📸 Foto\n${caption}`.slice(0, 1024));
      } catch (e) {
        await sendMessage(chatId, `📸 <a href="${ph.url}">Lihat Foto</a>\n${caption}`);
      }
    } else if (data.photos.length > 1) {
      await sendChatAction(chatId, "upload_photo");
      // Send as media group (up to 10)
      const chunks = [];
      for (let i = 0; i < data.photos.length; i += 10) {
        chunks.push(data.photos.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const mediaGroup = chunk.map((ph, idx) => ({
          type: "photo",
          media: ph.url,
          ...(idx === 0 && {
            caption: `📸 ${data.photos.length} Foto\n${caption}`.slice(0, 1024),
            parse_mode: "HTML",
          }),
        }));
        try {
          await sendMediaGroup(chatId, mediaGroup);
        } catch (e) {
          // Fallback: send one by one
          for (const ph of chunk) {
            await sendPhoto(chatId, ph.url, caption.slice(0, 1024)).catch(() =>
              sendMessage(chatId, `📸 <a href="${ph.url}">Foto</a>`)
            );
          }
        }
        // small delay between groups
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
    await editMessage(
      chatId,
      loadingMsgId,
      `❌ <b>Terjadi kesalahan!</b>\n\n<code>${err.message?.slice(0, 100)}</code>\n\nSilakan coba lagi.`
    ).catch(() =>
      sendMessage(
        chatId,
        `❌ Terjadi kesalahan. Silakan coba lagi.`
      )
    );
  }
}

// =============================================
// MAIN WEBHOOK HANDLER
// =============================================

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("X Media Downloader Bot is running! 🚀");
  }

  try {
    const body = req.body;

    // Handle callback queries (button taps)
    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: cq.id,
      });

      if (data === "help") {
        await sendMessage(
          chatId,
          `📖 <b>Cara Pakai Bot</b>\n\n` +
            `1️⃣ Salin link tweet dari X/Twitter\n` +
            `2️⃣ Kirim ke bot ini\n` +
            `3️⃣ Tunggu bot memproses\n` +
            `4️⃣ Media akan terkirim otomatis!\n\n` +
            `<b>Format link yang didukung:</b>\n` +
            `• <code>https://x.com/user/status/ID</code>\n` +
            `• <code>https://twitter.com/user/status/ID</code>\n\n` +
            `<b>Fitur:</b>\n` +
            `✅ Video HD (720p, 1080p)\n` +
            `✅ Multi foto sekaligus\n` +
            `✅ GIF animasi\n` +
            `✅ Pilih kualitas video`
        );
      } else if (data === "about") {
        await sendMessage(
          chatId,
          `ℹ️ <b>Tentang Bot</b>\n\n` +
            `🤖 <b>X Media Downloader</b>\n` +
            `📦 Versi: 1.0.0\n` +
            `⚡ Platform: Vercel Serverless\n\n` +
            `Bot ini menggunakan API publik untuk mengambil media dari X/Twitter.`
        );
      }
      return res.status(200).json({ ok: true });
    }

    // Handle messages
    const message = body.message;
    if (!message) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const firstName = message.from?.first_name || "";

    if (!text) return res.status(200).json({ ok: true });

    // Commands
    if (text === "/start" || text.startsWith("/start ")) {
      await handleStart(chatId, firstName);
      return res.status(200).json({ ok: true });
    }

    if (text === "/help") {
      await sendMessage(
        chatId,
        `📖 Kirim link tweet X/Twitter untuk mendownload medianya!\n\n` +
          `Contoh:\n<code>https://x.com/user/status/1234567890</code>`
      );
      return res.status(200).json({ ok: true });
    }

    // Check if it's a tweet URL
    const tweetUrlPattern =
      /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com|t\.co)\/[\w\/?=&#%+.-]+/i;

    if (tweetUrlPattern.test(text)) {
      // Extract just the URL if there's extra text
      const urlMatch = text.match(
        /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com|t\.co)\/[\w\/?=&#%+.-]+/i
      );
      const tweetUrl = urlMatch ? urlMatch[0] : text;
      await handleMediaDownload(chatId, tweetUrl);
    } else {
      await sendMessage(
        chatId,
        `❓ Kirim link tweet X/Twitter untuk saya download medianya!\n\n` +
          `Contoh:\n<code>https://x.com/user/status/1234567890</code>\n\n` +
          `Ketik /help untuk bantuan.`
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
};
