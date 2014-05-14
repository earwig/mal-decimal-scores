/* Constants */

var MAX_BUCKETS = 256;
var LOADING_IMG = '<img src="http://cdn.myanimelist.net/images/xmlhttp-loader.gif" align="center">';

/* Miscellaneous functions */

function get_anime_id_from_href(href) {
    var anime_id;
    if (href.indexOf("/anime/") != -1)
        anime_id = href.substr(href.indexOf("/anime/") + "/anime/".length);
    else
        anime_id = href.substr(href.indexOf("id=") + "id=".length);
    if (anime_id.indexOf("/") != -1)
        anime_id = anime_id.substr(0, anime_id.indexOf("/"));
    if (anime_id.indexOf("&") != -1)
        anime_id = anime_id.substr(0, anime_id.indexOf("&"));
    return anime_id;
}

function get_edit_id_from_href(href) {
    var anime_id = href.substr(href.indexOf("id=") + "id=".length);
    if (anime_id.indexOf("&") != -1)
        anime_id = anime_id.substr(0, anime_id.indexOf("&"));
    return anime_id;
}

function get_scores_from_element(elem) {
    var score_100 = parseInt(elem.val());
    var score_10 = Math.round(score_100 / 10.);
    if (isNaN(score_100) || score_100 < 1 || score_100 > 100) {
        alert("Invalid score: must be an integer between 1 and 100.");
        return null;
    }
    return [score_100, score_10];
}

/* Storage functions */

function save_score(anime_id, score) {
    var bucket_id = (parseInt(anime_id) % MAX_BUCKETS).toString();

    chrome.storage.sync.get(bucket_id, function(data) {
        var bucket = data[bucket_id];
        if (bucket === undefined)
            bucket = data[bucket_id] = {};
        bucket[anime_id] = score;
        chrome.storage.sync.set(data);
    });
}

function retrieve_scores(anime_id, callback) {
    var bucket_id = null;
    if (anime_id !== null)
        bucket_id = (parseInt(anime_id) % MAX_BUCKETS).toString();

    chrome.storage.sync.get(bucket_id, function(data) {
        if (anime_id !== null) {
            var bucket = data[bucket_id];
            if (bucket !== undefined && bucket[anime_id] !== undefined)
                callback(bucket[anime_id]);
            else
                callback(null);
        }
        else
            callback(data);
    });
}

function remove_score(anime_id) {
    var bucket_id = (parseInt(anime_id) % MAX_BUCKETS).toString();

    chrome.storage.sync.get(bucket_id, function(data) {
        var bucket = data[bucket_id];
        if (bucket === undefined || bucket[anime_id] === undefined)
            return;
        delete bucket[anime_id];
        if ($.isEmptyObject(bucket))
            chrome.storage.sync.remove(bucket_id);
        else
            chrome.storage.sync.set(data);
    });
}

/* Event patches/injections */

function update_list_score(anime_id) {
    var new_scores = get_scores_from_element($("#scoretext" + anime_id));
    if (new_scores === null)
        return;

    var new_score_100 = new_scores[0], new_score_10 = new_scores[1];
    var payload = {id: anime_id, score: new_score_10};

    $("#scorebutton" + anime_id).prop("disabled", true);
    $.post("/includes/ajax.inc.php?t=63", payload, function(data) {
        $("#scoreval" + anime_id).text(new_score_100);
        $("#scoretext" + anime_id).val("");
        $("#scorediv" + anime_id).css("display", "none");
        $("#scorebutton" + anime_id).prop("disabled", false);
    });
    save_score(anime_id, new_score_100);
}

function update_anime_score(anime_id, is_new) {
    var new_scores = get_scores_from_element($("#myinfo_score"));
    if (new_scores === null)
        return;

    var new_score_100 = new_scores[0], new_score_10 = new_scores[1];
    var t_id, payload = {score: new_score_10};
    payload["status"] = $("#myinfo_status").val();
    payload["epsseen"] = $("#myinfo_watchedeps").val();

    if (is_new) {
        payload["aid"] = anime_id;
        t_id = "61";
    }
    else {
        payload["alistid"] = anime_id;
        payload["aid"] = $("#myinfo_anime_id").val();
        payload["astatus"] = $("#myinfo_curstatus").val();
        t_id = "62";
    }

    $("#myinfoDisplay").html(LOADING_IMG);
    $.post("/includes/ajax.inc.php?t=" + t_id, payload, function(data) {
        if (is_new) {
            document.getElementById("myinfoDisplay").innerHTML = "";
            document.getElementById("addtolist").innerHTML = data;
        }
        else
            document.getElementById("myinfoDisplay").innerHTML = data;
    });
    save_score(anime_id, new_score_100);
}

function submit_add_form(submit_button) {
    var anime_id = $("input[name='series_title']").val();
    if (!anime_id)
        return submit_button[0].click();

    var new_scores = get_scores_from_element($("#score_input"));
    if (new_scores === null)
        return;

    var new_score_100 = new_scores[0], new_score_10 = new_scores[1];
    $("select[name='score']").val(new_score_10);
    save_score(anime_id, new_score_100);
    submit_button[0].click();
}

function submit_edit_form(anime_id, submit_type, submit_button) {
    if (submit_type == 2) {
        var new_scores = get_scores_from_element($("#score_input"));
        if (new_scores === null)
            return;

        var new_score_100 = new_scores[0], new_score_10 = new_scores[1];
        $("select[name='score']").val(new_score_10);
        save_score(anime_id, new_score_100);
    }
    else if (submit_type == 3)
        remove_score(anime_id);

    submit_button[0].click();
}

