/* Decimal Scores for MyAnimeList
   Copyright (C) 2014 Ben Kurtovic <ben.kurtovic@gmail.com>

   Distributed under the terms of the MIT License. See the LICENSE file for
   details.
*/

/* -------------------------------- Globals -------------------------------- */

var MAX_BUCKETS = 256;
var LOADING_IMG = '<img src="http://cdn.myanimelist.net/images/xmlhttp-loader.gif" align="center">';

/* ------------------------ Miscellaneous functions ------------------------ */

/* Note: complaints about modifying objects we don't own are ignored since
   these changes are only executed within the context of our own extension. */

String.prototype.contains = function(substr) {
    return this.indexOf(substr) != -1;
};

String.prototype.cut = function(after, before) {
    var str = this;
    if (str.contains(after)) {
        str = str.substr(str.indexOf(after) + after.length);
        if (str.contains(before))
            str = str.substr(0, str.indexOf(before));
    }
    return str;
};

function round_score(num) {
    num = Math.round(num * 10) / 10;
    if (isNaN(num))
        return num;
    if (num == Math.round(num))
        num += ".0";
    return num;
}

function get_score_from_element(elem) {
    var score = round_score(elem.val());
    if (isNaN(score) || ((score < 1 || score > 10) && score != 0)) {
        alert("Invalid score: must be a number between 1.0 and 10.0, or 0.");
        return null;
    }
    return score;
}

function load_score_into_element(data, anime_id, elem) {
    var bucket = data[(parseInt(anime_id) % MAX_BUCKETS).toString()];
    if (bucket !== undefined && bucket[anime_id] !== undefined)
        elem.text(bucket[anime_id] == 0 ? "-" : bucket[anime_id]);
    else {
        var current = parseInt(elem.text());
        if (!isNaN(current))
            elem.text(current + ".0");
    }
}

