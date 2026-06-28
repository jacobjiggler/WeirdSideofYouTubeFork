// Invoke 'strict' JavaScript mode
'use strict';

var api = require('./api');
var request = require('request');
var schedule = require('node-schedule');

exports.crawlRedditUrl = function(reddit_url)
{
  request(reddit_url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var reqJSON = JSON.parse(body);
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
    }
  });
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

// Run daily
schedule.scheduleJob('0 0 * * *', exports.crawlReddit);
