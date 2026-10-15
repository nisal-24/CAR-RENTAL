$(function () {
  let rentals = [];
  let memberships = [];

  function loadMembership() {
    api('GET', '/api/memberships').done((rows) => {
      memberships = rows;
      $('#memSelect').html(rows.map((m) => `<option value="${m.id}">${esc(m.name)} - ${m.discount_percent}% off${m.annual_fee > 0 ? ` (${esc(money(m.annual_fee))}/yr)` : ''}</option>`).join(''));
      if (currentUser) $('#memSelect').val(currentUser.membership_id);
    });
    if (currentUser) $('#memText').html(`You are on <b>${esc(currentUser.membership_name || 'Standard')}</b> - ${currentUser.membership_discount || 0}% off every rental.`);
  }

  function load() {
    api('GET', '/api/rentals/mine').done((rows) => {
      rentals = rows;
      const tb = $('#rows').empty();
      if (!rows.length) return tb.html('<tr><td colspan="9"><div class="empty">No rentals yet. <a href="/">Find a car</a></div></td></tr>');
      rows.forEach((r) => {
        const canPay = r.payment_status === 'Pending' && r.status !== 'Cancelled';
        const canCancel = ['Pending', 'Confirmed'].includes(r.status);
        tb.append(`<tr>
          <td>${r.id}</td>
          <td><b>${esc(r.vehicle_name)}</b><br><span class="plate" style="font-size:.8rem">${esc(r.license_plate)}</span></td>
          <td>${esc(r.start_date)}<br><span class="muted">to ${esc(r.end_date)} (${r.days}d)</span></td>
          <td>${esc(r.pickup_venue)}<br><span class="muted">to ${esc(r.dropoff_venue)}</span></td>
          <td>${esc(r.package_name || '-')}</td>
          <td>${esc(money(r.total_amount))}</td>
          <td>${badge(r.status)}</td>
          <td>${badge(r.payment_status)}</td>
          <td class="actions">
            ${canPay ? `<button class="btn primary sm pay" data-id="${r.id}">Pay</button>` : ''}
            ${canCancel ? `<button class="btn ghost sm cancel" data-id="${r.id}">Cancel</button>` : ''}
          </td></tr>`);
      });
    }).fail((x) => toast(errMsg(x), true));
  }

  $('#rows').on('click', '.pay', function () {
    const r = rentals.find((x) => x.id === Number($(this).data('id')));
    payDialog(r.payment_id, r.total_amount, load);
  });
  $('#rows').on('click', '.cancel', function () {
    const r = rentals.find((x) => x.id === Number($(this).data('id')));
    const refundNote = r.payment_status === 'Paid' ? ' Your payment will be refunded in full.' : '';
    if (!confirm(`Cancel booking #${r.id} for ${r.vehicle_name}?${refundNote}`)) return;
    api('POST', `/api/rentals/${r.id}/cancel`).done(() => { toast('Booking cancelled'); load(); }).fail((x) => toast(errMsg(x), true));
  });

  $('#memSave').on('click', () => {
    api('PUT', '/api/auth/membership', { membership_id: Number($('#memSelect').val()) })
      .done((r) => { currentUser = r.user; loadMembership(); toast('Membership updated'); })
      .fail((x) => toast(errMsg(x), true));
  });

  loadUser(() => { loadMembership(); load(); });
});
