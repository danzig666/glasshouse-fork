/**
 * test/test-home-picture.js - Glasshouse Home's plate: the signal on the input
 * last watched, read off its receiver while Home is on screen, and the
 * picture mode the TV keeps for that input and dynamic range
 *
 * The receiver files are a G3's (webOS 9.2) with Home on screen: HDMI 4, on
 * receiver 0, still locked to a source sending 4K 24 Hz HDR10, 4:4:4 10-bit,
 * and HDMI 2, on receiver 2, with nothing connected.
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var telemetry = require('../server/lib/telemetry');
var homePicture = require('../server/lib/home-picture');

console.log('Running test-home-picture.js ...');

var FIXTURES = path.join(__dirname, 'fixtures', 'hdmi20-g3');
function fixture(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf8').trim(); }
var FILES = {
  '/proc/lg/hdmi20/port0/status': fixture('port0.status'),
  '/proc/lg/hdmi20/port0/pkt': fixture('port0.pkt'),
  '/proc/lg/hdmi20/port2/status': fixture('port2.status'),
  '/proc/lg/hdmi20/port2/pkt': fixture('port2.pkt')
};

// The G3's own modes for HDMI 4 and apps, as its settings service answered.
var MODES = {
  hdmi4: { sdr: 'cinema', hdr: 'hdrFilmMaker', dolbyHdr: 'dolbyHdrCinema' },
  hdmi2: { sdr: 'filmMaker', hdr: 'hdrCinema', dolbyHdr: 'dolbyHdrCinema' },
  default: { sdr: 'filmMaker', hdr: 'hdrFilmMaker', dolbyHdr: 'dolbyHdrCinemaBright' },
  // Not read from the G3: the tuner input as a test case.
  dtv: { sdr: 'cinema' }
};

function setUp(files, Subscription) {
  var asked = [];
  homePicture.init({
    Subscription: Subscription,
    telemetry: {
      hdmiReceiverMap: function (cb) { cb({ 1: 3, 2: 2, 3: 1, 4: 0 }); },
      getHdmiSignal: telemetry.getHdmiSignal,
      readHdmiStatus: function () { throw new Error('reads every receiver'); }
    },
    oled: { detectOled: function (cb) { cb(true); } },
    readFile: function (p) { return files.hasOwnProperty(p) ? files[p] : null; },
    luna: function (uri, payload, cb) {
      asked.push(payload);
      var dim = payload.dimension || {};
      if (payload.keys[0] === 'backlight') {
        if (!dim.input || !dim.pictureMode) return cb({ returnValue: false, errorText: 'no result from DB' });
        return cb({ returnValue: true, settings: { backlight: dim.pictureMode === 'hdrFilmMaker' ? 100 : 95 } });
      }
      // As the G3 answers: an input alone is no dimension it knows.
      var mode = dim.dynamicRange && (MODES[dim.input] || {})[dim.dynamicRange];
      cb(mode ? { returnValue: true, settings: { pictureMode: mode } } : { returnValue: false, errorText: 'no result from DB' });
    }
  });
  return asked;
}

var asked = setUp(FILES);
homePicture.picture('input', 4, function (r) {
  assert.deepEqual(r.signal, { width: 3840, height: 2160, hz: 24, chroma: 'YCbCr 4:4:4', bits: 10, hdr: 'hdr10', vrr: false, allm: false });
  assert.equal(r.range, 'hdr');
  assert.deepEqual(r.mode, { raw: 'hdrFilmMaker', display: 'HDR Filmmaker' });
  assert.equal(r.light, 100, 'the OLED light of the mode the signal is in');
  assert.deepEqual(asked.map(function (a) { return a.keys[0] + ':' + (a.dimension.dynamicRange || a.dimension.pictureMode); }),
    ['pictureMode:hdr', 'backlight:hdrFilmMaker'], 'only the range coming in is asked for');
  console.log('  ✓ HDMI 4 behind Home: 4K 24 Hz HDR10, in its HDR mode');
});

// The same source minutes later, back to SDR: RGB 8-bit, its DRM slot zeroed.
var sdrFiles = JSON.parse(JSON.stringify(FILES));
sdrFiles['/proc/lg/hdmi20/port0/status'] = FILES['/proc/lg/hdmi20/port0/status']
  .replace(/Video Format\[Y444\]/g, 'Video Format[R444]').replace(/DeepColorMode\[10BIT\]/g, 'DeepColorMode[ 8BIT]');
sdrFiles['/proc/lg/hdmi20/port0/pkt'] = FILES['/proc/lg/hdmi20/port2/pkt'];
setUp(sdrFiles);
homePicture.picture('input', 4, function (r) {
  assert.equal(r.signal.bits, 8);
  assert.equal(r.signal.hdr, 'sdr');
  assert.equal(r.range, 'sdr');
  assert.equal(r.mode.display, 'Cinema');
  assert.equal(r.light, 95);
  console.log('  ✓ the same source back in SDR, 8-bit, in its SDR mode');
});

asked = setUp(FILES);
homePicture.picture('input', 2, function (r) {
  assert.equal(r.signal, null);
  assert.equal(r.range, 'sdr');
  assert.equal(r.assumed, true);
  assert.equal(r.mode.raw, 'filmMaker');
  assert.equal(r.light, 95);
  assert.deepEqual(asked.map(function (a) { return a.keys[0] + ':' + (a.dimension.dynamicRange || a.dimension.pictureMode); }),
    ['pictureMode:sdr', 'backlight:filmMaker'], 'with no signal, the SDR mode and its light');
  console.log('  ✓ an input with nothing connected shows the mode it gets in SDR, marked as assumed');
});

// A C3 (webOS 10.2.2) answered the mode for apps at once, while the plate,
// asking only after a video was noted, showed nothing.
setUp({});
homePicture.picture('app', null, function (r) {
  assert.equal(r.input, 'default');
  assert.equal(r.signal, null);
  assert.equal(r.assumed, true);
  assert.equal(r.mode.raw, 'filmMaker');
  assert.equal(r.light, 95);
  console.log('  ✓ an app that has played nothing yet still shows its SDR mode and light');
});

// A failed mode read is asked again on the next request, not kept for 10 s.
(function () {
  var answers = 0;
  homePicture.init({
    telemetry: { hdmiReceiverMap: function (cb) { cb({}); } },
    oled: { detectOled: function (cb) { cb(true); } },
    readFile: function () { return null; },
    luna: function (uri, payload, cb) {
      if (payload.keys[0] === 'pictureMode') return cb(++answers === 1 ? { returnValue: false } : { returnValue: true, settings: { pictureMode: 'expert1' } });
      cb({ returnValue: true, settings: { backlight: 100 } });
    }
  });
  homePicture.picture('app', null, function (r) { assert.equal(r.mode, null); }, 'x');
  homePicture.picture('app', null, function (r) { assert.equal(r.mode.raw, 'expert1'); assert.equal(r.light, 100); }, 'x');
  assert.equal(answers, 2);
  console.log('  ✓ a failed mode read is not cached');
})();

setUp({});
homePicture.picture('channel', null, function (r) {
  assert.equal(r.input, 'dtv');
  assert.equal(r.signal, null);
  assert.equal(r.range, 'sdr');
  assert.equal(r.mode.display, 'Cinema');
  assert.equal(r.light, 95);
  console.log('  ✓ a channel, with no signal read, shows its SDR mode');
});

['bogus', 'constructor'].forEach(function (kind) {
  setUp({});
  homePicture.picture(kind, null, function (r) { assert.equal(r.ok, false, kind); });
});
setUp({});
homePicture.picture('input', 5, function (r) { assert.equal(r.ok, false); });
console.log('  ✓ an unknown kind or port is refused');

// Netflix playing Dolby Vision on the G3, then stopped, as getStatus reported it.
var playing = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'videooutput-g3-netflix-dv.json'), 'utf8'));
var stopped = JSON.parse(JSON.stringify(playing));
stopped.video[0] = { sink: 'MAIN', connected: false, appId: 'unknown', videoInfo: null, width: 0, height: 0 };
MODES.default.dolbyHdr = 'dolbyHdrCinemaBright';
var subscribed = [], sendVideo, stops = 0;
setUp({}, function (uri, payload, appId, handlers) {
  subscribed.push(uri);
  this.start = function () { sendVideo = handlers.message; };
  this.stop = function () { stops++; };
});
homePicture.picture('channel', null, function () {});
assert.equal(subscribed.length, 0, 'a plate read does not enable tracking');
homePicture.want('home', true);
assert.equal(subscribed.length, 0, 'Glasshouse Home alone does not track, with picture details off');
homePicture.want('details', true);
homePicture.want('details', true);
assert.deepEqual(subscribed, ['com.webos.service.videooutput/getStatus']);
sendVideo(playing);
sendVideo(stopped);
homePicture.picture('app', null, function (r) {
  assert.equal(r.signal.width, 3840);
  assert.equal(r.signal.hz, 23.98);
  assert.equal(r.signal.hdr, 'dolby_vision');
  assert.equal(r.signal.played, true);
  assert.equal(r.range, 'dolbyHdr');
  assert.equal(r.mode.display, 'Dolby Vision Cinema Bright');
}, 'netflix');
homePicture.picture('app', null, function (r) { assert.equal(r.signal, null); }, 'youtube.leanback.v4');
homePicture.want('tv', false);
homePicture.want('tv', false);
assert.equal(stops, 1, 'standby stops tracking');
homePicture.want('tv', true);
assert.equal(subscribed.length, 2, 'waking starts it again');
homePicture.want('details', false);
assert.equal(stops, 2, 'switching picture details off stops tracking');
homePicture.want('details', true);
homePicture.want('home', false);
assert.equal(stops, 3, 'switching Glasshouse Home off stops tracking');
homePicture.picture('app', null, function (r) { assert.equal(r.signal.hdr, 'dolby_vision'); }, 'netflix');
assert.equal(subscribed.length, 3, 'reading the plate after disabling does not restart tracking');
console.log('  ✓ tracking runs while Home, picture details and the TV are on, and keeps what it saw');

// Noted videos are kept in home-picture.json, written only when one changes,
// and read back by the next start: the server restarts at every cold start on
// webOS 10. YouTube as a C3 (webOS 10.2.2) reported it.
(function () {
  var os = require('os');
  var dir = path.join(os.tmpdir(), 'tvweb-home-picture-' + process.pid);
  var file = path.join(dir, 'home-picture.json');
  function clean() {
    [file, file + '.tmp'].forEach(function (f) { try { fs.unlinkSync(f); } catch (e) {} });
    try { fs.rmdirSync(dir); } catch (e) {}
  }
  clean();
  fs.mkdirSync(dir);
  var push;
  var youtube = { video: [{ sink: 'MAIN', connected: true, connectedSource: 'VDEC', appId: 'com.cobalt.youtube.adfree',
    width: 1920, height: 1080, frameRate: 60, fullScreen: false, videoInfo: { hdrType: 'none' } }] };
  function start() {
    homePicture.init({
      stateDir: dir,
      telemetry: { hdmiReceiverMap: function (cb) { cb({}); } },
      oled: { detectOled: function (cb) { cb(true); } },
      readFile: function () { return null; },
      Subscription: function (uri, payload, appId, handlers) { this.start = function () { push = handlers.message; }; this.stop = function () {}; },
      luna: function (uri, payload, cb) {
        cb(payload.keys[0] === 'pictureMode' ? { returnValue: true, settings: { pictureMode: 'expert1' } } : { returnValue: true, settings: { backlight: 100 } });
      }
    });
    homePicture.want('home', true);
    homePicture.want('details', true);
  }
  start();
  push(youtube);
  var written = fs.statSync(file).mtime.getTime();
  fs.utimesSync(file, new Date(0), new Date(0));
  push(youtube);
  assert.equal(fs.statSync(file).mtime.getTime(), 0, 'the same video again is not written again');
  start();
  homePicture.picture('app', null, function (r) {
    assert.deepEqual([r.signal.width, r.signal.height, r.signal.hz, r.signal.hdr, r.assumed], [1920, 1080, 60, 'sdr', false]);
    assert.equal(r.mode.raw, 'expert1');
  }, 'com.cobalt.youtube.adfree');
  // Only the 40 apps noted last are kept.
  for (var i = 0; i < 45; i++) {
    var v = JSON.parse(JSON.stringify(youtube));
    v.video[0].appId = 'app' + i;
    push(v);
  }
  var kept = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).played);
  assert.equal(kept.length, 40);
  assert.equal(kept[kept.length - 1], 'app44');
  assert.ok(kept.indexOf('com.cobalt.youtube.adfree') === -1 && kept.indexOf('app4') === -1 && kept.indexOf('app5') !== -1);
  assert.ok(written > 0);
  // Played again, an app moves to newest, so it is not the next dropped.
  push(JSON.parse(JSON.stringify(youtube).replace('com.cobalt.youtube.adfree', 'app5')));
  kept = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).played);
  assert.equal(kept[kept.length - 1], 'app5');
  clean();
  console.log('  ✓ noted videos survive a restart, are written only when they change, the app played last is newest, and the 40 last noted are kept');
})();

var status = FILES['/proc/lg/hdmi20/port0/status'];
var pkt = FILES['/proc/lg/hdmi20/port0/pkt'];
// The DRM InfoFrame's first data byte, after its checksum, is the EOTF: 2 PQ, 3 HLG.
var hlgPkt = pkt.replace(/(\[DRM\]\[ B01\] - Binary\[\s*)00000010(\s*\]\s*-\s*Hex\[\s*)0x02/, '$100000011$20x03');
assert.notEqual(hlgPkt, pkt);
assert.equal(homePicture.sourceHdr(status, hlgPkt), 'hlg');
assert.equal(homePicture.sourceHdr(status, FILES['/proc/lg/hdmi20/port2/pkt']), 'sdr', 'an empty DRM slot');
assert.equal(homePicture.sourceHdr(status.replace('Dolby HDR Info[0]', 'Dolby HDR Info[1]'), pkt), 'dolby_vision');
assert.equal(homePicture.sourceHdr(status, null), null, 'no pkt file');
console.log('  ✓ HDR from the receiver: PQ, HLG, none, Dolby Vision');

assert.equal(homePicture.refreshHz(status.replace('cvi_vfreq[2400]', 'cvi_vfreq[2397]'), 23), 23.97);
assert.equal(homePicture.refreshHz('', 60), 60);
console.log('  ✓ the rate in hundredths of a hertz, not the rounded Sig rate');

console.log('ALL test-home-picture.js assertions passed!');
