#! /bin/sh

WEBUI_DIR="$(dirname $0)"

while true; do
  ${WEBUI_DIR}/fetch_external.sh
  /usr/bin/python3 ${WEBUI_DIR}/main.py "$@"
  if [ $? -ne 0 ] ; then break; fi
done
