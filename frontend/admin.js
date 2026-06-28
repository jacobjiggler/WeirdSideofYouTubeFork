var escape = require('escape-html');
var ready = require('./ready');

var currentVideoID = 1;
var numVideos = 0;
var videosPerPage = 50;

// CSRF token rendered into the admin page; required on every state-changing POST.
function getCsrfToken() {
  var meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

function loadNewTable() {
  var endRange = (currentVideoID+videosPerPage <= numVideos) ? currentVideoID+videosPerPage : numVideos;
  var rangeTxt = 'Showing videos ' + currentVideoID + ' through ' + endRange + ' of ' + numVideos;
  document.getElementById('vidRange').innerText = rangeTxt;

  var vidTable = document.getElementById('videoTable');
  var rows = vidTable.querySelectorAll('tr');
  for(var i = 0; i < rows.length; ++i) {
    if(/videoRow/.test(rows[i].className)) {
      vidTable.removeChild(rows[i]);
    }
  }

  fetch('/admin/getvidrange/' + currentVideoID + '/' + (currentVideoID + 49), {credentials: 'same-origin'}).then(function(response) {
    console.log(response);
    return response.json();
  }).then(function(vids) {
    for(var key in vids) {
      var val = vids[key];
      var dom = generateNewEntry(val);
      document.getElementById('videoTable').appendChild(dom);
    }
  }).catch(function(error) {
    console.error(error);
  });
}

function generateNewEntry(video) {
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
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell">' + escape(video.skips/video.views * 100) + '%</td>');
  tr.insertAdjacentHTML('beforeEnd', '<td class = "data-cell">' + escape(video.errorCount/video.views * 100) + '%</td>');

  fetch('/api/getVidInfo/' + encodeURIComponent(video.videoID)).then(function(response) {
    return response.json();
  }).then(function(data) {
    document.querySelector('#videoTable #vid' + escape(video.videoID) + ' #title').innerText = data.items[0].snippet.title;
  });

  return tr;
}

ready(function() {
  loadNewTable();

  fetch('/api/getnumvids/').then(function(response) {
    return response.json();
  }).then(function(data) {
    numVideos = data.numVids;
    document.getElementById('vidRange').innerText = 'Showing videos ' +
      currentVideoID + ' through ' +
      ((currentVideoID+videosPerPage <= numVideos) ?
        currentVideoID+videosPerPage : numVideos) +
      ' of ' + numVideos;
  });

  var nxtPage = function() {
    currentVideoID += videosPerPage;
    if(currentVideoID > numVideos) currentVideoID -= videosPerPage;
    loadNewTable();
  };
  document.getElementById('nextButtonTop').onclick = nxtPage;
  document.getElementById('nextButtonBottom').onclick = nxtPage;

  var prvPage = function() {
    currentVideoID -= videosPerPage;
    if(currentVideoID < 1) currentVideoID = 1;
    loadNewTable();
  };
  document.getElementById('previousButtonTop').onclick = prvPage;
  document.getElementById('previousButtonBottom').onclick = prvPage;
});
