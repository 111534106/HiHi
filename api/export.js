// api/export.js - 只支援 PPTX 下載
import PptxGenJS from 'pptxgenjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST' });
  }

  const { slides } = req.body;

  if (!slides || !Array.isArray(slides)) {
    return res.status(400).json({ error: '無效 slides 資料' });
  }

  try {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'A4', width: 10, height: 5.63 });

    slides.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.addText(s.title || `第 ${idx + 1} 頁`, {
        x: 0.5, y: 0.3, w: 9, h: 0.8,
        fontSize: 24, bold: true, color: '363636', align: 'center'
      });

      if (Array.isArray(s.bullets) && s.bullets.length > 0) {
        s.bullets.forEach((bullet, i) => {
          slide.addText(`• ${bullet}`, {
            x: 0.8, y: 1.2 + i * 0.4, w: 8.5, h: 0.4,
            fontSize: 14, color: '363636', bullet: true
          });
        });
      }

      if (s.notes) {
        slide.addText(`備註：${s.notes}`, {
          x: 0.5, y: 4.8, w: 9, h: 0.6,
          fontSize: 10, color: '888888', italic: true
        });
      }
    });

    const buffer = await pptx.write('nodebuffer');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename=presentation.pptx');
    res.send(buffer);

  } catch (error) {
    console.error('匯出錯誤:', error);
    res.status(500).json({ error: '匯出失敗：' + error.message });
  }
}
