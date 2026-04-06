
# Somberspoon
Its a fork of the Kaboom ([Credit](https://github.com/kaboomserver/)) server and framework with more features:
 1. More robust scripts that preventing running the server multiple times
 2. Logging and Schematic Folders that doesnt resetting on server resets
 3. An configuration where you can configure the server IP and port (because the server config files are resetting on update) and more settings
 4. An optional Webinterface where you can view the console, running power actions, downloading logs and editing the schematic folder
 5. An Discord log plugin that uses an webhook for logging chat messages and commands to an Discord channel
 6. You can upload your default world(s) into the worlds folder and on every server reset they will be used. You can upload essentials warp points too.
## Setup
 1. At first you need to install some dependencies:
`sudo apt install git dtach nano jq`.
 2. Then you must create an user on your Linux system:
`sudo adduser somberspoon` (This step is required to prevent the scripts killing Java (or other) processes from other users).
 3. Login to your new user, and clone that repository in a folder named **kaboom** in your home directory with this command:
`cd && git clone https://github.com/Daniel13850/Somberspoon kaboom/` (It is important, that you clone the repo in exactly that folder by copying the full command).
4. Enter that directory and copy the Configuration and the MOTD file and edit that files to configure the server:
`cd ~/kaboom/ && cp config.env.sample config.env && cp motd.txt.sample motd.txt` (Dont edit the .sample files, because there are resetting on updates from this repo),
`nano config.env` (here you can edit the server hosting settings, discord webhook, the webinterface hosting settings (if you use it) and toggle auto-updating from this repo on server reset (You need to disable auto_update if you want make changes on the server templare or the framework that cant be configured in this config file) and more),
`nano motd.txt` (here you can change the MOTD (the Message that is appearing on server join, not the normal Minecraft MOTD in the serverlist)).
 5. Now before your server is ready to start, you need to run a few scripts (copy the commands exactly):
`cd ~/kaboom/framework/vendor/ && ./generate_jre.sh` (to generate the Java Runtime that is used by the server),
`cd ~/kaboom/server-default/ && ./scripts/update.sh` (to download the server software and some plugins (like Essentials or ViaVersion) the first time),
`~/kaboom/framework/script/reset.sh` (to copy the server template to the folder where the server is running).
 6. Now you can use the scripts on `~/kaboom/framework/script/` to run the server (`~/kaboom/framework/script/init.sh`) or stop (`shutdown.sh`), restart (`restart.sh`) and resetting (`reset.sh`) it everytime. Dont run the scripts in the `internal` folder.
 7. You can view the console by running `dtach -a ~/kaboom/minecraft.sock`. At server startup you will see many errors, this is correct, because for security reasons the server running script is locking the configuration files to make it read-only.
 ## Optional Setups
### IP masking (recommended)
To make IP addresses of players private (because everyone can see it via /seen), you need to define some rules in iptables. There is a script, which you need to run with **root**, to setup the rules automatically to your configured ports:
`sudo /home/somberspoon/kaboom/framework/script/internal/setupfirewall.sh` (change the username to your username where you run somberspoon).

To make the rules automatically applying on reboot, running `sudo crontab -e` (with your root user), and adding this line to your cronjob file:
`@reboot /home/somberspoon/kaboom/framework/script/internal/setupfirewall.sh` (change the username to your username where you run somberspoon).

If you change your server port(s) in the `config.env` file, you need to either reboot the machine (if you have set up the cronjob) or run the script manually again, to re-enable IP masking.
### Autostart and Autoreset
To make the server automatically starting on reboot and reset it automatically, you have to setup cronjobs.
Login to your user where you run somberspoon, and open your cronjob file with `crontab -e`.

To make your server automatically starting on reboot, add this line to your cronjob file:
`@reboot ~/kaboom/framework/script/shutdown.sh && ~/kaboom/framework/script/init.sh` (The shutdown script before the init script is for cleaning up eventually dead socket files that preventing the server starting).

To automatically update the plugins, reset your server and start it again, add this line to your cronjob file:
`0 6 * * * cd ~/kaboom/server-default/ && ./scripts/update.sh && ~/kaboom/framework/script/reset.sh && ~/kaboom/framework/script/init.sh` (the cronjob is now running at 6 AM, change this if you want).

If you only want to reset and start the server without updating plugins, add this line instead:
`0 6 * * * ~/kaboom/framework/script/reset.sh && ~/kaboom/framework/script/init.sh`.
You can also make a cronjob for updating the plugins for example, once a week, add this line to do this:
`0 5 * * MON cd ~/kaboom/server-default/ && ./scripts/update.sh` (It updates the plugins at 5 AM on mondays, make sure you do this before the reset, so it will applying on the next reset, in this example one hour later if you leave the server reset on 6 AM).
### Webinterface
If you want to use the webinterface, you can define the host and port in your `config.env` file (make sure the webinterface is not accessable outside your network, because the webinterface has no authentification, or leave the host at 127.0.0.1 and set up an reverse proxy with an authentification method).
Then you need to switch to your root user and first install node (if you dont have it already):
`sudo apt install npm`.
Then switch again to your user where you run somberspoon, and install the dependencies:
`cd ~/kaboom/mc-webui/ && npm install`.
Then you need to switch again to your root user and set up a service:
`sudo nano /etc/systemd/system/somberspoon-webui.service`, and paste this content in that file:

    [Unit]
    Description=Somberspoon Webinterface
    After=network.target
    
    [Service]
    Type=simple
    
    User=somberspoon
    Group=somberspoon
    
    WorkingDirectory=/home/somberspoon/kaboom/mc-webui
    
    ExecStart=/usr/bin/node server.js
    
    Restart=always
    RestartSec=3
    
    Environment=NODE_ENV=production
    Environment=TERM=xterm-256color
    Environment=COLORTERM=truecolor
    Environment=LANG=C.UTF-8
    
    KillMode=process
    KillSignal=SIGINT
    TimeoutStopSec=20
    
    [Install]
    WantedBy=multi-user.target

Make sure to change `somberspoon` if you named your user differently.
Enable your service now with: `sudo systemctl enable --now somberspoon-webui`.
### Custom Map(s)
If you want to use a custom Map, you can upload it into the `worlds` folder. Use the following world names:
`world`: The default overworld map, where you spawn.
`world_nether`, `world_the_end`: self-explanatory.
`world_flatlands`: a flatland world, but you can use any other map too.
If you have warp points for essentials too, you can upload these into the `warps` folder and disable editing for players in the `config.env`.
