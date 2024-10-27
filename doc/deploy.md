# Deploying piju-webui to a Raspberry Pi

Note that these instructions assume you're using the same environment described
in <https://github.com/nsw42/piju-server/blob/main/doc/deploy.md>

## Overview

1. Do a git checkout (or download a snapshot of the source) to your pi
1. Install Python prerequisites
1. Allow non-root processes to bind to port 80
1. Check that the webui starts
1. Configure the server to start automatically

## Do a git checkout

Logged in as piju:

```sh
cd
git clone https://github.com/nsw42/piju-webui.git
```

## Install Python prerequisites

```sh
cd piju-webui
python3 -m venv --system-site-packages .
. bin/activate
pip install -r requirements.txt
```

## Allow non-root processes to bind to port 80

There are better ways of doing this. A quick and convenient way for testing,
though, is just to set the low bound for the privileged port numbers to 0.
(Credit to <https://superuser.com/a/1482188>)

```sh
sudo sh -c 'echo 0 > /proc/sys/net/ipv4/ip_unprivileged_port_start'
```

## Check that the webui starts

```sh
./run.sh SERVER:5000
```

Note that the server needs to be something that resolves for both the webui
process (ie running on the pi) and the browser clients. So, don't use
`localhost` or `127.0.0.1`.

Point a browser at `http://SERVER/`

The most likely gotcha at this point is versionitis between the piju server
and the web ui.  The webui only reports warnings, rather than errors, if the
server does not offer the version of API that the ui needs.

Press Ctrl-C if you want to stop the process.

## Configure the server to start automatically

Edit the `command_args` line of `piju-webui/init.d/piju-webui` to set the correct hostname or IP address, then (logged in as piju):

```sh
sudo mkdir -m 777 /var/log/piju-webui
cd ~/piju-webui/init.d
sudo install -o root -g root -m 755 piju-webui  /etc/init.d/piju-webui
sudo rc-update add piju-webui default
sudo /etc/init.d/piju-webui start
```

