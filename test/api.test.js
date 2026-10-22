const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { loadConfig } = require('../server/config');
const { createApp } = require('../server/app');
const { estimateFare } = require('../server/util');

let instance;
let base;

const PICKUP = { lat: 40.4168, lng: -3.7038, address: 'Plaza Mayor' };
const DROPOFF = { lat: 40.4378, lng: -3.6795, address: 'Hotel Central' };

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  const config = loadConfig({ DB_PATH: ':memory:', ADMIN_PHONE: 'admin', ADMIN_PASSWORD: 'admin-secret' });
  instance = createApp(config);
  await new Promise((resolve) => instance.server.listen(0, resolve));
  base = `http://localhost:${instance.server.address().port}`;
});

after(() => instance.close());

test('fare estimate applies minimum and night surcharge', () => {
  const fares = { base: 2.5, perKm: 1.2, minimum: 5, nightSurchargePct: 20, nightStartHour: 22, nightEndHour: 6 };
  assert.equal(estimateFare(0.5, fares, new Date(2026, 0, 1, 12)), 5);
  assert.equal(estimateFare(10, fares, new Date(2026, 0, 1, 12)), 14.5);
  assert.equal(estimateFare(10, fares, new Date(2026, 0, 1, 23)), 17.5);
  assert.equal(estimateFare(10, fares, new Date(2026, 0, 1, 3)), 17.5);
});

