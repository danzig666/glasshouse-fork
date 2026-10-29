/*
 * The sacred geometry screen saver's figure: an icosahedron, its dual
 * dodecahedron and the cube inside that, turning together. Plain ES5 with no
 * QML in it, so the browser preview runs this same file.
 *
 * The dodecahedron breathes between two arrangements with the icosahedron:
 * its corners on the icosahedron's face centres (the dual inside it), and the
 * compound of the two, where their edges cross at their midpoints. With the
 * coordinates below the two solids share a midsphere, so the compound is at
 * scale 1. Eight of the dodecahedron's corners are a cube's, which moves with it.
 *
 * Every motion is a function of t, in seconds, on a six-hour clock: each
 * period divides 21600, so nothing jumps when the clock starts again.
 */

var CYCLE = 21600;
var PHI = (1 + Math.sqrt(5)) / 2;

// Every sign of each of the given points.
function signs(points) {
    var out = [];
    points.forEach(function (p) {
        for (var m = 0; m < 8; m++) {
            var q = [p[0] * ((m & 1) ? -1 : 1), p[1] * ((m & 2) ? -1 : 1), p[2] * ((m & 4) ? -1 : 1)];
            var key = q.join(',');
            if (out.every(function (o) { return o.join(',') !== key; })) out.push(q);
        }
    });
    return out;
}

// The pairs of points at the shortest distance between any two.
function edgesOf(vertices) {
    var shortest = Infinity, i, j, d;
    var dist = function (a, b) {
        var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return Math.sqrt(x * x + y * y + z * z);
    };
    for (i = 0; i < vertices.length; i++) {
        for (j = i + 1; j < vertices.length; j++) shortest = Math.min(shortest, dist(vertices[i], vertices[j]));
    }
    var out = [];
    for (i = 0; i < vertices.length; i++) {
        for (j = i + 1; j < vertices.length; j++) {
            d = dist(vertices[i], vertices[j]);
            if (Math.abs(d - shortest) < 1e-6) out.push([i, j]);
        }
    }
    return out;
}

var ICOSAHEDRON = signs([[0, 1, PHI], [1, PHI, 0], [PHI, 0, 1]]);
// The dual of the icosahedron above: a corner over the centre of each face.
var DODECAHEDRON = signs([[1, 1, 1], [0, PHI, 1 / PHI], [PHI, 1 / PHI, 0], [1 / PHI, 0, PHI]]);
var CUBE = signs([[1, 1, 1]]);

/*
 * The shells, outermost first, each with its colour (r, g, b, 0 to 1) and how
 * strongly it is drawn: the icosahedron leads, the cube is the faintest.
 */
var SHELLS = [
    { name: 'icosahedron', vertices: ICOSAHEDRON, edges: edgesOf(ICOSAHEDRON), rgb: [0.82, 0.90, 1.00], weight: 1.0, dots: true },
    { name: 'dodecahedron', vertices: DODECAHEDRON, edges: edgesOf(DODECAHEDRON), rgb: [0.35, 0.85, 0.92], weight: 0.72, dots: false },
    { name: 'cube', vertices: CUBE, edges: edgesOf(CUBE), rgb: [0.98, 0.70, 0.40], weight: 0.42, dots: false }
];

// The dodecahedron's scale with its corners on the icosahedron's face centres.
var DUAL_SCALE = (function () {
    var a = ICOSAHEDRON, faceCentre = null;
    // Three corners of one face: pairwise at the edge length 2.
    for (var i = 0; i < a.length && !faceCentre; i++) {
        for (var j = i + 1; j < a.length && !faceCentre; j++) {
            for (var k = j + 1; k < a.length && !faceCentre; k++) {
                var e = function (p, q) { return Math.abs(Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)) - 2) < 1e-6; };
                if (e(a[i], a[j]) && e(a[j], a[k]) && e(a[i], a[k])) {
                    faceCentre = [(a[i][0] + a[j][0] + a[k][0]) / 3, (a[i][1] + a[j][1] + a[k][1]) / 3, (a[i][2] + a[j][2] + a[k][2]) / 3];
                }
            }
        }
    }
    var r = Math.sqrt(faceCentre[0] * faceCentre[0] + faceCentre[1] * faceCentre[1] + faceCentre[2] * faceCentre[2]);
    return r / Math.sqrt(3);
})();

var EDGE_COUNT = SHELLS.reduce(function (n, s) { return n + s.edges.length; }, 0);
var DOT_COUNT = SHELLS.reduce(function (n, s) { return n + (s.dots ? s.vertices.length : 0); }, 0);

function phase(t, T) {
    return (t % T) / T * 2 * Math.PI;
}

function rotate(p, a, b, angle) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var pa = p[a], pb = p[b];
    p[a] = c * pa - s * pb;
    p[b] = s * pa + c * pb;
}

var VIEW = 6.0;
// Pixels, at 1080 lines, per unit after projection.
var SCALE = 1100;

/*
 * The figure at time t: every edge and corner dot on screen, in pixels at
 * 1080 lines from the middle of the screen, each with its colour, widths and
 * alphas already set, and the drift. Depth runs from 0 (far) to 1 (near).
 */
function frame(t) {
    var yaw = phase(t, 240);
    var pitch = 0.45 + 0.30 * Math.sin(phase(t, 300));
    var roll = 0.25 * Math.sin(phase(t, 216));
    // 0 for the dual inside the icosahedron, 1 for the compound.
    var breath = 0.5 - 0.5 * Math.cos(phase(t, 180));
    var inner = DUAL_SCALE + (1 - DUAL_SCALE) * breath;
    var edges = [], dots = [];
    SHELLS.forEach(function (shell, s) {
        var k = s === 0 ? 1 : inner;
        var pts = shell.vertices.map(function (v) {
            var p = [v[0] * k, v[1] * k, v[2] * k];
            rotate(p, 0, 2, yaw);
            rotate(p, 1, 2, pitch);
            rotate(p, 0, 1, roll);
            var g = 1 / (VIEW - p[2]);
            return { x: p[0] * g * SCALE, y: -p[1] * g * SCALE, depth: Math.max(0, Math.min(1, 0.5 + p[2] / 3.8)) };
        });
        shell.edges.forEach(function (e) {
            var a = pts[e[0]], b = pts[e[1]], depth = (a.depth + b.depth) / 2, w = shell.weight;
            edges.push({
                x1: a.x, y1: a.y, x2: b.x, y2: b.y, depth: depth,
                rgb: shell.rgb,
                core: (0.9 + 1.5 * depth) * (0.6 + 0.4 * w),
                coreAlpha: (0.22 + 0.70 * depth) * w,
                glow: (6 + 8 * depth) * (0.6 + 0.4 * w),
                glowAlpha: (0.03 + 0.09 * depth) * w
            });
        });
        if (shell.dots) {
            pts.forEach(function (p) {
                dots.push({ x: p.x, y: p.y, depth: p.depth, rgb: shell.rgb,
                            dot: 2.5 + 3.0 * p.depth, dotAlpha: 0.40 + 0.55 * p.depth,
                            halo: 11 + 12 * p.depth, haloAlpha: 0.04 + 0.09 * p.depth });
            });
        }
    });
    return {
        edges: edges,
        dots: dots,
        driftX: 90 * Math.sin(phase(t, 600)),
        driftY: 45 * Math.sin(phase(t, 450) + 1.0)
    };
}
