#!/bin/bash

ENGINE=chrome

find dist/$ENGINE -name "*.html" -exec sed -i'.ignore' -e 's:<!-- ses -->:'"$sx_scripts"':g' {} \;

find dist/$ENGINE -name "*.ignore" -exec rm -f {} \;
