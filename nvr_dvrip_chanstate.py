#!/usr/bin/env python3
"""nvr_dvrip_chanstate.py - version 1.2 (2026-10-01)

READ-ONLY live state of the digital channels of an XMEye NVR via DVRIP / Sofia
(TCP 34567): which camera is connected, which records, which has a record plan.
Used after switching the active NVR (camera password changed, NVR restarted) to
check that it took over all cameras. Nothing is written to the NVR.

Sources:
  NetWork.ChnStatus       (config 1042) status per channel (see below)
  WorkState               (info 1020)   ChannelState[n]: Bitrate (kbit/s), Record
  NetWork.RemoteDeviceV3  (config 1042) camera IP per channel
  Record                  (config 1042) record mode / schedule per channel

Usage:
  python3 nvr_dvrip_chanstate.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y']
                                 [--wait=SEC] [--raw] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.213

Options:
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  --wait=SEC        repeat the check every 10 s until no used channel is "NoLogin"
                    any more (NVR still working through its channels after a start)
                    or all are connected, max. SEC seconds (default 0 = check once)
  --raw             print the raw NetWork.ChnStatus list and the record config of
                    channel 1
  -v, --verbose     print every DVRIP request / answer (passwords masked)
  -h, --help        show this help

Channel status (NetWork.ChnStatus):
  Connected    stream is running
  LoginFailed  camera refused the login (wrong camera password - normal for the
               inactive NVRs, their archive stays frozen)
  NoLogin      the NVR has not tried this channel yet (first minutes after a start)
  Offline      camera did not answer
  NoConfig     channel not configured (also when SingleConnId is 0, see
               nvr_dvrip_setcred --connid)
Columns:
  rec   WorkState Record flag; it means "recording armed", it is also "yes" on
        channels without stream - a channel counts as recording only if connected
  plan  ALWAYS = manual record, SCHED = schedule with active time sections,
        NO-SCHED = schedule without active section, OFF = record closed

Return codes:
  0 = all used channels connected and recording, all with a record plan
  4 = some channel not connected / not recording / without record plan
  1 = connection / login / read error, 2 = usage error

Last output line (for scripts):
  RESULT tool=chanstate rc=0 connected=28 recording=28 used=28 nologin=0 missing=- notrec=- noplan=-

History:
  1.2  --wait (repeat until no channel is "NoLogin"), help / options like the other
       nvr_dvrip tools, no password in the code, nologin count in RESULT
  1.1  status from NetWork.ChnStatus, record plan column, "connected but not recording"
  1.0  first version (WorkState bitrate / record)
"""

TOOL = "nvr_dvrip_chanstate"
VERSION = "1.2"
USAGE = ("python3 nvr_dvrip_chanstate.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] "
         "[--wait=SEC] [--raw] [-v]")

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

WAIT_POLL_SEC = 10


def cam_ip(ch):
    for d in (ch or {}).get("Decoder") or []:
        ip = d.get("IPAddress") or d.get("Address")
        if ip:
            return ip
    return None


def plan_of(rec):
    # record config of one channel -> ALWAYS / OFF / SCHED / NO-SCHED / ?
    if not isinstance(rec, dict):
        return "?"
    mode = str(rec.get("RecordMode", ""))
    if mode.startswith("Manual"):
        return "ALWAYS"
    if mode.startswith("Closed"):
        return "OFF"
    if mode.startswith("Config"):
        for day in rec.get("TimeSection") or []:
            for sec in day or []:
                s = str(sec)
                if s.startswith("1 ") and not s.endswith("00:00:00-00:00:00"):
                    return "SCHED"
        return "NO-SCHED"
    return mode or "?"


def read_all(ip, user, pw):
    c = Dvrip(ip)
    try:
        c.login(user, pw)
        return (c.value(MSG_CFG_GET, "NetWork.RemoteDeviceV3") or [],
                c.value(MSG_CFG_GET, "NetWork.ChnStatus") or [],
                c.value(MSG_INFO, "WorkState") or {},
                c.value(MSG_CFG_GET, "Record") or [])
    finally:
        c.close()


