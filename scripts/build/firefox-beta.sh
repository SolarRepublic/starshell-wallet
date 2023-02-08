#!/usr/bin/env sh
set -e

CWD=$(dirname "$0")
"$CWD/_base.sh" firefox beta

"$CWD/package-firefox.sh" -beta
