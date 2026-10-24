from collections import namedtuple
from typing import Optional

from flask import abort
import requests


Album = namedtuple('Album',
                   'id, artist, title, year, artwork_link, is_compilation, genre, numberdisks, tracks')
Artist = namedtuple('Artist', 'name, albums')
DisplayGenre = namedtuple('DisplayGenre', 'id, name, icon, view_style')
Playlist = namedtuple('Playlist', 'id, server_link, title, tracks')
PlaylistSummary = namedtuple('PlaylistSummary', 'id, server_link, title')
RadioStation = namedtuple('RadioStation', 'id, server_link, name, artwork')
Track = namedtuple('Track', 'id, artist, title, disknumber, tracknumber')


DEFAULT_FETCH_TIMEOUT = 300

# Map from the abstract icon identifiers used by the server to the Line Awesome classes to draw them
DEFAULT_GENRE_ICON = "las la-music"
GENRE_ICONS = {
    "music": DEFAULT_GENRE_ICON,
    "radio": "las la-broadcast-tower",
    "spoken_word": "las la-comment",
}


def display_genre_from_json(display_genre_json) -> DisplayGenre:
    return DisplayGenre(id=str(display_genre_json['id']),
                        name=display_genre_json['name'],
                        icon=GENRE_ICONS.get(display_genre_json['icon'], DEFAULT_GENRE_ICON),
                        view_style=display_genre_json['view_style'])


def id_from_link(link):
    return link[link.rindex('/') + 1:] if link else ''


def one_track_from_json(track_json) -> Optional[Track]:
    if not track_json.get('link'):
        return None
    return Track(id=id_from_link(track_json['link']),
                 artist=track_json['artist'],
                 title=track_json['title'],
                 disknumber=track_json['disknumber'],
                 tracknumber=track_json['tracknumber'])


def track_list_from_json(tracks_json) -> list[Optional[Track]]:
    return [one_track_from_json(track_json) for track_json in tracks_json]


def album_from_json(album_json, genre: Optional[DisplayGenre]) -> Album:
    is_compilation = album_json['iscompilation']
    artist = album_json['artist']
    if not artist:
        artist = 'Various Artists' if is_compilation else 'Unknown Artist'
    tracks = track_list_from_json(album_json.get('tracks', []))  # absent if fetched with tracks=none
    tracks.sort(key=lambda t: (t.disknumber if (t and t.disknumber is not None) else 9999,
                               t.tracknumber if (t and t.tracknumber is not None) else 0))
    return Album(id=id_from_link(album_json['link']),
                 artist=artist,
                 title=album_json['title'],
                 year=album_json['releasedate'],
                 artwork_link=album_json['artwork']['link'],
                 is_compilation=is_compilation,
                 genre=genre,
                 numberdisks=album_json['numberdisks'],
                 tracks=tracks)


def playlist_from_json(playlist_json) -> Playlist:
    link = playlist_json['link']
    return Playlist(id=id_from_link(link),
                    server_link=link,
                    title=playlist_json['title'],
                    tracks=track_list_from_json(playlist_json['tracks']))


class Cache:
    def __init__(self, app):
        self.app = app
        # The following instance variables are populated by ensure_genre_cache()
        self.display_genres = None  # list of DisplayGenre, in the order they should be shown
        # The following instance variables are populated by ensure_playlist_summary()
        self.playlist_summaries = {}
        # The following instance variables are popualated by ensure_radio_station_cache()
        self.radio_stations = {}

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

    def ensure_genre_cache(self, refresh=False):
        self.app.logger.debug("ensure_genre_cache")
        if refresh or self.display_genres is None:
            in_use = []
            for display_genre_json in self._wrapped_requests_get('display_genre/'):  # in display order
                if display_genre_json['album_count'] > 0:
                    in_use.append(display_genre_from_json(display_genre_json))
            # Only show the display genres that have something in them
            self.display_genres = in_use

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
