function patched_anime_checkScoreEnter(e, id) {
    if ((window.event ? window.event.keyCode : e.which) == 13)
        patched_anime_updateScore(id);
    else
        return true;
}

function patched_anime_updateScore(entry_id) {
    var new_score_centigrade = document.getElementById("scoretext" + entry_id).value;
    var new_score = Math.round(new_score_centigrade / 10.);
    var payload = {};

    $.post("/includes/ajax.inc.php?t=63", {id: entry_id, score: new_score}, function(data) {
        document.getElementById("scoreval" + entry_id).innerHTML = new_score_centigrade;
        document.getElementById("scoretext" + entry_id).value = "";
        document.getElementById("scorediv" + entry_id).style.display = "none";
    });

    payload[entry_id] = new_score_centigrade;
    chrome.storage.local.set(payload);
}

function hook_animelist() {
    // chrome.storage.local.clear();
    chrome.storage.local.get(null, function(data) {
        $("span[id^='scoreval']").each(function(i, el) {
            var aid = el.id.split("scoreval")[1];
            var old_div = $("#scorediv" + aid);
            old_div.attr("id", "delete-me");
            var new_div = $('<div id="scorediv' + aid + '" style="display: none;"><input type="text" id="scoretext' + aid + '" size="2"><input type="button" value="Go"></div>');
            new_div.insertAfter(old_div);
            old_div.remove();

            var input = $("#scoretext" + aid);
            var button = input.next();
            input.keydown(function(tid) {
                return function(e) {
                    return patched_anime_checkScoreEnter(e, tid);
                }
            }(aid));
            button.click(function(tid) {
                return function() {
                    return patched_anime_updateScore(tid);
                }
            }(aid));

            if (aid in data) {
                $(el).text(data[aid]);
            }
            else {
                var cur = parseInt($(el).text());
                if (!isNaN(cur))
                    $(el).text(cur * 10);
            }
        });
    });
}

function hook_anime(aid) {
    chrome.storage.local.get(aid, function(data) {
        var old_input = $("#myinfo_score");
        var score;
        if (aid in data) {
            score = data[aid];
        }
        else {
            var old_score = parseInt(old_input.val());
            if (old_score == 0)
                score = "";
            else
                score = old_score * 10;
        }
        old_input.attr("id", "delete-me");
        var new_input = $('<input type="text" id="myinfo_score" name="myinfo_score" class="inputtext" size="3" value="' + score + '"><span> / 100</span>');
        new_input.insertAfter(old_input);
        old_input.remove();
    });
}

$(document).ready(function() {
    if (window.location.href.indexOf("/animelist/") != -1) {
        hook_animelist();
    } else if (window.location.href.indexOf("/anime/") != -1) {
        var aid = window.location.href.substr(window.location.href.indexOf("/anime/") + "/anime/".length);
        if (aid.indexOf("/") != -1)
            aid = aid.substr(0, aid.indexOf("/"));
        hook_anime(aid);
    }
});
