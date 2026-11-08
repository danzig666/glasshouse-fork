/*
 * test/test-mtva.js - MTVA's live channels for Internet TV: the playlist
 * points each channel back at the server, and the address in MédiaKlikk's
 * player page is read with its escaped slashes put back.
 */
var assert = require('assert');
var mtva = require('../server/lib/mtva');

console.log('Running test-mtva.js ...');

var list = mtva.playlist('http://127.0.0.1:8080');
assert.strictEqual(list.indexOf('#EXTM3U\n'), 0);
assert.ok(list.indexOf(',M1\nhttp://127.0.0.1:8080/api/mtva/mtv1live.m3u8\n') !== -1, list);
['mtv2live', 'mtv5live', 'dunalive'].forEach(function (id) { assert.ok(list.indexOf('/api/mtva/' + id + '.m3u8') !== -1, id); });
['mtv4live', 'dunaworldlive'].forEach(function (id) { assert.strictEqual(list.indexOf(id), -1, id + ' is left out'); });

var page = 'player({"file":"https:\\/\\/c201-node62-cdn.connectmedia.hu\\/110301\\/4547\\/6af09df3\\/index.m3u8?v=5iip:192.0.2.7","type":"hls"})';
assert.strictEqual(mtva._streamFromPage(page), 'https://c201-node62-cdn.connectmedia.hu/110301/4547/6af09df3/index.m3u8?v=5iip:192.0.2.7');
assert.strictEqual(mtva._streamFromPage('<div class="error">nem elérhető</div>'), null);
assert.strictEqual(mtva._streamFromPage('"file":"http:\\/\\/plain.example\\/a.m3u8"'), null, 'https only');

var asked = [];
mtva.init({ fetch: { probeFetch: function (url, out, cb) { asked.push(url); cb(null, page); } } });
mtva.streamUrl('mtv1live', function (err, url) {
  assert.ifError(err);
  assert.ok(/connectmedia\.hu/.test(url));
  assert.ok(/video=mtv1live$/.test(asked[0]), asked[0]);
  mtva.streamUrl('mtv4live', function (err2) {
    assert.ok(err2, 'a channel not offered is refused');
    assert.strictEqual(asked.length, 1, 'without asking the player');
    console.log('test-mtva.js passed');
  });
});
