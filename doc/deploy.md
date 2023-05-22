# Deploying piju-webui to a Raspberry Pi

Note that these instructions assume you're using the same environment described
in <https://github.com/nsw42/piju-server/blob/main/doc/deploy.md>

## Steps

1. Do a git checkout (or download a snapshot of the source) to your pi
1. Install Python prerequisites
1. Allow non-root processes to bind to port 80
1. Check that the webui starts
1. Configure the server to start automatically

## Install Python prerequisites

```sh
cd piju-webui
pip install -r requirements.txt
```

## Allow non-root processes to bind to port 80

There are better ways of doing this. A quick and convenient way for testing,
though, is just to set the low bound for the privileged port numbers to 0.
(Credit to <https://superuser.com/a/1482188>)

sudo sh -c 'echo 0 > /proc/sys/net/ipv4/ip_unprivileged_port_start'

## Check that the webui starts

```sh
python3 main.py yourserver:5000
```

Note that the server needs to be something that resolves for both the webui
process (ie running on the pi) and the browser clients. So, don't use
`localhost` or `127.0.0.1`.

Point a browser at `http://yourserver/`

The most likely gotcha at this point is versionitis between the piju server
and the web ui.  The webui doesn't (yet) contain any checks that the server
offers the version of API that the ui needs. Older versions of the server
didn't include a CORS header in its response, too, which broke the UI.

Press Ctrl-C if you want to stop the process.

## Configure the server to start automatically

```sh
sudo mkdir /var/log/piju-webui
sudo chmod 777 /var/log/piju-webui
cd piju-webui/init.d
sudo install -o root -g root -m 755 piju-webui  /etc/init.d/piju-webui
sudo rc-update add pijuw-ebui default
```

## Set up log rotation

(The logrotate package will already be installed if you followed
<https://github.com/nsw42/piju-server/blob/main/doc/deploy.md>)

If so, you can simply add the two pijuwebui .log and .err files
to the list of files to process using the rules in `/etc/logrotate.d/piju`
The file should start like this:

```text
/var/log/piju/piju.log
/var/log/piju/piju.err
/var/log/piju-webui/pijuwebui.log
/var/log/piju-webui/pijuwebui.err
{
```


