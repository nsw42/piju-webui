let lazyLoadImages = false;
let imageObserver;
// VIEW_STYLE is defined in the html, as either "artists" or "albums"

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
    let url = globalThis.location.href;
    let slash = url.lastIndexOf('/');
    let leaf = url.substring(slash + 1);
    startAjaxRequest(leaf, 30000);
});

let genre_fetch_results = null;

function startAjaxRequest(leaf, timeout) {
    const now = new Date();
    console.log(`${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} starting ajax request /genre_contents/${leaf}?timeout=${timeout}`);
    $.ajax({
        url: `/genre_contents/${leaf}?timeout=${timeout}&include_artists=${VIEW_STYLE === "artists"}`,
        success: function(result) {
            genre_fetch_results = JSON.parse(result);
            $('#loading-indicator-parent').hide();
            if ($('#random-toggle').prop('checked')) {
                showGenreSubset();
            } else {
                showAllGenreContents();
            }
        },
        error: function() {
            console.log("Failed to get genre contents. Retrying");
            startAjaxRequest(leaf, timeout + 30000);
        },
        timeout: timeout * 3,
    });
}


$('#random-toggle').change(function() {
    let new_state;
    if ($(this).prop('checked')) {
        // Random has been switched on
        new_state = "true";
        if (genre_fetch_results !== null) {
            showGenreSubset();
        }
    } else {
        // Random has been switched off
        new_state = "false";
        if (genre_fetch_results !== null) {
            showAllGenreContents();
        }
    }
    // Set a cookie so the toggle is set correctly on the next page load
    document.cookie = "random=" + new_state;
})


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
    album_href.innerText = (album['artist'] ?? "Unknown Artist") + ": " + (album['title'] ?? "Unknown Album");
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

function showAlbums(albums) {
    let genre_content_node = document.getElementById("genre-content")
    deleteAllChildrenFromNode(genre_content_node)
    let selected_anchors = {};
    for (let album of albums) {
        let album_anchor = album['anchor'];
        if (selected_anchors[album_anchor] == null) {
            let anchor = document.getElementById("anchor-template").content.cloneNode(true);
            anchor.querySelector("a").setAttribute("id", album_anchor);
            genre_content_node.appendChild(anchor);
            selected_anchors[album_anchor] = true;
        }

        const albumRow = showAlbumsCreateAlbumRow(album)
        genre_content_node.appendChild(albumRow);
    }
    genre_content_node.classList.remove('d-none');

    const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let anchors_contents = '';
    for (let letter of letters) {
        const anchor = (letter == '#' ? 'num' : letter);
        anchors_contents = anchors_contents.concat(
            '<div class="text-center">',
            selected_anchors[anchor] == null ? letter : `<a href="#${anchor}">${letter}</a>`,
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


function showArtists(artists) {
    let genreContentNode = document.getElementById('genre-content')
    deleteAllChildrenFromNode(genreContentNode)
    for (let artist of artists) {
        const artistRow = showArtistsCreateArtistRow(artist)
        genreContentNode.appendChild(artistRow)
    }
    genreContentNode.classList.remove('d-none')
}


function showAllGenreContents() {
    switch (VIEW_STYLE) {
        case 'albums':
            showAlbums(genre_fetch_results['albums'])
            break
        case 'artists':
            showArtists(genre_fetch_results['artists'])
            break
        default:
            console.log(`Internal error: unrecognised view_style: ${VIEW_STYLE}`)
            break
    }
}


const piju_header_height = Number.parseInt(getCSSVariable("--header-height"));
const piju_footer_height = Number.parseInt(getCSSVariable("--footer-height"));
const piju_album_row_height = Number.parseInt(getCSSVariable("--album-row-height"));
const piju_row_height_with_padding = piju_album_row_height + 16; // 16 because of 'py2' on the top div of album-template

function showGenreSubset() {
    const nrToShow = Math.round(($(globalThis).height() - piju_header_height - piju_footer_height) / piju_row_height_with_padding)
    const showSubsetOf = (VIEW_STYLE === "albums" ? genre_fetch_results['albums'] : genre_fetch_results['artists'])
    const showCallback = (collection => (VIEW_STYLE === "albums") ? showAlbums(collection) : showArtists(collection))
    if (showSubsetOf.length <= nrToShow) {
        showCallback(showSubsetOf)
    } else {
        let indexes = []
        while (indexes.length < nrToShow) {
            const random = Math.floor(Math.random() * showSubsetOf.length)
            if (!indexes.includes(random)) {
                indexes.push(random)
            }
        }
        indexes.sort(function(a, b){return a - b})
        let toShow = []
        for (let index of indexes) {
            toShow.push(showSubsetOf[index])
        }
        showCallback(toShow)
    }
}
