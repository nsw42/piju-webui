from argparse import ArgumentParser
from collections import namedtuple
import datetime
from http import HTTPStatus
import html
from itertools import zip_longest
import logging
import socket
import subprocess
import threading
import time
from typing import Callable
from urllib.parse import quote, urlparse, urlunparse

from flask import Flask, abort, render_template, request
from werkzeug.serving import make_server
import requests

from models import (Artist, album_from_json, display_genre_from_json, id_from_link, playlist_from_json,
                    playlist_summary_from_json, radio_station_from_json)


QueuedTrack = namedtuple('QueuedTrack', 'id, artist, title, link, artwork')
# different from a models.Track, because it accommodates YouTube 'tracks', too


class PijuWebuiApp(Flask):
    def __init__(self, import_name):
        super().__init__(import_name)
        self.exit_code: int | None = None
        self.dev_reload = False  # may be updated later
        self.server: str | None = None
        self.server_from_ui_client: Callable[[], str] = lambda: ''
        self.version: str = "unknown"


RANDOM_COOKIE_NAME = 'random'
TIMEOUT_QUICK_ACTION = 30
TIMEOUT_LONG_REQUEST = 300
app = PijuWebuiApp(__name__)


def server_for_client(server_tuple):
    client_to_webui = urlparse(request.base_url)
    client_to_server = client_to_webui._replace(netloc=f'{client_to_webui.hostname}:{server_tuple.port}', path='')
    server_str = urlunparse(client_to_server)
    return server_str


def get_default_template_args():
    now = datetime.datetime.now()
    return {
        "marquee_speed": 'fast' if (now.hour < 22) else 'slow',
        "server": app.server_from_ui_client(),
        "len": len,
        "make_header": make_header,
        "make_header_component": make_header_component,
        "html": html
    }


@app.errorhandler(requests.exceptions.ConnectionError)
def request_failed(_):
    abort(503, "Connection error from piju-server")


@app.errorhandler(requests.exceptions.Timeout)
def request_timeout(_):
    abort(504, "Unable to get a response from the server")


def fetch_server_json(url_suffix, timeout=TIMEOUT_LONG_REQUEST):
    """
    Fetch the given path from piju-server, returning the decoded json response.
    Aborts with a 404 if the server doesn't recognise the path, or a 502 on any other error.
    """
    url = f"{app.server}/{url_suffix}"
    response = requests.get(url, timeout=timeout)
    if response.status_code == HTTPStatus.NOT_FOUND:
        abort(404)
    if not response.ok:
        abort(502, f"Error from server: {url} returned {response.status_code}")
    return response.json()


def fetch_display_genres():
    """
    Return the display genres that have something in them, in the order they should be shown
    """
    return [display_genre_from_json(display_genre_json)
            for display_genre_json in fetch_server_json('display_genre/', timeout=TIMEOUT_QUICK_ACTION)
            if display_genre_json['album_count'] > 0]


def fetch_playlist_summaries():
    return [playlist_summary_from_json(playlist_json)
            for playlist_json in fetch_server_json('playlists', timeout=TIMEOUT_QUICK_ACTION)]


def fetch_radio_stations():
    return [radio_station_from_json(station_json)
            for station_json in fetch_server_json('radio', timeout=TIMEOUT_QUICK_ACTION)]


@app.route("/")
def root():
    return render_template('index.html',
                           **get_default_template_args(),
                           genres=fetch_display_genres(),
                           has_playlists=len(fetch_playlist_summaries()) > 0,
                           has_radio=len(fetch_radio_stations()) > 0)


@app.route("/admin/")
def get_admin_page():
    response = requests.get(f"{app.server}/", timeout=TIMEOUT_QUICK_ACTION)
    if response.ok:
        server_version = response.json().get('ServerVersion')
    else:
        server_version = None
    return render_template('admin.html',
                           **get_default_template_args(),
                           server_version=server_version or "unknown",
                           ui_version=app.version)


