import { esc } from '../format.js';
import { setConfig } from '../api.js';

export function render(ctx) {
  const s = ctx.state;
  return `<form class="setup" id="setupForm">
    <h1>連接你的 Google Sheet</h1>
    <p>第一次用要貼兩樣東西，都在 Google Sheet 上方選單「記帳 App › 顯示 App 密碼」和部署教學裡。只會存在這台手機或電腦。</p>
    <div class="field"><label for="cfgUrl">後台網址</label><input id="cfgUrl" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(s.setupUrl || '')}"></div>
    <div class="field"><label for="cfgToken">App 密碼</label><input id="cfgToken" autocomplete="off" value="${esc(s.setupToken || '')}"></div>
    ${s.setupError ? `<div class="err-box">${esc(s.setupError)}</div>` : ''}
    <button class="btn" type="submit" ${s.setupBusy ? 'disabled' : ''}>${s.setupBusy ? '連接中…' : '連接'}</button>
    <button class="btn ghost" type="button" data-act="demo">先用示範資料試試</button>
    <p style="font-size:12px">示範模式的資料是假的，重新整理就會還原，不會存到任何地方。</p>
  </form>`;
}

export function onClick(el, ctx) {
  if (el.dataset.act !== 'demo') return false;
  setConfig({ mode: 'demo' });
  ctx.reload();
  return true;
}

export function onSubmit(form, ctx) {
  if (form.id !== 'setupForm') return false;
  const s = ctx.state;
  s.setupUrl = form.querySelector('#cfgUrl').value.trim();
  s.setupToken = form.querySelector('#cfgToken').value.trim();
  if (!/^https?:\/\//.test(s.setupUrl) || !s.setupToken) { s.setupError = '請貼上後台網址和 App 密碼'; ctx.render(); return true; }
  s.setupBusy = true; s.setupError = ''; ctx.render();
  setConfig({ mode: 'live', url: s.setupUrl, token: s.setupToken });
  ctx.reload().then(() => {
    s.setupBusy = false;
    if (ctx.state.error) { s.setupError = ctx.state.error; ctx.disconnect(); }
    ctx.render();
  });
  return true;
}
