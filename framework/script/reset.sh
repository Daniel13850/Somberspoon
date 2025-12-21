#!/bin/sh

# The following script is used when resetting the server
# Currently every 24 h

pkill -9 alivecheck.sh
pkill -9 init.sh
pkill -9 schematics.sh
pkill -9 server.sh
pkill -9 java
rm -f ~/kaboom

# Sync changes with the GitHub repository
#cd ~/framework
#git fetch origin --depth 1
#git reset --hard origin/master
#git reflog expire --expire=all --all
#git gc --prune=all

#cd ~/server-default
#git fetch origin --depth 1
#git reset --hard origin/master
#git reflog expire --expire=all --all
#git gc --prune=all

. ~/config.env

if [ $auto_update = "true" ]; then
  cd ~
  git fetch origin --depth 1
  git reset --hard origin/master
  git reflog expire --expire=all --all
  git gc --prune=all
fi

chmod -R 777 ~/server/
rm -rf ~/server/*
cp -Tr ~/server-default/ ~/server/
mkdir -p ~/logs/
mkdir -p ~/schematics/
sed -i "s/^server-ip=.*/server-ip=${server_host}/" ~/server/server.properties
sed -i "s/^server-port=.*/server-port=${server_port}/" ~/server/server.properties
sed -i "s/^enable-query=.*/enable-query=${query_enabled}/" ~/server/server.properties
sed -i "s/^query.port=.*/query.port=${query_port}/" ~/server/server.properties
sed -i "0,/^[[:space:]]*clone-remote-port:/{s/^\([[:space:]]*\)clone-remote-port:.*/\1clone-remote-port: ${bedrock_clone_java_port}/}" ~/server/plugins/Geyser-Spigot/config.yml
sed -i "0,/^[[:space:]]*port:/{s/^\([[:space:]]*\)port:.*/\1port: ${bedrock_port_if_no_clone}/}" ~/server/plugins/Geyser-Spigot/config.yml
sed -i "0,/^[[:space:]]*enabled:/{s/^\([[:space:]]*\)enabled:.*/\1enabled: ${discord_log_enabled}/}" ~/server/plugins/DiscordLog/config.yml
sed -i "0,/^[[:space:]]*webhook:/{s|^\([[:space:]]*\)webhook:.*|\1webhook: ${discord_log_webhook}|}" ~/server/plugins/DiscordLog/config.yml
echo $essentials_motd > ~/server/plugins/Essentials/motd.txt
