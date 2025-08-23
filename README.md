# ONVIF Control Script

**Version:** 1.1.7 (Full Extended)  
**Build Date:** 2025-08-22 
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
- **minimist** installed in same directy as where the *onvif_controls.js* file is located (see section: Setup)
- **xml2js** installed in same directy as where the *onvif_controls.js* file is located (see section: Setup)
 
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
| Option     | Alias | Description                                      |
|------------|-------|--------------------------------------------------|
| `--action` |       | Action to perform (`move`, `zoom`, `goto`, etc.) |
| `--ip`     | `-i`  | IP of camera                                     |
| `--port`   |       | Port of ONVIF service (e.g. 8080)                |

## 🔧 Supported Actions

Below is the complete list of `--action` values supported by `onvif_control.js`:

| Action                   | Description                            |
|---------------------------|----------------------------------------|
| `absolutemove` | Move camera to absolute PTZ coordinates |
| `add_user`               | Add ONVIF user |
| `configoptions`               | Get configuration options |
| `configurations`               | Get PTZ configurations |
| `delete_user`               | Delete ONVIF user |
| `enable_dhcp`               | Enable DHCP on network interface |
| `factoryreset`               | Factory reset the device |
| `get_capabilities`               | Get ONVIF capabilities |
| `get_configurations`               | List media/PTZ configurations |
| `get_device_information`               | Get model, firmware version, serial |
| `get_dns`               | Retrieve DNS configuration |
| `get_event_properties`               | Get ONVIF event capabilities |
| `get_motion_detection`               | Read motion detection settings |
| `get_network_interfaces`               | Get interface info: MAC, IP, DHCP |
| `get_nodes`               | List PTZ nodes |
| `get_presets`               | Get PTZ preset positions |
| `get_profiles`               | List video/audio profiles |
| `get_snapshot_uri`               | Get JPEG snapshot URL |
| `get_static_ip`               | Get static IP settings |
| `get_stream_uri`               | Get RTSP stream URL |
| `get_system_date_and_time`               | Read current device time |
| `get_system_info`               | Get system info (model, vendor) |
| `get_system_logs`               | Get log entries (system or access) |
| `get_users`               | List ONVIF users |
| `get_video_encoder_configuration` | Retrieve current video encoder settings |
| `gethostname`               | Get device hostname |
| `goto`               | Go to PTZ preset |
| `move`               | Relative PTZ move |
| `preset`               | Go to preset position |
| `presets`               | Alias for get_presets |
| `reboot`               | Reboot the camera |
| `relativemove` | Move camera relative to current PTZ position |
| `removepreset`               | Delete PTZ preset |
| `reset_password`               | Reset ONVIF password |
| `set_dns`               | Set DNS configuration |
| `set_motion_detection`               | Enable/disable motion detection |
| `set_network_interfaces` | Configure detailed network interface parameters |
| `set_ntp`               | Set NTP server |
| `set_static_ip`               | Assign static IP |
| `set_video_encoder_configuration`               | Change video settings |
| `setdatetime`               | Set local time and timezone dynamically |
| `sethostname`               | Set device hostname |
| `setpreset` | Save current position as a PTZ preset |
| `status`               | Get PTZ status |
| `stop` | Stop any ongoing PTZ or zoom movement |
| `subscribe_events`               | Subscribe to ONVIF events |
| `zoom`               | Zoom in/out (relative or absolute) |

### Optional Option Parameters
| Option                     | Alias | Description                                                      |
|----------------------------|-------|------------------------------------------------------------------|
| `--bitrate`                |       | Bitrate for encoder in kbps                                      |
| `--codec`                  |       | Video codec type (e.g., H264)                                    |
| `--datetime`               |       | Manual time string for `setdatetime` (optional)                  |
| `--debug`                  | `-d`  | Show debug JSON                                                  |
| `--del_username`           |       | Username to delete (used with `--action=delete_user`)            |
| `--dhcp`                   |       | Enable DHCP (`1` or `0`)                                         |
| `--dns1`, `--dns2`         |       | DNS servers (used with `--action=set_dns`)                       |
| `--dry-run`                | `-r`  | Show parameters but do not send SOAP                             |
| `--enable`                 |       | Enable/Disable flags (e.g., for motion detection)                |
| `--eventtype`              |       | Filter for event subscriptions (optional)                        |
| `--gateway`                |       | Gateway IP (used with `--action=set_network_interfaces`)         |
| `--help`                   | `-h`  | Show usage                                                       |
| `--hostname`               |       | New hostname (used with `--action=sethostname`)                  |
| `--log`                    | `-l`  | Write to system log                                              |
| `--mute`                   | `-m`  | Suppress all output except return code                           |
| `--netmask`                |       | Netmask (used with `--action=set_network_interfaces`)            |
| `--new_password`           |       | Password for new user                                            |
| `--new_userlevel`          |       | Access level (`Administrator`, `User`, etc.)                     |
| `--new_username`           |       | Username to create (used with `--action=add_user`)               |
| `--ntp_server`             |       | NTP server (used with `--action=set_ntp`)                        |
| `--pan`                    | `-p`  | Pan direction/position (-1.0 to 1.0)                             |
| `--pass`                   |       | Password                                                         |
| `--preset=<PRESETNAME>`    | `-e`  | Preset name (used with `goto`, `removepreset`)                   |
| `--presetname=<PRESETNAME>`| `-n`  | Preset name (used with `setpreset`)                              |
| `--resolution`             |       | e.g., `1920x1080` for encoder config                             |
| `--tilt`                   | `-y`  | Tilt direction/position (-1.0 to 1.0)                            |
| `--time`                   | `-t`  | Duration in seconds (for movement/zoom)                          |
| `--token`                  | `-k`  | Profile token (default: `MainStreamProfileToken`)                |
| `--user`                   | `-u`  | Username                                                         |
| `--username`               |       | Username to update (used with `--action=reset_password`)         |
| `--verbose`                | `-v`  | Enable verbose output                                            |
| `--version`                |       | Show version info                                                |
| `--wakeup_simple`          |       | Send simple wakeup before (GetPresets only)                      |
| `--wakeup`                 |       | Send full wakeup before (GetNodes, GetConfigurations, GetPresets)|
| `--zoom`                   | `-z`  | Zoom direction/position (-1.0 to 1.0)                            |
|----------------------------|-------|------------------------------------------------------------------|
---

