from collections import namedtuple
import datetime
import string
from typing import List, Optional

from flask import abort
import requests
import unidecode


Album = namedtuple('Album',
                   'id, artist, title, year, artwork_link, is_compilation, genre, numberdisks, tracks, anchor')
Artist = namedtuple('Artist', 'name, albums')
DisplayGenre = namedtuple('DisplayGenre', 'id, name, icon, view_style')
Playlist = namedtuple('Playlist', 'id, server_link, title, tracks')
PlaylistSummary = namedtuple('PlaylistSummary', 'id, server_link, title')
RadioStation = namedtuple('RadioStation', 'id, server_link, name, artwork')
Track = namedtuple('Track', 'id, artist, title, disknumber, tracknumber')


DEFAULT_FETCH_TIMEOUT = 300
GENRE_CONTENTS_PAGE_SIZE = 100  # the largest page size that the server allows

# Map from the abstract icon identifiers used by the server to the Line Awesome classes to draw them
DEFAULT_GENRE_ICON = "las la-music"
GENRE_ICONS = {
    "music": DEFAULT_GENRE_ICON,
    "radio": "las la-broadcast-tower",
    "spoken_word": "las la-comment",
}


def get_album_sort_order(album):
    artist = album.artist
    artist = artist.replace('"', '')
    artist = unidecode.unidecode(artist)
    artist = artist.lower()
    title = album.title if album.title else "ZZZZZZZZZZZ"
    title = unidecode.unidecode(title)
    title = title.lower()
    return (artist, album.year or 0, title)


def get_artist_anchor(artist: str) -> str:
    # try multiple characters, to cope with things like
    # '"Weird" Al', who should sort as W
    for ch in artist[:2]:
        anchor = ch.upper()
        anchor = unidecode.unidecode(anchor)
        if anchor in string.ascii_uppercase:
            return anchor
        if anchor in string.digits:
            return 'num'
    # first few characters aren't anything obvious
    return 'num'


def id_from_link(link):
    return link[link.rindex('/') + 1:] if link else ''


