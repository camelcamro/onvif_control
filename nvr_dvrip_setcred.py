#!/usr/bin/env python3
"""nvr_dvrip_setcred.py - version 1.8 (2026-10-01)

Changes the digital channel settings of an XMEye NVR via DVRIP / Sofia (TCP 34567),
config "NetWork.RemoteDeviceV3":
  - camera login user / password the NVR uses for its channels (--cam_pass)
  - switch channels on (--enable)
  - repair the connection id of channels showing "NoConfig" (--connid)
  - restore a backup (--restore)
Default is a DRY RUN: shows the channel table and what would change, writes nothing.
Only the fields named above are changed; IP, port, protocol and channel order stay.

Usage:
  python3 nvr_dvrip_setcred.py <nvr_ip> [--only=ip,ip] [--cam_user=X] [--cam_pass=Y]
                               [--enable] [--connid] [--force] [--apply] [--reboot]
                               [--full] [--restore=file] [--nvr_user=X] [--nvr_pass='Y'] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.213

Options:
  --only=ip,ip      only channels with these camera IPs (default: all cameras
                    172.20.1.171 - 172.20.1.198)
  --cam_pass=Y      new camera password for the channels (letters / digits only);
                    without --cam_pass user / password are not changed
  --cam_user=X      new camera user (default "user"; only used with --cam_pass)
  --enable          set channel Enable and Decoder.Enable to true
  --connid          set SingleConnId to 0x00000001 where it is 0 (channel shows
                    "NoConfig" although IP / user are set)
  --force           rewrite user / password even if already equal (forces the NVR
                    to log in again); needs --cam_pass
  --apply           really write (without: dry run)
  --reboot          soft restart of the NVR after --apply (recommended: writing
                    NetWork.* can hang the NVR network until a restart)
  --full            write the whole channel list in one packet (only if the firmware
                    does not support channel-by-channel writes)
  --restore=file    write a backup file (nvr_backup_<ip>_<time>.json) back to the NVR
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  -v, --verbose     print every DVRIP request / answer and the full config of the
                    selected channels (passwords masked)
  -h, --help        show this help

Examples:
  dry run, all cameras, new password NVR3:
    python3 nvr_dvrip_setcred.py 172.20.1.213 --cam_pass=NVR3
  write it and restart the NVR:
    python3 nvr_dvrip_setcred.py 172.20.1.213 --cam_pass=NVR3 --apply --reboot
  one channel: switch on + repair the connection id:
    python3 nvr_dvrip_setcred.py 172.20.1.212 --only=172.20.1.198 --enable --connid --apply --reboot

Safety:
  - before every --apply / --restore the current config is saved to
    nvr_backup_<ip>_<time>.json - it CONTAINS the camera passwords, keep it local
  - after writing, the config is read back and checked (verify)

Return codes:
  0 = done (dry run, or written and verified)
  1 = connection / login / write / verify error, 2 = usage error

Last output line (for scripts):
  RESULT tool=setcred rc=0 mode=apply changed=1 verify=ok backup=nvr_backup_...json

History:
  1.8  help / options like the other nvr_dvrip tools, no NVR or camera password in the
       code: user / password only change with --cam_pass, --force needs --cam_pass;
       RESULT line
  1.7  --connid; NVR user default per NVR IP
  1.6  --verbose prints the complete config of the shown channels
  1.5  unknown options rejected
  1.4  --enable, --reboot
  1.3  --nvr_user / --nvr_pass / --cam_user / --cam_pass
  1.2  --force
  1.1  channel-by-channel writes, --full = old mode
  1.0  first version
"""

TOOL = "nvr_dvrip_setcred"
VERSION = "1.8"
USAGE = ("python3 nvr_dvrip_setcred.py <nvr_ip> [--only=ip,ip] [--cam_user=X] [--cam_pass=Y] "
         "[--enable] [--connid] [--force] [--apply] [--reboot] [--full] [--restore=file] "
         "[--nvr_user=X] [--nvr_pass='Y'] [-v]")

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

CFG = "NetWork.RemoteDeviceV3"
SET_TIMEOUT = 45              # the NVR may need long to apply a channel
SET_OK = (100, 603)           # 603 = saved, restart needed (some firmwares)
DEFAULT_CAM_USER = "user"
CAM_PREFIX = "172.20.1."      # default camera range .171 - .198
CAM_FIRST, CAM_LAST = 171, 198


def is_cam(ip, only):
    if only:
        return ip in only
    if not ip.startswith(CAM_PREFIX):
        return False
    try:
        return CAM_FIRST <= int(ip[len(CAM_PREFIX):]) <= CAM_LAST
    except ValueError:
        return False


def channels(cfg):
    # yields (channel no, channel dict, decoder dict)
    for i, ch in enumerate(cfg):
        for dec in (ch.get("Decoder") or []):
            yield i + 1, ch, dec


