#!/usr/bin/env python3
"""nvr_dvrip_chancfg.py - version 1.2 (2026-10-01)

READ-ONLY view of the time settings and the digital channel configuration of an
XMEye NVR via DVRIP / Sofia (TCP 34567), to find channels that are configured
differently from the others (protocol, user, enable, time sync, connection id ...).
Nothing is written to the NVR. Passwords are never printed.

Sections of the output:
  1. NVR time settings (General.Location, NetWork.NetNTP, System.TimeZone, ...)
  2. used channels (camera IP set): IP, protocol, user, enable channel/decoder and
     every field with time / sync / zone in its name
  3. fields whose value differs between the used channels (the interesting part)
  4. all field names found (what this firmware offers)
  5. with --all: every channel raw (masked), also the empty ones

Usage:
  python3 nvr_dvrip_chancfg.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--all] [--json] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.212

Options:
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  --all             print every channel raw (flattened, passwords masked)
  --json            also write nvr_chancfg_<ip>_<time>.json (passwords masked)
  -v, --verbose     print every DVRIP request / answer and unavailable configs
  -h, --help        show this help

Field notes (NetWork.RemoteDeviceV3, firmware V4.03.R11):
  Enable / Decoder.Enable   channel / decoder switched on (both must be true)
  SingleConnId              index of the active decoder entry, normally 0x00000001;
                            0x00000000 -> channel shows "NoConfig" (fix: nvr_dvrip_setcred --connid)
  EnCheckTime               true = the NVR sets its time on the camera
  Decoder.Protocol          ONVIF / NETIP ...

Return codes:
  0 = all used channels have the same settings
  4 = some fields differ between the used channels
  1 = connection / login / read error, 2 = usage error

Last output line (for scripts):
  RESULT tool=chancfg rc=0 channels=36 used=28 differing_fields=0

History:
  1.2  help / options like the other nvr_dvrip tools, no password in the code,
       return code 4 on differences, RESULT line
  1.1  a channel counts as used if any decoder has an IP; --all prints all channels;
       list of channels without camera IP
  1.0  first version
"""

TOOL = "nvr_dvrip_chancfg"
VERSION = "1.2"
USAGE = "python3 nvr_dvrip_chancfg.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--all] [--json] [-v]"

# ---- common part (identical in all nvr_dvrip_* tools) --------------------------------
import hashlib, json, os, socket, struct, sys, time

NVR_PORT = 34567
# default NVR login user per NVR IP - no passwords in this file (see --nvr_pass / NVR_PASS)
NVR_USERS = {"172.20.1.211": "mxrs", "172.20.1.212": "cbdy",
             "172.20.1.213": "wyad", "172.20.1.214": "admin"}
DEFAULT_USER = "admin"            # NVR user for IPs not listed above
TIMEOUT = 10                      # socket timeout (s)
HDR = struct.Struct("<BB2xII2xHI")    # head, version, session, sequence, msg id, length
OK_CODES = (100, 515)
MSG_LOGIN, MSG_INFO, MSG_CFG_SET, MSG_CFG_GET = 1000, 1020, 1040, 1042
MSG_LOG_QUERY, MSG_OPMACHINE = 1442, 1450
VERBOSE = False


def log(msg):
    print("%s %s" % (time.strftime("%H:%M:%S"), msg), flush=True)


def vprint(msg):
    if VERBOSE:
        print("  [v] " + msg, flush=True)


def sofia_hash(pw):
    # XMEye password hash: md5 -> 8 characters
    d = hashlib.md5(pw.encode("utf-8")).digest()
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    return "".join(chars[(d[i] + d[i + 1]) % 62] for i in range(0, 16, 2))


