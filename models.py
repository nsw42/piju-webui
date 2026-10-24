from collections import namedtuple
from typing import Optional


Album = namedtuple('Album',
                   'id, artist, title, year, artwork_link, is_compilation, genre, numberdisks, tracks')
Artist = namedtuple('Artist', 'name, albums')
DisplayGenre = namedtuple('DisplayGenre', 'id, name, icon, view_style')
Playlist = namedtuple('Playlist', 'id, server_link, title, tracks')
PlaylistSummary = namedtuple('PlaylistSummary', 'id, server_link, title')
RadioStation = namedtuple('RadioStation', 'id, server_link, name, artwork')
Track = namedtuple('Track', 'id, artist, title, disknumber, tracknumber')


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


def playlist_summary_from_json(playlist_json) -> PlaylistSummary:
    link = playlist_json['link']
    return PlaylistSummary(id=id_from_link(link), server_link=link, title=playlist_json['title'])


def radio_station_from_json(station_json) -> RadioStation:
    link = station_json['link']
    return RadioStation(id=id_from_link(link), server_link=link, name=station_json['name'],
                        artwork=station_json['artwork'])


def playlist_from_json(playlist_json) -> Playlist:
    link = playlist_json['link']
    return Playlist(id=id_from_link(link),
                    server_link=link,
                    title=playlist_json['title'],
                    tracks=track_list_from_json(playlist_json['tracks']))
