
# ONVIF 101 – Getting Your Profile Token and Preset List  
*A beginner‑friendly, copy‑&‑paste guide*

---

## Why you even need a “Profile Token”

When an ONVIF‑compatible camera (or NVR) streams video it can expose **multiple “media profiles”** – e.g.

* **Main Stream** – full resolution, high bit‑rate  
* **Sub Stream** – low resolution for mobile / AI analysis  
* **JPEG Snapshot** – still image only

Internally ONVIF identifies each profile with a **`token`** string that never changes, while the human‑readable name can be edited in the web UI.  
Whenever you call a PTZ, snapshot or encoder command you must specify **which profile** – that’s why most tools ask for a *ProfileToken*.

---

## What are “Presets”?

A PTZ‑preset stores pan/tilt/zoom coordinates under a short name (“FrontDoor”, „Preset 001“…).  
Tokens and names work exactly like for profiles:

* **Token** → fixed ID, required when you send a `goto` command  
* **Name** → label you can change in the camera UI

---

## Prerequisites

1. **Node JS** ≥ 14  
2. This repository cloned (the script lives in `onvif_control.js`).  
3. Camera IP & ONVIF port (often 80, 8080 or 8899).  
4. Login **only** if your camera enforces authentication; otherwise you can omit `--user / --pass`.

---

## 1 – Discover your Profile Tokens

### 1‑a) Full verbose listing

```bash
node onvif_control.js \
  --ip=192.168.1.100 --port=8080 \
  --user=admin --pass=admin \
  --action=get_profiles --debug
```

*What you see (excerpt)*

```xml
<tmedia:Profiles token="MainStreamProfileToken">
  <tt:Name>MainStream</tt:Name>
  …
</tmedia:Profiles>

<tmedia:Profiles token="SubStreamProfileToken">
  <tt:Name>SubStream</tt:Name>
  …
</tmedia:Profiles>
```

### 1‑b) Quick “just the tokens please”  
*(Copy–paste ready)*

```bash
node onvif_control.js --ip=192.168.1.100 --action=get_profiles | \
  grep -o 'token="[^"]*"' | cut -d'"' -f2
```

Output:

```
MainStreamProfileToken
SubStreamProfileToken
```

---

## 2 – List presets for one profile

1. Pick the **profile token** you need (e.g. `MainStreamProfileToken`).  
2. Run:

```bash
node onvif_control.js --ip=192.168.1.100 \
  --action=get_presets --token=MainStreamProfileToken --debug
```

Example response:

```xml
<tptz:Preset token="Preset001">
  <tt:Name>Entrance</tt:Name>
</tptz:Preset>
<tptz:Preset token="Preset002">
  <tt:Name>Carport</tt:Name>
</tptz:Preset>
```

### Short version – one line, token + name

```bash
node onvif_control.js --ip=192.168.1.100 \
  --action=get_presets --token=MainStreamProfileToken | \
  grep -E 'tptz:Preset token|tt:Name' | sed 'N;s/\n/ /'
```

Output:

```
<tptz:Preset token="Preset001">  <tt:Name>Entrance</tt:Name>
<tptz:Preset token="Preset002">  <tt:Name>Carport</tt:Name>
```

---

## 3 – Using the results

| Task | Command |
|------|---------|
| Move to a preset | `node onvif_control.js --action=goto --token=MainStreamProfileToken --preset=Preset001` |
| Save current PTZ position as preset 003 | `node onvif_control.js --action=setpreset --token=MainStreamProfileToken --presetname="Gate"` |
| Delete preset 002 | `node onvif_control.js --action=removepreset --token=MainStreamProfileToken --preset=Preset002` |

---

## FAQ & Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` / 401 | Provide `--user` and `--pass`. |
| Empty preset list | Some cameras store presets *per profile*. Make sure you queried the right token. |
| `NoToken` error | The profile token you passed does not exist on this device. |
| Which ONVIF port? | Popular defaults: 80 (HI3516), 8080 (XM), 8899 (Dahua). Check the web UI or ONVIF Device Manager. |
| Discover IP/Port | Use ONVIF‑DM on Windows/Linux or the “Discover” feature in tinyCam / VLC. |

---

## Helpful tools

* **ONVIF Device Manager** (Windows/Linux, free) – GUI that lists tokens & presets.  
* **VLC Media Player** – can open `rtsp://<ip>/` once you know the profile path.  
* **nmap –sV** – finds ONVIF ports if you’re unsure.

---

> *That’s it!* You now know how to fetch Profile Tokens, list presets, and plug those values back into any ONVIF command.
