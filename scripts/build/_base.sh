#!/bin/bash
set -e

ENGINE=$1
MODE=${2:-production}

ENGINE=$ENGINE yarn vite build --mode $MODE
rm -f dist/$ENGINE/**/.DS_Store
rm -f dist/$ENGINE.zip

CWD=$(dirname "$0")
"$CWD/_harden.sh" $ENGINE
