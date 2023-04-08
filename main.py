from argparse import ArgumentParser
import datetime
from itertools import zip_longest
import json
import logging
import subprocess
import threading
import time

from flask import Flask, abort, redirect, render_template, request
from werkzeug.serving import make_server
import requests

from cache import Cache
import genre_view


RANDOM_COOKIE_NAME = 'random'

app = Flask(__name__)
app.exit_code = None


def get_default_template_args():
    theme = request.cookies.get('theme', '').lower()
    if theme not in ('dark', 'light'):
        theme = 'light'
    mode = request.cookies.get('mode', '').lower()
    if mode not in ('remote', 'local'):
        mode = 'remote'
    return {
        "remote_mode_enabled": mode == 'remote',
        "theme": theme,
        "server": app.server,
        "len": len,
        "make_header": make_header,
        "make_header_component": make_header_component
    }


@app.route("/")
def root():
    app.cache.ensure_genre_cache()
    app.cache.ensure_playlist_summary()
    return render_template('index.html',
                           **get_default_template_args(),
                           genres=app.cache.display_genres,
                           has_playlists=len(app.cache.playlist_summaries) > 0)


@app.route("/admin/")
def get_admin_page():
    return render_template('admin.html', **get_default_template_args())


@app.post("/admin/empty_cache")
def empty_cache():
    app.cache.flush()
    app.cache.ensure_genre_cache()
    return redirect("/")


@app.post("/admin/check_for_updates")
def check_for_updates():
    try:
        git_output = subprocess.check_output(['git', 'pull'], text=True)
    except subprocess.CalledProcessError as e:
        logging.debug(f"git error: {e}")
        git_output = ''
    if not git_output:
        result_message = 'Check failed'
        redirect_to_front_screen = False
    elif git_output.strip() == 'Already up to date.':
        result_message = git_output.strip()[:-1]
        redirect_to_front_screen = False
    else:
        logging.debug(f"git pull returned:\n{git_output}.\nExiting.")
        app.exit_code = 0
        if app.dev_reload:
            result_message = 'Updates found. Restarting suppressed in dev mode.'
        else:
            result_message = 'Updates found. Restarting.'
        redirect_to_front_screen = True
    return render_template('admin.html', **get_default_template_args(),
                           check_for_updates_result=result_message,
                           redirect_to_front_screen=redirect_to_front_screen)


@app.post("/admin/set_theme")
def set_theme():
    theme = request.form.get('theme', '').lower()
    if theme not in ('dark', 'light'):
        abort(400)
    response = redirect("/admin/")
    response.set_cookie('theme', theme, samesite='Lax')
    return response


@app.route("/albums/<album_id>")
def get_album(album_id):
    album = app.cache.ensure_album_cache(album_id)
    if album is None:
        abort(404)
    to_highlight = request.args.get('highlight', None)
    return render_template('album.html', **get_default_template_args(), album=album, to_highlight=to_highlight)


@app.route("/artists/<artist>")
def get_artist(artist):
    artist = app.cache.ensure_artist_cache(artist)
    if artist is None:
        abort(404)
    return render_template('artist.html', **get_default_template_args(), artist=artist)


@app.route("/genre/<genre_name>")
def get_genre(genre_name):
    random_subset_selected = parse_bool(request.cookies.get(RANDOM_COOKIE_NAME))
    return render_template('genre.html', **get_default_template_args(),
                           include_random_toggle=True,
                           random_enabled=random_subset_selected,
                           genre_name=genre_name)


@app.route("/genre_contents/<genre_name>")
def get_genre_content(genre_name):
    timeout = int(request.args.get('timeout', 5000))
    albums = app.cache.ensure_genre_contents_cache(genre_name, timeout)
    if albums is None:
        abort(404)
    first_album_for_anchor = {}
    for album in albums:
        if album.anchor not in first_album_for_anchor:
            first_album_for_anchor[album.anchor] = album.id
    return json.dumps({
        "albums": [{
            "id": a.id,
            "anchor": a.anchor,
            "artwork_link": a.artwork_link,
            "artist": a.artist,
            "title": a.title,
            "year": a.year,
        } for a in albums],
        "anchors": first_album_for_anchor
    })


@app.route("/play_album/<album_id>/<track_id>", methods=["POST"])
def play_album(album_id, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'album': album_id, 'track': track_id})
    return ('', 204)


