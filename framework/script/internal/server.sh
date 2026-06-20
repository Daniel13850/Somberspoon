#!/bin/sh

# The alive checker and Minecraft server is started at the same time

PATH="$HOME/kaboom/framework/vendor/java/bin/:$PATH"

# Make sure we're in the server folder, located in the home directory
cd ~/kaboom/server/

while true; do
	# Check if the server is stuck in a crash loop, and reset worlds if this is the case
	# The alive checker resets server_stops.log if the server runs long enough

	stop_log_file=server_stops.log

	if [ -f "$stop_log_file" ] && [ "$(wc -l < $stop_log_file)" -gt 2 ]; then
		rm -rf worlds/ plugins/FastAsyncWorldEdit/clipboard/ plugins/FastAsyncWorldEdit/history/
		cp -Tr ~/kaboom/worlds/ worlds/
		rm "$stop_log_file"
	fi

	# Make certain files and folders read-only

	mkdir debug/ dumps/ plugins/.paper-remapped
	chmod -R 500 debug/ dumps/

	chmod 500 config/ plugins/ mods/
	chmod 700 plugins/.paper-remapped

	chmod 400 config/paper-global.yml config/paper-world-defaults.yml
	chmod 400 bukkit.yml
	chmod 400 commands.yml
	chmod 400 eula.txt
	chmod 400 permissions.yml
	chmod 400 server-icon.png
	chmod 400 server.properties
	chmod 400 spigot.yml
	chmod 400 wepif.yml

	# Start alive checker

	dtach -n alivecheck.sock ~/kaboom/framework/script/internal/alivecheck.sh

	# Start Minecraft server

	java \
		-Xms3400M -Xmx3400M \
		-XX:MaxDirectMemorySize=512M \
		\
		-XX:+UseZGC \
		-XX:+UseCompactObjectHeaders \
		-XX:+AlwaysPreTouch \
		-XX:+UseStringDeduplication \
		-Xss8M \
		\
		-XX:+DisableExplicitGC \
		-XX:-UsePerfData \
		-XX:+PerfDisableSharedMem \
		-Dpaper.playerconnection.keepalive=60 \
		\
		-jar server.jar nogui 2>&1 | tee -a ~/kaboom/logs/$(date +"%Y-%m-%d").log

	# Stop alive checker (will be started again on the next run)

	pkill -9 alivecheck.sh
	date >> "$stop_log_file"

	# Ensure we don't abuse the CPU in case of failure
	sleep 1
done
