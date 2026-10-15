/* Shared helpers (jQuery + AJAX) used by every page */
const CURRENCY = 'LKR';
let currentUser = null;

const money = (n) => `${CURRENCY} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/** JSON AJAX wrapper -> jqXHR promise */
function api(method, url, data) {
  return $.ajax({ url, method, contentType: 'application/json', dataType: 'json', data: data ? JSON.stringify(data) : undefined });
}
function errMsg(xhr) {
  const r = xhr.responseJSON;
  if (r && r.errors && r.errors.length) return r.errors.map((e) => e.msg).join(' \u2022 ');
  return (r && r.message) || (xhr.status === 0 ? 'Cannot reach the server' : 'Something went wrong');
}

function toast(msg, isError) {
  let box = $('#toasts');
  if (!box.length) box = $('<div id="toasts" role="status" aria-live="polite"></div>').appendTo('body');
  const t = $('<div class="toast"></div>').toggleClass('err', !!isError).text(msg).appendTo(box);
  setTimeout(() => t.fadeOut(250, () => t.remove()), 4200);
}

/* ---------- modal ---------- */
function openModal(html, wide) {
  closeModal();
  const m = $(`<div class="modal" id="modal"><div class="modal-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`).appendTo('body');
  m.on('mousedown', (e) => { if (e.target === m[0]) closeModal(); });
  m.find('input:visible, select:visible').first().trigger('focus');
  return m;
}
function closeModal() { $('#modal').remove(); }
$(document).on('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$(document).on('click', '[data-close]', closeModal);

/* ---------- nav / session ---------- */
function renderNav() {
  const path = location.pathname;
  const cur = (p) => (path === p ? ' aria-current="page"' : '');
  let html = `<a href="/"${cur('/')}>Find a car</a>`;
  if (currentUser) {
    html += `<a href="/my-rentals"${cur('/my-rentals')}>My rentals</a>`;
    if (currentUser.role === 'admin') html += `<a href="/admin"${cur('/admin')}>Admin</a>`;
    html += `<span class="who">${esc(currentUser.name)}</span><button class="linklike" id="logoutBtn" type="button">Log out</button>`;
  } else {
    html += `<a href="/login"${cur('/login')}>Log in</a><a class="btn primary sm" href="/register">Sign up</a>`;
  }
  $('#nav').html(html);
}
$(document).on('click', '#logoutBtn', () => api('POST', '/api/auth/logout').always(() => { location.href = '/'; }));

function loadUser(cb) {
  api('GET', '/api/auth/me')
    .done((r) => { currentUser = r.user; })
    .fail(() => { currentUser = null; })
    .always(() => { renderNav(); if (cb) cb(currentUser); });
}

/* ---------- badges ---------- */
const BADGE = { Paid: 'ok', Confirmed: 'ok', Completed: 'ok', Active: 'info', Pending: 'warn', Maintenance: 'warn', Refunded: 'bad', Cancelled: 'bad', Retired: 'bad', Available: 'ok', Declined: 'bad', Created: 'warn' };
const badge = (s) => (s ? `<span class="badge ${BADGE[s] === 'info' ? '' : BADGE[s] || ''}">${esc(s)}</span>` : '<span class="muted">-</span>');

/* ---------- payment dialog (mock gateway) shared by home + my-rentals ---------- */
function payDialog(paymentId, amount, done) {
  openModal(`
    <h2>Pay ${esc(money(amount))}</h2>
    <p class="muted">Demo gateway: no real charge is made. Any 16-digit number works; numbers ending in <b>0000</b> are declined.</p>
    <div class="form-error" id="payErr" hidden></div>
    <form id="payForm" novalidate>
      <div class="field"><label for="payMethod">Payment method</label>
        <select id="payMethod"><option>Card</option><option>Bank Transfer</option></select></div>
      <div id="cardFields">
        <div class="field"><label for="cardNo">Card number</label><input id="cardNo" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="23"></div>
        <div class="grid-2">
          <div class="field"><label for="cardExp">Expiry</label><input id="cardExp" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp"></div>
          <div class="field"><label for="cardCvv">CVV</label><input id="cardCvv" inputmode="numeric" maxlength="4" autocomplete="cc-csc"></div>
        </div>
      </div>
      <p class="hint" id="bankHint" hidden>Transfer instructions are shown after confirmation (mock).</p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-close>Pay later</button>
        <button type="submit" class="btn primary" id="payGo">Pay now</button>
      </div>
    </form>`);
  $('#payMethod').on('change', function () { const card = this.value === 'Card'; $('#cardFields').toggle(card); $('#bankHint').toggle(!card); });
  $('#payForm').on('submit', (e) => {
    e.preventDefault();
    const method = $('#payMethod').val();
    const body = { method };
    if (method === 'Card') {
      const exp = $('#cardExp').val().trim();
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) return $('#payErr').text('Enter expiry as MM/YY').show();
      if (!/^\d{3,4}$/.test($('#cardCvv').val().trim())) return $('#payErr').text('Enter the 3-4 digit CVV').show();
      body.card_number = $('#cardNo').val();
    }
    $('#payGo').prop('disabled', true).text('Processing...');
    api('POST', `/api/payments/${paymentId}/pay`, body)
      .done(() => { closeModal(); toast('Payment successful - booking confirmed'); if (done) done(true); })
      .fail((x) => { $('#payErr').text(errMsg(x)).show(); $('#payGo').prop('disabled', false).text('Pay now'); });
  });
}
