#!/usr/bin/env node
/**
 * onvif_control_event_listener
 * Version: 1.0.5
 * Language: English (logs, help)
 *
 * Simple HTTP listener for ONVIF WS-Notification Push events.
 * - Writes raw incoming SOAP/XML events to a file (with timestamp prefix)
 * - Optional console logging with timestamps
 * - Log rotation by max file size
 * - Health endpoint for quick checks
 *
 * Usage:
 *   node onvif_control_event_listener.1.0.5.js [--port=9000] [--path=/onvif_hook]
 *       [--outfile=/tmp/onvif_control_listener.txt] [--rotate_mb=20]
 *       [--bind=0.0.0.0] [--verbose] [--debug] [--max_body_mb=10] [--help]
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--help' || tok === '-h') { args.help = true; continue; }
    if (tok.startsWith('--')) {
      const [k, v] = tok.split('=', 2);
      if (v !== undefined) {
        args[k.slice(2)] = v;
      } else {
        // allow space-separated values
        const next = argv[i+1];
        if (next && !next.startsWith('--')) { args[k.slice(2)] = next; i++; }
        else { args[k.slice(2)] = true; }
      }
    } else {
      // ignore positional for now
    }
  }
  return args;
}

function ts(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function printHelp() {
  const help = `
onvif_control_event_listener v1.0.5

A minimal HTTP listener for ONVIF WS-Notification (push) events.
It accepts POSTs at --path and writes the raw body to --outfile with a timestamp.

USAGE
  node onvif_control_event_listener.1.0.5.js [options]

OPTIONS
  --port <int>            TCP port to listen on (default: 9000)
  --bind <ip>             Bind address (default: 0.0.0.0)
  --path <string>         HTTP path for incoming events (default: /onvif_hook)
  --outfile <path>        Destination file for raw events (default: /tmp/onvif_control_listener.txt)
  --rotate_mb <int>       Rotate file when size reaches this many MB (default: 20)
  --max_body_mb <int>     Maximum accepted body size in MB (default: 10)
  --verbose               Print info lines for each event (filename, rotation, etc.)
  --debug                 Print full event body and request metadata to console
  --help, -h              Show this help

ENDPOINTS
  POST <path>             Receive events
  GET  /health            Health check → "ok"

NOTES
  - Every line written to the outfile is prefixed with "YYYY-MM-DD HH:MM:SS - "
  - Rotation renames the current outfile to "<outfile>.<YYYYMMDD-HHMMSS>.log" and starts a fresh file
`;
  console.log(help.trim());
}

(function main(){
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  const port = parseInt(args.port || '9000', 10);
  const bind = args.bind || '0.0.0.0';
  const hookPath = (args.path || '/onvif_hook').trim() || '/onvif_hook';
  const outFile = args.outfile || '/tmp/onvif_control_listener.txt';
  const rotateMb = parseInt(args.rotate_mb || '20', 10);
  const maxBodyMb = parseInt(args.max_body_mb || '10', 10);
  const verbose = !!args.verbose;
  const debug = !!args.debug;

  function log(level, msg) {
    console.log(`${ts()} - [${level}] ${msg}`);
  }

  function ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  function rotateIfNeeded(filePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      const st = fs.statSync(filePath);
      if (st.size >= rotateMb * 1024 * 1024) {
        const stamp = new Date();
        const stampS =
          `${stamp.getFullYear()}${String(stamp.getMonth()+1).padStart(2,'0')}${String(stamp.getDate()).padStart(2,'0')}` +
          `-${String(stamp.getHours()).padStart(2,'0')}${String(stamp.getMinutes()).padStart(2,'0')}${String(stamp.getSeconds()).padStart(2,'0')}`;
        const newName = `${filePath}.${stampS}.log`;
        fs.renameSync(filePath, newName);
        if (verbose) log('INFO', `rotated: ${newName}`);
      }
    } catch (e) {
      log('ERROR', `rotation failed: ${e.message}`);
    }
  }

  ensureDirForFile(outFile);
  if (verbose) {
    log('INFO', `onvif_control_event_listener v1.0.5 listening on ${bind}:${port}${hookPath}`);
    log('INFO', `writing to: ${outFile} (rotate at ${rotateMb} MB)`);
    if (debug) log('INFO', `debug enabled`);
  }

  const server = http.createServer((req, res) => {
    const { method } = req;
    const parsed = url.parse(req.url, true);
    if (method === 'GET' && parsed.pathname === '/health') {
      res.writeHead(200, {'Content-Type':'text/plain'});
      res.end('ok');
      return;
    }
    if (method !== 'POST' || parsed.pathname !== hookPath) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('not found');
      return;
    }

    const chunks = [];
    let total = 0;
    const maxBytes = maxBodyMb * 1024 * 1024;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        if (debug) log('WARN', `request body exceeded max_body_mb=${maxBodyMb}, dropping`);
        req.destroy();
        try {
          res.writeHead(413, {'Content-Type':'text/plain'});
          res.end('payload too large');
        } catch {}
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const remote = req.socket && req.socket.remoteAddress || 'unknown';
      const body = Buffer.concat(chunks).toString('utf8');
      // Write one block: timestamp + raw body
      const line = `${ts()} - ${body}\n`;
      try {
        rotateIfNeeded(outFile);
        fs.appendFileSync(outFile, line, { encoding: 'utf8' });
        if (verbose) log('VERBOSE', `event written → ${outFile}`);
      } catch (e) {
        log('ERROR', `failed to write event: ${e.message}`);
      }

      if (debug) {
        log('DEBUG', `request from ${remote} → ${method} ${parsed.pathname}`);
        log('DEBUG', `headers: ${JSON.stringify(req.headers)}`);
        log('DEBUG', `raw body:\n${body}`);
      }
      res.writeHead(200, {'Content-Type':'text/plain'});
      res.end('OK');
      if (debug) log('DEBUG', `replied 200 OK to ${remote}`);
    });
    req.on('error', (e) => {
      if (debug) log('ERROR', `request error: ${e.message}`);
      try {
        res.writeHead(500, {'Content-Type':'text/plain'});
        res.end('error');
      } catch {}
    });
  });

  server.listen(port, bind);
})();