class Cache:
    def __init__(self, app):
        self.app = app
        # The following instance variables are populated by ensure_genre_cache()
        self.display_genres = None  # list of DisplayGenre, in the order they should be shown
        self.display_genres_by_id = {}
        self.display_genres_from_links = {}  # map from server genre link to DisplayGenre
        # The following instance variables are populated by ensure_genre_contents_cache(genre_id)
        self.albums_in_genre = {}  # map from display genre id to list of Album
        self.partial_cache = {}
        # The following instance variables are populated by ensure_album_cache(album_id)
        self.album_details = {}
        # The following instance variables are populated by ensure_artist_cache(artist)
        self.artist_details = {}
        # The following instance variables are populated by ensure_playlist_summary()
        self.playlist_summaries = {}
        # The following instance variables are populated by ensure_playlist_cache()
        self.playlist_details = {}
        # The following instance variables are popualated by ensure_radio_station_cache()
        self.radio_stations = {}

    def _add_album_from_json(self, album_json):
        album_id = id_from_link(album_json['link'])
        first_genre = album_json['genres'][0] if album_json['genres'] else None
        if first_genre:
            genre = self.display_genres_from_links.get(first_genre)
            if not genre:
                # We need to refresh our cache of genres
                self.ensure_genre_cache(refresh=True)
                genre = self.display_genres_from_links.get(first_genre)
        else:
            genre = None
        is_compilation = album_json['iscompilation']
        artist = album_json['artist']
        if not artist:
            artist = 'Various Artists' if is_compilation else 'Unknown Artist'
        anchor = get_artist_anchor(artist)
        tracks = self.track_list_from_json(album_json['tracks'])
        tracks.sort(key=lambda t: (t.disknumber if (t and t.disknumber is not None) else 9999,
                                   t.tracknumber if (t and t.tracknumber is not None) else 0))
        album_details = Album(id=album_id,
                              artist=artist,
                              title=album_json['title'],
                              year=album_json['releasedate'],
                              artwork_link=album_json['artwork']['link'],
                              is_compilation=is_compilation,
                              genre=genre,
                              numberdisks=album_json['numberdisks'],
                              tracks=tracks,
                              anchor=anchor)
        self.album_details[album_id] = album_details
        return album_details

    def _add_artist_from_json(self, definitive_artist_name: str, artist_json: dict):
        # We'd normally only expect a single artist in the response
        # but this works if there are multiple, e.g. for artist aliases
        albums = []
        for albums_json in artist_json.values():
            for album_json in albums_json:
                albums.append(self._add_album_from_json(album_json))
        albums.sort(key=lambda album: (album.year if album.year else 9999, album.title if album.title else ''))
        artist = Artist(definitive_artist_name, albums)
        self.artist_details[definitive_artist_name.lower()] = artist

    def _add_playlist_from_json(self, playlist_json):
        link = playlist_json['link']
        playlist_id = id_from_link(link)
        tracks = self.track_list_from_json(playlist_json['tracks'])
        playlist_details = Playlist(id=playlist_id,
                                    server_link=link,
                                    title=playlist_json['title'],
                                    tracks=tracks)
        self.playlist_details[playlist_id] = playlist_details
        return playlist_details

    def _wrapped_requests_get(self, url_suffix, timeout=DEFAULT_FETCH_TIMEOUT):
        """
        Call requests.get(), and calls abort() if an error occurs.
        On success, returns the decodes json from the response.
        """
        url = self.app.server + '/' + url_suffix
        self.app.logger.debug(f'fetching {url}')
        try:
            response = requests.get(url, timeout=timeout)
            if not response.ok:
                if response.status_code == 404:
                    abort(404)
                else:
                    abort(502, f'Error from server: {url} returned {response.status_code}')
        except requests.exceptions.Timeout:
            abort(504, f'Timeout fetching {url}')
        return response.json()

    def ensure_album_cache(self, album_id, refresh=False) -> Optional[Album]:
        self.ensure_genre_cache()  # Needed for the genre in add_album_from_json
        if refresh or self.album_details.get(album_id) is None:
            response_json = self._wrapped_requests_get(f'albums/{album_id}?tracks=all')
            self._add_album_from_json(response_json)  # updates self.album_details[album_id]
        return self.album_details[album_id]

    def ensure_artist_cache(self, artist, refresh=False) -> Optional[Artist]:
        self.ensure_genre_cache()  # Needed for the genre in add_album_from_json
        artist_lookup = artist.lower()
        if refresh or self.artist_details.get(artist_lookup) is None:
            response_json = self._wrapped_requests_get(f'artists/{artist}?tracks=all')
            self._add_artist_from_json(artist, response_json)  # updates self.artist_details[artist.lower()]
        return self.artist_details[artist_lookup]

    def ensure_genre_cache(self, refresh=False):
        self.app.logger.debug("ensure_genre_cache")
        if refresh or self.display_genres is None:
            display_genres_by_link = {}
            for display_genre_json in self._wrapped_requests_get('display_genre/'):  # in display order
                display_genre = DisplayGenre(id=str(display_genre_json['id']),
                                             name=display_genre_json['name'],
                                             icon=GENRE_ICONS.get(display_genre_json['icon'], DEFAULT_GENRE_ICON),
                                             view_style=display_genre_json['view_style'])
                display_genres_by_link[display_genre_json['link']] = display_genre
            display_genres_from_links = {}
            for server_genre in self._wrapped_requests_get('genres/'):
                display_genre = display_genres_by_link.get(server_genre.get('display_genre'))
                if display_genre:
                    display_genres_from_links[server_genre['link']] = display_genre
            self.display_genres_from_links = display_genres_from_links
            self.display_genres_by_id = {genre.id: genre for genre in display_genres_by_link.values()}
            # Only show the display genres that have something in them
            in_use = set(display_genres_from_links.values())
            self.display_genres = [genre for genre in display_genres_by_link.values() if genre in in_use]

    def ensure_genre_contents_cache(self, genre_id, timeout, refresh=False) -> Optional[List[Album]]:
        """
        Ensure we have a cache of the contents of the given display genre,
        and return a list of the albums in that Genre.
        Albums are sorted by artist then release year, and finally title
        """
        start = datetime.datetime.now()
        self.ensure_genre_cache()
        if genre_id not in self.display_genres_by_id:  # Could be a request for an unknown genre
            return None
        if refresh or self.albums_in_genre.get(genre_id) is None:
            albums = []
            link = f'display_genre/{genre_id}?albums=all&playlists=none&limit={GENRE_CONTENTS_PAGE_SIZE}'
            while link:
                time_delta = datetime.datetime.now() - start
                ms_elapsed = (time_delta.seconds * 1000) + time_delta.microseconds / 1000
                if (timeout is not None) and (ms_elapsed > timeout):
                    abort(504)  # gateway timeout, sort of accurate
                self.app.logger.debug(link)
                if (link in self.partial_cache) and not refresh:
                    page_json = self.partial_cache[link]
                else:
                    page_json = self._wrapped_requests_get(link, timeout=timeout)
                    self.partial_cache[link] = page_json
                for album_json in page_json['albums']:
                    albums.append(self._add_album_from_json(album_json))
                link = (page_json['pagination']['next'] or '').lstrip('/')

            # The server's ordering is close to ours, but doesn't know about
            # the special cases that get_artist_anchor() has to cope with
            albums.sort(key=get_album_sort_order)
            self.albums_in_genre[genre_id] = albums
            for link in [link for link in self.partial_cache if link.startswith(f'display_genre/{genre_id}?')]:
                del self.partial_cache[link]
        return self.albums_in_genre[genre_id]

    def ensure_playlist_cache(self, playlist_id, refresh=False):
        self.app.logger.debug(f"ensure_playlist_cache({playlist_id})")
        if refresh or self.playlist_details.get(playlist_id) is None:
            response_json = self._wrapped_requests_get(f'playlists/{playlist_id}?tracks=all')
            self._add_playlist_from_json(response_json)
        return self.playlist_details[playlist_id]

    def ensure_playlist_summary(self, refresh=False):
        self.app.logger.debug("ensure_playlist_summary")
        if refresh or not self.playlist_summaries:
            playlists_json = self._wrapped_requests_get('playlists')
            self.playlist_summaries = {}  # map from id to PlaylistSummary
            for playlist_json in playlists_json:
                title = playlist_json['title']
                link = playlist_json['link']
                playlist_id = id_from_link(link)
                self.playlist_summaries[playlist_id] = PlaylistSummary(playlist_id, link, title)

    def ensure_radio_station_cache(self, refresh=False):
        if refresh or not self.radio_stations:
            radio_json = self._wrapped_requests_get('radio')
            self.radio_stations = {}
            for station in radio_json:
                link = station['link']
                name = station['name']
                artwork = station['artwork']
                station_id = id_from_link(link)
                self.radio_stations[station_id] = RadioStation(station_id, link, name, artwork)

    def one_track_from_json(self, track_json):
        if not track_json.get('link'):
            return None
        return Track(id=id_from_link(track_json['link']),
                     artist=track_json['artist'],
                     title=track_json['title'],
                     disknumber=track_json['disknumber'],
                     tracknumber=track_json['tracknumber'])

    def track_list_from_json(self, tracks_json):
        tracks = [self.one_track_from_json(track_json) for track_json in tracks_json]
        return tracks
