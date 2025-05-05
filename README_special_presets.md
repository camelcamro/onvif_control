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


# Ctronics PTZ 5 MP (C6F0SoZ3N0PcL2) – Camera Command Codes

Diese Kamera unterstützt spezielle Steuerbefehle, um Funktionen wie Alarmlichter, Guard-Modus, Patrol oder IR-Steuerung zu aktivieren. Untenstehend eine Übersicht der unterstützten Codes und deren Bedeutung.

## 📋 Befehlstabelle

| Funktion         | Code | Call         | Setup | Bemerkung                       |
|------------------|------|--------------|-------|----------------------------------|
| Red/Blue lights  | 37   | ON           | OFF   | Alarmlichter an/aus             |
| Guard            | 92   | ON / ACTIVATE| SET   | Aktiviert Guard-Modus           |
| Guard            | 115  | CLEAR        |       | Guard-Modus löschen             |
| Guard            | 91   | OFF          |       | Deaktiviert Guard-Modus         |
| Patrol           | 56   | ON           | OFF   | Folge Presets (1, 2, 3, ...)    |
| IR               | 82   | ON           |       | Infrarot einschalten            |
| IR               | 83   | OFF          |       | Infrarot ausschalten            |
| IR               | 81   | AUTO         |       | Automatische IR-Auswahl         |

## 📝 Hinweise

- Alle Codes gelten für das Modell **Ctronics PTZ 5 MP** mit Kennung **C6F0SoZ3N0PcL2**
- Die Steuerung kann je nach Software per HTTP-API, Shell-Script oder App ausgelöst werden.
- Die Verwendung von `Setup`-Werten ist abhängig vom Kameramodell bzw. der Firmwareversion.



---

## ✅ Confirmed Preset IDs (SV3C)

| Preset ID | Function |
|-----------|----------|
| `67`      | Enable tracking and set guard position |
| `68`      | Disable tracking |

---

# Special ONVIF Preset Commands for IP Cameras

This document provides a comprehensive list of special preset codes used by various IP camera manufacturers. These codes are used to trigger specific camera functions like enabling/disabling human tracking, activating cruise mode, toggling alarms, or performing PTZ resets. Most of these commands are not officially documented in ONVIF specifications and are proprietary.

---

## 📋 Summary & other Infos about Special Preset Codes for IP Cameras

| Manufacturer         | Preset Code | Description |
|----------------------|-------------|-------------|
| **Ctronics**         | `37`        | Toggles red and blue light alarm. When a person is detected, the lights flash alternately as a warning. |
|                      | `56`        | Activates cruise mode, moving the camera through predefined presets. |
|                      | `92`        | Sets the current position as the guard position and activates human tracking. The camera will return here after tracking. |
|                      | `94`        | Deactivates human tracking. |
|                      | `115`       | Resets the PTZ settings to factory defaults, including all presets. |
| **SV3C**             | `67`        | Sets the current position as the guard position and activates human tracking. |
|                      | `68`        | Deactivates human tracking. |
| **Generic IP Cameras** | `65+SET`, then `X+SET` | Sets the guard position to preset point #X. For example, `65+SET`, then `5+SET` sets guard position to preset 5. |
|                      | `65         | Starts cruise patrol from presets 1 to 8, with ~5 seconds interval. |
|                      | `66`        | Starts cruise patrol from presets 9 to 16, with ~10 seconds interval. |
|                      | `67`        | Starts cruise patrol from presets 17 to 24, with ~15 seconds interval. |
|                      | `68`        | Starts cruise patrol from presets 25 to 32, with ~20 seconds interval. Also used for power-on preset. |
|                      | `69`        | Starts cruise patrol from presets 33 to 40, with ~30 seconds interval. |
|                      | `70`        | Starts cruise patrol from presets 41 to 48, with ~60 seconds interval. |
|                      | `72`        | Starts cruise patrol from presets 49 to 56, with ~90 seconds interval. |
|                      | `73`        | Starts cruise patrol from presets 57 to 64, with ~120 seconds interval. |
|                      | `74`        | Turns off colored night vision and enables IR light. |
|                      | `75`        | Turns off colored night vision and enables IR auto mode. |
|                      | `76`        | Enables color night vision without white light. Turns off IR manually. |
|                      | `77`        | Initiates gimbal reset; moves the camera to top-left for self-check. |

| **HiSilicon-based**  | `84`        | Opens the On-Screen Display (OSD) menu. |
|                      | `88`        | Toggles light settings (IR/White), depending on the model. |
|                      | `95`        | Similar function to OSD; model-dependent. |
|                      | `123`       | Variant OSD or config menu call. |
| **Sunba**            | `84 + Add Preset` | Sets a pattern scan; use direction and zoom keys, then Iris+ to complete. |
|                      | `95 + CALL` | Calls the preset to open the OSD menu. |
| **ESUNSTAR**         | `150 + SET + X + SET` | Modifies horizontal tracking speed. X=1-10 (1=slowest, 10=fastest). |

---

**Note:** The availability and effect of these preset codes may vary based on firmware version, camera series, or manufacturer. Always refer to your camera’s documentation or contact support if uncertain.

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

