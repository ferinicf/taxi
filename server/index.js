const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const { server } = createApp(config);

server.listen(config.port, () => {
  console.log(`Taxi Seguro (${config.townName}) funcionando en http://localhost:${config.port}`);
});
