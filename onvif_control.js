// onvif_control.js
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

const VERSION = '1.1.0';
const BUILD_DATE = '2025-05-05';
const PROFILE_TOKEN = args.token || 'MainStreamProfileToken';
const WAKEUP = 'wakeup' in args;
const WAKEUP_SIMPLE = 'wakeup_simple' in args;

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

  reboot                         ONVIF: SystemReboot
  factoryreset                   ONVIF: FactoryReset
  setdatetime                    ONVIF: SetSystemDateAndTime
  get_snapshot_uri               ONVIF: GetSnapshotUri
  get_stream_uri                 ONVIF: GetStreamUri
  get_profiles                   ONVIF: GetProfiles
  get_video_encoder_configuration ONVIF: GetVideoEncoderConfiguration
  set_video_encoder_configuration ONVIF: SetVideoEncoderConfiguration
  get_system_date_and_time       ONVIF: GetSystemDateAndTime
  get_system_info                ONVIF: GetDeviceInformation
  get_capabilities               ONVIF: GetCapabilities
  get_network_interfaces         ONVIF: GetNetworkInterfaces
  set_network_interfaces         ONVIF: SetNetworkInterfaces
  get_users                      ONVIF: GetUsers
  add_user                       ONVIF: CreateUsers
  delete_user                    ONVIF: DeleteUsers
  set_ntp                        ONVIF: SetNTP
  get_system_logs                ONVIF: GetSystemLog
  get_dns                        ONVIF: GetDNS
  set_dns                        ONVIF: SetDNS
  get_motion_detection           ONVIF: GetMotionDetection
  set_motion_detection           ONVIF: SetMotionDetection
  get_event_properties           ONVIF: GetEventProperties
  subscribe_events               ONVIF: Subscribe
  gethostname                    ONVIF: GetHostname
  sethostname                    ONVIF: SetHostname
  set_static_ip                  ONVIF: SetNetworkInterfaces
  enable_dhcp                    ONVIF: SetNetworkInterfaces
  reset_password                 ONVIF: SetUser
  get_device_information         ONVIF: GetDeviceInformation

Optional:
  --token, -k                   ProfileToken (default: MainStreamProfileToken)
  --pan, -p                     Pan value
  --tilt, -i                    Tilt value
  --zoom, -z                    Zoom value
  --preset=<PRESETNAME>, -e     Preset token (for goto/remove eg: Preset001)
  --presetname=<PRESETNAME>, -n Preset name (for setpreset eg: Preset001)
  --time, -t                    Duration (in seconds) for move/zoom
  --wakeup                      Send full wakeup before action cmd (GetNodes, GetConfigurations, GetPresets)
  --wakeup_simple               Send simple wakeup before action cmd (GetDeviceInformation only)
  --debug, -d                   Output args in JSON
  --verbose, -v                 Show verbose info
  --log, -l                     Log to system log
  --dry-run, -r                 Simulate request
  --mute, -m                    Only return error code
  --help, -h                    Show help
  --version
  --hostname                   New hostname (used with --action=sethostname)
  --ip                         IP address (used with --action=set_network_interfaces)
  --netmask                    Netmask (used with --action=set_network_interfaces)
  --gateway                    Gateway IP (used with --action=set_network_interfaces)
  --dhcp                       Enable DHCP (1 or 0)
  --dns1, --dns2               DNS servers (used with --action=set_dns)
  --ntp_server                 NTP server IP (used with --action=set_ntp)
  --datetime                   Manual UTC datetime (optional for setdatetime)
  --username                   Username (used with --action=reset_password)
  --resolution                 Resolution (e.g. 1920x1080) for video encoder
  --bitrate                    Bitrate in kbps for encoder
  --codec                      Codec type (e.g. H264)
  --eventtype                  Event filter type (optional for --action=subscribe_events)
  --enable                     Enable flag (1 or 0) for motion detection

  --new_username                Username to create (used with --action=add_user)
  --new_password                Password for new user
  --new_userlevel               Access level (Administrator, User, Operator)
  --del_username                Username to delete (used with --action=delete_user)
                     Show version
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

logMessage(`Called script onvif_control.js with ${process.argv.slice(2).join(' ')}`);
if (args.verbose) console.log(`[INFO] Called with:`, mask(args));
if (args.debug) console.log(JSON.stringify(mask(args), null, 2));
if (args['dry-run']) process.exit(0);

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
const enable_motion = args.enable;


