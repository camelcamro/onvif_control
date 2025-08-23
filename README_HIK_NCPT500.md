# ONVIF Control — ANNKE I81EM (NCPT500) & Hikvision OEM Guide

**Script:** `onvif_control.js` **v1.1.7**  
**Scope:** ANNKE I81EM (_aka_ NCPT500, NightChroma PT) and **Hikvision/OEM** models with comparable ONVIF behavior.  
**Why this guide?** Some ANNKE/Hikvision firmwares expose ONVIF services on **separate endpoints**. If you call `GetProfiles` on the **Device** service, you’ll get *ActionNotSupported*. v1.1.7 fixes this by **discovering Media/PTZ endpoints** first and calling the right service with proper **WS-UsernameToken (PasswordDigest)**.

---

## 1) Quick facts (models & streams)

- The ANNKE **I81EM / NCPT500** is a **Pan/Tilt** camera (**no optical zoom**). PTZ API provides *Pan*/*Tilt*; **Zoom** commands have no optical effect.
- Typical RTSP paths (Hikvision/ANNKE OEM):
  - **Main stream:** `rtsp://USER:PASS@CAM_IP/Streaming/Channels/101`
  - **Sub stream:**  `rtsp://USER:PASS@CAM_IP/Streaming/Channels/102`
- ONVIF services used by the tool:
  - **Device:** `ver10/device/wsdl` (for discovery, device ops)
  - **Media:**  `ver20/media/wsdl` (preferred) or `ver10/media/wsdl` (fallback)
  - **PTZ:**    `ver20/ptz/wsdl`

> **Hikvision relevance:** Many Hikvision and Hik-OEM firmwares behave the same way: Media v2 **(`…/ver20/media/wsdl`)** exists and must be called on its own **XAddr**. This guide applies equally to those devices.

---

## 2) Prerequisites on the camera

1. **Enable ONVIF** in the web UI.  
2. Create a **dedicated ONVIF user** (username/password). Some firmwares separate ONVIF users from admin users.  
3. **Time sync**: Camera and client must be within **±5 minutes** to satisfy **WS-UsernameToken (PasswordDigest)**.  
4. Optional but recommended: **HTTPS on**, **UPnP off**, strong passwords.

---

## 3) New workflow (v1.1.7)

### A) Discover service endpoints (NEW: `get_services`)
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_services --debug
```
Output (example):
```json
{
  "media2": "http://192.168.1.36/onvif/Media2",
  "media1": "http://192.168.1.36/onvif/Media",
  "ptz":    "http://192.168.1.36/onvif/PTZ"
}
```

### B) Get profiles (now calls **Media**, not Device)
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_profiles --debug
# → picks Media2 when available, else Media1
```

### C) PTZ presets & moves (require a **ProfileToken** from `get_profiles`)
```bash
# List presets
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_presets --token=Profile_1

# Create a preset (returns a PresetToken)
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=setpreset --token=Profile_1 --presetname=Home

# Go to preset
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=goto --token=Profile_1 --preset=<TOKEN_FROM_setpreset>

# Continuous Pan/Tilt for N seconds (then auto-stop)
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=move --token=Profile_1 --pan=0.4 --tilt=0.0 --time=2
```

### D) Stream & snapshot URIs (via Media service)
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_stream_uri
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX --action=get_snapshot_uri
```

---

## 4) Common pitfalls & fixes

- **ActionNotSupported / InvalidOperation** on `GetProfiles`  
  → You’re hitting **Device** instead of **Media**. Use **v1.1.7** and/or run `get_services` first.
- **401 / NotAuthorized**  
  → Ensure **WS-UsernameToken (PasswordDigest)** is used (the script does it). Check **time sync** and the **ONVIF user credentials**.
- **Empty presets**  
  → Normal on a fresh device. Use `setpreset` to create one, then `get_presets` again.
- **Zoom has no effect**  
  → The I81EM/NCPT500 is **PT-only** (no optical zoom). Zoom commands won’t change the view.
- **Camera exposes only Media1**  
  → The tool falls back to **Media v1** automatically.
- **Events/Analytics quirks**  
  → Some Hik/ANNKE firmwares expose events/analytics on other endpoints; the tool keeps the conservative Device path for backward compatibility.

---

## 5) Hikvision OEM note (ISAPI fallback)

If ONVIF PTZ is blocked by firmware policy, some Hik/ANNKE devices still accept **ISAPI** calls (not guaranteed; firmware-dependent):

- Continuous PT: `POST http://CAM_IP/ISAPI/PTZCtrl/channels/1/continuous`  
  Body: `<PTZData><pan>0.4</pan><tilt>0.0</tilt><zoom>0.0</zoom></PTZData>`
- Goto preset: `POST http://CAM_IP/ISAPI/PTZCtrl/channels/1/presets/1/goto`

Use ONVIF whenever possible; ISAPI is a practical **fallback** only.

---

## 6) Security checklist

- Change **admin** & **ONVIF** passwords.  
- Disable **UPnP**, avoid direct Internet exposure.  
- Allow only required ports on LAN/WAN firewalls.  
- Create least-privileged **ONVIF user** for NVR/HA.

---

## 7) Changelog relevant to this guide (v1.1.7)

- Added **`get_services`** action (Device → **GetServices**) to discover **XAddr** for Media2/Media1/PTZ.  
- `get_profiles` now calls **Media** (prefers **ver20**, falls back to **ver10**).  
- PTZ actions route to the discovered **PTZ XAddr**.  
- Keeps all previous CLI actions/flags intact (backwards compatible).

---

## 8) FAQ

**Q:** Do preset names/tokens exist by default?  
**A:** Not universally. Tokens are firmware-specific and returned at runtime. Create your own with `setpreset`.

**Q:** My camera worked before without WS-UsernameToken. Will this break?  
**A:** No. The header is widely accepted. If your device ignores it, calls still succeed.

**Q:** Can I use HTTPS?  
**A:** Yes, if your camera offers it. (The default examples use HTTP to match many OEM defaults.)

---

**Happy debugging!** If you run into a device that still returns `ActionNotSupported` on Media calls, paste the output of:
```
node onvif_control.js --ip=... --port=... --user=... --pass=... --action=get_services --debug
```
and your `get_profiles --debug` response to analyze the namespaces/XAddrs.