def update_server():
    """
    Ask piju-server to update itself. Returns a message describing the outcome.
    """
    try:
        response = requests.post(f"{app.server}/update", timeout=TIMEOUT_LONG_REQUEST)
    except requests.RequestException as exc:
        logging.debug(f"server update error: {exc}")
        return 'Server update failed'
    if response.status_code == HTTPStatus.OK:
        return 'Server already up to date'
    if response.status_code == HTTPStatus.ACCEPTED:
        data = response.json()
        return f"Server updated ({data.get('from')} → {data.get('to')}), restarting"
    logging.debug(f"server update returned {response.status_code}: {response.text}")
    return 'Server update failed'


@app.post("/admin/check_for_updates")
def check_for_updates():
    server_result_message = update_server()
    try:
        git_output = subprocess.check_output(['git', 'pull'], text=True)
    except subprocess.CalledProcessError as exc:
        logging.debug(f"git error: {exc}")
        git_output = ''
    if not git_output:
        result_message = 'WebUI update check failed'
        redirect_to_front_screen = False
    elif git_output.strip() == 'Already up to date.':
        result_message = 'WebUI already up to date'
        redirect_to_front_screen = False
    else:
        logging.debug(f"git pull returned:\n{git_output}.\nExiting.")
        app.exit_code = 1
        if app.dev_reload:
            result_message = 'WebUI updates found. Restarting suppressed in dev mode.'
        else:
            result_message = 'WebUI updates found. Restarting.'
        redirect_to_front_screen = True
    return render_template('admin.html', **get_default_template_args(),
                           check_for_updates_result=f"{server_result_message}. {result_message}",
                           redirect_to_front_screen=redirect_to_front_screen)


def fetch_display_genre_json(genre_id):
    """
    Fetch just the details of the given display genre (not its contents).
    Returns None if the server doesn't know the genre; aborts on any other error.
    """
    response = requests.get(f"{app.server}/display_genre/{genre_id}?albums=none&playlists=none&limit=1",
                            timeout=TIMEOUT_QUICK_ACTION)
    if response.status_code == HTTPStatus.NOT_FOUND:
        return None
    if not response.ok:
        abort(502, f"Error from server: fetching display genre {genre_id} returned {response.status_code}")
    return response.json()


@app.route("/albums/<album_id>")
def get_album(album_id):
    if not album_id.isdigit():
        abort(404)
    album_json = fetch_server_json(f'albums/{album_id}?tracks=all')
    # The album only links to its display genres, so fetch the first one's name for the header link
    display_genre_links = album_json.get('display_genres', [])
    genre_json = fetch_display_genre_json(id_from_link(display_genre_links[0])) if display_genre_links else None
    genre = display_genre_from_json(genre_json) if genre_json else None
    album = album_from_json(album_json, genre)
    to_highlight = request.args.get('highlight', None)
    return render_template('album.html', **get_default_template_args(), album=album, to_highlight=to_highlight)


@app.route("/artists/<path:artist>")
def get_artist(artist):
    # The artist page doesn't show tracks or genres, so we don't need to fetch them
    artist_json = fetch_server_json(f'artists/{quote(artist)}?tracks=none')
    # We'd normally only expect a single artist in the response
    # but this works if there are multiple, e.g. for artist aliases
    albums = [album_from_json(album_json, genre=None)
              for albums_json in artist_json.values()
              for album_json in albums_json]
    albums.sort(key=lambda album: (album.year if album.year else 9999, album.title if album.title else ''))
    artist_info = Artist(artist, albums)
    if not parse_bool(request.args.get('aliases', default='True')):
        # filter out albums by the artist's aliases
        albums_without_aliases = [album for album in artist_info.albums if album.artist.lower() == artist.lower()]
        artist_info = artist_info._replace(albums=albums_without_aliases)
    return render_template('artist.html', **get_default_template_args(), artist=artist_info)


