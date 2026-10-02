#!/usr/bin/env python3
"""nvr_dvrip_storage.py - version 1.1 (2026-10-01)

READ-ONLY hard disk / storage diagnosis of an XMEye NVR via DVRIP / Sofia (TCP 34567).
Shows system info and uptime, every disk / partition (status, size, free space,
recorded time range), the work state, storage related configs and the NVR log of
the last days, filtered for disk / storage / reboot / power entries, plus the newest
log entries. Nothing is written to the NVR (no format, no disk manager commands).

Usage:
  python3 nvr_dvrip_storage.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y']
                               [--days=N] [--all] [--json] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.212

Options:
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  --days=N          log range in days back from today 00:00 (default 3)
  --all             print every log entry, not only the filtered ones
  --json            also write nvr_storage_<ip>_<time>.json (raw answers, passwords masked)
  -v, --verbose     print every DVRIP request / answer (passwords masked)
  -h, --help        show this help

What to look for:
  disk status 0 = normal; type 0 = read/write, 1 = read only, 2 = snapshot, 3 = redundant
  no disk / total 0 GB         -> NVR does not see the disk (cable, power, disk dead)
  log "StorageDeviceError"     -> read / write errors on the disk
  log "ShutDown" + "Reboot <time>" -> clean shutdown; the Reboot entry names the
                                  time of the last clean shutdown

Return codes:
  0 = disk present, status normal, no storage error since the last NVR start
  4 = no disk, disk status not normal, or storage errors since the last NVR start
      (errors before the last start are shown and counted, but do not set rc 4)
  1 = connection / login error, 2 = usage error

Last output line (for scripts):
  RESULT tool=storage rc=0 disks=1 total_gb=3726 records_end=2026-09-15_09:59:15 storage_errors=0 since_boot=0

History:
  1.1  help / options like the other nvr_dvrip tools, no password in the code,
       NVR user default per IP, return code 4, RESULT line
  1.0  first version
"""

TOOL = "nvr_dvrip_storage"
VERSION = "1.1"
USAGE = ("python3 nvr_dvrip_storage.py <nvr_ip> [--nvr_user=X] [--nvr_pass='Y'] "
         "[--days=N] [--all] [--json] [-v]")

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

CONFIGS = ["General.General", "Storage.StorageGlobal", "Record", "Storage.StoragePosition"]
LOG_FILTER = re.compile(r"disk|hdd|storage|harddisk|sata|format|reboot|restart|shutdown|power|"
                        r"exception|abnormal|error|nodisk|wfs", re.I)
STORAGE_ERR = re.compile(r"StorageDeviceError|StorageNotExist|StorageLowSpace|StorageFailure", re.I)


def gb(v):
    # sizes come as hex strings in MB ("0x001D1C5A") -> GB as float
    try:
        n = int(str(v), 16) if str(v).lower().startswith("0x") else int(v)
    except (TypeError, ValueError):
        return 0.0
    return n / 1024.0


def log_query(c, begin, end, pos):
    return c.send(MSG_LOG_QUERY, {"Name": "OPLogQuery", "SessionID": c.sid(),
                                  "OPLogQuery": {"BeginTime": begin, "EndTime": end,
                                                 "LogPosition": pos, "Type": "LogAll"}})