def connid_zero(ch):
    try:
        return int(str(ch.get("SingleConnId", "0")), 16) == 0
    except ValueError:
        return True


def set_cfg(c, name, data):
    return c.send(MSG_CFG_SET, {"Name": name, name: data, "SessionID": c.sid()}, timeout=SET_TIMEOUT).get("Ret")


def reboot(c):
    # OPMachine Reboot; keep the socket open ~15 s, some firmwares abort the reboot otherwise
    body = json.dumps({"Name": "OPMachine", "OPMachine": {"Action": "Reboot"}, "SessionID": c.sid()},
                      separators=(",", ":")).encode("utf-8") + b"\x0a\x00"
    c.sock.sendall(HDR.pack(255, 0, c.session, c.seq, MSG_OPMACHINE, len(body)) + body)
    ret = None
    try:
        c.sock.settimeout(5)
        _, _, _, _, _, length = HDR.unpack(c._recv(HDR.size))
        ret = json.loads(c._recv(length).rstrip(b"\x00").rstrip(b"\x0a").decode("utf-8", "replace"),
                         strict=False).get("Ret")
    except Exception:
        pass
    time.sleep(15)
    c.close()
    return ret


def result(rc, mode, changed, verify, bak):
    print("RESULT tool=setcred rc=%d mode=%s changed=%d verify=%s backup=%s" % (rc, mode, changed, verify, bak or "-"))
    sys.exit(rc)


