// TODO: Remove debugging?
if (server == "") {
    alert("Server variable uninitalized");
}

// Contants
const STATE_UNKNOWN = -1;
const STATE_STOPPED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const currentModeRemoteControlAtStart = Cookies.get('mode');

// Globals
// Vars common to both local and remote mode
let currentTrackId = null;
let currentModeRemoteControl = (currentModeRemoteControlAtStart === undefined || currentModeRemoteControlAtStart == 'remote');
// Vars only relevant for remote control
let remoteCurrentState = STATE_STOPPED;
// Vars only releveant for local playback
let localPlayers = null;
let localTrackIndex = null;
let fetching = false;
// playlistTrackIds is also declared in script blocks in the html pages that support local playback

// An ontouchstart event listener is needed to allow visual feedback
// but we want to declare the handler as passive, if supported by the browser.
$(function() {
    document.addEventListener('touchstart', {}, false);
});

// Utility functions
function getCSSVariable(varName) {
    // Credit to https://levelup.gitconnected.com/stop-duplicating-constants-between-js-and-css-40efd253a945
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName);
}

function idFromLink(link) {
    if (link === undefined || link === null) {
        return '';
    } else {
        const tmp = link.split('/');
        return tmp[tmp.length - 1];
    }
}

function hideButtons(allToHide) {
    for (const oneToHide of allToHide) {
        $(oneToHide).addClass('d-none');
    }
}

function preventDoubleSubmit(event) {
    const elt = event.currentTarget
    elt.setAttribute('disabled', 'disabled');
    setTimeout(() => {elt.removeAttribute('disabled')}, 2000)
}

function showButtons(allToShow) {
    for (const oneToShow of allToShow) {
        $(oneToShow).removeClass('d-none');
    }
}

function redirectMouseEvent(event, targetAnchorNode) {
    console.log("Redirecting ", event, " to ", targetAnchorNode);
    event.preventDefault();
    event.stopPropagation();
    let newEvent = new MouseEvent(event.type, {
        bubbles: false,
        cancelable: true,
        composed: false,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
        region: event.region,
        detail: event.detail,
        view: event.view
    });
    targetAnchorNode.dispatchEvent(newEvent);
    return false;
}

function redirectMouseEventClosure(node) {
    const targetNode = node;
    return function(event) {
        return redirectMouseEvent(event, targetNode);
    }
}

// Remote control functions
setInterval(function() {
    if (!currentModeRemoteControl) {
        return;
    }
    // update nowplaying
    $.ajax({
        url: server,
        success: function(result) {
            const json = JSON.parse(result)
            showNowPlaying(json)
        },
    })
}, 1000)

