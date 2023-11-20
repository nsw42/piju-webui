$("#searchinput").on('input', triggerSearch);

function triggerSearch() {
    if (active_search != null) {
        active_search.abort();
    }
    let searchstring = $("#searchinput").val();
    if (searchstring === "") {
        hide_album_results();
        hide_artist_results();
        hide_track_results();
        $("#searchspinner").addClass("d-none");
        $('#no-search-results').addClass("d-none");
    } else {
        $("#searchspinner").removeClass("d-none");
        start_search(searchstring, 0);
    }
};
active_search = null;

total_search_results = 0;
function start_search(searchstring, search_state) {
    let search_args = "";
    search_args += "artists=" + (search_state == 0 ? "true" : "false");
    search_args += "&albums=" + (search_state == 1 ? "true" : "false");
    search_args += "&tracks=" + (search_state == 2 ? "true" : "false");

    console.log("Searching for " + searchstring + " (args: " + search_args + ")");

    let callback;
    switch (search_state) {
        case 0:
            total_search_results = 0;
            $("#no-search-results").addClass("d-none");
            callback = artist_result_callback;
            break;
        case 1:
            callback = album_result_callback;
            break;
        case 2:
            callback = track_result_callback;
            break;
    }

    active_search = $.ajax({
        "url": server + "/search/" + searchstring + "?" + search_args,
        "success": function(data) {
            callback(searchstring, data);
        }
    });
}

function artist_result_callback(searchstring, data) {
    // console.log("artist_result_callback: " + searchstring + " -> " + data);
    data = $.parseJSON(data);

    artists = data['artists'];
    console.log("  " + artists.length + " artists");
    total_search_results += artists.length;
    if (0 == artists.length) {
        hide_artist_results();
    } else {
        showArtistResults(artists);
    }

    start_search(searchstring, 1);
}

function album_result_callback(searchstring, data) {
    // console.log("album_result_callback: " + data);
    data = $.parseJSON(data);

    albums = data['albums'];
    console.log("  " + albums.length + " albums");
    total_search_results += albums.length;
    if (0 == albums.length) {
        hide_album_results();
    } else {
        showAlbumResults(albums);
    }

    start_search(searchstring, 2);
}

function track_result_callback(searchstring, data) {
    // console.log("track_result_callback: " + data);
    data = $.parseJSON(data);

    tracks = data['tracks'];
    console.log("  " + tracks.length + " tracks");
    total_search_results += tracks.length;
    if (0 == tracks.length) {
        hide_track_results();
    } else {
        showTrackResults(tracks);
    }

    active_search = null;
    $("#searchspinner").addClass("d-none");

    if (total_search_results == 0) {
        $("#no-search-results").removeClass("d-none");
    }
}

function hide_album_results() {
    $("#album_results").addClass("d-none");
}

function hide_artist_results() {
    $("#artist_results").addClass("d-none");
}

function hide_track_results() {
    $("#track_results").addClass("d-none");
}

function showAlbumResults(albums) {
    $("#album_results").removeClass("d-none");
    $("#nr_album_results").text(albums.length);
    $("#album_results_inner").empty();
    for (const [album_i, album] of albums.entries()) {
        let template = document.querySelector('#one_album_search_result');
        let tr = template.content.cloneNode(true).children[0];

        let trId = `album-result-${album_i}`;
        tr.setAttribute('id', trId);

        let artworkLink = album['artwork']['link'];
        if (artworkLink == null) {
            tr.querySelector("#artwork_link_present").remove();
        } else {
            tr.querySelector("#artwork_link_missing").remove();
            tr.querySelector("#artwork_link_present").setAttribute("src", server + "/" + artworkLink);
        }

        let artist = album['artist'];
        if (artist == null || artist == "") {
            if (album['iscompilation']) {
                artist = "Various Artists";
            } else {
                artist = "Unknown Artist";
            }
        }

        let title = album['title'];
        if (title == null || title == "") {
            title = "Unknown Album";  // ?!
        }
        let albumArtistTitleNode = tr.querySelector("#album_artist_title");
        albumArtistTitleNode.setAttribute("href", album['link']);
        albumArtistTitleNode.innerHTML = artist + ": " + title;

        let albumYear = album['releasedate'];
        if (albumYear != null) {
            albumArtistTitleNode.after(" (" + albumYear + ")");
        }

        for (let td of tr.cells) {
            td.addEventListener('click', redirectMouseEventClosure(albumArtistTitleNode))
        }

        $("#album_results_inner").append(tr);
    }
}

function showArtistResults(artists) {
    $("#artist_results").removeClass("d-none");
    $("#nr_artist_results").text(artists.length);
    $("#artist_results_inner").empty();
    for (artist of artists) {
        let template = document.querySelector('#one_artist_search_result');
        let tr = template.content.cloneNode(true).children[0];

        let artistNameNode = tr.querySelector("#artist_name");
        artistNameNode.setAttribute("href", artist['link']);
        artistNameNode.innerHTML = artist['name'];

        for (let td of tr.cells) {
            td.addEventListener("click", redirectMouseEventClosure(artistNameNode));
        }

        $("#artist_results_inner").append(tr);
    }
}

function showTrackResults(tracks) {
    $("#track_results").removeClass("d-none");
    $("#nr_track_results").text(tracks.length);
    $("#track_results_inner").empty();
    for (track of tracks) {
        let template = document.querySelector('#one_track_search_result');
        let tr = template.content.cloneNode(true).children[0];

        let trackId = idFromLink(track['link']);

        // fix up artwork
        let artworkLink = track['artwork'];
        if (artworkLink == null) {
            tr.querySelector("#artwork_link_present").remove();
        } else {
            tr.querySelector("#artwork_link_missing").remove();
            tr.querySelector("#artwork_link_present").setAttribute("src", server + "/" + artworkLink);
        }

        // populate artist and track title
        let artist = track['artist'];
        if (artist == null || artist == "") {
            artist = "Unknown Artist";
        }

        let title = track['title'];
        if (title == null || title == "")  {
            title = "Unknown Track";  // ?!
        }
        let trackArtistTitleNode = tr.querySelector("#track_artist_title");
        let trackLink = track['album'] + '?highlight=' + trackId;
        trackArtistTitleNode.setAttribute('href', trackLink);
        trackArtistTitleNode.innerHTML = artist + ": " + title;

        // fix up the onclick functionality
        for (td of [tr.cells[0], tr.cells[1]]) {
            td.addEventListener('click', redirectMouseEventClosure(trackArtistTitleNode));
        }
        tr.querySelector('#add-to-queue-button').setAttribute('onclick', `addTrackToQueue(${trackId})`);

        $("#track_results_inner").append(tr);
    }
}

function toggleArtistCollapse() {
    $('#artist_results_inner').collapse('toggle');
    $('#artist_result_expander').toggleClass('la-rotate-180');
}

function toggleAlbumCollapse() {
    $('#album_results_inner').collapse('toggle');
    $('#album_result_expander').toggleClass('la-rotate-180');
}

function toggleTrackCollapse() {
    $('#track_results_inner').collapse('toggle');
    $('#track_result_expander').toggleClass('la-rotate-180');
}

$(function() {
    $("#searchspinner").addClass("d-none");
    $('#artist_results_inner').collapse();
    $('#album_results_inner').collapse();
    $('#track_results_inner').collapse();

    setTimeout(triggerSearch, 50); // TODO: Is 50ms long enough for iPhone etc?
});