const newUser = args.new_username;
const newPass = args.new_password;
const newLevel = args.new_userlevel;
const delUser = args.del_username;


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

function wakeupSimple(cb) {
  if (args.verbose) console.log('[WAKEUP_SIMPLE] Sending GetDeviceInformation...');
  const body = `<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
  realSendSoap('GetDeviceInformation', body, cb);
}

function wakeupSequence(cb) {
  if (args.verbose) console.log('[WAKEUP] Sending Wakeup Sequence (GetNodes, GetConfigurations, GetPresets)...');
  const steps = [
    () => realSendSoap('GetNodes', '<tptz:GetNodes xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>', steps[1]),
    () => realSendSoap('GetConfigurations', '<tptz:GetConfigurations xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>', steps[2]),
    () => realSendSoap('GetPresets', `<tptz:GetPresets xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>${PROFILE_TOKEN}</ProfileToken></tptz:GetPresets>`, cb)
  ];
  steps[0]();
}

function sendSoap(action, body, cb) {
  const wakeupTasks = [];
  if (WAKEUP) wakeupTasks.push(cb => wakeupSequence(cb));
  if (WAKEUP_SIMPLE) wakeupTasks.push(cb => wakeupSimple(cb));

  let index = 0;
  function next() {
    if (index < wakeupTasks.length) {
      wakeupTasks[index++](next);
    } else {
      realSendSoap(action, body, cb);
    }
  }
  next();
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

  reboot() {
    const body = `<tds:SystemReboot xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SystemReboot', body);
  },
  factoryreset() {
    const body = `<tds:FactoryReset xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('FactoryReset', body);
  },
  setdatetime() {
    const body = `<tds:SetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetSystemDateAndTime', body);
  },
  get_snapshot_uri() {
    const body = `<tds:GetSnapshotUri xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetSnapshotUri', body);
  },
  get_stream_uri() {
    const body = `<tds:GetStreamUri xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetStreamUri', body);
  },
  get_profiles() {
    const body = `<tds:GetProfiles xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetProfiles', body);
  },
  get_video_encoder_configuration() {
    const body = `<tds:GetVideoEncoderConfiguration xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetVideoEncoderConfiguration', body);
  },
  set_video_encoder_configuration() {
    const body = `<tds:SetVideoEncoderConfiguration xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetVideoEncoderConfiguration', body);
  },
  get_system_date_and_time() {
    const body = `<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetSystemDateAndTime', body);
  },
  get_system_info() {
    const body = `<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetDeviceInformation', body);
  },
  get_capabilities() {
    const body = `<tds:GetCapabilities xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetCapabilities', body);
  },
  get_network_interfaces() {
    const body = `<tds:GetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetNetworkInterfaces', body);
  },
  set_network_interfaces() {
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetNetworkInterfaces', body);
  },
  get_users() {
    const body = `<tds:GetUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetUsers', body);
  },
  add_user() {
    const body = `<tds:CreateUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('CreateUsers', body);
  },
  delete_user() {
    const body = `<tds:DeleteUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('DeleteUsers', body);
  },
  set_ntp() {
    const body = `<tds:SetNTP xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetNTP', body);
  },
  get_system_logs() {
    const body = `<tds:GetSystemLog xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetSystemLog', body);
  },
  get_dns() {
    const body = `<tds:GetDNS xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetDNS', body);
  },
  set_dns() {
    const body = `<tds:SetDNS xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetDNS', body);
  },
  get_motion_detection() {
    const body = `<tds:GetMotionDetection xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetMotionDetection', body);
  },
  set_motion_detection() {
    const body = `<tds:SetMotionDetection xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetMotionDetection', body);
  },
  get_event_properties() {
    const body = `<tds:GetEventProperties xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetEventProperties', body);
  },
  subscribe_events() {
    const body = `<tds:Subscribe xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('Subscribe', body);
  },
  gethostname() {
    const body = `<tds:GetHostname xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetHostname', body);
  },
  sethostname() {
    const body = `<tds:SetHostname xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetHostname', body);
  },
  set_static_ip() {
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetNetworkInterfaces', body);
  },
  enable_dhcp() {
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetNetworkInterfaces', body);
  },
  reset_password() {
    const body = `<tds:SetUser xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('SetUser', body);
  },
  get_device_information() {
    const body = `<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>`;
    sendSoap('GetDeviceInformation', body);
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
    sendSoap('CreateUsers', body);
  },

  delete_user() {
    if (!delUser) errorOut('Missing --del_username');
    const body = `<tds:DeleteUsers xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Username>${delUser}</tds:Username>
    </tds:DeleteUsers>`;
    sendSoap('DeleteUsers', body);
  },


  sethostname() {
    if (!hostname) errorOut('Missing --hostname');
    const body = `<tds:SetHostname xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Name>${hostname}</tds:Name>
    </tds:SetHostname>`;
    sendSoap('SetHostname', body);
  },

  set_network_interfaces() {
    if (!ip || !netmask || !gateway) errorOut('Missing --ip, --netmask, or --gateway');
    const dhcpFlag = dhcp === '1' ? 'true' : 'false';
    const body = `<tds:SetNetworkInterfaces xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:InterfaceToken>eth0</tds:InterfaceToken>
      <tds:NetworkInterface>
        <tt:Enabled>true</tt:Enabled>
        <tt:IPv4>
          <tt:Enabled>true</tt:Enabled>
          <tt:Manual>
            <tt:Address>${ip}</tt:Address>
            <tt:PrefixLength>24</tt:PrefixLength>
          </tt:Manual>
          <tt:DHCP>${dhcpFlag}</tt:DHCP>
        </tt:IPv4>
      </tds:NetworkInterface>
    </tds:SetNetworkInterfaces>`;
    sendSoap('SetNetworkInterfaces', body);
  },

  set_dns() {
    if (!dns1 && !dns2) errorOut('Missing --dns1 or --dns2');
    const dnsParts = [dns1, dns2].filter(Boolean).map(d => `<tt:Type>IPv4</tt:Type><tt:IPv4Address>${d}</tt:IPv4Address>`).join("");
    const body = `<tds:SetDNS xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:FromDHCP>false</tds:FromDHCP>
      <tds:DNSManual>${dnsParts}</tds:DNSManual>
    </tds:SetDNS>`;
    sendSoap('SetDNS', body);
  },

  set_ntp() {
    if (!ntp) errorOut('Missing --ntp_server');
    const body = `<tds:SetNTP xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:FromDHCP>false</tds:FromDHCP>
      <tds:NTPManual>
        <tt:Type>IPv4</tt:Type>
        <tt:IPv4Address>${ntp}</tt:IPv4Address>
      </tds:NTPManual>
    </tds:SetNTP>`;
    sendSoap('SetNTP', body);
  },

  reset_password() {
    if (!username_reset || !newpass_reset) errorOut('Missing --username or --new_password');
    const body = `<tds:SetUser xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:User>
        <tt:Username>${username_reset}</tt:Username>
        <tt:Password>${newpass_reset}</tt:Password>
      </tds:User>
    </tds:SetUser>`;
    sendSoap('SetUser', body);
  },

  set_video_encoder_configuration() {
    if (!resolution || !bitrate || !codec) errorOut('Missing --resolution, --bitrate, or --codec');
    const body = `<trt:SetVideoEncoderConfiguration xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:Configuration>
        <tt:Encoding xmlns:tt="http://www.onvif.org/ver10/schema">${codec}</tt:Encoding>
        <tt:Resolution>
          <tt:Width>${resolution.split('x')[0]}</tt:Width>
          <tt:Height>${resolution.split('x')[1]}</tt:Height>
        </tt:Resolution>
        <tt:RateControl>
          <tt:BitrateLimit>${bitrate}</tt:BitrateLimit>
        </tt:RateControl>
      </trt:Configuration>
      <trt:ForcePersistence>true</trt:ForcePersistence>
    </trt:SetVideoEncoderConfiguration>`;
    sendSoap('SetVideoEncoderConfiguration', body);
  },

  subscribe_events() {
    const body = `<tev:Subscribe xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>`;
    sendSoap('Subscribe', body);
  },

  set_motion_detection() {
    if (!enable_motion) errorOut('Missing --enable');
    const body = `<tmd:SetMotionDetection xmlns:tmd="http://www.onvif.org/ver10/schema">
      <tmd:Enabled>${enable_motion}</tmd:Enabled>
    </tmd:SetMotionDetection>`;
    sendSoap('SetMotionDetection', body);
  },
};

const act = args.action.toLowerCase();
if (!PTZ[act]) errorOut(`Unsupported action: ${act}`);
PTZ[act]();
