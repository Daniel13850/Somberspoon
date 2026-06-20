#!/bin/sh

# The following script is used when resetting the server

pkill -9 alivecheck.sh
pkill -9 init.sh
pkill -9 schematics.sh
pkill -9 server.sh
pkill -9 java
rm -f ~/kaboom/minecraft.sock

. ~/kaboom/config.env.sample
. ~/kaboom/config.env

while [ $# -gt 0 ]; do
    case "$1" in
        -noupdate)
            echo "skip update"
            auto_update=false
            ;;
    esac
    shift
done

if [ $auto_update = "true" ]; then
  cd ~/kaboom/
  git fetch origin --depth 1
  git reset --hard origin/master
  git reflog expire --expire=all --all
  git gc --prune=all
fi

chmod -R 777 ~/kaboom/server/
rm -rf ~/kaboom/server/*
cp -Tr ~/kaboom/server-default/ ~/kaboom/server/
mkdir -p ~/kaboom/logs/
mkdir -p ~/kaboom/schematics/
sed -i "s/^server-ip=.*/server-ip=${server_host}/" ~/kaboom/server/server.properties
sed -i "s/^server-port=.*/server-port=${server_port}/" ~/kaboom/server/server.properties
sed -i "s/^enable-query=.*/enable-query=${query_enabled}/" ~/kaboom/server/server.properties
sed -i "s/^query.port=.*/query.port=${query_port}/" ~/kaboom/server/server.properties
sed -i "0,/^[[:space:]]*clone-remote-port:/{s/^\([[:space:]]*\)clone-remote-port:.*/\1clone-remote-port: ${bedrock_clone_java_port}/}" ~/kaboom/server/plugins/Geyser-Spigot/config.yml
sed -i "0,/^[[:space:]]*port:/{s/^\([[:space:]]*\)port:.*/\1port: ${bedrock_port_if_no_clone}/}" ~/kaboom/server/plugins/Geyser-Spigot/config.yml
sed -i "0,/^[[:space:]]*#address:/{s/^\([[:space:]]*\)#address:.*/\1address: ${bedrock_host}/}" ~/kaboom/server/plugins/Geyser-Spigot/config.yml
sed -i "0,/^[[:space:]]*enabled:/{s/^\([[:space:]]*\)enabled:.*/\1enabled: ${discord_log_enabled}/}" ~/kaboom/server/plugins/DiscordLog/config.yml
sed -i "0,/^[[:space:]]*webhook:/{s|^\([[:space:]]*\)webhook:.*|\1webhook: ${discord_log_webhook}|}" ~/kaboom/server/plugins/DiscordLog/config.yml
sed -i "0,/^[[:space:]]*essentials.delwarp:/{s|^\([[:space:]]*\)essentials.delwarp:.*|\1essentials.delwarp: ${allow_warp_editing}|}" ~/kaboom/server/permissions.yml
sed -i "0,/^[[:space:]]*essentials.setwarp:/{s|^\([[:space:]]*\)essentials.setwarp:.*|\1essentials.setwarp: ${allow_warp_editing}|}" ~/kaboom/server/permissions.yml
cp ~/kaboom/motd.txt ~/kaboom/server/plugins/Essentials/motd.txt
cp -r ~/kaboom/worlds/ ~/kaboom/server/worlds/
cp -r ~/kaboom/warps/ ~/kaboom/server/plugins/Essentials/warps/
