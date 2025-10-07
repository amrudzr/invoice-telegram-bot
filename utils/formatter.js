// /utils/formatter.js

/**
 * Mengubah angka menjadi format Rupiah (Rp 1.234.567)
 * @param {number} number - Angka yang akan diformat
 * @returns {string} - String dalam format Rupiah
 */
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
}

/**
 * Membuat teks rangkuman invoice dari data yang sudah diproses.
 * @param {object} dataPemesan - Objek data pemesan dari parser.
 * @param {Array<object>} dataPesanan - Array objek data pesanan dari parser.
 * @returns {string} - Teks rangkuman yang sudah diformat.
 */
function buatRangkuman(dataPemesan, dataPesanan) {
  let totalKeseluruhan = 0;
  
  // Membuat bagian rincian pesanan
  const rincianItems = dataPesanan.map((item, index) => {
    totalKeseluruhan += item.subtotal;
    const rincianHarga = `\`${item.kuantitas} x ${formatRupiah(item.harga)} x ${item.jumlahHari} hari = ${formatRupiah(item.subtotal)}\``;
    return `${index + 1}. *${item.keterangan}* (${item.kuantitas} unit, ${item.jumlahHari} hari) *${item.periode}*\n   ${rincianHarga}`;
  }).join('\n');

  // Menggabungkan semua bagian menjadi satu pesan
  const message = `
🧾 *Rangkuman Invoice*

--- *Data Pemesan* ---
*Nama:* ${dataPemesan['nama']}
*Lokasi:* ${dataPemesan['lokasi']}
*No. Invoice:* ${dataPemesan['no. invoice']}
*Tanggal:* ${dataPemesan['tanggal']}
*Kota:* ${dataPemesan['kota']}
*Kegiatan:* ${dataPemesan['kegiatan']}

--- *Rincian Pesanan* ---
${rincianItems}

--- *Total* ---
*TOTAL HARGA:* *${formatRupiah(totalKeseluruhan)}*

Apakah data sudah benar? Tekan tombol di bawah untuk membuat file PDF.
  `;

  return message.trim();
}

module.exports = { buatRangkuman };