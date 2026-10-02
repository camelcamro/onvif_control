#!/usr/bin/env python3
"""nvr_dvrip_power.py - version 1.3 (2026-10-01)

Clean shutdown, soft reboot and state check of an XMEye NVR via DVRIP / Sofia
(TCP 34567). Used before the power of an NVR is cut (e.g. Tasmota switch), so the
hard disk is not damaged, and to restart an NVR so it retries the camera logins.

Usage:
  python3 nvr_dvrip_power.py <nvr_ip> <mode> [--nvr_user=X] [--nvr_pass='Y']
                             [--wait=SEC] [--min=SEC] [-v]

Arguments:
  <nvr_ip>          IP address of the NVR, e.g. 172.20.1.212
  <mode>            check     show the state only (nothing is sent)
                    shutdown  stop the NVR software so the power can be cut
                    reboot    soft restart, waits until the NVR answers again
                    probe     send an unknown action to see how the firmware answers

Options:
  --nvr_user=X      NVR login user (default: per NVR IP from NVR_USERS, else admin)
  --nvr_pass='Y'    NVR login password (default: environment variable NVR_PASS)
  --wait=SEC        max. wait for the NVR to go down after a command (default 60)
  --min=SEC         shutdown: min. time since the command before rc 0 (default 75)
  -v, --verbose     print every DVRIP request / answer and every state poll
  -h, --help        show this help

States:
  running  the NVR software answers the login (any answer, even "wrong password")
  halted   port 34567 accepts but the login gets no answer -> software stopped,
           power may be cut. Ping, the web login page and port 34567 stay alive:
           XMEye "Shutdown" stops the NVR software, Linux keeps running.
  off      port 34567 closed / host unreachable

Shutdown sequence (measured on NBD80N36RA-KL-V3, firmware V4.03.R11):
  - "Shutdown" sent -> the NVR software stops after 1-3 s (state halted)
  - the NVR logs "ShutDown - Wait shutdown for 1 minute" and finishes 60 s after
    the command; the next start logs "Reboot <time of the clean shutdown>"
  - this tool returns rc 0 only when the NVR stayed down for 20 s AND at least
    --min seconds (75) have passed since the command
  - the firmware answers Ret=100 even to unknown actions (see mode probe), so
    "Shutdown", "ShutDown" and "Halt" are tried one after the other until the
    NVR really goes down
  - recommended afterwards: wait 60 s, power off, stay off >= 30 s, power on

Return codes:
  check    : 0 = running, 6 = halted, 3 = off
  shutdown : 0 = down long enough -> power may be cut now
             3 = still running after all commands  (do NOT cut power)
             4 = came back during the check, rebooted (do NOT cut power)
             5 = all commands rejected             (do NOT cut power)
  reboot   : 0 = went down and answers again, 3 = did not go down / not back in 300 s
             5 = rejected
  probe    : 0 = done
  all      : 1 = connection / login error, 2 = usage error

Last output line (for scripts):
  RESULT tool=power mode=shutdown rc=0 state=halted seconds=75

History:
  1.3  help / options like the other nvr_dvrip tools, no password in the code
  1.2  shutdown rc 0 only after --min seconds (75) since the command; state detail
       "connection closed at once" / "no answer"; RESULT line
  1.1  "down" = login gets no answer (not "port closed"); states running / halted / off;
       tries Shutdown, ShutDown, Halt; mode probe; user / password as options
  1.0  first version
"""

TOOL = "nvr_dvrip_power"
VERSION = "1.3"
USAGE = ("python3 nvr_dvrip_power.py <nvr_ip> check|shutdown|reboot|probe "
         "[--nvr_user=X] [--nvr_pass='Y'] [--wait=SEC] [--min=SEC] [-v]")

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

