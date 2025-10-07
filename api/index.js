// /api/index.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { getConversation, updateConversation } = require('../services/gsheet');
const { parseDataPemesan, parseDataPesanan } = require('../utils/parser');
const { buatRangkuman } = require('../utils/formatter');
const { generatePdf } = require('../services/pdf');

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
    const message = `Data pemesan diterima. 👍
    Sekarang masukkan semua Data Pesanan. Gunakan format 4 bagian yang dipisah koma:
    \`Periode (MM/DD/YY-MM/DD/YY), Keterangan Unit, Kuantitas, Harga Satuan\`
    
    *Bot akan menghitung jumlah hari secara otomatis dari periode yang Anda masukkan.*
    
    Contoh:
    \`10/10/25-10/12/25, Innova Zenix, 1, 600000\`
    `;
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
    try {
      await ctx.answerCbQuery('⏳ Mohon tunggu...');
      await ctx.reply('Siap! Sedang membuat file PDF untuk Anda. Ini mungkin butuh beberapa detik...');

      // Ambil data terbaru dari Google Sheet
      const conversation = await getConversation(userId);
      if (!conversation || conversation.status !== 'konfirmasi') {
        return ctx.reply('Data invoice tidak ditemukan atau sudah tidak valid. Silakan mulai lagi dengan /buat_invoice.');
      }

      const dataPemesan = JSON.parse(conversation.data_pemesan);
      const dataPesanan = JSON.parse(conversation.data_pesanan);

      // Panggil fungsi generate PDF
      const pdfBuffer = await generatePdf(dataPemesan, dataPesanan);

      // Kirim PDF sebagai dokumen
      await ctx.replyWithDocument({
        source: pdfBuffer,
        filename: `invoice-${dataPemesan['no. invoice'].replace(/[/\\?%*:|"<>]/g, '-')}.pdf`
      });

      // Update status untuk menandakan proses selesai
      await updateConversation(userId, { status: 'selesai' });

    } catch (error) {
      console.error(error);
      await ctx.reply('Maaf, terjadi kesalahan saat membuat PDF. Silakan coba lagi.');
    }
    return;
  }

  // Cek jika bukan generate_pdf, baru jalankan answerCbQuery biasa
  if (action !== 'generate_pdf') {
    await ctx.answerCbQuery();
  }
});


// --- Boilerplate untuk Vercel ---
module.exports = async (req, res) => {
  // =================================================================
  // MULAI KODE DEBUGGING
  // =================================================================
  console.log("--- MEMULAI PROSES DEBUGGING ---");
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    console.log("✅ Variabel GOOGLE_CREDENTIALS_JSON DITEMUKAN.");
    // Kita akan lihat beberapa karakter pertama untuk memastikan isinya tidak kosong
    console.log("Isi awal:", process.env.GOOGLE_CREDENTIALS_JSON.substring(0, 30) + "...");
  } else {
    console.log("❌ Variabel GOOGLE_CREDENTIALS_JSON TIDAK DITEMUKAN.");
  }
  console.log("--- SELESAI PROSES DEBUGGING ---");
  // =================================================================
  // AKHIR KODE DEBUGGING
  // =================================================================

  // Ini untuk mencegah error jika ada request GET dari browser
  if (!req.body || req.method !== 'POST') {
    return res.status(200).send('Webhook endpoint ready.');
  }
  
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};