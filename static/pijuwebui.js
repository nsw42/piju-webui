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
current_mode_remote_control = (current_mode_remote_control_str === undefined || current_mode_remote_control_str == 'remote');
local_players = null;
local_track_index = null;
// playlist_track_ids is also declared in script blocks in the html pages that support local playback

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

function play_album(album_id, track_id, playlist_index) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_album/" + album_id + "/" + track_id, true);
        xhttp.send();
    } else {
        local_play(playlist_index);
    }
}

function play_playlist(playlist_id, track_id, playlist_index) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_playlist/" + playlist_id + "/" + track_id, true);
        xhttp.send();
    } else {
        local_play(playlist_index);
    }
}

function setupLocalPlayers() {
    local_players = playlist_track_ids.map(track_id => new Howl({
        src: [server + '/mp3/' + track_id],
        preload: false,
        autoplay: false,
        format: ["mp3"],
        html5: true,
        onplayerror: function(soundId, errorCode) {
            console.log("howlerjs reported error code " + errorCode);
        },
        onend: function() {
            $('#track_'+track_id).removeClass('active-track');
            if (local_track_index + 1 < playlist_track_ids.length) {
                local_play(local_track_index + 1);
            } else {
                $('#local-previous').addClass('d-none');
                $('#local-pause').addClass('d-none');
                $('#local-resume').addClass('d-none');
                $('#local-next').addClass('d-none');
                current_track_id = local_track_index = null;
            }
        },
        onpause: function() {
            showPlaybackPaused(true);
        },
        onplay: function() {
            showPlaybackActive();
        },
    }));
}

function local_play(playlist_index) {
    if (local_players === null) {
        setupLocalPlayers();  // Creating these here means that we create them in response to a user interaction event
    }
    let setMediaHandlers = true;
    if (local_track_index != null) {
        $("#track_"+current_track_id).removeClass('active-track');
        local_players[local_track_index].stop();
        setMediaHandlers = false;  // Setting the same handlers a second time bizarrely seems to stop the handlers being called
    }
    navigator.mediaSession.setPositionState({duration: 1000000, position: 0}); // Simulate an incredibly long track so 'fast forward' will always be invoked, and we can map it to 'next track'
    local_track_index = playlist_index;
    current_track_id = playlist_track_ids[playlist_index];
    $("#track_"+current_track_id).addClass('active-track');
    local_players[playlist_index].play();
    showPlaybackActive();
    if (setMediaHandlers) {
        for (const action of ['seekbackward', 'previoustrack']) {
            navigator.mediaSession.setActionHandler(action, () => { localPrevious(); } );
        }
        navigator.mediaSession.setActionHandler('pause', mediaPause);
        navigator.mediaSession.setActionHandler('play', mediaResume);
        for (const action of ['seekforward', 'nexttrack']) {
            navigator.mediaSession.setActionHandler(action, () => { localNext(); } );
        }
    }
    $('#local-previous').prop('disabled', (local_track_index == 0));
    $('#local-next').prop('disabled', (local_track_index + 1 >= playlist_track_ids.length));
}

function mediaPause() {
    localPause(true);
}

function mediaResume() {
    localResume();
}

function localPrevious() {
    if (local_track_index > 0) {
        localPause();  // Avoids synchronisation problems on multiple skips
        local_play(local_track_index - 1);
    }
}

function localNext() {
    if (local_track_index + 1 < playlist_track_ids.length) {
        localPause();  // Avoids synchronisation problems on multiple skips
        local_play(local_track_index + 1);
    }
}

function localPause(resumable) {
    if (local_track_index != null) {
        local_players[local_track_index].pause();
        showPlaybackPaused(resumable);
    }
}

function localResume() {
    if (local_track_index != null) {
        local_players[local_track_index].play();
    }
}

function showPlaybackPaused(resumable) {
    $('#local-pause').addClass('d-none');
    if (resumable) {
        $('#local-resume').removeClass('d-none');
        navigator.mediaSession.playbackState = "paused";
    } else {
        navigator.mediaSession.playbackState = "none";
    }
}

function showPlaybackActive() {
    navigator.mediaSession.playbackState = "playing";
    $('#local-previous').removeClass('d-none');
    $('#local-pause').removeClass('d-none');
    $('#local-resume').addClass('d-none');
    $('#local-next').removeClass('d-none');
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
        localPause(false);
        current_state = State_Unknown;  // Ensure display updates when the timer next fires
        current_track_id = null;  // ditto
        $('#footer_nothing_playing').removeClass('d-none');
        $('#footer_playing').removeClass('d-none');
        $('#footer-local-playback').addClass('d-none');
    } else {
        if (local_track_index != null) {
            current_track_id = playlist_track_ids[local_track_index];
            $("#track_"+current_track_id).addClass('active-track');
            localResume();
        }
        $('#footer_nothing_playing').addClass('d-none');
        $('#footer_playing').addClass('d-none');
        $('#footer-local-playback').removeClass('d-none');
    }
}
