#!/bin/bash
set -e

SUFFIX=$1

s_target="firefox${SUFFIX}"

cd dist
	rm -f ${s_target}.zip
	cd firefox
		zip -r ../${s_target}.zip ./*
	cd ..
	mkdir -p qa/${s_target}
	rm -rf qa/${s_target}
	unzip ${s_target}.zip -d qa/${s_target}
	cp ${s_target}.zip "qa/${s_target}.v$(node -p -e 'require("../package.json").version.replace(/\./g, "_")').zip"
cd ..
