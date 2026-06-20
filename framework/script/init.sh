#!/bin/sh

# This is the core script used when booting up the server
# It asumes that the "framework" folder is located in the home directory

# Run scripts for starting the Minecraft server and schematic
# checker in the background

cd ~/kaboom/

# do important steps after updates (for example new configuration settings)
VERSION=1
if [ -f ".version" ]; then
    LAST_VERSION=$(cat ".version")
    if ! [ "$LAST_VERSION" -eq "$LAST_VERSION" ] 2>/dev/null; then
        LAST_VERSION=0
    fi
else
    LAST_VERSION=0
fi
NEXT_VERSION=$((LAST_VERSION + 1))
while [ "$NEXT_VERSION" -le "$VERSION" ]; do
    echo "doing update changes for version $NEXT_VERSION..."

    cd ~/kaboom/
    case "$NEXT_VERSION" in
        1)
            echo "installing/updating Java 25..."
            cd ~/kaboom/framework/vendor/ && ./generate_jre.sh
            echo "download/update paper 1.21.11 and the non-kaboom plugins"
            cd ~/kaboom/server-default/ && ./scripts/update.sh
            ~/kaboom/framework/script/reset.sh -noupdate
            ;;
    esac

    NEXT_VERSION=$((NEXT_VERSION + 1))
done
cd ~/kaboom/
echo "$VERSION" > ".version"

dtach -n minecraft.sock ~/kaboom/framework/script/internal/server.sh
