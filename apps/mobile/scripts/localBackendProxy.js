/* eslint-env node */
const http = require('http');

/**
 * Dev-only Metro middleware that forwards backend traffic to a local stack, so the phone reaches
 * Metro, the API and file storage through Metro's single tunnel:
 *   /api/*                   → the local server
 *   presigned storage URLs   → MinIO (signed for this public host via S3_PUBLIC_ENDPOINT)
 * Everything else falls through to Metro.
 */
module.exports = function createLocalBackendProxy({ backendUrl, storageUrl }) {
  const backend = new URL(backendUrl);
  const storage = new URL(storageUrl);

  return function localBackendProxy(req, res, next) {
    const target = req.url.startsWith('/api/') ? backend : isPresignedUrl(req.url) ? storage : null;
    if (!target) return next();

    // The tunnel may rewrite Host; storage signatures are checked against the public host.
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    const upstream = http.request(
      {
        host: target.hostname,
        port: target.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  };
};

function isPresignedUrl(url) {
  return url.includes('X-Amz-Signature=');
}
