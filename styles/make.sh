#! /bin/bash

if [ "$1" = "-w" -o "$1" = "--watch" ]; then
  watch=--watch
else
  watch=
fi

scssdir=$(dirname $0)
sass $watch $scssdir/pijuwebui.sass $scssdir/../static/pijuwebui.css