def mask(obj):
    # hide password values (key contains "pass" or "pwd") - shows the length only
    if isinstance(obj, dict):
        return {k: ("***(%d)" % len(str(v)) if any(s in k.lower() for s in ("pass", "pwd")) and v
                    else mask(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [mask(x) for x in obj]
    return obj


class Dvrip:
    # minimal DVRIP / Sofia client (JSON over TCP 34567)
    def __init__(self, ip, timeout=TIMEOUT, connect_timeout=None):
        self.sock = socket.create_connection((ip, NVR_PORT), timeout=connect_timeout or timeout)
        self.sock.settimeout(timeout)
        self.timeout = timeout
        self.session = 0
        self.seq = 0

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass

    def _recv(self, n):
        buf = b""
        while len(buf) < n:
            part = self.sock.recv(n - len(buf))
            if not part:
                raise ConnectionError("connection closed by NVR")
            buf += part
        return buf

    def send(self, msgid, data, timeout=None):
        body = json.dumps(data, separators=(",", ":")).encode("utf-8") + b"\x0a\x00"
        vprint("send %d: %s" % (msgid, json.dumps(mask(data))[:300]))
        if timeout:
            self.sock.settimeout(timeout)
        try:
            self.sock.sendall(HDR.pack(255, 0, self.session, self.seq, msgid, len(body)) + body)
            self.seq += 1
            _, _, _, _, _, length = HDR.unpack(self._recv(HDR.size))
            raw = self._recv(length).rstrip(b"\x00").rstrip(b"\x0a").decode("utf-8", "replace")
        finally:
            if timeout:
                self.sock.settimeout(self.timeout)
        try:
            r = json.loads(raw, strict=False)
        except ValueError:
            r = {"_raw": raw}
        vprint("recv: Ret=%s %s" % (r.get("Ret"), json.dumps(mask(r), ensure_ascii=False)[:300]))
        return r

    def login(self, user, pw):
        r = self.send(MSG_LOGIN, {"EncryptType": "MD5", "LoginType": "DVRIP-Web",
                                  "PassWord": sofia_hash(pw), "UserName": user})
        if r.get("Ret") not in OK_CODES:
            raise RuntimeError("login as %s failed: Ret=%s (203/205 = wrong user or password)"
                               % (user, r.get("Ret")))
        self.session = int(str(r.get("SessionID", "0")), 16)
        return r

    def sid(self):
        return "0x%08X" % self.session

    def get(self, msgid, name):
        # full answer of an info (1020) or config (1042) request
        return self.send(msgid, {"Name": name, "SessionID": self.sid()})

    def value(self, msgid, name):
        # only the data part, None if not available
        r = self.get(msgid, name)
        return r.get(name) if r.get("Ret") in OK_CODES else None


def parse_cli(known, npos=(1,)):
    # -> (positional args, options). Exits 0 on -h/--help, 2 on usage errors.
    global VERBOSE
    argv = sys.argv[1:]
    if "-h" in argv or "--help" in argv:
        print(__doc__)
        sys.exit(0)
    pos, opts, bad = [], {}, []
    for a in argv:
        if a in ("-v", "--verbose"):
            VERBOSE = True
        elif a.startswith("--"):
            k, _, v = a[2:].partition("=")
            (opts.__setitem__(k, v) if k in known else bad.append(a))
        elif a.startswith("-"):
            bad.append(a)
        else:
            pos.append(a)
    if bad or len(pos) not in npos:
        print("%s %s" % (TOOL, VERSION))
        print("usage: " + USAGE)
        print("       python3 %s.py -h   (full help)" % TOOL)
        if bad:
            print("ERROR: unknown option(s): %s" % ", ".join(bad))
        sys.exit(2)
    return pos, opts


def nvr_login(ip, opts):
    # NVR user / password: --nvr_user / --nvr_pass, else NVR_USERS / env NVR_PASS
    user = opts.get("nvr_user") or NVR_USERS.get(ip, DEFAULT_USER)
    pw = opts.get("nvr_pass") or os.environ.get("NVR_PASS", "")
    if not pw:
        print("ERROR: no NVR password - use --nvr_pass='...' or set the environment variable NVR_PASS")
        sys.exit(2)
    return user, pw
# ---- end of common part ---------------------------------------------------------------

import re

TIME_CONFIGS = ["General.Location", "NetWork.NetNTP", "System.TimeZone", "General.General",
                "NetWork.DigitalTimeSync", "NetWork.RemoteDeviceTimeSync"]
CHANNEL_CONFIG = "NetWork.RemoteDeviceV3"
TIME_KEY = re.compile(r"time|synch?|zone|tz|ntp|dst|clock", re.I)
# fields that differ per camera by nature - not reported as difference
IGNORE_DIFF = re.compile(r"ip|addr|mac|name|pass|url|serial|uuid|sn$|^id$", re.I)


def flat(d, prefix=""):
    # channel dict -> {"Field": v, "Decoder.Field": v} (first decoder entry)
    out = {}
    for k, v in (d or {}).items():
        key = prefix + k
        if isinstance(v, dict):
            out.update(flat(v, key + "."))
        elif isinstance(v, list) and k == "Decoder":
            if v:
                out.update(flat(v[0], "Decoder."))
            if len(v) > 1:
                out["Decoder.count"] = len(v)
        else:
            out[key] = v
    return out


def cam_ips(ch):
    return [d.get("IPAddress") or d.get("Address") for d in (ch.get("Decoder") or [])
            if d.get("IPAddress") or d.get("Address")]


def main():
    pos, opts = parse_cli(("nvr_user", "nvr_pass", "all", "json"))
    ip = pos[0]
    user, pw = nvr_login(ip, opts)
    out = {"nvr": ip}
    print("%s %s - %s:%d (read-only, user %s)" % (TOOL, VERSION, ip, NVR_PORT, user))
    try:
        c = Dvrip(ip)
        c.login(user, pw)
    except Exception as e:
        print("[ERR] %s" % e)
        print("RESULT tool=chancfg rc=1 error=login")
        sys.exit(1)
    print("[OK] login")

    print("\n=== NVR time settings ===")
    out["time_configs"] = {}
    for name in TIME_CONFIGS:
        data = c.value(MSG_CFG_GET, name)
        if data is None:
            vprint("%-26s not available" % name)
            continue
        out["time_configs"][name] = mask(data)
        if name == "General.General" and isinstance(data, dict):    # only the time related part
            data = {k: v for k, v in data.items() if TIME_KEY.search(k)}
        print("  %-26s %s" % (name, json.dumps(mask(data), ensure_ascii=False)[:400]))

    chans = c.value(MSG_CFG_GET, CHANNEL_CONFIG)
    c.close()
    if not isinstance(chans, list):
        print("\n[ERR] %s not readable" % CHANNEL_CONFIG)
        print("RESULT tool=chancfg rc=1 error=read")
        sys.exit(1)
    out["channels"] = mask(chans)
    rows = [flat(ch) for ch in chans]
    used = [(i + 1, rows[i]) for i, ch in enumerate(chans) if cam_ips(ch)]
    for i, ch in enumerate(chans):
        ips = cam_ips(ch)
        if ips and not (rows[i].get("Decoder.IPAddress") or rows[i].get("Decoder.Address")):
            rows[i]["Decoder.IPAddress"] = ips[0] + " (not 1st decoder!)"
    empty = [i + 1 for i, ch in enumerate(chans) if not cam_ips(ch)]

    all_keys = sorted({k for _, f in used for k in f})
    time_keys = [k for k in all_keys if TIME_KEY.search(k)]
    print("\n=== channels (%d used of %d) ===" % (len(used), len(chans)))
    print("  ch  %-15s %-8s %-6s %-5s %-6s" % ("camera", "proto", "user", "en", "connid")
          + "".join("  %s" % k.replace("Decoder.", "D.") for k in time_keys))
    for no, f in used:
        cam = f.get("Decoder.IPAddress") or f.get("Decoder.Address") or "-"
        en = "%s/%s" % (str(f.get("Enable"))[0], str(f.get("Decoder.Enable"))[0])
        print("  %02d  %-15s %-8s %-6s %-5s %-6s" % (no, cam, str(f.get("Decoder.Protocol", "-"))[:8],
              str(f.get("Decoder.UserName", "-"))[:6], en, str(f.get("SingleConnId", "-"))[-2:])
              + "".join("  %s" % json.dumps(f.get(k)) for k in time_keys))
    print("  channels without camera IP: %s" % (", ".join("%02d" % n for n in empty) or "-"))

    print("\n=== fields that differ between the used channels ===")
    diffs = 0
    for k in all_keys:
        if IGNORE_DIFF.search(k.split(".")[-1]):
            continue
        vals = {}
        for no, f in used:
            vals.setdefault(json.dumps(f.get(k), ensure_ascii=False), []).append(no)
        if len(vals) > 1:
            diffs += 1
            parts = ["%s -> ch %s" % (v, ",".join("%02d" % n for n in nos)) for v, nos in
                     sorted(vals.items(), key=lambda x: -len(x[1]))]
            print(("  %-28s %s" % (k, " | ".join(parts)))[:600])
    if not diffs:
        print("  none - all used channels have the same settings")

    print("\n=== field names found ===")
    print("  " + ", ".join(all_keys))

    if "all" in opts:
        print("\n=== all %d channels, raw (masked) ===" % len(chans))
        for i, f in enumerate(rows):
            print("  ch %02d: %s" % (i + 1, json.dumps(mask(f), ensure_ascii=False)))

    if "json" in opts:
        fn = "nvr_chancfg_%s_%s.json" % (ip.replace(".", "_"), time.strftime("%Y%m%d_%H%M%S"))
        with open(fn, "w", encoding="utf-8") as fh:
            json.dump(out, fh, indent=1, ensure_ascii=False)
        print("\nwritten: %s" % fn)
    rc = 4 if diffs else 0
    print("RESULT tool=chancfg rc=%d channels=%d used=%d differing_fields=%d" % (rc, len(chans), len(used), diffs))
    sys.exit(rc)


if __name__ == "__main__":
    main()
