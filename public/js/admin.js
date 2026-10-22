(async function () {
  const user = await requireRole('admin').catch(() => null);
  if (!user) return;
  const cfg = await getConfig();

  const $ = (id) => document.getElementById(id);
  $('town').textContent = cfg.townName;
  $('logout').addEventListener('click', logout);

  const state = { tab: 'alerts', alerts: [], drivers: [], trips: [] };

  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      render();
    })
  );

  const mapsLink = (p) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  const when = (iso) => (iso ? new Date(`${iso.replace(' ', 'T')}Z`).toLocaleString(lang) : '');

  function render() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    for (const tab of ['alerts', 'drivers', 'trips']) $(`tab-${tab}`).hidden = tab !== state.tab;

    const open = state.alerts.filter((a) => !a.resolvedAt).length;
    $('alerts-count').hidden = !open;
    $('alerts-count').textContent = open;
    const pending = state.drivers.filter((d) => !d.verified).length;
    $('pending-count').hidden = !pending;
    $('pending-count').textContent = pending;

    renderAlerts();
    renderDrivers();
    renderTrips();
  }

  function renderAlerts() {
    if (!state.alerts.length) return $('tab-alerts').replaceChildren(el('p', { class: 'muted' }, t('noAlerts')));
    $('tab-alerts').replaceChildren(
      ...state.alerts.map((a) => {
        const trip = a.trip;
        return el(
          'div',
          { class: `list-item ${a.type === 'sos' && !a.resolvedAt ? 'alert-sos' : ''}` },
          el(
            'div',
            { class: 'title' },
            el('span', {}, a.type === 'sos' ? t('sosAlert') : t('reportAlert')),
            el('span', { class: 'muted' }, when(a.createdAt))
          ),
          el('div', {}, `${a.user.name} (${a.user.role === 'driver' ? t('iAmDriver') : t('passenger')}) · `, el('a', { href: `tel:${a.user.phone}` }, a.user.phone)),
          a.user.emergencyContact ? el('div', { class: 'muted' }, `${t('emergencyContact')}: `, el('a', { href: `tel:${a.user.emergencyContact}` }, a.user.emergencyContact)) : null,
          a.message ? el('div', {}, `💬 ${a.message}`) : null,
          a.location ? el('a', { href: mapsLink(a.location), target: '_blank', rel: 'noopener' }, `📍 ${coords(a.location)}`) : null,
          trip ? tripSummary(trip) : null,
          a.resolvedAt
            ? el('span', { class: 'badge ok' }, `${t('resolved')} · ${when(a.resolvedAt)}`)
            : el('button', { class: 'btn small', type: 'button', onclick: () => resolveAlert(a.id) }, t('resolve'))
        );
      })
    );
  }

  function tripSummary(trip) {
    return el(
      'div',
      { class: 'muted', style: 'margin-top:6px' },
      `#${trip.id} · ${t(`status_${trip.status}`)} · ${money(trip.fare, trip.currency)}`,
      el('br'),
      `📍 ${trip.pickup.address || coords(trip.pickup)} → 🏁 ${trip.dropoff.address || coords(trip.dropoff)}`,
      el('br'),
      `${t('passenger')}: ${trip.passenger.name} (${trip.passenger.phone})`,
      trip.driver ? el('span', {}, el('br'), `🚕 ${trip.driver.name} · `, el('strong', {}, trip.driver.plate), ` · ${trip.driver.phone}`) : null,
      trip.driver && trip.driver.location
        ? el('span', {}, ' · ', el('a', { href: mapsLink(trip.driver.location), target: '_blank', rel: 'noopener' }, '🚕📍'))
        : null,
      ' · ',
      el('a', { href: `/seguimiento.html?t=${trip.shareToken}`, target: '_blank', rel: 'noopener' }, t('trackTitle'))
    );
  }

  function renderDrivers() {
    if (!state.drivers.length) return $('tab-drivers').replaceChildren(el('p', { class: 'muted' }, t('noDrivers')));
    $('tab-drivers').replaceChildren(
      ...state.drivers.map((d) =>
        el(
          'div',
          { class: 'list-item' },
          driverCard(d, { showPhone: true }),
          el(
            'div',
            { class: 'row', style: 'align-items:center' },
            el('span', { class: `badge ${d.verified ? 'ok' : 'warn'}` }, d.verified ? t('verified') : t('pending')),
            d.verified ? el('span', { class: 'muted' }, el('span', { class: `dot ${d.online ? 'on' : ''}` }), t(d.online ? 'online' : 'offline')) : el('span'),
            el(
              'button',
              { class: `btn small ${d.verified ? 'danger' : 'ok'}`, type: 'button', onclick: () => setVerified(d.id, !d.verified) },
              d.verified ? t('revoke') : t('verify')
            )
          )
        )
      )
    );
  }

  function renderTrips() {
    if (!state.trips.length) return $('tab-trips').replaceChildren(el('p', { class: 'muted' }, t('noTrips')));
    $('tab-trips').replaceChildren(
      ...state.trips.map((trip) =>
        el(
          'div',
          { class: 'list-item' },
          el('div', { class: 'title' }, el('span', {}, t(`status_${trip.status}`)), el('span', { class: 'muted' }, when(trip.createdAt))),
          tripSummary(trip),
          trip.rating ? el('div', {}, '★'.repeat(trip.rating)) : null
        )
      )
    );
  }

  async function resolveAlert(id) {
    const { alert } = await api('POST', `/api/admin/alerts/${id}/resolve`);
    state.alerts = state.alerts.map((a) => (a.id === id ? alert : a));
    render();
  }

  async function setVerified(id, verified) {
    if (!verified && !confirm(`${t('revoke')}?`)) return;
    const { driver } = await api('POST', `/api/admin/drivers/${id}/verify`, { verified });
    state.drivers = state.drivers.map((d) => (d.id === id ? driver : d));
    render();
  }

  async function loadAll() {
    const [alerts, drivers, trips] = await Promise.all([
      api('GET', '/api/admin/alerts'),
      api('GET', '/api/admin/drivers'),
      api('GET', '/api/admin/trips'),
    ]);
    state.alerts = alerts.alerts;
    state.drivers = drivers.drivers;
    state.trips = trips.trips;
    render();
  }

  // Tiempo real
  const socket = connectSocket();
  socket.on('alert:new', (a) => {
    state.alerts.unshift(a);
    if (a.type === 'sos') {
      vibrate([500, 200, 500, 200, 500]);
      toast(`${t('sosAlert')}: ${a.user.name}`, 'error');
      state.tab = 'alerts';
    }
    render();
  });
  socket.on('driver:registered', (d) => {
    state.drivers.unshift(d);
    render();
  });
  socket.on('trip:update', (trip) => {
    const i = state.trips.findIndex((x) => x.id === trip.id);
    if (i >= 0) state.trips[i] = trip;
    else state.trips.unshift(trip);
    if (state.tab === 'trips') renderTrips();
  });
  socket.on('connect', () => loadAll().catch(() => {}));

  setupLangToggle(render);
  applyI18n();
  await loadAll();
})();
