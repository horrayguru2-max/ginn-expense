/* 上傳前壓縮：JPEG、最長邊 ≤ 1280px、≤ 150KB。PDF 不壓縮，原檔上傳（≤ 5MB）。 */
const MAX_PDF = 5 * 1024 * 1024;
const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');

function readPdf(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF) return reject(new Error('PDF 太大（最多 5MB），請壓小一點或改用截圖'));
    const r = new FileReader();
    r.onload = () => resolve({ base64: String(r.result).split(',')[1], mime: 'application/pdf', filename: file.name || ('receipt-' + Date.now() + '.pdf'), bytes: file.size });
    r.onerror = () => reject(new Error('讀不到這個 PDF'));
    r.readAsDataURL(file);
  });
}
function load(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('這個檔案不是圖片，或圖片壞掉了')); };
    img.src = url;
  });
}

export async function compress(file, maxBytes = 150 * 1024) {
  if (isPdf(file)) return readPdf(file);
  const img = await load(file);
  let scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  for (let round = 0; round < 6; round++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      const base64 = canvas.toDataURL('image/jpeg', q).split(',')[1];
      const bytes = Math.floor(base64.length * 3 / 4);
      if (bytes <= maxBytes) return { base64, mime: 'image/jpeg', filename: file.name.replace(/\.[^.]+$/, '') + '.jpg', bytes };
    }
    scale *= 0.75;
  }
  throw new Error('圖片太大，壓不到 150KB，請截小一點再試');
}
