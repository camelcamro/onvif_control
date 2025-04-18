# ONVIF PTZ Control Script

## Version: 1.0.11  
## Build Date: 2025-04-17  

---

## 📦 Features

- Full PTZ control (move, zoom, stop, presets, absolute/relative move, status)
- WS-Security Digest (compatible with ONVIF password authentication)
- Standalone – does **not** require `onvif-cli` or any ONVIF SDK
- Logs to console + optional `syslog`
- Fully scriptable & automatable via CLI

---

## 🔧 Requirements

- Node.js (≥ v14)
- `minimist` installed via:

```bash
npm install minimist
```

---

## 🚀 Script Setup

```bash
mkdir -p /home/onvif
mv onvif_ptz-control.js /home/onvif/
npm install minimist
```

---

## ⚙️ Usage

```bash
node /home/onvif/onvif_ptz-control.js --ip=<IP> --port=<PORT> --user=<USERNAME> --pass=<PASSWORD> --action=<ACTION> [options]
```

---

## ✅ Required Parameters

| Parameter  | Alias | Description                |
|------------|-------|----------------------------|
| `--ip`     | `-i`  | IP of the ONVIF device     |
| `--port`   |       | Port of ONVIF service (e.g. 8080) |
| `--user`   | `-u`  | Username for login         |
| `--pass`   |       | Password for login         |
| `--action` |       | Action to perform          |

---

## 🔄 Available Actions

| Action        | Required Parameters                                |
|---------------|----------------------------------------------------|
| `move`        | `--pan`, `--tilt`, `--time`                        |
| `zoom`        | `--zoom`, `--time`                                 |
| `stop`        | *(none)*                                           |
| `goto`        | `--preset`                                         |
| `setpreset`   | `--name`                                           |
| `removepreset`| `--preset`                                         |
| `presets`     | *(none)*                                           |
| `status`      | *(none)*                                           |
| `absolutemove`| `--pan`, `--tilt` *(optional: `--zoom`)*           |
| `relativemove`| `--pan`, `--tilt` *(optional: `--zoom`)*           |
| `configoptions`| *(none)*                                         |

---

## 🛠️ Optional Flags

| Flag           | Alias | Description                                     |
|----------------|-------|-------------------------------------------------|
| `--token`      | `-k`  | Profile token (default: `MainStreamProfileToken`) |
| `--preset`     | `-e`  | Preset token                                    |
| `--name`       | `-n`  | Preset name for saving                          |
| `--time`       | `-t`  | Duration in seconds                             |
| `--pan`        | `-p`  | Pan speed or position (float: -1 to 1)          |
| `--tilt`       | `-i`  | Tilt speed or position (float: -1 to 1)         |
| `--zoom`       | `-z`  | Zoom speed or level (float: -1 to 1)            |
| `--verbose`    | `-v`  | Verbose output                                  |
| `--debug`      | `-d`  | Show parsed parameters                          |
| `--log`        | `-l`  | Write logs to `syslog` with tag `onvif`         |
| `--dry-run`    | `-r`  | Don’t send commands, only show output           |
| `--mute`       | `-m`  | Suppress all output except exit code            |
| `--help`       | `-h`  | Show help                                       |
| `--version`    |       | Show version                                    |

---

## 📸 Example Calls (IP `172.2.1.194`, port `8080`, user: `admin`, pass: `1234`)

```bash
# ▶ Move Right
--action=move --pan=0.5 --tilt=0 --time=1.5

# ◀ Move Left
--action=move --pan=-0.5 --tilt=0 --time=1.5

# ▲ Move Up
--action=move --pan=0 --tilt=0.5 --time=1.5

# ▼ Move Down
--action=move --pan=0 --tilt=-0.5 --time=1.5

# 🔍 Zoom In
--action=zoom --zoom=0.5 --time=1.5

# 🔎 Zoom Out
--action=zoom --zoom=-0.5 --time=1.5

# ⏹ Stop
--action=stop

# 🎯 Goto Preset
--action=goto --preset=Preset005

# 💾 Set Preset
--action=setpreset --name=EntryView

# ❌ Remove Preset
--action=removepreset --preset=Preset005

# 📋 List All Presets
--action=presets

# 🛰️ Get PTZ Status
--action=status

# 📐 Absolute Move
--action=absolutemove --pan=0.3 --tilt=0.2 --zoom=0.4

# ↔️ Relative Move
--action=relativemove --pan=0.2 --tilt=0 --zoom=0.1

# ⚙️ Get PTZ Config
--action=configoptions
```

---

## 🛡️ Security Note
This tool uses ONVIF-compliant digest authentication with WS-Security headers (password hashed via SHA1 with nonce and timestamp). No plain password is transmitted.--version Show script version information and exit

eg:

#right
node /home/onvif/onvif_ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=xxxxx --action=move  --pan=0.5 --tilt=0 --time=1.5 --verbose=1 --log=1

#left
node /home/onvif/onvif_ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=xxxxx --action=move  --pan=-0.5 --tilt=0 --time=1.5 --verbose=1 --log=1


