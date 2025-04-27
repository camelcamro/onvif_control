// onvif_ptz-control.js
// ONVIF PTZ Control Script - Full SOAP Implementation

const crypto = require('crypto');
const http = require('http');
const { execSync } = require('child_process');
const args = require('minimist')(process.argv.slice(2), {
  alias: {
    v: 'verbose', d: 'debug', l: 'log', m: 'mute', h: 'help', t: 'time',
    z: 'zoom', p: 'pan', u: 'user', i: 'ip', k: 'token', e: 'preset',
    n: 'presetname', r: 'dry-run'
  }
});

const VERSION = '1.0.13';
const BUILD_DATE = '2025-04-27';
const PROFILE_TOKEN = args.token || 'MainStreamProfileToken';
const NO_WAKEUP = parseInt(args.no_wakeup) === 1;

// Timeout in milliseconds for SOAP requests
const SOCKET_TIMEOUT_MS = 5000;

function showHelp() {
  console.log(`
ONVIF PTZ Control Script - Version ${VERSION} (${BUILD_DATE})

Usage:
  node ptz-control.js --action=<action> --ip=IP --port=PORT --user=USER --pass=PASS [options]

Mandatory Parameters:
  --ip, -i         Camera IP
  --port           Camera ONVIF port (e.g. 8080)
  --user, -u       Username
  --pass           Password
  --action         One of: move, zoom, stop, goto, setpreset, removepreset, presets, status, absolutemove, relativemove, configoptions

Optional:
  --token, -k      ProfileToken (default: MainStreamProfileToken)
  --pan, -p        Pan value
  --tilt, -i       Tilt value
  --zoom, -z       Zoom value
  --preset, -e     Preset token (for goto/remove)
  --presetname, -n Preset name (for setpreset)
  --time, -t       Duration (in seconds) for move/zoom
  --debug, -d      Output args in JSON
  --verbose, -v    Show verbose info
  --log, -l        Log to system log
  --dry-run, -r    Simulate request
  --mute, -m       Only return error code
  --help, -h       Show help
  --version        Show version
  --no_wakeup      Disable wakeup before each action
`);
  process.exit(0);
}

if (args.help) showHelp();
if (args.version) {
  console.log(`ONVIF PTZ Control Script\nVersion: ${VERSION}\nBuild Date: ${BUILD_DATE}`);
  process.exit(0);
}

function errorOut(msg, code = 1) {
  if (!args.mute) console.error(`ERROR: ${msg}\nUse --help to view usage.`);
  process.exit(code);
}

['ip', 'port', 'user', 'pass', 'action'].forEach(param => {
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
  if (args.log) execSync(`logger -t onvif "${msg}"`);
}

logMessage(`Called script onvif_ptz-control.js with ${process.argv.slice(2).join(' ')}`);
if (args.verbose) console.log(`[INFO] Called with:`, mask(args));
if (args.debug) console.log(JSON.stringify(mask(args), null, 2));
if (args['dry-run']) process.exit(0);

// === Helper: Build WS-Security Header ===
function buildWSSecurity(username, password) {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const digest = crypto.createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(password)]))
    .digest('base64');
  return {
    Username: username,
    PasswordDigest: digest,
    Nonce: nonce.toString('base64'),
    Created: created
  };
}

function wakeupDevice(cb) {
  if (args.verbose) console.log('[WAKEUP] Sending GetDeviceInformation...');
  const body = `<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
  realSendSoap('GetDeviceInformation', body, cb);
}

function sendSoap(action, body, cb) {
  if (!NO_WAKEUP && action !== 'GetDeviceInformation') {
    wakeupDevice(() => realSendSoap(action, body, cb));
  } else {
    realSendSoap(action, body, cb);
  }
}

function realSendSoap(action, body, cb) {
  const ws = buildWSSecurity(args.user, args.pass);
  const soapEnvelope = `
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Header>
    <Security s:mustUnderstand="1"
      xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>${args.user}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${ws.PasswordDigest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${ws.Nonce}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${ws.Created}</Created>
      </UsernameToken>
    </Security>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`.trim();

  const req = http.request({
    host: args.ip,
    port: args.port,
    method: 'POST',
    path: '/onvif/ptz_service',
    timeout: SOCKET_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver20/ptz/wsdl/' + action + '"',
      'Content-Length': Buffer.byteLength(soapEnvelope)
    }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (args.verbose) console.log(`\nRESPONSE for ${action}:\n`, data);
      if (args.log) logMessage(`SOAP response for ${action}: ${data}`);
      cb && cb();
    });
  });

  req.on('timeout', () => {
    req.destroy();
    errorOut(`Timeout on ${action}`);
  });

  req.on('error', err => {
    errorOut(`HTTP error on ${action}: ${err.message}`);
  });

  if (args.log) logMessage(`SOAP request for ${action}: ${body.replace(/[\n\r]+/g, '')}`);
  req.write(soapEnvelope);
  req.end();
}

// === ACTIONS ===
const PTZ = {
  move() {
    if (!('pan' in args) || !('tilt' in args)) errorOut('--pan and --tilt are required for move');
    const body = `<tptz:ContinuousMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <Velocity>
        <PanTilt x="${args.pan}" y="${args.tilt}" xmlns="http://www.onvif.org/ver10/schema"/>
      </Velocity>
    </tptz:ContinuousMove>`;
    sendSoap('ContinuousMove', body, () => {
      setTimeout(() => PTZ.stop(true, false), duration);
    });
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
      setTimeout(() => PTZ.stop(false, true), duration);
    });
  },

  stop(pan = true, zoom = true) {
    const body = `<tptz:Stop xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PanTilt>${pan}</PanTilt><Zoom>${zoom}</Zoom>
    </tptz:Stop>`;
    sendSoap('Stop', body);
  },

  goto() {
    if (!args.preset) errorOut('--preset is required for goto');
    const body = `<tptz:GotoPreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetToken>${args.preset}</PresetToken>
    </tptz:GotoPreset>`;
    sendSoap('GotoPreset', body);
  },

  setpreset() {
    if (!args.presetname) errorOut('--presetname is required for setpreset');
    const body = `<tptz:SetPreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetName>${args.presetname}</PresetName>
    </tptz:SetPreset>`;
    sendSoap('SetPreset', body);
  },

  removepreset() {
    if (!args.preset) errorOut('--preset is required for removepreset');
    const body = `<tptz:RemovePreset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
      <PresetToken>${args.preset}</PresetToken>
    </tptz:RemovePreset>`;
    sendSoap('RemovePreset', body);
  },

  presets() {
    const body = `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
    </tptz:GetPresets>`;
    sendSoap('GetPresets', body);
  },

  status() {
    const body = `<tptz:GetStatus xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${PROFILE_TOKEN}</ProfileToken>
    </tptz:GetStatus>`;
    sendSoap('GetStatus', body);
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
    sendSoap('AbsoluteMove', body);
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
    sendSoap('RelativeMove', body);
  },

  configoptions() {
    const body = `<tptz:GetConfigurationOptions xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
      <ConfigurationToken>${PROFILE_TOKEN}</ConfigurationToken>
    </tptz:GetConfigurationOptions>`;
    sendSoap('GetConfigurationOptions', body);
  }
};

const act = args.action.toLowerCase();
if (!PTZ[act]) errorOut(`Unsupported action: ${act}`);
PTZ[act]();