function showNowPlaying(nowPlaying) {
    if (!currentModeRemoteControl) {
        // The mode may have changed while we were waiting for the response.
        // Seems like an edge case, but I saw it during testing.
        return;
    }
    let newState, newTrackId;
    if (nowPlaying['PlayerStatus'] == 'stopped') {
        newState = STATE_STOPPED;
        newTrackId = null;
    } else {
        const currentTrack = nowPlaying['CurrentTrack'];
        const tracklistSource = nowPlaying['CurrentTracklistUri'];
        if (tracklistSource === undefined) {
            // If we're streaming, disable the apparent clickability of the 'now playing' album link
            $('#now_playing_album_link').removeAttr('href');
        } else {
            $("#now_playing_album_link").attr('href', tracklistSource);
        }

        // Handle artwork
        let artworkLink = nowPlaying['CurrentArtwork'];
        if (artworkLink) {
            if (!artworkLink.startsWith('http')) {
                artworkLink = server + artworkLink;
            }
            $("#now_playing_artwork_padding").addClass("d-none");
            $("#now_playing_artwork").removeClass("d-none").attr('src', artworkLink);
        } else {
            $("#now_playing_artwork_padding").removeClass("d-none");
            $("#now_playing_artwork").addClass("d-none");
        }

        // Information about what is playing
        if (currentTrack === undefined) {
            $("#now_playing_artist").text(nowPlaying['CurrentStream']);
            $("#now_playing_track").text("");
            newTrackId = undefined;
        } else {
            $("#now_playing_artist").text(currentTrack['artist']);
            $("#now_playing_track").text(currentTrack['title']);
            newTrackId = idFromLink(currentTrack['link']);
        }

        newState = (nowPlaying['PlayerStatus'] == "paused") ? STATE_PAUSED : STATE_PLAYING;
    }

    if (newState != remoteCurrentState) {
        if (newState == STATE_STOPPED) {
            $("#footer_nothing_playing").removeClass("d-none");
            $("#footer_playing").addClass("d-none");
        } else {
            $("#footer_nothing_playing").addClass("d-none");
            $("#footer_playing").removeClass("d-none");

            if (newState == STATE_PAUSED) {
                $("#now_playing_pause").addClass("d-none");
                $("#now_playing_resume").removeClass("d-none");
            } else {
                $("#now_playing_pause").removeClass("d-none");
                $("#now_playing_resume").addClass("d-none");
            }
        }

        remoteCurrentState = newState;
    }

    if (newTrackId != currentTrackId) {
        $("#track_"+currentTrackId).removeClass("active-track");
        let currentTrackNode = $("#track_"+newTrackId);
        if (currentTrackNode.length == 0) {
            currentTrackId = null;  // queue page may be mid-refresh
        } else {
            currentTrackId = newTrackId;
            currentTrackNode.addClass("active-track");
        }
    }

    const downloadingState = nowPlaying['WorkerStatus'];
    if (downloadingState.startsWith("Fetching")) {
        $("#downloading-indicator-parent").removeClass('d-none');
    } else {
        $("#downloading-indicator-parent").addClass('d-none');
    }
}


function sendPause() {
    $.ajax({
        url: server + "/player/pause",
        method: "POST"
    });
}

function sendResume() {
    $.ajax({
        url: server + "/player/resume",
        method: "POST"
    });
}

function addDiskToQueue(albumId, diskNumber, successCallback) {
    if (currentModeRemoteControl) {
        return $.ajax({
            url: server + "/queue/",
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify({album: albumId, disk: diskNumber}),
            dataType: "json",
            processData: false,
            success: successCallback
        });
    }
}

function addTrackToQueue(trackId, successCallback) {
    if (currentModeRemoteControl) {
        return $.ajax({
            url: server + "/queue/",
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify({track: trackId}),
            dataType: "json",
            processData: false,
            success: successCallback
        });
    }
    return null;
}

function addTracksToQueue(trackIds) {
    if (currentModeRemoteControl) {
        if (trackIds.length == 0) {
            return;
        }
        let nextIndexToSend = 0;
        function addNextTrack() {
            if (nextIndexToSend < trackIds.length) {
                addTrackToQueue(trackIds[nextIndexToSend++], addNextTrack);
            }
        }
        addNextTrack()
    }
}

function removeFromQueue(index, trackId) {
    if (currentModeRemoteControl) {
        $.ajax({
            url: server + "/queue/",
            method: "DELETE",
            contentType: "application/json",
            data: JSON.stringify({index: index, track: trackId}),
            dataType: "json",
            processData: false,
        });
    }
}

function playFromYouTube(event, url, queue) {
    preventDoubleSubmit(event)
    let data = {
        url: url
    };
    if (queue) {
        data['queue'] = true
    }
    $.ajax({
        url: "/youtube",
        method: "POST",
        data: data,
    });
}

