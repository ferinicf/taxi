(async function () {
  const token = new URLSearchParams(location.search).get('t') || '';
  const cfg = await getConfig();
  const map = createMap('map', cfg.mapCenter, cfg.mapZoom);
  const markers = { pickup: null, dropoff: null, taxi: null };
  const box = document.getElementById('trip');
  let trip = null;
  let lastUpdate = null;

  function render() {
    if (!trip) {
      box.replaceChildren(el('h2', {}, t('tripNotFound')));
      return;
    }
    const live = ['accepted', 'arrived', 'in_progress'].includes(trip.status);
    box.replaceChildren(
      el('div', { class: 'status-line' }, t(`status_${trip.status}`)),
      trip.driver ? driverCard(trip.driver) : null,
      el('p', { class: 'muted' }, `📍 ${trip.pickup.address || coords(trip.pickup)}`, el('br'), `🏁 ${trip.dropoff.address || coords(trip.dropoff)}`),
      live && lastUpdate ? el('p', { class: 'muted' }, `${t('lastUpdate')}: ${lastUpdate.toLocaleTimeString(lang)}`) : null,
      live ? el('a', { class: 'btn danger', href: `tel:${cfg.emergencyNumber}` }, `🚨 ${t('call')} ${cfg.emergencyNumber}`) : null
    );
  }

  function show(next) {
    trip = next;
    markers.pickup = setMarker(map, markers.pickup, trip.pickup, 'pickup');
    markers.dropoff = setMarker(map, markers.dropoff, trip.dropoff, 'dropoff');
    const loc = trip.driver && trip.driver.location;
    if (loc) lastUpdate = new Date(`${loc.updatedAt.replace(' ', 'T')}Z`);
    markers.taxi = setMarker(map, markers.taxi, ['accepted', 'arrived', 'in_progress'].includes(trip.status) ? loc : null, 'taxi');
    render();
  }

  try {
    const data = await api('GET', `/api/track/${encodeURIComponent(token)}`);
    show(data.trip);
    fitPoints(map, [trip.pickup, trip.dropoff, trip.driver && trip.driver.location]);
  } catch {
    render();
  }

  if (trip) {
    // eslint-disable-next-line no-undef
    const socket = io();
    socket.on('connect', () => socket.emit('track:join', token));
    socket.on('trip:update', show);
    socket.on('driver:location', (loc) => {
      if (!['accepted', 'arrived', 'in_progress'].includes(trip.status)) return;
      lastUpdate = new Date(loc.at);
      markers.taxi = setMarker(map, markers.taxi, loc, 'taxi');
      render();
    });
  }

  setupLangToggle(render);
  applyI18n();
})();
