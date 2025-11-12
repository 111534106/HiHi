// api/export.js - 從 JSON slides 生成 PDF 或 PPTX
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST' });
  }

  const { slides, format = 'pdf' } = req.body; // format: 'pdf' or 'pptx'

  if (!slides || !Array.isArray(slides)) {
    return res.status(400).json({ error: '無效 slides 資料' });
  }

  try {
    if (format === 'pptx') {
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slides.forEach((s, idx) => {
        const newSlide = pptx.addSlide();
        newSlide.addText(s.title, { x: 1, y: 1, w: 9, h: 1, fontSize: 24, bold: true });
        s.bullets.forEach(b => newSlide.addText(b, { x: 1, y: 1.5, w: 9, h: 0.5, bullet: true }));
        if (s.notes) newSlide.addText(s.notes, { x: 1, y: 3, w: 9, h: 1, fontSize: 12, color: '808080' });
      });
      const buffer = await pptx.write('nodebuffer');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', 'attachment; filename=slides.pptx');
      res.send(buffer);
    } else { // PDF
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=slides.pdf');
      doc.pipe(res);

      slides.forEach(s => {
        doc.fontSize(20).text(s.title, { underline: true });
        s.bullets.forEach(b => doc.fontSize(12).text(`• ${b}`, 50, doc.y + 10));
        if (s.notes) doc.fontSize(10).fillColor('#808080').text(`備註：${s.notes}`);
        doc.moveDown();
      });

      doc.end();
    }
  } catch (error) {
    console.error('匯出錯誤:', error);
    res.status(500).json({ error: '匯出失敗' });
  }
}
