
# ONVIF Control Script

**Version:** 1.1.9
**Build Date:** 2025-08-26
**Author:** camel (camelcamro)

---

## 📦 Motivation & Inspiration 
As i needed in home assistant to execute a **command line script (CLI) for onvif PTZ**
And i wanted to use full PTZ features to delete, set, goto presets and to be more flexible and home assistant "onvif ptz" is very limited on PTZ features.
So, i created this project.

## 📦 Features

- Fully scriptable & automatable via CLI
- Full ONVIF PTZ support via raw SOAP HTTP requests
- WS-Security with Digest Authentication
- Continuous Move, Absolute/Relative Move
- Zoom in/out, Preset Save, Goto, Delete
- PTZ Status, Configuration Options
- Detailed logging (console + system log)
- Dry run & verbose/debug modes for development
- Standalone – does **not** require `onvif-cli` or any ONVIF SDK

---

## 📁 Installation Guide


- Full ONVIF device control (reboot, factory reset, set time)
- Stream & snapshot URI fetch
- Device information: hostname, capabilities, system logs
- Video encoder configuration get/set
- User management (get/add/delete)
- Network and DNS management (IP/DHCP/DNS)
- Motion detection, NTP and event subscription features


### ✅ Requirements

- **Node.js** (>= 18.x)  
- **npm**  
- **Network access** to ONVIF-compatible camera  
- **Linux with logger** command (for system log support)
- **minimist** installed in same directy as where the *onvif_control.js* file is located (see section: Setup)
- **xml2js** installed in same directy as where the *onvif_control.js* file is located (see section: Setup)
 
### 🧰 Install on a Raspberry Pi (Raspbian/Debian)

```bash
sudo apt update && sudo apt install -y nodejs npm net-tools curl logger
sudo npm install -g minimist
```

> Optional debugging tools:
```bash
sudo apt install wireshark
```

---

## ⚙️ Setup

download *onvif_control.js* to your host
(note: If needed install "node" and "minimist" (needs to be installed also in the same folder as script gfile will be running)
(see "Install" sections)

1. Place `onvif_control.js` in eg: `/home/onvif/`
2. Make sure the script is executable:

```bash
chmod +x /home/onvif/onvif_control.js
```

3. Install minimist also in the same folder as your script is located:

```bash
cd /home/onvif
sudo npm install -g minimist
```

4. Install minimist also in the same folder as your script is located:

```bash
cd /home/onvif
sudo npm install xml2js
```

5. Invoke script using `node`:

```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 ...
```

---

## 🚀 Basic Usage

### Mandatory Parameters

| Option      | Alias | Description                                      |
| ----------- | ----- | ------------------------------------------------ |
| `--ip`      | `-i`  | Camera IP                                        |
| `--port`    | ``    | Camera ONVIF port (e.g. 80 or 8080)              |
| `--user`    | `-u`  | Username (ONVIF user)                            |
| `--pass`    | ``    | Password                                         |
| `--token`   | `-k`  | ProfileToken (e.g. from get_profiles)            |
| `--time`    | `-t`  | Duration (s) for continuous move/zoom            |
| `--debug`   | `-d`  | Print arguments + raw SOAP                       |
| `--verbose` | `-v`  | Verbose logs                                     |
| `--help`    | `-h`  | This help                                        |
| `--version` | ``    | Print version                                    |

### Event-specific options

| Option                       | Description                                                         |
|------------------------------|---------------------------------------------------------------------|
| `--mode`                     | Delivery mode (`push\\|pull` (default `push`))                      |
| `--push_url`                 | Push: consumer URL (e.g. `http://host:9000/onvif_hook`)             |
| `--termination`              | Requested TTL (ISO8601 duration, default: `PT60S`)                  |
| `--timeout`                  | Pull: timeout per PullMessages (default: `PT30S`) [reserved]        |
| `--message_limit`            | Pull: max messages per pull (default: `10`) [reserved]              |
| `--subscription`             | Subscription Manager URL (for `renew_subscription` / `unsubscribe`) |
| `--auto_renew`               | Keep renewing automatically (`subscribe_events` only)               |
| `--auto_unsubscribe_on_exit` | On SIGINT/SIGTERM, auto-unsubscribe (when `--auto_renew` is active) |

### [Events / Detection]
- `get_event_properties` — Get ONVIF event capabilities
- `get_motion_detection` — Read motion detection settings
- `set_motion_detection` — Enable/disable motion detection
- `subscribe_events` — Subscribe to ONVIF events
- `renew_subscription` — Renew an existing subscription (by Subscription Manager URL)
- `subscribe_events_device` — Legacy subscribe via Device service (fallback)
- `unsubscribe` — Cancel an existing subscription (by Subscription Manager URL)




### Other optional options

| Option                            | Description                                           |
|-----------------------------------|-------------------------------------------------------|
| `--bitrate`                       | Bitrate in kbps (set_video_encoder_configuration)     |
| `--codec`                         | Codec (e.g. H264)                                     |
| `--datetime`                      | Manual UTC datetime (setdatetime override)            |
| `--del_username`                  | Username to delete (delete_user)                      |
| `--dhcp`                          | DHCP enable flag (set_network_interfaces)             |
| `--dns1, --dns2`                  | DNS servers (set_dns)                                 |
| `--eventtype`                     | Event filter hint (not all cameras use it)            |
| `--enable <true\\|false\\|1\\|0>` | Enable/disable (set_motion_detection)                 |
| `--gateway`                       | Gateway IP (set_network_interfaces)                   |
| `--hostname`                      | New hostname (sethostname)                            |
| `--log, -l`                       | Send log lines to system logger                       |
| `--netmask`                       | Netmask (set_network_interfaces)                      |
| `--new_password`                  | Password for new user (add_user)                      |
| `--new_userlevel`                 | Access level (Administrator, User, Operator)          |
| `--new_username`                  | Username to create (add_user)                         |
| `--ntp_server`                    | NTP server IP/host (set_ntp)                          |
| `--pan, -p`                       | Pan value                                             |
| `--preset=<NAME>, -e`             | Preset name (setpreset) or for legacy alias           |
| `--presetname=<NAME>, -n`         | Preset name (setpreset)                               |
| `--resolution`                    | WidthxHeight (set_video_encoder_configuration)        |
| `--tilt, -y`                      | Tilt value                                            |
| `--username`                      | Target username (reset_password)                      |
| `--wakeup`                        | Send GetNodes→GetConfigurations→GetPresets before PTZ |
| `--wakeup_simple`                 | Send GetPresets before PTZ                            |
| `--zoom, -z`                      | Zoom value                                            |

### Action based call
| Option      | Description                                      |
| ----------- | ------------------------------------------------ |
| `--action`  | Action to perform (`move`, `zoom`, `goto`, etc.) |
|             | See long list above under: Supported Actions     |

## 🔧 Supported Actions

### [Discovery]
- `get_services` — Discover XAddr endpoints (Media v2/v1, PTZ), Events)

