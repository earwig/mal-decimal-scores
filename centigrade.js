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

function list_hook() {
    // chrome.storage.local.get(null, function(items) { console.log(items); });
    // chrome.storage.local.clear();

    $("span[id^='scoreval']").each(function(i, el) {
        var aid = el.id.split("scoreval")[1];
        var oldscorediv = $("#scorediv" + aid);
        oldscorediv.attr("id", "delete-me");
        var newscorediv = $('<div id="scorediv' + aid + '" style="display: none;"><input type="text" id="scoretext' + aid + '" size="2"><input type="button" value="Go"></div>');
        newscorediv.insertAfter(oldscorediv);
        oldscorediv.remove();

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

        chrome.storage.local.get(aid, function(items) {
            if (aid in items) {
                $(el).text(items[aid]);
            }
            else {
                var cur = parseInt($(el).text());
                if (!isNaN(cur))
                    $(el).text(cur * 10);
            }
        });
    });
}

$(document).ready(function() {
    if (window.location.href.indexOf("/animelist/") != -1) {
        list_hook();
    }
});