// Local playback functions
function setupLocalPlayers() {
    localPlayers = playlistTrackIds.map(trackId => new Howl({
        src: [server + '/mp3/' + trackId],
        preload: false,
        autoplay: false,
        format: ["mp3"],
        html5: true,
        onplayerror: function(soundId, errorCode) {
            console.log("howlerjs reported error code " + errorCode);
        },
        onend: function() {
            $('#track_'+trackId).removeClass('active-track');
            if (localTrackIndex + 1 < playlistTrackIds.length) {
                localPlay(localTrackIndex + 1);
            } else {
                hideButtons(['#local-previous', '#local-pause', '#local-fetching', '#local-resume', '#local-next']);
                currentTrackId = localTrackIndex = null;
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
        $("#track_"+currentTrackId).removeClass('active-track');
        localPlayers[localTrackIndex].stop();
        setMediaHandlers = false;  // Setting the same handlers a second time bizarrely seems to stop the handlers being called
    }
    navigator.mediaSession.setPositionState({duration: 1000000, position: 0}); // Simulate an incredibly long track so 'fast forward' will always be invoked, and we can map it to 'next track'
    localTrackIndex = playlistIndex;
    currentTrackId = playlistTrackIds[playlistIndex];
    $("#track_"+currentTrackId).addClass('active-track');
    localPlayers[playlistIndex].play();
    showPlaybackActive();
    if (setMediaHandlers) {
        for (const [action, handler] of [
            ['seekbackward', localPrevious],
            ['previoustrack', localPrevious],
            ['pause', mediaPause],
            ['play', mediaResume],
            ['seekforward', localNext],
            ['nexttrack', localNext]
        ]) {
            navigator.mediaSession.setActionHandler(action, handler);
        }
    }
    $('#local-previous').prop('disabled', (localTrackIndex == 0));
    $('#local-next').prop('disabled', (localTrackIndex + 1 >= playlistTrackIds.length));
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
    if (localTrackIndex + 1 < playlistTrackIds.length) {
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

function showPlaybackFetching() {
    showButtons(['#local-fetching']);
    hideButtons(['#local-previous', '#local-pause', '#local-resume', '#local-next']);
}

function showPlaybackPaused(resumable) {
    hideButtons(['#local-fetching', '#local-pause']);
    if (resumable) {
        showButtons(['#local-resume']);
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

// Functions common to both remote control and local playback

function playAlbum(albumId, diskNr, trackId, playlistIndex) {
    if (currentModeRemoteControl) {
        let body = {
            album: albumId
        }
        if (diskNr !== null) {
            body['disk'] = diskNr;
        }
        if (trackId !== null) {
            body['track'] = trackId;
        }
        $.ajax({
            url: '/play_album',
            data: JSON.stringify(body),
            contentType: "application/json",
            method: "POST"
        });
    } else {
        localPlay(playlistIndex);
    }
}

function playPlaylist(playlistId, trackId, playlistIndex) {
    if (currentModeRemoteControl) {
        $.ajax({
            url: `/play_playlist/${playlistId}/${trackId}`,
            method: "POST"
        });
    } else {
        localPlay(playlistIndex);
    }
}

function playFromQueue(queuePos, trackId) {
    if (currentModeRemoteControl) {
        $.ajax({
            url: `/play_queue/${queuePos}/${trackId}`,
            method: "POST"
        });
    } else {
        // You shouldn't be messing with the queue, then
    }
}

function playRadio(stationId) {
    if (currentModeRemoteControl) {
        $.ajax({
            url: `/play_radio/${stationId}`,
            method: "POST"
        });
    } else {
        // Radio not supported in local mode
    }
}

function toggleMode() {
    currentModeRemoteControl = !currentModeRemoteControl;
    Cookies.set('mode', currentModeRemoteControl ? 'remote' : 'local', { sameSite: 'Lax' });
    $('#mode-indicator-remote').toggleClass('d-none');
    $('#mode-indicator-local').toggleClass('d-none');

    if (currentTrackId != null) {
        $("#track_"+currentTrackId).removeClass('active-track');
    }

    if (currentModeRemoteControl) {
        localPause(false);
        remoteCurrentState = STATE_UNKNOWN;  // Ensure display updates when the timer next fires
        currentTrackId = null;  // ditto
        $('#footer_nothing_playing').removeClass('d-none');
        $('#footer_playing').removeClass('d-none');
        $('#footer-local-playback').addClass('d-none');
        $('.queue-button').each(function() {
            $(this).removeClass('d-none')
        });
    } else {
        if (localTrackIndex != null) {
            currentTrackId = playlistTrackIds[localTrackIndex];
            $("#track_"+currentTrackId).addClass('active-track');
            localResume();
        }
        $('#footer_nothing_playing').addClass('d-none');
        $('#footer_playing').addClass('d-none');
        $('#footer-local-playback').removeClass('d-none');
        $('.queue-button').each(function() {
            $(this).addClass('d-none')
        });
    }
}
