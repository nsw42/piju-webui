$(function() {
    var url = window.location.href;
    var slash = url.lastIndexOf('/');
    var leaf = url.substring(slash + 1);
    startAjaxRequest(leaf, 30000);
});


function startAjaxRequest(leaf, timeout) {
    var now = new Date();
    console.log(`${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} starting ajax request (timeout=${timeout})`);
    $.ajax({
        url: "/genre_contents/" + leaf + '?timeout=' + timeout,
        success: function(result) {
            result = JSON.parse(result);
            $('#loading-indicator-parent').hide();
            var anchors = result['anchors'];
            var genre_contents = '';
            for (var album of result['albums']) {
                var album_anchor = album['anchor'];
                if (anchors[album_anchor] == album['id']) {
                    genre_contents = genre_contents.concat(
                        `<a name="${album_anchor}" style="scroll-margin-top: 80px;"></a>`
                    );
                }
                genre_contents = genre_contents.concat(
                    '<div class="d-block div-row-hover py-2 align-middle">',
                    '<div class="position-relative" style="width: 55vw">',
                    '<div class="d-table-cell ps-3 pe-1 album-row">'
                );
                if (album['artwork_link'] != null) {
                    genre_contents = genre_contents.concat(
                        `<img src="${server + album['artwork_link']}" class="img-fluid rounded float-left pr-4" width="100">`
                    )
                } else {
                    genre_contents = genre_contents.concat(
                        '<div class="d-inline-block align-middle" style="width: 100px; height: 100px"></div>'
                    )
                }
                genre_contents = genre_contents.concat(
                    '</div>',
                    '<div class="d-table-cell align-middle ps-2">',
                    `<a href="/albums/${album['id']}" class="stretched-link">${album['artist'] != null ? album['artist'] : "Unknown Artist"}: ${album['title'] != null ? album['title'] : "Unknown Album"}</a>  ${album['year'] != null ? "(" + album['year'] + ")" : ""}`,
                    '</div>',
                    '</div>',
                    '</div>'
                )
            }
            $('#genre-content').removeClass('d-none').html(genre_contents);

            var letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            var anchors_contents ='';
            for (var letter of letters) {
                var anchor = (letter == '#' ? 'num' : letter);
                anchors_contents = anchors_contents.concat(
                    '<div class="text-center">',
                    anchors[anchor] == null ? letter : `<a href="#${anchor}">${letter}</a>`,
                    '</div>'
                )
            }
            $('#anchor-parent').removeClass('d-none');
            $('#anchor-content').html(anchors_contents);
        },
        error: function() {
            console.log("Failed to get genre contents. Retrying");
            startAjaxRequest(leaf, timeout + 30000);
        },
        timeout: timeout * 3,
    });
}
