const { spawn, execSync } = require('child_process');
const { join } = require('path');
const { writeFileSync, mkdirSync } = require('fs');
const { tmpdir } = require('os');
const http = require('http');

const PORT = process.env.METRO_PORT || 8081;
const token = process.env.NGROK_AUTHTOKEN;
if (!token) {
  console.error('TUNNEL_ERR=NGROK_AUTHTOKEN env var is not set');
  process.exit(1);
}

const bin = join(__dirname, 'node_modules', 'ngrok', 'bin', 'ngrok');
const configDir = join(tmpdir(), 'ngrok-v3-config');
mkdirSync(configDir, { recursive: true });
writeFileSync(join(configDir, 'ngrok.yml'), 'version: 3\n');
const configPath = join(configDir, 'ngrok.yml');

// kill any stale ngrok process before starting
try { execSync('pkill -f "ngrok http" 2>/dev/null || true'); } catch {}

const proc = spawn(bin, [
  'http', PORT,
  `--authtoken=${token}`,
  `--config=${configPath}`,
  '--log=stdout',
], { stdio: ['ignore', 'pipe', 'pipe'] });

proc.on('exit', (code) => {
  console.error('TUNNEL_ERR=ngrok exited with code ' + code);
  process.exit(1);
});

// poll the ngrok API until the tunnel URL appears
const deadline = Date.now() + 20000;
function poll() {
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(body).tunnels;
        const url = tunnels && tunnels[0] && tunnels[0].public_url;
        if (url) { console.log('TUNNEL_URL=' + url); return; }
      } catch {}
      if (Date.now() < deadline) setTimeout(poll, 500);
      else { console.error('TUNNEL_ERR=timed out waiting for tunnel URL'); proc.kill(); process.exit(1); }
    });
  }).on('error', () => {
    if (Date.now() < deadline) setTimeout(poll, 500);
    else { console.error('TUNNEL_ERR=timed out waiting for tunnel URL'); proc.kill(); process.exit(1); }
  });
}
setTimeout(poll, 1000);
