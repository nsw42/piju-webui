$("#searchinput").on('input', function(e) {
    if (active_search != null) {
        active_search.abort();
    }
    let searchstring = $("#searchinput").val();
    if (searchstring === "") {
        hide_album_results();
        hide_artist_results();
        hide_track_results();
        $("#searchspinner").addClass("d-none");
    } else {
        $("#searchspinner").removeClass("d-none");
        start_search(searchstring, 0);
    }
});
active_search = null;

function start_search(searchstring, search_state) {
    let search_args = "";
    search_args += "artists=" + (search_state == 0 ? "true" : "false");
    search_args += "&albums=" + (search_state == 1 ? "true" : "false");
    search_args += "&tracks=" + (search_state == 2 ? "true" : "false");

    console.log("Searching for " + searchstring + " (args: " + search_args + ")");

    let callback;
    switch (search_state) {
        case 0:
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
    if (0 == artists.length) {
        hide_artist_results();
    } else {
        show_artist_results(artists);
    }

    start_search(searchstring, 1);
}

function album_result_callback(searchstring, data) {
    // console.log("album_result_callback: " + data);
    data = $.parseJSON(data);

    albums = data['albums'];
    console.log("  " + albums.length + " albums");
    if (0 == albums.length) {
        hide_album_results();
    } else {
        show_album_results(albums);
    }

    start_search(searchstring, 2);
}

function track_result_callback(searchstring, data) {
    // console.log("track_result_callback: " + data);
    data = $.parseJSON(data);

    tracks = data['tracks'];
    console.log("  " + tracks.length + " tracks");
    if (0 == tracks.length) {
        hide_track_results();
    } else {
        show_track_results(tracks);
    }

    active_search = null;
    $("#searchspinner").addClass("d-none");
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

function show_album_results(albums) {
    $("#album_results").removeClass("d-none");
    $("#nr_album_results").text(albums.length);
    $("#album_results_inner").empty();
    for (album of albums) {
        let template = document.querySelector('#one_album_search_result');
        div = template.content.cloneNode(true);

        artwork_link = album['artwork']['link'];
        if (artwork_link == null) {
            div.querySelector("#artwork_link_present").remove();
        } else {
            div.querySelector("#artwork_link_missing").remove();
            div.querySelector("#artwork_link_present").setAttribute("src", server + "/" + artwork_link);
        }

        artist = album['artist'];
        if (artist == null || artist == "") {
            artist = "Unknown Artist";
        }

        title = album['title'];
        if (title == null || title == "") {
            title = "Unknown Album";  // ?!
        }
        album_artist_title = div.querySelector("#album_artist_title");
        album_artist_title.setAttribute("href", album['link']);
        album_artist_title.innerHTML = artist + ": " + title;

        album_year = album['releasedate'];
        if (album_year != null) {
            album_artist_title.after(" (" + album_year + ")");
        }

        $("#album_results_inner").append(div);
    }
}

function show_artist_results(artists) {
    $("#artist_results").removeClass("d-none");
    $("#nr_artist_results").text(artists.length);
    $("#artist_results_inner").empty();
    for (artist of artists) {
        let template = document.querySelector('#one_artist_search_result');
        div = template.content.cloneNode(true);

        artist_name = div.querySelector("#artist_name");
        artist_name.setAttribute("href", artist['link']);
        artist_name.innerHTML = artist['name'];

        $("#artist_results_inner").append(div);
    }
}

function show_track_results(tracks) {
    $("#track_results").removeClass("d-none");
    $("#nr_track_results").text(tracks.length);
    $("#track_results_inner").empty();
    for (track of tracks) {
        let template = document.querySelector('#one_track_search_result');
        div = template.content.cloneNode(true);

        artwork_link = track['artwork'];
        if (artwork_link == null) {
            div.querySelector("#artwork_link_present").remove();
        } else {
            div.querySelector("#artwork_link_missing").remove();
            div.querySelector("#artwork_link_present").setAttribute("src", server + "/" + artwork_link);
        }

        artist = track['artist'];
        if (artist == null || artist == "") {
            artist = "Unknown Artist";
        }

        title = track['title'];
        if (title == null || title == "")  {
            title = "Unknown Track";  // ?!
        }
        track_artist_title = div.querySelector("#track_artist_title");
        track_artist_title.setAttribute('href', track['album']);
        track_artist_title.innerHTML = artist + ": " + title;

        $("#track_results_inner").append(div);
    }
}

function toggleArtistCollapse() {
    $('#artist_results_inner').collapse('toggle');
    $('#artist_result_expander').toggleClass('fa-rotate-180');
}

function toggleAlbumCollapse() {
    $('#album_results_inner').collapse('toggle');
    $('#album_result_expander').toggleClass('fa-rotate-180');
}

function toggleTrackCollapse() {
    $('#track_results_inner').collapse('toggle');
    $('#track_result_expander').toggleClass('fa-rotate-180');
}

$(function() {
    hide_album_results();
    hide_artist_results();
    hide_track_results();
    $("#searchspinner").addClass("d-none");
    $('#artist_results_inner').collapse();
    $('#album_results_inner').collapse();
    $('#track_results_inner').collapse();
});
