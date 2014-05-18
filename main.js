/* -------------------------------- Globals -------------------------------- */

var MAX_BUCKETS = 256;
var LOADING_IMG = '<img src="http://cdn.myanimelist.net/images/xmlhttp-loader.gif" align="center">';

var should_sort = window.location.href.indexOf("order=4") != -1;

/* ------------------------ Miscellaneous functions ------------------------ */

/* Note: complaints about modifying objects we don't own are ignored since
   these changes are only executed within the context of a Chrome extension. */

String.prototype.contains = function(substr) {
    return this.indexOf(substr) != -1;
};

String.prototype.cut_after = function(substr) {
    return this.substr(this.indexOf(substr) + substr.length)
};

String.prototype.cut_before = function(substr) {
    return this.substr(0, this.indexOf(substr));
};

function get_anime_id_from_href(href) {
    var anime_id;
    if (href.contains("/anime/"))
        anime_id = href.cut_after("/anime/");
    else
        anime_id = href.cut_after("id=");
    if (anime_id.contains("/"))
        anime_id = anime_id.cut_before("/");
    if (anime_id.contains("&"))
        anime_id = anime_id.cut_before("&");
    return anime_id;
}

function get_edit_id_from_href(href) {
    var anime_id = href.cut_after("id=");
    if (anime_id.contains("&"))
        anime_id = anime_id.cut_before("&");
    return anime_id;
}

function get_score_from_element(elem) {
    var score = Math.round(elem.val() * 10) / 10;
    if (isNaN(score) || ((score < 1 || score > 10) && score != 0)) {
        alert("Invalid score: must be a number between 1.0 and 10.0, or 0.");
        return null;
    }
    if (score == Math.round(score))
        score += ".0"
    return score;
}

/* --------------------------- Storage functions --------------------------- */

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

/* ----------------------- Event patches/injections ------------------------ */

function update_list_score(anime_id) {
    var new_score = get_score_from_element($("#scoretext" + anime_id));
    if (new_score === null)
        return;
    var payload = {id: anime_id, score: Math.round(new_score)};

    $("#scorebutton" + anime_id).prop("disabled", true);
    $.post("/includes/ajax.inc.php?t=63", payload, function(data) {
        $("#scoreval" + anime_id).text(new_score == 0 ? "-" : new_score);
        $("#scoretext" + anime_id).val("");
        $("#scorediv" + anime_id).css("display", "none");
        $("#scorebutton" + anime_id).prop("disabled", false);
        if (should_sort)
            sort_list();
        update_list_stats();
    });
    save_score(anime_id, new_score);
}

function update_anime_score(anime_id, is_new) {
    var new_score = get_score_from_element($("#myinfo_score"));
    if (new_score === null)
        return;

    var t_id, payload = {score: Math.round(new_score)};
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
            $("#myinfoDisplay").html("");
            $("#addtolist").html(data);
        }
        else
            $("#myinfoDisplay").html(data);
    });
    save_score(anime_id, new_score);
}

function submit_add_form(submit_button) {
    var anime_id = $("input[name='series_title']").val();
    if (!anime_id)
        return submit_button[0].click();

    var new_score = get_score_from_element($("#score_input"));
    if (new_score === null)
        return;

    $("select[name='score']").val(Math.round(new_score));
    save_score(anime_id, new_score);
    submit_button[0].click();
}

function submit_edit_form(anime_id, submit_type, submit_button) {
    if (submit_type == 2) {
        var new_score = get_score_from_element($("#score_input"));
        if (new_score === null)
            return;

        $("select[name='score']").val(Math.round(new_score));
        save_score(anime_id, new_score);
    }
    else if (submit_type == 3)
        remove_score(anime_id);

    submit_button[0].click();
}

/* ------------------------ List stats and sorting ------------------------- */

function compare(row1, row2) {
    var r1 = $(row1).find("span[id^='scoreval']").text(),
        r2 = $(row2).find("span[id^='scoreval']").text();
    if (r1 == r2) {
        r1 = $(row1).find("a.animetitle span").text();
        r2 = $(row2).find("a.animetitle span").text();
        return r1 > r2 ? 1 : -1;
    }
    if (r1 == "-")
        return 1;
    if (r2 == "-")
        return -1;
    return r2 - r1;
}

function prepare_list() {
    var headers = [".header_cw", ".header_completed", ".header_onhold",
                   ".header_dropped", ".header_ptw"];
    $.each(headers, function(i, header) {
        $(header).next()
            .nextUntil($(".category_totals").closest("table"))
            .wrapAll('<div class="list-chart-group"/>');
    });

    $(".list-chart-group table").each(function(i, row) {
        $(row).add($(row).next())
            .wrapAll('<div class="list-chart-row"/>');
    });
}

