# Home Assistant Integration for `onvif_ptz-control.js`

**Version:** 1.0.12  
**Author:** camel/ChatGPT
**Purpose:** Full-featured ONVIF PTZ camera control via shell_command in Home Assistant

---

## 🔧 Requirements

- Node.js (v18+ recommended)
- ONVIF-compatible PTZ camera
- Script: `onvif_ptz-control.js`
- Home Assistant (latest version)
- SSH access from Home Assistant to the host running the script

Install required Node module:
```bash
npm install minimist
```

---

## ⚙️ Configuration Steps

### 1. Copy script to your device (e.g. `/home/onvif/onvif_ptz-control.js`)

Make sure the script has execute permissions:
```bash
chmod +x /home/onvif/onvif_ptz-control.js
```

---

### 2. Add `shell_command` to `configuration.yaml` in Home Assistant

```yaml
shell_command:
  onvif_ptz_control: >
    ssh -o "StrictHostKeyChecking=no" root@localhost
    "/usr/local/nodejs/bin/node /home/onvif/onvif_ptz-control.js --log=1
    --ip={{ ip }} --port={{ port }} --user={{ user }} --pass={{ password }}
    --action={{ action }}
    {% if pan is defined %} --pan={{ pan }}{% endif %}
    {% if tilt is defined %} --tilt={{ tilt }}{% endif %}
    {% if zoom is defined %} --zoom={{ zoom }}{% endif %}
    {% if time is defined %} --time={{ time }}{% endif %}
    {% if preset is defined %} --preset={{ preset }}{% endif %}
    {% if presetname is defined %} --presetname={{ presetname }}{% endif %}
    {% if debug is defined %} --debug={{ debug }}{% endif %}
    {% if verbose is defined %} --verbose={{ verbose }}{% endif %}
    {% if mute is defined %} --mute={{ mute }}{% endif %}"
```

---

### 3. Example Lovelace button configuration

#### Save current position as Preset012:
```yaml
hold_action:
  action: call-service
  confirmation:
    text: Do you really want to save the current position as 12?
  service: shell_command.onvif_ptz_control
  service_data:
    ip: 172.20.1.171
    port: 8080
    user: admin
    password: 1234
    action: setpreset
    presetname: Preset012
```

---

## 🎮 Actions and Examples

- `move` (pan/tilt)
- `zoom` (zoom only)
- `stop` (stop all movement)
- `goto` (go to preset)
- `setpreset` (save current PTZ to preset)
- `removepreset` (delete preset)
- `presets` (list all presets)
- `status` (show current PTZ position)
- `absolutemove` (move to specific PTZ pos)
- `relativemove` (relative move)
- `configoptions` (get config details)

---

## ✅ Notes

- Preset saving uses `--presetname`
- Preset recall/deletion uses `--preset`
- Profile Token defaults to `MainStreamProfileToken`
  - Use ONVIF Device Manager to verify token name

---

## 🧠 Expert Tips

If your camera doesn’t support standard preset ranges (`Preset001` to `Preset256`), use tools like:

- **ONVIF Device Manager**
- **Wireshark** with TCP filter `ip.addr==<camera_ip> && tcp.port==8080`
- Trigger PTZ movements and inspect SOAP payloads

---

Enjoy full ONVIF control from your Home Assistant dashboard!
