/**
 * test/test-sacred.js - The sacred geometry screen saver's figure: an
 * icosahedron, its dual dodecahedron and the cube in that, the dodecahedron
 * breathing between the dual and the compound, on a six-hour clock that
 * loops without a jump, and always on screen
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

console.log('Running test-sacred.js ...');

// The file is imported by sacred/main.qml, not required: its names are read here.
var src = fs.readFileSync(path.join(__dirname, '..', 'server', 'assets', 'screensavers', 'sacred', 'sacred.js'), 'utf8');
var S = {};
/* jshint evil: true */
new Function('exports', src + '\nexports.frame = frame; exports.SHELLS = SHELLS; exports.DUAL_SCALE = DUAL_SCALE;' +
  'exports.EDGE_COUNT = EDGE_COUNT; exports.DOT_COUNT = DOT_COUNT; exports.CYCLE = CYCLE;')(S);

function near(a, b) { return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] - b[2]) < 1e-9; }
function midpoint(shell, e, k) {
  var a = shell.vertices[e[0]], b = shell.vertices[e[1]];
  return [(a[0] + b[0]) / 2 * k, (a[1] + b[1]) / 2 * k, (a[2] + b[2]) / 2 * k];
}
var ico = S.SHELLS[0], dodeca = S.SHELLS[1], cube = S.SHELLS[2];

(function () {
  assert.deepEqual([ico.vertices.length, ico.edges.length], [12, 30]);
  assert.deepEqual([dodeca.vertices.length, dodeca.edges.length], [20, 30]);
  assert.deepEqual([cube.vertices.length, cube.edges.length], [8, 12]);
  assert.strictEqual(S.EDGE_COUNT, 72);
  assert.strictEqual(S.DOT_COUNT, 12);
  console.log('  ✓ an icosahedron, a dodecahedron and a cube: 12, 20 and 8 corners, 72 edges');
})();

// At the dual scale every dodecahedron corner is the centre of an
// icosahedron face, and every face has one.
(function () {
  var centres = [];
  var v = ico.vertices;
  ico.edges.forEach(function (e1) {
    ico.edges.forEach(function (e2) {
      if (e1[0] !== e2[0] || e1[1] >= e2[1]) return;
      var third = ico.edges.some(function (e3) { return e3[0] === Math.min(e1[1], e2[1]) && e3[1] === Math.max(e1[1], e2[1]); });
      if (!third) return;
      var a = v[e1[0]], b = v[e1[1]], c = v[e2[1]];
      centres.push([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
    });
  });
  assert.strictEqual(centres.length, 20, 'twenty faces');
  dodeca.vertices.forEach(function (d) {
    var p = [d[0] * S.DUAL_SCALE, d[1] * S.DUAL_SCALE, d[2] * S.DUAL_SCALE];
    assert.ok(centres.some(function (c) { return near(c, p); }), 'corner ' + d + ' on a face centre');
  });
  console.log('  ✓ at the dual scale (' + S.DUAL_SCALE.toFixed(4) + ') each dodecahedron corner is on an icosahedron face centre');
})();

// At scale 1 the two make the compound: each icosahedron edge crosses a
// dodecahedron edge at both their midpoints. The cube's corners are the
// dodecahedron's.
(function () {
  ico.edges.forEach(function (e) {
    var m = midpoint(ico, e, 1);
    assert.ok(dodeca.edges.some(function (f) { return near(midpoint(dodeca, f, 1), m); }));
  });
  cube.vertices.forEach(function (c) {
    assert.ok(dodeca.vertices.some(function (d) { return near(c, d); }));
  });
  console.log('  ✓ at scale 1 the edges of the two cross at their midpoints, and the cube is on the dodecahedron');
})();

(function () {
  var end = S.frame(S.CYCLE - 1 / 60), start = S.frame(0), step = S.frame(1 / 60), most = 0, first = 0;
  for (var i = 0; i < start.edges.length; i++) {
    most = Math.max(most, Math.abs(end.edges[i].x1 - start.edges[i].x1), Math.abs(end.edges[i].y1 - start.edges[i].y1));
    first = Math.max(first, Math.abs(step.edges[i].x1 - start.edges[i].x1), Math.abs(step.edges[i].y1 - start.edges[i].y1));
  }
  assert.ok(most <= first * 1.5 + 1e-6, 'the loop moves ' + most.toFixed(3) + ' px, a frame ' + first.toFixed(3));
  console.log('  ✓ the six-hour clock starts again without a jump');
})();

(function () {
  var reachX = 0, reachY = 0;
  for (var t = 0; t < S.CYCLE; t += 2) {
    var f = S.frame(t);
    assert.strictEqual(f.edges.length, S.EDGE_COUNT);
    assert.strictEqual(f.dots.length, S.DOT_COUNT);
    f.edges.forEach(function (e) {
      assert.ok(e.depth >= 0 && e.depth <= 1 && e.coreAlpha <= 1 && e.glowAlpha <= 1);
      reachX = Math.max(reachX, Math.abs(e.x1 + f.driftX), Math.abs(e.x2 + f.driftX));
      reachY = Math.max(reachY, Math.abs(e.y1 + f.driftY), Math.abs(e.y2 + f.driftY));
    });
  }
  var glow = 12;  // half the widest halo, at 1080 lines
  assert.ok(reachX + glow < 960, 'x reaches ' + reachX.toFixed(0));
  assert.ok(reachY + glow < 540, 'y reaches ' + reachY.toFixed(0));
  console.log('  ✓ always on screen: at most ' + Math.round(reachX) + ' of 960 px across and ' + Math.round(reachY) + ' of 540 down from the middle');
})();

console.log('test-sacred.js passed');
