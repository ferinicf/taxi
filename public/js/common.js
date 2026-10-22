// Utilidades compartidas: idioma, API, sesión, mapas y tiempo real.

const I18N = {
  es: {
    appName: 'Taxi Seguro',
    tagline: 'Taxis verificados de tu localidad. Para vecinos y visitantes.',
    iAmPassenger: 'Quiero un taxi',
    iAmDriver: 'Soy taxista',
    login: 'Entrar',
    register: 'Crear cuenta',
    logout: 'Salir',
    name: 'Nombre',
    phone: 'Teléfono',
    password: 'Contraseña',
    emergencyContact: 'Teléfono de un contacto de confianza (opcional)',
    licenseNumber: 'Nº de licencia de taxi',
    plate: 'Matrícula',
    vehicle: 'Marca y modelo',
    color: 'Color',
    photo: 'Foto de tu cara (la verá el pasajero)',
    haveAccount: '¿Ya tienes cuenta? Entra',
    noAccount: '¿No tienes cuenta? Regístrate',
    safety1: 'Solo taxistas con licencia verificada',
    safety2: 'Ves foto, nombre y matrícula antes de subir',
    safety3: 'Código PIN para confirmar que es tu taxi',
    safety4: 'Comparte tu viaje en vivo con quien quieras',
    safety5: 'Botón de emergencia (SOS)',
    safety6: 'Precio fijo acordado antes de subir',
    pickup: 'Recogida',
    dropoff: 'Destino',
    useMyLocation: 'Usar mi ubicación',
    searchPlace: 'Buscar dirección o lugar…',
    tapMapPickup: 'Toca el mapa para marcar dónde te recogemos',
    tapMapDropoff: 'Toca el mapa o busca tu destino',
    notes: 'Indicaciones para el taxista (opcional)',
    estimate: 'Precio fijo',
    distance: 'Distancia aprox.',
    requestTaxi: 'Pedir taxi',
    change: 'Cambiar',
    status_requested: 'Buscando taxi cercano…',
    status_accepted: 'Tu taxi va en camino',
    status_arrived: 'Tu taxi ha llegado',
    status_in_progress: 'Viaje en curso',
    status_completed: 'Viaje finalizado',
    status_cancelled: 'Viaje cancelado',
    drv_status_accepted: 'Ve a recoger al pasajero',
    drv_status_arrived: 'Esperando al pasajero',
    drv_status_in_progress: 'Lleva al pasajero a su destino',
    drv_status_completed: 'Viaje finalizado',
    drv_status_cancelled: 'El pasajero canceló el viaje',
    yourPin: 'Tu código PIN',
    pinHelp: 'Díselo al taxista solo cuando compruebes que la matrícula y la foto coinciden. Sin este código el viaje no puede empezar.',
    checkPlate: 'Comprueba la matrícula',
    license: 'Licencia',
    verified: 'Verificado',
    trips: 'viajes',
    noRatings: 'Sin valoraciones',
    shareTrip: 'Compartir viaje',
    shareText: 'Sigue mi viaje en taxi en directo:',
    sos: 'SOS',
    sosConfirm: '¿Activar emergencia? Se avisará a la central con tu ubicación y se llamará al {n}.',
    sosSent: 'Alerta enviada a la central.',
    call: 'Llamar',
    cancelTrip: 'Cancelar viaje',
    cancelConfirm: '¿Seguro que quieres cancelar?',
    report: 'Reportar problema',
    reportPrompt: 'Describe el problema:',
    reportSent: 'Gracias, la central revisará tu reporte.',
    rateTrip: '¿Qué tal tu viaje?',
    commentOptional: 'Comentario (opcional)',
    send: 'Enviar',
    thanksRating: '¡Gracias por tu valoración!',
    newTrip: 'Pedir otro taxi',
    myTrips: 'Mis viajes',
    allTrips: 'Viajes',
    // Taxista
    pendingVerification: 'Tu cuenta está pendiente de verificación',
    pendingVerificationHelp: 'La central revisará tu licencia y datos. Recibirás acceso en cuanto te verifiquen.',
    online: 'En servicio',
    offline: 'Fuera de servicio',
    goOnline: 'Ponerme en servicio',
    goOffline: 'Dejar el servicio',
    noRequests: 'No hay solicitudes ahora mismo. Te avisaremos al instante.',
    requests: 'Solicitudes cercanas',
    accept: 'Aceptar',
    awayKm: 'a {km} km',
    passenger: 'Pasajero',
    navigate: 'Cómo llegar',
    imHere: 'He llegado',
    enterPin: 'PIN que te dice el pasajero',
    startTrip: 'Iniciar viaje',
    finishTrip: 'Finalizar viaje',
    collect: 'Cobrar',
    releaseTrip: 'No puedo hacer este viaje',
    newRequest: '¡Nueva solicitud de taxi!',
    tripTaken: 'Otro taxista aceptó este viaje',
    locationNeeded: 'Activa la ubicación para recibir viajes cercanos.',
    // Administración
    admin: 'Central',
    alerts: 'Alertas',
    drivers: 'Taxistas',
    noAlerts: 'Sin alertas abiertas',
    resolve: 'Marcar resuelta',
    verify: 'Verificar',
    revoke: 'Retirar verificación',
    pending: 'Pendiente',
    noDrivers: 'No hay taxistas registrados',
    noTrips: 'Sin viajes todavía',
    sosAlert: '🚨 EMERGENCIA',
    reportAlert: 'Reporte',
    resolved: 'Resuelta',
    // Seguimiento
    trackTitle: 'Seguimiento de viaje',
    trackHelp: 'Estás viendo un viaje en taxi compartido contigo. La posición se actualiza en directo.',
    tripNotFound: 'Viaje no encontrado',
    lastUpdate: 'Última posición',
    // Errores
    err_invalid_credentials: 'Teléfono o contraseña incorrectos',
    err_phone_taken: 'Ese teléfono ya está registrado',
    err_invalid_phone: 'Teléfono no válido (solo números, con prefijo opcional +)',
    err_password_too_short: 'La contraseña debe tener al menos 6 caracteres',
    err_name_required: 'Escribe tu nombre',
    err_driver_fields_required: 'Completa licencia, matrícula, vehículo y color',
    err_invalid_photo: 'La foto no es válida o es demasiado grande',
    err_trip_already_active: 'Ya tienes un viaje activo',
    err_trip_not_available: 'Este viaje ya no está disponible',
    err_invalid_pin: 'PIN incorrecto. Pídeselo de nuevo al pasajero.',
    err_driver_not_verified: 'Tu cuenta aún no está verificada',
    err_trip_too_short: 'El destino está demasiado cerca',
    err_invalid_location: 'Ubicación no válida',
    err_too_many_requests: 'Demasiados intentos. Espera unos minutos.',
    err_unauthorized: 'Tu sesión ha caducado. Vuelve a entrar.',
    err_network: 'Sin conexión con el servidor',
    err_generic: 'Algo ha fallado. Inténtalo de nuevo.',
  },
  en: {
    appName: 'Safe Taxi',
    tagline: 'Verified local taxis. For residents and visitors.',
    iAmPassenger: 'I need a taxi',
    iAmDriver: "I'm a driver",
    login: 'Log in',
    register: 'Sign up',
    logout: 'Log out',
    name: 'Name',
    phone: 'Phone',
    password: 'Password',
    emergencyContact: 'Phone of a trusted contact (optional)',
    licenseNumber: 'Taxi licence number',
    plate: 'Licence plate',
    vehicle: 'Make and model',
    color: 'Colour',
    photo: 'Photo of your face (shown to passengers)',
    haveAccount: 'Already have an account? Log in',
    noAccount: "Don't have an account? Sign up",
    safety1: 'Only drivers with a verified licence',
    safety2: 'See photo, name and plate before you get in',
    safety3: 'PIN code to confirm it is your taxi',
    safety4: 'Share your trip live with anyone',
    safety5: 'Emergency button (SOS)',
    safety6: 'Fixed price agreed before you ride',
    pickup: 'Pickup',
    dropoff: 'Destination',
    useMyLocation: 'Use my location',
    searchPlace: 'Search address or place…',
    tapMapPickup: 'Tap the map to set your pickup point',
    tapMapDropoff: 'Tap the map or search your destination',
    notes: 'Notes for the driver (optional)',
    estimate: 'Fixed price',
    distance: 'Approx. distance',
    requestTaxi: 'Request taxi',
    change: 'Change',
    status_requested: 'Looking for a nearby taxi…',
    status_accepted: 'Your taxi is on its way',
    status_arrived: 'Your taxi has arrived',
    status_in_progress: 'Trip in progress',
    status_completed: 'Trip completed',
    status_cancelled: 'Trip cancelled',
    drv_status_accepted: 'Go pick up the passenger',
    drv_status_arrived: 'Waiting for the passenger',
    drv_status_in_progress: 'Take the passenger to the destination',
    drv_status_completed: 'Trip completed',
    drv_status_cancelled: 'The passenger cancelled the trip',
    yourPin: 'Your PIN code',
    pinHelp: 'Tell it to the driver only after checking the plate and photo match. The trip cannot start without this code.',
    checkPlate: 'Check the plate',
    license: 'Licence',
    verified: 'Verified',
    trips: 'trips',
    noRatings: 'No ratings yet',
    shareTrip: 'Share trip',
    shareText: 'Follow my taxi ride live:',
    sos: 'SOS',
    sosConfirm: 'Trigger emergency? The dispatch centre will get your location and {n} will be called.',
    sosSent: 'Alert sent to dispatch.',
    call: 'Call',
    cancelTrip: 'Cancel trip',
    cancelConfirm: 'Are you sure you want to cancel?',
    report: 'Report a problem',
    reportPrompt: 'Describe the problem:',
    reportSent: 'Thanks, dispatch will review your report.',
    rateTrip: 'How was your trip?',
    commentOptional: 'Comment (optional)',
    send: 'Send',
    thanksRating: 'Thanks for your rating!',
    newTrip: 'Request another taxi',
    myTrips: 'My trips',
    allTrips: 'Trips',
    pendingVerification: 'Your account is pending verification',
    pendingVerificationHelp: 'Dispatch will review your licence and details. You will get access once verified.',
    online: 'On duty',
    offline: 'Off duty',
    goOnline: 'Go on duty',
    goOffline: 'Go off duty',
    noRequests: 'No requests right now. We will notify you instantly.',
    requests: 'Nearby requests',
    accept: 'Accept',
    awayKm: '{km} km away',
    passenger: 'Passenger',
    navigate: 'Directions',
    imHere: "I've arrived",
    enterPin: 'PIN given by the passenger',
    startTrip: 'Start trip',
    finishTrip: 'Finish trip',
    collect: 'Collect',
    releaseTrip: "I can't do this trip",
    newRequest: 'New taxi request!',
    tripTaken: 'Another driver accepted this trip',
    locationNeeded: 'Enable location to receive nearby trips.',
    admin: 'Dispatch',
    alerts: 'Alerts',
    drivers: 'Drivers',
    noAlerts: 'No open alerts',
    resolve: 'Mark resolved',
    verify: 'Verify',
    revoke: 'Revoke verification',
    pending: 'Pending',
    noDrivers: 'No drivers registered',
    noTrips: 'No trips yet',
    sosAlert: '🚨 EMERGENCY',
    reportAlert: 'Report',
    resolved: 'Resolved',
    trackTitle: 'Trip tracking',
    trackHelp: 'You are viewing a taxi trip shared with you. The position updates live.',
    tripNotFound: 'Trip not found',
    lastUpdate: 'Last position',
    err_invalid_credentials: 'Wrong phone or password',
    err_phone_taken: 'That phone is already registered',
    err_invalid_phone: 'Invalid phone (digits only, optional + prefix)',
    err_password_too_short: 'Password must be at least 6 characters',
    err_name_required: 'Enter your name',
    err_driver_fields_required: 'Fill in licence, plate, vehicle and colour',
    err_invalid_photo: 'The photo is invalid or too large',
    err_trip_already_active: 'You already have an active trip',
    err_trip_not_available: 'This trip is no longer available',
    err_invalid_pin: 'Wrong PIN. Ask the passenger again.',
    err_driver_not_verified: 'Your account is not verified yet',
    err_trip_too_short: 'The destination is too close',
    err_invalid_location: 'Invalid location',
    err_too_many_requests: 'Too many attempts. Wait a few minutes.',
    err_unauthorized: 'Your session expired. Please log in again.',
    err_network: 'Cannot reach the server',
    err_generic: 'Something went wrong. Please try again.',
  },
};

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

