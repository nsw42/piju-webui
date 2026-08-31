#! /bin/sh

WEBUI_DIR="$(dirname $0)"

VENV_DIR=$WEBUI_DIR/.venv
if [ -e $VENV_DIR/bin/activate ]; then
  . $VENV_DIR/bin/activate
fi
PYTHON=python3

while true; do
  ${WEBUI_DIR}/fetch_external.sh
  $PYTHON ${WEBUI_DIR}/main.py "$@"
  if [ $? -eq 0 ] ; then break; fi
done