## 📚 Examples

Assume script is located at `/home/onvif/onvif_control.js`

---

## 🧪 Movements & Zoom

### Move Right (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0.5 --tilt=0 --time=1.5
```

### Move Left (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=-0.5
```

### Move Up (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0 --tilt=0.5
```

### Move Down (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0 --tilt=-0.5
```

### Zoom In (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=0.5 --time=1.5
```

### Zoom Out (1.5s)
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=-0.5 --time=1.5
```

---

## 🧪 Goto, Save, Delete Preset
### Save Preset
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=setpreset --presetname=Preset005
```

### Go to Preset
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=Preset005
```

### Remove Preset
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=removepreset --preset=Preset005
```

---

## 🧪 Status, Configs & Listing
### List Presets
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=presets
```

### Get PTZ Status
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=status
```

### Get PTZ Config Options
```bash
node /home/onvif/onvif_control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=configoptions
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

## 🧠 Expert & Troubleshooting

### Discovering Tokens and Presets

Use **ONVIF Device Manager** on Windows or Linux to:
- Identify your camera’s PTZ profile token
- Test preset positions

**Wireshark** can be used to:
- Filter ONVIF traffic using: `ip.addr == 172.2.1.194 && tcp.port == 8080`
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


---

## 🧭 Actions (grouped & alphabetically sorted) — v1.1.7 view

### [Discovery]
- `get_services` — Discover XAddr endpoints (Media v2/v1, PTZ)

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
- `gethostname` — Get device hostname
- `reboot` — Reboot the camera
- `reset_password` — Reset ONVIF password
- `set_dns` — Set DNS configuration
- `set_network_interfaces` — Configure detailed network interface parameters
- `set_ntp` — Set NTP server
- `set_static_ip` — Assign static IP *(shim via SetNetworkInterfaces)*
- `setdatetime` — Set local time and timezone dynamically
- `sethostname` — Set device hostname

### [Events / Detection]
- `get_event_properties` — Get ONVIF event capabilities
- `get_motion_detection` — Read motion detection settings
- `set_motion_detection` — Enable/disable motion detection
- `subscribe_events` — Subscribe to ONVIF events

### Aliases (kept for backward compatibility)
- `configurations` → `get_configurations`
- `preset` → `goto`
- `presets` → `get_presets`
- `get_static_ip` → `get_network_interfaces`


---

## 🚀 Discovery-first quick start (recommended for v1.1.7)

```bash
# 0) Discover endpoints
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_services --debug

# 1) Get profiles (prefers Media2)
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_profiles --debug

# 2) Presets
node onvif_control.js --action=get_presets --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --token=Profile_1
node onvif_control.js --action=setpreset    --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --token=Profile_1 --presetname=Home
node onvif_control.js --action=goto         --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --token=Profile_1 --preset=<PRESET_TOKEN>
```


---

## 🧾 Changelog (1.1.6 → 1.1.7)
- Added `get_services` discovery (Device→GetServices) to find Media2/Media1/PTZ XAddrs
- `get_profiles` now uses **Media** (v2 preferred, v1 fallback) — not Device
- PTZ actions route to discovered **PTZ XAddr**
- WSSE header improved (`wsse:`/`wsu:` prefixes)
- Added missing `xmlns:tt` to some Device requests; improved `SetDNS`/`SetNTP` payloads
- Help reorganized (grouped, alphabetized); **aliases preserved**
- No new dependencies; fully **backward compatible**

## 🔔 What’s New in 1.1.7 (kept fully backward-compatible with 1.1.6)

- **Discovery step (`get_services`)** — Device→GetServices to discover **XAddr** for **Media v2/v1** and **PTZ** (fixes `ActionNotSupported`).
- **Media-first `get_profiles`** — Calls Media (prefers **ver20**, falls back to **ver10**) instead of Device.
- **PTZ routing** — All PTZ calls (presets/move/goto/…) use the discovered **PTZ XAddr**.
- **WS-Security hardened** — Explicit `wsse:` / `wsu:` namespaces for better firmware compatibility.
- **XML corrections** — Added missing `xmlns:tt` where needed; improved `SetDNS` / `SetNTP` payloads.
- **Help reorganized** — Actions grouped & alphabetically sorted; **aliases preserved** (no breaking changes).
- **Dependencies unchanged** — Still only `minimist` and `xml2js` + Node core modules.

