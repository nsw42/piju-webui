let lazyLoadImages = false;
let imageObserver;

$(function() {
    if ('IntersectionObserver' in window) {
        lazyLoadImages = true;
        imageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.getAttribute('data-lazy-load-image-src')
                    imageObserver.unobserve(image)
                }
            })
        })
    }
    let url = window.location.href;
    let slash = url.lastIndexOf('/');
    let leaf = url.substring(slash + 1);
    startAjaxRequest(leaf, 30000);
});

let genre_fetch_results = null;

function startAjaxRequest(leaf, timeout) {
    const now = new Date();
    console.log(`${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} starting ajax request /genre_contents/${leaf}?timeout=${timeout}`);
    $.ajax({
        url: "/genre_contents/" + leaf + '?timeout=' + timeout,
        success: function(result) {
            genre_fetch_results = JSON.parse(result);
            $('#loading-indicator-parent').hide();
            if ($('#random-toggle').prop('checked')) {
                show_genre_subset();
            } else {
                show_all_genre_contents();
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
            show_genre_subset();
        }
    } else {
        // Random has been switched off
        new_state = "false";
        if (genre_fetch_results !== null) {
            show_all_genre_contents();
        }
    }
    // Set a cookie so the toggle is set correctly on the next page load
    document.cookie = "random=" + new_state;
})


function showAlbumsCreateAlbumRow(album) {
    const album_row = document.getElementById("album-template").content.cloneNode(true);
    const spacerElement = album_row.querySelector("#artwork-spacer")
    const imgElement = album_row.querySelector("#album-artwork")
    if (album['artwork_link'] != null) {
        spacerElement.remove()  // We have artwork, so we don't need the spacer
        if (lazyLoadImages) {
            // Store where to find the image when it scrolls into view
            imgElement.setAttribute('data-lazy-load-image-src', server + album['artwork_link'])
            imageObserver.observe(imgElement)
        } else {
            // Lazy loading not supported - set the image source directly
            imgElement.setAttribute('src', server + album['artwork_link'])
        }
    } else {
        // No artwork: remove the img node
        imgElement.remove();
    }
    const album_href = album_row.querySelector("#album-href");
    album_href.setAttribute("href", `/albums/${album['id']}`);
    album_href.innerText = (album['artist'] != null ? album['artist'] : "Unknown Artist") + ": " + (album['title'] != null ? album['title'] : "Unknown Album");
    if (album['year'] != null) {
        const album_year_node = album_row.querySelector("#album-year");
        album_year_node.innerText = " (" + album['year'] + ")";
    }
    return album_row
}

function show_albums(albums) {
    let genre_content_node = document.getElementById("genre-content");
    while (genre_content_node.hasChildNodes()) {
        genre_content_node.removeChild(genre_content_node.firstChild);
    }
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


function show_all_genre_contents() {
    show_albums(genre_fetch_results['albums']);
}


const piju_header_height = parseInt(getCSSVariable("--header-height"));
const piju_footer_height = parseInt(getCSSVariable("--footer-height"));
const piju_album_row_height = parseInt(getCSSVariable("--album-row-height"));
const piju_row_height_with_padding = piju_album_row_height + 16; // 16 because of 'py2' on the top div of album-template

function show_genre_subset() {
    let nr_albums_to_show = Math.round(($(window).height() - piju_header_height - piju_footer_height) / piju_row_height_with_padding);
    let all_albums = genre_fetch_results['albums'];
    if (all_albums.length <= nr_albums_to_show) {
        show_albums(all_albums);
    } else {
        let indexes = [];
        while (indexes.length < nr_albums_to_show) {
            const random = Math.floor(Math.random() * all_albums.length);
            if (indexes.indexOf(random) !== -1) {
                continue;
            }
            indexes.push(random);
        }
        indexes.sort(function(a, b){return a - b});
        let to_show = [];
        for (let index of indexes) {
            to_show.push(all_albums[index]);
        }
        show_albums(to_show);
    }
}
