/*
 * The geomagnetic mesh screen saver's figure, after Attila Kőszeghy's "The
 * Geomagnetic Poles Will Not Swap Places" (T4Terv, 2021): the mesh of
 * texture elements round an observation site, in three directions crossing
 * in triangles of unequal sides; each effect weakening with the inverse
 * square of its distance; the triad from the observer to the three nearest
 * intersections and its summed vector; the rampart of Goseck with its three
 * gates; the degree ring of the transmission circle diagram.
 *
 * The mesh rocks slowly and is squeezed and relaxed north-south. Near the
 * tightest squeeze the summed vector of the triad swings south, then back,
 * while north on the ring stays where it is: the book's poles that do not
 * swap places.
 *
 * The ground plane, with the mesh, the triad and the rampart on it, turns in
 * 3D: it leans back and swings from side to side, seen in perspective, while
 * the ring stays flat as the frame. Both turns are about axes of the screen,
 * so north on the plane still points up the screen.
 *
 * The mesh moves faster than the other screen savers' figures, a squeeze
 * every 144 s, so the swing can be seen without waiting for it.
 *
 * Plain ES5 with no QML in it, so the browser preview runs this same file.
 * Every motion is a function of t, in seconds, on a six-hour clock: each
 * period divides 21600, so nothing jumps when the clock starts again.
 */

var CYCLE = 21600;

// The ring's radius, the mesh's unit length and the rampart's radius, in
// pixels at 1080 lines.
var RADIUS = 380;
var UNIT = 150;
var RAMPART = 205;
// Lines per family of the mesh, and the colour stops along each.
var PER_FAMILY = 11;
var STOPS = 7;
var LINE_COUNT = 3 * PER_FAMILY;
var RAMPART_SEGMENTS = 72;
var STROKE_COUNT = 6;
var DOT_COUNT = 4;
// Half the width of a gate in the rampart, in radians.
var GATE = 7 * Math.PI / 180;

// Colours, [r, g, b] from 0 to 1. The mesh takes the rose-magenta of the
// book's mesh drawings.
var MESH_RGB = [0.86, 0.42, 0.70];
var TRIAD_RGB = [0.80, 0.88, 1.00];
var SUM_RGB = [1.00, 0.72, 0.36];
var RAMPART_RGB = [0.76, 0.63, 0.50];
var RING_RGB = [0.62, 0.68, 0.78];

function phase(t, T) {
    return (t % T) / T * 2 * Math.PI;
}

// The degree ring: a tick every 5 degrees, longer every 30, north the
// brightest. It does not turn. Each is { x1, y1, x2, y2, alpha }.
var RING = (function () {
    var out = [];
    for (var i = 0; i < 72; i++) {
        var a = i * 5 * Math.PI / 180;
        var major = i % 6 === 0;
        var inner = RADIUS + (major ? 6 : 12);
        var outer = RADIUS + 22;
        var sx = Math.sin(a), cy = -Math.cos(a);
        out.push({ x1: sx * inner, y1: cy * inner, x2: sx * outer, y2: cy * outer,
                   alpha: i === 0 ? 0.75 : (major ? 0.38 : 0.20) });
    }
    return out;
})();

/*
 * The observer's triangle at time t, its corners on screen from the
 * observer, y down and north up: two shorter arms leaning north and a longer
 * one to the south, so the triad's sum points north. The angles between the
 * arms stay within the 105 to 135 degrees the book gives for triads. The
 * mesh is the lattice of this triangle.
 *
 * Squeezing the mesh north-south shortens the south arm, the one most along
 * north-south, the most: its effect grows by the inverse square until, near
 * the tightest squeeze, the sum swings south. North on the ring stays put.
 */
function triangle(t) {
    var lean = (50 + 6 * Math.sin(phase(t, 180))) * Math.PI / 180;
    var left = 0.50, right = 0.54 + 0.03 * Math.sin(phase(t, 120) + 1.0);
    var south = 0.60 + 0.03 * Math.sin(phase(t, 216));
    var rock = 0.26 * Math.sin(phase(t, 540));
    // Squeezed north-south by up to 36%.
    var squeeze = 1 - 0.36 * (0.5 - 0.5 * Math.cos(phase(t, 144)));
    function place(angle, length) {
        var a = angle + rock;
        return [Math.sin(a) * length * UNIT, -Math.cos(a) * length * squeeze * UNIT];
    }
    return { corners: [place(Math.PI, south), place(-lean, left), place(lean, right)], squeeze: squeeze };
}

/*
 * The ground plane seen at time t: a function from a point on the plane (x
 * east, y south, from the observer) to the screen, with its depth. The plane
 * leans back about the screen's horizontal axis, north going away, and swings
 * about its vertical axis, in perspective from VIEW_DISTANCE; then it is
 * scaled, never up, so its edge stays inside the ring.
 */
