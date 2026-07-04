import YouTubePlayer from 'youtube-player';

let player: any = null;

function initPlayer(): void {
  player = YouTubePlayer('youtube-player', {
    autoPlay: true,
    preferredQuality: 'default',
    allowFullScreen: 'true'
  });

  player.on('stateChange', function (event: any) {
    if (event.data === 0) {
      playNextVid();
    }
  });

  player.on('error', function () {
    playNextVid();
  });
}

function playNextVid(): void {
  if (!player) initPlayer();
  fetch('./api/getrandomvid').then(function (response) {
    return response.json();
  }).then(function (vid: any) {
    (window as any).currentVidId = vid.vidID;
    player.loadVideoById(vid.vidID);
    player.playVideo();
  }).catch(function (error: any) {
    console.error(error);
  });
}

// Play one specific video first (used by shared /?v=<id> deep links). When it
// ends or errors, the stateChange/error handlers fall through to playNextVid.
function playSpecificVid(id: string): void {
  if (!player) initPlayer();
  (window as any).currentVidId = id;
  player.loadVideoById(id);
  player.playVideo();
}

(window as any).playNextVid = playNextVid;
(window as any).playSpecificVid = playSpecificVid;

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('playerbutton');
  if (btn) (btn as HTMLElement).onclick = playNextVid;
});