def main():
    pos, opts = parse_cli(("only", "apply", "restore", "full", "force", "enable", "connid", "reboot",
                           "nvr_user", "nvr_pass", "cam_user", "cam_pass"))
    ip = pos[0]
    user, pw = nvr_login(ip, opts)
    only = [x.strip() for x in opts.get("only", "").split(",") if x.strip()]
    apply_, restore = "apply" in opts, opts.get("restore", "")
    full, force, enable = "full" in opts, "force" in opts, "enable" in opts
    connid, do_reboot = "connid" in opts, "reboot" in opts
    creds = bool(opts.get("cam_pass"))
    cam_user = opts.get("cam_user") or DEFAULT_CAM_USER
    cam_pass = opts.get("cam_pass", "")
    if force and not creds:
        print("ERROR: --force needs --cam_pass")
        sys.exit(2)
    if "cam_user" in opts and not creds:
        print("ERROR: --cam_user needs --cam_pass")
        sys.exit(2)
    for name, val in (("cam_user", cam_user), ("cam_pass", cam_pass)):
        if val and not re.match(r"^[A-Za-z0-9]+$", val):
            print("ERROR: %s '%s' - only letters and digits allowed (missing space before '--'?)" % (name, val))
            sys.exit(2)
    mode = "restore" if restore else ("apply" if apply_ else "dry")
    todo_txt = [t for t, on in (("user/password", creds), ("enable", enable), ("connid", connid)) if on]
    print("%s %s - NVR %s (user %s)  mode: %s  changes: %s" % (
        TOOL, VERSION, ip, user, {"restore": "RESTORE", "apply": "APPLY", "dry": "DRY RUN"}[mode],
        ", ".join(todo_txt) or "none (table only)"))
    try:
        c = Dvrip(ip)
        c.login(user, pw)
        cfg = c.value(MSG_CFG_GET, CFG)
        if not isinstance(cfg, list):
            raise RuntimeError("%s not readable" % CFG)
    except Exception as e:
        print("[ERR] %s" % e)
        result(1, mode, 0, "-", "")

    bak = "nvr_backup_%s_%s.json" % (ip.replace(".", "_"), time.strftime("%Y%m%d_%H%M%S"))
    if restore:
        try:
            data = json.load(open(restore, encoding="utf-8"))
        except (OSError, ValueError) as e:
            print("[ERR] cannot read %s: %s" % (restore, e))
            result(1, mode, 0, "-", "")
        json.dump(cfg, open(bak, "w", encoding="utf-8"), indent=1)
        print("[OK] current config saved: %s" % bak)
        ret = set_cfg(c, CFG, data)
        ok = ret in SET_OK
        print("[%s] restore %s -> Ret=%s" % ("OK" if ok else "ERR", restore, ret))
        if ok and do_reboot:
            print("[OK] reboot sent -> Ret=%s - NVR is back in about 1-2 min" % reboot(c))
        result(0 if ok else 1, mode, len(data) if ok else 0, "-", bak)

    changed, todo_ch = 0, []
    print("  ch  camera IP        en ch/dec  connid  user           password")
    for no, ch, dec in channels(cfg):
        cam = dec.get("IPAddress", "")
        mark = is_cam(cam, only)
        old_u, old_p = dec.get("UserName", ""), dec.get("PassWord", "")
        need_en = enable and (dec.get("Enable") is not True or ch.get("Enable") is not True)
        need_cid = connid and connid_zero(ch)
        need_cred = creds and (force or old_u != cam_user or old_p != cam_pass)
        todo = mark and (need_cred or need_en or need_cid)
        what = ([("%s / %s" % (cam_user, "*" * len(cam_pass)))] if need_cred else []) \
            + (["+enable"] if need_en else []) + (["+connid 0x00000001"] if need_cid else [])
        pw_txt = "= new" if creds and old_p == cam_pass else ("empty" if not old_p else "set(%d)" % len(old_p))
        cid = str(ch.get("SingleConnId", ""))
        print("  %02d  %-15s  %-9s  %-6s  %-13s  %-10s %s" % (
            no, cam, "%s/%s" % (str(ch.get("Enable"))[0], str(dec.get("Enable"))[0]),
            cid[-2:] if cid else "-", old_u, pw_txt,
            ("-> " + " ".join(what)) if todo else ("(skip)" if not mark else "(nothing to do)")))
        if todo:
            if need_cred:
                dec["UserName"], dec["PassWord"] = cam_user, cam_pass
            if need_en:
                dec["Enable"] = ch["Enable"] = True
            if need_cid:
                ch["SingleConnId"] = "0x00000001"
            changed += 1
            if no not in todo_ch:
                todo_ch.append(no)

    if VERBOSE:
        for no, ch, dec in channels(cfg):
            if is_cam(dec.get("IPAddress", ""), only):
                print("\n--- channel %02d (%s) ---" % (no, dec.get("IPAddress", "")))
                print(json.dumps(mask(ch), indent=1, ensure_ascii=False))
    print("\n%d channel(s) to change." % changed)

    # check indexed access (read only): NetWork.RemoteDeviceV3.[n]
    idx_ok = False
    if todo_ch:
        n = todo_ch[0]
        key = "%s.[%d]" % (CFG, n - 1)
        data = c.value(MSG_CFG_GET, key)
        idx_ok = isinstance(data, dict) and bool(data.get("Decoder")) and \
            data["Decoder"][0].get("IPAddress") == cfg[n - 1]["Decoder"][0].get("IPAddress")
        print("channel-by-channel write (%s): %s" % (key, "supported" if idx_ok else "not supported"))

    if not apply_ or changed == 0:
        if not apply_:
            print("DRY RUN - nothing written. Add --apply to write.")
        elif do_reboot:
            print("[OK] nothing changed - reboot sent anyway -> Ret=%s" % reboot(c))
        result(0, mode, changed if not apply_ else 0, "-", "")

    with open(bak, "w", encoding="utf-8") as f:       # config as on the NVR, before our change
        json.dump(c.value(MSG_CFG_GET, CFG), f, indent=1)
    print("[OK] backup saved: %s (contains passwords - keep it local)" % bak)
    ret = None
    if full or not idx_ok:
        if not full:
            print("[ERR] channel-by-channel write not supported - use --full to write the whole list")
            result(1, mode, 0, "-", bak)
        ret = set_cfg(c, CFG, cfg)
        print("[%s] set %s -> Ret=%s" % ("OK" if ret in SET_OK else "ERR", CFG, ret))
        if ret not in SET_OK:
            result(1, mode, 0, "-", bak)
    else:
        for n in todo_ch:
            t0 = time.time()
            ret = set_cfg(c, "%s.[%d]" % (CFG, n - 1), cfg[n - 1])
            print("[%s] ch %02d %-15s set -> Ret=%s (%.1fs)" % ("OK" if ret in SET_OK else "ERR", n,
                  cfg[n - 1]["Decoder"][0].get("IPAddress"), ret, time.time() - t0))
            if ret not in SET_OK:
                result(1, mode, 0, "-", bak)

    time.sleep(1)
    bad = []
    for no, ch, dec in channels(c.value(MSG_CFG_GET, CFG) or []):
        if no not in todo_ch or not is_cam(dec.get("IPAddress", ""), only):
            continue
        if (creds and dec.get("UserName") != cam_user) or (enable and dec.get("Enable") is not True) \
                or (connid and connid_zero(ch)):
            bad.append("%02d %s" % (no, dec.get("IPAddress", "")))
    print("[%s] verify: %s" % ("OK" if not bad else "ERR",
          "all changed channels read back as written" if not bad else "not as written: " + ", ".join(bad)))
    if ret == 603:
        print("NOTE: NVR says restart needed (Ret=603).")
    if do_reboot:
        print("[OK] reboot sent -> Ret=%s - NVR is back in about 1-2 min" % reboot(c))
    else:
        print("NOTE: restart the NVR now (or use --reboot) - writing may break its network until restart.")
    result(0 if not bad else 1, mode, changed, "ok" if not bad else "err", bak)


if __name__ == "__main__":
    main()
