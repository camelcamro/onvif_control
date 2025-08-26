#!/usr/bin/env node
// onvif_control.js
// ONVIF Control Script - Full SOAP Implementation + Events (subscribe/renew/unsubscribe)
//
// Version: 1.1.9
// Build Date: 2025-08-26
//
// - Backwards compatible with v1.1.8 actions & flags
// - New actions: subscribe_events, renew_subscription, unsubscribe
// - New flags : --mode, --push_url, --termination, --timeout, --message_limit, --subscription, --auto_renew
//
// Usage examples (events):
//   node onvif_control.1.1.9.js --ip=172.20.1.172 --port=8080 --user=admin --pass=*** \
//     --action=subscribe_events --mode=push --termination=PT300S \
//     --push_url=http://172.20.1.103:9000/onvif_hook --debug --verbose
//
//   node onvif_control.1.1.9.js --action=renew_subscription \
//     --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=2 \
//     --user=admin --pass=*** --termination=PT300S --verbose
//
//   node onvif_control.1.1.9.js --action=unsubscribe \
//     --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=2 \
//     --user=admin --pass=*** --verbose

'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const xml2js = require('xml2js');
const { execSync } = require('child_process');
const args = require('minimist')(process.argv.slice(2), {
  alias: {
    v: 'verbose', d: 'debug', l: 'log', m: 'mute', h: 'help', t: 'time',
    z: 'zoom', p: 'pan', u: 'user', i: 'ip', k: 'token', e: 'preset',
    n: 'presetname', r: 'dry-run', y: 'tilt'
  },
  // Keep strings for tokens & new event flags
  string: [
    'token','k','preset','e','presetname','n',
    'push_url','termination','timeout','subscription','eventtype'
  ]
});

const VERSION = '1.1.9';
const BUILD_DATE = '2025-08-26';
const PROFILE_TOKEN = args.token || 'MainStreamProfileToken';
const WAKEUP = 'wakeup' in args;
const WAKEUP_SIMPLE = 'wakeup_simple' in args;

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Sleep after wakeup call for SOAP requests
const WAKEUP_SLEEP_MS = 1000;
// Timeout in milliseconds for SOAP requests
const SOCKET_TIMEOUT_MS = 5000;

// Discovered service endpoints (filled by GetServices / GetCapabilities)
const DISCOVERY = { media1: null, media2: null, ptz: null, events: null };

function showHelp() {
  console.log(`
  ONVIF Control Script - Version ${VERSION} (${BUILD_DATE})

  Usage:
    node onvif_control.js --ip=IP --port=PORT --action=<action> [options]

  Core options:
    --ip, -i         Camera IP
    --port           Camera ONVIF port (e.g. 80 or 8080)
    --user, -u       Username (ONVIF user)
    --pass           Password
    --token, -k      ProfileToken (e.g. from get_profiles)
    --time, -t       Duration (s) for continuous move/zoom
    --debug, -d      Print arguments + raw SOAP
    --verbose, -v    Verbose logs
    --help, -h       This help
    --version        Print version

  Actions (grouped & alphabetically sorted):

  [Discovery]
    get_services                 Discover XAddr endpoints (Media v2/v1, PTZ, Events)

  [PTZ]
    absolutemove                 Move to absolute PT coordinates
    configoptions                Get PTZ configuration options
    get_configurations           List PTZ configurations
    get_nodes                    List PTZ nodes
    get_presets                  List PTZ presets (tokens & names)
    goto                         Go to preset by token
    move                         Continuous pan/tilt for --time seconds
    relativemove                 Relative PT step
    removepreset                 Delete PTZ preset by token
    setpreset                    Create a PTZ preset (returns token)
    status                       Get PTZ status
    stop                         Stop PT and/or zoom
    zoom                         Continuous zoom for --time seconds

  [Media]
    get_profiles                 List media profiles (prefers Media v2)
    get_snapshot_uri             Get JPEG snapshot URL
    get_stream_uri               Get RTSP stream URL
    get_video_encoder_configuration  Read current video encoder settings
    set_video_encoder_configuration  Change video encoder settings

  [Device / Network]
    add_user                     Create ONVIF user
    delete_user                  Delete ONVIF user
    enable_dhcp                  Enable DHCP (IPv4)
    factoryreset                 Factory reset the device
    get_capabilities             Get ONVIF capabilities
    get_device_information       Get model, firmware, serial
    get_dns                      Get DNS configuration
    get_users                    List ONVIF users
    get_network_interfaces       Get interface info: MAC, IP, DHCP
    get_system_date_and_time     Read current device time
    get_system_info              Get system info (model/vendor)
    get_system_logs              Get system/access logs (--logtype=System|Access)
    gethostname                  Get device hostname
    reboot                       Reboot the device
    reset_password               Reset ONVIF password for a username
    set_dns                      Set DNS configuration
    set_network_interfaces       Configure network interface (IPv4)
    set_ntp                      Set NTP server
    set_static_ip                Assign static IPv4 (shim of SetNetworkInterfaces)
    setdatetime                  Set local time/timezone to current host time
    sethostname                  Set device hostname

  [Events / Detection]
    get_event_properties         Get ONVIF event capabilities
    get_motion_detection         Read motion detection settings
    renew_subscription           Renew an existing subscription (by Subscription Manager URL)
    set_motion_detection         Enable/disable motion detection
    subscribe_events             Create/Subscribe to ONVIF events subscription (push or pull + auto-fallback to DEVICE on 404/405/timeout)
    subscribe_events_device      Legacy subscribe via Device service (fallback)
    unsubscribe                  Cancel an existing subscription (by Subscription Manager URL)

  Aliases (kept for backward compatibility):
    configurations      → get_configurations
    preset              → goto
    presets             → get_presets
    get_static_ip       → get_network_interfaces

  Options specific to Events:
    --mode <push|pull>           Delivery mode (default: push)
    --push_url <url>             Push: consumer URL (e.g. http://host:9000/onvif_hook)
    --termination <dur>          Requested TTL (ISO8601 duration, default: PT60S)
    --timeout <dur>              Pull: timeout per PullMessages (default: PT30S) [reserved]
    --message_limit <int>        Pull: max messages per pull (default: 10) [reserved]
    --subscription <url>         Subscription Manager URL (for renew_subscription / unsubscribe)
    --auto_renew                 Keep renewing automatically (subscribe_events only)
    --auto_unsubscribe_on_exit   On SIGINT/SIGTERM, auto-unsubscribe (when auto_renew is active)

  Other optional options (unchanged):
    --bitrate                     Bitrate in kbps (set_video_encoder_configuration)
    --codec                       Codec (e.g. H264)
    --datetime                    Manual UTC datetime (setdatetime override)
    --del_username                Username to delete (delete_user)
    --dhcp                        DHCP enable flag (set_network_interfaces)
    --dns1, --dns2                DNS servers (set_dns)
    --eventtype                   Event filter hint (not all cameras use it)
    --enable <true|false|1|0>     Enable/disable (set_motion_detection)
    --gateway                     Gateway IP (set_network_interfaces)
    --hostname                    New hostname (sethostname)
    --log, -l                     Send log lines to system logger
    --netmask                     Netmask (set_network_interfaces)
    --new_password                Password for new user (add_user)
    --new_userlevel               Access level (Administrator, User, Operator)
    --new_username                Username to create (add_user)
    --ntp_server                  NTP server IP/host (set_ntp)
    --pan, -p                     Pan value
    --preset=<NAME>, -e           Preset name (setpreset) or for legacy alias
    --presetname=<NAME>, -n       Preset name (setpreset)
    --resolution                  WidthxHeight (set_video_encoder_configuration)
    --tilt, -y                    Tilt value
    --username                    Target username (reset_password)
    --wakeup                      Send GetNodes→GetConfigurations→GetPresets before PTZ
    --wakeup_simple               Send GetPresets before PTZ
    --zoom, -z                    Zoom value

  `);
  process.exit(0);
}

