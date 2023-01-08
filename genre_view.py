from collections import namedtuple

UNCATEGORISED = 'Uncategorised'

Genre = namedtuple('Genre', 'displayed_name, icon, mp3_genres')


class Icons:
    library_music = "las la-music"
    radio = "las la-broadcast-tower"


GENRE_SORT_ORDERS = [
    Genre('Comedy', Icons.library_music, [
        'Comedy',
        '(Humour)',
        'Spoken & Audio',
    ]),
    Genre('Electronic', Icons.library_music, [
        '(Electronic)',
        'Electronic',
        'Electronica',
    ]),
    Genre('Jazz, Blues & Soul', Icons.library_music, [
        '(Jazz)',
        'Blues',
        'Bluegrass',
        'Funk/Soul',
        'Jazz',
        'R&B',
        'Soul',
    ]),
    Genre('Rock & Pop', Icons.library_music, [
        '(Alternative)',
        '(Alternative Rock)',
        '(Classic Rock)',
        '(Indie)',
        '(Pop)',
        '(Rock)',
        'Acoustic Rock',
        'Alt. Rock',
        'Alternative',
        'Alternative/Indie',
        'Alternative Pop/Rock',
        'Alternative Rock',
        'AOR Classic Rock',
        'Art Rock',
        'Britpop',
        'BritPop',
        'Celtic',
        'Classic Rock',
        "Children's",
        'Contemporary Country',
        'Contemporary Pop',
        '(Country)',
        'Country',
        'Country & Folk',
        'Dance',
        'Dance & DJ',
        'Dance & House',
        'Disco',
        'Downtempo',
        'Folk',
        'Folk/Rock',
        'Folk-Rock',
        'Folk Rock',
        'Garage',
        'Garage Rock Revival',
        'General Metal',
        'General Rock',
        'Glam Rock',
        'Hard Rock',
        'Hard Rock & Metal',
        'Hip-Hop',
        'Hip Hop',
        'House',
        'Indie',
        'Indie / Alternative',
        'Indie Rock',
        'Jazz/Rock',
        'Metal',
        'Miscellaneous',
        'New Age',
        'New Wave',
        'Nu-Metal',
        'Oldies',
        'Other',
        'Pop',
        'Pop/Rock',
        'Pop Rock',
        'Post rock',
        'Post-rock',
        'Pre-Punk',
        'Punk',
        'Rap',
        'Reggae',
        'Rock',
        'Rock/Pop',
        'Rock & Roll',
        'Ska',
        'Ska/Reggae',
    ]),
    Genre('Goth & Industrial', Icons.library_music, [
        'Gothic Rock',
        'Industrial',
        'Post Punk',
    ]),
    Genre('Ambient', Icons.library_music, [
        'Ambient',
        'Dark Ambient',
    ]),
    Genre('Lounge', Icons.library_music, [
        'Easy Listening',
    ]),
    Genre('World', Icons.library_music, [
        'International',
        'Latin',
        '(Latin)',
        'Latin Music',
        'Traditional',
        'World',
        '(World)',
    ]),
    Genre('Soundtrack', Icons.library_music, [
        'OST',
        'Soundtrack',
        'Soundtracks',
    ]),
    Genre('Classical', Icons.library_music, [
        'Classical',
        'General Classical',
        'Modern Classical',
        'Religious',
    ]),
    Genre('Educational', Icons.library_music, [
        'Education',
        'Educational',
    ]),
    Genre(UNCATEGORISED, Icons.library_music, [
    ]),
    Genre('Spoken word', Icons.radio, [
        'Spoken Word',
    ]),
]

GENRE_SORT_ORDER = dict((genre.displayed_name, index) for index, genre in enumerate(GENRE_SORT_ORDERS))

GENRE_VIEWS = dict((genre.displayed_name, genre) for genre in GENRE_SORT_ORDERS)


def genre_lookup_generator():
    for genre in GENRE_SORT_ORDERS:
        for server_genre in genre.mp3_genres:
            yield (server_genre, genre)


GENRE_LOOKUP = dict(genre_lookup_generator())
