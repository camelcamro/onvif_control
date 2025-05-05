
# ONVIF PTZ Control Script

**Version:** 1.0.14  
**Build Date:** 2025-04-29 
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

### ✅ Requirements

- **Node.js** (>= 18.x)  
- **npm**  
- **Network access** to ONVIF-compatible camera  
- **Linux with logger** command (for system log support)
- **minimist** installed in same directy as where the *onvif_ptz-controls.js* file is located (see section: Setup) 
 
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

download *onvif_ptz-control.js* to your host
(note: If needed install "node" and "minimist" (needs to be installed also in the same folder as script gfile will be running)
(see "Install" sections)

1. Place `onvif_ptz-control.js` in eg: `/home/onvif/`
2. Make sure the script is executable:

```bash
chmod +x /home/onvif/onvif_ptz-control.js
```

3. Install minimist also in the same folder as your script is located:

```bash
cd /home/onvif
sudo npm install -g minimist
```

---

4. Invoke script using `node`:

```bash
node /home/onvif/onvif_ptz-control.js --ip=172.20.1.194 --port=8080 ...
```

---

## 🚀 Basic Usage

### Mandatory Parameters
| Option     | Alias | Description                                      |
|------------|-------|--------------------------------------------------|
| `--ip`     | `-i`  | IP of camera                                     |
| `--port`   |       | Port of ONVIF service (e.g. 8080)                |
| `--user`   | `-u`  | Username                                         |
| `--pass`   |       | Password                                         | 
| `--action` |       | Action to perform (`move`, `zoom`, `goto`, etc.) |

### Optional Parameters
| Option                     | Alias | Description                                                      |
|----------------------------|--------------------------------------------------------------------------|
| `--token`                  | `-k`  | Profile token (default: `MainStreamProfileToken`)                |
| `--pan`                    | `-p`  | Pan direction/position (-1.0 to 1.0)                             |
| `--tilt`                   | `-i`  | Tilt direction/position (-1.0 to 1.0)                            |
| `--zoom`                   | `-z`  | Zoom direction/position (-1.0 to 1.0)                            |
| `--preset=<PRESETNAME>`    | `-e`  | Preset token (used with `goto`, `removepreset`)                  |
| `--presetname=<PRESETNAME>`| `-n`  | Preset name (used with `setpreset`)                              |
| `--time`                   | `-t`  | Duration in seconds (for movement/zoom)                          |
| `--wakeup`                 |       | Send full wakeup before (GetNodes, GetConfigurations, GetPresets)|
| `--wakeup_simple`          |       | Send simple wakeup before (GetDeviceInformation only)            |
| `--verbose`                | `-v`  | Enable verbose output                                            |
| `--debug`                  | `-d`  | Show debug JSON                                                  |
| `--dry-run`                | `-r`  | Show parameters but do not send SOAP                             |
| `--log`                    | `-l`  | Write to system log                                              |
| `--mute`                   | `-m`  | Suppress all output except return code                           |
| `--help`                   | `-h`  | Show usage                                                       |
| `--version`                |       | Show version info                                                |
---

## 📚 Examples

Assume script is located at `/home/onvif/onvif_ptz-control.js`

---

## 🧪 Movements & Zoom

### Move Right (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0.5 --tilt=0 --time=1.5
```

### Move Left (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=-0.5
```

### Move Up (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0 --tilt=0.5
```

### Move Down (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=move --pan=0 --tilt=-0.5
```

### Zoom In (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=0.5 --time=1.5
```

### Zoom Out (1.5s)
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=zoom --zoom=-0.5 --time=1.5
```

---

## 🧪 Goto, Save, Delete Preset
### Save Preset
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=setpreset --presetname=Preset005
```

### Go to Preset
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=Preset005
```

### Remove Preset
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=removepreset --preset=Preset005
```

---

## 🧪 Status, Configs & Listing
### List Presets
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=presets
```

### Get PTZ Status
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=status
```

### Get PTZ Config Options
```bash
node /home/onvif/onvif_ptz-control.js --ip=172.2.1.194 --port=8080 --user=admin --pass=1234 --action=configoptions
```

---

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
