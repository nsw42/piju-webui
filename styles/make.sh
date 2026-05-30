#! /bin/bash

if [ "$1" = "-w" -o "$1" = "--watch" ]; then
  watch=--watch
else
  watch=
fi

scssdir=$(dirname $0)

# ensure we have bootstrap source available

if [ ! -d "$scssdir/../node_modules/bootstrap" -o ! -d "$scssdir/../node_modules/bootswatch" ]; then
  echo "bootstrap or bootswatch missing - installing"
  pnpm install
fi

# TODO: Honour --watch for the python, too
python $scssdir/make_marquee.py > $scssdir/marquee.sass

sass $watch -I $scssdir/../node_modules --silence-deprecation import $scssdir/pijuwebui-light.sass:$scssdir/../static/pijuwebui-light.css   $scssdir/pijuwebui-dark.sass:$scssdir/../static/pijuwebui-dark.css
