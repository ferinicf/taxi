# 🚕 Taxi Seguro

Aplicación web para pedir taxis **verificados** de tu localidad, pensada para que
**vecinos y turistas** viajen con más seguridad. Funciona en cualquier móvil desde
el navegador y se puede "instalar" en la pantalla de inicio (PWA), sin pasar por
las tiendas de apps.

## Funciones de seguridad

| Función | Para qué sirve |
| --- | --- |
| ✅ **Taxistas verificados** | Un taxista no puede recibir viajes hasta que la central revisa su licencia, matrícula y foto. |
| 🪪 **Ficha del taxista** | Antes de subir, el pasajero ve foto, nombre, matrícula, vehículo, color, nº de licencia y valoraciones. |
| 🔢 **PIN de embarque** | El pasajero recibe un código de 4 cifras. El taxista **no puede iniciar el viaje** sin ese código, así se confirma que es el taxi correcto. |
| 📲 **Compartir viaje en vivo** | Enlace para enviar por WhatsApp a un familiar o al hotel: muestra en directo dónde está el taxi y sus datos (sin teléfonos ni PIN). |
| 🚨 **Botón SOS** | Avisa al instante a la central con la ubicación y llama al número de emergencias. Disponible para pasajero **y** taxista. |
| 💶 **Precio fijo** | El precio se calcula y se muestra **antes** de pedir el taxi: nada de sorpresas para los turistas. |
| ⭐ **Valoraciones y reportes** | Tras cada viaje se valora al taxista; cualquier problema se puede reportar a la central. |
| 🌍 **Español / Inglés** | Cambia de idioma con un botón (detecta el idioma del móvil). |

## Tres tipos de usuario

- **Pasajero** (`/pasajero.html`): marca la recogida (GPS o tocando el mapa), busca el destino, ve el precio y pide el taxi.
- **Taxista** (`/conductor.html`): se registra con sus datos y foto, se pone "en servicio", recibe solicitudes cercanas al instante, acepta, navega con Google Maps, introduce el PIN e inicia/finaliza el viaje.
- **Central / administración** (`/admin.html`): verifica o retira a taxistas, recibe alertas SOS en tiempo real (con ubicación y teléfonos) y ve todos los viajes.

## Cómo ponerla en marcha (en tu ordenador)

Necesitas [Node.js](https://nodejs.org) versión **22.13 o superior**.

```bash
npm install
ADMIN_PASSWORD=una-clave-segura TOWN_NAME="Mi Pueblo" npm start
```

Abre <http://localhost:3000>. Para entrar a la central usa el usuario `admin` y la
contraseña que pusiste en `ADMIN_PASSWORD` (si no pones ninguna, se genera una y se
muestra en la consola la primera vez).

Para probarlo todo tú solo, abre tres ventanas (una normal y dos de incógnito):
una como pasajero, otra como taxista y otra como central.

### Pruebas automáticas

```bash
npm test
```

## Configuración para tu localidad

Todo se ajusta con variables de entorno (o editando `server/config.js`):

| Variable | Qué es | Por defecto |
| --- | --- | --- |
| `TOWN_NAME` | Nombre de tu localidad | `Mi Localidad` |
| `MAP_LAT`, `MAP_LNG`, `MAP_ZOOM` | Centro del mapa | Madrid |
| `EMERGENCY_NUMBER` | Teléfono de emergencias | `112` |
| `CURRENCY` | Moneda (`EUR`, `MXN`, `USD`, `ARS`…) | `EUR` |
| `FARE_BASE` | Bajada de bandera | `2.5` |
| `FARE_PER_KM` | Precio por km | `1.2` |
| `FARE_MINIMUM` | Tarifa mínima | `5` |
| `FARE_NIGHT_PCT` | Recargo nocturno en % | `20` |
| `FARE_NIGHT_START`, `FARE_NIGHT_END` | Horario nocturno | `22` a `6` |
| `MAX_DRIVER_DISTANCE_KM` | Radio para avisar a taxistas | `15` |
| `ADMIN_PHONE`, `ADMIN_PASSWORD` | Acceso de la central | `admin` / aleatoria |
| `PORT` | Puerto del servidor | `3000` |
| `DB_PATH` | Archivo de base de datos | `data/taxi.db` |

## Publicarla en internet

Para que funcione en los móviles necesitas publicarla con **HTTPS** (los navegadores
solo dan acceso al GPS en páginas seguras). Opciones sencillas:

- **Render, Railway o Fly.io**: conectas este repositorio de GitHub, pones el comando
  `npm start`, añades las variables de entorno y un **disco persistente** para la
  carpeta `data/` (ahí vive la base de datos).
- **Un servidor propio (VPS)**: Node.js + un proxy como Caddy o Nginx con certificado
  HTTPS gratuito.

## Estructura del proyecto

```
server/
  index.js     arranque del servidor
  app.js       API REST + tiempo real (Socket.io)
  db.js        base de datos SQLite
  config.js    configuración (tarifas, localidad…)
  util.js      precio, distancias, contraseñas
public/
  index.html        portada, registro y acceso
  pasajero.html     pedir taxi
  conductor.html    app del taxista
  admin.html        central
  seguimiento.html  enlace público para seguir un viaje
  js/, css/         código de la interfaz
test/               pruebas automáticas
```

## Próximos pasos recomendados

Esta es una primera versión funcional (MVP). Antes de lanzarla al público conviene:

1. **Verificar teléfonos por SMS** (código de un solo uso) para evitar cuentas falsas.
2. **Notificaciones push** para que el taxista reciba viajes con la app cerrada.
3. **Rutas reales** (por ejemplo con OSRM) en lugar de la distancia estimada.
4. **Proveedor de mapas propio o de pago**: los servidores gratuitos de OpenStreetMap
   (mapas y buscador Nominatim) tienen límites de uso pensados para proyectos pequeños.
5. **Aspectos legales**: hablar con el ayuntamiento / asociación de taxistas sobre
   licencias y tarifas oficiales, y cumplir la ley de protección de datos
   (aviso de privacidad, consentimiento para la ubicación, borrado de datos).
6. **Pagos con tarjeta** dentro de la app (opcional).