if (args.help) showHelp();
if (args.version) {
  console.log(`ONVIF Control Script\nVersion: ${VERSION}\nBuild Date: ${BUILD_DATE}`);
  process.exit(0);
}

function errorOut(msg, code = 1) {
  if (!args.mute) console.error(`ERROR: ${msg}\nUse --help to view usage.`);
  process.exit(code);
}
['ip', 'port', 'action'].forEach(param => {
  if (!args[param]) errorOut(`Missing required parameter: --${param}`);
});

function mask(obj) {
  const clone = { ...obj };
  if (clone.pass) clone.pass = '***';
  return clone;
}

const duration = args.time ? parseFloat(String(args.time).replace(',', '.')) * 1000 : 1000;
if (args.time && (isNaN(duration) || duration <= 0)) errorOut('--time must be a positive number');

function logMessage(msg) {
  if (args.log) {
    try { execSync(`logger -t onvif "${msg.replace(/"/g, '\\"')}"`); } catch {}
  }
}

logMessage(`Called script onvif_control.js with ${process.argv.slice(2).join(' ')}`);
if (args.verbose) console.log('[INFO] Called with:', mask(args));
if (args.debug) console.log(JSON.stringify(mask(args), null, 2));
if (args['dry-run']) process.exit(0);

// Arg shorthands
const hostname = args.hostname;
const ip = args.ip;
const netmask = args.netmask;
const gateway = args.gateway;
const dhcp = args.dhcp;
const dns1 = args.dns1;
const dns2 = args.dns2;
const ntp = args.ntp_server;
const datetime = args.datetime;
const username_reset = args.username;
const newpass_reset = args.new_password;
const resolution = args.resolution;
const bitrate = args.bitrate;
const codec = args.codec;
const eventtype = args.eventtype;
const logtype = args.logtype;
const enable_motion = args.enable;

// Events-related args
const mode = (args.mode || 'push').toLowerCase();
const pushUrl = args.push_url || args.pushurl;
const termination = args.termination || 'PT60S';
const timeout = args.timeout || 'PT30S';
const msgLimit = args.message_limit ? parseInt(args.message_limit, 10) : 10;
const autoRenew = !!args.auto_renew;
const subscriptionUrlArg = args.subscription;

const newUser = args.new_username;
const newPass = args.new_password;
const newLevel = args.new_userlevel;
const delUser = args.del_username;

// === Helper: Build WS-Security Header ===
function buildWSSecurity(username, password) {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const digest = crypto.createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(password || '')]))
    .digest('base64');
  return {
    Username: username || '',
    PasswordDigest: digest,
    Nonce: nonce.toString('base64'),
    Created: created
  };
}

function wsseHeaderXml() {
  if (!(args.user && args.pass)) return '';
  const ws = buildWSSecurity(args.user, args.pass);
  var s = '';
  s += '<s:Header>';
  s += '<wsse:Security s:mustUnderstand="1"';
  s += ' xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"';
  s += ' xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">';
  s += '<wsse:UsernameToken>';
  s += '<wsse:Username>' + args.user + '</wsse:Username>';
  s += '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + ws.PasswordDigest + '</wsse:Password>';
  s += '<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' + ws.Nonce + '</wsse:Nonce>';
  s += '<wsu:Created>' + ws.Created + '</wsu:Created>';
  s += '</wsse:UsernameToken>';
  s += '</wsse:Security>';
  s += '</s:Header>';
  return s;
}

// === Service selection & discovery ===
const BASE_URL = `http://${ip}${args.port ? ':' + args.port : ''}`;

function serviceDefaultPath(svc) {
  switch (svc) {
    case 'DEVICE': return `${BASE_URL}/onvif/device_service`;
    case 'MEDIA1':
    case 'MEDIA2':
    case 'MEDIA':  return `${BASE_URL}/onvif/media_service`;
    case 'PTZ':    return `${BASE_URL}/onvif/ptz_service`;
    case 'EVENTS': return `${BASE_URL}/onvif/event_service`;
    default:       return `${BASE_URL}/onvif/ptz_service`;
  }
}

function nsForService(svc, isV2 = false) {
  switch (svc) {
    case 'DEVICE': return 'http://www.onvif.org/ver10/device/wsdl';
    case 'MEDIA2': return 'http://www.onvif.org/ver20/media/wsdl';
    case 'MEDIA':
    case 'MEDIA1': return isV2 ? 'http://www.onvif.org/ver20/media/wsdl' : 'http://www.onvif.org/ver10/media/wsdl';
    case 'PTZ':    return 'http://www.onvif.org/ver20/ptz/wsdl';
    case 'EVENTS': return 'http://www.onvif.org/ver10/events/wsdl';
    default:       return 'http://www.onvif.org/ver20/ptz/wsdl';
  }
}

