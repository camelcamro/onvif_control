# ONVIF Event Listening – End‑to‑End Guide (Push mode + Listener)

This guide shows how to receive ONVIF Events from a camera by **subscribing in push mode** and running a small **HTTP listener** that logs the incoming SOAP notifications.

It’s written for beginners and power users alike, with copy‑pasteable commands and plenty of troubleshooting notes.

---

## Components in this setup

- **`onvif_control_event_listener.js`** (v1.0.5) – a tiny Node.js HTTP server that:
  - Listens for ONVIF `Notify` POSTs (SOAP/XML).
  - Prints events to the console (with timestamps).
  - Appends full raw payloads to a log file (with timestamps) and does simple log rotation at ~20 MB.
  - CLI flags: `--port`, `--path`, `--outfile`, `--verbose`, `--debug`, `--help`.

- **`onvif_control.<version>.js`** (≥ v1.1.9) – a command‑line tool that talks to your camera’s ONVIF services:
  - `subscribe_events` (push & pull; push is recommended here).
  - `renew_subscription` (extend subscription lifetime).
  - `unsubscribe` (cleanly remove a subscription).
  - Optional `--auto_renew` loop during `subscribe_events` to keep a push subscription alive.

> **Note:** Some cameras support only push (HTTP delivery), some only pull (PullPoint), and some both. If the camera rejects pull, use push (as in this guide).

---

## Prerequisites

- **Node.js** installed on the machine that runs the tools (Node 14+ recommended).
- Your **camera IP/port** and **ONVIF credentials** (username/password).
- A machine (the “listener host”) with an IP reachable by the camera, e.g. `172.20.1.103`.
- **Firewall/NAT** allows camera → listener HTTP POST to the chosen `--port` (default 9000).
- **Time sync**: keep both camera and listener system time correct (NTP). ONVIF often reports UTC (`…Z`) while your local console shows local time. That’s normal.

---

## Quick Start (TL;DR)

### 1) Start the listener (in its own terminal)

```bash
node /home/onvif/onvif_control_event_listener.js \
  --port=9000 \
  --path=/onvif_hook \
  --outfile=/tmp/onvif_control_listener.txt \
  --verbose --debug
```

You should see something like:

```
2025-08-26 09:43:40 - [INFO] onvif_control_event_listener v1.0.5 listening on 0.0.0.0:9000/onvif_hook
2025-08-26 09:43:40 - [INFO] writing to: /tmp/onvif_control_listener.txt (rotate at 20 MB)
2025-08-26 09:43:40 - [INFO] debug enabled
```

### 2) Subscribe the camera to push events (in another terminal)

```bash
node /home/onvif/onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --termination=PT300S \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --verbose --debug
```

If the camera accepts, you’ll get a `SubscriptionReference` URL and a `TerminationTime` (UTC).

**Optional:** keep the subscription alive automatically (runs in a loop and renews just before expiry):

```bash
node /home/onvif/onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --termination=PT300S \
  --auto_renew \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --verbose --debug
```

### 3) Verify the listener receives events

- Trigger motion/events on the camera (walk in front of it or set motion sensitivity high).
- Watch the listener terminal; with `--debug` you’ll see headers and **full raw SOAP body** plus “event written → …”.
- The file `/tmp/onvif_control_listener.txt` will contain the raw XML payloads prefixed with timestamps.

Example console output when an event arrives:

```
2025-08-26 09:54:09 - [VERBOSE] event written → /tmp/onvif_control_listener.txt
2025-08-26 09:54:09 - [DEBUG] request from 172.20.1.172 → POST /onvif_hook
2025-08-26 09:54:09 - [DEBUG] headers: {"host":"172.20.1.103:9000","user-agent":"gSOAP/2.8", ...}
2025-08-26 09:54:09 - [DEBUG] raw body:
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope ...>
  <SOAP-ENV:Body>
    <wsnt:Notify> ... </wsnt:Notify>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
2025-08-26 09:54:09 - [DEBUG] replied 200 OK to 172.20.1.172
```

---

## Understanding the data flow

```
+-----------+       Subscribe (push)       +----------------------------+
|  Client   | ---------------------------> |  Camera (ONVIF Events svc) |
| onvif_... |                              +----------------------------+
| control   |                                     |
| (CLI)     |                                     | HTTP POST wsnt:Notify
+-----------+                                     v
                                          +-----------------------------+
                                          | Listener (HTTP server)      |
                                          | onvif_control_event_listener|
                                          | writes to log file          |
                                          +-----------------------------+
```

- The CLI performs `Subscribe` against the camera’s **Events XAddr**.
- The camera stores a **Subscription** (with an expiration time).
- While the subscription is valid, the **camera pushes** event notifications (SOAP/XML `wsnt:Notify`) to the listener URL.
- You can **renew** to extend the expiration, or **unsubscribe** to clean up.

---

## CLI Reference

### 1) `onvif_control_event_listener.js`

