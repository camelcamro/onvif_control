# ONVIF Control Script

**Version:** 1.2.1
**Build Date:** 2026-09-25
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
- Zoom in/out, Preset Save, Goto, gotoHome, Delete
- PTZ Status, Configuration Options
- Detailed logging (console + system log)
- Dry run & verbose/debug modes for development
- Standalone – does **not** require `onvif-cli` or any ONVIF SDK
- Multi-IP & Range support (--ip=172.20.1.171-198 or --ip=172.20.1.171,172.20.1.172)
- CamHi / HiSilicon CGI extension (see section *CamHi / HiSilicon CGI extension*):
  virtual presets **Preset900–Preset911** (read all values raw / set exactly one value),
  raw read/set actions, automatic CGI path fallback
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

4. Install xml2js also in the same folder as your script is located:

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

| Option      | Alias | Description                                                          |
| ----------- | ----- | -------------------------------------------------------------------- |
| `--debug`   | `-d`  | Print arguments + raw SOAP                                           |
| `--help`    | `-h`  | This help                                                            |
| `--ip`      | `-i`  | Camera IP                                                            |
| `--ip,      | `-i`  | Camera IP(s) - Supports single IP, comma-separated lists, and ranges:|
|             |       |   e.g. --ip=172.20.1.171                                             |
|             |       |   e.g. --ip=172.20.1.171,172.20.1.172                                |
|             |       |   e.g. --ip=172.20.1.171-198                                         |
|             |       |   e.g. --ip=172.20.1.171-175,172.20.1.180                            |
| `--pass`    | ``    | Password                                                             |
| `--port`    | ``    | Camera ONVIF port (e.g. 80 or 8080)                                  |
| `--time`    | `-t`  | Duration (s) for continuous move/zoom                                |
| `--token`   | `-k`  | ProfileToken (e.g. from get_profiles)                                |
| `--user`    | `-u`  | Username (ONVIF user)                                                |
| `--verbose` | `-v`  | Verbose logs                                                         |
| `--version` | ``    | Print version                                                        |

### Event-specific options

| Option                       | Description                                                         |
|------------------------------|---------------------------------------------------------------------|
| `--auto_renew`               | Keep renewing automatically (`subscribe_events` only)               |
| `--auto_unsubscribe_on_exit` | On SIGINT/SIGTERM, auto-unsubscribe (when `--auto_renew` is active) |
| `--message_limit`            | Pull: max messages per pull (default: `10`) [reserved]              |
| `--mode`                     | Delivery mode (`push\\|pull` (default `push`))                      |
| `--push_url`                 | Push: consumer URL (e.g. `http://host:9000/onvif_hook`)             |
| `--pushurl`                  | Alias for `--push_url` (push mode)                                  |
| `--subscription`             | Subscription Manager URL (for `renew_subscription` / `unsubscribe`) |
| `--termination`              | Requested TTL (ISO8601 duration, default: `PT60S`)                  |
| `--timeout`                  | Pull: timeout per PullMessages (default: `PT30S`) [reserved]        |

### [Events / Detection]
- `get_event_properties` — Get ONVIF event capabilities
- `get_motion_detection` — Read motion detection settings
- `renew_subscription` — Renew an existing subscription (by Subscription Manager URL)
- `set_motion_detection` — Enable/disable motion detection
- `subscribe_events_device` — Legacy subscribe via Device service (fallback)
- `subscribe_events` — Subscribe to ONVIF events
- `unsubscribe` — Cancel an existing subscription (by Subscription Manager URL)

### Other optional options

