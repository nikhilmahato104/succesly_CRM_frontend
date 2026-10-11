import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

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
  plugins: [react(), iframeProxyPlugin()],

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
