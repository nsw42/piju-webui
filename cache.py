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


class Cache:
    def __init__(self, app):
        self.app = app
        # The following instance variables are populated by ensure_genre_cache()
        self.display_genres = None  # list of DisplayGenre, in the order they should be shown
        self.display_genres_by_id = {}
        self.display_genres_by_link = {}
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
        display_genre_links = album_json.get('display_genres', [])
        first_genre = display_genre_links[0] if display_genre_links else None
        if first_genre:
            genre = self.display_genres_by_link.get(first_genre)
            if not genre:
                # We need to refresh our cache of genres
                self.ensure_genre_cache(refresh=True)
                genre = self.display_genres_by_link.get(first_genre)
        else:
            genre = None
        is_compilation = album_json['iscompilation']
        artist = album_json['artist']
        if not artist:
            artist = 'Various Artists' if is_compilation else 'Unknown Artist'
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
                              tracks=tracks)
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
            in_use = []
            for display_genre_json in self._wrapped_requests_get('display_genre/'):  # in display order
                display_genre = display_genre_from_json(display_genre_json)
                display_genres_by_link[display_genre_json['link']] = display_genre
                if display_genre_json['album_count'] > 0:
                    in_use.append(display_genre)
            self.display_genres_by_link = display_genres_by_link
            self.display_genres_by_id = {genre.id: genre for genre in display_genres_by_link.values()}
            # Only show the display genres that have something in them
            self.display_genres = in_use

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
