# onvif_ptz_controls.js# ONVIF PTZ Control Script
A command-line tool for controlling PTZ cameras via ONVIF (including WS-Security Digest).

## Start command
```bash
node onvif_ptz-control.js --action=<action> [additional parameters]
```

## Required parameters
- `--ip` Camera IP
- `--user` User name
- `--pass` Password
- `--token` (optional, default: MainStreamProfileToken)

## Available actions

### 1. `move`
Move the camera continuously.
bash
--pan=<x> --tilt=<y> [--zoom=<z>] --time=<seconds>

Example:
bash
node onvif_ptz-control.js --action=move --ip=192.168.1.10 --user=admin --pass=1234 --pan=0.5 --tilt=0 --time=1.5

### 2. zoom
Zoom only.
bash
--zoom=<z> --time=<seconds>

### 3. stop
Stop current movement.
bash
node onvif_ptz-control.js --action=stop ...

### 4. goto
Jump to a preset.
```bash
--preset=<token>
```

### 5. `setpreset`
Save current position as a preset.
```bash
--name=<presetName>
```

### 6. `removepreset`
Delete preset.
```bash
--preset=<token>
```

### 7. `presets`
Display all presets.

### 8. `status`
Returns current position.

### 9. `absolutemove`
Absolute positioning.
```bash
--pan=<x> --tilt=<y> [--zoom=<z>]
```

### 10. `relativemove`
Relative movement.
bash
--pan=<x> --tilt=<y> [--zoom=<z>]


### 11. `configoptions`
Displays all PTZ configuration options.

## Notes
- Values ​​for `--pan`, `--tilt`, and `--zoom` can be decimal numbers (`0.5` or `0.5` is possible)
- `--time` is in seconds (e.g., `1.5`)
- Time values ​​may need to be enclosed in quotation marks (depending on the shell)

## Display help
If the script is called without parameters or incompletely, a help page is automatically displayed.


#################################################################################

examples:
root@volumio:/home/onvif # node /home/onvif/onvif_ptz-control.js --help

ONVIF PTZ Control Script - Version 1.0.6 (2025-04-17)

Usage:
 node ptz-control.js --action=<action> --ip=IP --port=PORT --user=USER --pass=PASS [options]

Mandatory parameters:
 --ip, -i IP address of the camera
 --port Port number of the camera service
 --user, -u Username for authentication
 --pass Password for authentication
 --action One of the supported actions listed below

Available actions:
 move --pan=X --tilt=Y [--zoom=Z] --time=N Continuous move for N seconds
 zoom --zoom=Z --time=N Zoom move only for N seconds
 stop Stop all movement (pan/tilt/zoom)
 goto --preset=TOKEN Go to a defined preset
 setpreset --name=NAME Save current position as preset
 removepreset --preset=TOKEN Remove preset by token
 presets List all stored presets
 status Retrieve current PTZ status
 absolutemove --pan=X --tilt=Y [--zoom=Z] Move to an absolute PTZ position
 relativemove --pan=X --tilt=Y [--zoom=Z] Relative PTZ movement
 configoptions Get PTZ configuration options

Optional parameters:
 --token=TOKEN, -k Profile token (default: MainStreamProfileToken)
 --name=NAME, -n Name of the preset (used with setpreset)
 --preset=TOKEN, -e Preset token for goto/removepreset
 --time=SECONDS, -t Duration of the move/zoom action
 --pan=X, -p Pan direction or position value
 --tilt=Y, -i Tilt direction or position value
 --zoom=Z, -z Zoom direction or position value
 --debug=1, -d Print debug output in JSON format
 --verbose=1, -v Show detailed console logs
 --log=1, -l Write logs to system log tagged as 'onvif'
 --mute=1, -m Suppress all output, only return exit code
 --dry-run, -r Simulate request without sending it to the camera
 --help, -h Show this help message and exit
 --version Show script version information and exit

eg:

#right
node /home/onvif/onvif_ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=xxxxx --action=move  --pan=0.5 --tilt=0 --time=1.5 --verbose=1 --log=1

#left
node /home/onvif/onvif_ptz-control.js --ip=172.20.1.194 --port=8080 --user=admin --pass=xxxxx --action=move  --pan=-0.5 --tilt=0 --time=1.5 --verbose=1 --log=1


