# Somberspoon
Its a fork of the Kaboom server and framework ([Credit](https://github.com/kaboomserver/)) with more features:
 1. More robust scripts that preventing running the server multiple times
 2. Logging and Schematic Folders that doesnt resetting on server resets
 3. An configuration where you can configure the server IP and port (because the server config files are resetting on update) and more settings
 4. An optional Webinterface where you can view the console, running power actions, downloading logs and editing the schematic folder
 5. An Discord log plugin that uses an webhook for logging chat messages and commands to an Discord channel
 6. An big city map ([Credit](https://www.planetminecraft.com/project/greenfield---new-life-size-city-project/)) that is used on the overworld
## Setup
 1. At first you need to install some dependencies:
 `sudo apt install git dtach nano`
 3. At first you must create an user on your Linux system:
 `sudo adduser somberspoon`
 This step is required to prevent the scripts killing Java (or other) processes from other users.
 3. Login to your new user, and clone that repository in a folder named **kaboom** in your home directory with this command:
 `cd && git clone https://github.com/Daniel13850/Somberspoon kaboom/`
 It is important, that you clone the repo in exactly that folder by copying the full command.
 4. Enter that directory and copy the Configuration and the MOTD file and edit that files to configure the server:
 `cd ~/kaboom/ && cp config.env.sample config.env && motd.txt.sample motd.txt`
 (Dont edit the .sample files, because there are resetting on updates from this repo)
 `nano config.env` (here you can edit the server hosting settings, discord webhook, the webinterface hosting settings (if you use it) and toggle auto-updating from this repo on server reset (You need to disable auto_update if you want make changes on the server that cant be configured in this config file)
 `nano motd.txt` (here you can change the MOTD (the Message that is appearing on server join, not the normal Minecraft MOTD in the serverlist))
 5. Now before your server is ready to start, you need to run a few scripts (copy the commands exactly):
 `cd ~/kaboom/framework/vendor/ && ./generate_jre.sh` (to generate the Java Runtime that is used by the server)
 `cd ~/kaboom/server-default/ && ./scripts/update.sh` (to download the server software and some plugins (like Essentials or ViaVersion) the first time)
 `~/kaboom/framework/script/reset.sh` (to copy the server template to the folder where the server is running)
 6. Now you can use the scripts on `~/kaboom/framework/script/` to run the server (`~/kaboom/framework/script/init.sh`) or stop (`shutdown.sh`), restart (`restart.sh`) and resetting (`reset.sh`) it everytime. Dont run the scripts in the `internal` folder.
