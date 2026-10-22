const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');
const { openDb } = require('./db');
const {
  hashPassword,
  verifyPassword,
  randomToken,
  randomPin,
  distanceKm,
  estimateFare,
  normalizePhone,
  isLatLng,
  cleanText,
} = require('./util');

const MAX_PHOTO_LENGTH = 300_000; // ~220 KB de imagen en base64

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function createApp(config) {
  const db = openDb(config.dbPath);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  ensureAdmin(db, config);

  const q = {
    userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByToken: db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    ),
    insertUser: db.prepare(
      'INSERT INTO users (role, name, phone, password_hash, emergency_contact) VALUES (?, ?, ?, ?, ?)'
    ),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    driver: db.prepare('SELECT * FROM drivers WHERE user_id = ?'),
    insertDriver: db.prepare(
      'INSERT INTO drivers (user_id, license_number, plate, vehicle, color, photo) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    driverRating: db.prepare(
      "SELECT AVG(rating) AS avg, COUNT(rating) AS ratings, COUNT(*) AS trips FROM trips WHERE driver_id = ? AND status = 'completed'"
    ),
    trip: db.prepare('SELECT * FROM trips WHERE id = ?'),
    tripByShare: db.prepare('SELECT * FROM trips WHERE share_token = ?'),
    activeTripForPassenger: db.prepare(
      `SELECT * FROM trips WHERE passenger_id = ? AND status IN ('requested','accepted','arrived','in_progress') ORDER BY id DESC LIMIT 1`
    ),
    activeTripForDriver: db.prepare(
      `SELECT * FROM trips WHERE driver_id = ? AND status IN ('accepted','arrived','in_progress') ORDER BY id DESC LIMIT 1`
    ),
    openRequests: db.prepare("SELECT * FROM trips WHERE status = 'requested' ORDER BY id"),
    onlineDrivers: db.prepare('SELECT * FROM drivers WHERE online = 1 AND verified = 1'),
    insertAlert: db.prepare(
      'INSERT INTO alerts (type, trip_id, user_id, message, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    alert: db.prepare('SELECT * FROM alerts WHERE id = ?'),
    updateLocation: db.prepare(
      "UPDATE drivers SET lat = ?, lng = ?, location_updated_at = datetime('now') WHERE user_id = ?"
    ),
  };

  // ---------- Serialización (qué ve cada persona) ----------

  function driverInfo(userId) {
    const user = q.userById.get(userId);
    const d = q.driver.get(userId);
    if (!user || !d) return null;
    const stats = q.driverRating.get(userId);
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      licenseNumber: d.license_number,
      plate: d.plate,
      vehicle: d.vehicle,
      color: d.color,
      photo: d.photo,
      verified: !!d.verified,
      online: !!d.online,
      rating: stats.avg == null ? null : Math.round(stats.avg * 10) / 10,
      ratingsCount: stats.ratings,
      tripsCount: stats.trips,
      location: d.lat == null ? null : { lat: d.lat, lng: d.lng, updatedAt: d.location_updated_at },
    };
  }

  // viewer: 'passenger' | 'driver' | 'admin' | 'public'
  function tripView(t, viewer) {
    const view = {
      id: t.id,
      status: t.status,
      pickup: { lat: t.pickup_lat, lng: t.pickup_lng, address: t.pickup_address },
      dropoff: { lat: t.dropoff_lat, lng: t.dropoff_lng, address: t.dropoff_address },
      distanceKm: t.distance_km,
      fare: t.fare,
      currency: config.currency,
      createdAt: t.created_at,
      acceptedAt: t.accepted_at,
      arrivedAt: t.arrived_at,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      cancelledAt: t.cancelled_at,
    };
    let driver = t.driver_id ? driverInfo(t.driver_id) : null;
    if (driver && viewer === 'public') {
      // El enlace compartido no muestra el teléfono del taxista
      const { phone, ...rest } = driver;
      driver = rest;
    }
    view.driver = driver;

    if (viewer === 'public') return view;

    view.notes = t.notes;
    view.rating = t.rating;
    view.cancelledBy = t.cancelled_by;
    if (viewer === 'passenger' || viewer === 'admin') {
      view.pin = t.pin;
      view.shareToken = t.share_token;
    }
    const passenger = q.userById.get(t.passenger_id);
    view.passenger = {
      id: passenger.id,
      name: passenger.name,
      // El teléfono del pasajero solo se comparte con el taxista asignado
      phone: viewer === 'admin' || (viewer === 'driver' && t.driver_id) ? passenger.phone : undefined,
    };
    return view;
  }

  function userView(user) {
    const view = {
      id: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      emergencyContact: user.emergency_contact,
    };
    if (user.role === 'driver') view.driver = driverInfo(user.id);
    return view;
  }

  // ---------- Tiempo real ----------

  function emitTrip(tripId) {
    const t = q.trip.get(tripId);
    if (!t) return;
    io.to(`user:${t.passenger_id}`).emit('trip:update', tripView(t, 'passenger'));
    if (t.driver_id) io.to(`user:${t.driver_id}`).emit('trip:update', tripView(t, 'driver'));
    io.to(`track:${t.share_token}`).emit('trip:update', tripView(t, 'public'));
    io.to('admins').emit('trip:update', tripView(t, 'admin'));
    if (t.status !== 'requested') io.to('drivers-online').emit('request:closed', { id: t.id });
  }

  function notifyNearbyDrivers(t) {
    const pickup = { lat: t.pickup_lat, lng: t.pickup_lng };
    for (const d of q.onlineDrivers.all()) {
      if (q.activeTripForDriver.get(d.user_id)) continue;
      if (d.lat != null && distanceKm(pickup, d) > config.maxDriverDistanceKm) continue;
      const view = tripView(t, 'driver');
      if (d.lat != null) view.distanceToPickupKm = round1(distanceKm(pickup, d));
      io.to(`user:${d.user_id}`).emit('request:new', view);
    }
  }

  function setDriverRoom(userId, online) {
    const room = io.in(`user:${userId}`);
    if (online) room.socketsJoin('drivers-online');
    else room.socketsLeave('drivers-online');
  }

  function updateDriverLocation(userId, point) {
    q.updateLocation.run(point.lat, point.lng, userId);
    const t = q.activeTripForDriver.get(userId);
    if (!t) return;
    const payload = { tripId: t.id, lat: point.lat, lng: point.lng, at: new Date().toISOString() };
    io.to(`user:${t.passenger_id}`).emit('driver:location', payload);
    io.to(`track:${t.share_token}`).emit('driver:location', payload);
    io.to('admins').emit('driver:location', { ...payload, driverId: userId });
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    socket.data.user = token ? q.userByToken.get(String(token)) || null : null;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.id}`);
      if (user.role === 'admin') socket.join('admins');
      if (user.role === 'driver') {
        const d = q.driver.get(user.id);
        if (d && d.online && d.verified) socket.join('drivers-online');
      }
    }

    socket.on('track:join', (shareToken) => {
      const t = q.tripByShare.get(String(shareToken || ''));
      if (t) socket.join(`track:${t.share_token}`);
    });

    socket.on('driver:location', (point) => {
      if (!user || user.role !== 'driver') return;
      const p = { lat: Number(point && point.lat), lng: Number(point && point.lng) };
      if (isLatLng(p)) updateDriverLocation(user.id, p);
    });
  });

  // ---------- HTTP ----------

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/vendor/leaflet', express.static(path.dirname(require.resolve('leaflet/dist/leaflet.js'))));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

  function auth(...roles) {
    return (req, res, next) => {
      const header = req.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      const user = token ? q.userByToken.get(token) : null;
      if (!user) return next(new HttpError(401, 'unauthorized'));
      if (roles.length && !roles.includes(user.role)) return next(new HttpError(403, 'forbidden'));
      req.user = user;
      req.token = token;
      next();
    };
  }

  function readPoint(p) {
    const point = p && { lat: Number(p.lat), lng: Number(p.lng), address: cleanText(p.address, 200) };
    if (!isLatLng(point)) throw new HttpError(400, 'invalid_location');
    return point;
  }

  function loadTrip(req) {
    const t = q.trip.get(Number(req.params.id));
    if (!t) throw new HttpError(404, 'trip_not_found');
    return t;
  }

  function tripRole(t, user) {
    if (user.role === 'admin') return 'admin';
    if (t.passenger_id === user.id) return 'passenger';
    if (t.driver_id === user.id) return 'driver';
    return null;
  }

  // Configuración pública para la app
  app.get('/api/config', (req, res) => {
    res.json({
      townName: config.townName,
      mapCenter: config.mapCenter,
      mapZoom: config.mapZoom,
      emergencyNumber: config.emergencyNumber,
      currency: config.currency,
      fares: config.fares,
      routeFactor: config.routeFactor,
    });
  });

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const body = req.body || {};
    const role = body.role === 'driver' ? 'driver' : 'passenger';
    const name = cleanText(body.name, 80);
    const phone = normalizePhone(body.phone);
    const password = String(body.password || '');
    if (!name) throw new HttpError(400, 'name_required');
    if (!/^\+?\d{7,15}$/.test(phone)) throw new HttpError(400, 'invalid_phone');
    if (password.length < 6) throw new HttpError(400, 'password_too_short');
    if (q.userByPhone.get(phone)) throw new HttpError(409, 'phone_taken');

    let driverData;
    if (role === 'driver') {
      driverData = {
        license: cleanText(body.licenseNumber, 40),
        plate: cleanText(body.plate, 15).toUpperCase(),
        vehicle: cleanText(body.vehicle, 60),
        color: cleanText(body.color, 30),
        photo: body.photo ? String(body.photo) : null,
      };
      if (!driverData.license || !driverData.plate || !driverData.vehicle || !driverData.color) {
        throw new HttpError(400, 'driver_fields_required');
      }
      if (driverData.photo && !isImageDataUrl(driverData.photo)) throw new HttpError(400, 'invalid_photo');
    }

    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = q.insertUser.run(
        role,
        name,
        phone,
        hashPassword(password),
        cleanText(body.emergencyContact, 40) || null
      );
      if (driverData) {
        const d = driverData;
        q.insertDriver.run(lastInsertRowid, d.license, d.plate, d.vehicle, d.color, d.photo);
      }
      db.exec('COMMIT');
      const user = q.userById.get(lastInsertRowid);
      const token = randomToken();
      q.insertSession.run(token, user.id);
      if (role === 'driver') io.to('admins').emit('driver:registered', driverInfo(user.id));
      res.status(201).json({ token, user: userView(user) });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const body = req.body || {};
    const user = q.userByPhone.get(normalizePhone(body.phone));
    if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) {
      throw new HttpError(401, 'invalid_credentials');
    }
    const token = randomToken();
    q.insertSession.run(token, user.id);
    res.json({ token, user: userView(user) });
  });

  app.post('/api/auth/logout', auth(), (req, res) => {
    q.deleteSession.run(req.token);
    res.json({ ok: true });
  });

  app.get('/api/me', auth(), (req, res) => {
    res.json({ user: userView(req.user) });
  });

  app.patch('/api/me', auth(), (req, res) => {
    const body = req.body || {};
    if (body.emergencyContact !== undefined) {
      db.prepare('UPDATE users SET emergency_contact = ? WHERE id = ?').run(
        cleanText(body.emergencyContact, 40) || null,
        req.user.id
      );
    }
    res.json({ user: userView(q.userById.get(req.user.id)) });
  });

  // Estimación de precio (sin crear viaje)
  app.post('/api/trips/estimate', (req, res) => {
    const pickup = readPoint(req.body && req.body.pickup);
    const dropoff = readPoint(req.body && req.body.dropoff);
    const km = round1(distanceKm(pickup, dropoff) * config.routeFactor);
    res.json({ distanceKm: km, fare: estimateFare(km, config.fares), currency: config.currency });
  });

  // ----- Pasajero -----

  app.post('/api/trips', auth('passenger'), (req, res) => {
    if (q.activeTripForPassenger.get(req.user.id)) throw new HttpError(409, 'trip_already_active');
    const pickup = readPoint(req.body && req.body.pickup);
    const dropoff = readPoint(req.body && req.body.dropoff);
    const km = round1(distanceKm(pickup, dropoff) * config.routeFactor);
    if (km < 0.1) throw new HttpError(400, 'trip_too_short');
    const fare = estimateFare(km, config.fares);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO trips (passenger_id, status, pickup_lat, pickup_lng, pickup_address,
          dropoff_lat, dropoff_lng, dropoff_address, distance_km, fare, pin, share_token, notes)
         VALUES (?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id,
        pickup.lat,
        pickup.lng,
        pickup.address || null,
        dropoff.lat,
        dropoff.lng,
        dropoff.address || null,
        km,
        fare,
        randomPin(),
        randomToken(16),
        cleanText(req.body.notes, 200) || null
      );
    const t = q.trip.get(lastInsertRowid);
    notifyNearbyDrivers(t);
    emitTrip(t.id);
    res.status(201).json({ trip: tripView(t, 'passenger') });
  });

  app.get('/api/trips/current', auth('passenger', 'driver'), (req, res) => {
    const t =
      req.user.role === 'passenger'
        ? q.activeTripForPassenger.get(req.user.id)
        : q.activeTripForDriver.get(req.user.id);
    res.json({ trip: t ? tripView(t, req.user.role) : null });
  });

  app.get('/api/trips', auth('passenger', 'driver'), (req, res) => {
    const column = req.user.role === 'passenger' ? 'passenger_id' : 'driver_id';
    const rows = db
      .prepare(`SELECT * FROM trips WHERE ${column} = ? ORDER BY id DESC LIMIT 50`)
      .all(req.user.id);
    res.json({ trips: rows.map((t) => tripView(t, req.user.role)) });
  });

  app.get('/api/trips/:id', auth(), (req, res) => {
    const t = loadTrip(req);
    const role = tripRole(t, req.user);
    if (!role) throw new HttpError(403, 'forbidden');
    res.json({ trip: tripView(t, role) });
  });

  app.post('/api/trips/:id/cancel', auth('passenger', 'driver'), (req, res) => {
    const t = loadTrip(req);
    const role = tripRole(t, req.user);
    if (!role) throw new HttpError(403, 'forbidden');
    if (!['requested', 'accepted', 'arrived'].includes(t.status)) throw new HttpError(409, 'cannot_cancel');

    if (role === 'driver') {
      // El taxista renuncia: el viaje vuelve a estar disponible para otros taxistas
      db.prepare(
        "UPDATE trips SET status = 'requested', driver_id = NULL, accepted_at = NULL, arrived_at = NULL WHERE id = ?"
      ).run(t.id);
      emitTrip(t.id);
      io.to(`user:${req.user.id}`).emit('trip:released', { id: t.id });
      notifyNearbyDrivers(q.trip.get(t.id));
    } else {
      db.prepare(
        "UPDATE trips SET status = 'cancelled', cancelled_by = 'passenger', cancelled_at = datetime('now') WHERE id = ?"
      ).run(t.id);
      emitTrip(t.id);
    }
    res.json({ trip: tripView(q.trip.get(t.id), role) });
  });

  app.post('/api/trips/:id/rate', auth('passenger'), (req, res) => {
    const t = loadTrip(req);
    if (t.passenger_id !== req.user.id) throw new HttpError(403, 'forbidden');
    if (t.status !== 'completed') throw new HttpError(409, 'trip_not_completed');
    if (t.rating != null) throw new HttpError(409, 'already_rated');
    const stars = Number(req.body && req.body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'invalid_rating');
    db.prepare('UPDATE trips SET rating = ?, rating_comment = ? WHERE id = ?').run(
      stars,
      cleanText(req.body.comment, 300) || null,
      t.id
    );
    res.json({ trip: tripView(q.trip.get(t.id), 'passenger') });
  });

  // Botón de pánico (pasajero o taxista)
  app.post('/api/trips/:id/sos', auth('passenger', 'driver'), (req, res) => {
    const t = loadTrip(req);
    if (!tripRole(t, req.user)) throw new HttpError(403, 'forbidden');
    const p = req.body && isLatLng({ lat: Number(req.body.lat), lng: Number(req.body.lng) })
      ? { lat: Number(req.body.lat), lng: Number(req.body.lng) }
      : { lat: null, lng: null };
    const { lastInsertRowid } = q.insertAlert.run('sos', t.id, req.user.id, cleanText(req.body && req.body.message, 300) || null, p.lat, p.lng);
    io.to('admins').emit('alert:new', alertView(q.alert.get(lastInsertRowid)));
    res.status(201).json({ ok: true, alertId: Number(lastInsertRowid), emergencyNumber: config.emergencyNumber });
  });

  // Reportar un problema de un viaje
  app.post('/api/trips/:id/report', auth('passenger', 'driver'), (req, res) => {
    const t = loadTrip(req);
    if (!tripRole(t, req.user)) throw new HttpError(403, 'forbidden');
    const message = cleanText(req.body && req.body.message, 500);
    if (!message) throw new HttpError(400, 'message_required');
    const { lastInsertRowid } = q.insertAlert.run('report', t.id, req.user.id, message, null, null);
    io.to('admins').emit('alert:new', alertView(q.alert.get(lastInsertRowid)));
    res.status(201).json({ ok: true });
  });

  // ----- Taxista -----

  app.post('/api/driver/status', auth('driver'), (req, res) => {
    const d = q.driver.get(req.user.id);
    const online = !!(req.body && req.body.online);
    if (online && !d.verified) throw new HttpError(403, 'driver_not_verified');
    db.prepare('UPDATE drivers SET online = ? WHERE user_id = ?').run(online ? 1 : 0, req.user.id);
    const p = req.body && { lat: Number(req.body.lat), lng: Number(req.body.lng) };
    if (p && isLatLng(p)) updateDriverLocation(req.user.id, p);
    setDriverRoom(req.user.id, online);
    res.json({ user: userView(req.user) });
  });

  app.post('/api/driver/location', auth('driver'), (req, res) => {
    const p = readPoint(req.body);
    updateDriverLocation(req.user.id, p);
    res.json({ ok: true });
  });

  app.get('/api/driver/requests', auth('driver'), (req, res) => {
    const d = q.driver.get(req.user.id);
    if (!d.verified || !d.online) return res.json({ requests: [] });
    const requests = q.openRequests
      .all()
      .map((t) => {
        const view = tripView(t, 'driver');
        if (d.lat != null) view.distanceToPickupKm = round1(distanceKm({ lat: t.pickup_lat, lng: t.pickup_lng }, d));
        return view;
      })
      .filter((v) => v.distanceToPickupKm == null || v.distanceToPickupKm <= config.maxDriverDistanceKm)
      .sort((a, b) => (a.distanceToPickupKm ?? 0) - (b.distanceToPickupKm ?? 0));
    res.json({ requests });
  });

  app.post('/api/trips/:id/accept', auth('driver'), (req, res) => {
    const d = q.driver.get(req.user.id);
    if (!d.verified) throw new HttpError(403, 'driver_not_verified');
    if (q.activeTripForDriver.get(req.user.id)) throw new HttpError(409, 'trip_already_active');
    const t = loadTrip(req);
    // Actualización atómica: solo un taxista puede aceptar el viaje
    const result = db
      .prepare(
        "UPDATE trips SET driver_id = ?, status = 'accepted', accepted_at = datetime('now') WHERE id = ? AND status = 'requested'"
      )
      .run(req.user.id, t.id);
    if (result.changes === 0) throw new HttpError(409, 'trip_not_available');
    emitTrip(t.id);
    res.json({ trip: tripView(q.trip.get(t.id), 'driver') });
  });

  app.post('/api/trips/:id/arrived', auth('driver'), (req, res) => {
    const t = loadTrip(req);
    if (t.driver_id !== req.user.id) throw new HttpError(403, 'forbidden');
    if (t.status !== 'accepted') throw new HttpError(409, 'invalid_status');
    db.prepare("UPDATE trips SET status = 'arrived', arrived_at = datetime('now') WHERE id = ?").run(t.id);
    emitTrip(t.id);
    res.json({ trip: tripView(q.trip.get(t.id), 'driver') });
  });

  // El taxista solo puede iniciar el viaje con el PIN que le dice el pasajero
  app.post('/api/trips/:id/start', auth('driver'), (req, res) => {
    const t = loadTrip(req);
    if (t.driver_id !== req.user.id) throw new HttpError(403, 'forbidden');
    if (!['accepted', 'arrived'].includes(t.status)) throw new HttpError(409, 'invalid_status');
    if (String((req.body && req.body.pin) || '').trim() !== t.pin) throw new HttpError(400, 'invalid_pin');
    db.prepare("UPDATE trips SET status = 'in_progress', started_at = datetime('now') WHERE id = ?").run(t.id);
    emitTrip(t.id);
    res.json({ trip: tripView(q.trip.get(t.id), 'driver') });
  });

  app.post('/api/trips/:id/complete', auth('driver'), (req, res) => {
    const t = loadTrip(req);
    if (t.driver_id !== req.user.id) throw new HttpError(403, 'forbidden');
    if (t.status !== 'in_progress') throw new HttpError(409, 'invalid_status');
    db.prepare("UPDATE trips SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(t.id);
    emitTrip(t.id);
    res.json({ trip: tripView(q.trip.get(t.id), 'driver') });
  });

  // ----- Seguimiento público (enlace compartido) -----

  app.get('/api/track/:token', (req, res) => {
    const t = q.tripByShare.get(String(req.params.token));
    if (!t) throw new HttpError(404, 'trip_not_found');
    res.json({ trip: tripView(t, 'public'), townName: config.townName });
  });

  // ----- Administración -----

  function alertView(a) {
    const user = q.userById.get(a.user_id);
    const t = a.trip_id ? q.trip.get(a.trip_id) : null;
    return {
      id: a.id,
      type: a.type,
      message: a.message,
      location: a.lat == null ? null : { lat: a.lat, lng: a.lng },
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, emergencyContact: user.emergency_contact },
      trip: t ? tripView(t, 'admin') : null,
    };
  }

  app.get('/api/admin/drivers', auth('admin'), (req, res) => {
    const ids = db.prepare('SELECT user_id FROM drivers ORDER BY verified, user_id DESC').all();
    res.json({ drivers: ids.map((r) => driverInfo(r.user_id)) });
  });

  app.post('/api/admin/drivers/:id/verify', auth('admin'), (req, res) => {
    const id = Number(req.params.id);
    if (!q.driver.get(id)) throw new HttpError(404, 'driver_not_found');
    const verified = !!(req.body && req.body.verified);
    if (verified) {
      db.prepare('UPDATE drivers SET verified = 1 WHERE user_id = ?').run(id);
    } else {
      db.prepare('UPDATE drivers SET verified = 0, online = 0 WHERE user_id = ?').run(id);
      setDriverRoom(id, false);
    }
    const info = driverInfo(id);
    io.to(`user:${id}`).emit('driver:verification', { verified: info.verified });
    res.json({ driver: info });
  });

  app.get('/api/admin/trips', auth('admin'), (req, res) => {
    const rows = db.prepare('SELECT * FROM trips ORDER BY id DESC LIMIT 100').all();
    res.json({ trips: rows.map((t) => tripView(t, 'admin')) });
  });

  app.get('/api/admin/alerts', auth('admin'), (req, res) => {
    const rows = db.prepare('SELECT * FROM alerts ORDER BY resolved_at IS NOT NULL, id DESC LIMIT 100').all();
    res.json({ alerts: rows.map(alertView) });
  });

  app.post('/api/admin/alerts/:id/resolve', auth('admin'), (req, res) => {
    const a = q.alert.get(Number(req.params.id));
    if (!a) throw new HttpError(404, 'alert_not_found');
    db.prepare("UPDATE alerts SET resolved_at = datetime('now') WHERE id = ?").run(a.id);
    res.json({ alert: alertView(q.alert.get(a.id)) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  });

  function close() {
    return new Promise((resolve) => {
      io.close();
      server.close(() => {
        db.close();
        resolve();
      });
    });
  }

  return { app, server, io, db, close };
}

function ensureAdmin(db, config) {
  const exists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (exists) return;
  const password = config.adminPassword || randomToken(6);
  db.prepare("INSERT INTO users (role, name, phone, password_hash) VALUES ('admin', 'Administración', ?, ?)").run(
    normalizePhone(config.adminPhone),
    hashPassword(password)
  );
  if (!config.adminPassword) {
    console.log(`\n[admin] Cuenta de administración creada -> usuario: ${config.adminPhone}  contraseña: ${password}`);
    console.log('[admin] Guárdala. Puedes fijarla con las variables ADMIN_PHONE y ADMIN_PASSWORD.\n');
  }
}

function isImageDataUrl(value) {
  return value.length <= MAX_PHOTO_LENGTH && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return next();
    }
    if (++entry.count > max) return res.status(429).json({ error: 'too_many_requests' });
    next();
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

module.exports = { createApp };
