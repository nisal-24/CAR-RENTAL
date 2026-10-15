$(function () {
  const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'Van', 'Pickup', 'Luxury'];
  const lookups = { venues: [] };
  const yesNo = (v) => (v ? '<span class="badge ok">Yes</span>' : '<span class="badge bad">No</span>');

  /* ---------- CRUD resource definitions (Practical 01) ---------- */
  const RESOURCES = {
    vehicles: {
      label: 'Vehicles', singular: 'vehicle', url: '/api/vehicles',
      columns: [
        ['license_plate', 'Plate', (r) => `<span class="plate" style="font-size:.85rem">${esc(r.license_plate)}</span>`],
        ['make', 'Make'], ['model', 'Model'], ['year', 'Year'], ['type', 'Type'], ['seats', 'Seats'],
        ['daily_rate', 'Daily rate', (r) => esc(money(r.daily_rate))],
        ['venue_name', 'Branch'], ['status', 'Status', (r) => badge(r.status)],
      ],
      fields: [
        { name: 'make', label: 'Make', required: true }, { name: 'model', label: 'Model', required: true },
        { name: 'year', label: 'Year', type: 'number', min: 1990, max: new Date().getFullYear() + 1, required: true, default: new Date().getFullYear() },
        { name: 'license_plate', label: 'License plate', required: true },
        { name: 'type', label: 'Type', type: 'select', options: VEHICLE_TYPES, required: true },
        { name: 'seats', label: 'Seats', type: 'number', min: 1, max: 20, required: true, default: 5 },
        { name: 'daily_rate', label: 'Daily rate', type: 'number', min: 0, step: '0.01', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Available', 'Maintenance', 'Retired'], default: 'Available' },
        { name: 'venue_id', label: 'Home branch', type: 'select', options: () => lookups.venues.map((v) => [v.id, v.name]), blank: 'No branch' },
      ],
    },
    venues: {
      label: 'Venues', singular: 'venue', url: '/api/venues',
      columns: [['name', 'Name'], ['address', 'Address'], ['city', 'City'], ['phone', 'Phone'], ['opening_hours', 'Hours']],
      fields: [
        { name: 'name', label: 'Name', required: true }, { name: 'address', label: 'Address', required: true },
        { name: 'city', label: 'City', required: true }, { name: 'phone', label: 'Phone' }, { name: 'opening_hours', label: 'Opening hours' },
      ],
    },
    staff: {
      label: 'Staff', singular: 'staff member', url: '/api/staff',
      columns: [['name', 'Name'], ['position', 'Position'], ['email', 'Email'], ['phone', 'Phone'], ['venue_name', 'Branch'], ['active', 'Active', (r) => yesNo(r.active)]],
      fields: [
        { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone' }, { name: 'position', label: 'Position', required: true },
        { name: 'venue_id', label: 'Branch', type: 'select', options: () => lookups.venues.map((v) => [v.id, v.name]), blank: 'No branch' },
        { name: 'active', label: 'Active employee', type: 'checkbox', default: 1 },
      ],
    },
    packages: {
      label: 'Packages', singular: 'package', url: '/api/packages',
      columns: [['name', 'Name'], ['description', 'Description'], ['extra_daily_fee', 'Extra / day', (r) => esc(money(r.extra_daily_fee))],
        ['discount_percent', 'Discount', (r) => `${r.discount_percent}%`], ['min_days', 'Min days'], ['active', 'Active', (r) => yesNo(r.active)]],
      fields: [
        { name: 'name', label: 'Name', required: true }, { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'extra_daily_fee', label: 'Extra daily fee', type: 'number', min: 0, step: '0.01', default: 0 },
        { name: 'discount_percent', label: 'Discount %', type: 'number', min: 0, max: 100, step: '0.01', default: 0 },
        { name: 'min_days', label: 'Minimum days', type: 'number', min: 1, default: 1 },
        { name: 'active', label: 'Offered to customers', type: 'checkbox', default: 1 },
      ],
    },
    memberships: {
      label: 'Memberships', singular: 'membership tier', url: '/api/memberships',
      columns: [['name', 'Tier'], ['discount_percent', 'Discount', (r) => `${r.discount_percent}%`], ['annual_fee', 'Annual fee', (r) => esc(money(r.annual_fee))], ['benefits', 'Benefits']],
      fields: [
        { name: 'name', label: 'Tier name', required: true },
        { name: 'discount_percent', label: 'Discount %', type: 'number', min: 0, max: 100, step: '0.01', default: 0 },
        { name: 'annual_fee', label: 'Annual fee', type: 'number', min: 0, step: '0.01', default: 0 },
        { name: 'benefits', label: 'Benefits', type: 'textarea' },
      ],
    },
  };

  const TABS = [
    ['reports', 'Reports'], ['rentals', 'Rentals'], ['payments', 'Payments'], ['vehicles', 'Vehicles'], ['venues', 'Venues'],
    ['staff', 'Staff'], ['packages', 'Packages'], ['memberships', 'Memberships'], ['users', 'Users'], ['logs', 'Payment log'],
  ];

  const $panel = $('#panel');
  const loading = () => $panel.html('<p class="muted">Loading...</p>');
  const fail = (x) => toast(errMsg(x), true);

  $('#sidebar').html(TABS.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="false">${l}</button>`).join(''));
  $('#sidebar').on('click', 'button', function () { show($(this).data('tab')); });

  function show(tab) {
    $('#sidebar button').attr('aria-selected', 'false').filter(`[data-tab="${tab}"]`).attr('aria-selected', 'true');
    history.replaceState(null, '', `#${tab}`);
    loading();
    if (RESOURCES[tab]) return crudView(tab);
    ({ reports: reportsView, rentals: rentalsView, payments: paymentsView, users: usersView, logs: logsView })[tab]();
  }

  /* ================= generic CRUD view ================= */
  function crudView(key) {
    const R = RESOURCES[key];
    api('GET', R.url).done((rows) => {
      $panel.html(`
        <div class="toolbar"><h2>${R.label} <span class="muted" style="font-size:1rem">(${rows.length})</span></h2>
          <div style="display:flex;gap:.6rem"><input id="tblFilter" placeholder="Filter ${R.label.toLowerCase()}..." style="width:200px" aria-label="Filter"><button class="btn primary" id="addBtn" type="button">Add ${esc(R.singular)}</button></div></div>
        <div class="table-wrap"><table><thead><tr>${R.columns.map((c) => `<th>${esc(c[1])}</th>`).join('')}<th></th></tr></thead><tbody></tbody></table></div>`);
      const tb = $panel.find('tbody');
      if (!rows.length) tb.html(`<tr><td colspan="${R.columns.length + 1}" class="muted">No records yet.</td></tr>`);
      rows.forEach((r) => {
        tb.append(`<tr data-id="${r.id}">${R.columns.map(([k, , fn]) => `<td>${fn ? fn(r) : esc(r[k] ?? '-')}</td>`).join('')}
          <td class="actions"><button class="btn ghost sm edit" type="button">Edit</button> <button class="btn danger sm del" type="button">Delete</button></td></tr>`);
      });
      $('#tblFilter').on('input', function () {
        const q = this.value.toLowerCase();
        tb.find('tr').each(function () { $(this).toggle($(this).text().toLowerCase().includes(q)); });
      });
      $('#addBtn').on('click', () => formModal(key, null));
      tb.on('click', '.edit', function () { formModal(key, rows.find((r) => r.id === Number($(this).closest('tr').data('id')))); });
      tb.on('click', '.del', function () {
        const r = rows.find((x) => x.id === Number($(this).closest('tr').data('id')));
        if (!confirm(`Delete this ${R.singular}? This cannot be undone.`)) return;
        api('DELETE', `${R.url}/${r.id}`).done(() => { toast('Deleted'); afterChange(key); }).fail(fail);
      });
    }).fail(fail);
  }

  function afterChange(key) {
    if (key === 'venues') return loadLookups().always(() => crudView(key));
    crudView(key);
  }

  function fieldHtml(f, val) {
    const id = `f_${f.name}`;
    const req = f.required ? ' required' : '';
    const v = val ?? f.default ?? '';
    if (f.type === 'select') {
      const opts = (typeof f.options === 'function' ? f.options() : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
      const blank = f.blank !== undefined ? `<option value="">${esc(f.blank)}</option>` : '';
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}">${blank}${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'checkbox') return `<div class="field"><label><input type="checkbox" id="${id}" style="width:auto" ${Number(v) ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
    if (f.type === 'textarea') return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" rows="2" maxlength="255">${esc(v)}</textarea></div>`;
    const attrs = ['min', 'max', 'step'].filter((a) => f[a] !== undefined).map((a) => `${a}="${f[a]}"`).join(' ');
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" type="${f.type || 'text'}" value="${esc(v)}" ${attrs}${req}></div>`;
  }

  function formModal(key, row) {
    const R = RESOURCES[key];
    openModal(`
      <h2>${row ? 'Edit' : 'Add'} ${esc(R.singular)}</h2>
      <div class="form-error" id="formErr" hidden></div>
      <form id="crudForm" novalidate>
        <div class="grid-2">${R.fields.map((f) => fieldHtml(f, row ? row[f.name] : undefined)).join('')}</div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">${row ? 'Save changes' : 'Create'}</button></div>
      </form>`, true);
    $('#crudForm').on('submit', function (e) {
      e.preventDefault();
      const body = {};
      R.fields.forEach((f) => {
        const el = $(`#f_${f.name}`);
        if (f.type === 'checkbox') body[f.name] = el.is(':checked') ? 1 : 0;
        else if (f.type === 'number') body[f.name] = el.val() === '' ? '' : Number(el.val());
        else body[f.name] = el.val().trim ? el.val().trim() : el.val();
      });
      api(row ? 'PUT' : 'POST', row ? `${R.url}/${row.id}` : R.url, body)
        .done(() => { closeModal(); toast(row ? 'Changes saved' : 'Created'); afterChange(key); })
        .fail((x) => $('#formErr').text(errMsg(x)).show());
    });
  }

  /* ================= rentals ================= */
  function rentalsView() {
    api('GET', '/api/rentals').done((rows) => {
      $panel.html(`<div class="toolbar"><h2>Rentals <span class="muted" style="font-size:1rem">(${rows.length})</span></h2></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Customer</th><th>Vehicle</th><th>Dates</th><th>Route</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody></tbody></table></div>`);
      const tb = $panel.find('tbody');
      rows.forEach((r) => {
        const opts = ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'].map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('');
        tb.append(`<tr data-id="${r.id}"><td>${r.id}</td><td>${esc(r.customer_name)}<br><span class="muted">${esc(r.customer_email)}</span></td>
          <td>${esc(r.vehicle_name)}<br><span class="plate" style="font-size:.8rem">${esc(r.license_plate)}</span></td>
          <td>${esc(r.start_date)}<br><span class="muted">to ${esc(r.end_date)} (${r.days}d)</span></td>
          <td>${esc(r.pickup_venue)}<br><span class="muted">to ${esc(r.dropoff_venue)}</span></td>
          <td>${esc(money(r.total_amount))}</td>
          <td><select class="rstatus" data-prev="${esc(r.status)}" style="width:auto" aria-label="Rental status">${opts}</select></td>
          <td>${badge(r.payment_status)}</td></tr>`);
      });
      tb.on('change', '.rstatus', function () {
        const sel = $(this); const id = sel.closest('tr').data('id'); const status = sel.val();
        const req = status === 'Cancelled' ? api('POST', `/api/rentals/${id}/cancel`) : api('PATCH', `/api/rentals/${id}/status`, { status });
        req.done(() => { toast(`Rental #${id} is now ${status}`); rentalsView(); }).fail((x) => { toast(errMsg(x), true); sel.val(sel.data('prev')); });
      });
    }).fail(fail);
  }

  /* ================= payments ================= */
  function paymentsView() {
    api('GET', '/api/payments').done((rows) => {
      $panel.html(`<div class="toolbar"><h2>Payments <span class="muted" style="font-size:1rem">(${rows.length})</span></h2></div>
        <div class="table-wrap"><table><thead><tr><th>Ref</th><th>Customer</th><th>Vehicle</th><th>Amount</th><th>Method</th><th>Status</th><th>Paid at</th><th></th></tr></thead><tbody></tbody></table></div>`);
      const tb = $panel.find('tbody');
      rows.forEach((p) => {
        tb.append(`<tr data-id="${p.id}"><td>${esc(p.transaction_ref || '-')}</td><td>${esc(p.customer_name)}</td><td>${esc(p.vehicle_name)}<br><span class="muted">rental #${p.rental_id}</span></td>
          <td>${esc(money(p.amount))}</td><td>${esc(p.method || '-')}${p.card_last4 ? ` <span class="muted">**** ${esc(p.card_last4)}</span>` : ''}</td>
          <td>${badge(p.status)}</td><td>${esc(p.paid_at || '-')}</td>
          <td class="actions">${p.status === 'Paid' ? '<button class="btn danger sm refund" type="button">Refund</button>' : ''}
            ${p.status === 'Pending' && p.rental_status !== 'Cancelled' ? '<button class="btn ghost sm cash" type="button">Record cash</button>' : ''}</td></tr>`);
      });
      tb.on('click', '.refund', function () {
        const id = $(this).closest('tr').data('id');
        if (!confirm('Refund this payment and cancel the rental?')) return;
        api('POST', `/api/payments/${id}/refund`).done(() => { toast('Payment refunded'); paymentsView(); }).fail(fail);
      });
      tb.on('click', '.cash', function () {
        const id = $(this).closest('tr').data('id');
        if (!confirm('Record a cash payment received at the counter?')) return;
        api('POST', `/api/payments/${id}/pay`, { method: 'Cash' }).done(() => { toast('Cash payment recorded'); paymentsView(); }).fail(fail);
      });
    }).fail(fail);
  }

  function logsView() {
    api('GET', '/api/payments/logs').done((rows) => {
      $panel.html(`<div class="toolbar"><h2>Payment transaction log</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Time</th><th>Transaction</th><th>Event</th><th>Amount</th><th>Message</th></tr></thead><tbody>
        ${rows.map((l) => `<tr><td>${esc(l.created_at)}</td><td>${esc(l.transaction_ref)}</td><td>${badge(l.event.charAt(0) + l.event.slice(1).toLowerCase())}</td><td>${l.amount != null ? esc(money(l.amount)) : '-'}</td><td>${esc(l.message)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No log entries.</td></tr>'}
        </tbody></table></div>`);
    }).fail(fail);
  }

  /* ================= users ================= */
  function usersView() {
    api('GET', '/api/users').done((rows) => {
      $panel.html(`<div class="toolbar"><h2>Users <span class="muted" style="font-size:1rem">(${rows.length})</span></h2></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Membership</th><th>Joined</th><th>Role</th></tr></thead><tbody></tbody></table></div>`);
      const tb = $panel.find('tbody');
      rows.forEach((u) => {
        const self = currentUser && u.id === currentUser.id;
        tb.append(`<tr data-id="${u.id}"><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone || '-')}</td><td>${esc(u.membership_name || '-')}</td><td>${esc((u.created_at || '').slice(0, 10))}</td>
          <td><select class="urole" style="width:auto" ${self ? 'disabled title="You cannot change your own role"' : ''} data-prev="${u.role}" aria-label="Role"><option ${u.role === 'customer' ? 'selected' : ''}>customer</option><option ${u.role === 'admin' ? 'selected' : ''}>admin</option></select></td></tr>`);
      });
      tb.on('change', '.urole', function () {
        const sel = $(this); const id = sel.closest('tr').data('id');
        if (!confirm(`Change role to "${sel.val()}"?`)) return sel.val(sel.data('prev'));
        api('PUT', `/api/users/${id}/role`, { role: sel.val() }).done(() => toast('Role updated')).fail((x) => { toast(errMsg(x), true); sel.val(sel.data('prev')); });
      });
    }).fail(fail);
  }

  /* ================= reports (Practical 02) ================= */
  function reportsView() {
    const state = { from: '', to: '' };
    function load() {
      const qs = $.param(Object.fromEntries(Object.entries(state).filter(([, v]) => v)));
      api('GET', `/api/reports/overview?${qs}`).done((d) => {
        const s = d.summary;
        const maxRev = Math.max(1, ...d.byMonth.map((m) => m.revenue));
        $panel.html(`
          <div class="toolbar"><h2>Rental &amp; revenue report</h2>
            <div style="display:flex;gap:.6rem;flex-wrap:wrap">
              <a class="btn" id="csvBtn" href="/api/reports/export.csv${qs ? `?${qs}` : ''}">Export CSV</a>
              <button class="btn ghost" id="printBtn" type="button">Print / PDF</button></div></div>
          <div class="panel"><div class="filters">
            <div class="field"><label for="rFrom">Pick-up from</label><input type="date" id="rFrom" value="${esc(state.from)}"></div>
            <div class="field"><label for="rTo">Pick-up to</label><input type="date" id="rTo" value="${esc(state.to)}"></div>
            <button class="btn" id="rApply" type="button">Apply</button><button class="btn ghost" id="rClear" type="button">Clear</button></div></div>
          <div class="stats">
            <div class="stat revenue"><b>${esc(money(s.revenue))}</b><span>Revenue collected</span></div>
            <div class="stat"><b>${esc(money(s.pending_amount))}</b><span>Awaiting payment</span></div>
            <div class="stat"><b>${esc(money(s.refunded_amount))}</b><span>Refunded</span></div>
            <div class="stat"><b>${s.total_rentals || 0}</b><span>Total rentals</span></div>
            <div class="stat"><b>${s.open_rentals || 0}</b><span>Open (pending / confirmed / active)</span></div>
            <div class="stat"><b>${s.completed_rentals || 0}</b><span>Completed</span></div>
            <div class="stat"><b>${s.cancelled_rentals || 0}</b><span>Cancelled</span></div>
          </div>
          <div class="report-grid">
            <div class="panel"><h3>Revenue by month</h3>
              ${d.byMonth.map((m) => `<div class="bar-row"><span>${esc(m.month)}</span><div class="bar"><i style="width:${(m.revenue / maxRev) * 100}%"></i></div><span style="text-align:right">${esc(money(m.revenue))}</span></div>`).join('') || '<p class="muted">No data in this range.</p>'}</div>
            <div class="panel"><h3>Top vehicles</h3>
              <table><thead><tr><th>Vehicle</th><th>Rentals</th><th>Days</th><th>Revenue</th></tr></thead><tbody>
              ${d.topVehicles.map((v) => `<tr><td>${esc(v.vehicle)}<br><span class="muted">${esc(v.license_plate)}</span></td><td>${v.rentals}</td><td>${v.rented_days}</td><td>${esc(money(v.revenue))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No data.</td></tr>'}</tbody></table></div>
            <div class="panel"><h3>Performance by pick-up branch</h3>
              <table><thead><tr><th>Branch</th><th>Rentals</th><th>Revenue</th></tr></thead><tbody>
              ${d.byVenue.map((v) => `<tr><td>${esc(v.venue)}</td><td>${v.rentals}</td><td>${esc(money(v.revenue))}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No data.</td></tr>'}</tbody></table></div>
          </div>`);
        $('#rApply').on('click', () => { state.from = $('#rFrom').val(); state.to = $('#rTo').val(); load(); });
        $('#rClear').on('click', () => { state.from = ''; state.to = ''; load(); });
        $('#printBtn').on('click', () => window.print());
      }).fail(fail);
    }
    load();
  }

  function loadLookups() {
    return api('GET', '/api/venues').done((rows) => { lookups.venues = rows; });
  }

  loadUser(() => {
    if (!currentUser || currentUser.role !== 'admin') { location.href = '/login?next=/admin'; return; }
    loadLookups().always(() => {
      const start = location.hash.slice(1);
      show(TABS.some(([k]) => k === start) ? start : 'reports');
    });
  });
});
