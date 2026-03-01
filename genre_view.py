from dataclasses import dataclass
from enum import StrEnum

UNCATEGORISED = "Uncategorised"


class Icons(StrEnum):
    LIBRARY_MUSIC = "las la-music"
    RADIO = "las la-broadcast-tower"
    SPOKEN_WORD = "las la-comment"


class ViewStyle(StrEnum):
    LIST_OF_ALBUMS = "albums"
    LIST_OF_ARTISTS = "artists"


@dataclass
class Genre:
    displayed_name: str
    icon: Icons
    view_style: ViewStyle
    mp3_genres: list[str]


GENRE_SORT_ORDERS = [
    Genre(
        displayed_name="Comedy",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Comedy",
            "(Humour)",
        ],
    ),
    Genre(
        displayed_name="Electronic",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "(Electronic)",
            "Electronic",
            "Electronica",
            "Experimental/Electronic",
        ],
    ),
    Genre(
        displayed_name="Jazz, Blues & Soul",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "(Jazz)",
            "Blues",
            "Bluegrass",
            "Funk",
            "Funk/Soul",
            "funk soul",
            "Jazz",
            "Ragtime",
            "R&B",
            "Soul",
        ],
    ),
    Genre(
        displayed_name="Rock & Pop",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "(Alternative)",
            "(Alternative Rock)",
            "(Classic Rock)",
            "(Indie)",
            "(Pop)",
            "(Rock)",
            "Acoustic Rock",
            "Alt. Rock",
            "Alternative",
            "Alternative/Indie",
            "Alternative Pop/Rock",
            "Alternative Rock",
            "AOR Classic Rock",
            "Art Rock",
            "Avant Garde",
            "Avantgarde",
            "Big Beat",
            "Britpop",
            "BritPop",
            "Celtic",
            "Classic Rock",
            "Children's",
            "Contemporary Country",
            "Contemporary Pop",
            "Coldwave/Synth",
            "(Country)",
            "Country",
            "Country & Folk",
            "Dance",
            "Dance & DJ",
            "Dance & House",
            "Disco",
            "Downtempo",
            "Electro swing",
            "Electroswing",
            "Folk",
            "Folk/Rock",
            "Folk-Rock",
            "Folk Rock",
            "Garage",
            "Garage Rock Revival",
            "General Metal",
            "General Rock",
            "Glam Rock",
            "Hard Rock",
            "Hard Rock & Metal",
            "Heavy Metal",
            "Hip-Hop",
            "Hip Hop",
            "House",
            "Indie",
            "Indie/Alternative",
            "Indie / Alternative",
            "Indie Rock",
            "Jazz/Rock",
            "Metal",
            "Miscellaneous",
            "New Age",
            "New Wave",
            "Nu-Metal",
            "Oldies",
            "Other",
            "Pop",
            "Pop/Rock",
            "Pop Rock",
            "Post rock",
            "Post-rock",
            "Pre-Punk",
            "Progressive Metal",
            "Punk",
            "Rap",
            "Reggae",
            "Rock",
            "Rock/Pop",
            "Rock & Roll",
            "Ska",
            "Ska/Reggae",
        ],
    ),
    Genre(
        displayed_name="Goth & Industrial",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Darkwave",
            "Gothic Rock",
            "Industrial",
            "Post Punk",
        ],
    ),
    Genre(
        displayed_name="Ambient",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Ambient",
            "Dark Ambient",
            "Meditative",
        ],
    ),
    Genre(
        displayed_name="Lounge",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Easy Listening",
        ],
    ),
    Genre(
        displayed_name="World",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "International",
            "Latin",
            "(Latin)",
            "Latin Music",
            "Traditional",
            "World",
            "(World)",
        ],
    ),
    Genre(
        displayed_name="Soundtrack",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "OST",
            "Soundtrack",
            "Soundtracks",
        ],
    ),
    Genre(
        displayed_name="Classical",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Classical",
            "General Classical",
            "Modern Classical",
            "Religious",
        ],
    ),
    Genre(
        displayed_name="Educational",
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[
            "Education",
            "Educational",
        ],
    ),
    Genre(
        displayed_name=UNCATEGORISED,
        icon=Icons.LIBRARY_MUSIC,
        view_style=ViewStyle.LIST_OF_ALBUMS,
        mp3_genres=[],
    ),
    Genre(
        displayed_name="Spoken word",
        icon=Icons.SPOKEN_WORD,
        view_style=ViewStyle.LIST_OF_ARTISTS,
        mp3_genres=[
            "Speech",
            "Spoken & Audio",
            "Spoken Word",
        ],
    ),
]

# dict[str, int] map display name to index
GENRE_SORT_ORDER = {
    genre.displayed_name: index for index, genre in enumerate(GENRE_SORT_ORDERS)
}

# dict[str, Genre] map display name to genre object
GENRE_VIEWS = {genre.displayed_name: genre for genre in GENRE_SORT_ORDERS}


def genre_lookup_generator():
    for genre in GENRE_SORT_ORDERS:
        for server_genre in genre.mp3_genres:
            yield (server_genre.casefold(), genre)


# dict[str, genre] map server name to genre object
GENRE_LOOKUP = dict(genre_lookup_generator())