### get_services

Discover XAddr endpoints (Media v2/v1, PTZ, Events)

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=get_services
```
### [PTZ]
- `absolutemove` — Move to absolute PT coordinates
- `configoptions` — Get PTZ configuration options
- `get_configurations` — List PTZ configurations
- `get_nodes` — List PTZ nodes
- `get_presets` — List PTZ presets (tokens & names)
- `goto` — Go to preset by **PresetToken**
- `move` — Continuous pan/tilt for `--time` seconds
- `relativemove` — Relative PT step
- `removepreset` — Delete PTZ preset by token
- `setpreset` — Create a PTZ preset (returns token)
- `status` — Get PTZ status
- `stop` — Stop PT and/or zoom
- `zoom` — Continuous zoom for `--time` seconds

### absolutemove

Move to absolute PT coordinates

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=absolutemove --pan=0.1 --tilt=0.1 --zoom=0.1
```

### configoptions

Get PTZ configuration options

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=configoptions
```

### get_configurations

List PTZ configurations

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=get_configurations
```

### get_nodes

List PTZ nodes

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=get_nodes
```

### get_presets

List PTZ presets (tokens & names)

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=get_presets
```

### goto

Go to preset by token

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=goto --preset=Preset001 --token=MainStreamProfileToken
```

### move

Continuous pan/tilt for --time seconds

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=move --time=1.5 --pan=0.2
```

### relativemove

Relative PT step

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=relativemove --pan=0.1 --tilt=0.1 --zoom=0.1
```

### removepreset

Delete PTZ preset by token

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=removepreset --preset=Preset005
```

### setpreset

Create a PTZ preset (returns token)

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=setpreset --presetname=Preset005
```

### status

Get PTZ status

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=status
```

### stop

