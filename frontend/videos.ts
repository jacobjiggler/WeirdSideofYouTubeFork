import YouTubePlayer from 'youtube-player';
import { computePortraitHeight } from '../lib/portraitSize';

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

// Must match the min-width breakpoint in WeirdStyle.css that puts Next/Share
// beside the portrait player instead of below it.
var SIDE_BY_SIDE_QUERY = '(min-width: 769px)';

function sizePortraitPlayer(): void {
  var container = document.getElementById('youtube-player-container');
  if (!container || !container.classList.contains('portrait')) return;
  var top = container.getBoundingClientRect().top;
  // Below the 769px breakpoint the Next/Share buttons render below the
  // player itself — measure their real height (rather than guessing) so the
  // player doesn't grow to fill the whole viewport and push them off the
  // bottom of the page. Above it, CSS moves them beside the player, so they
  // no longer compete for vertical space and nothing needs reserving.
  var reserved = 0;
  if (!window.matchMedia(SIDE_BY_SIDE_QUERY).matches) {
    var playDiv = document.getElementById('playDiv');
    if (playDiv) {
      var pdStyle = getComputedStyle(playDiv);
      reserved = playDiv.getBoundingClientRect().height +
        parseFloat(pdStyle.marginTop || '0') +
        parseFloat(pdStyle.marginBottom || '0');
    }
  }
  var h = computePortraitHeight(window.innerHeight, top, reserved);
  container.style.setProperty('--portrait-h', h + 'px');
}

window.addEventListener('resize', sizePortraitPlayer);

// Vertical videos (YouTube Shorts) look bad pillarboxed in the 16:9 player.
// Detect the true aspect ratio via YouTube's original-aspect-ratio thumbnail
// (oardefault.jpg) and switch the player to a portrait layout when the video is
// taller than it is wide. Defaults to landscape if the thumbnail is missing.
function applyAspect(id: string): void {
  var container = document.getElementById('youtube-player-container');
  if (!container) return;
  container.classList.remove('portrait'); // assume landscape until proven portrait
  var img = new Image();
  img.onload = function () {
    if (img.naturalHeight > img.naturalWidth) {
      container.classList.add('portrait');
      sizePortraitPlayer();
    }
  };
  img.src = 'https://i.ytimg.com/vi/' + id + '/oardefault.jpg';
}

function playNextVid(): void {
  if (!player) initPlayer();
  fetch('./api/getrandomvid').then(function (response) {
    return response.json();
  }).then(function (vid: any) {
    (window as any).currentVidId = vid.vidID;
    applyAspect(vid.vidID);
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
  applyAspect(id);
  player.loadVideoById(id);
  player.playVideo();
}

(window as any).playNextVid = playNextVid;
(window as any).playSpecificVid = playSpecificVid;

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('playerbutton');
  if (btn) (btn as HTMLElement).onclick = playNextVid;
});