function pickUrlForService(svc) {
  if (svc === 'MEDIA2' && DISCOVERY.media2) return DISCOVERY.media2;
  if (svc === 'MEDIA1' && DISCOVERY.media1) return DISCOVERY.media1;
  if (svc === 'MEDIA')  return DISCOVERY.media2 || DISCOVERY.media1 || serviceDefaultPath('MEDIA');
  if (svc === 'PTZ' && DISCOVERY.ptz) return DISCOVERY.ptz;
  if (svc === 'EVENTS' && DISCOVERY.events) return DISCOVERY.events;
  if (svc === 'DEVICE') return serviceDefaultPath('DEVICE');
  return serviceDefaultPath(svc);
}

function parseUrl(u) {
  try { return new URL(u); } catch { return new URL(serviceDefaultPath('PTZ')); }
}

async function discoverServices() {
  // If already discovered, skip
  if (DISCOVERY.media1 || DISCOVERY.media2 || DISCOVERY.ptz || DISCOVERY.events) return DISCOVERY;

  // Prefer Device:GetCapabilities to also fetch Events XAddr
  const url = serviceDefaultPath('DEVICE');
  const envelope = `
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${wsseHeaderXml()}
  <s:Body>
    <tds:GetCapabilities>
      <tds:Category>All</tds:Category>
    </tds:GetCapabilities>
  </s:Body>
</s:Envelope>`.trim();

  const xml = await rawSoap(url, nsForService('DEVICE') + '/GetCapabilities', envelope);
  // Media & PTZ
  {
    const blocks = xml.match(/<tds:Capabilities>[\s\S]*?<\/tds:Capabilities>/g) || [];
    for (const b of blocks) {
      const mediaX = ((b.match(/<tt:Media>[\s\S]*?<tt:XAddr>(.*?)<\/tt:XAddr>/) || [])[1] || '').trim();
      const ptzX   = ((b.match(/<tt:PTZ>[\s\S]*?<tt:XAddr>(.*?)<\/tt:XAddr>/) || [])[1] || '').trim();
      const eventsX= ((b.match(/<tt:Events>[\s\S]*?<tt:XAddr>(.*?)<\/tt:XAddr>/) || [])[1] || '').trim();
      if (mediaX) DISCOVERY.media1 = mediaX;
      if (ptzX) DISCOVERY.ptz = ptzX;
      if (eventsX) DISCOVERY.events = eventsX;
    }
  }

  // Fallback: Device:GetServices (older code-path)
  if (!DISCOVERY.media1 || !DISCOVERY.ptz) {
    const env2 = `
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${wsseHeaderXml()}
  <s:Body>
    <tds:GetServices>
      <tds:IncludeCapability>true</tds:IncludeCapability>
    </tds:GetServices>
  </s:Body>
</s:Envelope>`.trim();
    const xml2 = await rawSoap(url, nsForService('DEVICE') + '/GetServices', env2);
    const blocks = xml2.match(/<tds:Service>[\s\S]*?<\/tds:Service>/g) || [];
    for (const b of blocks) {
      const ns = ((b.match(/<tds:Namespace>(.*?)<\/tds:Namespace>/) || [])[1] || '').trim();
      const xa = ((b.match(/<tds:XAddr>(.*?)<\/tds:XAddr>/) || [])[1] || '').trim();
      if (!ns || !xa) continue;
      if (ns.includes('/ver20/media/wsdl')) DISCOVERY.media2 = xa;
      if (ns.includes('/ver10/media/wsdl')) DISCOVERY.media1 = xa;
      if (ns.includes('/ver20/ptz/wsdl'))   DISCOVERY.ptz    = xa;
      if (ns.includes('/ver10/events/wsdl')) DISCOVERY.events = xa;
    }
  }

  if (args.verbose) console.error('[DISCOVERY]', DISCOVERY);
  return DISCOVERY;
}

// low-level SOAP POST (returns raw XML) with action header
function rawSoap(urlStr, actionHeader, envelope) {
  return new Promise((resolve, reject) => {
    const u = parseUrl(urlStr);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      method: 'POST',
      path: u.pathname + (u.search || ''),
      timeout: SOCKET_TIMEOUT_MS,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${actionHeader}"`,
        'Content-Length': Buffer.byteLength(envelope)
      },
      rejectUnauthorized: false
    };

    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout calling ${u.href}`)); });
    req.on('error', err => reject(err));

    req.write(envelope);
    req.end();
  });
}

// For some ONVIF endpoints (SubscriptionManager), the action header is not required.
// Provide a simpler POST that omits it, for maximum compatibility.
function httpPostXml(targetUrl, xml, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xml, 'utf8')
      },
      timeout: opts.timeoutMs || 15000,
      rejectUnauthorized: false
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

// === SOAP send wrapper (keeps original style) ===
// svc: 'PTZ' (default) | 'DEVICE' | 'MEDIA' | 'MEDIA1' | 'MEDIA2' | 'EVENTS'
function sendSoap(action, body, cb, svc = 'PTZ') {
  const wsse = wsseHeaderXml();
  let actionNs = nsForService(svc, svc === 'MEDIA' || svc === 'MEDIA2');
  const doSend = async () => {
    await discoverServices(); // ensure endpoints

    let serviceVariant = svc;
    if (svc === 'MEDIA') {
      serviceVariant = (DISCOVERY.media2 ? 'MEDIA2' : 'MEDIA1');
    }
    const url = pickUrlForService(serviceVariant);
    actionNs = nsForService(serviceVariant, serviceVariant === 'MEDIA2');
    const envelope = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  ${wsse}
  <s:Body>${body}</s:Body>
</s:Envelope>`;

    if (args.verbose || args.debug) {
      console.error(`\n[ENDPOINT] ${svc} → ${url}`);
      console.error(`REQUEST for ${action}:\n${body}\n`);
    }

    rawSoap(url, `${actionNs}/${action}`, envelope)
      .then(xml => {
        if (args.verbose || args.debug) {
          console.error(`RESPONSE for ${action}:\n${xml}\n`);
          if (args.log) logMessage(`SOAP response for ${action}: ${xml}`);
        } else {
          xml2js.parseString(xml, { explicitArray:false, tagNameProcessors:[xml2js.processors.stripPrefix], attrNameProcessors:[xml2js.processors.stripPrefix] }, (err, result) => {
            if (err) {
              console.error('[ERROR] Failed to parse XML:', err.message);
            } else {
              try {
                const body = (result.Envelope && result.Envelope.Body) || result.Body || result;
                const actionKey = Object.keys(body)[0];
                const payload = body[actionKey];
                console.log('[RESPONSE]', actionKey);
                for (const k in payload) {
                  const val = payload[k];
                  console.log(`  ${k}:`, typeof val === 'string' ? val : JSON.stringify(val));
                }
              } catch (e) {
                console.error('[ERROR] Response structure unexpected:', e.message);
              }
            }
          });
        }

        // Auto-retry flow for missing preset tokens
        if (/NoToken|preset token does not exist/i.test(xml)) {
          if (String(action).toLowerCase().includes('gotopreset')) {
            console.log('[AUTO] Preset token not found → requesting GetPresets list…');
            const bodyPresets = `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>${PROFILE_TOKEN}</ProfileToken></tptz:GetPresets>`;
            return rawSoap(pickUrlForService('PTZ'), `${nsForService('PTZ')}/GetPresets`, `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">${wsse}<s:Body>${bodyPresets}</s:Body></s:Envelope>`)
              .then(async () => { await sleep(WAKEUP_SLEEP_MS); console.log('[AUTO] Retrying original goto command…'); return sendSoap(action, body, cb, 'PTZ'); });
          }
        }

        cb && cb();
      })
      .catch(err => {
        errorOut(`HTTP/SOAP error on ${action}: ${err.message}`);
      });
  };

  // Wakeup chain (PTZ only)
  if (svc === 'PTZ') {
    const wakeupTasks = [];
    if (WAKEUP) wakeupTasks.push(cb => wakeupSequence(cb));
    if (WAKEUP_SIMPLE) wakeupTasks.push(cb => wakeupSimple(cb));

    let idx = 0;
    const next = () => (idx < wakeupTasks.length ? wakeupTasks[idx++](next) : doSend());
    next();
  } else {
    doSend();
  }
}

