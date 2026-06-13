$('#search-input').on('input', triggerSearch)
$('#search-clear').on('click', clearSearch)

let activeSearch = null;
let totalSearchResults = 0;

function triggerSearch() {
    activeSearch?.abort()
    const searchstring = $("#search-input").val();
    if (searchstring === "") {
        hideAllResults()
        $("#search-spinner").addClass("d-none");
        $('#no-search-results').addClass("d-none");
    } else {
        $("#search-spinner").removeClass("d-none");
        start_search(searchstring, 0);
    }
};

function clearSearch() {
    activeSearch?.abort()
    $('#search-input').val('').focus()
    hideAllResults()
    $("#search-spinner").addClass("d-none");
    $('#no-search-results').addClass("d-none");
}

function start_search(searchstring, search_state) {
    let search_args = "";
    search_args += "artists=" + (search_state == 0 ? "true" : "false");
    search_args += "&albums=" + (search_state == 1 ? "true" : "false");
    search_args += "&tracks=" + (search_state == 2 ? "true" : "false");

    console.log("Searching for " + searchstring + " (args: " + search_args + ")");

    let callback;
    switch (search_state) {
        case 0:
            totalSearchResults = 0;
            $("#no-search-results").addClass("d-none");
            callback = artistResultCallback;
            break;
        case 1:
            callback = albumResultCallback;
            break;
        case 2:
            callback = trackResultCallback;
            break;
    }

    activeSearch = $.ajax({
        url: server + "/search/" + searchstring + "?" + search_args,
        success: function(data) {
            callback(searchstring, data);
        }
    });
}

function artistResultCallback(searchstring, data) {
    data = $.parseJSON(data);

    const artists = data['artists'];
    console.log("  " + artists.length + " artists");
    totalSearchResults += artists.length;
    if (0 == artists.length) {
        hideArtistResults();
    } else {
        showArtistResults(artists);
    }

    start_search(searchstring, 1);
}

function albumResultCallback(searchstring, data) {
    data = $.parseJSON(data);

    const albums = data['albums'];
    console.log("  " + albums.length + " albums");
    totalSearchResults += albums.length;
    if (0 == albums.length) {
        hideAlbumResults();
    } else {
        showAlbumResults(albums);
    }

    start_search(searchstring, 2);
}

function trackResultCallback(searchstring, data) {
    data = $.parseJSON(data);

    const tracks = data['tracks'];
    console.log("  " + tracks.length + " tracks");
    totalSearchResults += tracks.length;
    if (0 == tracks.length) {
        hideTrackResults();
    } else {
        showTrackResults(tracks);
    }

    activeSearch = null;
    $("#search-spinner").addClass("d-none");

    if (totalSearchResults == 0) {
        $("#no-search-results").removeClass("d-none");
    }
}

function hideAllResults() {
    hideAlbumResults()
    hideArtistResults()
    hideTrackResults()
}

function hideAlbumResults() {
    $("#album_results").addClass("d-none");
}

function hideArtistResults() {
    $("#artist_results").addClass("d-none");
}

function hideTrackResults() {
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

        showAlbumResultsArtwork(tr, album['artwork']['link'])
        showAlbumResultsArtistAndTitle(tr, album['link'], album['artist'], album['title'], album['iscompilation'], album['releasedate'])

        $("#album_results_inner").append(tr);
    }
}

function showAlbumResultsArtwork(tr, artworkLink) {
    if (artworkLink == null) {
        tr.querySelector("#artwork_link_present").remove();
    } else {
        tr.querySelector("#artwork_link_missing").remove();
        tr.querySelector("#artwork_link_present").setAttribute("src", server + "/" + artworkLink);
    }
}

function showAlbumResultsArtistAndTitle(tr, albumLink, artist, title, isCompilation, albumYear) {
    if (artist == null || artist == "") {
        if (isCompilation) {
            artist = "Various Artists";
        } else {
            artist = "Unknown Artist";
        }
    }
    if (title == null || title == "") {
        title = "Unknown Album";  // ?!
    }
    let albumArtistTitleNode = tr.querySelector("#album_artist_title");
    albumArtistTitleNode.setAttribute("href", albumLink);
    albumArtistTitleNode.innerHTML = artist + ": " + title;
    if (albumYear != null) {
        albumArtistTitleNode.after(" (" + albumYear + ")");
    }
    // fix up the onclick functionality
    for (const td of [tr.cells[0], tr.cells[1]]) {
        td.addEventListener('click', redirectMouseEventClosure(albumArtistTitleNode))
    }
    const albumId = idFromLink(albumLink)
    tr.querySelector('#add-to-queue-button').setAttribute('onclick', `addAlbumToQueue(${albumId})`)
}

function showArtistResults(artists) {
    $("#artist_results").removeClass("d-none");
    $("#nr_artist_results").text(artists.length);
    $("#artist_results_inner").empty();
    for (const artist of artists) {
        const template = document.querySelector('#one_artist_search_result');
        const tr = template.content.cloneNode(true).children[0];

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
    for (const track of tracks) {
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
        for (const td of [tr.cells[0], tr.cells[1]]) {
            td.addEventListener('click', redirectMouseEventClosure(trackArtistTitleNode));
        }
        tr.querySelector('#add-to-queue-button').setAttribute('onclick', `addTrackToQueue(${trackId})`);

        $("#track_results_inner").append(tr);
    }
    addQueueFeedbackHandlers();
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
    $("#search-spinner").addClass("d-none");
    $('#artist_results_inner').collapse();
    $('#album_results_inner').collapse();
    $('#track_results_inner').collapse();

    setTimeout(triggerSearch, 50);
});
