const queueParentNode = document.getElementById('queue-parent');
const itemTemplate = document.getElementById('item-template').content.querySelector("div");
var queueTrackIds = [];
let doRefresh = true;
var sortable;

$(function() {
    reinitialiseSortable();
});

function reinitialiseSortable() {
    if (queueParentNode === null) {
        sortable = null;
    } else {
        sortable = Sortable.create(queueParentNode, {
            handle: '.drag-handle',
            animation: 150,
            onStart: function() {
                doRefresh = false;
            },
            onEnd: function (drageEvent) {
                doRefresh = true;
                sendUpdatedQueueOrder(drageEvent);
            }
        });
    }
}


function sendUpdatedQueueOrder(dragEvent) {
    if (currentModeRemoteControl) {
        let draggedTrackId = queueTrackIds[dragEvent.oldIndex];
        queueTrackIds.splice(dragEvent.oldIndex, 1);
        queueTrackIds.splice(dragEvent.newIndex, 0, draggedTrackId);
        console.log(`Queue reorder drag ended. Moved track: ${draggedTrackId}. New order: ${queueTrackIds}`);
        $.ajax({
            url: server + '/queue/',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({queue: queueTrackIds}),
            dataType: 'json',
            processData: false,
        });
    }
}


setInterval(function() {
    if (!currentModeRemoteControl || !doRefresh) {
        return;
    }
    // update the view of the queue
    $.ajax({
        url: server + '/queue/',
        dataType: "json",
        success: updateQueueView
    });
}, 1000);


function queueRowDivFromButtonEvent(mouseEvent) {
    let button = mouseEvent.target;
    let parent = button.parentNode;
    while (!parent.classList.contains("div-row-hover")) {
        parent = parent.parentNode;
    }
    return parent;
}

function playQueueItemButtonHandler(mouseEvent) {
    let parent = queueRowDivFromButtonEvent(mouseEvent);
    let index = parent['data-queueIndex'];
    let trackId = parent.id.slice(6);
    playFromQueue(index, trackId);
}


function removeQueueItemButtonHandler(mouseEvent) {
    let parent = queueRowDivFromButtonEvent(mouseEvent);
    let index = parent['data-queueIndex'];
    let trackId = parent.id.slice(6);
    removeFromQueue(index, trackId);
}


function updateQueueView(queue) {
    $('#loading-indicator-parent').addClass('d-none');

    queueTrackIds = [];
    for (let queueItem of queue) {
        const trackId = idFromLink(queueItem.link).toString();
        queueTrackIds.push(trackId);
    }

    // Deal with the easy case first: queue is (now?) empty
    if (queue.length == 0) {
        $('#empty-queue').removeClass('d-none');
        $('#queue-parent').children().remove();
        return;
    }

    $('#empty-queue').addClass('d-none');

    let divs = Array.from(queueParentNode.querySelectorAll('.div-row-hover'));
    let divsToKeep = []
    let divsToDelete = Array.from(divs);

    // Create nodes that represent tracks that have been added to the queue
    // (and also figure out the desired div order)
    for (let queueIndex in queue) {
        const queueItem = queue[queueIndex];
        const trackId = idFromLink(queueItem.link).toString();
        const trackIdStr = 'track_' + trackId;
        // Do we already have a div for this node?
        // (Can't use sets, because the queue could contain the same track multiple times)
        let divIndex = divsToDelete.findIndex((div) => (div.id == trackIdStr));
        let div;
        if (divIndex == -1) {
            console.log(`Creating node for ${trackIdStr}`);
            div = createNodeForQueueItem(trackIdStr, queueItem);
        } else {
            div = divsToDelete[divIndex];
            divsToDelete.splice(divIndex, 1);
        }
        divsToKeep.push(div);
        div['data-queueIndex'] = queueIndex;
        if ((queueIndex % 2) == 0) {
            div.classList.add('table-row-even');
            div.classList.remove('table-row-odd');
        } else {
            div.classList.remove('table-row-even');
            div.classList.add('table-row-odd');
        }
    }

    if (divsToKeep.every((v, i) => divs[i] == v)) {
        // Nothing changes
        return;
    }

    // Delete the divs that are no longer needed
    for (let div of divsToDelete) {
        console.log(`Deleting node ${div.id}`);
        div.remove();
    }

    // Ensure all nodes are in the right order
    // and that even/odd is set appropriately
    let logMsg = "Reordering divs: ";
    for (let divIndex in divsToKeep) {
        let div = divsToKeep[divIndex];
        queueParentNode.appendChild(div);
        logMsg += `${div.id}, `
    }
    console.log(logMsg);

    // And reset the scrollable
    sortable.destroy()
    reinitialiseSortable();
}


function createNodeForQueueItem(trackId, queueItem) {
    let newItem = itemTemplate.cloneNode(true);  // true=deep copy
    newItem.id = trackId;

    // artwork
    let artworkNode = newItem.querySelector('#artwork');
    let artworkPadNode = newItem.querySelector('#artwork-pad');
    let artworkLink = queueItem.artwork;
    if (artworkLink !== null && artworkLink !== "") {
        if (!artworkLink.startsWith('http')) {
            artworkLink = server + artworkLink;
        }
        artworkNode.src = artworkLink;
        artworkPadNode.remove();
    } else {
        artworkNode.remove();
    }

    // Artist and title link
    let trackTitleNode = newItem.querySelector('#track-title');
    let label = queueItem.artist;
    if (label === null)
        label = "";
    if (label !== "")
        label += ": ";
    label += queueItem.title;
    trackTitleNode.innerHTML = label;

    return newItem;
}