var VIEW_DISTANCE = 1500;
function view(t) {
    var tilt = 0.50 + 0.32 * Math.sin(phase(t, 240));
    var swing = 0.38 * Math.sin(phase(t, 300) + 0.7);
    var ct = Math.cos(tilt), st = Math.sin(tilt), cs = Math.cos(swing), ss = Math.sin(swing);
    function raw(x, y) {
        var y1 = y * ct, z1 = y * st;
        var x2 = x * cs + z1 * ss, z2 = -x * ss + z1 * cs;
        var k = VIEW_DISTANCE / (VIEW_DISTANCE - z2);
        return { x: x2 * k, y: y1 * k, z: z2 };
    }
    var reach = 0;
    for (var i = 0; i < 72; i++) {
        var a = i / 72 * 2 * Math.PI, e = raw(Math.sin(a) * RADIUS, -Math.cos(a) * RADIUS);
        reach = Math.max(reach, Math.sqrt(e.x * e.x + e.y * e.y));
    }
    // 1% to spare for the edge between the points sampled.
    var fit = Math.min(1, 0.99 * RADIUS / reach);
    return function (x, y) {
        var p = raw(x, y);
        // depth: 0 at the far edge of the plane, 1 at the near.
        return { x: p.x * fit, y: p.y * fit, z: p.z, depth: Math.max(0, Math.min(1, 0.5 + p.z / (2 * RADIUS))) };
    };
}

// Where the line through p in direction d crosses the ring, as two points, or
// null where it misses.
function chord(p, d) {
    var len = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
    var ux = d[0] / len, uy = d[1] / len;
    var along = p[0] * ux + p[1] * uy;
    var disc = along * along - (p[0] * p[0] + p[1] * p[1]) + RADIUS * RADIUS;
    if (disc <= 0) return null;
    var r = Math.sqrt(disc);
    return [[p[0] + ux * (-along - r), p[1] + uy * (-along - r)],
            [p[0] + ux * (-along + r), p[1] + uy * (-along + r)]];
}

// The effect at distance d from the observer, by the inverse square, 1 at
// the observer.
function effect(d) {
    var u = d / (1.1 * UNIT);
    return 1 / (1 + u * u);
}

/*
 * The figure at time t, in pixels at 1080 lines from the observation site:
 * the mesh lines, each with the alpha at STOPS points along it; the triad to
 * the three nearest intersections with each one's effect; the summed vector;
 * the rampart, how open each segment is and each one on screen; and the
 * drift. Everything on the plane is seen through view(t).
 */
