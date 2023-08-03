#!/bin/bash
set -e

ID=$1
MODE=${2:-production}
PURPOSE=${3:-build}

export NODE_OPTIONS='--max_old_space_size=12288'
ENGINE=$ID yarn vite build --mode $MODE
rm -f dist/$ID/**/.DS_Store
rm -f dist/$ID.zip

CWD=$(dirname "$0")
"$CWD/_harden.sh" $ID $PURPOSE