def main():
    pos, opts = parse_cli(("nvr_user", "nvr_pass", "days", "all", "json"))
    ip = pos[0]
    user, pw = nvr_login(ip, opts)
    try:
        days = int(opts.get("days") or 3)
    except ValueError:
        print("ERROR: --days must be a number")
        sys.exit(2)
    out = {"nvr": ip}
    print("%s %s - %s:%d (read-only, user %s)" % (TOOL, VERSION, ip, NVR_PORT, user))
    try:
        c = Dvrip(ip)
        c.login(user, pw)
    except Exception as e:
        print("[ERR] %s" % e)
        print("RESULT tool=storage rc=1 error=login")
        sys.exit(1)
    print("[OK] login")

    si = c.value(MSG_INFO, "SystemInfo") or {}
    out["SystemInfo"] = si
    if isinstance(si, dict):
        print("\n=== system ===")
        for k in ("HardWare", "SoftWareVersion", "BuildTime", "DeviceRunTime", "DigChannel", "VideoOutChannel"):
            if k in si:
                print("  %-16s %s" % (k, si[k]))
        try:
            print("  %-16s %.1f h" % ("uptime", int(str(si.get("DeviceRunTime")), 16) / 60.0))
        except (TypeError, ValueError):
            pass

    r = c.get(MSG_INFO, "StorageInfo")
    out["StorageInfo"] = r
    disks = r.get("StorageInfo") or []
    problem = not disks
    total, rec_end = 0.0, "-"
    print("\n=== storage (Ret=%s) ===" % r.get("Ret"))
    if not disks:
        print("  NO DISK REPORTED - the NVR does not see any hard disk")
    for d in disks:
        print("  physical disk %s, partitions: %s" % (d.get("PlysicalNo", d.get("PhysicalNo", "?")),
                                                      d.get("PartNumber", "?")))
        for p in d.get("Partition") or []:
            size = gb(p.get("TotalSpace"))
            print("    part %-2s status=%-3s type=%-3s current=%-5s total=%8.1f GB free=%8.1f GB" % (
                p.get("LogicSerialNo", "?"), p.get("Status", "?"), p.get("DirverType", p.get("DriverType", "?")),
                p.get("IsCurrent", "?"), size, gb(p.get("RemainSpace"))))
            print("            records new %s .. %s  old %s .. %s" % (
                p.get("NewStartTime", "-"), p.get("NewEndTime", "-"),
                p.get("OldStartTime", "-"), p.get("OldEndTime", "-")))
            if size > 0:
                total += size
                if str(p.get("Status")) not in ("0", ""):
                    problem = True
                end = str(p.get("NewEndTime", ""))
                if end and not end.startswith("0000") and (rec_end == "-" or end > rec_end):
                    rec_end = end
    if disks and total == 0:
        print("  DISK REPORTED WITH 0 GB - the NVR cannot read it")
        problem = True
    print("  (status 0 = normal; type 0 = read/write, 1 = read only, 2 = snapshot, 3 = redundant)")

    st = c.value(MSG_INFO, "WorkState")
    out["WorkState"] = st
    if isinstance(st, dict):
        print("\n=== work state ===")
        for k, v in st.items():
            if k != "ChannelState":
                print("  %-16s %s" % (k, json.dumps(v)[:200]))

    print("\n=== storage configs ===")
    out["configs"] = {}
    for name in CONFIGS:
        try:
            r = c.get(MSG_CFG_GET, name)
        except Exception as e:
            print("  %-24s error: %s" % (name, e))
            continue
        data = r.get(name)
        out["configs"][name] = mask(data) if data is not None else {"Ret": r.get("Ret")}
        if r.get("Ret") in OK_CODES and data is not None:
            txt = json.dumps(mask(data), ensure_ascii=False)
            print("  %-24s %s" % (name, txt[:300] + ("..." if len(txt) > 300 else "")))
        else:
            print("  %-24s Ret=%s (not available)" % (name, r.get("Ret")))

    end = time.strftime("%Y-%m-%d %H:%M:%S")
    begin = time.strftime("%Y-%m-%d 00:00:00", time.localtime(time.time() - days * 86400))
    print("\n=== log %s .. %s (%s) ===" % (begin, end, "all" if "all" in opts else "filtered"))
    entries, lpos = [], 0
    for _ in range(50):                      # max 50 pages
        try:
            r = log_query(c, begin, end, lpos)
        except Exception as e:
            print("  log query error: %s" % e)
            break
        page = r.get("OPLogQuery") or []
        if r.get("Ret") not in OK_CODES or not page:
            if not entries:
                print("  Ret=%s, no log entries" % r.get("Ret"))
            break
        entries += page
        lpos = max(int(e.get("Position", 0)) for e in page) + 1
        if len(page) < 50:
            break
    c.close()
    out["log"] = entries
    shown = errors = since_boot = 0
    for e in entries:
        line = "%s  %-22s %-12s %s" % (e.get("Time", ""), e.get("Type", ""), e.get("User", ""), e.get("Data", ""))
        if str(e.get("Type", "")).strip() == "Reboot":      # NVR start (not "Reboot IPC")
            since_boot = 0
        if STORAGE_ERR.search(line):
            errors += 1
            since_boot += 1
        if "all" in opts or LOG_FILTER.search(line):
            print("  " + line)
            shown += 1
    print("  -> %d of %d entries shown, storage error entries: %d in range, %d since last NVR start"
          % (shown, len(entries), errors, since_boot))
    if entries and "all" not in opts:
        print("  newest entries:")
        for e in entries[-10:]:
            print("  %s  %-22s %-12s %s" % (e.get("Time", ""), e.get("Type", ""), e.get("User", ""), e.get("Data", "")))

    if "json" in opts:
        fn = "nvr_storage_%s_%s.json" % (ip.replace(".", "_"), time.strftime("%Y%m%d_%H%M%S"))
        with open(fn, "w", encoding="utf-8") as f:
            json.dump(mask(out), f, indent=1, ensure_ascii=False)
        print("\nwritten: %s" % fn)
    rc = 4 if problem or since_boot else 0
    print("RESULT tool=storage rc=%d disks=%d total_gb=%.0f records_end=%s storage_errors=%d since_boot=%d" % (
        rc, len(disks), total, rec_end.replace(" ", "_"), errors, since_boot))
    sys.exit(rc)


if __name__ == "__main__":
    main()