ACTIONS = ["Shutdown", "ShutDown", "Halt"]   # tried in this order until the NVR goes down
ACTION_WAIT_SEC = 60          # max. wait for "down" after each shutdown attempt
STAY_DOWN_SEC = 20            # must stay halted / off this long
MIN_SHUTDOWN_SEC = 75         # NVR finishes its shutdown 60 s after the command (+15 s reserve)
WAIT_UP_SEC = 300             # reboot: max. wait until the NVR answers again
LOGIN_TIMEOUT = 5             # no login answer within this time -> software down
CONNECT_TIMEOUT = 3
POLL_SEC = 3
PROBE_ACTION = "XyzTest"      # deliberately unknown action for mode probe

USER = PASS = ""
DETAIL = ""                   # reason of the last state() result


def state(ip):
    # running / halted / off, reason in DETAIL
    global DETAIL
    try:
        c = Dvrip(ip, timeout=LOGIN_TIMEOUT, connect_timeout=CONNECT_TIMEOUT)
    except OSError:
        DETAIL = "port closed / unreachable"
        return "off"
    try:
        r = c.send(MSG_LOGIN, {"EncryptType": "MD5", "LoginType": "DVRIP-Web",
                               "PassWord": sofia_hash(PASS), "UserName": USER})
        DETAIL = "answers" if "Ret" in r else "no JSON answer"
        return "running" if "Ret" in r else "halted"
    except socket.timeout:
        DETAIL = "no answer within %d s" % LOGIN_TIMEOUT
        return "halted"
    except (OSError, ConnectionError, struct.error):
        DETAIL = "connection closed at once"
        return "halted"
    finally:
        c.close()


def wait_not_running(ip, limit):
    t0 = time.time()
    while time.time() - t0 < limit:
        s = state(ip)
        vprint("state: %s (%.0f s, %s)" % (s, time.time() - t0, DETAIL))
        if s != "running":
            return s
        time.sleep(POLL_SEC)
    return "running"


def send_action(ip, action):
    # -> "ok", "rejected" or "error:<text>"
    try:
        c = Dvrip(ip)
    except OSError as e:
        return "error:%s" % e
    try:
        c.login(USER, PASS)
        log("[OK] login as %s" % USER)
        try:
            r = c.send(MSG_OPMACHINE, {"Name": "OPMachine", "SessionID": c.sid(),
                                       "OPMachine": {"Action": action}})
        except (OSError, ConnectionError, struct.error) as e:
            log("[OK] OPMachine %s sent - NVR closed the connection (%s)" % (action, e))
            return "ok"
        if r.get("Ret") in OK_CODES:
            log("[OK] OPMachine %s answered Ret=%s" % (action, r.get("Ret")))
            return "ok"
        log("[--] OPMachine %s rejected (Ret=%s)" % (action, r.get("Ret")))
        return "rejected"
    except Exception as e:
        return "error:%s" % e
    finally:
        c.close()


def do_shutdown(ip, wait, min_sec):
    s0 = state(ip)
    if s0 != "running":
        log("NVR is not running (state %s, %s) - no shutdown sent by this run" % (s0, DETAIL))
        log("[OK] power can be cut (NVR was already down before this run)")
        return 0, "already_" + s0, 0
    t_start = time.time()
    t_cmd, accepted = None, False
    for action in ACTIONS:
        t_try = time.time()
        res = send_action(ip, action)
        if res.startswith("error:"):
            log("[ERR] %s" % res[6:])
            return 1, "error", time.time() - t_start
        if res == "rejected":
            continue
        accepted, t_cmd = True, t_try
        log("waiting for the NVR software to stop (max %d s) ..." % wait)
        s = wait_not_running(ip, wait)
        if s != "running":
            log("[OK] NVR %s after %.0f s (action %s, %s)" % (s.upper(), time.time() - t_cmd, action, DETAIL))
            break
        log("[--] still running %d s after %s - trying the next action" % (wait, action))
    else:
        if not accepted:
            log("[ERR] NVR rejected all commands - power must NOT be cut")
            return 5, "rejected", time.time() - t_start
        log("[ERR] NVR still running after all actions - power must NOT be cut")
        return 3, "running", time.time() - t_start

    t_down = time.time()
    left = max(STAY_DOWN_SEC, min_sec - (t_down - t_cmd))
    log("checking that it stays down for %.0f s (min. %d s since the command, NVR needs 60 s) ..."
        % (left, min_sec))
    last_info = time.time()
    while time.time() - t_down < STAY_DOWN_SEC or time.time() - t_cmd < min_sec:
        time.sleep(POLL_SEC)
        s = state(ip)
        vprint("state: %s (%s)" % (s, DETAIL))
        if s == "running":
            log("[ERR] NVR answers again - it rebooted instead of shutting down. Do NOT cut power.")
            return 4, "came_back", time.time() - t_start
        if time.time() - last_info >= 15:
            log("  still %s, %.0f s since the command" % (s, time.time() - t_cmd))
            last_info = time.time()
    log("[OK] NVR is %s, %.0f s since the command - power can be cut now (total %.0f s)"
        % (s.upper(), time.time() - t_cmd, time.time() - t_start))
    return 0, s, time.time() - t_start


