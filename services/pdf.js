// /services/pdf.js
const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

// Fungsi formatter Rupiah dari project kita sebelumnya
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(number);
}

/**
 * Membuat PDF dari data invoice.
 * @param {object} dataPemesan
 * @param {Array<object>} dataPesanan
 * @returns {Promise<Buffer>} - Buffer dari file PDF yang sudah jadi.
 */
async function generatePdf(dataPemesan, dataPesanan) {
    let browser = null;
    try {
        // Baca template HTML
        const templatePath = path.join(process.cwd(), 'template.html');
        let htmlContent = await fs.readFile(templatePath, 'utf-8');

        // Ganti placeholder data pemesan
        htmlContent = htmlContent
            .replace('{{nama}}', dataPemesan['nama'])
            .replace('{{lokasi}}', dataPemesan['lokasi'])
            .replace('{{no_invoice}}', dataPemesan['no. invoice'])
            .replace('{{tanggal}}', dataPemesan['tanggal'])
            .replace('{{kota}}', dataPemesan['kota'])
            .replace('{{kegiatan}}', dataPemesan['kegiatan']);

        // Buat baris tabel untuk rincian pesanan
        let totalKeseluruhan = 0;
        const rincianRows = dataPesanan.map(item => {
            totalKeseluruhan += item.subtotal;
            const deskripsi = `${item.keterangan} (${item.kuantitas} unit, ${item.jumlahHari} hari) - ${item.periode}`;
            return `<tr><td>${deskripsi}</td><td style="text-align: right;">${formatRupiah(item.subtotal)}</td></tr>`;
        }).join('');

        // Ganti placeholder rincian dan total
        htmlContent = htmlContent
            .replace('{{rincian_pesanan}}', rincianRows)
            .replace('{{total_keseluruhan}}', formatRupiah(totalKeseluruhan));

        // Jalankan Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Diperlukan untuk Vercel
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        return pdfBuffer;

    } catch (error) {
        console.error("Error saat generate PDF:", error);
        throw new Error("Gagal membuat PDF.");
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { generatePdf };