#!/usr/bin/env node
// setup-webhook.js
// Run this ONCE after deploy to register webhook URL ke Telegram

const https = require("https");

const BOT_TOKEN = process.argv[2] || process.env.BOT_TOKEN;
const VERCEL_URL = process.argv[3] || process.env.VERCEL_URL;

if (!BOT_TOKEN || !VERCEL_URL) {
  console.log("❌ Usage: node setup-webhook.js <BOT_TOKEN> <VERCEL_URL>");
  console.log("   Example: node setup-webhook.js 123456:ABC... https://your-app.vercel.app");
  process.exit(1);
}

const webhookUrl = `https://${VERCEL_URL.replace(/^https?:\/\//, "")}/webhook`;

console.log(`\n🔧 Setting up webhook...`);
console.log(`📡 URL: ${webhookUrl}`);

const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=["message","callback_query"]`;

https.get(url, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      const result = JSON.parse(data);
      if (result.ok) {
        console.log(`\n✅ Webhook berhasil didaftarkan!`);
        console.log(`   URL: ${webhookUrl}`);
        console.log(`\n🤖 Bot siap digunakan!`);
      } else {
        console.log(`\n❌ Gagal: ${result.description}`);
      }
    } catch (e) {
      console.log(`\n❌ Error parsing response: ${data}`);
    }
  });
}).on("error", (e) => {
  console.error(`\n❌ Error: ${e.message}`);
});