def evaluate(chans, chn, ws, recs):
    states = ws.get("ChannelState") if isinstance(ws, dict) else None
    states = states if isinstance(states, list) else []
    rows, res = [], {"used": 0, "conn": 0, "rec": 0, "nologin": 0,
                     "missing": [], "notrec": [], "noplan": []}
    for i in range(max(len(chans), len(chn), len(states))):
        ip_ = cam_ip(chans[i]) if i < len(chans) else None
        st = states[i] if i < len(states) and isinstance(states[i], dict) else {}
        cs = chn[i] if i < len(chn) and isinstance(chn[i], dict) else {}
        try:
            br = int(st.get("Bitrate", 0))
        except (TypeError, ValueError):
            br = 0
        if not ip_ and not br:
            continue                                   # no camera on this channel
        rec = bool(st.get("Record"))
        status = cs.get("Status") or ("Connected" if br > 0 else "NoStream")
        ok = status == "Connected" if cs else br > 0
        plan = plan_of(recs[i]) if i < len(recs) else ""
        flag = ""
        if ip_:
            res["used"] += 1
            if ok:
                res["conn"] += 1
                if rec:
                    res["rec"] += 1
                else:
                    res["notrec"].append(ip_)
                    flag = "  <- connected, NOT recording"
            else:
                res["missing"].append(ip_)
                if status == "NoLogin":
                    res["nologin"] += 1
            if plan in ("OFF", "NO-SCHED"):
                res["noplan"].append(ip_)
                flag = flag or "  <- no record plan"
        rows.append("  %02d  %-15s %-12s %-10s %8s  %-5s %s%s" % (
            i + 1, ip_ or "-", status[:12], str(cs.get("CurRes", "-")).split("/")[0][:10],
            br, "yes" if rec else "no", plan, flag))
    return rows, res


def main():
    pos, opts = parse_cli(("nvr_user", "nvr_pass", "wait", "raw"))
    ip = pos[0]
    user, pw = nvr_login(ip, opts)
    try:
        wait = int(opts.get("wait") or 0)
    except ValueError:
        print("ERROR: --wait must be a number")
        sys.exit(2)
    print("%s %s - %s:%d (read-only, user %s) %s" % (TOOL, VERSION, ip, NVR_PORT, user,
                                                   time.strftime("%Y-%m-%d %H:%M:%S")))
    t0 = time.time()
    while True:
        try:
            chans, chn, ws, recs = read_all(ip, user, pw)
        except Exception as e:
            if wait and time.time() - t0 < wait:      # NVR may still be starting
                log("[--] %s - retry in %d s" % (e, WAIT_POLL_SEC))
                time.sleep(WAIT_POLL_SEC)
                continue
            print("[ERR] %s" % e)
            print("RESULT tool=chanstate rc=1 error=read")
            sys.exit(1)
        rows, res = evaluate(chans, chn, ws, recs)
        done = bool(chn) and (res["nologin"] == 0 or res["conn"] == res["used"])
        if not wait or done or time.time() - t0 >= wait:
            break
        log("connected %d of %d, %d still NoLogin - check again in %d s (%.0f of %d s)"
            % (res["conn"], res["used"], res["nologin"], WAIT_POLL_SEC, time.time() - t0, wait))
        time.sleep(WAIT_POLL_SEC)

    if not chans:
        print("[--] NetWork.RemoteDeviceV3 not readable - camera IPs unknown")
    if not chn:
        print("[--] NetWork.ChnStatus not readable - status from bitrate only")
    if not recs:
        print("[--] record config 'Record' not readable - plan column empty")
    if "raw" in opts:
        print("\n=== raw NetWork.ChnStatus ===")
        for i, s in enumerate(chn):
            if isinstance(s, dict) and s.get("ChnName"):
                print("  %02d %s" % (i + 1, json.dumps(s, ensure_ascii=False)))
        print("\n=== raw record config channel 1 ===")
        print("  " + json.dumps(recs[0] if recs else None, ensure_ascii=False)[:1500])

    print("\n=== channels ===")
    print("  ch  %-15s %-12s %-10s %8s  %-5s %s" % ("camera", "status", "resolution", "bitrate", "rec", "plan"))
    for r in rows:
        print(r)
    print("\nconnected %d of %d used channels, recording %d%s" % (
        res["conn"], res["used"], res["rec"], " (waited %.0f s)" % (time.time() - t0) if wait else ""))
    if res["missing"]:
        print("not connected     : %s" % ", ".join(res["missing"]))
    if res["nologin"]:
        print("still NoLogin     : %d channel(s) - NVR has not tried them yet" % res["nologin"])
    if res["notrec"]:
        print("connected, no rec : %s" % ", ".join(res["notrec"]))
    if res["noplan"]:
        print("no record plan    : %s" % ", ".join(res["noplan"]))
    ok = res["used"] and res["conn"] == res["used"] and res["rec"] == res["used"] and not res["noplan"]
    rc = 0 if ok else 4
    print("RESULT tool=chanstate rc=%d connected=%d recording=%d used=%d nologin=%d missing=%s notrec=%s noplan=%s" % (
        rc, res["conn"], res["rec"], res["used"], res["nologin"], ",".join(res["missing"]) or "-",
        ",".join(res["notrec"]) or "-", ",".join(res["noplan"]) or "-"))
    sys.exit(rc)


if __name__ == "__main__":
    main()