test('complete safe trip flow', async () => {
  // Registro
  const passenger = await api('POST', '/api/auth/register', {
    role: 'passenger',
    name: 'Ana Turista',
    phone: '+34 600 000 001',
    password: 'secreto1',
    emergencyContact: '+34600000099',
  });
  assert.equal(passenger.status, 201);
  const pToken = passenger.body.token;

  const driver = await api('POST', '/api/auth/register', {
    role: 'driver',
    name: 'Luis Taxista',
    phone: '600000002',
    password: 'secreto2',
    licenseNumber: 'LIC-123',
    plate: '1234abc',
    vehicle: 'Toyota Prius',
    color: 'Blanco',
  });
  assert.equal(driver.status, 201);
  const dToken = driver.body.token;
  const driverId = driver.body.user.id;
  assert.equal(driver.body.user.driver.plate, '1234ABC');
  assert.equal(driver.body.user.driver.verified, false);

  // Un taxista sin verificar no puede ponerse en servicio
  let res = await api('POST', '/api/driver/status', { online: true }, dToken);
  assert.equal(res.status, 403);

  // Administración verifica al taxista
  const admin = await api('POST', '/api/auth/login', { phone: 'admin', password: 'admin-secret' });
  assert.equal(admin.status, 200);
  const aToken = admin.body.token;
  res = await api('POST', `/api/admin/drivers/${driverId}/verify`, { verified: true }, aToken);
  assert.equal(res.body.driver.verified, true);

  // Un pasajero no puede acceder a administración
  res = await api('GET', '/api/admin/drivers', null, pToken);
  assert.equal(res.status, 403);

  res = await api('POST', '/api/driver/status', { online: true, lat: 40.417, lng: -3.704 }, dToken);
  assert.equal(res.status, 200);

  // El taxista recibe la solicitud en tiempo real
  const socket = connect(base, { auth: { token: dToken }, transports: ['websocket'] });
  await new Promise((resolve) => socket.on('connect', resolve));
  const gotRequest = new Promise((resolve) => socket.on('request:new', resolve));

  res = await api('POST', '/api/trips', { pickup: PICKUP, dropoff: DROPOFF }, pToken);
  assert.equal(res.status, 201);
  const trip = res.body.trip;
  assert.match(trip.pin, /^\d{4}$/);
  assert.ok(trip.fare >= 5);
  assert.ok(trip.shareToken);

  const notified = await gotRequest;
  assert.equal(notified.id, trip.id);
  assert.equal(notified.pin, undefined, 'el taxista nunca ve el PIN');
  socket.close();

  // No se pueden pedir dos taxis a la vez
  res = await api('POST', '/api/trips', { pickup: PICKUP, dropoff: DROPOFF }, pToken);
  assert.equal(res.status, 409);

  res = await api('GET', '/api/driver/requests', null, dToken);
  assert.equal(res.body.requests.length, 1);

  // Aceptar
  res = await api('POST', `/api/trips/${trip.id}/accept`, null, dToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.trip.status, 'accepted');
  assert.equal(res.body.trip.passenger.phone, '+34600000001');

  // El pasajero ve los datos del taxista
  res = await api('GET', '/api/trips/current', null, pToken);
  assert.equal(res.body.trip.driver.plate, '1234ABC');
  assert.equal(res.body.trip.driver.licenseNumber, 'LIC-123');

  // Enlace público de seguimiento: sin PIN ni teléfonos
  res = await api('GET', `/api/track/${trip.shareToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.trip.pin, undefined);
  assert.equal(res.body.trip.passenger, undefined);
  assert.equal(res.body.trip.driver.phone, undefined);
  assert.equal(res.body.trip.driver.name, 'Luis Taxista');

  res = await api('POST', `/api/trips/${trip.id}/arrived`, null, dToken);
  assert.equal(res.body.trip.status, 'arrived');

  // Sin el PIN correcto no se puede iniciar el viaje
  const wrongPin = trip.pin === '0000' ? '1111' : '0000';
  res = await api('POST', `/api/trips/${trip.id}/start`, { pin: wrongPin }, dToken);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_pin');

  res = await api('POST', `/api/trips/${trip.id}/start`, { pin: trip.pin }, dToken);
  assert.equal(res.body.trip.status, 'in_progress');

  // Botón SOS
  res = await api('POST', `/api/trips/${trip.id}/sos`, { lat: 40.42, lng: -3.7 }, pToken);
  assert.equal(res.status, 201);
  res = await api('GET', '/api/admin/alerts', null, aToken);
  assert.equal(res.body.alerts.length, 1);
  assert.equal(res.body.alerts[0].type, 'sos');
  assert.equal(res.body.alerts[0].trip.driver.plate, '1234ABC');

  res = await api('POST', `/api/trips/${trip.id}/complete`, null, dToken);
  assert.equal(res.body.trip.status, 'completed');

  // Valoración
  res = await api('POST', `/api/trips/${trip.id}/rate`, { stars: 5, comment: 'Muy amable' }, pToken);
  assert.equal(res.body.trip.rating, 5);
  res = await api('POST', `/api/trips/${trip.id}/rate`, { stars: 1 }, pToken);
  assert.equal(res.status, 409);

  res = await api('GET', '/api/me', null, dToken);
  assert.equal(res.body.user.driver.rating, 5);
  assert.equal(res.body.user.driver.tripsCount, 1);
});

test('only one driver can accept a trip; driver can release it', async () => {
  const p = await api('POST', '/api/auth/register', { name: 'Vecino', phone: '600000010', password: 'secreto' });
  const admin = await api('POST', '/api/auth/login', { phone: 'admin', password: 'admin-secret' });
  const drivers = [];
  for (const phone of ['600000011', '600000012']) {
    const d = await api('POST', '/api/auth/register', {
      role: 'driver',
      name: `Taxista ${phone}`,
      phone,
      password: 'secreto',
      licenseNumber: `L-${phone}`,
      plate: `P${phone.slice(-3)}`,
      vehicle: 'Seat León',
      color: 'Blanco',
    });
    await api('POST', `/api/admin/drivers/${d.body.user.id}/verify`, { verified: true }, admin.body.token);
    await api('POST', '/api/driver/status', { online: true }, d.body.token);
    drivers.push(d.body.token);
  }

  const { body } = await api('POST', '/api/trips', { pickup: PICKUP, dropoff: DROPOFF }, p.body.token);
  const results = await Promise.all(drivers.map((tk) => api('POST', `/api/trips/${body.trip.id}/accept`, null, tk)));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);

  const winner = drivers[results.findIndex((r) => r.status === 200)];
  const res = await api('POST', `/api/trips/${body.trip.id}/cancel`, null, winner);
  assert.equal(res.status, 200);
  const current = await api('GET', '/api/trips/current', null, p.body.token);
  assert.equal(current.body.trip.status, 'requested');
  assert.equal(current.body.trip.driver, null);

  const cancelled = await api('POST', `/api/trips/${body.trip.id}/cancel`, null, p.body.token);
  assert.equal(cancelled.body.trip.status, 'cancelled');
});

test('validation errors', async () => {
  let res = await api('POST', '/api/auth/register', { name: 'X', phone: 'abc', password: 'secreto' });
  assert.equal(res.body.error, 'invalid_phone');
  res = await api('POST', '/api/auth/register', { name: 'X', phone: '600000020', password: '123' });
  assert.equal(res.body.error, 'password_too_short');
  res = await api('POST', '/api/auth/register', { role: 'driver', name: 'X', phone: '600000021', password: 'secreto' });
  assert.equal(res.body.error, 'driver_fields_required');
  res = await api('POST', '/api/auth/login', { phone: '600000001', password: 'wrong' });
  assert.equal(res.status, 401);
  res = await api('GET', '/api/trips/current');
  assert.equal(res.status, 401);
  res = await api('POST', '/api/trips/estimate', { pickup: { lat: 200, lng: 0 }, dropoff: DROPOFF });
  assert.equal(res.body.error, 'invalid_location');
});
