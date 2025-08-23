# ONVIF 101 — Getting your Profile **Token** & **Preset** list (v1.1.7)

*Copy‑&‑paste guide, updated for ANNKE/Hikvision/OEM devices that expose Media/PTZ on separate XAddr endpoints.*

---

## Why you need a **ProfileToken** (and how presets relate)

- A camera can expose multiple **media profiles** (main/sub, JPEG snapshot, etc.). Each profile has a **ProfileToken** (stable ID) and an optional **name/label** (editable).
- PTZ commands are profile‑scoped. That’s why most tools need a **`--token`** (the **ProfileToken**).
- **Presets** store PTZ coordinates and also have **PresetTokens** (stable IDs) and **names** (labels). *Use tokens for control commands; names are just human readable.*

---

## Quick prerequisites (especially for Hik/ANNKE/OEM)

1) **Enable ONVIF** in the camera UI.  
2) Create a **dedicated ONVIF user** (some firmwares separate this from the web admin user).  
3) Keep **time sync** within **±5 minutes** between client and camera (required for WS‑UsernameToken/PasswordDigest).  
4) Know the ONVIF **port** (often `80`, `8080`, or vendor‑specific).

> ANNKE I81EM / NCPT500 and many Hikvision OEMs expose **Media v2** at `/onvif/Media2`, **Media v1** at `/onvif/Media`, and **PTZ** at `/onvif/PTZ`. Don’t call `GetProfiles` on the **Device** service — it will fault with `ActionNotSupported`.

---

## Step 0 — **Discover** the correct XAddr endpoints (NEW in v1.1.7)

```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_services --debug
```
**Expected output (JSON):**
```json
{
  "media1": "http://192.168.1.36/onvif/Media",
  "media2": "http://192.168.1.36/onvif/Media2",
  "ptz":    "http://192.168.1.36/onvif/PTZ"
}
```
- The tool will later **prefer `media2`** (Media v2). If absent, it **falls back to `media1`** (Media v1).

---

## Step 1 — Get **ProfileTokens**

### A) Clean JSON output (default in v1.1.7)
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 \
  --user=admin --pass=XXXXX --action=get_profiles
```
Example:
```json
{
  "mediaXAddr": "http://192.168.1.36/onvif/Media2",
  "mediaVersion": "ver20",
  "profileTokens": ["Profile_1","Profile_2"]
}
```
**Just the tokens (with jq):**
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_profiles | jq -r '.profileTokens[]'
```

**Without jq (POSIX grep/cut):**
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_profiles | grep -oE '"profileTokens":\s*\[[^]]*\]' | \
  sed -E 's/.*\[(.*)\].*/\1/' | tr -d '"' | tr ',' '\n' | sed '/^\s*$/d'
```

### B) Raw XML view (for debugging)
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 \
  --user=admin --pass=XXXXX --action=get_profiles --debug
```
Look for elements like:
```xml
<tt:Profile token="Profile_1">
  <tt:Name>MainStream</tt:Name>
</tt:Profile>
```

> **If you see `ActionNotSupported`** here, you hit **Device** instead of **Media** — run `get_services` and retry; v1.1.7 routes to Media automatically.

---

## Step 2 — List **Presets** (per profile)

Choose the **ProfileToken** (e.g. `Profile_1`) and run:
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 \
  --user=admin --pass=XXXXX --action=get_presets --token=Profile_1
```
Example JSON (tool output may vary by vendor):
```json
{ "presets": [ {"token":"Preset001","name":"Entrance"},
               {"token":"Preset002","name":"Carport"} ] }
```

**Only tokens + names (jq):**
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_presets --token=Profile_1 | jq -r '.presets[] | "\(.token)\t\(.name)"'
```

**Without jq (grep/sed):**
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 --user=admin --pass=XXXXX \
  --action=get_presets --token=Profile_1 | \
  grep -E '"token"|"name"' | tr -d '",' | awk '{print $2}' | paste - -
# token  name
# Preset001  Entrance
# Preset002  Carport
```

**Raw XML (debug mode):**
```bash
node onvif_control.js --ip=192.168.1.36 --port=80 \
  --user=admin --pass=XXXXX --action=get_presets --token=Profile_1 --debug
```
Look for:
```xml
<tptz:Preset token="Preset001"><tt:Name>Entrance</tt:Name></tptz:Preset>
```

---

## Step 3 — Use the tokens

| Task | Command |
|------|--------|
| **Go to preset** | `node onvif_control.js --action=goto --token=Profile_1 --preset=Preset001 --ip=... --port=... --user=... --pass=...` |
| **Create preset** | `node onvif_control.js --action=setpreset --token=Profile_1 --presetname="Home" --ip=... --port=... --user=... --pass=...` |
| **Delete preset** | `node onvif_control.js --action=removepreset --token=Profile_1 --preset=Preset001 --ip=... --port=... --user=... --pass=...` |
| **Continuous move 2s** | `node onvif_control.js --action=move --token=Profile_1 --pan=0.4 --tilt=0.0 --time=2 --ip=... --port=... --user=... --pass=...` |

> **Note for ANNKE I81EM / NCPT500:** PT‑only (no optical zoom). ONVIF `Zoom` won’t change optics on this model.

---

## Troubleshooting (targets Hikvision/ANNKE/OEM specifics)

| Symptom | Likely cause | Fix |
|---|---|---|
| `ActionNotSupported` or `InvalidOperation` on `GetProfiles` | Called **Device** instead of **Media** | Run `get_services`, then `get_profiles` (v1.1.7 does this automatically). |
| `401` / `NotAuthorized` | WS‑UsernameToken digest rejected | Ensure ONVIF user exists and **time is synced ±5 min**. |
| Preset list is empty | No presets yet / wrong profile | Create one with `setpreset` and use the correct **ProfileToken**. |
| PT moves don’t work | Wrong **ProfileToken** or mechanical limits | Use a token from `get_profiles`; try `relativemove` away from limits. |
| Zoom has no effect | PT‑only hardware (no optics) | Normal on NCPT500/I81EM. |
| Streams OK but ONVIF fails | RTSP accepts basic auth; SOAP needs WSSE | v1.1.7 uses WSSE; verify time sync and ONVIF user. |

---

## Cheatsheet

- **Discovery:** `get_services` → confirms **Media2/Media1/PTZ** XAddrs.  
- **Profiles:** `get_profiles` → choose **ProfileToken** for any PTZ/media command.  
- **Presets:** `get_presets --token=<ProfileToken>` → read **PresetTokens** (+ names).  
- **Control:** `goto`, `setpreset`, `removepreset`, `move`, `absolutemove`, `relativemove`, `stop`.  
- **Streams:** `get_stream_uri`, `get_snapshot_uri` (RTSP/JPEG).

That’s it — you can now reliably obtain **ProfileTokens** and **PresetTokens** on **Hikvision/ANNKE** and similar OEM firmwares using the **discovery‑first** flow in v1.1.7.