function sort_list() {
    $(".list-chart-group").each(function(i, group) {
        $(group).find(".list-chart-row").sort(compare).each(function(i, row) {
            $(group).append(row);
        });

        $(group).find(".list-chart-row").each(function(i, row) {
            $(row).find("tr").first().children().first().text(i + 1);
            $(row).find((i % 2) ? ".td1" : ".td2").toggleClass("td1 td2");
        });
    });
}

function apply_stats(elem, old_sum, new_sum, nums) {
    var old_score = elem.text().cut_after("Score: ").cut_before(",");
    var old_dev = elem.text().cut_after("Dev.: ").cut_before("\n");
    var mean, deviation;

    mean = Math.round(new_sum / nums * 10) / 10 || 0;
    if (mean == Math.round(mean))
        mean += ".0";
    deviation = (new_sum - old_sum) / nums + parseFloat(old_dev) || 0;
    deviation = Math.round(deviation * 100) / 100;

    elem.text(elem.text()
        .replace("Score: " + old_score, "Score: " + mean)
        .replace("Dev.: " + old_dev, "Dev.: " + deviation));
}

function update_list_stats() {
    var old_sum_all = 0, new_sum_all = 0, nums_all = 0;

    $(".category_totals").each(function(i, totals) {
        var group = $(totals).closest("table").prev();
        var old_sum = 0, new_sum = 0, nums = 0;

        group.find("span[id^='scoreval']").each(function(j, elem) {
            if ($(elem).text() != "-") {
                old_sum += parseFloat($(elem).next().text());
                new_sum += parseFloat($(elem).text());
                nums++;
            }
        });
        apply_stats($(totals), old_sum, new_sum, nums);
        old_sum_all += old_sum;
        new_sum_all += new_sum;
        nums_all += nums;
    });

    if ($("#grand_totals").length > 0)
        apply_stats($("#grand_totals"), old_sum_all, new_sum_all, nums_all);
}

/* ---------------------------- Extension hooks ---------------------------- */

function hook_list() {
    retrieve_scores(null, function(data) {
        $("span[id^='scoreval']").each(function(i, elem) {
            var anime_id = elem.id.split("scoreval")[1];
            var bucket_id = (parseInt(anime_id) % MAX_BUCKETS).toString();
            var bucket = data[bucket_id];

            $(elem).after($("<span>")
                .css("display", "none").text($(elem).text()));

            if (bucket !== undefined && bucket[anime_id] !== undefined)
                $(elem).text(bucket[anime_id] == 0 ? "-" : bucket[anime_id]);
            else {
                var current = parseInt($(elem).text());
                if (!isNaN(current))
                    $(elem).text(current + ".0");
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

        prepare_list();
        if (should_sort)
            sort_list();
        update_list_stats();
    });
}

function hook_anime(anime_id) {
    retrieve_scores(anime_id, function(score) {
        var old_input = $("#myinfo_score");
        var old_button = $("input[name='myinfo_submit']");
        var is_new = old_button.attr("value") == "Add";

        if (!is_new && score === null)
            score = parseInt(old_input.val()) + ".0";

        old_input.after($("<span> / 10.0</span>"))
            .after($("<input>")
                .attr("type", "text")
                .attr("id", "myinfo_score")
                .attr("name", "myinfo_score")
                .attr("class", "inputtext")
                .attr("value", (score === null || score == 0) ? "" : score)
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

    old_input.after($("<span> / 10.0</span>"))
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

        if (score === null)
            score = parseInt(old_input.val()) + ".0";

        old_input.after($("<span> / 10.0</span>"))
            .after($("<input>")
                .attr("type", "text")
                .attr("id", "score_input")
                .attr("class", "inputtext")
                .attr("value", score == 0 ? "" : score)
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

function hook_shared() {
}

function hook_addtolist() {
    /* TODO: this entry point is unimplemented - it's rarely used and difficult
       to inject into, so I'm avoiding it for now. */
    $("<p><b>Note:</b> For the time being, anime added through this " +
      "interface cannot be given scores on the 10.0-point scale (the old " +
      "10-point system is used).</p><p>To give a more specific number, " +
      "simply add the anime here, then go to its own page or to your list " +
      "page, and update the score.</p>").insertAfter($("#stype").parent());
}

/* ------------------------------- Main hook ------------------------------- */

$(document).ready(function() {
    var href = window.location.href;
    if (href.contains("/animelist/")) {
        var list_info = $("#mal_cs_otherlinks div:first");
        if (list_info.text() == "You are viewing your anime list")
            hook_list();
    }
    else if ($("#malLogin").length == 0) {
        if (href.contains("/anime/") || href.contains("/anime.php"))
            hook_anime(get_anime_id_from_href(href));
        else if (href.contains("/panel.php") && href.contains("go=add"))
            hook_add();
        else if (href.contains("/editlist.php") && href.contains("type=anime"))
            hook_edit(get_edit_id_from_href(href));
        else if (href.contains("/shared.php") && !href.contains("type=manga"))
            hook_shared();
        else if (href.contains("/addtolist.php"))
            hook_addtolist();
    }
});
