# nvr_dvrip tools

Six small Python tools to diagnose and control **XMEye NVRs** over their native
**DVRIP / Sofia protocol (TCP 34567)**, without the web UI or the VMS client.
They were built for a setup with 28 ONVIF cameras and four identical NVRs, of which
exactly one records at a time, and the others keep a frozen archive.

| Tool | Version | Writes to the NVR? | Purpose |
|---|---|---|---|
| `nvr_dvrip_probe.py` | 1.2 | no | first contact: login variants, system info, which channel configs exist |
| `nvr_dvrip_storage.py` | 1.1 | no | hard disk / storage diagnosis, NVR log (disk errors, shutdowns, reboots) |
| `nvr_dvrip_chancfg.py` | 1.2 | no | time settings and channel configuration, fields that differ between channels |
| `nvr_dvrip_chanstate.py` | 1.2 | no | live channel state: connected / login failed / recording / record plan |
| `nvr_dvrip_power.py` | 1.3 | **yes** (shutdown / reboot) | clean shutdown before power cut, soft reboot, state check |
| `nvr_dvrip_setcred.py` | 1.8 | **yes** (channel config) | camera user/password per channel, enable channels, repair connection id, restore |

All tools need **Python 3 only** (standard library, no extra packages), so they run
on a Raspberry Pi, a Linux server or directly inside the Home Assistant container.

---

## Contents