async function wakeupSimple(cb) {
  if (args.verbose) console.log('[WAKEUP_SIMPLE] Sending GetPresets...');
  const body = `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>${PROFILE_TOKEN}</ProfileToken></tptz:GetPresets>`;
  sendSoap('GetPresets', body, async () => {
    await sleep(WAKEUP_SLEEP_MS);
    cb && cb();
  }, 'PTZ');
}

function wakeupSequence(cb) {
  if (args.verbose) console.log('[WAKEUP] Sending Wake-up Sequence (GetNodes, GetConfigurations, GetPresets)…');
  const steps = [
    () => sendSoap('GetNodes', '<tptz:GetNodes xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>', async () => {
      await sleep(WAKEUP_SLEEP_MS);
      steps[1]();
    }, 'PTZ'),
    () => sendSoap('GetConfigurations', '<tptz:GetConfigurations xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>', async () => {
      await sleep(WAKEUP_SLEEP_MS);
      steps[2]();
    }, 'PTZ'),
    () => sendSoap('GetPresets', `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>${PROFILE_TOKEN}</ProfileToken></tptz:GetPresets>`, async () => {
      await sleep(WAKEUP_SLEEP_MS);
      cb && cb();
    }, 'PTZ')
  ];
  steps[0]();
}

// === Utility for events parsing ===
function matchTag(xml, regex) {
  const m = regex.exec(xml);
  return m && m[1] ? m[1] : null;
}
function isoToMs(iso8601) {
  if (!iso8601 || typeof iso8601 !== 'string') return 60000;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso8601);
  if (!m) return 60000;
  const days = parseInt(m[1] || '0', 10);
  const hrs = parseInt(m[2] || '0', 10);
  const mins = parseInt(m[3] || '0', 10);
  const secs = parseInt(m[4] || '0', 10);
  return (((days*24 + hrs)*60 + mins)*60 + secs) * 1000;
}
function dateDiffMs(aIso, bIso) {
  try {
    const a = new Date(aIso).getTime();
    const b = new Date(bIso).getTime();
    if (isNaN(a) || isNaN(b)) return null;
    return b - a;
  } catch { return null; }
}

