(async function () {
  let user = await requireRole('driver').catch(() => null);
  if (!user) return;
  const cfg = await getConfig();

  const $ = (id) => document.getElementById(id);
  $('driver-name').textContent = user.name;
  $('logout').addEventListener('click', async () => {
    if (user.driver.online) await api('POST', '/api/driver/status', { online: false }).catch(() => {});
    logout();
  });

  const map = createMap('map', cfg.mapCenter, cfg.mapZoom);
  const markers = { me: null, pickup: null, dropoff: null };
  const state = { requests: new Map(), trip: null, position: null, lastSent: 0, watchId: null, wakeLock: null };
  const socket = connectSocket();

  // ---------- Ubicación ----------

  function startTracking() {
    if (state.watchId != null || !navigator.geolocation) return;
    state.watchId = navigator.geolocation.watchPosition(
      (p) => {
        $('location-warning').hidden = true;
        state.position = { lat: p.coords.latitude, lng: p.coords.longitude };
        markers.me = setMarker(map, markers.me, state.position, 'taxi');
        // Enviar como máximo cada 4 segundos
        if (Date.now() - state.lastSent > 4000) {
          state.lastSent = Date.now();
          socket.emit('driver:location', state.position);
        }
      },
      () => ($('location-warning').hidden = false),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  function stopTracking() {
    if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }

  async function keepScreenOn(on) {
    try {
      if (on && 'wakeLock' in navigator && !state.wakeLock) state.wakeLock = await navigator.wakeLock.request('screen');
      if (!on && state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
      }
    } catch {
      /* no soportado */
    }
  }

  // ---------- Vistas ----------

  function render() {
    const verified = user.driver.verified;
    $('pending-view').hidden = verified;
    $('online-view').hidden = !verified || !!state.trip;
    $('trip-view').hidden = !state.trip;
    $('sos').hidden = !(state.trip && ['accepted', 'arrived', 'in_progress'].includes(state.trip.status));

    const online = user.driver.online;
    $('online-dot').classList.toggle('on', online);
    $('online-label').textContent = t(online ? 'online' : 'offline');
    $('online-btn').textContent = t(online ? 'goOffline' : 'goOnline');
    $('online-btn').className = `btn small ${online ? 'ghost' : 'ok'}`;
    $('requests-wrap').hidden = !online;

    renderRequests();
    if (state.trip) renderTrip();
  }

  function renderRequests() {
    const items = [...state.requests.values()].sort((a, b) => (a.distanceToPickupKm ?? 0) - (b.distanceToPickupKm ?? 0));
    if (!items.length) {
      $('requests').replaceChildren(el('p', { class: 'muted' }, t('noRequests')));
      return;
    }
    $('requests').replaceChildren(
      ...items.map((r) =>
        el(
          'div',
          { class: 'list-item' },
          el(
            'div',
            { class: 'title' },
            el('span', {}, `📍 ${r.pickup.address || coords(r.pickup)}`),
            el('span', {}, money(r.fare, r.currency))
          ),
          el('div', { class: 'muted' }, `🏁 ${r.dropoff.address || coords(r.dropoff)}`),
          el(
            'div',
            { class: 'muted' },
            `${r.distanceKm} km`,
            r.distanceToPickupKm != null ? ` · ${t('awayKm', { km: r.distanceToPickupKm })}` : '',
            ` · ${r.passenger.name}`
          ),
          r.notes ? el('div', { class: 'muted' }, `💬 ${r.notes}`) : null,
          el('button', { class: 'btn accent', type: 'button', onclick: () => acceptTrip(r.id) }, t('accept'))
        )
      )
    );
  }

  function renderTrip() {
    const trip = state.trip;
    const s = trip.status;
    const target = s === 'in_progress' ? trip.dropoff : trip.pickup;
    const parts = [
      el('div', { class: 'status-line' }, t(`drv_status_${s}`)),
      el(
        'div',
        { class: 'list-item' },
        el('div', { class: 'title' }, `${t('passenger')}: ${trip.passenger.name}`),
        el('div', { class: 'muted' }, `📍 ${trip.pickup.address || coords(trip.pickup)}`),
        el('div', { class: 'muted' }, `🏁 ${trip.dropoff.address || coords(trip.dropoff)}`),
        trip.notes ? el('div', { class: 'muted' }, `💬 ${trip.notes}`) : null,
        el(
          'div',
          { class: 'row' },
          trip.passenger.phone && s !== 'completed'
            ? el('a', { class: 'btn small ghost', href: `tel:${trip.passenger.phone}` }, `📞 ${t('call')}`)
            : null,
          s !== 'completed'
            ? el(
                'a',
                {
                  class: 'btn small ghost',
                  target: '_blank',
                  rel: 'noopener',
                  href: `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`,
                },
                `🧭 ${t('navigate')}`
              )
            : null
        )
      ),
      el(
        'div',
        { class: 'fare-box' },
        el('div', { class: 'muted' }, s === 'completed' ? t('collect') : t('estimate')),
        el('div', { class: 'price' }, money(trip.fare, trip.currency))
      ),
    ];

    if (s === 'accepted') {
      parts.push(el('button', { class: 'btn accent', type: 'button', onclick: () => tripAction('arrived') }, t('imHere')));
    }
    if (s === 'accepted' || s === 'arrived') {
      const pinInput = el('input', {
        class: 'pin-input',
        inputmode: 'numeric',
        maxlength: '4',
        autocomplete: 'off',
        'aria-label': t('enterPin'),
        placeholder: '••••',
      });
      parts.push(
        el('label', {}, t('enterPin')),
        pinInput,
        el('button', { class: 'btn ok', type: 'button', onclick: () => tripAction('start', { pin: pinInput.value }) }, t('startTrip')),
        el('button', { class: 'btn ghost', type: 'button', onclick: releaseTrip }, t('releaseTrip'))
      );
    }
    if (s === 'in_progress') {
      parts.push(el('button', { class: 'btn ok', type: 'button', onclick: () => tripAction('complete') }, t('finishTrip')));
    }
    if (s === 'completed' || s === 'cancelled') {
      parts.push(el('button', { class: 'btn accent', type: 'button', onclick: closeTrip }, 'OK'));
    }
    $('trip-view').replaceChildren(...parts);
  }

  function showTripOnMap() {
    const trip = state.trip;
    const active = trip && ['accepted', 'arrived', 'in_progress'].includes(trip.status);
    markers.pickup = setMarker(map, markers.pickup, active ? trip.pickup : null, 'pickup');
    markers.dropoff = setMarker(map, markers.dropoff, active ? trip.dropoff : null, 'dropoff');
    if (active) fitPoints(map, [state.position, trip.status === 'in_progress' ? trip.dropoff : trip.pickup]);
  }

  // ---------- Acciones ----------

  $('online-btn').addEventListener('click', async () => {
    const online = !user.driver.online;
    $('online-btn').disabled = true;
    try {
      if (online) startTracking();
      const res = await api('POST', '/api/driver/status', { online, ...(state.position || {}) });
      user = res.user;
      if (online) await loadRequests();
      else {
        stopTracking();
        state.requests.clear();
      }
      keepScreenOn(online);
      render();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      $('online-btn').disabled = false;
    }
  });

  async function loadRequests() {
    const { requests } = await api('GET', '/api/driver/requests');
    state.requests = new Map(requests.map((r) => [r.id, r]));
  }

  async function acceptTrip(id) {
    try {
      const { trip } = await api('POST', `/api/trips/${id}/accept`);
      state.requests.delete(id);
      setTrip(trip);
    } catch (err) {
      state.requests.delete(id);
      toast(errorText(err), 'error');
      render();
    }
  }

  async function tripAction(action, body) {
    try {
      const { trip } = await api('POST', `/api/trips/${state.trip.id}/${action}`, body);
      setTrip(trip);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  async function releaseTrip() {
    if (!confirm(t('cancelConfirm'))) return;
    try {
      await api('POST', `/api/trips/${state.trip.id}/cancel`);
      closeTrip();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  async function closeTrip() {
    state.trip = null;
    showTripOnMap();
    if (user.driver.online) await loadRequests().catch(() => {});
    render();
  }

  function setTrip(trip) {
    state.trip = trip;
    showTripOnMap();
    render();
  }

  $('sos').addEventListener('click', () => {
    if (!state.trip || !confirm(t('sosConfirm', { n: cfg.emergencyNumber }))) return;
    const pos = state.position || {};
    fetch(`/api/trips/${state.trip.id}/sos`, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    }).catch(() => {});
    location.href = `tel:${cfg.emergencyNumber}`;
  });

  // ---------- Tiempo real ----------

  socket.on('request:new', (r) => {
    if (state.trip || !user.driver.online) return;
    state.requests.set(r.id, r);
    vibrate([300, 100, 300]);
    toast(t('newRequest'), 'ok');
    render();
  });

  socket.on('request:closed', ({ id }) => {
    if (state.requests.delete(id)) render();
  });

  socket.on('trip:update', (trip) => {
    if (state.trip && trip.id === state.trip.id) setTrip(trip);
  });

  socket.on('trip:released', ({ id }) => {
    if (state.trip && state.trip.id === id) closeTrip();
  });

  socket.on('driver:verification', async () => {
    user = (await api('GET', '/api/me')).user;
    render();
  });

  socket.on('connect', async () => {
    if (state.position) socket.emit('driver:location', state.position);
    if (state.trip) {
      const { trip } = await api('GET', `/api/trips/${state.trip.id}`).catch(() => ({ trip: null }));
      if (trip) setTrip(trip);
    } else if (user.driver.online) {
      await loadRequests().catch(() => {});
      render();
    }
  });

  // ---------- Inicio ----------

  setupLangToggle(render);
  applyI18n();

  const { trip } = await api('GET', '/api/trips/current');
  if (user.driver.online || trip) startTracking();
  if (user.driver.online) {
    keepScreenOn(true);
    await loadRequests();
  }
  if (trip) setTrip(trip);
  else render();
})();
