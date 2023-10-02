#! /bin/sh

WEBUI_DIR="$(dirname $0)"
${WEBUI_DIR}/fetch_external.sh

while true; do
  /usr/bin/python3 ${WEBUI_DIR}/main.py "$@"
  if [ $? -ne 0 ] ; then break; fi
done
