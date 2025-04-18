### as i was always having problems with bad PTZ service for home assistant ...


now, you can control everything and you call it from a "shell_command" and define it in:

## 1.) define command in homeassistant config 
-> configuration.yaml ..

#under:
shell_command:
  onvif_ptz_control:                    ssh -o "StrictHostKeyChecking=no" root@localhost "/usr/local/nodejs/bin/node /home/onvif/onvif_ptz-control.js --log=1 --ip={{ ip }} --port={{ port }} --user={{ user }} --pass={{ password }} --action={{ action }}{% if pan is defined %} --pan={{ pan }}{% endif %}{% if tilt is defined %} --tilt={{ tilt }}{% endif %}{% if zoom is defined %} --zoom={{ zoom }}{% endif %}{% if time is defined %} --time={{ time }}{% endif %}{% if preset is defined %} --preset={{ preset }}{% endif %}{% if presetname is defined %} --presetname={{ presetname }}{% endif %}{% if debug is defined %} --debug={{ debug }}{% endif %}{% if verbose is defined %} --verbose={{ verbose }}{% endif %}{% if mute is defined %} --mute={{ mute }}{% endif %}"


and then you call the service from a button in lovelace or in scriptsw or autoamtions ...for whatever ... 
via:

#eg: example: save current position of Camera to Preset012 (12)
            hold_action:
              action: call-service
              confirmation:
                text: Do you really want to save the current position as *2*
              service: shell_command.onvif_ptz_control
              service_data:
                ip: 172.20.1.171
                port: 8080
                user: admin
                password: 1234
                action: setpreset
                presetname: Preset012


for more info .. read my manuals or ask me ;-)

have fun ...

cu camel