**Usage:**
```bash
node onvif_control_event_listener.js [--port <int>] [--path <string>] \
  [--outfile <path>] [--verbose] [--debug] [--help]
```

**Options:**
- `--port` (default: `9000`) – TCP port to listen on.
- `--path` (default: `/onvif_hook`) – HTTP path the camera will POST to.
- `--outfile` (default: `/tmp/onvif_control_listener.txt`) – file where raw events are appended.  
  The listener rotates the file at ~20 MB (keeps one `*.1` backup).
- `--verbose` – print “event written → …” messages.
- `--debug` – print request origin, headers, **full raw body**, and reply status to console.
- `--help` – show usage.

**Notes:**
- The listener binds to `0.0.0.0`. Ensure firewalls allow inbound traffic on `--port`.
- Timestamps on console/file are local time of the listener machine; XML may contain UTC timestamps from the camera.

**Testing without a camera:**
```bash
curl -s -X POST "http://127.0.0.1:9000/onvif_hook" \
  -H "Content-Type: application/soap+xml" \
  --data-binary @- <<'XML'
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Body>
    <wsnt:Notify>
      <wsnt:NotificationMessage>
        <wsnt:Topic>tns1:RuleEngine/CellMotionDetector/Motion</wsnt:Topic>
        <wsnt:Message>
          <tt:Message UtcTime="2025-08-26T00:00:00Z">
            <tt:Data>
              <tt:SimpleItem Name="Motion" Value="true"/>
              <tt:SimpleItem Name="Window" Value="0"/>
            </tt:Data>
          </tt:Message>
        </wsnt:Message>
      </wsnt:NotificationMessage>
    </wsnt:Notify>
  </s:Body>
</s:Envelope>
XML
```

---

### 2) `onvif_control.<version>.js` (≥ 1.1.9 / 1.1.9a)

**Common options:**
- `--ip` (required) – camera IP.
- `--port` (default: `80` or as needed) – ONVIF service port (e.g. `8080` on some devices).
- `--user`, `--pass` – ONVIF credentials.
- `--verbose`, `--debug` – print request/response details (with WS‑Security username token; passwords are logged as digests, not plain text).
- `--help` – show usage.

> If your filename differs (e.g. `onvif_control.1.1.9a.js`), just adapt the command paths.

#### **Action: `subscribe_events`**

Subscribe in **push** mode:
```bash
node onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --termination=PT300S \
  --verbose --debug
```

Optional **auto‑renew** (keeps running and periodically renews):
```bash
node onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --termination=PT300S \
  --auto_renew \
  --verbose --debug
```

**Parameters (subscribe):**
- `--mode` = `push` (this guide) or `pull` (PullPoint; only if the camera supports it).
- `--push_url` – the full listener URL (must match `--port`/`--path` of the listener).
- `--termination` – requested lifetime (ISO‑8601 duration). Examples:
  - `PT60S` (60 seconds), `PT300S` (5 minutes), `PT1H` (1 hour).
  - The camera may ignore very long durations and cap it.
- `--timeout` – only relevant for **pull mode** (e.g. `PT30S` per pull request).
- `--message_limit` – only relevant for **pull mode** (max msgs per pull).
- `--auto_renew` – if provided, the tool sleeps until just before `TerminationTime` and sends `Renew` automatically in a loop.

> Output will include `subscription` (SubscriptionReference URL), `currentTime`, and `terminationTime` in **UTC**.

#### **Action: `renew_subscription`**

Extend a valid subscription’s lifetime (push or pull). You need the **subscription URL** returned by `subscribe_events`.

```bash
node onvif_control.1.1.9a.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=renew_subscription \
  --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=0 \
  --termination=PT600S \
  --verbose --debug
```

- `--subscription` – the **exact** `SubscriptionReference` URL the camera returned.
- `--termination` – new requested lifetime (ISO‑8601 duration).

The response includes the new `TerminationTime` (UTC).

#### **Action: `unsubscribe`**

Cleanly remove a subscription:

```bash
node onvif_control.1.1.9a.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=unsubscribe \
  --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=0 \
  --verbose --debug
```

> Unsubscribe is **optional**; most cameras will also drop subscriptions at `TerminationTime`, on reboot, or when they no longer can reach your listener. Still, it’s nice hygiene to clean up explicitly during tests.

---

## Time & Timezones

- **Listener timestamps** (prefix on console and file) are in the listener host’s local time.
- **Camera timestamps** (`UtcTime="..."` in XML, and `CurrentTime`/`TerminationTime` in `Subscribe`/`Renew` responses) are **UTC** (`...Z` or without zone but UTC assumption).  
  It’s normal to see a 2‑hour difference if your local time is UTC+02.

To avoid confusion, rely on the **UTC `TerminationTime`** from the camera when deciding when to renew. The `--auto_renew` option handles that automatically.

---

## Running as a background service (optional)

### `nohup` + `&`
```bash
nohup node /home/onvif/onvif_control_event_listener.js \
  --port=9000 --path=/onvif_hook \
  --outfile=/tmp/onvif_control_listener.txt --verbose --debug \
  >/var/log/onvif_listener.out 2>&1 &
```