Stop PT and/or zoom

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=stop
```

### zoom

Continuous zoom for --time seconds

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=zoom --time=1.5 --zoom=0.2
```
### [Media]
- `get_profiles` — List media profiles (**prefers Media v2**, fallback to v1)
- `get_snapshot_uri` — Get JPEG snapshot URL
- `get_stream_uri` — Get RTSP stream URL
- `get_video_encoder_configuration` — Read current video encoder settings
- `set_video_encoder_configuration` — Change video encoder settings
### [Device / Network]
- `add_user` — Create ONVIF user
- `delete_user` — Delete ONVIF user
- `enable_dhcp` — Enable DHCP (IPv4) *(shim via SetNetworkInterfaces)*
- `factoryreset` — Factory reset the device
- `get_capabilities` — Get ONVIF capabilities
- `get_device_information` — Get model, firmware version, serial
- `get_dns` — Retrieve DNS configuration
- `get_network_interfaces` — Get interface info: MAC, IP, DHCP
- `get_system_date_and_time` — Read current device time
- `get_system_info` — Get system info (model, vendor)
- `get_system_logs` — Get system/access logs (`--logtype=System|Access`)
- `get_users` — List ONVIF users
- `gethostname` — Get device hostname
- `reboot` — Reboot the camera
- `reset_password` — Reset ONVIF password
- `set_dns` — Set DNS configuration
- `set_network_interfaces` — Configure detailed network interface parameters
- `set_ntp` — Set NTP server
- `set_static_ip` — Assign static IP *(shim via SetNetworkInterfaces)*
- `setdatetime` — Set local time and timezone dynamically
- `sethostname` — Set device hostname


### get_system_logs

Get system/access logs (--logtype=System|Access)

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=get_system_logs --logtype=System
```
### [Events / Detection]
- `get_event_properties` — Get ONVIF event capabilities
- `get_motion_detection` — Read motion detection settings
- `set_motion_detection` — Enable/disable motion detection
- `subscribe_events` — Subscribe to ONVIF events
- `renew_subscription` — Renew an existing subscription (by Subscription Manager URL)
- `subscribe_events_device` — Legacy subscribe via Device service (fallback)
- `unsubscribe` — Cancel an existing subscription (by Subscription Manager URL)

### renew_subscription

Renew an existing subscription by its Subscription Manager URL. Use `--termination` to request a new TTL.

```bash
node onvif_control.js --ip=IP --port=PORT --user=USER --pass=PASS --action=renew_subscription --subscription=http://CAMERA/onvif/Subscription?Idx=0 --termination=PT600S --verbose --debug
```

### subscribe_events_device

Legacy subscription via the Device service (fallback when Events XAddr rejects Subscribe).

```bash
node onvif_control.js --ip=IP --port=PORT --user=USER --pass=PASS --action=subscribe_events_device --verbose --debug
```

### unsubscribe

Cancel an existing subscription by its Subscription Manager URL.

```bash
node onvif_control.js --ip=IP --port=PORT --user=USER --pass=PASS --action=unsubscribe --subscription=http://CAMERA/onvif/Subscription?Idx=0 --verbose --debug
```
## 📚 Examples

### Discovery-first quick start (recommended)

```bash
# 0) Discover endpoints
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_services --debug

# 1) Get profiles (prefers Media2)
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_profiles --debug
```


Assume script is located at `/home/onvif/onvif_control.js`

---

## 🧪 Movements & Zoom

### Move Right (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0.5 --tilt=0 --time=1.5
```

### Move Left (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=move --time=1.5 --pan=-0.5
```

### Move Up (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=move --time=1.5 --pan=0 --tilt=0.5
```

### Move Down (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=move --time=1.5 --pan=0 --tilt=-0.5
```

### Zoom In (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=0.5 --time=1.5
```

### Zoom Out (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=-0.5 --time=1.5
```

---

## 🧪 Goto, Save, Delete Preset
### Save Preset
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=setpreset --presetname=Preset005
```

### Go to Preset
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=Preset005
```

### Remove Preset
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=removepreset --preset=Preset005
```

---

## 🧪 Status, Configs & Listing
### List Presets
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=presets
```

### Get PTZ Status
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=status
```

### Get PTZ Config Options
```bash
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=configoptions
```

---


---

## 🧪 Device Control

### Reboot Device
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=reboot
```

### Factory Reset
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=factoryreset
```

### Set Date and Time
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=setdatetime
```

---

## 🧪 Stream & Snapshot

### Get Snapshot URI
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_snapshot_uri
```

### Get Stream URI
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_stream_uri
```

---

## 🧪 Info & Network

### Get System Info
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_system_info
```

### Get Capabilities
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_capabilities
```

### Get/Set Network Interfaces
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_network_interfaces
```

