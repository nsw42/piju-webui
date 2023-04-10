#! /bin/bash

if [ "$1" = "-w" -o "$1" = "--watch" ]; then
  watch=--watch
else
  watch=
fi

scssdir=$(dirname $0)
# TODO: Honour --watch for the python, too
python $scssdir/make_marquee.py > $scssdir/marquee.sass
sass $watch $scssdir/pijuwebui-light.sass:$scssdir/../static/pijuwebui-light.css   $scssdir/pijuwebui-dark.sass:$scssdir/../static/pijuwebui-dark.css
