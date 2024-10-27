#! /bin/sh

WEBUI_DIR="$(dirname $0)"

if [ -x $WEBUI_DIR/bin/python3 ]; then
  PYTHON=$WEBUI_DIR/bin/python3
else
  # rely on path
  PYTHON=python3
fi

while true; do
  ${WEBUI_DIR}/fetch_external.sh
  $PYTHON ${WEBUI_DIR}/main.py "$@"
  if [ $? -eq 0 ] ; then break; fi
done
