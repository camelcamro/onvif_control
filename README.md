
# ONVIF Control Script

**Version:** 1.1.8 (Full Extended)  
**Build Date:** 2025-08-25 
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