### `systemd` unit (Linux)
Create `/etc/systemd/system/onvif-listener.service`:
```ini
[Unit]
Description=ONVIF Event Listener
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /home/onvif/onvif_control_event_listener.js --port=9000 --path=/onvif_hook --outfile=/tmp/onvif_control_listener.txt --verbose --debug
Restart=on-failure
WorkingDirectory=/home/onvif
User=onvif
Group=onvif

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now onvif-listener.service
sudo systemctl status onvif-listener.service
```

---

## Troubleshooting

- **Subscribe (pull) fails:** Many budget cameras don’t implement `CreatePullPointSubscription` or WS‑Notification Pull. Use `--mode=push`.
- **No events arrive:** Check the listener can be reached from the camera (IP/port/path), firewall rules, and that the camera actually generates events (enable motion detection, etc.).
- **HTTP 404/405 from listener:** Ensure `--path` matches the `--push_url` path exactly (e.g. `/onvif_hook`). Only `POST` is accepted.
- **401/403 from camera:** Wrong ONVIF credentials or user doesn’t have event permissions.
- **`TerminationTime` too short:** Some devices cap it to 60s. Use `--auto_renew` or call `renew_subscription` manually.
- **Time mismatch:** Camera shows UTC; your console shows local time. That’s expected.
- **Multiple subscriptions:** Each `subscribe_events` call may create a new subscription (`Idx=…`). If you create many, consider `unsubscribe` to clean up.
- **NAT / different subnets:** The camera must be able to reach the **listener’s IP**. If you use hostnames, test with raw IP first.
- **Content‑Type:** Cameras often send `application/soap+xml; charset=utf-8; action="…Notify"`. The listener is permissive, but if you test with `curl`, set `Content-Type: application/soap+xml`.

---

## Examples (copy & paste)

**Subscribe (push) for 5 minutes:**
```bash
node /home/onvif/onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --termination=PT300S \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --verbose --debug
```

**Auto‑renew forever (until Ctrl‑C):**
```bash
node /home/onvif/onvif_control.1.1.9.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=subscribe_events \
  --mode=push \
  --termination=PT300S \
  --auto_renew \
  --push_url=http://172.20.1.103:9000/onvif_hook \
  --verbose --debug
```

**Renew an existing subscription (add 10 min):**
```bash
node /home/onvif/onvif_control.1.1.9a.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=renew_subscription \
  --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=0 \
  --termination=PT600S \
  --verbose --debug
```

**Unsubscribe (cleanup):**
```bash
node /home/onvif/onvif_control.1.1.9a.js \
  --ip=172.20.1.172 --port=8080 \
  --user=admin --pass=XXXXXX \
  --action=unsubscribe \
  --subscription=http://172.20.1.191:8080/onvif/Subscription?Idx=0 \
  --verbose --debug
```

**Send a test event to the listener with `curl`:**
```bash
curl -s -X POST "http://172.20.1.103:9000/onvif_hook" \
  -H "Content-Type: application/soap+xml; charset=utf-8; action=\"http://docs.oasis-open.org/wsn/bw-2/NotificationConsumer/Notify\"" \
  --data-binary @- <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope"
                   xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2"
                   xmlns:tt="http://www.onvif.org/ver10/schema">
  <SOAP-ENV:Body>
    <wsnt:Notify>
      <wsnt:NotificationMessage>
        <wsnt:Topic>tns1:RuleEngine/CellMotionDetector/Motion</wsnt:Topic>
        <wsnt:Message>
          <tt:Message UtcTime="2025-08-26T09:54:09" PropertyOperation="Changed">
            <tt:Data>
              <tt:SimpleItem Name="IsMotion" Value="true"/>
            </tt:Data>
          </tt:Message>
        </wsnt:Message>
      </wsnt:NotificationMessage>
    </wsnt:Notify>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
XML
```

---

## Security notes

- These tools are for **testing and lab use**. For production, put the listener behind a reverse proxy, add authentication, validate XML strictly, and consider TLS/HTTPS.
- Keep camera firmware updated; event services on some devices are fragile or vendor‑modified.

---

## FAQ

**Q: My camera returns `ter:ActionNotSupported` for `CreatePullPointSubscription`.**  
A: Use `--mode=push`. Many devices implement push only.

**Q: The camera’s `TerminationTime` is always ~60s.**  
A: That’s the device’s cap. Use `--auto_renew` or renew manually.

**Q: I see UTC timestamps in responses but local timestamps in the listener.**  
A: Expected. Camera reports UTC; your console shows local time.

**Q: Do I have to call `unsubscribe`?**  
A: Not required, but recommended during testing to avoid stale subscriptions.

**Q: Can I subscribe multiple cameras to the same listener?**  
A: Yes. They’ll all POST to the same `--path`. The log will include the source IP in the console (`request from ...`) and you can separate by content if needed.