// === ACTIONS ===
const ACTIONS = {
  // -------------------- Events block --------------------
  async subscribe_events() {
    if (!ip) errorOut('--ip is required');
    await discoverServices();
    const eventsUrl = pickUrlForService('EVENTS');

    const deviceUrl = pickUrlForService('DEVICE');
    const postWithFallback = async (xml) => {
      try {
        const resp = await httpPostXml(eventsUrl, xml);
        if (resp && resp.statusCode && (resp.statusCode === 404 || resp.statusCode === 405)) {
          throw new Error('HTTP ' + resp.statusCode);
        }
        return resp;
      } catch (err) {
        if (args.verbose) console.error('[WARN] EVENTS endpoint failed, trying DEVICE…', err && err.message ? err.message : String(err));
        const resp2 = await httpPostXml(deviceUrl, xml);
        return resp2;
      }
    };

    if (args.verbose) console.error('[ENDPOINT] EVENTS →', eventsUrl);

    // Build envelopes
    const wsse = wsseHeaderXml();

    const envelopePush = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsa="http://www.w3.org/2005/08/addressing"
            xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  ${wsse}
  <s:Body>
    <wsnt:Subscribe>
      <wsnt:ConsumerReference><wsa:Address>${(pushUrl || '').replace(/&/g,'&amp;')}</wsa:Address></wsnt:ConsumerReference>
      <wsnt:Delivery Mode="http://docs.oasis-open.org/wsn/b-2/HTTP"><wsa:ReferenceParameters/></wsnt:Delivery>
      <wsnt:InitialTerminationTime>${termination}</wsnt:InitialTerminationTime>
    </wsnt:Subscribe>
  </s:Body>
</s:Envelope>`;

    const envelopePullCreate = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tev="http://www.onvif.org/ver10/events/wsdl">
  ${wsse}
  <s:Body>
    <tev:CreatePullPointSubscription>
      <tev:InitialTerminationTime>${termination}</tev:InitialTerminationTime>
    </tev:CreatePullPointSubscription>
  </s:Body>
</s:Envelope>`;

    const envelopePullWsnt = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsa="http://www.w3.org/2005/08/addressing"
            xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  ${wsse}
  <s:Body>
    <wsnt:Subscribe>
      <wsnt:Delivery Mode="http://docs.oasis-open.org/wsn/b-2/Pull"/>
      <wsnt:InitialTerminationTime>${termination}</wsnt:InitialTerminationTime>
    </wsnt:Subscribe>
  </s:Body>
</s:Envelope>`;

    try {
      let subObj = null;
      if (mode === 'push') {
        if (!pushUrl) errorOut('--push_url is required for push mode');
        if (args.debug) console.error('REQUEST Subscribe (push):\n', envelopePush);
        const resp = await postWithFallback(envelopePush);
        if (args.debug) console.error('RESPONSE Subscribe (push):\n', resp.body);
        const address = matchTag(resp.body, /<(?:\w+:)?SubscriptionReference>\s*<(?:\w+:)?Address>([^<]+)<\/(?:\w+:)?Address>/i);
        const current = matchTag(resp.body, /<(?:\w+:)?CurrentTime>([^<]+)<\/(?:\w+:)?CurrentTime>/i);
        const term    = matchTag(resp.body, /<(?:\w+:)?TerminationTime>([^<]+)<\/(?:\w+:)?TerminationTime>/i);
        if (!address) errorOut('No SubscriptionReference.Address in Subscribe (push) response');
        subObj = { subscription: address, currentTime: current, terminationTime: term };
        if (args.verbose) console.log('[INFO] Push subscription created');
      } else {
        // Pull point first
        if (args.debug) console.error('REQUEST CreatePullPointSubscription:\n', envelopePullCreate);
        const resp1 = await postWithFallback(envelopePullCreate);
        if (args.debug) console.error('RESPONSE CreatePullPointSubscription:\n', resp1.body);
        if (!/SubscriptionReference/i.test(resp1.body)) {
          if (args.debug) console.error('CreatePullPointSubscription not supported, trying WS-Notification Subscribe (Pull)…');
          const resp2 = await postWithFallback(envelopePullWsnt);
          if (args.debug) console.error('RESPONSE Subscribe (pull):\n', resp2.body);
          const address = matchTag(resp2.body, /<(?:\w+:)?SubscriptionReference>\s*<(?:\w+:)?Address>([^<]+)<\/(?:\w+:)?Address>/i);
          const current = matchTag(resp2.body, /<(?:\w+:)?CurrentTime>([^<]+)<\/(?:\w+:)?CurrentTime>/i);
          const term    = matchTag(resp2.body, /<(?:\w+:)?TerminationTime>([^<]+)<\/(?:\w+:)?TerminationTime>/i);
          if (!address) errorOut('No SubscriptionReference.Address in Subscribe (pull) response');
          subObj = { subscription: address, currentTime: current, terminationTime: term };
        } else {
          const address = matchTag(resp1.body, /<(?:\w+:)?SubscriptionReference>\s*<(?:\w+:)?Address>([^<]+)<\/(?:\w+:)?Address>/i);
          const current = matchTag(resp1.body, /<(?:\w+:)?CurrentTime>([^<]+)<\/(?:\w+:)?CurrentTime>/i);
          const term    = matchTag(resp1.body, /<(?:\w+:)?TerminationTime>([^<]+)<\/(?:\w+:)?TerminationTime>/i);
          if (!address) errorOut('No SubscriptionReference.Address in CreatePullPointSubscription response');
          subObj = { subscription: address, currentTime: current, terminationTime: term };
        }
        if (args.verbose) console.log('[INFO] Pull subscription created');
      }

      console.log(JSON.stringify({
        subscription: subObj.subscription,
        currentTime: subObj.currentTime || null,
        terminationTime: subObj.terminationTime || null
      }, null, 2));

      if (autoRenew) {
        let ttlMs = subObj.currentTime && subObj.terminationTime
          ? dateDiffMs(subObj.currentTime, subObj.terminationTime)
          : isoToMs(termination);
        if (!ttlMs || ttlMs <= 0) ttlMs = isoToMs(termination);
        let renewMs = Math.max(5000, Math.floor(ttlMs * 0.7));
        if (args.verbose) console.log(`[INFO] auto_renew active; first renew in ~${Math.round(renewMs/1000)}s`);
        const subUrl = subObj.subscription;

        async function doRenewLoop() {
          try {
            const r = await ACTIONS._renew_internal(subUrl);
            const newTtlMs = r.currentTime && r.terminationTime ? dateDiffMs(r.currentTime, r.terminationTime) : null;
            if (newTtlMs && newTtlMs > 0) {
              renewMs = Math.max(5000, Math.floor(newTtlMs * 0.7));
              if (args.verbose) console.log(`[INFO] renew ok; next in ~${Math.round(renewMs/1000)}s`);
            } else if (args.verbose) {
              console.log('[WARN] renew ok; TTL not provided, keeping previous interval');
            }
          } catch (e) {
            console.error('[ERROR] renew failed:', e.message);
            renewMs = Math.max(10000, Math.floor(renewMs / 2));
          } finally {
            timer = setTimeout(doRenewLoop, renewMs);
          }
        }
        let timer = setTimeout(doRenewLoop, renewMs);
        const cleanup = async () => {
          clearTimeout(timer);
          if (args.auto_unsubscribe_on_exit && subObj.subscription) {
            try { await ACTIONS._unsubscribe_internal(subUrl); } catch {}
          }
          process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        await new Promise(() => {}); // keep process alive
      }
    } catch (e) {
      errorOut(e.message);
    }
  },

  async renew_subscription() {
    if (!subscriptionUrlArg) errorOut('Missing --subscription');
    try {
      const r = await ACTIONS._renew_internal(subscriptionUrlArg);
      if (args.verbose) console.log('[INFO] renew ok');
      console.log(JSON.stringify({
        currentTime: r.currentTime || null,
        terminationTime: r.terminationTime || null
      }, null, 2));
    } catch (e) {
      errorOut(e.message);
    }
  },

  async unsubscribe() {
    if (!subscriptionUrlArg) errorOut('Missing --subscription');
    try {
      await ACTIONS._unsubscribe_internal(subscriptionUrlArg);
      if (args.verbose) console.log('[INFO] unsubscribe ok');
    } catch (e) {
      errorOut(e.message);
    }
  },

  // Internal helpers for renew/unsubscribe using minimal headers (no action attr)
  async _renew_internal(subscriptionUrl) {
    const env = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  ${wsseHeaderXml()}
  <s:Body>
    <wsnt:Renew><wsnt:TerminationTime>${termination}</wsnt:TerminationTime></wsnt:Renew>
  </s:Body>
</s:Envelope>`;
    if (args.debug) console.error('REQUEST Renew @', subscriptionUrl, ':\n', env);
    const resp = await httpPostXml(subscriptionUrl, env);
    if (args.debug) console.error('RESPONSE Renew:\n', resp.body);
    const current = matchTag(resp.body, /<(?:\w+:)?CurrentTime>([^<]+)<\/(?:\w+:)?CurrentTime>/i);
    const term    = matchTag(resp.body, /<(?:\w+:)?TerminationTime>([^<]+)<\/(?:\w+:)?TerminationTime>/i);
    return { currentTime: current || null, terminationTime: term || null };
  },

  async _unsubscribe_internal(subscriptionUrl) {
    const env = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  ${wsseHeaderXml()}
  <s:Body><wsnt:Unsubscribe/></s:Body>
</s:Envelope>`;
    if (args.debug) console.error('REQUEST Unsubscribe @', subscriptionUrl, ':\n', env);
    const resp = await httpPostXml(subscriptionUrl, env);
    if (args.debug) console.error('RESPONSE Unsubscribe:\n', resp.body);
    return true;
  },

  // -------------------- Original feature set (v1.1.8) --------------------

  move() {
    if (!('pan' in args) || !('tilt' in args)) errorOut('--pan and --tilt are required for move');
    const body = `<tptz:ContinuousMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <Velocity>
        <PanTilt x="${args.pan}" y="${args.tilt}" xmlns="http://www.onvif.org/ver10/schema"/>
      </Velocity>
    </tptz:ContinuousMove>`;
    sendSoap('ContinuousMove', body, () => {
      setTimeout(() => ACTIONS.stop(true, false), duration);
    }, 'PTZ');
  },

  zoom() {
    if (!('zoom' in args)) errorOut('--zoom is required for zoom');
    const body = `<tptz:ContinuousMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <Velocity>
        <Zoom x="${args.zoom}" xmlns="http://www.onvif.org/ver10/schema"/>
      </Velocity>
    </tptz:ContinuousMove>`;
    sendSoap('ContinuousMove', body, () => {
      setTimeout(() => ACTIONS.stop(false, true), duration);
    }, 'PTZ');
  },

  stop(pan = true, zoom = true) {
    const body = `<tptz:Stop xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PanTilt>${pan}</PanTilt><Zoom>${zoom}</Zoom>
    </tptz:Stop>`;
    sendSoap('Stop', body, null, 'PTZ');
  },

  goto() {
    if (!args.preset) errorOut('--preset is required for goto');
    const body = `<tptz:GotoPreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetToken>${args.preset}</PresetToken>
    </tptz:GotoPreset>`;
    sendSoap('GotoPreset', body, null, 'PTZ');
  },

  setpreset() {
    if (!args.presetname) errorOut('--presetname is required for setpreset');
    const body = `<tptz:SetPreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetName>${args.presetname}</PresetName>
    </tptz:SetPreset>`;
    sendSoap('SetPreset', body, null, 'PTZ');
  },

  removepreset() {
    if (!args.preset) errorOut('--preset is required for removepreset');
    const body = `<tptz:RemovePreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetToken>${args.preset}</PresetToken>
    </tptz:RemovePreset>`;
    sendSoap('RemovePreset', body, null, 'PTZ');
  },

  get_presets() {
    const body = `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
    </tptz:GetPresets>`;
    sendSoap('GetPresets', body, null, 'PTZ');
  },

  status() {
    const body = `<tptz:GetStatus xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
    </tptz:GetStatus>`;
    sendSoap('GetStatus', body, null, 'PTZ');
  },

  absolutemove() {
    if (!('pan' in args) || !('tilt' in args)) errorOut('--pan and --tilt required');
    const body = `<tptz:AbsoluteMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <Position>
        <PanTilt x="${args.pan}" y="${args.tilt}" xmlns="http://www.onvif.org/ver10/schema"/>
        ${'zoom' in args ? `<Zoom x="${args.zoom}" xmlns="http://www.onvif.org/ver10/schema"/>` : ''}
      </Position>
    </tptz:AbsoluteMove>`;
    sendSoap('AbsoluteMove', body, null, 'PTZ');
  },

  relativemove() {
    if (!('pan' in args) || !('tilt' in args)) errorOut('--pan and --tilt required');
    const body = `<tptz:RelativeMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <Translation>
        <PanTilt x="${args.pan}" y="${args.tilt}" xmlns="http://www.onvif.org/ver10/schema"/>
        ${'zoom' in args ? `<Zoom x="${args.zoom}" xmlns="http://www.onvif.org/ver10/schema"/>` : ''}
      </Translation>
    </tptz:RelativeMove>`;
    sendSoap('RelativeMove', body, null, 'PTZ');
  },

  configoptions() {
    const body = `<tptz:GetConfigurationOptions xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ConfigurationToken>${PROFILE_TOKEN}</ConfigurationToken>
    </tptz:GetConfigurationOptions>`;
    sendSoap('GetConfigurationOptions', body, null, 'PTZ');
  },

  reboot() {
    const body = `<tds:SystemReboot xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SystemReboot', body, null, 'DEVICE');
  },

  factoryreset() {
    const body = `<tds:FactoryReset xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('FactoryReset', body, null, 'DEVICE');
  },

  setdatetime() {
    const now = new Date();
    const offsetMinutes = new Date().getTimezoneOffset();
    const sign = offsetMinutes > 0 ? '-' : '+';
    const absMin = Math.abs(offsetMinutes);
    const tzHours = String(Math.floor(absMin / 60)).padStart(2, '0');
    const tzMins  = String(absMin % 60).padStart(2, '0');
    const timezone = `GMT${sign}${tzHours}:${tzMins}`;

    const body = `<tds:SetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:DateTimeType>Manual</tds:DateTimeType>
      <tds:DaylightSavings>false</tds:DaylightSavings>
      <tds:TimeZone>
        <tt:TZ>${timezone}</tt:TZ>
      </tds:TimeZone>
      <tds:UTCDateTime>
        <tt:Time>
          <tt:Hour>${now.getUTCHours()}</tt:Hour>
          <tt:Minute>${now.getUTCMinutes()}</tt:Minute>
          <tt:Second>${now.getUTCSeconds()}</tt:Second>
        </tt:Time>
        <tt:Date>
          <tt:Year>${now.getUTCFullYear()}</tt:Year>
          <tt:Month>${now.getUTCMonth() + 1}</tt:Month>
          <tt:Day>${now.getUTCDate()}</tt:Day>
        </tt:Date>
      </tds:UTCDateTime>
    </tds:SetSystemDateAndTime>`;

    sendSoap('SetSystemDateAndTime', body, null, 'DEVICE');
  },

  get_snapshot_uri() {
    const body = `<trt:GetSnapshotUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:ProfileToken>${PROFILE_TOKEN}</trt:ProfileToken>
    </trt:GetSnapshotUri>`;
    sendSoap('GetSnapshotUri', body, null, 'MEDIA'); // will choose media2 if available
  },

  get_stream_uri() {
    const body = `<trt:GetStreamUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:StreamSetup>
        <tt:Stream xmlns:tt="http://www.onvif.org/ver10/schema">RTP-Unicast</tt:Stream>
        <tt:Transport xmlns:tt="http://www.onvif.org/ver10/schema">
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>${PROFILE_TOKEN}</trt:ProfileToken>
    </trt:GetStreamUri>`;
    sendSoap('GetStreamUri', body, null, 'MEDIA');
  },

  get_profiles() {
    // Use Media2 if present, else Media1
    // Media v2
    const bodyV2 = `<tr2:GetProfiles xmlns:tr2="http://www.onvif.org/ver20/media/wsdl"/>`;
    // Media v1
    const bodyV1 = `<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>`;

    discoverServices()
      .then(() => {
        if (DISCOVERY.media2) {
          sendSoap('GetProfiles', bodyV2, null, 'MEDIA2');
        } else {
          sendSoap('GetProfiles', bodyV1, null, 'MEDIA1');
        }
      })
      .catch(err => errorOut(`Discovery failed: ${err.message}`));
  },

  get_video_encoder_configuration() {
    const body = `<trt:GetVideoEncoderConfiguration xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:ConfigurationToken>${PROFILE_TOKEN}</trt:ConfigurationToken>
    </trt:GetVideoEncoderConfiguration>`;
    sendSoap('GetVideoEncoderConfiguration', body, null, 'MEDIA');
  },

  set_video_encoder_configuration() {
    if (!resolution || !bitrate || !codec) errorOut('Missing --resolution, --bitrate, or --codec');
    const [w, h] = String(resolution).split('x');
    const body = `<trt:SetVideoEncoderConfiguration xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:Configuration>
        <tt:Encoding xmlns:tt="http://www.onvif.org/ver10/schema">${codec}</tt:Encoding>
        <tt:Resolution>
          <tt:Width>${w}</tt:Width>
          <tt:Height>${h}</tt:Height>
        </tt:Resolution>
        <tt:RateControl>
          <tt:BitrateLimit>${bitrate}</tt:BitrateLimit>
        </tt:RateControl>
      </trt:Configuration>
      <trt:ForcePersistence>true</trt:ForcePersistence>
    </trt:SetVideoEncoderConfiguration>`;
    sendSoap('SetVideoEncoderConfiguration', body, null, 'MEDIA');
  },

  get_system_date_and_time() {
    const body = `<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetSystemDateAndTime', body, null, 'DEVICE');
  },

  get_system_info() {
    const body = `<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetDeviceInformation', body, null, 'DEVICE');
  },

  get_device_information() {
    // Alias to standard Device:GetDeviceInformation
    return this.get_system_info();
  },

  get_capabilities() {
    const body = `<tds:GetCapabilities xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetCapabilities', body, null, 'DEVICE');
  },

  get_network_interfaces() {
    const body = `<tds:GetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetNetworkInterfaces', body, null, 'DEVICE');
  },

  set_network_interfaces() {
    const dhcpFlag = dhcp === '1' ? 'true' : 'false';
    if (!ip || !netmask) errorOut('Missing --ip or --netmask');
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:InterfaceToken>eth0</tds:InterfaceToken>
      <tds:NetworkInterface>
        <tt:Enabled>true</tt:Enabled>
        <tt:IPv4>
          <tt:Enabled>true</tt:Enabled>
          <tt:Manual>
            <tt:Address>${ip}</tt:Address>
            <tt:PrefixLength>${netmaskToPrefix(netmask)}</tt:PrefixLength>
            
          </tt:Manual>
          <tt:DHCP>${dhcpFlag}</tt:DHCP>
        </tt:IPv4>
      </tds:NetworkInterface>
    </tds:SetNetworkInterfaces>`;
    sendSoap('SetNetworkInterfaces', body, null, 'DEVICE');
  },

  get_users() {
    const body = `<tds:GetUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetUsers', body, null, 'DEVICE');
  },

  add_user() {
    if (!newUser || !newPass || !newLevel) errorOut('Missing --new_username, --new_password, or --new_userlevel');
    const body = `<tds:CreateUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:User>
        <tt:Username xmlns:tt="http://www.onvif.org/ver10/schema">${newUser}</tt:Username>
        <tt:Password xmlns:tt="http://www.onvif.org/ver10/schema">${newPass}</tt:Password>
        <tt:UserLevel xmlns:tt="http://www.onvif.org/ver10/schema">${newLevel}</tt:UserLevel>
      </tds:User>
    </tds:CreateUsers>`;
    sendSoap('CreateUsers', body, null, 'DEVICE');
  },

  delete_user() {
    if (!delUser) errorOut('Missing --del_username');
    const body = `<tds:DeleteUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Username>${delUser}</tds:Username>
    </tds:DeleteUsers>`;
    sendSoap('DeleteUsers', body, null, 'DEVICE');
  },

  sethostname() {
    if (!hostname) errorOut('Missing --hostname');
    const body = `<tds:SetHostname xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Name>${hostname}</tds:Name>
    </tds:SetHostname>`;
    sendSoap('SetHostname', body, null, 'DEVICE');
  },

  set_dns() {
    if (!dns1 && !dns2) errorOut('Missing --dns1 or --dns2');
    const dnsBlocks = [dns1, dns2].filter(Boolean).map(d => `<tds:DNSManual><tt:Type>IPv4</tt:Type><tt:IPv4Address>${d}</tt:IPv4Address></tds:DNSManual>`).join('');
    const body = `<tds:SetDNS xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:FromDHCP>false</tds:FromDHCP>
      ${dnsBlocks}
    </tds:SetDNS>`;
    sendSoap('SetDNS', body, null, 'DEVICE');
  },

  get_dns() {
    const body = `<tds:GetDNS xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetDNS', body, null, 'DEVICE');
  },

  set_ntp() {
    if (!ntp) errorOut('Missing --ntp_server');
    const body = `<tds:SetNTP xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:FromDHCP>false</tds:FromDHCP>
      <tds:NTPManual>
        <tt:Type>IPv4</tt:Type>
        <tt:IPv4Address>${ntp}</tt:IPv4Address>
      </tds:NTPManual>
    </tds:SetNTP>`;
    sendSoap('SetNTP', body, null, 'DEVICE');
  },

  reset_password() {
    if (!username_reset || !newpass_reset) errorOut('Missing --username or --new_password');
    const body = `<tds:SetUser xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:User>
        <tt:Username>${username_reset}</tt:Username>
        <tt:Password>${newpass_reset}</tt:Password>
      </tds:User>
    </tds:SetUser>`;
    sendSoap('SetUser', body, null, 'DEVICE');
  },

  get_event_properties() {
    // Use Events endpoint (tev) for standards-compliant call
    const body = `<tev:GetEventProperties xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>`;
    sendSoap('GetEventProperties', body, null, 'EVENTS');
  },

  subscribe_events_device() {
    const body = `<tev:Subscribe xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>`;
    sendSoap('Subscribe', body, null, 'DEVICE');
  },

  get_motion_detection() {
    // Many cams expose motion via device or analytics extensions; keep as-is
    const body = `<tmd:GetMotionDetection xmlns:tmd="http://www.onvif.org/ver10/schema"/>`;
    sendSoap('GetMotionDetection', body, null, 'DEVICE');
  },

  set_motion_detection() {
    if (!enable_motion) errorOut('Missing --enable');
    const body = `<tmd:SetMotionDetection xmlns:tmd="http://www.onvif.org/ver10/schema">
      <tmd:Enabled>${enable_motion}</tmd:Enabled>
    </tmd:SetMotionDetection>`;
    sendSoap('SetMotionDetection', body, null, 'DEVICE');
  },

  configurations() {
    // Alias for GetConfigurations (PTZ)
    const body = `<tptz:GetConfigurations xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>`;
    sendSoap('GetConfigurations', body, null, 'PTZ');
  },

  get_configurations() {
    this.configurations();
  },

  get_nodes() {
    const body = `<tptz:GetNodes xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>`;
    sendSoap('GetNodes', body, null, 'PTZ');
  },
  presets() {
    // Alias to 'get_presets'
    this.get_presets();
  },

  preset() {
    // Alias to 'goto'
    this.goto();
  },

  get_static_ip() {
    // No dedicated ONVIF call; reuse GetNetworkInterfaces
    this.get_network_interfaces();
  },


  gethostname() {
    const body = `<tds:GetHostname xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetHostname', body, null, 'DEVICE');
  },

  get_system_logs() {
    // ONVIF GetSystemLog takes a type (System or Access) in some implementations; default to System
    const type = (logtype && String(logtype).toLowerCase() === 'access') ? 'Access' : 'System';
    const body = `<tds:GetSystemLog xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:LogType>${type}</tds:LogType>
    </tds:GetSystemLog>`;
    sendSoap('GetSystemLog', body, null, 'DEVICE');
  },

  set_static_ip() {
    // Compatibility shim: call set_network_interfaces with DHCP=false
    const dhcpFlag = 'false';
    if (!ip || !netmask) errorOut('Missing --ip or --netmask');
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:InterfaceToken>eth0</tds:InterfaceToken>
      <tds:NetworkInterface>
        <tt:Enabled>true</tt:Enabled>
        <tt:IPv4>
          <tt:Enabled>true</tt:Enabled>
          <tt:Manual>
            <tt:Address>${ip}</tt:Address>
            <tt:PrefixLength>${netmaskToPrefix(netmask)}</tt:PrefixLength>
            
          </tt:Manual>
          <tt:DHCP>${dhcpFlag}</tt:DHCP>
        </tt:IPv4>
      </tds:NetworkInterface>
    </tds:SetNetworkInterfaces>`;
    sendSoap('SetNetworkInterfaces', body, null, 'DEVICE');
  },

  enable_dhcp() {
    // Compatibility shim: enable DHCP on IPv4 (no static manual block)
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
      <tds:InterfaceToken>eth0</tds:InterfaceToken>
      <tds:NetworkInterface>
        <tt:Enabled>true</tt:Enabled>
        <tt:IPv4>
          <tt:Enabled>true</tt:Enabled>
          <tt:DHCP>true</tt:DHCP>
        </tt:IPv4>
      </tds:NetworkInterface>
    </tds:SetNetworkInterfaces>`;
    sendSoap('SetNetworkInterfaces', body, null, 'DEVICE');
  },
  // NEW: Device:GetServices to print XAddrs (Media/PTZ)
  get_services() {
    discoverServices()
      .then(() => {
        console.log(JSON.stringify(DISCOVERY, null, 2));
      })
      .catch(err => errorOut(`Discovery failed: ${err.message}`));
  }
};

function netmaskToPrefix(mask) {
  // naive conversion (IPv4 dotted decimal to prefix length)
  const parts = String(mask).split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return 24;
  const bits = parts.map(n => n.toString(2).padStart(8, '0')).join('');
  return bits.split('1').length - 1; // count ones
}

const act = String(args.action || '').toLowerCase();
if (!ACTIONS[act]) errorOut(`Unsupported action: ${act}`);
ACTIONS[act]();
