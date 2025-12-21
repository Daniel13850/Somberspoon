#!/bin/sh

# Shutdown script for Paper/Spigot

pkill -9 alivecheck.sh
pkill -9 init.sh
pkill -9 schematics.sh
pkill -9 server.sh
pkill -9 java
rm -f ~/kaboom/kaboom ~/kaboom/server/alivecheck.sh