function frame(t) {
    var T = triangle(t), p0 = T.corners[0], see = view(t);
    var a = [T.corners[1][0] - p0[0], T.corners[1][1] - p0[1]];
    var b = [T.corners[2][0] - p0[0], T.corners[2][1] - p0[1]];
    function node(i, j) { return [p0[0] + i * a[0] + j * b[0], p0[1] + i * a[1] + j * b[1]]; }

    var lines = [];
    var families = [
        { dir: a, at: function (k) { return node(0, k); } },
        { dir: b, at: function (k) { return node(k, 0); } },
        { dir: [b[0] - a[0], b[1] - a[1]], at: function (k) { return node(k, 0); } }
    ];
    families.forEach(function (f, fi) {
        for (var n = 0; n < PER_FAMILY; n++) {
            var k = n - (PER_FAMILY - 1) / 2 + (fi === 2 ? 1 : 0);
            var c = chord(f.at(k), f.dir);
            var line = { x1: 0, y1: 0, x2: 0, y2: 0, alphas: [] };
            var ends = c ? [see(c[0][0], c[0][1]), see(c[1][0], c[1][1])] : null;
            for (var s = 0; s < STOPS; s++) {
                if (!c) { line.alphas.push(0); continue; }
                // The stops are evenly spaced on screen; under perspective that
                // is not evenly along the line on the plane, so each is taken
                // back to the plane point it shows.
                var u = s / (STOPS - 1);
                var dA = VIEW_DISTANCE - ends[0].z, dB = VIEW_DISTANCE - ends[1].z;
                var v = u * dA / ((1 - u) * dB + u * dA);
                var x = c[0][0] + (c[1][0] - c[0][0]) * v, y = c[0][1] + (c[1][1] - c[0][1]) * v;
                var depth = ends[0].depth + (ends[1].depth - ends[0].depth) * v;
                // Faded to nothing at the ring, so no line ends in a hard edge.
                var edge = Math.min(1, 4 * Math.min(v, 1 - v) + 0.0001);
                line.alphas.push(0.80 * effect(Math.sqrt(x * x + y * y)) * edge * (0.6 + 0.4 * depth));
            }
            if (c) {
                line.x1 = ends[0].x; line.y1 = ends[0].y; line.x2 = ends[1].x; line.y2 = ends[1].y;
            }
            lines.push(line);
        }
    });

    // The triad: the three corners of the observer's triangle. The shortest
    // is the unit; the others weigh by the inverse square of their lengths,
    // as in the book's Figure 17.
    var corners = T.corners;
    var lengths = corners.map(function (p) { return Math.sqrt(p[0] * p[0] + p[1] * p[1]); });
    var shortest = Math.min.apply(Math, lengths);
    var sum = [0, 0];
    var triad = corners.map(function (p, i) {
        var w = Math.pow(shortest / lengths[i], 2);
        sum[0] += w * p[0] / lengths[i];
        sum[1] += w * p[1] / lengths[i];
        return { x: p[0], y: p[1], weight: w, angle: Math.atan2(p[0], -p[1]) };
    });
    var size = Math.sqrt(sum[0] * sum[0] + sum[1] * sum[1]);
    var reach = Math.min(1.9, 0.5 + 1.3 * size) * UNIT;
    var resultant = { x: sum[0] / size * reach, y: sum[1] / size * reach, angle: Math.atan2(sum[0], -sum[1]) };

    // The rampart, open where the triad's directions cross it, a segment
    // each 5 degrees of the plane, seen as the plane is.
    var rampart = [], walls = [];
    var half = Math.PI / RAMPART_SEGMENTS * 0.86;
    for (var i = 0; i < RAMPART_SEGMENTS; i++) {
        var mid = (i + 0.5) / RAMPART_SEGMENTS * 2 * Math.PI;
        var open = 1;
        triad.forEach(function (c) {
            var gap = Math.abs(Math.atan2(Math.sin(mid - c.angle), Math.cos(mid - c.angle)));
            open = Math.min(open, Math.max(0, Math.min(1, (gap - GATE) / (GATE * 0.6))));
        });
        rampart.push(open);
        var w1 = see(Math.sin(mid - half) * RAMPART, -Math.cos(mid - half) * RAMPART);
        var w2 = see(Math.sin(mid + half) * RAMPART, -Math.cos(mid + half) * RAMPART);
        walls.push({ x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y, rgb: RAMPART_RGB, core: 3, glow: 0, glowAlpha: 0,
                     alpha: 0.40 * open * (0.6 + 0.4 * (w1.depth + w2.depth) / 2) });
    }

    // Solid strokes: the triad's arms, brighter for a greater effect, and the
    // summed vector in amber with its arrowhead, drawn on screen so it stays
    // a clean arrow whichever way the plane is turned.
    var ends = triad.map(function (c) { return see(c.x, c.y); });
    var strokes = triad.map(function (c, i) {
        return { x1: 0, y1: 0, x2: ends[i].x, y2: ends[i].y, rgb: TRIAD_RGB,
                 core: 1.4 + 1.0 * c.weight, alpha: 0.35 + 0.5 * c.weight, glow: 9, glowAlpha: 0.06 + 0.06 * c.weight };
    });
    var tip = see(resultant.x, resultant.y);
    var head = 14, spread = 0.45, back = Math.atan2(-tip.y, -tip.x);
    strokes.push({ x1: 0, y1: 0, x2: tip.x, y2: tip.y, rgb: SUM_RGB, core: 2.6, alpha: 0.95, glow: 14, glowAlpha: 0.12 });
    [-spread, spread].forEach(function (d) {
        strokes.push({ x1: tip.x, y1: tip.y,
                       x2: tip.x + head * Math.cos(back + d), y2: tip.y + head * Math.sin(back + d),
                       rgb: SUM_RGB, core: 2.4, alpha: 0.9, glow: 10, glowAlpha: 0.10 });
    });
    // The observer, and the three intersections nearest it.
    var dots = [{ x: 0, y: 0, rgb: SUM_RGB, dot: 6, dotAlpha: 0.95, halo: 22, haloAlpha: 0.14 }].concat(triad.map(function (c, i) {
        return { x: ends[i].x, y: ends[i].y, rgb: TRIAD_RGB, dot: 4 + 2 * c.weight, dotAlpha: 0.5 + 0.4 * c.weight, halo: 14, haloAlpha: 0.08 };
    }));

    return {
        lines: lines,
        strokes: strokes,
        dots: dots,
        rampart: rampart,
        walls: walls,
        // The triad on the plane: each arm's end, weight and bearing from north.
        triad: triad,
        squeeze: T.squeeze,
        resultantAngle: resultant.angle,
        driftX: 90 * Math.sin(phase(t, 120)),
        driftY: 45 * Math.sin(phase(t, 90) + 1.0)
    };
}
