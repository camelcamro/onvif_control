#!/usr/bin/env bash
curl -v -X POST "http://127.0.0.1:9000/onvif_hook" \
  -H "Content-Type: application/soap+xml" --data-binary @- <<'XML'
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
