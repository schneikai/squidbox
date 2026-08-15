const ngrok = require('@expo/ngrok');
const path = require('path');
const os = require('os');

// Mirror Expo CLI's AsyncNgrok: shared auth token + exp.direct domain.
const NGROK_AUTH_TOKEN = '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8';
const configPath = path.join(os.homedir(), '.expo', 'ngrok.yml');

ngrok.connect({
  port: 8081,
  proto: 'http',
  authtoken: NGROK_AUTH_TOKEN,
  configPath,
  hostname: 'anonymous-8081.exp.direct',
})
  .then(url => { console.log('TUNNEL_URL=' + url); })
  .catch(err => { console.error('TUNNEL_ERR=' + (err.body ? JSON.stringify(err.body) : err.message)); process.exit(1); });
