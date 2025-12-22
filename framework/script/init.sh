#!/bin/sh

# This is the core script used when booting up the server
# It asumes that the "framework" folder is located in the home directory

# Run scripts for starting the Minecraft server and schematic
# checker in the background

cd ~/kaboom/

dtach -n minecraft.sock ~/kaboom/framework/script/internal/server.sh
