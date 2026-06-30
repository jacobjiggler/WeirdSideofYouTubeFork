// Invoke 'strict' JavaScript mode
'use strict';

var api = require('./api');

exports.crawlRedditUrl = function(reddit_url)
{
  fetch(reddit_url, { headers: { 'User-Agent': 'weirdtube.wtf crawler' } })
    .then(function (response) {
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (reqJSON) {
      if (!reqJSON) return;
      for(var i = 0; i < reqJSON.data.children.length; i++)
      {
        var url = reqJSON.data.children[i].data.url;
        if(url != null)
        {
          console.log('Adding video id: ' + url + ' to database');
          api.addVideo(url, function(err, _vid){
            if(err)
              console.log(err);
          });
        }
      }
    })
    .catch(function (err) { console.log('Reddit crawl error: ' + err.message); });
};

// handles the POST request for crawling reddit
exports.crawlReddit = function() {
  exports.crawlRedditUrl('https://www.reddit.com/r/deepintoyoutube/top/.json?limit=150&t=all');
  setTimeout(function() { console.log('Finished crawling r/deepintoyoutube all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/deepintoyoutube/top/.json?limit=25&t=week');
  setTimeout(function() { console.log('Finished crawling r/deepintoyoutube weekly'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/NotTimAndEric/top/.json?limit=25&t=all');
  setTimeout(function() { console.log('Finished crawling r/NotTimAndEric all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/NotTimAndEric/top/.json?limit=5&t=month');
  setTimeout(function() { console.log('Finished crawling r/NotTimAndEric monthly'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/fifthworldvideos/top/.json?limit=100&t=all');
  setTimeout(function() { console.log('Finished crawling r/fifthworldvideos all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/weirdtube/top/.json?limit=25&t=all');
  setTimeout(function() { console.log('Finished crawling r/weirdtube all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/darksideofyoutube/top/.json?limit=25&t=all');
  setTimeout(function() { console.log('Finished crawling r/darksideofyoutube all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/unknownvideos/search.json?limit=40&q=flair%3A%22funny%22&sort=top&restrict_sr=on&t=all');
  setTimeout(function() { console.log('Finished crawling r/unknownvideos all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/InterdimensionalCable/top/.json?limit=50&t=all');
  setTimeout(function() { console.log('Finished crawling r/InterdimensionalCable all time'); }, 3000);
  exports.crawlRedditUrl('https://www.reddit.com/r/InterdimensionalCable/top/.json?limit=10&t=month');
  console.log('Finished crawling r/InterdimensionalCable monthly');
};

// Automatic scheduling intentionally disabled.
// Trigger manually via the admin panel ("Crawl /r/DeepIntoYoutube" button).
