// /services/gsheet.js
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

// --- Konfigurasi ---
// Ganti dengan ID Spreadsheet Anda (dari URL Google Sheet)
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID; 
// Path ke file kunci JSON Anda
const KEY_FILE_PATH = './google-credentials.json'; 
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// --- ---

// Inisialisasi autentikasi
let auth;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // KODE INI UNTUK PRODUKSI DI VERCEL
  // Membaca dari Environment Variable
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });
} else {
  // KODE INI UNTUK DEVELOPMENT LOKAL
  // Membaca dari file fisik
  auth = new JWT({
    keyFile: './google-credentials.json',
    scopes: SCOPES,
  });
}

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Mencari baris percakapan berdasarkan user_id
 * @param {number} userId - ID pengguna Telegram
 * @returns {Promise<object|null>} - Mengembalikan data percakapan atau null
 */
async function getConversation(userId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'conversations!A:D', // Baca semua data di sheet conversations
    });

    const rows = response.data.values || [];
    const header = rows[0]; // Asumsikan baris pertama adalah header
    const userIdIndex = header.indexOf('user_id');

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] == userId) {
        // Data ditemukan, kembalikan sebagai object
        return {
          rowIndex: i + 1, // Simpan nomor baris untuk update nanti
          user_id: rows[i][0],
          status: rows[i][1],
          data_pemesan: rows[i][2],
          data_pesanan: rows[i][3],
        };
      }
    }
    return null; // Data tidak ditemukan
  } catch (err) {
    console.error('Error saat membaca dari Google Sheet:', err);
    return null;
  }
}

/**
 * Membuat atau memperbarui baris percakapan untuk user_id
 * @param {number} userId - ID pengguna Telegram
 * @param {object} dataToUpdate - Data yang akan diupdate, misal { status: 'menunggu_data_pesanan' }
 */
async function updateConversation(userId, dataToUpdate) {
  try {
    const conversation = await getConversation(userId);
    let range;
    let values = [];

    if (conversation) {
      // Jika user sudah ada, update baris yang ada
      const existingData = [
        conversation.user_id,
        conversation.status,
        conversation.data_pemesan,
        conversation.data_pesanan,
      ];
      
      const header = ['user_id', 'status', 'data_pemesan', 'data_pesanan'];
      header.forEach((colName, index) => {
        if (dataToUpdate[colName] !== undefined) {
          existingData[index] = dataToUpdate[colName];
        }
      });
      
      range = `conversations!A${conversation.rowIndex}`;
      values = [existingData];

    } else {
      // Jika user baru, tambahkan baris baru
      range = 'conversations!A1'; // Menambahkan ke akhir sheet
      values = [[
        userId,
        dataToUpdate.status || '',
        dataToUpdate.data_pemesan || '',
        dataToUpdate.data_pesanan || '',
      ]];
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
  } catch (err) {
    console.error('Error saat menulis ke Google Sheet:', err);
  }
}

module.exports = { getConversation, updateConversation };