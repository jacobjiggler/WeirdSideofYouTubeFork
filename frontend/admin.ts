import escape from 'escape-html';
import ready from './ready';

var numVideos = 0;
var loadedCount = 0;
var isLoading = false;
var allLoaded = false;
var pageSize = 50;

// CSRF token rendered into the admin page; required on every state-changing POST.
function getCsrfToken(): string {
  var meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? (meta.getAttribute('content') || '') : '';
}

function setLoading(on: boolean): void {
  var el = document.getElementById('loadingMsg');
  if (el) el.style.display = on ? '' : 'none';
}

function updateRange(): void {
  var el = document.getElementById('vidRange');
  if (!el) return;
  el.innerText = numVideos === 0 ? 'No videos' : ('Showing ' + loadedCount + ' of ' + numVideos + ' videos');
}

function generateNewEntry(video: any): HTMLElement {
  var tr = document.createElement('tr');
  tr.setAttribute('id', 'vid' + escape(video.videoID));
  tr.setAttribute('class', 'videoRow');

  var td = document.createElement('td');
  tr.appendChild(td);

  var form = document.createElement('form');
  form.setAttribute('action', '/admin/remove');
  form.setAttribute('method', 'POST');
  td.appendChild(form);

  var vidIdInput = document.createElement('input');
  vidIdInput.setAttribute('type', 'hidden');
  vidIdInput.setAttribute('name', 'videoID');
  vidIdInput.setAttribute('value', escape(video.videoID));
  form.appendChild(vidIdInput);

  var csrfInput = document.createElement('input');
  csrfInput.setAttribute('type', 'hidden');
  csrfInput.setAttribute('name', '_csrf');
  csrfInput.setAttribute('value', getCsrfToken());
  form.appendChild(csrfInput);

  var submit = document.createElement('input');
  submit.setAttribute('type', 'submit');
  submit.setAttribute('value', 'Delete Video');
  form.appendChild(submit);

  var linkTd = document.createElement('td');
  tr.appendChild(linkTd);

  var youtubeLink = document.createElement('a');
  youtubeLink.setAttribute('href', 'https://www.youtube.com/watch?v=' + encodeURIComponent(video.videoID));
  youtubeLink.innerText = escape(video.videoID);
  linkTd.appendChild(youtubeLink);

  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell"><img src="//i.ytimg.com/vi/' + encodeURIComponent(video.videoID) + '/default.jpg" /></td>');
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell" id="title"></td>');
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell">' + escape(video.views) + '</td>');
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell">' + escape(video.skips / video.views * 100) + '%</td>');
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell">' + escape(video.errorCount / video.views * 100) + '%</td>');

  // Title is filled in later by a single batched request (see loadMore).
  return tr;
}

// Fetch titles for a whole batch in one YouTube API call and fill in the cells.
function fillTitles(vids: any[]): void {
  var ids = vids.map(function (v) { return v.videoID; }).join(',');
  if (!ids) return;
  fetch('/api/getvidinfobatch?ids=' + encodeURIComponent(ids)).then(function (response) {
    return response.json();
  }).then(function (data: any) {
    var titleById: { [id: string]: string } = {};
    (data.items || []).forEach(function (item: any) { titleById[item.id] = item.snippet.title; });
    vids.forEach(function (v: any) {
      var cell = document.querySelector('#videoTable #vid' + escape(v.videoID) + ' #title');
      if (cell && titleById[v.videoID] != null) (cell as HTMLElement).innerText = titleById[v.videoID];
    });
  }).catch(function (error: any) {
    console.error(error);
  });
}

// Fetch and append the next batch of videos. Guards against concurrent loads and
// stops once everything is loaded.
function loadMore(): void {
  if (isLoading || allLoaded || (numVideos > 0 && loadedCount >= numVideos)) return;
  isLoading = true;
  setLoading(true);

  var start = loadedCount + 1;
  var end = start + pageSize - 1;

  fetch('/admin/getvidrange/' + start + '/' + end, { credentials: 'same-origin' }).then(function (response) {
    return response.json();
  }).then(function (vids: any[]) {
    var table = document.getElementById('videoTable');
    if (table) {
      for (var i = 0; i < vids.length; i++) {
        table.appendChild(generateNewEntry(vids[i]));
      }
    }
    fillTitles(vids); // one batched title request per page, not one per row
    loadedCount += vids.length;
    if (vids.length === 0 || loadedCount >= numVideos) allLoaded = true;
    updateRange();
    isLoading = false;
    setLoading(false);

    // If the content still doesn't fill the viewport, keep loading so the user
    // can actually scroll to trigger the observer.
    if (!allLoaded && document.documentElement.scrollHeight <= window.innerHeight + 200) {
      loadMore();
    }
  }).catch(function (error: any) {
    console.error(error);
    isLoading = false;
    setLoading(false);
  });
}

ready(function () {
  fetch('/api/getnumvids/').then(function (response) {
    return response.json();
  }).then(function (data: any) {
    numVideos = data.numVids;
    updateRange();
    loadMore(); // first batch

    // Auto-load the next batch as the sentinel nears the viewport.
    var sentinel = document.getElementById('scroll-sentinel');
    if (sentinel && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) loadMore();
      }, { rootMargin: '400px' });
      observer.observe(sentinel);
    } else {
      window.addEventListener('scroll', function () {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) loadMore();
      });
    }
  });
});