function update_shared_row_colors(row, our_pos) {
    var our_cell = $(row.find("td")[our_pos]);
    var their_cell = $(row.find("td")[our_pos == 1 ? 2 : 1]);
    var diff = our_cell.text() - their_cell.text();

    if (!diff) {
        row.find("td").css("background-color", "#f6f6f6");
        our_cell.add(their_cell).find("span").css("color", "");
    }
    else {
        row.find("td").css("background-color", "");
        our_cell.css("color", diff > 0 ? "#FF0000" : "#0000FF");
        their_cell.css("color", diff > 0 ? "#0000FF" : "#FF0000");
    }
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

function export_scores() {
    chrome.storage.sync.get(null, function(dat) {
        var blob = new Blob([JSON.stringify(dat)], {type: "application/json"});
        $($("<a>")
            .attr("href", window.URL.createObjectURL(blob))
            .attr("download", "animelist_decimal_scores.json")
            .hide()
            .appendTo($("body"))[0].click()).remove();
    });
}

function validate_score_data(data) {
    if (!$.isPlainObject(data))
        throw "invalid data type: " + data;
    if (JSON.stringify(data).length > chrome.storage.sync.QUOTA_BYTES)
        throw "file too large";

    for (var bucket_id in data) {
        if (data.hasOwnProperty(bucket_id)) {
            if (isNaN(parseInt(bucket_id)) || bucket_id >= MAX_BUCKETS)
                throw "invalid bucket ID: " + bucket_id;
            var bucket = data[bucket_id];
            if (!$.isPlainObject(bucket))
                throw "invalid bucket type: " + bucket;
            for (var anime_id in bucket) {
                if (data.hasOwnProperty(anime_id)) {
                    if (isNaN(parseInt(anime_id)))
                        throw "invalid anime ID: " + anime_id;
                    if (parseInt(anime_id) % MAX_BUCKETS != bucket_id)
                        throw "anime is in the wrong bucket: " + anime_id;
                    var score = parseFloat(bucket[anime_id]);
                    if (isNaN(score))
                        throw "score is not a number: " + score;
                    if ((score < 1 || score > 10) && score != 0)
                        throw "score out of range: " + score;
                }
            }
        }
    }
}

function import_scores(data, callback) {
    validate_score_data(data);
    chrome.storage.sync.clear(function() {
        chrome.storage.sync.set(data, callback);
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

function compare_scores(row1, row2) {
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

function extract_progress(td) {
    var text = td.text();
    if (text.contains("/"))
        return [text.substr(0, text.indexOf("/")), text.cut("/", " ")];
    else
        return [text, text];
}

function compare_progress(row1, row2) {
    var header = $(row1).parent().prev();
    var column = header.find("td")
        .index(header.find("a:contains('Progress')").closest("td"));

    var r1 = extract_progress($($(row1).find("td")[column])),
        r2 = extract_progress($($(row2).find("td")[column]));

    if (r1[0] == r2[0])
        return r2[1] - r1[1];
    return (r2[0] == "-" ? 0 : r2[0]) - (r1[0] == "-" ? 0 : r1[0]);
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

    $(".category_totals, #grand_totals").each(function(i, totals) {
        var text = $(totals).text();
        $(totals).empty()
            .append($("<span>").text(text))
            .append($("<span>").hide().text(text.cut("Score Dev.: ", "\n")));
    });
}

function sort_list() {
    var order = parseInt(window.location.href.cut("order=", "&")), cmp_func;
    switch (order) {
        case 4:
            cmp_func = compare_scores;   break;
        case 12:
            cmp_func = compare_progress; break;
        default:
            return;
    }

    $(".list-chart-group").each(function(i, group) {
        $(group).find(".list-chart-row").sort(cmp_func).each(function(i, row) {
            $(group).append(row);
        });

        $(group).find(".list-chart-row").each(function(i, row) {
            $(row).find("tr").first().children().first().text(i + 1);
            $(row).find((i % 2) ? ".td1" : ".td2").toggleClass("td1 td2");
        });
    });
}

function apply_stats(elem, old_sum, new_sum, nums) {
    var text = elem.find(":first").text();
    var mean = round_score(new_sum / nums) || "0.0";
    var dev = parseFloat(elem.find(":first").next().text());
    dev = Math.round(((new_sum - old_sum) / nums + dev || 0) * 100) / 100;

    elem.find(":first").text(text
        .replace("Score: " + text.cut("Score: ", ","), "Score: " + mean)
        .replace("Dev.: " + text.cut("Dev.: ", "\n"), "Dev.: " + dev));
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

            $(elem).after($("<span>").hide().text($(elem).text()));
            load_score_into_element(data, anime_id, $(elem));

            $("#scorediv" + anime_id)
                .after($("<div>")
                    .attr("id", "scorediv" + anime_id)
                    .hide()
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
    var our_profile = $("#nav a:first").attr("href"), our_pos;
    var profile_links = $("#content h2:first").find("a").slice(1);
    var shared_table = $("#content h2:first").next(), unique_table;
    var shared_means = shared_table.find("tr:nth-last-child(2)");
    var mean_score, mean_diff;

    if ($(profile_links[0]).attr("href") == our_profile)
        our_pos = 1;
    else if ($(profile_links[1]).attr("href") == our_profile)
        our_pos = 2;
    else
        return;

    retrieve_scores(null, function(data) {
        var score_sum = 0, diff_sum = 0, score_nums = 0, diff_nums = 0;

        shared_table.find("tr").slice(1, -2).each(function(i, row) {
            var anime_id = $(row).find("a").attr("href").cut("/anime/", "/");
            var our_cell = $($(row).find("td")[our_pos]).find("span");
            var their_cell = $($(row).find("td")[our_pos == 1 ? 2 : 1]);
            var diff_cell = $($(row).find("td")[3]);

            load_score_into_element(data, anime_id, our_cell);
            if (our_cell.text() != "-") {
                score_sum += parseFloat(our_cell.text());
                score_nums++;
            }
            if (our_cell.text() != "-" && their_cell.text() != "-") {
                var diff = Math.abs(our_cell.text() - their_cell.text());
                diff_sum += diff;
                diff_cell.text(round_score(diff));
                diff_nums++;
                update_shared_row_colors($(row), our_pos);
            }
        });

        unique_table = $($("#content h2")[our_pos]).next();
        unique_table.find("tr").slice(1, -1).each(function(i, row) {
            var anime_id = $(row).find("a").attr("href").cut("/anime/", "/");
            var cell = $(row).find("td:nth(1)").find("span");
            load_score_into_element(data, anime_id, cell);
        });

        mean_score = round_score(score_sum / score_nums);
        if (!isNaN(mean_score)) {
            $(shared_means.find("td")[our_pos]).find("span").text(mean_score);
            update_shared_row_colors(shared_means, our_pos);
        }

        mean_diff = Math.round(diff_sum / diff_nums * 100) / 100;
        if (!isNaN(mean_diff))
            $(shared_means.find("td")[3]).text(mean_diff);
    });
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

function hook_export() {
    chrome.storage.sync.getBytesInUse(null, function(usage) {
        usage = Math.round(usage / 1024 * 10) / 10;
        usage += " KB / " + chrome.storage.sync.QUOTA_BYTES / 1024 + " KB";
        $("#dialog td")
            .append($("<hr>")
                .css("border", "none")
                .css("background-color", "#bebebe")
                .css("height", "1px"))
            .append($("<p>")
                .html("The regular list export above will only include " +
                      "rounded scores. You can export your decimal scores " +
                      "separately and " +
                      '<a href="http://myanimelist.net/import.php">import ' +
                      "them</a> later."))
            .append($("<div>")
                .attr("class", "spaceit")
                .html("Chrome Sync usage: " + usage))
            .append($("<input>")
                .attr("type", "submit")
                .attr("value", "Export Decimal Scores")
                .attr("class", "inputButton")
                .click(export_scores));
    });
}

function hook_import() {
    $("#content").append($("<hr>")
            .css("border", "none")
            .css("background-color", "#bebebe")
            .css("height", "1px"))
        .append($("<p>")
            .html("You can also import decimal scores here. Doing so will " +
                  "erase any existing decimal scores."))
        .append($("<div>")
            .attr("class", "spaceit")
            .append($("<input>")
                .attr("id", "decimal-file")
                .attr("size", "60")
                .attr("type", "file")
                .attr("class", "inputtext")))
        .append($("<input>")
            .attr("id", "decimal-submit")
            .attr("type", "submit")
            .attr("value", "Import Decimal Scores")
            .attr("class", "inputButton")
            .click(function() {
                var filelist = $("#decimal-file")[0].files, file, reader;
                if (filelist.length != 1)
                    return;
                file = filelist[0];
                if (file.type != "application/json") {
                    alert("Invalid file type: must be .json.");
                    return;
                }
                reader = new FileReader();
                reader.onload = function() {
                    try {
                        import_scores(JSON.parse(reader.result), function() {
                            $("#decimal-file").after("<p>Success!</p>")
                                .remove();
                            $("#decimal-submit").remove();
                        });
                    } catch (exc) {
                        if (typeof exc === "object")
                            alert("The file could not be parsed as JSON.");
                        else
                            alert("Error validating data: " + exc);
                    }
                };
                reader.readAsText(file);
            }));
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
            hook_anime(href.cut("/anime/", "/").cut("id=", "&"));
        else if (href.contains("/panel.php") && href.contains("go=add"))
            hook_add();
        else if (href.contains("/editlist.php") && href.contains("type=anime"))
            hook_edit(href.cut("id=", "&"));
        else if (href.contains("/shared.php") && !href.contains("type=manga"))
            hook_shared();
        else if (href.contains("/addtolist.php"))
            hook_addtolist();
        else if (href.contains("/panel.php") && href.contains("go=export"))
            hook_export();
        else if (href.contains("/import.php"))
            hook_import();
    }
});
