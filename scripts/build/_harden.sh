#!/bin/bash
set -e

ENGINE=$1


# prep list of scripts to inlcude in entry html file
a_scripts_entry=()

# the same list as above but using paths relative to the cwd
a_scripts_cwd=()

# copies script file, ensuring the source exists and is not empty, and adds to init list
function copy_script() {
  sr_src=$1
  s_dst=${2:-$(basename $1)}

  # ensure the source exists
  if [ ! -f $sr_src ]; then
    echo "Missing critical security script"
    exit 1
  fi

  # ensure source is not empty
  if [ ! -s $sr_src ]; then
    echo "Critical security script empty"
    exit 1
  fi

  # append to lists
  a_scripts_entry+=( $s_dst )
  a_scripts_cwd+=( "dist/$ENGINE/src/entry/$s_dst" )

  # copy file to destination
  cp $sr_src dist/$ENGINE/src/entry/$s_dst
}

# copy ses lib source(s)
copy_script node_modules/ses/dist/lockdown.umd.min.js lockdown-install.js


# copy scripts that will harden the environment before any third-party libs are evaluated
copy_script static/lockdown-init.js
if [[ "safari" == "$ENGINE" ]]; then
  copy_script static/pre-exempt-ios.js
fi
copy_script static/pre-exempt-debug.js
copy_script static/deep-freeze.js

# build script include tags using extensino absolute paths
sx_scripts_root=""
for s_script in "${a_scripts_entry[@]}"; do
  sx_hash=$(shasum -b -a 384 ./static/$s_script | awk '{ print $1 }' | xxd -r -p | base64)
  sx_scripts_root="${sx_scripts_root}\n\t"'<script src="/src/entry/'"$s_script"'" integrity="sha384-'"$sx_hash"'"></script>'
done

# portable sed command create injection target
find dist/$ENGINE/* -name "*.html" -exec sed -i -e 's:<!-- @ses -->:'"$sx_scripts_root"':g' {} \;

# special replacement for firefox's background.html until PR for web-extension plugin is made
find dist/$ENGINE/* -name "background.html" -exec sed -i -e 's:<meta charset="UTF-8" />:<meta charset="utf-8" />'"$sx_scripts_root"':g' {} \;

# merge and prepend lockdown to service-worker script
sx_merged=$(cat "${a_scripts_cwd[@]}")
find dist/$ENGINE/* -name "serviceWorker.js" -exec sed -i -e '1s:^:'"$sx_merged"':' {} \;

# verify that the scripts were injected into the HTML files at the appropriate places
deno run --allow-read scripts/build/verify-entry-pages.ts $ENGINE