def do_reboot(ip, wait):
    res = send_action(ip, "Reboot")
    if res.startswith("error:"):
        log("[ERR] %s" % res[6:])
        return 1
    if res == "rejected":
        return 5
    t0 = time.time()
    s = wait_not_running(ip, wait)
    if s == "running":
        log("[ERR] NVR did not go down within %d s" % wait)
        return 3
    log("[OK] NVR %s after %.0f s (%s), waiting until it answers again (max %d s) ..."
        % (s, time.time() - t0, DETAIL, WAIT_UP_SEC))
    t0 = time.time()
    while time.time() - t0 < WAIT_UP_SEC:
        if state(ip) == "running":
            log("[OK] NVR running again after %.0f s" % (time.time() - t0))
            return 0
        time.sleep(5)
    log("[ERR] NVR not back after %d s (disk check running?)" % WAIT_UP_SEC)
    return 3


def do_probe(ip):
    log("sending the unknown action '%s' to see how the firmware answers ..." % PROBE_ACTION)
    res = send_action(ip, PROBE_ACTION)
    if res == "ok":
        log("-> firmware answers Ret=100 even to an unknown action: Ret alone proves nothing")
    elif res == "rejected":
        log("-> firmware rejects unknown actions: Ret=100 means the action is known")
    else:
        log("-> %s" % res)
        return 1
    log("state now: %s (%s)" % (state(ip), DETAIL))
    return 0


def main():
    global USER, PASS
    pos, opts = parse_cli(("nvr_user", "nvr_pass", "wait", "min"), npos=(2,))
    ip, mode = pos
    if mode not in ("check", "shutdown", "reboot", "probe"):
        print("ERROR: unknown mode '%s' - use check, shutdown, reboot or probe" % mode)
        sys.exit(2)
    USER, PASS = nvr_login(ip, opts)
    try:
        wait = int(opts.get("wait") or ACTION_WAIT_SEC)
        min_sec = int(opts.get("min") or MIN_SHUTDOWN_SEC)
    except ValueError:
        print("ERROR: --wait / --min must be numbers")
        sys.exit(2)
    log("%s %s - %s %s (user %s)" % (TOOL, VERSION, ip, mode, USER))
    t0 = time.time()

    if mode == "check":
        s = state(ip)
        text = {"running": "RUNNING (NVR software answers)",
                "halted": "HALTED (port open, software stopped - power may be cut)",
                "off": "OFF (port 34567 closed / unreachable)"}[s]
        log("state: %s - %s" % (text, DETAIL))
        rc = {"running": 0, "halted": 6, "off": 3}[s]
        print("RESULT tool=power mode=check rc=%d state=%s" % (rc, s))
        sys.exit(rc)
    if mode == "shutdown":
        rc, st, dur = do_shutdown(ip, wait, min_sec)
        print("RESULT tool=power mode=shutdown rc=%d state=%s seconds=%.0f" % (rc, st, dur))
        sys.exit(rc)
    if mode == "reboot":
        rc = do_reboot(ip, wait)
    else:
        rc = do_probe(ip)
    print("RESULT tool=power mode=%s rc=%d state=%s seconds=%.0f" % (mode, rc, state(ip), time.time() - t0))
    sys.exit(rc)


if __name__ == "__main__":
    main()
