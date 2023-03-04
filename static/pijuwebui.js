// TODO: Remove debugging?
if (server == "") {
    alert("Server variable uninitalized");
}

// Contants
const STATE_UNKNOWN = -1;
const STATE_STOPPED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

// Globals
current_state = STATE_STOPPED;
current_track_id = null;
current_mode_remote_control_str = Cookies.get('mode');
current_mode_remote_control = (current_mode_remote_control_str === undefined || current_mode_remote_control_str == 'remote');
localPlayers = null;
localTrackIndex = null;
fetching = false;
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
                album_id = idFromLink(current_track['album']);
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

                new_state = (result['PlayerStatus'] == "paused") ? STATE_PAUSED : STATE_PLAYING;

                new_track_id = idFromLink(current_track['link']);
            } else {
                new_state = STATE_STOPPED;
                new_track_id = null;
            }

            if (new_state != current_state) {
                if (new_state == STATE_STOPPED) {
                    $("#footer_nothing_playing").removeClass("d-none");
                    $("#footer_playing").addClass("d-none");
                } else {
                    $("#footer_nothing_playing").addClass("d-none");
                    $("#footer_playing").removeClass("d-none");

                    if (new_state == STATE_PAUSED) {
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

function idFromLink(link) {
    const tmp = link.split('/');
    return tmp[tmp.length - 1];
}

function play_album(album_id, track_id, playlistIndex) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_album/" + album_id + "/" + track_id, true);
        xhttp.send();
    } else {
        localPlay(playlistIndex);
    }
}

function play_playlist(playlist_id, track_id, playlistIndex) {
    if (current_mode_remote_control) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/play_playlist/" + playlist_id + "/" + track_id, true);
        xhttp.send();
    } else {
        localPlay(playlistIndex);
    }
}

function setupLocalPlayers() {
    localPlayers = playlist_track_ids.map(track_id => new Howl({
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
            if (localTrackIndex + 1 < playlist_track_ids.length) {
                localPlay(localTrackIndex + 1);
            } else {
                hideButtons(['#local-previous', '#local-pause', '#local-fetching', '#local-resume', '#local-next']);
                current_track_id = localTrackIndex = null;
            }
        },
        onpause: function() {
            if (!fetching) {
                showPlaybackPaused(true);
            }
        },
        onplay: function() {
            fetching = false;
            showPlaybackActive();
        },
    }));
}

function localPlay(playlistIndex) {
    if (localPlayers === null) {
        setupLocalPlayers();  // Creating these here means that we create them in response to a user interaction event
    }
    let setMediaHandlers = true;
    if (localTrackIndex != null) {
        $("#track_"+current_track_id).removeClass('active-track');
        localPlayers[localTrackIndex].stop();
        setMediaHandlers = false;  // Setting the same handlers a second time bizarrely seems to stop the handlers being called
    }
    navigator.mediaSession.setPositionState({duration: 1000000, position: 0}); // Simulate an incredibly long track so 'fast forward' will always be invoked, and we can map it to 'next track'
    localTrackIndex = playlistIndex;
    current_track_id = playlist_track_ids[playlistIndex];
    $("#track_"+current_track_id).addClass('active-track');
    localPlayers[playlistIndex].play();
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
    $('#local-previous').prop('disabled', (localTrackIndex == 0));
    $('#local-next').prop('disabled', (localTrackIndex + 1 >= playlist_track_ids.length));
    showPlaybackFetching();
    fetching = true;
}

function mediaPause() {
    localPause(true);
}

function mediaResume() {
    localResume();
}

function localPrevious() {
    if (localTrackIndex > 0) {
        localPause();  // Avoids synchronisation problems on multiple skips
        localPlay(localTrackIndex - 1);
    }
}

function localNext() {
    if (localTrackIndex + 1 < playlist_track_ids.length) {
        localPause();  // Avoids synchronisation problems on multiple skips
        localPlay(localTrackIndex + 1);
    }
}

function localPause(resumable) {
    if (localTrackIndex != null) {
        localPlayers[localTrackIndex].pause();
        showPlaybackPaused(resumable);
    }
}

function localResume() {
    if (localTrackIndex != null) {
        localPlayers[localTrackIndex].play();
    }
}

function hideButtons(allToHide) {
    for (const oneToHide of allToHide) {
        $(oneToHide).addClass('d-none');
    }
}

function showButtons(allToShow) {
    for (const oneToShow of allToShow) {
        $(oneToShow).removeClass('d-none');
    }
}

function showPlaybackFetching() {
    $('#local-fetching').removeClass('d-none');
    hideButtons(['#local-previous', '#local-pause', '#local-resume', '#local-next']);
}

function showPlaybackPaused(resumable) {
    hideButtons(['#local-fetching', '#local-pause']);
    if (resumable) {
        $('#local-resume').removeClass('d-none');
        navigator.mediaSession.playbackState = "paused";
    } else {
        navigator.mediaSession.playbackState = "none";
    }
}

function showPlaybackActive() {
    navigator.mediaSession.playbackState = "playing";
    hideButtons(['#local-fetching', '#local-resume']);
    showButtons(['#local-previous', '#local-pause', '#local-next']);
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
        current_state = STATE_UNKNOWN;  // Ensure display updates when the timer next fires
        current_track_id = null;  // ditto
        $('#footer_nothing_playing').removeClass('d-none');
        $('#footer_playing').removeClass('d-none');
        $('#footer-local-playback').addClass('d-none');
    } else {
        if (localTrackIndex != null) {
            current_track_id = playlist_track_ids[localTrackIndex];
            $("#track_"+current_track_id).addClass('active-track');
            localResume();
        }
        $('#footer_nothing_playing').addClass('d-none');
        $('#footer_playing').addClass('d-none');
        $('#footer-local-playback').removeClass('d-none');
    }
}
