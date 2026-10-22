// Configuración de la aplicación.
// Edita los valores por defecto o sobrescríbelos con variables de entorno.

const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};

function loadConfig(env = process.env) {
  return {
    port: num(env.PORT, 3000),
    dbPath: env.DB_PATH || 'data/taxi.db',

    // Nombre de tu localidad (aparece en la app)
    townName: env.TOWN_NAME || 'Mi Localidad',

    // Centro del mapa al abrir la app (latitud, longitud) y zoom
    mapCenter: {
      lat: num(env.MAP_LAT, 40.4168),
      lng: num(env.MAP_LNG, -3.7038),
    },
    mapZoom: num(env.MAP_ZOOM, 14),

    // Número de emergencias local (911, 112, 066...)
    emergencyNumber: env.EMERGENCY_NUMBER || '112',

    // Tarifas: el precio se calcula y se fija ANTES de subir al taxi
    currency: env.CURRENCY || 'EUR',
    fares: {
      base: num(env.FARE_BASE, 2.5), // bajada de bandera
      perKm: num(env.FARE_PER_KM, 1.2), // precio por kilómetro
      minimum: num(env.FARE_MINIMUM, 5), // tarifa mínima
      nightSurchargePct: num(env.FARE_NIGHT_PCT, 20), // recargo nocturno (%)
      nightStartHour: num(env.FARE_NIGHT_START, 22),
      nightEndHour: num(env.FARE_NIGHT_END, 6),
    },
    // Factor para pasar de distancia en línea recta a distancia por carretera
    routeFactor: num(env.ROUTE_FACTOR, 1.3),

    // Solo se avisa a taxistas a esta distancia (km) o menos del punto de recogida
    maxDriverDistanceKm: num(env.MAX_DRIVER_DISTANCE_KM, 15),

    // Cuenta de administración inicial (verifica a los taxistas)
    adminPhone: env.ADMIN_PHONE || 'admin',
    adminPassword: env.ADMIN_PASSWORD || '',
  };
}

module.exports = { loadConfig };
