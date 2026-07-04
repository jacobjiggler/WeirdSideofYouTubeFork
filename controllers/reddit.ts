import api = require('./api');

const reddit = {
  crawlRedditUrl(reddit_url: string): void {
    fetch(reddit_url, { headers: { 'User-Agent': 'weirdtube.wtf crawler' } })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((reqJSON: any) => {
        if (!reqJSON) return;
        for (let i = 0; i < reqJSON.data.children.length; i++) {
          const url = reqJSON.data.children[i].data.url;
          if (url != null) {
            console.log('Adding video id: ' + url + ' to database');
            api.addVideo(url, (err: unknown) => {
              if (err) console.log(err);
            });
          }
        }
      })
      .catch((err: any) => { console.log('Reddit crawl error: ' + err.message); });
  },

  // handles the POST request for crawling reddit
  crawlReddit(): void {
    reddit.crawlRedditUrl('https://www.reddit.com/r/deepintoyoutube/top/.json?limit=150&t=all');
    setTimeout(() => { console.log('Finished crawling r/deepintoyoutube all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/deepintoyoutube/top/.json?limit=25&t=week');
    setTimeout(() => { console.log('Finished crawling r/deepintoyoutube weekly'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/NotTimAndEric/top/.json?limit=25&t=all');
    setTimeout(() => { console.log('Finished crawling r/NotTimAndEric all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/NotTimAndEric/top/.json?limit=5&t=month');
    setTimeout(() => { console.log('Finished crawling r/NotTimAndEric monthly'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/fifthworldvideos/top/.json?limit=100&t=all');
    setTimeout(() => { console.log('Finished crawling r/fifthworldvideos all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/weirdtube/top/.json?limit=25&t=all');
    setTimeout(() => { console.log('Finished crawling r/weirdtube all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/darksideofyoutube/top/.json?limit=25&t=all');
    setTimeout(() => { console.log('Finished crawling r/darksideofyoutube all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/unknownvideos/search.json?limit=40&q=flair%3A%22funny%22&sort=top&restrict_sr=on&t=all');
    setTimeout(() => { console.log('Finished crawling r/unknownvideos all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/InterdimensionalCable/top/.json?limit=50&t=all');
    setTimeout(() => { console.log('Finished crawling r/InterdimensionalCable all time'); }, 3000);
    reddit.crawlRedditUrl('https://www.reddit.com/r/InterdimensionalCable/top/.json?limit=10&t=month');
    console.log('Finished crawling r/InterdimensionalCable monthly');
  }
};

// Automatic scheduling intentionally disabled.
// Trigger manually via the admin panel ("Crawl /r/DeepIntoYoutube" button).
export = reddit;
