export const GROUP_LABEL = { tax: '🧑 個人扣稅 relief', biz: '💼 Freelance 生意開銷', plain: '⚪ 一般開銷（不能扣稅）' };

export function fmt(v, dp) {
  return 'RM ' + Number(v || 0).toLocaleString('en-MY', { minimumFractionDigits: dp ?? 0, maximumFractionDigits: 2 });
}
export function money(v) { return fmt(v, Number(v) % 1 ? 2 : 0); }
export function num2(v) { return Number(v || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function todayStr() {
  const q = new URLSearchParams(location.search).get('today');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}
export function dayMonth(date) {
  const [, m, d] = String(date).split('-');
  return { d: Number(d), m: Number(m) };
}