let lang = store.get('lang') || ((navigator.language || 'es').startsWith('es') ? 'es' : 'en');

function t(key, vars = {}) {
  const text = (I18N[lang] && I18N[lang][key]) || I18N.es[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = lang === 'es' ? 'EN' : 'ES';
}

function setupLangToggle(onChange) {
  const toggle = document.getElementById('lang-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    store.set('lang', lang);
    applyI18n();
    if (onChange) onChange();
  });
}

class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(session.token ? { authorization: `Bearer ${session.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token && path !== '/api/auth/login') {
      session.clear();
      location.href = '/';
    }
    throw new ApiError(data.error || 'generic', res.status);
  }
  return data;
}

const errorText = (err) => {
  const key = `err_${err && err.code}`;
  return I18N.es[key] ? t(key) : t('err_generic');
};

const session = {
  get token() {
    return store.get('token');
  },
  get user() {
    try {
      return JSON.parse(store.get('user') || 'null');
    } catch {
      return null;
    }
  },
  save(token, user) {
    store.set('token', token);
    store.set('user', JSON.stringify(user));
  },
  clear() {
    store.set('token', null);
    store.set('user', null);
  },
};

const HOME_BY_ROLE = { passenger: '/pasajero.html', driver: '/conductor.html', admin: '/admin.html' };

// Carga la sesión y redirige si el rol no corresponde a la página
async function requireRole(role) {
  if (!session.token) {
    location.href = '/';
    return null;
  }
  const { user } = await api('GET', '/api/me');
  session.save(session.token, user);
  if (user.role !== role) {
    location.href = HOME_BY_ROLE[user.role];
    return null;
  }
  return user;
}

async function logout() {
  try {
    await api('POST', '/api/auth/logout');
  } catch {
    /* da igual */
  }
  session.clear();
  location.href = '/';
}

let configCache;
async function getConfig() {
  if (!configCache) configCache = await api('GET', '/api/config');
  return configCache;
}

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function connectSocket() {
  // eslint-disable-next-line no-undef
  return io({ auth: { token: session.token } });
}

// ---------- Mapas (OpenStreetMap + Leaflet) ----------

function createMap(elementId, center, zoom) {
  // eslint-disable-next-line no-undef
  const map = L.map(elementId, { zoomControl: true }).setView([center.lat, center.lng], zoom);
  // eslint-disable-next-line no-undef
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  return map;
}

function pinIcon(kind) {
  const emoji = { pickup: '📍', dropoff: '🏁', taxi: '🚕', sos: '🚨' }[kind] || '📍';
  // eslint-disable-next-line no-undef
  return L.divIcon({ className: `map-pin map-pin-${kind}`, html: emoji, iconSize: [36, 36], iconAnchor: [18, 32] });
}

function setMarker(map, marker, point, kind) {
  if (!point) {
    if (marker) marker.remove();
    return null;
  }
  if (marker) return marker.setLatLng([point.lat, point.lng]);
  // eslint-disable-next-line no-undef
  return L.marker([point.lat, point.lng], { icon: pinIcon(kind) }).addTo(map);
}

function fitPoints(map, points) {
  const valid = points.filter(Boolean).map((p) => [p.lat, p.lng]);
  if (valid.length === 1) map.setView(valid[0], Math.max(map.getZoom(), 15));
  else if (valid.length > 1) map.fitBounds(valid, { padding: [40, 40], maxZoom: 16 });
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Búsqueda de direcciones con Nominatim (OpenStreetMap)
async function searchPlaces(query, near) {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '5', 'accept-language': lang });
  if (near) {
    const d = 0.3;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), address: r.display_name }));
}

async function reverseGeocode(point) {
  try {
    const params = new URLSearchParams({ lat: point.lat, lon: point.lng, format: 'json', zoom: '18', 'accept-language': lang });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
    if (!res.ok) return '';
    const data = await res.json();
    return shortAddress(data);
  } catch {
    return '';
  }
}

function shortAddress(data) {
  const a = data.address || {};
  const street = [a.road || a.pedestrian || a.amenity || a.tourism, a.house_number].filter(Boolean).join(' ');
  const town = a.village || a.town || a.city || a.suburb;
  return [street, town].filter(Boolean).join(', ') || data.display_name || '';
}

const coords = (p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

// ---------- Interfaz ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

let toastTimer;
function toast(message, kind = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.className = `toast show toast-${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = 'toast'), 4000);
}

function stars(rating) {
  if (rating == null) return t('noRatings');
  return `★ ${rating.toFixed(1)}`;
}

function driverCard(driver, { showPhone = false } = {}) {
  return el(
    'div',
    { class: 'driver-card' },
    driver.photo
      ? el('img', { class: 'driver-photo', src: driver.photo, alt: driver.name })
      : el('div', { class: 'driver-photo placeholder', 'aria-hidden': 'true' }, '🧑'),
    el(
      'div',
      { class: 'driver-info' },
      el('div', { class: 'driver-name' }, driver.name, driver.verified ? el('span', { class: 'badge ok' }, `✔ ${t('verified')}`) : null),
      el('div', { class: 'plate', title: t('plate') }, driver.plate),
      el('div', { class: 'muted' }, `${driver.vehicle} · ${driver.color}`),
      el('div', { class: 'muted' }, `${t('license')}: ${driver.licenseNumber}`),
      el('div', { class: 'muted' }, `${stars(driver.rating)} · ${driver.tripsCount} ${t('trips')}`),
      showPhone && driver.phone ? el('a', { class: 'btn small', href: `tel:${driver.phone}` }, `📞 ${t('call')}`) : null
    )
  );
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

registerServiceWorker();
