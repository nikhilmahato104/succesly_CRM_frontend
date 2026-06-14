import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

// ── ImageKit signature proxy ───────────────────────────────────────────────
// imagekit.io's signature endpoint rejects any origin that isn't
// https://imagekit.io. The browser cannot fake the Origin header, so we
// proxy through the Vite dev-server (Node.js) which can set any header.
//
// Frontend sends:  POST /ik-signature
//   Headers: csrf-token, x-ik-cookie (full imagekit.io cookie string)
//   Body:    same JSON that goes to imagekit.io
//
// Proxy rewrites origin + referer → imagekit.io values and forwards.
function ikSignatureProxyPlugin(): Plugin {
  return {
    name: 'ik-signature-proxy',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Handle CORS preflight
        if (req.url === '/ik-signature' && req.method === 'OPTIONS') {
          res.writeHead(204, {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type, csrf-token, x-ik-cookie',
          });
          res.end();
          return;
        }

        if (req.url !== '/ik-signature' || req.method !== 'POST') return next();

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => {
          const csrfToken = (req.headers['csrf-token'] as string) || '';
          const ikCookie  = (req.headers['x-ik-cookie']  as string) || '';
          const bodyBuf   = Buffer.from(body, 'utf8');

          const proxyReq = https.request({
            hostname: 'imagekit.io',
            port: 443,
            path: '/api/clients/54DZYShIdN/upload/signature/v2',
            method: 'POST',
            headers: {
              'content-type':   'application/json',
              'content-length': bodyBuf.byteLength,
              'origin':         'https://imagekit.io',
              'referer':        'https://imagekit.io/dashboard/media-library',
              'csrf-token':     csrfToken,
              'cookie':         ikCookie,
              'user-agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
              'accept':         'application/json',
            },
          }, (proxyRes) => {
            let responseBody = '';
            proxyRes.setEncoding('utf8');
            proxyRes.on('data', (chunk: string) => { responseBody += chunk; });
            proxyRes.on('end', () => {
              res.writeHead(proxyRes.statusCode || 500, {
                'content-type': 'application/json',
                'access-control-allow-origin': '*',
              });
              res.end(responseBody);
            });
          });

          proxyReq.on('error', (err: Error) => {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
          });

          proxyReq.write(bodyBuf);
          proxyReq.end();
        });
      });
    },
  };
}

// ── iframe proxy ──────────────────────────────────────────────────────────
function iframeProxyPlugin(): Plugin {
  return {
    name: 'iframe-proxy',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/iframe-proxy')) return next();

        const qs = req.url.includes('?') ? req.url.split('?')[1] : '';
        const targetUrl = new URLSearchParams(qs).get('url');

        if (!targetUrl) {
          res.writeHead(400);
          res.end('Missing ?url= parameter');
          return;
        }

        let parsed: URL;
        try {
          parsed = new URL(targetUrl);
        } catch {
          res.writeHead(400);
          res.end('Invalid URL');
          return;
        }

        const lib = parsed.protocol === 'https:' ? https : http;

        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
          },
        };

        const proxyReq = lib.request(options, (proxyRes) => {
          if (
            (proxyRes.statusCode === 301 || proxyRes.statusCode === 302 ||
             proxyRes.statusCode === 307 || proxyRes.statusCode === 308) &&
            proxyRes.headers.location
          ) {
            const redirected = new URL(proxyRes.headers.location, targetUrl).href;
            res.writeHead(302, { Location: `/iframe-proxy?url=${encodeURIComponent(redirected)}` });
            res.end();
            return;
          }

          const headers: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) {
            const lower = k.toLowerCase();
            if (lower === 'x-frame-options' || lower === 'content-security-policy' || lower === 'x-content-type-options') continue;
            if (v !== undefined) headers[k] = v as string | string[];
          }
          headers['access-control-allow-origin'] = '*';

          const contentType = (headers['content-type'] as string) || '';

          if (contentType.includes('text/html')) {
            let body = '';
            proxyRes.setEncoding('utf8');
            proxyRes.on('data', (chunk: string) => (body += chunk));
            proxyRes.on('end', () => {
              const baseTag = `<base href="${targetUrl}">`;
              const injected = body
                .replace(/(<head[^>]*>)/i, `$1${baseTag}`)
                .replace(/(<HEAD[^>]*>)/i, `$1${baseTag}`);
              const buf = Buffer.from(injected, 'utf8');
              headers['content-length'] = String(buf.byteLength);
              delete headers['transfer-encoding'];
              res.writeHead(proxyRes.statusCode || 200, headers);
              res.end(buf);
            });
          } else {
            res.writeHead(proxyRes.statusCode || 200, headers);
            proxyRes.pipe(res);
          }
        });

        proxyReq.on('error', (err: Error) => {
          res.writeHead(502);
          res.end(`Proxy error: ${err.message}`);
        });

        proxyReq.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ikSignatureProxyPlugin(), iframeProxyPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Prevent esbuild from pre-bundling @imgly/background-removal and its heavy ONNX deps.
  // They are loaded lazily via dynamic import() at runtime and must not be inlined.
  optimizeDeps: {
    exclude: ['@imgly/background-removal', 'onnxruntime-web'],
  },

  build: {
    target: 'es2015',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      external: [/^onnxruntime-web/],
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-state':  ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
          'vendor-forms':  ['formik', 'yup'],
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-adapter-date-fns'],
          'vendor-ui':     ['clsx', 'framer-motion', '@headlessui/react'],
          'vendor-date':   ['date-fns', 'dayjs'],
          'vendor-http':   ['axios'],
        },
      },
    },
  },
});
