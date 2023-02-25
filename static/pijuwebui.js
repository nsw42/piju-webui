// TODO: Remove debugging?
if (server == "") {
    alert("Server variable uninitalized");
}

// Contants
State_Unknown = -1;
State_Stopped = 0;
State_Playing = 1;
State_Paused = 2;

// Globals
current_state = State_Stopped;
current_track_id = null;
current_mode_remote_control_str = Cookies.get('mode');
current_mode_remote_control = (current_mode_remote_control_str == 'remote');
local_player = null;
local_track_id = null;

setInterval(function() {
    if (!current_mode_remote_control) {
        return;
    }
    // update nowplaying
    $.ajax({
        url: server,
        success: function(result) {
            if (!current_mode_remote_control) {
                // The mode may have changed while we were waiting for the response.
                // Seems like an edge case, but I saw it during testing.
                return;
            }
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

                new_state = (result['PlayerStatus'] == "paused") ? State_Paused : State_Playing;

                new_track_id = id_from_link(current_track['link']);
            } else {
                new_state = State_Stopped;
                new_track_id = null;
            }

            if (new_state != current_state) {
                if (new_state == State_Stopped) {
                    $("#footer_nothing_playing").removeClass("d-none");
                    $("#footer_playing").addClass("d-none");
                } else {
                    $("#footer_nothing_playing").addClass("d-none");
                    $("#footer_playing").removeClass("d-none");

                    if (new_state == State_Paused) {
                        $("#now_playing_pause").addClass("d-none");
                        $("#now_playing_resume").removeClass("d-none");
                    } else {
                        $("#now_playing_pause").removeClass("d-none");
                        $("#now_playing_resume").addClass("d-none");
                    }
                }

                current_state = new_state;
            }

            if (new_track_id != current_track_id) {
                $("#track_"+current_track_id).removeClass("active-track");
                current_track_id = new_track_id;
                $("#track_"+current_track_id).addClass("active-track");
            }
        }
    });
}, 1000);

function getCSSVariable(varName) {
    // Credit to https://levelup.gitconnected.com/stop-duplicating-constants-between-js-and-css-40efd253a945
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName);
}

function id_from_link(link) {
    const tmp = link.split('/');
    return tmp[tmp.length - 1];
}

function play_album(album_id, track_id) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_album/" + album_id + "/" + track_id, true);
        xhttp.send();
    } else {
        local_play(track_id);
    }
}

function play_playlist(playlist_id, track_id) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_playlist/" + playlist_id + "/" + track_id, true);
        xhttp.send();
    } else {
        local_play(track_id);
    }
}

function local_play(track_id) {
    local_player = new Howl({
        src: [server + '/mp3/' + track_id],
        autoplay: true,
        format: ["mp3"],
        html5: false,  // resume doesn't work as expected with html5: true
                       // presumably due to a limitation of the flask server
        onend: function() {
            $('#track_'+track_id).removeClass('active-track');
            $('#local-pause').addClass('d-none');
            $('#local-resume').addClass('d-none');
            current_track_id = local_track_id = null;
        },
    });
    $('#local-pause').removeClass('d-none');
    local_track_id = current_track_id = track_id;
    $("#track_"+current_track_id).addClass('active-track');
}

function local_pause(resumable) {
    if (local_player != null) {
        local_player.pause();
        $('#local-pause').addClass('d-none');
        if (resumable == true || resumable == null) {
            $('#local-resume').removeClass('d-none');
        }
    }
}

function local_resume() {
    if (local_player != null) {
        local_player.play();
        $('#local-pause').removeClass('d-none');
        $('#local-resume').addClass('d-none');
    }
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

function togglemode() {
    current_mode_remote_control = !current_mode_remote_control;
    Cookies.set('mode', current_mode_remote_control ? 'remote' : 'local');
    $('#mode-indicator-remote').toggleClass('d-none');
    $('#mode-indicator-local').toggleClass('d-none');

    if (current_track_id != null) {
        $("#track_"+current_track_id).removeClass('active-track');
    }

    if (current_mode_remote_control) {
        local_pause(false);
        current_state = State_Unknown;  // Ensure display updates when the timer next fires
        current_track_id = null;  // ditto
        $('#footer_nothing_playing').removeClass('d-none');
        $('#footer_playing').removeClass('d-none');
        $('#footer-local-playback').addClass('d-none');
    } else {
        current_track_id = local_track_id;
        if (current_track_id != null) {
            $("#track_"+current_track_id).addClass('active-track');
            local_resume();
        }
        $('#footer_nothing_playing').addClass('d-none');
        $('#footer_playing').addClass('d-none');
        $('#footer-local-playback').removeClass('d-none');
    }
}
