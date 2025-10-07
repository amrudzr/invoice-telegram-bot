// /utils/parser.js

/**
 * Mem-parsing blok teks data pemesan menjadi objek.
 * @param {string} text - Teks mentah dari pengguna.
 * @returns {{isValid: boolean, data: object, error: string|null}}
 */
function parseDataPemesan(text) {
  try {
    const lines = text.split('\n');
    const data = {};
    const requiredKeys = ['nama', 'lokasi', 'no. invoice', 'tanggal', 'kota', 'kegiatan'];

    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length < 2) return; // Abaikan baris kosong atau tidak valid
      
      const key = parts[0].trim().toLowerCase().replace('.', ''); // Normalisasi key
      const value = parts.slice(1).join(':').trim();
      data[key] = value;
    });

    // Validasi sederhana: pastikan semua kunci yang dibutuhkan ada
    for (const key of requiredKeys) {
      if (!data[key]) {
        return { isValid: false, data: null, error: `Data '${key}' tidak ditemukan.` };
      }
    }

    return { isValid: true, data: data, error: null };
  } catch (error) {
    return { isValid: false, data: null, error: 'Terjadi kesalahan saat memproses data pemesan.' };
  }
}

/**
 * Mem-parsing blok teks data pesanan menjadi array objek.
 * @param {string} text - Teks mentah dari pengguna.
 * @returns {{isValid: boolean, data: Array, error: string|null}}
 */
function parseDataPesanan(text) {
  try {
    const lines = text.split('\n').filter(line => line.trim() !== ''); // Abaikan baris kosong
    const data = [];

    for (const line of lines) {
      const parts = line.split(',').map(part => part.trim());
      if (parts.length !== 4) {
        return { isValid: false, data: null, error: `Format salah pada baris: "${line}". Pastikan ada 4 bagian dipisahkan koma.` };
      }
      
      const [periode, keterangan, kuantitasStr, hargaStr] = parts;
      
      const kuantitas = parseInt(kuantitasStr, 10);
      const harga = parseInt(hargaStr, 10);

      if (isNaN(kuantitas) || isNaN(harga)) {
         return { isValid: false, data: null, error: `Kuantitas dan harga harus berupa angka pada baris: "${line}".` };
      }

      // Hitung jumlah hari dari periode
      const [tglMulai, tglSelesai] = periode.split('-').map(tgl => new Date(tgl.trim()));
      if (!tglMulai || !tglSelesai || isNaN(tglMulai) || isNaN(tglSelesai)) {
        return { isValid: false, data: null, error: `Format tanggal salah pada baris: "${line}". Gunakan format MM/DD/YY.` };
      }
      const jumlahHari = Math.round((tglSelesai - tglMulai) / (1000 * 60 * 60 * 24)) + 1;
      
      data.push({
        periode,
        keterangan,
        kuantitas,
        harga,
        jumlahHari,
        subtotal: kuantitas * harga * jumlahHari
      });
    }

    return { isValid: true, data: data, error: null };
  } catch (error) {
    return { isValid: false, data: null, error: 'Terjadi kesalahan saat memproses data pesanan.' };
  }
}

module.exports = { parseDataPemesan, parseDataPesanan };