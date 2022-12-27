from argparse import ArgumentParser
from itertools import zip_longest
import json
import logging

from flask import Flask, abort, redirect, render_template, request
import requests

from cache import Cache


app = Flask(__name__)


@app.route("/")
def root():
    app.cache.ensure_genre_cache()
    return render_template('index.html', **app.default_template_args, genres=app.cache.display_genres)


@app.route("/admin/")
def get_admin_page():
    return render_template('admin.html', **app.default_template_args)


@app.post("/admin/empty_cache")
def empty_cache():
    app.cache.flush()
    app.cache.ensure_genre_cache()
    return redirect("/")


@app.route("/albums/<album_id>")
def get_album(album_id):
    album = app.cache.ensure_album_cache(album_id)
    if album is None:
        abort(404)
    return render_template('album.html', **app.default_template_args, album=album)


@app.route("/artists/<artist>")
def get_artist(artist):
    artist = app.cache.ensure_artist_cache(artist)
    if artist is None:
        abort(404)
    return render_template('artist.html', **app.default_template_args, artist=artist)


@app.route("/genre/<genre_name>")
def get_genre(genre_name):
    return render_template('genre.html', **app.default_template_args,
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


@app.route("/play/<album_id>/<track_id>", methods=["POST"])
def play(album_id, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'album': album_id, 'track': track_id})
    return ('', 204)


@app.route("/search")
def search():
    return render_template('search.html', **app.default_template_args)


def make_header(links):
    return ' | '.join(make_header_component(dest, label) for (dest, label) in links)


def make_header_component(dest, label):
    return f'<a href="{dest}" class="text-decoration-none" style="color: ghostwhite">{label}</a>'


def parse_args():
    parser = ArgumentParser()
    parser.add_argument('server', type=str, nargs='?',
                        help="Piju server hostname or IP address. "
                             "Port may optionally be specified as :PORT")
    parser.set_defaults(server='piju:5000')
    args = parser.parse_args()
    # TODO: Error checking on args.server
    if not args.server.startswith('http'):
        args.server = 'http://' + args.server
    if args.server[-1] == '/':
        args.server = args.server[:-1]
    return args


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


def main():
    args = parse_args()
    app.server = args.server
    app.cache = Cache(app)
    app.default_template_args = {
        "server": app.server,
        "make_header": make_header
    }
    connection_test(app.server, required_api_version='2.0')
    app.run(host='0.0.0.0', port=80, debug=True)


if __name__ == '__main__':
    main()
