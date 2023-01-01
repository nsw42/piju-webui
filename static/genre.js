$(function() {
    var url = window.location.href;
    var slash = url.lastIndexOf('/');
    var leaf = url.substring(slash + 1);
    startAjaxRequest(leaf, 30000);
});

var genre_fetch_results = null;

function startAjaxRequest(leaf, timeout) {
    var now = new Date();
    console.log(`${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} starting ajax request (timeout=${timeout})`);
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


function show_albums(albums) {
    var genre_content_node = document.getElementById("genre-content");
    var selected_anchors = {};
    for (var album of albums) {
        var album_anchor = album['anchor'];
        if (selected_anchors[album_anchor] == null) {
            anchor = document.getElementById("anchor-template").content.cloneNode(true);
            anchor.querySelector("a").setAttribute("name", album_anchor);
            genre_content_node.appendChild(anchor);
            selected_anchors[album_anchor] = true;
        }

        var album_row = document.getElementById("album-template").content.cloneNode(true);
        if (album['artwork_link'] != null) {
            // We have artwork: remove the spacer
            album_row.querySelector("#artwork-spacer").remove();
            album_row.querySelector("#album-artwork").setAttribute("src", server + album['artwork_link']);
        } else {
            // No artwork: remove the img node
            album_row.querySelector("#album-artwork").remove();
        }
        var album_href = album_row.querySelector("#album-href");
        album_href.setAttribute("href", `/albums/${album['id']}`);
        album_href.innerText = (album['artist'] != null ? album['artist'] : "Unknown Artist") + ": " + (album['title'] != null ? album['title'] : "Unknown Album");
        if (album['year'] != null) {
            var album_year_node = album_row.querySelector("#album-year");
            album_year_node.innerText = " (" + album['year'] + ")";
        }
        genre_content_node.appendChild(album_row);
    }
    genre_content_node.classList.remove('d-none');

    var letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var anchor_content_node = document.getElementById("anchor-content");
    var anchors_contents ='';
    for (var letter of letters) {
        var anchor = (letter == '#' ? 'num' : letter);
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


function show_genre_subset() {
    // TODO: This contains the sizing constants from the css
    // 116 = 100 (row height) + 16 (row padding)
    let nr_albums_to_show = Math.round(($(window).height() - 96 - 128) / 116);
    let all_albums = genre_fetch_results['albums'];
    if (all_albums.length <= nr_albums_to_show) {
        show_albums(all_albums);
    } else {
        var indexes = [];
        while (indexes.length < nr_albums_to_show) {
            const random = Math.floor(Math.random() * all_albums.length);
            if (indexes.indexOf(random) !== -1) {
                continue;
            }
            indexes.push(random);
        }
        indexes.sort(function(a, b){return a - b});
        var to_show = [];
        for (var index of indexes) {
            to_show.push(all_albums[index]);
        }
        show_albums(to_show);
    }
}
