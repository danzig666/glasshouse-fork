// Strict ES5 - the server runs on node 0.12 (0.10 on webOS 2).
/*
 * MTVA's free live channels, from MédiaKlikk, as an M3U playlist that
 * Internet TV can be given like any other: http://127.0.0.1:8080/api/mtva/playlist.m3u.
 *
 * MédiaKlikk's player hands out a channel's HLS address only on request, tied
 * to the IP address that asked and to the time it was asked, so a playlist of
 * fixed addresses stops playing almost at once. Each entry here points back
 * at this server instead, which asks the player for a fresh address as the
 * channel starts and redirects to it: the TV asks and plays from the same
 * address. M4 Sport (mtv4live) and Duna World (dunaworldlive) are left out:
 * on a C3 in Hungary the player gave them no stream.
 */
var fetchLib = require('./fetch');

var PLAYER = 'https://player.mediaklikk.hu/playernew/player.php?noflash=yes&video=';

var CHANNELS = [
  { id: 'mtv1live', name: 'M1' },
  { id: 'mtv2live', name: 'M2' },
  { id: 'mtv5live', name: 'M5' },
  { id: 'dunalive', name: 'Duna' }
];

var fetcher = fetchLib;

function init(opts) {
  if (opts && opts.fetch) fetcher = opts.fetch;
}

function channel(id) {
  for (var i = 0; i < CHANNELS.length; i++) if (CHANNELS[i].id === id) return CHANNELS[i];
  return null;
}

// base: where the TV reaches this server, such as http://127.0.0.1:8080.
function playlist(base) {
  var out = '#EXTM3U\n';
  CHANNELS.forEach(function (c) {
    out += '#EXTINF:-1 tvg-id="' + c.id + '" tvg-name="' + c.name + '" group-title="MTVA",' + c.name + '\n' +
      base + '/api/mtva/' + c.id + '.m3u8\n';
  });
  return out;
}

// The player page's first HLS address, written there with its slashes escaped.
function streamFromPage(body) {
  var m = /"file"\s*:\s*"(https:[^"]*\.m3u8[^"]*)"/.exec(String(body || ''));
  if (!m) return null;
  var url = m[1].replace(/\\\//g, '/');
  return /^https:\/\/[a-z0-9.\-]+\//i.test(url) && !/\s/.test(url) ? url : null;
}

// cb(err, url): a fresh address for the channel, good for the IP that asked.
function streamUrl(id, cb) {
  if (!channel(id)) return setTimeout(function () { cb(new Error('no such channel')); }, 0);
  fetcher.probeFetch(PLAYER + id, null, function (err, body) {
    if (err) return cb(err);
    var url = streamFromPage(body);
    cb(url ? null : new Error('no stream in the player page'), url);
  });
}

module.exports = {
  init: init,
  channels: function () { return CHANNELS.slice(); },
  has: function (id) { return !!channel(id); },
  playlist: playlist,
  streamUrl: streamUrl,
  _streamFromPage: streamFromPage
};
