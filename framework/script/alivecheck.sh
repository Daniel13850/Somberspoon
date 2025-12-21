#!/bin/sh

# The following script is a failsafe for killing the Minecraft server if it happens
# to be stuck

set -x
. ~/config.env

while true; do
	sleep 420

	# If the server doesn't respond to ping, kill it

	if [ "$(env printf '\xFE' | nc -w 15 0.0.0.0 ${server_port} | wc -m)" -eq 0 ]; then
		pkill -9 java
		echo $(date) >> ~/kill.log
	else
		# Server is still running, reset the crash loop detector
		rm ~/server/server_stops.log
	fi
done