@app.route("/genre/<genre_id>")
def get_genre(genre_id):
    if not genre_id.isdigit():
        abort(404)
    random_subset_selected = parse_bool(request.cookies.get(RANDOM_COOKIE_NAME))
    # The contents of the genre are fetched directly from the server by genre.js:
    # we only need the genre's details to render the page
    genre_json = fetch_display_genre_json(genre_id)
    if genre_json is None:
        abort(404)
    genre = display_genre_from_json(genre_json)
    return render_template('genre.html', **get_default_template_args(),
                           include_random_toggle=True,
                           random_enabled=random_subset_selected,
                           genre=genre)


@app.route("/play_album", methods=["POST"])
def play_album():
    requests.post(f"{app.server}/player/play",
                  json=request.json,
                  timeout=TIMEOUT_QUICK_ACTION)
    return ('', HTTPStatus.NO_CONTENT)


@app.route("/play_playlist/<playlist_id>/<track_id>", methods=["POST"])
def play_playlist(playlist_id, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'playlist': playlist_id, 'track': track_id},
                  timeout=TIMEOUT_QUICK_ACTION)
    return ('', HTTPStatus.NO_CONTENT)


@app.route("/play_queue/<queue_pos>/<track_id>", methods=["POST"])
def play_queue(queue_pos, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'queuepos': queue_pos, 'track': track_id},
                  timeout=TIMEOUT_QUICK_ACTION)
    return ('', HTTPStatus.NO_CONTENT)


@app.route("/play_radio/<station_id>", methods=["POST"])
def play_radio(station_id):
    requests.post(f"{app.server}/player/play",
                  json={'radio': station_id},
                  timeout=TIMEOUT_QUICK_ACTION)
    return ('', HTTPStatus.NO_CONTENT)


@app.route("/playlists")
def playlists():
    return render_template('playlists.html', **get_default_template_args(),
                           playlists=sorted(fetch_playlist_summaries(), key=lambda p: p.title))


@app.route("/playlists/<playlist_id>")
def get_playlist(playlist_id):
    if not playlist_id.isdigit():
        abort(404)
    playlist = playlist_from_json(fetch_server_json(f'playlists/{playlist_id}?tracks=all'))
    return render_template('playlist.html', **get_default_template_args(),
                           enumerate=enumerate,
                           playlist=playlist)


@app.route("/queue/")
def view_queue():
    return render_template('queue.html', **get_default_template_args())


@app.post("/quit")
def quit_request():
    app.exit_code = 0
    return ('', HTTPStatus.NO_CONTENT)


@app.route("/radio")
def radio():
    return render_template('radio.html', **get_default_template_args(),
                           stations=sorted(fetch_radio_stations(), key=lambda s: s.name))


@app.route("/search")
def search():
    return render_template('search.html', **get_default_template_args())


@app.route("/youtube", methods=['GET', 'POST'])
def youtube():
    if request.method == 'POST':
        url = request.form['url']
        if not url:
            abort(HTTPStatus.BAD_REQUEST, "No URL specified")
        if 'queue' in request.form:
            requests.put(f"{app.server}/queue",
                         json={'url': url},
                         timeout=TIMEOUT_QUICK_ACTION)
        else:
            requests.post(f"{app.server}/player/play",
                          json={'url': url},
                          timeout=TIMEOUT_QUICK_ACTION)
    response = requests.get(f"{app.server}/downloadhistory",
                            timeout=TIMEOUT_LONG_REQUEST)
    if not response.ok:
        abort(500)
    history = response.json()
    return render_template('youtube.html', **get_default_template_args(),
                           history=history)


def make_header(links):
    return ' | '.join(make_header_component(dest, label) for (dest, label) in links)


def make_header_component(dest, label):
    return f'<a href="{dest}" class="text-decoration-none" style="color: ghostwhite">{label}</a>'


