import { todayStr } from './format.js';

const KEY = 'ginn-expense-config';
export function getConfig() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
export function setConfig(cfg) { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* 私密模式存不了，這次開著就好 */ } memoryConfig = cfg; }
export function clearConfig() { try { localStorage.removeItem(KEY); } catch {} memoryConfig = null; demo = null; }
let memoryConfig = null;
function config() { return getConfig() || memoryConfig; }

let demo = null;
function demoDeps() {
  if (!demo) {
    demo = {
      store: MemoryStore(Seed.demo(todayStr())),
      now: () => new Date().toISOString(),
      files: { save: () => ({ fileId: 'demo-file-' + Date.now(), url: '#' }), file: () => '#' },
      gemini: { read: (b, m, c, today) => ({ ok: true, draft: { date: today, merchant: 'Shopee · Lenovo IdeaPad Slim 5', amount: 2899,
        category: 'LIFESTYLE', needsCheck: true, checkReason: '這台電腦是個人用，還是 TheGuruboss 接案用？同一件東西只能報一邊。' } }) }
    };
  }
  return demo;
}

export async function call(action, payload) {
  const cfg = config();
  if (!cfg) throw new Error('還沒連接 Google Sheet');
  if (cfg.mode === 'demo') {
    const res = ApiCore.handle({ action, payload }, demoDeps());
    await new Promise(r => setTimeout(r, action === 'readReceipt' ? 900 : 80));
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }
  let r;
  try {
    r = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ token: cfg.token, action, payload }) });
  } catch {
    throw new Error('連不上後台，請檢查網路，或確認網址是 Apps Script 部署後的 /exec 網址');
  }
  let j;
  try { j = await r.json(); } catch { throw new Error('後台的回應看不懂，請確認網址是 Apps Script 部署後的 /exec 網址'); }
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