1. [Common behaviour](#1-common-behaviour)
2. [Installation](#2-installation)
3. [The tools in detail](#3-the-tools-in-detail)
   - [nvr_dvrip_probe](#31-nvr_dvrip_probe)
   - [nvr_dvrip_storage](#32-nvr_dvrip_storage)
   - [nvr_dvrip_chancfg](#33-nvr_dvrip_chancfg)
   - [nvr_dvrip_chanstate](#34-nvr_dvrip_chanstate)
   - [nvr_dvrip_power](#35-nvr_dvrip_power)
   - [nvr_dvrip_setcred](#36-nvr_dvrip_setcred)
4. [Workflows](#4-workflows)
5. [Firmware findings](#5-firmware-findings)
6. [Troubleshooting](#6-troubleshooting)
7. [Version history](#7-version-history)

---

## 1. Common behaviour

All six tools share the same command line style, login handling and output rules.

### Command line

```
python3 nvr_dvrip_<tool>.py <nvr_ip> [mode] [--option=value] [--flag] [-v]
```

| Option | Meaning |
|---|---|
| `--nvr_user=X` | NVR login user. Default: taken from the table `NVR_USERS` (by NVR IP) at the top of each tool, else `admin` |
| `--nvr_pass='Y'` | NVR login password. Default: environment variable `NVR_PASS` |
| `-v`, `--verbose` | print every DVRIP request and answer (passwords masked) |
| `-h`, `--help` | full help of the tool: every argument, option and return code |

Unknown options are rejected (return code 2), nothing is silently ignored.
Put quotes around passwords that contain special characters: `--nvr_pass='a$b'`.

### Passwords

**No password is stored in the tools.** The NVR password comes from `--nvr_pass`
or from the environment variable `NVR_PASS`. Without either, the tool stops with
return code 2 before it connects.

For daily use on the Pi, set it once in the shell profile, so every tool can be
called with the IP only:

```bash
# ~/.bashrc of the user that runs the tools (file is only readable by that user)
export NVR_PASS='...'
```

```bash
python3 nvr_dvrip_chanstate.py 172.20.1.213
```

Passwords are never printed: output and JSON files show `***(n)` (n = length).
**Exception:** the backup files written by `nvr_dvrip_setcred.py`
(`nvr_backup_<ip>_<time>.json`) contain the camera passwords in clear text, because
they must be restorable. Keep them local.

### Default NVR users

Defined in `NVR_USERS` at the top of every tool (change it there when an NVR is
added or a user changes):

| NVR | IP | Default user |
|---|---|---|
| NVR1 | 172.20.1.211 | mxrs |
| NVR2 | 172.20.1.212 | cbdy |
| NVR3 | 172.20.1.213 | wyad |
| NVR4 (spare) | 172.20.1.214 | admin |

### Output

- First line: tool name, version, NVR IP and user.
- `[OK]`, `[--]` (not available / skipped), `[ERR]` mark the result of each step.
- **Last line: `RESULT tool=<name> rc=<code> key=value ...`**, one line, no spaces
  inside values, made for scripts (Home Assistant, Nagios, shell):

  ```bash
  python3 nvr_dvrip_chanstate.py 172.20.1.213 | tail -1
  # RESULT tool=chanstate rc=0 connected=28 recording=28 used=28 nologin=0 missing=- notrec=- noplan=-
  ```

### Return codes

| Code | Meaning (all tools) |
|---|---|
| 0 | OK |
| 1 | connection, login, read or write error |
| 2 | usage error (unknown option, missing argument, no password) |
| 3, 4, 5, 6 | tool specific, see each tool |

### Protocol notes

- DVRIP: 20-byte header (`<BB2xII2xHI`: head 0xFF, version, session, sequence,
  message id, length) followed by JSON.
- Login: message 1000, `EncryptType MD5`, `LoginType DVRIP-Web`, password as
  "Sofia hash" (MD5, folded to 8 characters).
- Message ids used: 1020 info (SystemInfo, StorageInfo, WorkState), 1042 config
  get, 1040 config set, 1442 log query, 1450 OPMachine (Shutdown / Reboot).
- `Ret` 100 = OK, 515 = OK (restart needed), 102 = not supported, 203/205 = wrong
  user or password, 603 = saved, restart needed, 607 = config not available.

---

## 2. Installation

Copy the six `.py` files to a directory on a machine that can reach the NVRs on
TCP 34567. Nothing has to be installed.

| Place | Path | Used for |
|---|---|---|
| Raspberry Pi (manual tests) | `/usr/local/bin/onvif/` | calls from the shell |
| Home Assistant | `/config/nvr_dvrip/` | direct calls from `shell_command` (python3 is in the HA container) |
| onvif_control project | `nvr_dvrip/` | copy of the tools + this README |

```bash
cd /usr/local/bin/onvif
chmod +x nvr_dvrip_*.py
python3 nvr_dvrip_power.py -h        # check: shows the help
```

Home Assistant example (password from `secrets.yaml`, output to a file that an
automation or script can read):

```yaml
shell_command:
  nvr_chanstate: >-
    python3 /config/nvr_dvrip/nvr_dvrip_chanstate.py {{ nvr_ip }}
    --nvr_user={{ nvr_user }} --nvr_pass='{{ nvr_pass }}' --wait=180
    > /config/tmp/nvr_chanstate.txt 2>&1; echo RC=$? >> /config/tmp/nvr_chanstate.txt
```

---

## 3. The tools in detail

### 3.1 nvr_dvrip_probe

**Read-only.** First contact with an unknown NVR / firmware: does the login work,
which model and firmware is it, and under which config name does it keep the list
of digital channels.

```
python3 nvr_dvrip_probe.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--json] [-v]
```

| Option | Meaning |
|---|---|
| `--json` | also write `nvr_probe_<ip>.json` with every answer (passwords masked) |

What it does:

1. Login, tries up to three variants: `MD5 + DVRIP-Web`, `MD5 + DVRIP-Xm030`,
   `plain + DVRIP-Web`. Stops at once on "user locked" (205-207); too many wrong
   logins can lock the account for a while.
2. Reads `SystemInfo` (model, firmware, channel counts).
3. Tries the usual channel list names: `NetWork.RemoteDeviceV3`,
   `NetWork.RemoteDevice`, `NetWork.RemoteDeviceV2`, `RemoteDevice`,
   `NetWork.DigitalChannel`, `DigitalChannel`, `Digital.Channel`, `ChannelTitle`.
   Prints one line per channel for every name that answers.

Return codes: 0 done, 1 login / connection error, 2 usage error.

```
RESULT tool=probe rc=0 login=MD5/DVRIP-Web channels=NetWork.RemoteDeviceV3
```

---

### 3.2 nvr_dvrip_storage

**Read-only.** Hard disk and storage diagnosis, plus the NVR log. No format, no
disk manager commands.

```
python3 nvr_dvrip_storage.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--days=N] [--all] [--json] [-v]
```

| Option | Meaning |
|---|---|
| `--days=N` | log range: from N days back (00:00) until now, default 3 |
| `--all` | print every log entry (default: filtered for disk / storage / reboot / shutdown / power / error entries, plus the 10 newest entries) |
| `--json` | also write `nvr_storage_<ip>_<time>.json` (raw answers, passwords masked) |

Output sections:

| Section | Content |
|---|---|
| system | model, firmware, build time, uptime (hours) |
| storage | every physical disk and partition: status, type, size, free space, recorded time range ("new" / "old") |
| work state | alarm state (and other WorkState fields) |
| storage configs | `General.General` (overwrite mode, disk count), `Record`, `Storage.*` |
| log | filtered or full log of the range, count of storage errors |

How to read it:

| What you see | Meaning |
|---|---|
| `status=0`, `type=0` | disk normal, read/write (type 1 = read only, 2 = snapshot, 3 = redundant) |
| `NO DISK REPORTED` or `total 0.0 GB` | the NVR does not see / cannot read the disk (cable, power, disk) |
| log `StorageDeviceError Read, /dev/sd0a` | read errors on the disk |
| log `EventStart StorageNotExist` | disk missing |
| log `ShutDown ... Wait shutdown for 1 minute` | clean shutdown started (finishes 60 s later) |
| log `Reboot <time>` | NVR start; `<time>` is the time of the last clean shutdown |
| log `WFS1 1-1 <from> ~ <to>` | file system mounted after the start, with the recorded range |

Return codes:

| Code | Meaning |
|---|---|
| 0 | disk present, status normal, no storage error since the last NVR start |
| 4 | no disk, disk status not normal, or storage errors **since the last NVR start** (older errors are shown and counted but do not set 4) |
| 1 / 2 | connection or login error / usage error |

```
RESULT tool=storage rc=0 disks=1 total_gb=3726 records_end=2026-09-15_09:59:15 storage_errors=171 since_boot=0
```

---

### 3.3 nvr_dvrip_chancfg

**Read-only.** Time settings of the NVR and the full configuration of the digital
channels (`NetWork.RemoteDeviceV3`). Main use: find the one channel that is set up
differently from the others.

```
python3 nvr_dvrip_chancfg.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--all] [--json] [-v]
```

| Option | Meaning |
|---|---|
| `--all` | print every channel raw (flattened `Field` / `Decoder.Field`, passwords masked), also the empty ones |
| `--json` | also write `nvr_chancfg_<ip>_<time>.json` (passwords masked) |

Output sections:

1. **NVR time settings**: `General.Location`, `NetWork.NetNTP`, `System.TimeZone`,
   the time part of `General.General`, and time sync configs if the firmware has them.
2. **Used channels** (a channel is "used" if any decoder entry has a camera IP):
   camera IP, protocol, camera user, enable channel/decoder (`T/T`), `SingleConnId`
   (last 2 digits), plus every field with time / sync / zone in its name.
   Then the list of channels without camera IP.
3. **Fields that differ between the used channels**: e.g.
   `SingleConnId "0x00000001" -> ch 01..27 | "0x00000000" -> ch 28`.
   Fields that differ by nature (IP, MAC, name, password, URL, serial) are ignored.
4. **Field names found**: what this firmware offers.

Important channel fields:

| Field | Meaning |
|---|---|
| `Enable` / `Decoder.Enable` | channel / decoder switched on, both must be `true` |
| `SingleConnId` | index of the active decoder entry, normally `0x00000001`; `0x00000000` makes the channel show `NoConfig` |
| `EnCheckTime` | `true`: the NVR sets its own time on the camera |
| `SynchResolution` | sync the camera resolution |
| `Decoder.Protocol` | `ONVIF`, `NETIP`, ... |
| `Decoder.StreamType` | `MAIN` / `EXTRA` |

Return codes: 0 all used channels equal, 4 some fields differ, 1 / 2 as usual.

```
RESULT tool=chancfg rc=0 channels=36 used=28 differing_fields=0
```

---

### 3.4 nvr_dvrip_chanstate

**Read-only.** Live state of every channel: is the camera connected, is it
recording, does it have a record plan. The check after switching the active NVR.

```
python3 nvr_dvrip_chanstate.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--wait=SEC] [--raw] [-v]
```

| Option | Meaning |
|---|---|
| `--wait=SEC` | repeat the check every 10 s until no used channel is `NoLogin` any more, or all are connected; max. SEC seconds. Also retries while the NVR is still starting. Default 0 = check once |
| `--raw` | print the raw `NetWork.ChnStatus` list and the record config of channel 1 |

Sources: `NetWork.ChnStatus` (status), `WorkState` (bitrate, record flag),
`NetWork.RemoteDeviceV3` (camera IP), `Record` (record plan).

Channel status:

| Status | Meaning |
|---|---|
| `Connected` | stream running (resolution shown, e.g. `1080P`, `4M`, `2304x1296`) |
| `LoginFailed` | camera refused the NVR login: wrong camera password. Normal for the inactive NVRs, so their archive stays frozen |
| `NoLogin` | the NVR has not tried this channel yet. After a start it works through the channels one by one; with failing logins this takes several minutes |
| `Offline` | the camera did not answer |
| `NoConfig` | channel not configured, also when `SingleConnId` is 0 (repair: `nvr_dvrip_setcred --connid`) |

Columns `rec` and `plan`:

| Column | Meaning |
|---|---|
| `rec` | WorkState record flag. It means "recording armed": right after a start it is `yes` even on channels without stream. A channel counts as **recording** only if it is also connected |
| `plan` | `ALWAYS` manual record, `SCHED` schedule with active time sections (e.g. `1 00:00:00-24:00:00` on all days = permanent), `NO-SCHED` schedule without active section, `OFF` record closed |

Warnings in the table: `<- connected, NOT recording`, `<- no record plan`.

Return codes:

| Code | Meaning |
|---|---|
| 0 | all used channels connected and recording, all with a record plan |
| 4 | some channel not connected, not recording or without record plan |
| 1 / 2 | connection / read error, usage error |

```
RESULT tool=chanstate rc=4 connected=27 recording=27 used=28 nologin=0 missing=172.20.1.183 notrec=- noplan=-
```

| Key | Meaning |
|---|---|
| `connected` | used channels with status `Connected` |
| `recording` | connected **and** record flag set |
| `used` | channels with a camera IP |
| `nologin` | channels the NVR has not tried yet |
| `missing` | camera IPs not connected |
| `notrec` | camera IPs connected but not recording |
| `noplan` | camera IPs without record plan |

---

### 3.5 nvr_dvrip_power

**Writes (machine commands).** Clean shutdown before the power is cut, soft reboot,
state check.

```
python3 nvr_dvrip_power.py <nvr_ip> check|shutdown|reboot|probe [--nvr_user=X] [--nvr_pass='Y'] [--wait=SEC] [--min=SEC] [-v]
```

| Mode | What it does |
|---|---|
| `check` | shows the state only, sends nothing but a login |
| `shutdown` | stops the NVR software so the power can be cut |
| `reboot` | soft restart, waits until the NVR answers again (max. 300 s) |
| `probe` | sends a deliberately unknown action (`XyzTest`) to show how the firmware answers |

| Option | Meaning |
|---|---|
| `--wait=SEC` | max. wait for the NVR to go down after a command, default 60 |
| `--min=SEC` | shutdown: min. time since the command before rc 0, default 75 |

**States** (detected by the login answer, not by ping):

| State | Meaning |
|---|---|
| `running` | the NVR software answers the login (any answer, even "wrong password") |
| `halted` | port 34567 accepts but the login gets no answer: software stopped, power may be cut. Detail `connection closed at once` or `no answer within 5 s` |
| `off` | port 34567 closed / host unreachable |

Why not ping: XMEye "Shutdown" stops only the NVR software. Linux keeps running:
ping, the static web login page and the TCP accept on 34567 stay alive. The web UI
then shows "Unknown Error" at login, the VMS shows the NVR offline.

**Shutdown sequence:**

1. state must be `running` (if it is already down: rc 0, "no shutdown sent by this run").
2. send `Shutdown`; wait max. `--wait` s for `halted` / `off`. If it stays running,
   try `ShutDown`, then `Halt` (the firmware answers Ret=100 even to unknown
   actions, so the answer alone proves nothing).
3. the NVR must stay down for 20 s **and** at least `--min` (75) s must have passed
   since the command. The NVR logs "Wait shutdown for 1 minute" and finishes 60 s
   after the command. Progress line every 15 s.
4. rc 0: power may be cut.

Recommended for a power cycle: after rc 0 wait another 60 s, power off, stay off
at least 30 s (disk spin-down), power on.

**Reboot sequence:** send `Reboot`, wait until not running (seen after about 9 s,
state `off`), then until it answers again (seen after about 35 s more).

Return codes:

| Mode | Codes |
|---|---|
| check | 0 running, 6 halted, 3 off |
| shutdown | 0 power may be cut · 3 still running (do NOT cut) · 4 came back / rebooted (do NOT cut) · 5 all commands rejected (do NOT cut) |
| reboot | 0 down and back · 3 did not go down / not back in 300 s · 5 rejected |
| probe | 0 done |
| all | 1 connection / login error, 2 usage error |

```
RESULT tool=power mode=shutdown rc=0 state=halted seconds=75
RESULT tool=power mode=reboot rc=0 state=running seconds=45
RESULT tool=power mode=check rc=0 state=running
```

---

### 3.6 nvr_dvrip_setcred

**Writes (channel config).** Changes the channel settings in
`NetWork.RemoteDeviceV3`: camera login used by the NVR, channel enable, connection
id; restores backups. **Default is a dry run.**

```
python3 nvr_dvrip_setcred.py <nvr_ip> [--only=ip,ip] [--cam_user=X] [--cam_pass=Y]
                             [--enable] [--connid] [--force] [--apply] [--reboot]
                             [--full] [--restore=file] [--nvr_user=X] [--nvr_pass='Y'] [-v]
```

| Option | Meaning |
|---|---|
| `--only=ip,ip` | only channels with these camera IPs (default: all cameras 172.20.1.171 - .198) |
| `--cam_pass=Y` | new camera password for the channels (letters / digits only). **Without it user and password are not changed** |
| `--cam_user=X` | new camera user, default `user` (only with `--cam_pass`) |
| `--enable` | set channel `Enable` and `Decoder.Enable` to true |
| `--connid` | set `SingleConnId` to `0x00000001` where it is 0 |
| `--force` | rewrite user/password even if already equal (forces a new login); needs `--cam_pass` |
| `--apply` | really write; without it: dry run (table + what would change) |
| `--reboot` | soft restart of the NVR after writing (recommended) |
| `--full` | write the whole channel list in one packet, only if the firmware cannot write channel by channel |
| `--restore=file` | write a backup file back to the NVR |
| `-v` | also prints the complete config of the selected channels |

Table columns: channel, camera IP, enable channel/decoder, connid, camera user,
password state (`= new`, `set(n)`, `empty`), action (`-> user / **** +enable +connid`,
`(skip)`, `(nothing to do)`).

Safety:

- Before every `--apply` / `--restore` the current config is saved to
  `nvr_backup_<ip>_<time>.json` (**contains passwords**).
- Channels are written one by one (`NetWork.RemoteDeviceV3.[n]`); the tool checks
  first (read only) that the firmware supports it.
- After writing, the config is read back and checked (`verify`).
- Writing `NetWork.*` can hang the NVR network until a restart: use `--reboot`.

Examples:

```bash
# dry run: what would change for camera password NVR3
python3 nvr_dvrip_setcred.py 172.20.1.213 --cam_pass=NVR3
# write it, restart the NVR
python3 nvr_dvrip_setcred.py 172.20.1.213 --cam_pass=NVR3 --apply --reboot
# one channel: switch on + repair the connection id
python3 nvr_dvrip_setcred.py 172.20.1.212 --only=172.20.1.198 --enable --connid --apply --reboot
# undo
python3 nvr_dvrip_setcred.py 172.20.1.212 --restore=nvr_backup_172_20_1_212_20261001_191253.json --reboot
```

Return codes: 0 done (dry run, or written and verified), 1 connection / write /
verify error, 2 usage error.

```
RESULT tool=setcred rc=0 mode=apply changed=1 verify=ok backup=nvr_backup_172_20_1_212_20261001_194607.json
```

---

## 4. Workflows

### 4.1 Switch the active NVR ("NVR activate")

Only one NVR records. The cameras accept only the NVR whose channel password
matches the camera `user` password (NVR1..NVR4). The others get `LoginFailed` and
keep their archive unchanged.

1. Set the camera `user` password to `NVRn` on all cameras (onvif_control,
   CamHi CGI `setuserattr`).
2. Reboot the cameras, wait about 90 s; retry failed cameras once after 30 s.
3. Soft-reboot the target NVR, because after failed logins an NVR stops retrying:
   `nvr_dvrip_power.py <ip> reboot` → rc 0.
4. Check: `nvr_dvrip_chanstate.py <ip> --wait=180` → expect
   `connected=28 recording=28`, report `missing=` in the notification.

The previously active NVR needs nothing: it loses the streams with the camera
reboot and gets `LoginFailed` from then on.

### 4.2 Clean power cycle of an NVR (Tasmota)

1. `nvr_dvrip_power.py <ip> shutdown` → rc 0 (takes about 75 s). Any other rc: do not cut power.
2. wait 60 s.
3. power off (Tasmota), stay off at least 30 s.
4. power on, wait 2-3 min.
5. `nvr_dvrip_power.py <ip> check` → rc 0;
   `nvr_dvrip_storage.py <ip>` → rc 0, log shows `Reboot <shutdown time>`, no disk errors.

### 4.3 Channel shows "NoConfig" although it is set up

1. `nvr_dvrip_chanstate.py <ip>` → channel `NoConfig`.
2. `nvr_dvrip_chancfg.py <ip>` → "fields that differ": `SingleConnId 0x00000000` on that channel.
3. `nvr_dvrip_setcred.py <ip> --only=<camera ip> --connid` (dry run), then add `--apply --reboot`.
4. `nvr_dvrip_chanstate.py <ip>` → status `LoginFailed` / `Connected` / `NoLogin` instead of `NoConfig`.

### 4.4 Disk not shown / NVR offers "recover"

1. `nvr_dvrip_storage.py <ip>` → `total 0.0 GB` and `StorageDeviceError Read, /dev/sd0a`.
2. A soft reboot is often not enough; a cold start (power off ≥ 30 s, via 4.2) let
   the disk come back with its archive intact. A long first boot (disk check) is normal.
3. Check again: total size back, recorded range unchanged, no new errors (rc 0).

---

## 5. Firmware findings

Measured on **NBD80N36RA-KL-V3**, firmware **V4.03.R11.C638025B.12201** (build
2023-05-06), 36 digital channels, device type "HVR". Other firmwares may differ.

| Topic | Finding |
|---|---|
| unknown OPMachine actions | answered with Ret=100 (see `power probe`), Ret alone proves nothing |
| Shutdown | software stops after 1-3 s, port 34567 still accepts and closes at once; NVR finishes 60 s after the command |
| Reboot | port closed after about 9 s, login answers again about 35 s later |
| channel status | only `NetWork.ChnStatus` (config 1042); `ChannelState` etc. via 1020 → Ret 102 |
| WorkState `ChannelState` | 64 entries, `Bitrate` (kbit/s) and `Record` (armed flag) |
| `SingleConnId` 0 | channel shows `NoConfig`; set to `0x00000001` → normal |
| channel added in the GUI | came with `Decoder.Enable false` and `SingleConnId 0` |
| NVR NTP | `NetNTP Enable true` but no server set; log shows `NTP XMCloudCloseError` |
| time | `System.TimeZone timeMin 360` (UTC-6), `EnCheckTime true` on all channels (NVR sets the camera time) |
| `Storage.StorageGlobal` | Ret 607 (not available) |
| log after failed logins | an NVR stops retrying cameras after failed logins → soft reboot needed after a camera password change |

---

## 6. Troubleshooting

| Problem | Cause / fix |
|---|---|
| `ERROR: no NVR password` | give `--nvr_pass='...'` or `export NVR_PASS='...'` |
| `login as X failed: Ret=203/205` | wrong user or password; check the `NVR_USERS` default for this IP. Several wrong logins in a row can lock the account for a while |
| `connection closed by NVR` / timeout | NVR halted or starting; `nvr_dvrip_power.py <ip> check` |
| `ERROR: unknown option(s)` | typo, or a single-dash option (only `-v` / `-h` exist); old options were removed (e.g. chanstate `--probe` → `--raw`) |
| `cam_pass '...' - only letters and digits` | missing space before the next `--` |
| storage rc 4 right after a disk problem | errors since the last NVR start; after a clean restart without new errors rc is 0 again |
| chanstate many `NoLogin` | NVR still working through the channels after a start; use `--wait=180` |
| chanstate `Offline` on a camera that works | camera did not answer the NVR (busy after many failed logins, WiFi); check again later |
| web UI "Unknown Error", ping OK | NVR is halted (after Shutdown): power cycle it |

---

## 7. Version history

| Tool | Version | Changes |
|---|---|---|
| all | 2026-10-01 | common help (`-h`), same options and messages, RESULT line, no password in the code (`--nvr_pass` / `NVR_PASS`), NVR user default per IP |
| probe | 1.2 | JSON only with `--json`, NVR IP required |
| storage | 1.1 | return code 4, storage errors counted since the last NVR start |
| chancfg | 1.2 | connid column, return code 4 on differences |
| chanstate | 1.2 | `--wait`, `nologin` count |
| chanstate | 1.1 | status from `NetWork.ChnStatus`, record plan, "connected but not recording" |
| power | 1.3 | help / options |
| power | 1.2 | shutdown rc 0 only after 75 s since the command |
| power | 1.1 | down detection by login answer, states running / halted / off, mode probe |
| setcred | 1.8 | user/password only change with `--cam_pass` (no default camera password) |
| setcred | 1.7 | `--connid` |
| setcred | 1.4 - 1.6 | `--enable`, `--reboot`, `--verbose` channel dump, strict options |