/* Extension hooks */

function hook_list() {
    retrieve_scores(null, function(data) {
        $("span[id^='scoreval']").each(function(i, elem) {
            var anime_id = elem.id.split("scoreval")[1];
            var bucket_id = (parseInt(anime_id) % MAX_BUCKETS).toString();
            var bucket = data[bucket_id];

            if (bucket !== undefined && bucket[anime_id] !== undefined)
                $(elem).text(bucket[anime_id]);
            else {
                var current = parseInt($(elem).text());
                if (!isNaN(current))
                    $(elem).text(current * 10);
            }

            $("#scorediv" + anime_id)
                .after($("<div>")
                    .attr("id", "scorediv" + anime_id)
                    .css("display", "none")
                    .append($('<input>')
                        .attr("type", "text")
                        .attr("id", "scoretext" + anime_id)
                        .attr("size", "2")
                        .keydown(function(a_id) {
                                return function(ev) {
                                    if ((window.event ? window.event.keyCode : ev.which) == 13)
                                        update_list_score(a_id);
                                    else
                                        return true;
                                }
                            }(anime_id)))
                    .append($("<input>")
                        .attr("type", "button")
                        .attr("id", "scorebutton" + anime_id)
                        .attr("value", "Go")
                        .click(function(a_id) {
                                return function() { return update_list_score(a_id); }
                            }(anime_id))))
                .remove();
        });
    });
}

function hook_anime(anime_id) {
    retrieve_scores(anime_id, function(score) {
        var old_input = $("#myinfo_score");
        var old_button = $("input[name='myinfo_submit']");
        var is_new = old_button.attr("value") == "Add";

        if (!is_new && score === null) {
            var old_score = parseInt(old_input.val());
            score = old_score == 0 ? "" : old_score * 10;
        }

        old_input.after($("<span> / 100</span>"))
            .after($("<input>")
                .attr("type", "text")
                .attr("id", "myinfo_score")
                .attr("name", "myinfo_score")
                .attr("class", "inputtext")
                .attr("value", (score === null) ? "" : score)
                .attr("size", "3"))
            .remove();

        old_button.after($("<input>")
                .attr("type", "button")
                .attr("name", "myinfo_submit")
                .attr("value", old_button.attr("value"))
                .attr("class", "inputButton")
                .click(function(a_id, is_new) {
                        return function() { return update_anime_score(a_id, is_new); }
                    }(anime_id, is_new)))
            .remove();
    });
}

function hook_add() {
    var old_input = $("select[name='score']");
    var old_submit = $("input[type='button'][onclick='checkValidSubmit(1)']");

    old_input.after($("<span> / 100</span>"))
        .after($("<input>")
            .attr("type", "text")
            .attr("id", "score_input")
            .attr("class", "inputtext")
            .attr("size", "3"))
        .hide();

    old_submit.after($("<input>")
            .attr("type", "button")
            .attr("class", "inputButton")
            .attr("style", old_submit.attr("style"))
            .attr("value", old_submit.attr("value"))
            .click(function(button) {
                    return function() { return submit_add_form(button); }
                }(old_submit)))
        .hide();
}

function hook_edit(anime_id) {
    retrieve_scores(anime_id, function(score) {
        var old_input = $("select[name='score']");
        var old_edit = $("input[type='button'][onclick='checkValidSubmit(2)']");
        var old_delete = $("input[type='button'][onclick='checkValidSubmit(3)']");

        if (score === null) {
            var old_score = parseInt(old_input.val());
            score = old_score == 0 ? "" : old_score * 10;
        }

        old_input.after($("<span> / 100</span>"))
            .after($("<input>")
                .attr("type", "text")
                .attr("id", "score_input")
                .attr("class", "inputtext")
                .attr("value", score)
                .attr("size", "3"))
            .hide();

        old_edit.after($("<input>")
                .attr("type", "button")
                .attr("class", "inputButton")
                .attr("style", old_edit.attr("style"))
                .attr("value", old_edit.attr("value"))
                .click(function(a_id, button) {
                        return function() { return submit_edit_form(a_id, 2, button); }
                    }(anime_id, old_edit)))
            .hide();

        old_delete.after($("<input>")
                .attr("type", "button")
                .attr("class", "inputButton")
                .attr("value", old_delete.attr("value"))
                .click(function(a_id, button) {
                        return function() { return submit_edit_form(a_id, 3, button); }
                    }(anime_id, old_delete)))
            .hide();
    });
}

function hook_addtolist() {
    /* TODO: this entry point is unimplemented - it's rarely used and difficult
       to inject into, so I'm avoiding it for now. */
}

/* Main extension hook */

$(document).ready(function() {
    var href = window.location.href;
    if (href.indexOf("/animelist/") != -1)
        hook_list();
    else if (href.indexOf("/anime/") != -1 || href.indexOf("/anime.php") != -1)
        hook_anime(get_anime_id_from_href(href));
    else if (href.indexOf("/panel.php") != -1 && href.indexOf("go=add") != -1)
        hook_add();
    else if (href.indexOf("/editlist.php") != -1 && href.indexOf("type=anime") != -1)
        hook_edit(get_edit_id_from_href(href));
    else if (href.indexOf("/addtolist.php") != -1)
        hook_addtolist();
});