---

## 🧪 Users & Security

### Get Users
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_users
```

### Add User
```bash
node onvif_control.js --ip=... --port=... --user=admin --pass=adminpass --action=add_user \
  --new_username=testuser --new_password=1234 --new_userlevel=User
```

### Delete User
```bash
node onvif_control.js --ip=... --port=... --user=admin --pass=adminpass --action=delete_user \
  --del_username=testuser
```

---

## 🧪 DNS / NTP / Logs / Events

### Get System Logs
```bash
node onvif_control.js --action=get_system_logs ...
```

### Set NTP Server
```bash
node onvif_control.js --action=set_ntp ...
```

### Set/Get DNS
```bash
node onvif_control.js --action=get_dns
```

```bash
node onvif_control.js --action=set_dns
```

### Subscribe to Events
```bash
node onvif_control.js --action=subscribe_events
```
## 🔍 Example Calls for Each Action

### get_device_information
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_device_information
```

### get_profiles
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_profiles
```

### get_stream_uri
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_stream_uri
```

### get_snapshot_uri
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_snapshot_uri
```

### get_video_encoder_configuration
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_video_encoder_configuration
```

### set_video_encoder_configuration
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_video_encoder_configuration
```

### get_system_date_and_time
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_system_date_and_time
```

### setdatetime
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=setdatetime
```

### get_capabilities
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_capabilities
```

### get_system_info
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_system_info
```

### get_network_interfaces
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_network_interfaces
```

### set_network_interfaces
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_network_interfaces
```

### get_users
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_users
```

### add_user
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=add_user
```

### delete_user
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=delete_user
```

### set_ntp
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_ntp
```

### get_dns
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_dns
```

### set_dns
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_dns
```

### get_event_properties
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_event_properties
```

### get_motion_detection
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_motion_detection
```

### set_motion_detection
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_motion_detection
```

### subscribe_events
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=subscribe_events
```

### gethostname
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=gethostname
```

### sethostname
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=sethostname
```

### set_static_ip
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_static_ip
```

### enable_dhcp
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=enable_dhcp
```

### reset_password
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=reset_password
```

### reboot
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=reboot
```

### factoryreset
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=factoryreset
```



### Aliases (kept for backward compatibility)



configurations → get_configurations
preset → goto
presets → get_presets
get_static_ip → get_network_interfaces

## 🧠 Expert & Troubleshooting

### Discovering Tokens and Presets

Use **ONVIF Device Manager** on Windows or Linux to:
- Identify your camera’s PTZ profile token
- Test preset positions

**Wireshark** can be used to:
- Filter ONVIF traffic using: `ip.addr == 172.20.1.194 && tcp.port == 8080`
- Use "Follow TCP stream" to view raw XML/SOAP

This helps you detect:
- Which preset names exist (`Preset001` to `Preset256` common)
- If the profile token is not `MainStreamProfileToken`, update using `--token=...`

Links:
- ONVIF Device Manager: https://sourceforge.net/projects/onvifdm/
- Wireshark: https://www.wireshark.org/

---

## 🛡️ Security Note
This tool uses ONVIF-compliant digest authentication with WS-Security headers (password hashed via SHA1 with nonce and timestamp). No plain password is transmitted.

---

## 🧠  Tips

### 🔍 Determine ProfileToken / Preset Names

1. Use **ONVIF Device Manager** (Windows) or **VLC** to explore services.
2. Use **Wireshark**:
   - Start capture on camera IP + port 8080.
   - Apply filter: `ip.addr==172.20.1.194 && tcp.port==8080`
   - Use ONVIF tool (e.g., click preset) to generate traffic.
   - Right-click → Follow TCP stream → Inspect token/preset name.

> Common defaults:
> - **Token:** `MainStreamProfileToken`
> - **Presets:** `Preset001`–`Preset256`

---

## 🧾 Notes

- Most generic IP cameras use `Preset001` to `Preset256` and many also using `Preset01` to `Preset99`
- Be aware, that most generic IP cameras use pre-defined Prests and are used for special comands
  (eg: "tracking stop", "tracking start", "cruise mode", reset all "Presets to default"). This can't be used for *setpreset* or *removepreset" 
- If nothing moves, check credentials, token, and presets
- Ensure your camera supports PTZ and ONVIF over HTTP

---

## 📚 License

MIT or similar – free to use, modify, distribute.

Happy scripting 🎉  
This script was built for developers, integrators, and automation engineers using open, raw SOAP calls – full control, no dependencies!
