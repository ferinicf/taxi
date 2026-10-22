(async function () {
  const user = await requireRole('passenger').catch(() => null);
  if (!user) return;
  const cfg = await getConfig();

  document.getElementById('town').textContent = cfg.townName;
  document.getElementById('logout').addEventListener('click', logout);

  const map = createMap('map', cfg.mapCenter, cfg.mapZoom);
  const markers = { pickup: null, dropoff: null, taxi: null };
  const state = {
    points: { pickup: null, dropoff: null },
    active: 'pickup',
    trip: null,
    estimate: null,
    lastPosition: null,
    rating: 0,
  };

  const $ = (id) => document.getElementById(id);
  const planView = $('plan-view');
  const tripView = $('trip-view');
  const sosBtn = $('sos');

  // ---------- Planificación ----------

  function setPoint(kind, point) {
    state.points[kind] = point;
    markers[kind] = setMarker(map, markers[kind], point, kind);
    $(`${kind}-input`).value = point ? point.address || coords(point) : '';
    $(`${kind}-suggestions`).hidden = true;
    if (kind === 'pickup' && point && !state.points.dropoff) state.active = 'dropoff';
    fitPoints(map, [state.points.pickup, state.points.dropoff]);
    updateHint();
    updateEstimate();
  }

  function updateHint() {
    $('map-hint').textContent = t(state.active === 'pickup' ? 'tapMapPickup' : 'tapMapDropoff');
  }

  async function updateEstimate() {
    const { pickup, dropoff } = state.points;
    $('request-btn').disabled = !(pickup && dropoff);
    $('fare-box').hidden = true;
    if (!pickup || !dropoff) return;
    try {
      state.estimate = await api('POST', '/api/trips/estimate', { pickup, dropoff });
      $('fare-km').textContent = state.estimate.distanceKm;
      $('fare-price').textContent = money(state.estimate.fare, state.estimate.currency);
      $('fare-box').hidden = false;
    } catch (err) {
      $('plan-error').textContent = errorText(err);
    }
  }

  map.on('click', async (e) => {
    if (state.trip) return;
    const kind = state.active;
    const point = { lat: e.latlng.lat, lng: e.latlng.lng, address: '' };
    setPoint(kind, point);
    point.address = await reverseGeocode(point);
    if (state.points[kind] === point) $(`${kind}-input`).value = point.address || coords(point);
  });

  for (const kind of ['pickup', 'dropoff']) {
    const input = $(`${kind}-input`);
    const list = $(`${kind}-suggestions`);
    let timer;
    input.addEventListener('focus', () => {
      state.active = kind;
      updateHint();
    });
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 3) {
        list.hidden = true;
        return;
      }
      timer = setTimeout(async () => {
        const results = await searchPlaces(query, state.points.pickup || cfg.mapCenter).catch(() => []);
        list.replaceChildren(
          ...results.map((r) => el('li', {}, el('button', { type: 'button', onclick: () => setPoint(kind, r) }, r.address)))
        );
        list.hidden = results.length === 0;
      }, 500);
    });
  }

  $('gps-btn').addEventListener('click', async () => {
    try {
      const pos = await currentPosition();
      const point = { ...pos, address: '' };
      state.active = 'pickup';
      setPoint('pickup', point);
      point.address = await reverseGeocode(point);
      if (state.points.pickup === point) $('pickup-input').value = point.address || coords(point);
    } catch {
      toast(t('err_invalid_location'), 'error');
    }
  });

  $('request-btn').addEventListener('click', async () => {
    $('plan-error').textContent = '';
    $('request-btn').disabled = true;
    try {
      const { trip } = await api('POST', '/api/trips', {
        pickup: state.points.pickup,
        dropoff: state.points.dropoff,
        notes: $('notes').value,
      });
      showTrip(trip);
    } catch (err) {
      $('plan-error').textContent = errorText(err);
      $('request-btn').disabled = false;
    }
  });

  function showPlan() {
    state.trip = null;
    state.rating = 0;
    planView.hidden = false;
    tripView.hidden = true;
    sosBtn.hidden = true;
    markers.taxi = setMarker(map, markers.taxi, null);
    setPoint('pickup', null);
    setPoint('dropoff', null);
    state.active = 'pickup';
    $('notes').value = '';
    $('plan-error').textContent = '';
    updateHint();
    // Proponer la ubicación actual como punto de recogida
    currentPosition()
      .then(async (pos) => {
        if (state.points.pickup || state.trip) return;
        const point = { ...pos, address: '' };
        setPoint('pickup', point);
        point.address = await reverseGeocode(point);
        if (state.points.pickup === point) $('pickup-input').value = point.address || coords(point);
      })
      .catch(() => {});
  }

  // ---------- Viaje ----------

  function showTrip(trip) {
    state.trip = trip;
    planView.hidden = true;
    tripView.hidden = false;
    sosBtn.hidden = !['accepted', 'arrived', 'in_progress'].includes(trip.status);

    markers.pickup = setMarker(map, markers.pickup, trip.pickup, 'pickup');
    markers.dropoff = setMarker(map, markers.dropoff, trip.dropoff, 'dropoff');
    const taxi = trip.driver && trip.driver.location;
    markers.taxi = setMarker(map, markers.taxi, ['accepted', 'arrived', 'in_progress'].includes(trip.status) ? taxi : null, 'taxi');
    fitPoints(map, [trip.pickup, trip.dropoff, markers.taxi && taxi]);

    renderTrip();
  }

  function renderTrip() {
    const trip = state.trip;
    const s = trip.status;
    const parts = [];

    parts.push(
      el(
        'div',
        { class: 'status-line' },
        s === 'requested' ? el('span', { class: 'spinner', 'aria-hidden': 'true' }) : null,
        t(`status_${s}`)
      )
    );

    if (trip.driver && ['accepted', 'arrived', 'in_progress', 'completed'].includes(s)) {
      parts.push(driverCard(trip.driver, { showPhone: s !== 'completed' }));
    }

    if (['accepted', 'arrived'].includes(s)) {
      parts.push(
        el(
          'div',
          { class: 'pin-box' },
          el('div', { class: 'muted' }, t('yourPin')),
          el('div', { class: 'pin' }, trip.pin),
          el('div', { class: 'muted' }, `${t('checkPlate')}: `, el('strong', {}, trip.driver.plate), '. ', t('pinHelp'))
        )
      );
    }

    parts.push(
      el(
        'div',
        { class: 'fare-box' },
        el('div', {}, el('div', { class: 'muted' }, t('estimate')), el('div', { class: 'muted' }, `${trip.distanceKm} km`)),
        el('div', { class: 'price' }, money(trip.fare, trip.currency))
      )
    );

    if (['requested', 'accepted', 'arrived', 'in_progress'].includes(s)) {
      parts.push(el('button', { class: 'btn', type: 'button', onclick: shareTrip }, `📲 ${t('shareTrip')}`));
    }
    if (['accepted', 'arrived', 'in_progress', 'completed'].includes(s)) {
      parts.push(el('button', { class: 'btn ghost', type: 'button', onclick: reportProblem }, t('report')));
    }
    if (['requested', 'accepted', 'arrived'].includes(s)) {
      parts.push(el('button', { class: 'btn ghost', type: 'button', onclick: cancelTrip }, t('cancelTrip')));
    }

    if (s === 'completed') {
      if (trip.rating == null) parts.push(ratingForm());
      else parts.push(el('p', { class: 'muted' }, t('thanksRating')));
      parts.push(el('button', { class: 'btn accent', type: 'button', onclick: showPlan }, t('newTrip')));
    }
    if (s === 'cancelled') {
      parts.push(el('button', { class: 'btn accent', type: 'button', onclick: showPlan }, t('newTrip')));
    }

    tripView.replaceChildren(...parts);
  }

  function ratingForm() {
    const starsRow = el('div', { class: 'stars-input', role: 'radiogroup', 'aria-label': t('rateTrip') });
    const comment = el('input', { maxlength: '300', placeholder: t('commentOptional'), 'aria-label': t('commentOptional') });
    const paint = () =>
      starsRow.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('on', i < state.rating);
        b.setAttribute('aria-checked', String(i + 1 === state.rating));
      });
    for (let i = 1; i <= 5; i++) {
      starsRow.append(
        el('button', { type: 'button', role: 'radio', 'aria-label': `${i}`, onclick: () => ((state.rating = i), paint()) }, '★')
      );
    }
    const send = el('button', { class: 'btn', type: 'button' }, t('send'));
    send.addEventListener('click', async () => {
      if (!state.rating) return;
      try {
        const { trip } = await api('POST', `/api/trips/${state.trip.id}/rate`, { stars: state.rating, comment: comment.value });
        showTrip(trip);
      } catch (err) {
        toast(errorText(err), 'error');
      }
    });
    queueMicrotask(paint);
    return el('div', { class: 'card', style: 'margin-top:12px' }, el('h3', {}, t('rateTrip')), starsRow, comment, send);
  }

  async function shareTrip() {
    const url = `${location.origin}/seguimiento.html?t=${state.trip.shareToken}`;
    const text = `${t('shareText')} ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t('appName'), text: t('shareText'), url });
        return;
      } catch {
        /* cancelado: usamos WhatsApp */
      }
    }
    const contact = (user.emergencyContact || '').replace(/[^\d]/g, '');
    window.open(`https://wa.me/${contact}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  async function cancelTrip() {
    if (!confirm(t('cancelConfirm'))) return;
    try {
      const { trip } = await api('POST', `/api/trips/${state.trip.id}/cancel`);
      showTrip(trip);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  async function reportProblem() {
    const message = prompt(t('reportPrompt'));
    if (!message) return;
    try {
      await api('POST', `/api/trips/${state.trip.id}/report`, { message });
      toast(t('reportSent'), 'ok');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  sosBtn.addEventListener('click', () => {
    if (!state.trip || !confirm(t('sosConfirm', { n: cfg.emergencyNumber }))) return;
    const pos = state.lastPosition || {};
    // keepalive: el aviso llega a la central aunque el móvil cambie a la llamada
    fetch(`/api/trips/${state.trip.id}/sos`, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    })
      .then((r) => r.ok && toast(t('sosSent'), 'ok'))
      .catch(() => {});
    location.href = `tel:${cfg.emergencyNumber}`;
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (p) => (state.lastPosition = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
  }

  // ---------- Tiempo real ----------

  const socket = connectSocket();
  socket.on('trip:update', (trip) => {
    if (state.trip && trip.id !== state.trip.id) return;
    const previous = state.trip && state.trip.status;
    if (previous !== trip.status && ['accepted', 'arrived'].includes(trip.status)) vibrate([200, 100, 200]);
    showTrip(trip);
  });
  socket.on('driver:location', (loc) => {
    if (!state.trip || loc.tripId !== state.trip.id) return;
    markers.taxi = setMarker(map, markers.taxi, loc, 'taxi');
  });
  socket.on('connect', () => {
    // Al reconectar, recuperamos el estado por si nos perdimos algún cambio
    if (state.trip && !['completed', 'cancelled'].includes(state.trip.status)) {
      api('GET', `/api/trips/${state.trip.id}`)
        .then(({ trip }) => showTrip(trip))
        .catch(() => {});
    }
  });

  async function loadCurrent() {
    const { trip } = await api('GET', '/api/trips/current');
    if (trip) return showTrip(trip);
    // ¿Último viaje terminado sin valorar?
    const { trips } = await api('GET', '/api/trips');
    const last = trips[0];
    if (last && last.status === 'completed' && last.rating == null) return showTrip(last);
    if (!state.trip) showPlan();
  }

  setupLangToggle(() => {
    updateHint();
    if (state.trip) renderTrip();
  });
  applyI18n();
  await loadCurrent();
})();