def parse_args():
    hostname = socket.gethostname()
    parser = ArgumentParser()
    parser.add_argument('--dev-reload', action='store_true',
                        help="Enable development reloader")
    parser.add_argument('--port', action='store', type=int,
                        help="Specify port to listen on")
    parser.add_argument('server', type=str, nargs='?',
                        help="Piju server hostname or IP address. "
                             "Port may optionally be specified as a :PORT suffix. If port is omitted, defaults to 5000."
                             " If the host is omitted, external clients are served a page that refers to the server "
                             " with the hostname/IP address that they used to access the webui. Note that recent "
                             " servers must be accessed by hostname rather than as localhost.")
    parser.set_defaults(dev_reload=False,
                        port=80,
                        server=f'{hostname}:5000')
    args = parser.parse_args()
    if not args.server.startswith('http'):
        args.server = 'http://' + args.server
    server_tuple = urlparse(args.server)
    if ':' not in server_tuple.netloc:
        server_tuple = server_tuple._replace(netloc=server_tuple.netloc + ':5000')
    if server_tuple.hostname in (None, ''):
        server_tuple = server_tuple._replace(netloc=f'{hostname}:{server_tuple.port}')
    server_tuple = server_tuple._replace(path='')
    args.server = urlunparse(server_tuple)
    args.server_tuple = server_tuple
    return args


def parse_bool(boolstr, default=False):
    if boolstr is None:
        return default
    if boolstr.lower() == 'true':
        return True
    elif boolstr.lower() == 'false':
        return False
    return default


def connection_test(server, required_api_version):
    try:
        response = requests.get(server + "/", timeout=TIMEOUT_QUICK_ACTION)
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        logging.error(f"Unable to connect to server {server}")
        return False
    if response.status_code != 200:
        logging.warning(f"Unable to connect to server {server}")
        return False
    data = response.json()
    api_version = data.get('ApiVersion')
    if not api_version:
        logging.warning("Server response did not include an API protocol version. "
                        "Probably an old or incompatible server")
        return False
    required_api_version_fragments = required_api_version.split('.')
    detected_api_version_fragments = api_version.split('.')
    for (required_fragment, detected_fragment) in zip_longest(required_api_version_fragments,
                                                              detected_api_version_fragments,
                                                              fillvalue='0'):
        if not required_fragment.isdigit() or not detected_fragment.isdigit():
            logging.warning("Non-numeric version string fragment encountered")  # NB not fully semver compatible
            continue
        required_fragment = int(required_fragment)
        detected_fragment = int(detected_fragment)
        if required_fragment == detected_fragment:
            continue
        elif required_fragment < detected_fragment:
            msg = "Server is using a newer protocol version than the UI requires: may be incompatible. "
            msg += f"Required: {required_api_version}; detected: {api_version}"
            logging.warning(msg)
            return True
        elif required_fragment > detected_fragment:
            msg = "Server is using an older protocol version than required by the UI: likely to be incompatible. "
            msg += f"Required: {required_api_version}; detected: {api_version}"
            logging.error(msg)
            return False
    return True


def get_ui_version() -> str:
    try:
        child = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError:
        return 'unknown'
    return child.stdout.strip()


def main():
    args = parse_args()
    app.dev_reload = args.dev_reload
    app.server = args.server
    app.version = get_ui_version()
    if args.server_tuple.hostname in ('localhost', '', None):
        app.server_from_ui_client = lambda: server_for_client(args.server_tuple)
    else:
        app.server_from_ui_client = lambda: args.server
    connection_test(app.server, required_api_version='9.6')
    host, port = '0.0.0.0', args.port
    if args.dev_reload:
        app.run(host=host, port=port, debug=True)
    else:
        print(f"Server started at {datetime.datetime.now()}. Listening on {host}:{port}")
        webui = make_server(host, port, app, threaded=True)
        server_thread = threading.Thread(target=webui.serve_forever)
        server_thread.start()
        while app.exit_code is None:
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                app.exit_code = 0
        webui.shutdown()
        server_thread.join()
        exit(app.exit_code)


if __name__ == '__main__':
    main()
