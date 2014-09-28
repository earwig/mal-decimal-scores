__mal-decimal-scores__ is a Google Chrome extension that allows you to give
decimal scores for your anime on [MyAnimeList](http://myanimelist.net/).

When enabled, the normal 1-10 system is replaced with one from 1.0 to 10.0.
Rounded integer scores are saved on MyAnimeList as usual, and decimal scores
are saved using [Chrome sync](https://developer.chrome.com/extensions/storage)
so that they are available on any device you have using Chrome.

## Installing

Currently, the extension is not available in packaged form. This may change in
the future.

To install it from source, first clone the repository into a permanent
location. Then, go to [chrome://extensions](chrome://extensions), enable the
"Developer mode" checkbox in the top right corner, click on "Load unpackaged
extension...", and choose the directory of the git repository.

You will need to pack the extension yourself if you want scores to be synced
between multiple computers. Click on the "Pack extension..." button and choose
the git repository directory as the extension root. After the extension is
packed, open the resulting `.crx` file in all copies of Chrome that you want to
share the same set of scores.

## Usage

Usage should be mostly straightforward – in any place where you would
previously rate an anime by selecting a score from a dropdown menu, you can now
enter a number. Decimal scores are enabled on your list page, individual anime
pages, pages where you can add to/edit your list, and the "shared anime" page.

Scores can be exported by going to the standard list
[export page](http://myanimelist.net/panel.php?go=export), which will cause a
`animelist_decimal_scores.json` file to be downloaded to your computer. Scores
can be loaded from this file by going to the
[import page](http://myanimelist.net/import.php).

## Caveats

- Only anime can be given decimal scores. Manga scores are not affected.

- As noted above, only you can see your decimal scores. Others will see your
  scores rounded to integer values.

- Due to data restrictions in Chrome sync, there is an upper limit to the
  number of anime you can give a decimal score. This limit should be no less
  than a few thousand titles. You can check your data usage by going to the
  [export page](http://myanimelist.net/panel.php?go=export).
