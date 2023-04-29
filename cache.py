from collections import defaultdict, namedtuple
import datetime
import string
from typing import List, Optional

from flask import abort
import requests
import unidecode

import genre_view


Album = namedtuple('Album',
                   'id, artist, title, year, artwork_link, is_compilation, genre_name, numberdisks, tracks, anchor')
Artist = namedtuple('Artist', 'name, albums')
Playlist = namedtuple('Playlist', 'id, server_link, title, tracks')
PlaylistSummary = namedtuple('PlaylistSummary', 'id, server_link, title')
Track = namedtuple('Track', 'id, artist, title, disknumber, tracknumber')


def id_from_link(link):
    return link[link.rindex('/') + 1:] if link else ''


class Cache:
    def __init__(self, app):
        self.app = app
        self.flush()

    def add_album_from_json(self, album_json):
        album_id = id_from_link(album_json['link'])
        first_genre = album_json['genres'][0] if album_json['genres'] else None
        genre_name = self.genre_names_from_links[first_genre] if first_genre else None
        is_compilation = album_json['iscompilation']
        artist = album_json['artist']
        if not artist:
            artist = 'Various Artists' if is_compilation else 'Unknown Artist'
        anchor = artist[0].upper()
        anchor = unidecode.unidecode(anchor)
        if anchor not in string.ascii_uppercase:
            anchor = 'num'
        tracks = self.track_list_from_json(album_json['tracks'])
        tracks.sort(key=lambda t: (t.disknumber if (t.disknumber is not None) else 9999,
                                   t.tracknumber if (t.tracknumber is not None) else 0))
        album_details = Album(id=album_id,
                              artist=artist,
                              title=album_json['title'],
                              year=album_json['releasedate'],
                              artwork_link=album_json['artwork']['link'],
                              is_compilation=is_compilation,
                              genre_name=genre_name,
                              numberdisks=album_json['numberdisks'],
                              tracks=tracks,
                              anchor=anchor)
        self.album_details[album_id] = album_details
        return album_details

    def add_artist_from_json(self, artist_json):
        # We'd normally only expect a single artist in the response
        # but this works if there are multiple, which can happen if
        # there are multiple capitalisations of an artist
        albums = []
        for artist_name, albums_json in artist_json.items():
            for album_json in albums_json:
                albums.append(self.add_album_from_json(album_json))
        albums.sort(key=lambda album: album.year if album.year else 9999)
        artist = Artist(artist_name, albums)
        self.artist_details[artist_name.lower()] = artist

    def add_playlist_from_json(self, playlist_json):
        link = playlist_json['link']
        playlist_id = id_from_link(link)
        tracks = self.track_list_from_json(playlist_json['tracks'])
        playlist_details = Playlist(id=playlist_id,
                                    server_link=link,
                                    title=playlist_json['title'],
                                    tracks=tracks)
        self.playlist_details[playlist_id] = playlist_details
        return playlist_details

    def ensure_album_cache(self, album_id) -> Optional[Album]:
        self.ensure_genre_cache()  # Needed for the genre_name in add_album_from_json
        if self.album_details.get(album_id) is None:
            response = requests.get(f'{self.app.server}/albums/{album_id}?tracks=all')
            if response.status_code != 200:
                abort(500)  # TODO: Error handling
            self.add_album_from_json(response.json())  # updates self.album_details[album_id]
        return self.album_details[album_id]

    def ensure_artist_cache(self, artist) -> Optional[Artist]:
        self.ensure_genre_cache()  # Needed for the genre_name in add_album_from_json
        artist_lookup = artist.lower()
        if self.artist_details.get(artist_lookup) is None:
            response = requests.get(f'{self.app.server}/artists/{artist}?tracks=all')
            if response.status_code != 200:
                abort(404)  # TODO: Error handling
            self.add_artist_from_json(response.json())  # updates self.artist_details[artist.lower()]
        return self.artist_details[artist_lookup]

    def ensure_genre_cache(self):
        self.app.logger.debug("ensure_genre_cache")
        if self.display_genres is None:
            response = requests.get(self.app.server + '/genres')
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
                self.app.logger.debug(f'{server_link} -> {display_genre}')
                self.genre_names_from_links[server_link] = display_genre
                display_names_set.add(display_genre)
            self.display_names = list(sorted(display_names_set, key=lambda dn: genre_view.GENRE_SORT_ORDER[dn]))
            self.display_genres = [genre_view.GENRE_VIEWS[dn] for dn in self.display_names]

    def ensure_genre_contents_cache(self, genre_name, timeout) -> Optional[List[Album]]:
        """
        Ensure we have a cache of the contents of the given genre,
        and return a list of the albums in that Genre.
        Albums are sorted by artist then release year, and finally title
        """
        start = datetime.datetime.now()
        self.ensure_genre_cache()
        if self.albums_in_genre.get(genre_name) is None:
            server_links = self.genre_links.get(genre_name)  # Could be a request for an unknown genre name
            if server_links is None:
                return None
            albums = {}  # indexed by album id to avoid duplication
            # (eg for the scenario of an album in two genres, both of which are displayed under the same
            # genre displayname)
            for link in server_links:
                time_delta = datetime.datetime.now() - start
                ms_elapsed = (time_delta.seconds * 1000) + time_delta.microseconds / 1000
                if (timeout is not None) and (ms_elapsed > timeout):
                    abort(504)  # gateway timeout, sort of accurate
                self.app.logger.debug(link)
                if link in self.partial_cache:
                    genre_json = self.partial_cache[link]
                else:
                    response = requests.get(self.app.server + link + '?albums=all', timeout=timeout)
                    if response.status_code != 200:
                        abort(500)  # TODO: Error handling
                    genre_json = response.json()
                    self.partial_cache[link] = genre_json
                for album_json in genre_json['albums']:
                    album = self.add_album_from_json(album_json)
                    albums[album.id] = album

            def get_album_sort_order(album):
                artist = album.artist
                artist = artist.replace('"', '')
                artist = unidecode.unidecode(artist)
                artist = artist.lower()
                title = album.title if album.title else "ZZZZZZZZZZZ"
                title = unidecode.unidecode(title)
                title = title.lower()
                return (artist, album.year or 0, title)
            albums = list(albums.values())
            albums.sort(key=get_album_sort_order)
            self.albums_in_genre[genre_name] = albums
        return self.albums_in_genre[genre_name]

    def ensure_playlist_cache(self, playlist_id):
        self.app.logger.debug(f"ensure_playlist_cache({playlist_id}")
        if self.playlist_details.get(playlist_id) is None:
            response = requests.get(f'{self.app.server}/playlists/{playlist_id}?tracks=all')
            if response.status_code != 200:
                abort(500)  # TODO: Error handling
            self.add_playlist_from_json(response.json())
        return self.playlist_details[playlist_id]

    def ensure_playlist_summary(self):
        self.app.logger.debug("ensure_playlist_summary")
        if not self.playlist_summaries:
            response = requests.get(self.app.server + '/playlists')
            if response.status_code != 200:
                raise Exception('Unable to connect to server')  # TODO: Error handling
            self.playlist_summaries = {}  # map from id to PlaylistSummary
            playlists_json = response.json()
            for playlist_json in playlists_json:
                title = playlist_json['title']
                link = playlist_json['link']
                id = id_from_link(link)
                self.playlist_summaries[id] = PlaylistSummary(id, link, title)

    def flush(self):
        # The following instance variables are populated by ensure_genre_cache()
        self.display_genres = None
        self.genre_links = None
        self.genre_names_from_links = {}
        # The following instance variables are populated by ensure_genre_contents_cache(genre_name)
        self.albums_in_genre = defaultdict(list)  # map from genre_name to list of Album
        self.partial_cache = {}
        # The following instance variables are populated by ensure_album_cache(album_id)
        self.album_details = {}
        # The following instance variables are populated by ensure_artist_cache(artist)
        self.artist_details = {}
        # The following instance variables are populated by ensure_playlist_summary()
        self.playlist_summaries = {}
        # The following instance variables are populated by ensure_playlist_cache()
        self.playlist_details = {}

    def track_list_from_json(self, tracks_json):
        tracks = [Track(id=id_from_link(track_json['link']),
                        artist=track_json['artist'],
                        title=track_json['title'],
                        disknumber=track_json['disknumber'],
                        tracknumber=track_json['tracknumber'])
                  for track_json in tracks_json]
        return tracks
