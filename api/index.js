// /api/index.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { getConversation, updateConversation } = require('../services/gsheet');
const { parseDataPemesan, parseDataPesanan } = require('../utils/parser');

if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN must be provided!');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Menangani perintah /start atau /buat_invoice
bot.command(['start', 'buat_invoice'], async (ctx) => {
  const userId = ctx.from.id;
  const message = `Halo, ${ctx.from.first_name}! Mari kita buat invoice baru.

Silakan masukkan Data Pemesan dengan format di bawah ini. Tekan tombol 'Salin Format Kosong' untuk mendapatkan template.

Nama: [Nama Anda]
Lokasi: [Lokasi Acara]
No. Invoice: [Nomor Invoice]
Tanggal: [Tanggal Invoice]
Kota: [Kota Acara]
Kegiatan: [Nama Kegiatan]`;

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('📋 Salin Format Kosong', 'copy_pemesan_format')
  ]);
  
  await ctx.reply(message, keyboard);
  
  // Update status pengguna di Google Sheet
  await updateConversation(userId, { status: 'menunggu_data_pemesan' });
});

// Menangani semua pesan teks yang bukan perintah
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  const conversation = await getConversation(userId);

  if (!conversation) {
    return ctx.reply('Silakan mulai dengan perintah /buat_invoice terlebih dahulu.');
  }

  // --- LOGIKA UNTUK DATA PEMESAN ---
  if (conversation.status === 'menunggu_data_pemesan') {
    const result = parseDataPemesan(text);
    
    if (!result.isValid) {
      // Jika format salah, kirim pesan error dan jangan ubah status
      return ctx.reply(`❌ Terjadi kesalahan: ${result.error}\n\nMohon perbaiki dan kirim ulang data pemesan.`);
    }
    
    // Jika format benar, simpan dan lanjutkan
    await updateConversation(userId, { 
      status: 'menunggu_data_pesanan', 
      data_pemesan: JSON.stringify(result.data) // Simpan data terstruktur
    });
    
    // Kirim pesan permintaan data pesanan (seperti sebelumnya)
    const message = `Data pemesan diterima. 👍\n\nSekarang masukkan semua Data Pesanan dalam satu pesan.\n\nGunakan format:\n\`Periode (MM/DD/YY-MM/DD/YY), Keterangan, Kuantitas, Harga Satuan\`\n\nContoh:\n\`10/10/25-10/12/25, Innova Zenix, 1, 600000\``;
    const keyboard = Markup.inlineKeyboard([ Markup.button.callback('📋 Salin Format Pesanan', 'copy_pesanan_format') ]);
    await ctx.replyWithMarkdown(message, keyboard);
  
  // --- LOGIKA UNTUK DATA PESANAN ---
  } else if (conversation.status === 'menunggu_data_pesanan') {
    const result = parseDataPesanan(text);
    
    if (!result.isValid) {
      return ctx.reply(`❌ Terjadi kesalahan: ${result.error}\n\nMohon perbaiki dan kirim ulang data pesanan.`);
    }

    // Ambil data pemesan yang sudah tersimpan
    const dataPemesan = JSON.parse(conversation.data_pemesan);
    const dataPesanan = result.data;

    // Simpan data pesanan yang sudah final
    await updateConversation(userId, {
      status: 'konfirmasi',
      data_pesanan: JSON.stringify(dataPesanan)
    });
    
    // Buat pesan rangkuman
    const rangkumanMessage = buatRangkuman(dataPemesan, dataPesanan);

    // Buat tombol konfirmasi
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Buat & Unduh Invoice PDF', 'generate_pdf')
    ]);

    // Kirim rangkuman beserta tombol
    await ctx.replyWithMarkdown(rangkumanMessage, keyboard);
  }
});

// Menangani aksi dari tombol inline
bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;

  if (action === 'copy_pemesan_format') {
    const formatText = `Nama: \nLokasi: \nNo. Invoice: \nTanggal: \nKota: \nKegiatan: `;
    await ctx.replyWithHTML('<code>' + formatText + '</code>');
  } else if (action === 'copy_pesanan_format') {
    const formatText = `MM/DD/YY-MM/DD/YY, Nama Mobil, Jumlah Unit, Harga Satuan`;
    await ctx.replyWithHTML('<code>' + formatText + '</code>');
  } else if (action === 'generate_pdf') { // DITAMBAHKAN: Handler untuk tombol generate PDF
    await ctx.answerCbQuery('⏳ Mohon tunggu...');
    await ctx.reply('Siap! Sedang membuat file PDF untuk Anda. Ini mungkin butuh beberapa detik...');
    // TODO: Panggil fungsi untuk membuat PDF di sini
  }

  // Cek jika bukan generate_pdf, baru jalankan answerCbQuery biasa
  if (action !== 'generate_pdf') {
    await ctx.answerCbQuery();
  }
});


// --- Boilerplate untuk Vercel ---
module.exports = async (req, res) => {
  if (!req.body || req.method !== 'POST') {
    console.log('Menerima permintaan GET, kemungkinan dari browser.');
    return res.status(200).send('This is a Telegram Bot Webhook endpoint. Please interact via Telegram chat.');
  }
  
  try {
    // Menggunakan webhook Vercel. `bot.launch()` hanya untuk local.
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};