# Special ONVIF PTZ Preset Handling – Ctronics & SV3C Cameras

This document provides detailed information on **predefined special PTZ presets** used by IP cameras like **Ctronics** or **SV3C**, which allow you to trigger advanced features (such as tracking, light alarms, or cruise mode) via ONVIF-compatible calls.

---

## ✅ Confirmed Preset IDs (Ctronics)

| Preset ID | Function |
|-----------|----------|
| `37`      | Toggle red/blue light alarm (on/off) |
| `56`      | Start cruise mode (not supported by all models) |
| `92`      | Activate tracking **and set current PTZ position** as guard (tracking) point |
| `94`      | Disable tracking |
| `115`     | Reset PTZ module to **factory defaults**, including all stored presets |

---

## ✅ Confirmed Preset IDs (SV3C)

| Preset ID | Function |
|-----------|----------|
| `67`      | Enable tracking and set guard position |
| `68`      | Disable tracking |

---

## 🚨 Important Behavior

- Preset **115** resets **all PTZ presets**, including user-defined ones (e.g., Preset001 to Preset256).
- Preset **92** on Ctronics allows setting a **new guard/tracking position** by sending the command **at the desired PTZ position**.
- This means **you do NOT need to reset PTZ** just to update the tracking position!

---

## 💡 How to Set a New Tracking Position (Ctronics)

1. Move camera using ONVIF PTZ absolute or relative movement.
2. Send preset **92** using ONVIF `GotoPreset`.
3. The current position becomes the new guard/tracking return point.

> No factory reset required (unless tracking fails to respond).

---

## 🧪 Optional Troubleshooting Tools

You can use the following tools to analyze ONVIF traffic and preset behavior:

- **ONVIF Device Manager** (Windows):  
  Helps send test presets and see responses.
- **Wireshark** (Network Analysis):  
  Use filter:
  ```
  ip.addr == 172.20.1.194 && tcp.port == 8080
  ```
  > Then use "Follow TCP stream" to inspect SOAP bodies sent during preset execution.

---

## ⚙️ Recommended Script Integration

To safely call special presets via your `ptz-control.js`, consider the following examples:

```bash
# Set tracking position to current PTZ
node ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=92

# Disable tracking
node ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=94

# (Dangerous!) Reset PTZ and delete all presets
node ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=1234 --action=goto --preset=115
```

---

## 🔐 Safety Tip

Add confirmation logic before executing Preset **115** to avoid accidental factory resets.  
You can enhance the script to include flags like:

```bash
--preset=115 --confirm
```

---

## 👨‍🔧 Expert Notes

- Preset names such as **Preset001–Preset256** are standard for many ONVIF-compatible devices.
- If these don't work, you may need to discover preset tokens via packet inspection or using ONVIF Device Manager.
- Ensure the profile token (e.g., `MainStreamProfileToken` or `SecondStreamProfileToken`<<) used in requests matches the camera's active video stream profile.
  Note: in Home Assistant the video stream often seen as name: `MainStreamProfile` (for 1st full resolution video stream)
        and `SecondStreamProfile` (for 2nd full resolution video stream).
        As you can see for the *token* only adding to this stream vidoe name the suffix: "token".
        With that you can get the right one if you have different camera's.
        So you get the mostly the right token name (without using the onvif device manager and wireshark to figure that out)
  
---

**Last Updated:** 2025-04-18  
Built for integrators, automation engineers & enthusiasts.

