// /services/gsheet.js
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

// --- Konfigurasi ---
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID; 
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// --- ---

// Inisialisasi autentikasi cerdas untuk Vercel & Lokal
let auth;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // KODE INI UNTUK PRODUKSI DI VERCEL
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });
} else {
  // KODE INI UNTUK DEVELOPMENT LOKAL
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
      range: 'conversations!A:D',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return null;

    const header = rows[0];
    const userIdIndex = header.indexOf('user_id');

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][userIdIndex] == userId) {
        return {
          rowIndex: i + 1,
          user_id: rows[i][0],
          status: rows[i][1],
          data_pemesan: rows[i][2],
          data_pesanan: rows[i][3],
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Error saat membaca dari Google Sheet:', err);
    return null;
  }
}

/**
 * Membuat atau memperbarui baris percakapan untuk user_id
 * @param {number} userId - ID pengguna Telegram
 * @param {object} dataToUpdate - Data yang akan diupdate
 */
async function updateConversation(userId, dataToUpdate) {
  try {
    const conversation = await getConversation(userId);
    
    if (conversation) {
      // Jika user sudah ada, update baris yang ada
      const existingData = {
        user_id: conversation.user_id,
        status: conversation.status,
        data_pemesan: conversation.data_pemesan,
        data_pesanan: conversation.data_pesanan,
      };

      // Gabungkan data lama dengan data baru
      const updatedData = { ...existingData, ...dataToUpdate };
      
      const values = [[
        updatedData.user_id,
        updatedData.status,
        updatedData.data_pemesan,
        updatedData.data_pesanan
      ]];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `conversations!A${conversation.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
    } else {
      // Jika user baru, tambahkan baris baru
      const values = [[
        userId,
        dataToUpdate.status || '',
        dataToUpdate.data_pemesan || '',
        dataToUpdate.data_pesanan || '',
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'conversations!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
    }
  } catch (err) {
    console.error('Error saat menulis ke Google Sheet:', err);
  }
}

module.exports = { getConversation, updateConversation };