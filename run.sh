#! /bin/sh

while true; do
  /usr/bin/python3 $(dirname $0)/main.py "$@"
  if [ $? -ne 0 ] ; then break; fi
done
