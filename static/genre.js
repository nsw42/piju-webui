let lazyLoadImages = false;
let imageObserver;
// GENRE_ID is defined in the html
// VIEW_STYLE is defined in the html, as either "artists" or "albums"

// Fetch a small first page so something appears quickly, then the rest in large pages
const GENRE_FIRST_PAGE_SIZE = 20;
const GENRE_PAGE_SIZE = 1000;  // the largest page size that the server allows
const GENRE_PAGE_TIMEOUT = 30000;
const GENRE_PAGE_RETRY_DELAY = 5000;

// The contents of the genre are fetched from the server a page at a time.
// allAlbums and allArtists accumulate everything fetched so far, in the order provided by the server.
let allAlbums = [];
let allArtists = [];
const knownArtists = new Set();
let firstPageLoaded = false;
let loadComplete = false;

// When showing the whole genre (i.e. not a random subset), contents are appended to the page
// as they arrive. renderedCount is how many of allAlbums/allArtists are on the page.
let renderedCount = 0;
let renderedAnchors = {};

$(function() {
    if ('IntersectionObserver' in globalThis) {
        lazyLoadImages = true;
        imageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.lazyLoadImageSrc
                    imageObserver.unobserve(image)
                }
            })
        })
    }
    fetchGenrePage(`/display_genre/${GENRE_ID}?albums=summary&playlists=none&limit=${GENRE_FIRST_PAGE_SIZE}`);
});


function fetchGenrePage(link) {
    $.ajax({
        url: server + link,
        dataType: 'json',
        success: function(page) {
            addAlbums(page['albums'].map(albumFromJson));
            const next = page['pagination']['next'];
            if (next) {
                fetchGenrePage(withPageSize(next, GENRE_PAGE_SIZE));
            } else {
                loadComplete = true;
                if (randomSelected()) {
                    showGenreSubset();
                }
            }
        },
        error: function() {
            console.log(`Failed to fetch ${link}. Retrying`);
            setTimeout(() => fetchGenrePage(link), GENRE_PAGE_RETRY_DELAY);
        },
        timeout: GENRE_PAGE_TIMEOUT,
    });
}


function withPageSize(link, pageSize) {
    // The server's pagination links keep the limit of the current page: replace it
    const url = new URL(link, server);
    url.searchParams.set('limit', pageSize);
    return url.pathname + url.search;
}


function albumFromJson(albumJson) {
    let artist = albumJson['artist'];
    if (!artist) {
        artist = albumJson['iscompilation'] ? 'Various Artists' : 'Unknown Artist';
    }
    const link = albumJson['link'];
    return {
        'id': link.substring(link.lastIndexOf('/') + 1),
        'anchor': getArtistAnchor(artist),
        'artwork_link': albumJson['artwork']['link'],
        'artist': artist,
        'title': albumJson['title'],
        'year': albumJson['releasedate'],
    };
}


function getArtistAnchor(artist) {
    // try multiple characters, to cope with things like
    // '"Weird" Al', who should sort as W
    for (const ch of artist.substring(0, 2)) {
        // Decompose accented characters, so that (e.g.) É is treated as E
        const anchor = ch.toUpperCase().normalize('NFD').charAt(0);
        if (anchor >= 'A' && anchor <= 'Z') {
            return anchor;
        }
        if (anchor >= '0' && anchor <= '9') {
            return 'num';
        }
    }
    // first few characters aren't anything obvious
    return 'num';
}


function addAlbums(albums) {
    for (const album of albums) {
        allAlbums.push(album);
        if (!knownArtists.has(album['artist'])) {
            knownArtists.add(album['artist']);
            allArtists.push(album['artist']);
        }
    }
    firstPageLoaded = true;
    if (!randomSelected()) {
        renderNewContents();
    }
}


function randomSelected() {
    return $('#random-toggle').prop('checked');
}


$('#random-toggle').change(function() {
    let new_state;
    if ($(this).prop('checked')) {
        // Random has been switched on
        new_state = "true";
        if (loadComplete) {
            showGenreSubset();
        } else {
            // We can only choose a random subset once we've got everything
            clearContents();
            showLoadingIndicator();
        }
    } else {
        // Random has been switched off
        new_state = "false";
        clearContents();
        if (firstPageLoaded) {
            renderNewContents();
        }
    }
    // Set a cookie so the toggle is set correctly on the next page load
    document.cookie = "random=" + new_state;
})


function showLoadingIndicator() {
    $('#loading-indicator-parent').show();
    $('#genre-content').addClass('d-none');
    $('#anchor-parent').addClass('d-none');
}


function showContents() {
    $('#loading-indicator-parent').hide();
    $('#genre-content').removeClass('d-none');
}