| Option                            | Description                                           |
|-----------------------------------|-------------------------------------------------------|
| `--bitrate`                       | Bitrate in kbps (set_video_encoder_configuration)     |
| `--cgi_port`                      | CamHi CGI web port (default `80`, not the ONVIF port) |
| `--codec`                         | Codec (e.g. H264)                                     |
| `--datetime`                      | Manual UTC datetime (setdatetime override)            |
| `--del_username`                  | Username to delete (delete_user)                      |
| `--dhcp`                          | DHCP enable flag (set_network_interfaces)             |
| `--dns1, --dns2`                  | DNS servers (set_dns)                                 |
| `--dry-run`, `-r`                 | Do not send SOAP; validate & show intended action     |
| `--enable <true\\|false\\|1\\|0>` | Enable/disable (set_motion_detection)                 |
| `--eventtype`                     | Event filter hint (not all cameras use it)            |
| `--gateway`                       | Gateway IP (set_network_interfaces)                   |
| `--hostname`                      | New hostname (sethostname)                            |
| `--log, -l`                       | Send log lines to system logger                       |
| `--logtype`                       | Log type for `get_system_logs` (`System`\|`Access`)   |
| `--mute`, `-m`                    | Suppress error prints (mute console errors)           |
| `--netmask`                       | Netmask (set_network_interfaces)                      |
| `--new_password`                  | Password for new user (add_user)                      |
| `--new_userlevel`                 | Access level (Administrator, User, Operator)          |
| `--new_username`                  | Username to create (add_user)                         |
| `--ntp_server`                    | NTP server IP/host (set_ntp)                          |
| `--pan, -p`                       | Pan value                                             |
| `--preset=<NAME>, -e`             | Preset name (setpreset) or for legacy alias           |
| `--presetname=<NAME>, -n`         | Preset name (setpreset)                               |
| `--raw`                           | Raw CamHi set payload (`camhi_set_raw`)               |
| `--resolution`                    | WidthxHeight (set_video_encoder_configuration)        |
| `--tilt, -y`                      | Tilt value                                            |
| `--username`                      | Target username (reset_password)                      |
| `--wakeup_simple`                 | Send GetPresets before PTZ                            |
| `--wakeup`                        | Send GetNodes→GetConfigurations→GetPresets before PTZ |
| `--zoom, -z`                      | Zoom value                                            |

### Action based call
| Option      | Description                                      |
| ----------- | ------------------------------------------------ |
| `--action`  | Action to perform (`move`, `zoom`, `goto`, etc.) |
|             | See long list above under: Supported Actions     |

## 🔧 Supported Actions

