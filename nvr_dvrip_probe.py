#!/usr/bin/env python3
"""nvr_dvrip_probe.py - version 1.2 (2026-10-01)

READ-ONLY first contact with an XMEye NVR via DVRIP / Sofia (TCP 34567).
Logs in (tries up to 3 login variants), reads the system info and tries the
usual config names for the digital channel list, to find out what this
firmware offers. Nothing is written to the NVR. Passwords are never printed.

Usage:
  python3 nvr_dvrip_probe.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--json] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.213

Options:
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  --json            also write nvr_probe_<ip>.json (all answers, passwords masked)
  -v, --verbose     print every DVRIP request / answer (passwords masked)
  -h, --help        show this help

Login variants (in this order, stops early on "user locked"):
  MD5 + DVRIP-Web, MD5 + DVRIP-Xm030, plain + DVRIP-Web
  Too many wrong logins can lock the NVR account for a while.

Return codes:
  0 = done, 1 = connection / login error, 2 = usage error

Last output line (for scripts):
  RESULT tool=probe rc=0 login=MD5/DVRIP-Web channels=NetWork.RemoteDeviceV3

History:
  1.2  help / options like the other nvr_dvrip tools, no password in the code,
       NVR IP required, JSON file only with --json, RESULT line
  1.1  login tries up to 3 variants, shows the meaning of Ret codes
  1.0  first version
"""

TOOL = "nvr_dvrip_probe"
VERSION = "1.2"
USAGE = "python3 nvr_dvrip_probe.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] [--json] [-v]"

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

# config names that may hold the digital channel list (differs by firmware)
CONFIG_NAMES = ["NetWork.RemoteDeviceV3", "NetWork.RemoteDevice", "NetWork.RemoteDeviceV2",
                "RemoteDevice", "NetWork.DigitalChannel", "DigitalChannel", "Digital.Channel",
                "ChannelTitle"]
# login variants (EncryptType, LoginType)
LOGIN_VARIANTS = [("MD5", "DVRIP-Web"), ("MD5", "DVRIP-Xm030"), ("NONE", "DVRIP-Web")]
# DVRIP return codes (meanings from the XM SDK, not sure for every firmware)
RET_TEXT = {100: "OK", 101: "unknown error", 102: "not supported", 103: "not permitted",
            104: "user already logged in", 105: "user not logged in", 106: "user or password wrong",
            107: "no permission", 203: "password wrong", 204: "user does not exist?",
            205: "user locked / wrong login", 206: "user in blacklist?", 207: "user already in use?",
            607: "config not available"}


def login_any(ip, user, pw):
    # tries the login variants, returns (connection, variant, answer)
    r = {}
    for enc, ltype in LOGIN_VARIANTS:
        c = Dvrip(ip)
        p = sofia_hash(pw) if enc == "MD5" else pw
        r = c.send(MSG_LOGIN, {"EncryptType": enc, "LoginType": ltype, "PassWord": p, "UserName": user})
        ret = r.get("Ret")
        print("     login %-4s %-12s -> Ret=%s %s" % (enc, ltype, ret, RET_TEXT.get(ret, "")))
        if ret in OK_CODES:
            c.session = int(str(r.get("SessionID", "0")), 16)
            return c, "%s/%s" % (enc, ltype), r
        c.close()
        if ret in (205, 206, 207):          # locked / blacklisted: stop at once
            break
    raise RuntimeError("login failed (last Ret=%s)" % r.get("Ret"))


def main():
    pos, opts = parse_cli(("nvr_user", "nvr_pass", "json"))
    ip = pos[0]
    user, pw = nvr_login(ip, opts)
    print("%s %s - %s:%d (read-only, user %s)" % (TOOL, VERSION, ip, NVR_PORT, user))
    out = {"nvr": ip}
    try:
        c, variant, lr = login_any(ip, user, pw)
    except Exception as e:
        print("[ERR] %s" % e)
        print("RESULT tool=probe rc=1 error=login")
        sys.exit(1)
    print("[OK] login %s, session %s, device %s" % (variant, c.sid(),
          lr.get("DeviceType ", lr.get("DeviceType", "?"))))
    out["login"] = mask(lr)

    info = c.value(MSG_INFO, "SystemInfo")
    out["SystemInfo"] = info
    if isinstance(info, dict):
        print("[OK] model %s, firmware %s, video in %s, digital channels %s" % (
            info.get("HardWare", "?"), info.get("SoftWareVersion", "?"),
            info.get("VideoInChannel", "?"), info.get("DigChannel", "?")))

    out["configs"], found = {}, []
    for name in CONFIG_NAMES:
        try:
            r = c.get(MSG_CFG_GET, name)
        except Exception as e:
            print("[--] %-24s error: %s - reconnecting" % (name, e))
            c.close()
            c, variant, _ = login_any(ip, user, pw)
            continue
        ret, data = r.get("Ret"), r.get(name)
        if ret in OK_CODES and data is not None:
            n = len(data) if isinstance(data, list) else 1
            print("[OK] %-24s Ret=%s entries=%s" % (name, ret, n))
            for i, it in enumerate(data if isinstance(data, list) else [data]):
                if isinstance(it, dict):
                    txt = json.dumps(mask(it), ensure_ascii=False)
                    print("    [%02d] %s" % (i + 1, txt[:220] + ("..." if len(txt) > 220 else "")))
            out["configs"][name] = mask(data)
            found.append(name)
        else:
            print("[--] %-24s Ret=%s %s" % (name, ret, RET_TEXT.get(ret, "")))
            out["configs"][name] = {"Ret": ret}
    c.close()

    if "json" in opts:
        fn = "nvr_probe_%s.json" % ip.replace(".", "_")
        with open(fn, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print("\nwritten: %s (passwords masked)" % fn)
    print("RESULT tool=probe rc=0 login=%s channels=%s" % (variant, ",".join(found) or "-"))


if __name__ == "__main__":
    main()
