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
    player.loadVideoById(vid.vidID);
    player.playVideo();
  }).catch(function(error) {
    console.error(error);
  });
}

window.playNextVid = playNextVid;

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('playerbutton');
  if (btn) btn.onclick = playNextVid;
});
