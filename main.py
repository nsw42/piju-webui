from argparse import ArgumentParser
from collections import defaultdict, namedtuple
from typing import List, Optional

from flask import Flask, abort, render_template
import requests

import genre_view

app = Flask(__name__)

Album = namedtuple('Album', 'id, artist, title, artwork_link, genre_name, tracks')
Track = namedtuple('Track', 'id, title, tracknumber')


def id_from_link(link):
    return link[link.rindex('/') + 1:]


class Cache:
    def __init__(self):
        # The following instance variables are populated by ensure_genre_cache()
        self.display_genres = None
        self.genre_links = None
        self.genre_names_from_links = {}
        # The following instance variables are populated by ensure_genre_contents_cache(genre_name)
        self.albums_in_genre = defaultdict(list)  # map from genre_name to list of Album
        # The following instance variables are populated by ensure_album_cache(album_id)
        self.album_details = {}

    def ensure_genre_cache(self):
        app.logger.debug("ensure_genre_cache")
        if self.display_genres is None:
            response = requests.get(app.server + '/genres')
            if response.status_code != 200:
                raise Exception('Unable to connect to server')  # TODO: Error handling
            display_names_set = set()
            self.genre_links = defaultdict(list)  # map from genre displayed name to list of server address
            server_genre_json = response.json()
            for server_genre in server_genre_json:
                server_link = server_genre['link']
                server_genre_name = server_genre['name']
                display_genre = genre_view.GENRE_LOOKUP.get(server_genre_name)
                if display_genre:
                    display_genre = display_genre.displayed_name
                else:
                    print(f"WARNING: Do not know how to categorise {server_genre_name} ({server_genre['link']})")
                    display_genre = genre_view.UNCATEGORISED
                self.genre_links[display_genre].append(server_link)
                app.logger.debug(f'{server_link} -> {display_genre}')
                self.genre_names_from_links[server_link] = display_genre
                display_names_set.add(display_genre)
            self.display_names = list(sorted(display_names_set, key=lambda dn: genre_view.GENRE_SORT_ORDER[dn]))
            self.display_genres = [genre_view.GENRE_VIEWS[dn] for dn in self.display_names]

    def ensure_genre_contents_cache(self, genre_name) -> Optional[List[Album]]:
        self.ensure_genre_cache()
        if self.albums_in_genre.get(genre_name) is None:
            server_links = self.genre_links.get(genre_name)  # Could be a request for an unknown genre name
            if server_links is None:
                return None
            for link in server_links:
                response = requests.get(app.server + link + '?albums=all')
                if response.status_code != 200:
                    abort(500)  # TODO: Error handling
                genre_json = response.json()
                for album_json in genre_json['albums']:
                    album = self.add_album_from_json(album_json)
                    self.albums_in_genre[genre_name].append(album)

            def get_album_sort_order(album):
                artist = album.artist if album.artist else "Unknown Artist"
                artist = artist.replace('"', '')
                artist = artist.lower()
                title = album.title if album.title else "ZZZZZZZZZZZ"
                title = title.lower()
                return (artist, title)  # TODO: Sort by album year instead of title
            self.albums_in_genre[genre_name].sort(key=get_album_sort_order)
        return self.albums_in_genre[genre_name]

    def ensure_album_cache(self, album_id) -> Optional[Album]:
        self.ensure_genre_cache()  # Needed for the genre_name in add_album_from_json
        if self.album_details.get(album_id) is None:
            response = requests.get(f'{app.server}/albums/{album_id}?tracks=all')
            if response.status_code != 200:
                abort(500)  # TODO: Error handling
            self.add_album_from_json(response.json())  # updates self.album_details[album_id]
        return self.album_details[album_id]

    def add_album_from_json(self, album_json):
        album_id = id_from_link(album_json['link'])
        first_genre = album_json['genres'][0] if album_json['genres'] else None
        genre_name = self.genre_names_from_links[first_genre] if first_genre else None
        album_details = Album(id=album_id,
                              artist=album_json['artist'],
                              title=album_json['title'],
                              artwork_link=album_json['artwork']['link'],
                              genre_name=genre_name,
                              tracks=[Track(id=id_from_link(track_json['link']),
                                            title=track_json['title'],
                                            tracknumber=track_json['tracknumber'])
                                      for track_json in album_json['tracks']])
        self.album_details[album_id] = album_details
        return album_details


@app.route("/")
def root():
    app.cache.ensure_genre_cache()
    return render_template('index.html', **app.default_template_args, genres=app.cache.display_genres)


@app.route("/genre/<genre_name>")
def get_genre(genre_name):
    albums = app.cache.ensure_genre_contents_cache(genre_name)
    if albums is None:
        abort(404)
    return render_template('genre.html', **app.default_template_args, genre_name=genre_name, albums=albums)


@app.route("/albums/<album_id>")
def get_album(album_id):
    album = app.cache.ensure_album_cache(album_id)
    if album is None:
        abort(404)
    return render_template('album.html', **app.default_template_args, album=album)


@app.route("/play/<album_id>/<track_id>", methods=["POST"])
def play(album_id, track_id):
    requests.post(f"{app.server}/player/play",
                  json={'album': album_id, 'track': track_id})
    return ('', 204)


def make_header(links):
    return ' | '.join(f'<a href="{dest}" class="text-decoration-none" style="color: ghostwhite">{label}<a>' for (dest, label) in links)


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


def main():
    args = parse_args()
    app.server = args.server
    app.cache = Cache()
    app.default_template_args = {
        "server": app.server,
        "make_header": make_header
    }
    app.run(host='0.0.0.0', port=80, debug=True)


if __name__ == '__main__':
    main()
