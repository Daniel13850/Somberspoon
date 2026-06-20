#!/bin/sh

# The following script is used when resetting the server

~/kaboom/framework/script/shutdown.sh

. ~/kaboom/config.env.sample
. ~/kaboom/config.env

if [ $auto_update = "true" ]; then
  cd ~/kaboom/
  git fetch origin --depth 1
  git reset --hard origin/master
  git reflog expire --expire=all --all
  git gc --prune=all
fi

~/kaboom/framework/script/internal/initfiles.sh
