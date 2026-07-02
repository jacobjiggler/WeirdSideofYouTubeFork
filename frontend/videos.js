var YouTubePlayer = require('youtube-player');

var player = null;

function initPlayer() {
  player = YouTubePlayer('youtube-player', {
    autoPlay: true,
    preferredQuality: 'default',
    allowFullScreen: 'true',
  });

  player.on('stateChange', function(event) {
    if (event.data === 0) {
      playNextVid();
    }
  });

  player.on('error', function(_event) {
    playNextVid();
  });
}

function playNextVid() {
  if (!player) initPlayer();
  fetch('./api/getrandomvid').then(function(response) {
    return response.json();
  }).then(function(vid) {
    window.currentVidId = vid.vidID;
    player.loadVideoById(vid.vidID);
    player.playVideo();
  }).catch(function(error) {
    console.error(error);
  });
}

// Play one specific video first (used by shared /?v=<id> deep links). When it
// ends or errors, the stateChange/error handlers fall through to playNextVid,
// so playback continues randomly after the shared video.
function playSpecificVid(id) {
  if (!player) initPlayer();
  window.currentVidId = id;
  player.loadVideoById(id);
  player.playVideo();
}

window.playNextVid = playNextVid;
window.playSpecificVid = playSpecificVid;

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('playerbutton');
  if (btn) btn.onclick = playNextVid;
});
