const { spawn, execSync } = require('child_process');
const { join } = require('path');
const { writeFileSync, mkdirSync } = require('fs');
const { tmpdir } = require('os');
const http = require('http');
const https = require('https');

const PORT = process.env.METRO_PORT || 8081;
const token = process.env.NGROK_AUTHTOKEN;
const apiKey = process.env.NGROK_API_KEY;
if (!token) {
  console.error('TUNNEL_ERR=NGROK_AUTHTOKEN env var is not set');
  process.exit(1);
}

const bin = join(__dirname, 'node_modules', 'ngrok', 'bin', 'ngrok');
const configDir = join(tmpdir(), 'ngrok-v3-config');
mkdirSync(configDir, { recursive: true });
writeFileSync(join(configDir, 'ngrok.yml'), 'version: 3\n');
const configPath = join(configDir, 'ngrok.yml');

// The ngrok free plan reuses one reserved domain. If a previous session
// didn't shut down cleanly (pod killed mid-run), ngrok's cloud thinks the
// domain is still online and blocks with ERR_NGROK_334. If an API key is
// available, kill active endpoints before starting; otherwise retry.
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 15000;
let urlFound = false;

function killStale() {
  try { execSync('pkill -f "ngrok http" 2>/dev/null || true'); } catch {}
}

// Stop active ngrok endpoints via the REST API (needs API key, not authtoken)
function killRemoteEndpoints() {
  return new Promise((resolve) => {
    if (!apiKey) { resolve(); return; }
    const req = https.request('https://api.ngrok.com/endpoints', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Ngrok-Version': '2' },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const endpoints = data.endpoints || [];
          if (endpoints.length === 0) { resolve(); return; }
          let pending = endpoints.length;
          endpoints.forEach((ep) => {
            const delReq = https.request(`https://api.ngrok.com/endpoints/${ep.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Ngrok-Version': '2' },
            }, () => { if (--pending === 0) resolve(); });
            delReq.on('error', () => { if (--pending === 0) resolve(); });
            delReq.end();
          });
        } catch { resolve(); }
      });
    });
    req.on('error', () => resolve());
    req.end();
  });
}

function startTunnel(attempt) {
  if (attempt > MAX_RETRIES) {
    console.error('TUNNEL_ERR=could not start tunnel after ' + MAX_RETRIES + ' retries. The reserved domain may still be held by a stale session. Create an NGROK_API_KEY (dashboard -> API Keys) so tunnel.js can force-kill stale endpoints.');
    process.exit(1);
  }

  killStale();
  if (attempt > 1) console.error('TUNNEL_RETRY=attempt ' + attempt + ' (waiting for stale session to clear)');

  killRemoteEndpoints().then(() => {
    const proc = spawn(bin, [
      'http', PORT,
      `--authtoken=${token}`,
      `--config=${configPath}`,
      '--log=stdout',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let got334 = false;
    const deadline = Date.now() + 20000;

    function checkErr(data) {
      if (data.toString().includes('ERR_NGROK_334')) got334 = true;
    }
    proc.stdout.on('data', checkErr);
    proc.stderr.on('data', checkErr);

    proc.on('exit', () => {
      if (urlFound) return;
      if (got334 && attempt < MAX_RETRIES) {
        setTimeout(() => startTunnel(attempt + 1), RETRY_DELAY_MS);
      } else {
        console.error('TUNNEL_ERR=ngrok exited unexpectedly');
        process.exit(1);
      }
    });

    function poll() {
      http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const tunnels = JSON.parse(body).tunnels;
            const url = tunnels && tunnels[0] && tunnels[0].public_url;
            if (url) { urlFound = true; console.log('TUNNEL_URL=' + url); return; }
          } catch {}
          if (!got334 && Date.now() < deadline) setTimeout(poll, 500);
          else if (!urlFound && !got334) {
            console.error('TUNNEL_ERR=timed out waiting for tunnel URL');
            proc.kill();
            process.exit(1);
          }
        });
      }).on('error', () => {
        if (!got334 && Date.now() < deadline) setTimeout(poll, 500);
      });
    }
    setTimeout(poll, 1000);
  });
}

startTunnel(1);