@app.route("/play_playlist/<playlist_id>/<track_id>", methods=["POST"])
def play_playlist(playlist_id, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'playlist': playlist_id, 'track': track_id})
    return ('', 204)


@app.route("/playlists")
def playlists():
    app.cache.ensure_playlist_summary()
    return render_template('playlists.html', **get_default_template_args(),
                           playlists=sorted(app.cache.playlist_summaries.values(), key=lambda p: p.title))


@app.route("/playlists/<playlist_id>")
def get_playlist(playlist_id):
    playlist = app.cache.ensure_playlist_cache(playlist_id)
    if playlist is None:
        abort(404)
    return render_template('playlist.html', **get_default_template_args(),
                           enumerate=enumerate,
                           playlist=playlist)


@app.route("/queue/")
def view_queue():
    queue = requests.get(app.server + '/queue/').json()
    return render_template('queue.html', **get_default_template_args(),
                           queue=queue)


@app.route("/search")
def search():
    return render_template('search.html', **get_default_template_args())


def make_header(links):
    return ' | '.join(make_header_component(dest, label) for (dest, label) in links)


def make_header_component(dest, label):
    return f'<a href="{dest}" class="text-decoration-none" style="color: ghostwhite">{label}</a>'


def parse_args():
    parser = ArgumentParser()
    parser.add_argument('--dev-reload', action='store_true',
                        help="Enable development reloader")
    parser.add_argument('server', type=str, nargs='?',
                        help="Piju server hostname or IP address. "
                             "Port may optionally be specified as :PORT")
    parser.set_defaults(dev_reload=False, server='piju:5000')
    args = parser.parse_args()
    # TODO: Error checking on args.server
    if not args.server.startswith('http'):
        args.server = 'http://' + args.server
    if args.server[-1] == '/':
        args.server = args.server[:-1]
    return args


def parse_bool(str, default=False):
    if str is None:
        return default
    if str.lower() == 'true':
        return True
    elif str.lower() == 'false':
        return False
    return default


def connection_test(server, required_api_version):
    try:
        response = requests.get(server + "/")
    except requests.exceptions.ConnectionError:
        logging.error(f"Unable to connect to server {server}")
        return
    if response.status_code != 200:
        logging.warning(f"Unable to connect to server {server}")
        return
    data = response.json()
    api_version = data.get('ApiVersion')
    if not api_version:
        logging.warning("Server response did not include an API protocol version. "
                        "Probably an old or incompatible server")
        return
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
            pass
        elif required_fragment < detected_fragment:
            msg = "Server is using a newer protocol version than the UI requires: may be incompatible. "
            msg += f"Required: {required_api_version}; detected: {api_version}"
            logging.warning(msg)
            return
        elif required_fragment > detected_fragment:
            msg = "Server is using an older protocol version than required by the UI: likely to be incompatible. "
            msg += f"Required: {required_api_version}; detected: {api_version}"
            logging.error(msg)
            return


def populate_cache(cache: Cache, shutdown_event: threading.Event):
    logging.debug("Populating overall genre cache")
    cache.ensure_genre_cache()
    for display_genre in genre_view.GENRE_VIEWS.keys():
        logging.debug("Populating genre cache for " + display_genre)
        cache.ensure_genre_contents_cache(display_genre, timeout=None)
        if shutdown_event.is_set():
            logging.debug("Populating cache interrupted")
            break
    else:
        logging.debug("Cache populated")


def main():
    args = parse_args()
    app.dev_reload = args.dev_reload
    app.server = args.server
    app.cache = Cache(app)
    connection_test(app.server, required_api_version='3.0')
    host, port = '0.0.0.0', 80
    if args.dev_reload:
        app.run(host=host, port=port, debug=True)
    else:
        print(f"Server started at {datetime.datetime.now()}. Listening on {host}:{port}")
        webui = make_server(host, port, app, threaded=True)
        server_thread = threading.Thread(target=webui.serve_forever)
        server_thread.start()
        cache_shutdown_event = threading.Event()
        cache_thread = threading.Thread(target=populate_cache, args=(app.cache, cache_shutdown_event))
        cache_thread.start()
        while app.exit_code is None:
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                app.exit_code = 1
        webui.shutdown()
        cache_shutdown_event.set()
        server_thread.join()
        cache_thread.join()
        exit(app.exit_code)


if __name__ == '__main__':
    main()