### [Discovery]
- `get_services` — Discover XAddr endpoints (Media v2/v1, PTZ, Events)

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
- `goto` — Go to preset by **PresetToken** ( see table below in README for "VIRTUAL Presets"
             * Preset900–Preset911 are CamHi virtual presets (see section *CamHi / HiSilicon CGI extension*)
- `gotohomeposition` — Go to home position ( -> check via get_nodes - if supported) 
- `home` — Go to home position (same as gotohomeposition -> check via get_nodes - if supported) 
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

### home (alias: gotohomeposition)

Go to home position (check via get_nodes - if supported)

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=home --token=MainStreamProfileToken
or
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=gotohomeposition --token=MainStreamProfileToken
```
### move

Continuous pan/tilt for --time seconds

```bash
node onvif_control.js --ip=172.20.1.191 --port=8080 --user=admin --pass=**** --action=move --time=1.5 --pan=0.2 --tilt=0
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
node onvif_control.js --ip=IP --port=PORT --user=USER --pass=PASS --action=subscribe_events_device --push_url=http://host:9000/onvif_hook --verbose --debug
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
node /home/onvif/onvif_control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=move --time=1.5 --pan=-0.5 --tilt=0
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
node onvif_control.js --action=set_ntp --ntp_server=pool.ntp.org
```

### Set/Get DNS
```bash
node onvif_control.js --action=get_dns
```

```bash
node onvif_control.js --action=set_dns --dns1=8.8.8.8 --dns2=1.1.1.1
```

### Subscribe to Events
```bash
node onvif_control.js --action=subscribe_events --push_url=http://host:9000/onvif_hook
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
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_network_interfaces --netmask=255.255.255.0 --gateway=192.168.1.1 --dhcp=0
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
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_ntp --ntp_server=pool.ntp.org
```

### get_dns
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_dns
```

### set_dns
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=set_dns --dns1=8.8.8.8 --dns2=1.1.1.1
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
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=subscribe_events --push_url=http://host:9000/onvif_hook
```

### gethostname
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=gethostname
```

### sethostname
```bash
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=sethostname --hostname=<name>
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
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=reset_password --username=<user> --new_password=<pass>
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
get_static_ip → get_network_interfaceshome
home → gotohomeposition

---

## 📷 CamHi / HiSilicon CGI extension

Many cheap PTZ cameras sold with the **CamHi / CamHiPro** app (HiSilicon / "Hipcam" web server, `IP CAMERA` web UI)
have settings that are **not reachable via ONVIF** (Smart-Tracking, status LED, alarm mask during PTZ movement, …).
They are stored through the camera's proprietary CGI:

```
http://<IP>[:<cgi_port>]/web/cgi-bin/hi3510/param.cgi     (tried first)
http://<IP>[:<cgi_port>]/cgi-bin/hi3510/param.cgi         (alternative)
```

**Every** CGI request (read and set) is sent to `/web/cgi-bin/…` first. On a network error, an HTTP error or
`Error 404 … invalid request` the same request is repeated on the alternative path `/cgi-bin/…`.
The path that worked is tried first for the next request to the same camera (within one run).

The CGI runs on the camera's **web port (default 80)** – *not* on the ONVIF port given with `--port`.
Use `--cgi_port` if your camera's web UI runs on another port. Authentication: HTTP Basic (`--user` / `--pass`).

### Virtual presets (for Home Assistant / scripts)

Use them like normal presets: `--action=goto --preset=Preset9xx` (also accepted: `9xx`, `preset9xx`, `Preset09xx`).
**Every preset changes exactly ONE setting** – fire & forget: one request, no read before or after.
Use `Preset900` to check the current values.

| Preset | Function | CGI command | Field(s) |
|---|---|---|---|
| `Preset900` | Read **all** CamHi values, raw output | `getmotorattr`, `getsmartrackattr`, `getlightattr` | – |
| `Preset901` | Smart-Tracking **ON** | `setsmartrackattr` | `smartrack_enable=1` |
| `Preset902` | Smart-Tracking **OFF** | `setsmartrackattr` | `smartrack_enable=0` |
| `Preset903` | Status LED **ON** | `setlightattr` | `light_enable=on` |
| `Preset904` | Status LED **OFF** | `setlightattr` | `light_enable=off` |
| `Preset905` | No motion alarm while PTZ is moving **ON** | `setmotorattr` | `ptzalarmmask=on` |
| `Preset906` | No motion alarm while PTZ is moving **OFF** | `setmotorattr` | `ptzalarmmask=off` |
| `Preset907` | Center after self check (reboot) **ON** | `setmotorattr` | `movehome=on` |
| `Preset908` | Center after self check (reboot) **OFF** | `setmotorattr` | `movehome=off` |
| `Preset909` | PTZ speed **FAST** | `setmotorattr` | `panspeed` + `tiltspeed` = `0` |
| `Preset910` | PTZ speed **MEDIUM** | `setmotorattr` | `panspeed` + `tiltspeed` = `1` |
| `Preset911` | PTZ speed **SLOW** | `setmotorattr` | `panspeed` + `tiltspeed` = `2` |

PTZ speed values (verified in the web UI): `0` = Fast, `1` = Medium, `2` = Slow – `3` is rejected with `[Error]Param error.`
They are defined in `CAMHI_SPEED` in the script.

Numeric settings (cruise laps, timeouts, preset numbers, scan limits, …) are intentionally **not** supported as
virtual presets. Use `camhi_set_raw` for them.

### Actions

| Action | Description |
|---|---|
| `camhi_get` (alias `camhi_raw_get`) | Read all values, raw `var name="value";` output (same as `Preset900`) |
| `camhi_set_raw` | Send a raw set payload given with `--raw="cmd=set...&-field=value"` |
| `set_smart_track` (alias `smarttrack`) | `--smart_track=<1\|0\|on\|off>` (same as `Preset901` / `Preset902`) |

```bash
# Read all values (raw)
node onvif_control.js --ip=172.20.1.183 --port=8080 --user=admin --pass=**** --action=goto --preset=Preset900
node onvif_control.js --ip=172.20.1.171-198 --port=8080 --user=admin --pass=**** --action=camhi_get

# Set one value (status LED off) on all cameras
node onvif_control.js --ip=172.20.1.171-198 --port=8080 --user=admin --pass=**** --action=goto --preset=Preset904

# Raw set (one command per call recommended)
node onvif_control.js --ip=172.20.1.183 --port=8080 --user=admin --pass=**** --action=camhi_set_raw --raw="cmd=setmotorattr&-panscan=1&-tiltscan=1"
```

### Output

```
===== 172.20.1.186 (CamHi CGI /web/cgi-bin/hi3510/param.cgi) =====      <- camhi_get / Preset900
var panspeed="0";
...
# getsmartrackattr: not supported by this firmware (HTTP 404 / invalid request)
var light_enable="off";

[SUCCESS 172.20.1.182] Preset904 Status LED OFF: sent (light_enable=off) - camera answered "[Succeed]light ctrl(off) succeed."
[SUCCESS 172.20.1.182] Preset901 Smart-Tracking ON: sent (smartrack_enable=1) - camera answered "[Succeed]set ok."
[ERROR 172.20.1.186] Preset901 Smart-Tracking ON: camera answered "Error 404: Not Found invalid request" (HTTP 404, all CGI paths tried)
[ERROR 172.20.1.x] ...: camera answered "[Error]Param error."
```

`SUCCESS` means the camera answered `[Succeed]…` – see rule 6: this is not a guarantee that the value is stored.
On cameras with `smartrack_flag=0` Smart-Tracking is accepted but has no effect.

An `ERROR` for Smart-Tracking on old firmware (no Smart-Tracking command) is expected and harmless – nothing is changed.

In Home Assistant the raw output of `Preset900` is only visible when the `shell_command` is called with a
`response_variable` (the output is returned in `stdout`).

### How a virtual preset is executed

1. **Set** – one command, only the field(s) of this preset (HTTP POST, `application/x-www-form-urlencoded`),
   fire & forget (no read before or after). `/web/cgi-bin/…` first, on error / 404 the alternative `/cgi-bin/…`.
2. Camera answers `[Succeed]…` → `SUCCESS`.
3. `[Error]…` or 404 on both paths → `ERROR` (nothing was changed).

### CGI rules & findings (tested live on 2026-09-25)

| # | Finding | Consequence |
|---|---|---|
| 1 | Setting **single fields** works; fields not sent stay unchanged | send only what should change |
| 2 | **Unknown fields** are ignored silently (new and old firmware) | one payload may be sent to all cameras |
| 3 | **One invalid value rejects the whole request** → `[Error]Param error.` (all `cmd=` blocks of that call) | one command per request |
| 4 | Old firmware: **unknown command** (`setsmartrackattr` / `getsmartrackattr`) → `Error 404: Not Found / invalid request`. Commands are processed in order – blocks **before** it are stored, blocks **after** it are not | never send smart-track commands to old firmware |
| 5 | HTTP 404 on old firmware can mean *unknown command*, not only *wrong path* | on 404 the alternative path is tried; 404 on both paths = `ERROR` |
| 6 | `[Succeed]…` is **not** a proof (`poweronscanenable=1` answers `[Succeed]set ok.` but is not stored) | check with `Preset900` when in doubt |
| 7 | `smartrack_enable` is stored even when `smartrack_flag=0` (no effect) | harmless |
| 8 | Responses (without `cururl`) are plain text without newline: `[Succeed]set ok.`, `[Succeed]light ctrl(on) succeed.`, `[Error]Param error.` | parse the text, not the HTTP status |
| 9 | The browser also sends `cururl=http%3A%2F%2F<ip>%2Fweb%2Fterminal.html` – only the redirect target of the web UI | not needed |

### ⛔ Blocked fields – never set

| Field | Why |
|---|---|
| `poweronpresetindex` | Reads `0` (= no power-on preset), but `0` and `-1` are rejected with `[Error]Param error.` – and because of rule 3 **all other values of the same request are dropped**. Once set to ≥ 1 it can **not** be reset to `0` via CGI (factory reset only). |
| `poweronscanenable` | Answers `[Succeed]` but the value is not stored. |

No virtual preset uses these fields. Do not use them with `camhi_set_raw` either.

### Firmware variants

| Variant | CGI path | Commands | Notes |
|---|---|---|---|
| Current firmware | `/web/cgi-bin/…` and `/cgi-bin/…` | `get/setmotorattr`, `get/setsmartrackattr`, `get/setlightattr` | 19–25 fields; Smart-Tracking only if `smartrack_flag=1` |
| Old "Hipcam" firmware | `/web/cgi-bin/…` only | `get/setmotorattr`, `get/setlightattr` | 8 fields: `panspeed`, `tiltspeed`, `panscan`, `tiltscan`, `movehome`, `ptzalarmmask`, `alarmpresetindex`, `light_enable` |

### Field reference (`get…attr` output)

| Field | Command | Web UI (Settings → Advanced → Terminal) | Meaning | Values |
|---|---|---|---|---|
| `panspeed`, `tiltspeed` | motor | PTZ speed | pan / tilt speed | `0` Fast, `1` Medium, `2` Slow |
| `panscan`, `tiltscan` | motor | Cruise laps (1–50) | number of internal cruise laps | number |
| `movehome` | motor | Centered While Self Check | move to center after self check (reboot) | `on` / `off` |
| `ptzalarmmask` | motor | Close the alarm PTZ movement | no motion alarms while the camera moves | `on` / `off` |
| `alarmpresetindex` | motor | – | preset used by alarm linkage "go to preset" | number |
| `poweronpresetindex` | motor | – | preset after power-on – ⛔ **blocked** | – |
| `watchpresetindex` | motor | – | watch/guard preset after idle (`0` = off) | number |
| `poweronscanenable` | motor | – | cruise/scan after power-on – ⛔ **blocked** | – |
| `movesteptimeout` | motor | – | duration of one manual step (ms) | number |
| `presettimeout` | motor | – | preset related timeout (s) | number |
| `limitleft`, `limitright` | motor | – | scan limits (`-1` = not set) | number |
| `tourinterval` | motor | – | list of selectable cruise dwell times (not a setting) | `5;10;…;120` |
| `pandir`, `tiltdir` | motor | – | direction inversion (some firmware only) | `0` / `1` |
| `smartrack_flag` | smartrack | – | capability: camera supports Smart-Tracking | `0` / `1` (read only) |
| `smartrack_enable` | smartrack | SmartTrack | Smart-Tracking on/off | `1` / `0` |
| `smartrack_timeout` | smartrack | – | seconds until return after tracking | number |
| `smartrack_mode`, `smartrack_f2n`, `smartrack_n2f`, `smartrack_n2ftimeout` | smartrack | – | tracking mode / auto-zoom thresholds (zoom models only) | number |
| `light_enable` | light | Indicator Display Mode | status LED (`Been lighted` / `Been extinguished`) | `on` / `off` |

Meanings without a web UI field are derived from names and values – they are not officially documented.

### Plain curl equivalents

```bash
# read (old firmware: without cmd=getsmartrackattr)
curl -s -u admin:**** "http://172.20.1.183/web/cgi-bin/hi3510/param.cgi?cmd=getmotorattr&cmd=getsmartrackattr&cmd=getlightattr"
# set one value
curl -s -u admin:**** -d "cmd=setlightattr&-light_enable=off" "http://172.20.1.183/web/cgi-bin/hi3510/param.cgi"; echo
```

### Security note (CamHi CGI)

The CGI uses plain HTTP with Basic authentication (Base64, not encrypted). The web UI also returns all
user passwords in clear text (`cmd=getuserattr`). Keep these cameras in an isolated network / VLAN.

---

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
This tool uses ONVIF-compliant digest authentication with WS-Security headers (password hashed via SHA1 with nonce and timestamp). No plain password is transmitted for ONVIF calls.
Exception: the CamHi CGI extension (Preset900–Preset911, `camhi_*`) uses HTTP Basic authentication (not encrypted).

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

## 📝 Changelog

### 1.2.1 (2026-09-25)
- CamHi / HiSilicon CGI extension rewritten:
  - Virtual presets **Preset900** (read all values raw) and **Preset901–Preset911** (set exactly one value, fire & forget)
  - New actions `camhi_get` (alias `camhi_raw_get`) and `camhi_set_raw` (`--raw`)
  - CGI path fallback for every request (read and set): `/web/cgi-bin/…` first, on error / 404 `/cgi-bin/…`
  - New option `--cgi_port` (default 80). The CGI no longer uses the ONVIF `--port`.
  - Documented fields that must never be set: `poweronpresetindex`, `poweronscanenable`
  - Result per camera: `SUCCESS` (camera answered `[Succeed]`) / `ERROR`
- **Fix:** Smart-Tracking (`Preset901`/`Preset902`, `set_smart_track`) now sets **only** `smartrack_enable`.
  v1.2.0 sent the complete web UI payload and overwrote status LED (`on`), alarm mask (`on`),
  PTZ speed (`1`), cruise laps (`1`) and `movehome` (`off`) on every call.
- **Fix:** virtual presets are recognised as `901` **and** `Preset901` (v1.2.0 only matched `901`,
  `Preset901` was sent as a normal ONVIF GotoPreset).
- Old firmware (no Smart-Tracking command) is now reachable for all other values via the path fallback.

### 1.2.0 (2026-09-24)
- Multi-IP & range support
- Virtual presets Preset901/Preset902 (Smart-Tracking)

---

## 📚 License

MIT or similar – free to use, modify, distribute.

Happy scripting 🎉  
This script was built for developers, integrators, and automation engineers using open, raw SOAP calls – full control, no dependencies!