function clearContents() {
    deleteAllChildrenFromNode(document.getElementById("genre-content"));
    renderedCount = 0;
    renderedAnchors = {};
}


function renderNewContents() {
    switch (VIEW_STYLE) {
        case 'albums':
            appendAlbums(allAlbums.slice(renderedCount));
            renderedCount = allAlbums.length;
            break
        case 'artists':
            appendArtists(allArtists.slice(renderedCount));
            renderedCount = allArtists.length;
            break
        default:
            console.log(`Internal error: unrecognised view_style: ${VIEW_STYLE}`)
            break
    }
    showContents();
}


function showAlbumsCreateAlbumRow(album) {
    const album_row = document.getElementById("album-template").content.cloneNode(true);
    const spacerElement = album_row.querySelector("#artwork-spacer")
    const imgElement = album_row.querySelector("#album-artwork")
    if (album['artwork_link'] === null) {
        // No artwork: remove the img node
        imgElement.remove()
    } else {
        spacerElement.remove()  // We have artwork, so we don't need the spacer
        if (lazyLoadImages) {
            // Store where to find the image when it scrolls into view
            imgElement.dataset.lazyLoadImageSrc = server + album['artwork_link']
            imageObserver.observe(imgElement)
        } else {
            // Lazy loading not supported - set the image source directly
            imgElement.setAttribute('src', server + album['artwork_link'])
        }
    }
    const album_href = album_row.querySelector("#album-href");
    album_href.setAttribute("href", `/albums/${album['id']}`);
    album_href.innerText = album['artist'] + ": " + (album['title'] ?? "Unknown Album");
    if (album['year'] != null) {
        const album_year_node = album_row.querySelector("#album-year");
        album_year_node.innerText = " (" + album['year'] + ")";
    }
    return album_row
}


function deleteAllChildrenFromNode(node) {
    while (node.hasChildNodes()) {
        node.firstChild.remove()
    }
}

function appendAlbums(albums) {
    let genre_content_node = document.getElementById("genre-content")
    for (let album of albums) {
        let album_anchor = album['anchor'];
        if (renderedAnchors[album_anchor] == null) {
            let anchor = document.getElementById("anchor-template").content.cloneNode(true);
            anchor.querySelector("a").setAttribute("id", album_anchor);
            genre_content_node.appendChild(anchor);
            renderedAnchors[album_anchor] = true;
        }

        const albumRow = showAlbumsCreateAlbumRow(album)
        genre_content_node.appendChild(albumRow);
    }

    const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let anchors_contents = '';
    for (let letter of letters) {
        const anchor = (letter == '#' ? 'num' : letter);
        anchors_contents = anchors_contents.concat(
            '<div class="text-center">',
            renderedAnchors[anchor] == null ? letter : `<a href="#${anchor}">${letter}</a>`,
            '</div>'
        )
    }
    $('#anchor-parent').removeClass('d-none');
    $('#anchor-content').html(anchors_contents);
}


function showArtistsCreateArtistRow(artist) {
    const artistRow = document.getElementById('artist-template').content.cloneNode(true)
    const artistHref = artistRow.querySelector('#artist-href')
    artistHref.setAttribute('href', `/artists/${artist}`)
    artistHref.innerText = artist
    return artistRow
}


function appendArtists(artists) {
    let genreContentNode = document.getElementById('genre-content')
    for (let artist of artists) {
        const artistRow = showArtistsCreateArtistRow(artist)
        genreContentNode.appendChild(artistRow)
    }
}


const piju_header_height = Number.parseInt(getCSSVariable("--header-height"));
const piju_footer_height = Number.parseInt(getCSSVariable("--footer-height"));
const piju_album_row_height = Number.parseInt(getCSSVariable("--album-row-height"));
const piju_row_height_with_padding = piju_album_row_height + 16; // 16 because of 'py2' on the top div of album-template

function showGenreSubset() {
    const nrToShow = Math.round(($(globalThis).height() - piju_header_height - piju_footer_height) / piju_row_height_with_padding)
    const showSubsetOf = (VIEW_STYLE === "albums" ? allAlbums : allArtists)
    const appendCallback = (collection => (VIEW_STYLE === "albums") ? appendAlbums(collection) : appendArtists(collection))
    let toShow
    if (showSubsetOf.length <= nrToShow) {
        toShow = showSubsetOf
    } else {
        let indexes = []
        while (indexes.length < nrToShow) {
            const random = Math.floor(Math.random() * showSubsetOf.length)
            if (!indexes.includes(random)) {
                indexes.push(random)
            }
        }
        indexes.sort(function(a, b){return a - b})
        toShow = []
        for (let index of indexes) {
            toShow.push(showSubsetOf[index])
        }
    }
    clearContents()
    appendCallback(toShow)
    showContents()
}
