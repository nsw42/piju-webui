// TODO: Remove debugging?
if (server == "") {
    alert("Server variable uninitalized");
}

current_track_id = null;

setInterval(function() {
    // update nowplaying
    $.ajax({
        url: server,
        success: function(result) {
            result = JSON.parse(result);
            current_track = result['CurrentTrack'];
            if (current_track && Object.keys(current_track).length > 0) {
                album_id = id_from_link(current_track['album']);
                if (album_id != "") {
                    album_link = "/albums/" + album_id;
                    $("#now_playing_album_link").attr('href', album_link);
                }
                artwork_link = current_track['artwork'];
                if (artwork_link) {
                    $("#now_playing_artwork_padding").addClass("d-none");
                    $("#now_playing_artwork").removeClass("d-none").attr('src', server + artwork_link);
                } else {
                    $("#now_playing_artwork_padding").removeClass("d-none");
                    $("#now_playing_artwork").addClass("d-none");
                }
                $("#now_playing_artist").text(current_track['artist']);
                $("#now_playing_track").text(current_track['title']);

                if (result['PlayerStatus'] == "paused") {
                    $("#now_playing_pause").addClass("d-none");
                    $("#now_playing_resume").removeClass("d-none");
                } else {
                    $("#now_playing_pause").removeClass("d-none");
                    $("#now_playing_resume").addClass("d-none");
                }
                new_track_id = id_from_link(current_track['link']);
                $("#now_playing_resume").removeClass("disabled");
            } else {
                $("#now_playing_artwork_padding").removeClass("d-none");
                $("#now_playing_artwork").addClass("d-none");
                $("#now_playing_artist").text("");
                $("#now_playing_track").text("<no track>");
                $("#now_playing_pause").addClass("d-none");
                $("#now_playing_resume").removeClass("d-none");
                $("#now_playing_resume").addClass("disabled");
                new_track_id = null;
            }
            if (new_track_id != current_track_id) {
                $("#track_"+current_track_id).removeClass("active-track");
                current_track_id = new_track_id;
                $("#track_"+current_track_id).addClass("active-track");
            }
        }
    });
}, 1000);

function id_from_link(link) {
    const tmp = link.split('/');
    return tmp[tmp.length - 1];
}

function play(album_id, track_id) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "/play/" + album_id + "/" + track_id, true);
    xhttp.send();
}

function send_pause() {
    $.ajax({
        url: server + "/player/pause",
        method: "POST"
    });
}

function send_resume() {
    $.ajax({
        url: server + "/player/resume",
        method: "POST"
    });
}
