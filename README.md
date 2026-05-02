# 🎬 X Media Downloader Bot

Bot Telegram untuk download video HD, foto, dan GIF dari X (Twitter). Deploy ke Vercel dengan mudah!

## ✨ Fitur

- 📹 **Video HD** — Download video resolusi tinggi (1080p, 720p, 480p)
- 📸 **Multi Foto** — Download semua foto dari 1 tweet sekaligus (album)
- 🎞 **GIF** — Download GIF animasi
- 🎚 **Pilih Kualitas** — Tombol inline untuk pilih kualitas video
- ⚡ **Cepat** — Menggunakan 3 API sumber (fallback otomatis)
- ☁️ **Serverless** — Jalan di Vercel tanpa server/VPS

---

## 🚀 Deploy ke Vercel

### Langkah 1 — Buat Bot Telegram

1. Buka Telegram → cari **@BotFather**
2. Kirim `/newbot`
3. Ikuti instruksi, tentukan nama dan username bot
4. Salin **Bot Token** yang diberikan (format: `123456789:ABC-DEF...`)

### Langkah 2 — Upload ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAMU/REPO.git
git push -u origin main
```

### Langkah 3 — Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → Login
2. Klik **"Add New Project"**
3. Import repo GitHub yang sudah dibuat
4. Di bagian **Environment Variables**, tambahkan:
   ```
   BOT_TOKEN = (paste token dari BotFather)
   ```
5. Klik **Deploy** → tunggu selesai
6. Salin URL deployment (contoh: `https://xbot-abc123.vercel.app`)

### Langkah 4 — Daftarkan Webhook

Setelah deploy selesai, jalankan di terminal/komputer lokal:

```bash
node setup-webhook.js TOKEN_BOT URL_VERCEL
```

Contoh:
```bash
node setup-webhook.js 123456789:ABC-DEF... https://xbot-abc123.vercel.app
```

Atau buka browser dan akses URL ini:
```
https://api.telegram.org/botTOKEN/setWebhook?url=https://xbot-abc123.vercel.app/webhook
```

---

## 📱 Cara Pakai Bot

1. Buka bot di Telegram
2. Kirim `/start`
3. Salin link tweet dari X/Twitter
4. Kirim link ke bot
5. Tunggu media terkirim!

**Format link yang didukung:**
```
https://x.com/user/status/1234567890
https://twitter.com/user/status/1234567890
https://t.co/xxxxxxxx
```

---

## 🗂 Struktur Project

```
xbot/
├── api/
│   └── webhook.js      ← Handler utama (Vercel Function)
├── package.json
├── vercel.json         ← Konfigurasi Vercel
├── setup-webhook.js    ← Script daftar webhook
├── .env.example
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `BOT_TOKEN` | Token bot dari @BotFather |

---

## 🔧 Troubleshooting

**Bot tidak merespons?**
- Pastikan webhook sudah didaftarkan (langkah 4)
- Cek Environment Variable `BOT_TOKEN` di Vercel Dashboard
- Cek Vercel Function Logs di dashboard

**Video gagal terkirim?**
- File mungkin terlalu besar untuk Telegram (max 50MB via URL)
- Bot akan otomatis kirim link download sebagai fallback

**Error "Tweet tidak ditemukan"?**
- Tweet mungkin sudah dihapus atau privat
- Pastikan link lengkap dan valid

---

## 📝 Catatan

- Bot menggunakan API publik pihak ketiga (fxtwitter, vxtwitter) — tidak perlu API key Twitter
- Tidak menyimpan/menyimpan media di server
- Untuk tweet sensitif, mungkin perlu login di X — bot tidak mendukung fitur ini

---

## 📜 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
