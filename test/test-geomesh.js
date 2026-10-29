/**
 * test/test-geomesh.js - The geomagnetic mesh screen saver's figure: effects
 * falling with the inverse square of distance, the triad weighed against its
 * shortest arm, the summed vector pointing north with the mesh relaxed and
 * swinging south when it is squeezed, the rampart's gates open on the
 * triad, a clock that loops without a jump, and always on screen
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

console.log('Running test-geomesh.js ...');

// The file is imported by geomesh/main.qml, not required: its names are read here.
var src = fs.readFileSync(path.join(__dirname, '..', 'server', 'assets', 'screensavers', 'geomesh', 'geomesh.js'), 'utf8');
var G = {};
/* jshint evil: true */
new Function('exports', src + '\nexports.frame = frame; exports.effect = effect; exports.RING = RING; exports.UNIT = UNIT;' +
  'exports.CYCLE = CYCLE; exports.LINE_COUNT = LINE_COUNT; exports.STOPS = STOPS; exports.STROKE_COUNT = STROKE_COUNT;' +
  'exports.DOT_COUNT = DOT_COUNT; exports.RAMPART_SEGMENTS = RAMPART_SEGMENTS; exports.RADIUS = RADIUS;')(G);

(function () {
  assert.strictEqual(G.effect(0), 1);
  var d = 3 * G.UNIT;
  // Far out, doubling the distance quarters the effect.
  assert.ok(Math.abs(G.effect(2 * d) / G.effect(d) - 0.25) < 0.05);
  console.log('  ✓ an effect falls with the inverse square of its distance');
})();

(function () {
  var f = G.frame(100);
  assert.strictEqual(f.lines.length, G.LINE_COUNT);
  f.lines.forEach(function (l) { assert.strictEqual(l.alphas.length, G.STOPS); });
  assert.strictEqual(f.strokes.length, G.STROKE_COUNT);
  assert.strictEqual(f.dots.length, G.DOT_COUNT);
  assert.strictEqual(f.rampart.length, G.RAMPART_SEGMENTS);
  // The triad's shortest arm on the plane is the unit, drawn the brightest;
  // each other arm weighs (shortest / its length) squared.
  var lengths = f.triad.map(function (c) { return Math.sqrt(c.x * c.x + c.y * c.y); });
  var shortest = Math.min.apply(Math, lengths);
  f.triad.forEach(function (c, i) {
    var weight = Math.pow(shortest / lengths[i], 2);
    assert.ok(Math.abs(c.weight - weight) < 1e-9);
    assert.ok(Math.abs(f.strokes[i].alpha - (0.35 + 0.5 * weight)) < 1e-9);
  });
  assert.ok(f.triad.some(function (c) { return c.weight === 1; }));
  assert.strictEqual(f.walls.length, G.RAMPART_SEGMENTS);
  console.log('  ✓ 33 mesh lines of 7 stops, the triad weighed against its shortest arm, the summed vector, 72 rampart segments');
})();

// Relaxed, the summed vector points into the northern half; squeezed hardest
// (every 144 s, half a period in), into the southern. North on the ring is
// the brightest tick, at the top, at every moment.
(function () {
  var relaxed = G.frame(0), squeezed = G.frame(72);
  assert.ok(relaxed.squeeze > 0.99 && squeezed.squeeze < 0.7);
  assert.ok(Math.abs(relaxed.resultantAngle) < Math.PI / 2, 'relaxed: ' + relaxed.resultantAngle);
  assert.ok(Math.abs(squeezed.resultantAngle) > Math.PI / 2, 'squeezed: ' + squeezed.resultantAngle);
  var north = G.RING[0];
  assert.ok(Math.abs(north.x1) < 1e-9 && north.y1 < 0);
  G.RING.forEach(function (r, i) { if (i) assert.ok(r.alpha < north.alpha); });
  var south = 0, n = 0;
  for (var t = 0; t < G.CYCLE; t += 1) { n++; if (Math.abs(G.frame(t).resultantAngle) > Math.PI / 2) south++; }
  assert.ok(south / n > 0.1 && south / n < 0.5, 'south ' + (100 * south / n).toFixed(0) + '% of the time');
  console.log('  ✓ relaxed the sum points north, squeezed it swings south (' + Math.round(100 * south / n) + '% of the time), and north on the ring stays put');
})();

// Each triad arm's direction on the plane crosses the rampart in a gate.
(function () {
  var f = G.frame(50);
  f.triad.forEach(function (c) {
    var angle = c.angle;
    var i = Math.floor(((angle + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * G.RAMPART_SEGMENTS);
    assert.strictEqual(f.rampart[i], 0, 'gate at ' + (angle * 180 / Math.PI).toFixed(0) + ' degrees');
  });
  assert.ok(f.rampart.filter(function (o) { return o === 1; }).length > 40);
  console.log('  ✓ the rampart is open in the triad\'s three directions and closed elsewhere');
})();

(function () {
  var end = G.frame(G.CYCLE - 1 / 60), start = G.frame(0), step = G.frame(1 / 60), most = 0, first = 0;
  for (var i = 0; i < start.strokes.length; i++) {
    most = Math.max(most, Math.abs(end.strokes[i].x2 - start.strokes[i].x2), Math.abs(end.strokes[i].y2 - start.strokes[i].y2));
    first = Math.max(first, Math.abs(step.strokes[i].x2 - start.strokes[i].x2), Math.abs(step.strokes[i].y2 - start.strokes[i].y2));
  }
  assert.ok(most <= first * 1.5 + 1e-6, 'the loop moves ' + most.toFixed(3) + ' px, a frame ' + first.toFixed(3));
  console.log('  ✓ the six-hour clock starts again without a jump');
})();

// The ring, the widest part, with its ticks and the drift, stays on screen,
// and the turning plane stays inside the ring.
(function () {
  var reach = G.RADIUS + 22, x = 0, y = 0;
  for (var t = 0; t < G.CYCLE; t += 10) {
    var f = G.frame(t);
    x = Math.max(x, Math.abs(f.driftX) + reach);
    y = Math.max(y, Math.abs(f.driftY) + reach);
    f.lines.concat(f.walls).forEach(function (l) {
      assert.ok(Math.sqrt(l.x1 * l.x1 + l.y1 * l.y1) <= G.RADIUS && Math.sqrt(l.x2 * l.x2 + l.y2 * l.y2) <= G.RADIUS);
    });
  }
  assert.ok(x < 960 && y < 540, 'reaches ' + x + ', ' + y);
  console.log('  ✓ always on screen: the ring reaches ' + Math.round(x) + ' of 960 px across and ' + Math.round(y) + ' of 540 down');
})();

console.log('test-geomesh.js passed');
