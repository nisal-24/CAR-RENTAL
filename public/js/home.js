$(function () {
  let venues = [];
  let packages = [];
  let vehicles = [];
  let searched = null; // { start, end } of the last dated search

  const today = todayISO();
  $('#fStart').attr('min', today);
  $('#fEnd').attr('min', addDays(today, 1));
  $('#fStart').on('change', function () {
    if (!this.value) return;
    $('#fEnd').attr('min', addDays(this.value, 1));
    if (!$('#fEnd').val() || $('#fEnd').val() <= this.value) $('#fEnd').val(addDays(this.value, 1));
  });

  loadUser();
  api('GET', '/api/venues').done((rows) => {
    venues = rows;
    rows.forEach((v) => $('#fVenue').append(`<option value="${v.id}">${esc(v.name)}</option>`));
  });
  api('GET', '/api/vehicles/types').done((types) => types.forEach((t) => $('#fType').append(`<option>${esc(t)}</option>`)));
  api('GET', '/api/packages').done((rows) => { packages = rows; });

  function render() {
    const box = $('#results').empty();
    if (!vehicles.length) {
      box.html('<div class="empty"><h3>No cars match those filters</h3><p>Try different dates, another branch or a different vehicle type.</p></div>');
      return;
    }
    vehicles.forEach((v) => {
      box.append(`
        <article class="vehicle-row">
          <div><span class="plate">${esc(v.license_plate)}</span></div>
          <div>
            <h3>${esc(v.make)} ${esc(v.model)} <span class="muted" style="font-weight:400">${esc(v.year)}</span></h3>
            <div class="vehicle-meta"><span>${esc(v.type)}</span><span>${esc(v.seats)} seats</span><span>${esc(v.venue_name || 'Branch to be confirmed')}</span></div>
          </div>
          <div class="price"><strong>${esc(money(v.daily_rate))}</strong><small>per day</small><br>
            <button class="btn primary sm book" data-id="${v.id}" style="margin-top:.4rem">Book</button></div>
        </article>`);
    });
  }

  function search(e) {
    if (e) e.preventDefault();
    $('#formErr').hide();
    const start = $('#fStart').val();
    const end = $('#fEnd').val();
    if ((start && !end) || (!start && end)) return $('#formErr').text('Please choose both a pick-up and a return date.').show();
    if (start && end && end <= start) return $('#formErr').text('The return date must be after the pick-up date.').show();

    const params = { venue_id: $('#fVenue').val(), type: $('#fType').val(), q: $('#fQ').val().trim(), max_price: $('#fMax').val(), start, end };
    Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

    api('GET', `/api/vehicles?${$.param(params)}`)
      .done((rows) => {
        vehicles = rows;
        searched = start && end ? { start, end } : null;
        $('#resultsTitle').text(searched ? 'Available for your dates' : 'Our fleet');
        $('#resultsNote').text(`${rows.length} car${rows.length === 1 ? '' : 's'}${searched ? ` free ${start} to ${end}` : ''}`);
        render();
      })
      .fail((x) => $('#formErr').text(errMsg(x)).show());
  }
  $('#searchForm').on('submit', search);
  search();

  /* ---------- booking flow ---------- */
  $('#results').on('click', '.book', function () {
    const v = vehicles.find((x) => x.id === Number($(this).data('id')));
    if (!searched) {
      $('#formErr').text('Choose your pick-up and return dates, then search - we only book cars that are free on those dates.').show();
      $('#fStart').trigger('focus');
      return window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (!currentUser) { location.href = `/login?next=${encodeURIComponent('/')}`; return; }
    openBooking(v);
  });

  function openBooking(v) {
    const pkgOptions = ['<option value="">No package</option>']
      .concat(packages.map((p) => `<option value="${p.id}">${esc(p.name)}${p.extra_daily_fee > 0 ? ` (+${esc(money(p.extra_daily_fee))}/day)` : ''}${p.discount_percent > 0 ? ` (-${p.discount_percent}%)` : ''}${p.min_days > 1 ? ` - min ${p.min_days} days` : ''}</option>`)).join('');
    const venueOptions = venues.map((x) => `<option value="${x.id}" ${x.id === v.venue_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

    openModal(`
      <h2>Book ${esc(v.make)} ${esc(v.model)}</h2>
      <p class="muted"><span class="plate" style="font-size:.95rem">${esc(v.license_plate)}</span>
         &nbsp; ${esc(searched.start)} to ${esc(searched.end)} &nbsp;|&nbsp; Pick-up: ${esc(v.venue_name || '-')}</p>
      <div class="form-error" id="bkErr" hidden></div>
      <div class="field"><label for="bkDrop">Drop-off branch</label><select id="bkDrop">${venueOptions}</select></div>
      <div class="field"><label for="bkPkg">Package</label><select id="bkPkg">${pkgOptions}</select></div>
      <div class="quote" id="bkQuote" aria-live="polite">Calculating price...</div>
      <div class="modal-actions">
        <button class="btn ghost" data-close type="button">Cancel</button>
        <button class="btn primary" id="bkConfirm" type="button" disabled>Confirm booking</button>
      </div>`);

    const payload = () => ({
      vehicle_id: v.id, package_id: $('#bkPkg').val() || undefined,
      start_date: searched.start, end_date: searched.end,
    });

    function quote() {
      $('#bkErr').hide();
      $('#bkConfirm').prop('disabled', true);
      api('POST', '/api/rentals/quote', payload())
        .done((q) => {
          let rows = `<dt>Daily rate x ${q.days} day${q.days > 1 ? 's' : ''}</dt><dd>${esc(money(q.daily_rate * q.days))}</dd>`;
          if (q.extra_daily_fee > 0) rows += `<dt>${esc(q.package_name)} (${esc(money(q.extra_daily_fee))} x ${q.days})</dt><dd>${esc(money(q.extra_daily_fee * q.days))}</dd>`;
          rows += `<dt>Subtotal</dt><dd>${esc(money(q.subtotal))}</dd>`;
          if (q.package_discount > 0) rows += `<dt>Package discount</dt><dd>${q.package_discount}%</dd>`;
          if (q.member_discount > 0) rows += `<dt>Membership discount</dt><dd>${q.member_discount}%</dd>`;
          if (q.discount_amount > 0) rows += `<dt>You save</dt><dd>- ${esc(money(q.discount_amount))}</dd>`;
          rows += `<dt class="total">Total</dt><dd class="total">${esc(money(q.total))}</dd>`;
          $('#bkQuote').html(`<dl>${rows}</dl>`);
          $('#bkConfirm').prop('disabled', false);
        })
        .fail((x) => { $('#bkQuote').text('-'); $('#bkErr').text(errMsg(x)).show(); });
    }
    $('#bkPkg').on('change', quote);
    quote();

    $('#bkConfirm').on('click', function () {
      $(this).prop('disabled', true).text('Booking...');
      api('POST', '/api/rentals', { ...payload(), pickup_venue_id: v.venue_id || undefined, dropoff_venue_id: Number($('#bkDrop').val()) })
        .done((r) => {
          closeModal();
          toast('Booking created - complete payment to confirm it');
          payDialog(r.payment_id, r.total, () => { location.href = '/my-rentals'; });
          $('#modal').on('click', '[data-close]', () => { location.href = '/my-rentals'; });
        })
        .fail((x) => { $('#bkErr').text(errMsg(x)).show(); $('#bkConfirm').prop('disabled', false).text('Confirm booking'); search(); });
    });
  }
});
