/*
 * Voidform screen saver: a ring of brushed titanium ribbon, three half turns
 * round, turning slowly in a dark studio and changing shape as it goes.
 *
 * The ring is ray-marched in a fragment shader at its full 1000x1000, 30
 * times a second; drawn at 640x640 and scaled up, its edges and milling broke
 * up on a C3. On a C3 (webOS 10.2.2) the shader
 * draws when set up this way, as Veils in upstream PR #889 is, rendered
 * through a ShaderEffectSource.
 *
 * Kind to the panel: the background is black, the ring turns all the time,
 * and it drifts gently about the middle of the screen.
 */
import QtQuick 2.4
import Eos.Window 0.1

WebOSWindow {
    id: win

    // Sized for the compositor's 1920x1080 layout rather than from Screen,
    // which can report smaller: a 43LM5760PTC drew the window in a corner.
    width: 1920
    height: 1080

    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    appId: "com.webos.app.screensaver"
    title: "Screen Saver"
    visible: true
    color: "black"

    // Dim or bright, written in when the screen saver is staged.
    property int level: __TVWEB_LEVEL__

    // Seconds, round a six-hour cycle that every period divides; each start
    // begins somewhere else in it.
    property real t: (Date.now() / 1000 + Math.random() * 3600) % 21600
    property double last: 0
    function phase(s, period) { return (s % period) / period * 2 * Math.PI; }

    ShaderEffect {
        id: ring
        width: 1000
        height: 1000
        property real yaw: win.phase(win.t, 180)
        property real pitch: 0.55 + 0.35 * Math.sin(win.phase(win.t, 150))
        property real roll: 0.30 * Math.sin(win.phase(win.t, 216))
        property real cy: Math.cos(yaw)
        property real sy: Math.sin(yaw)
        property real cp: Math.cos(pitch)
        property real sp: Math.sin(pitch)
        property real cr: Math.cos(roll)
        property real sr: Math.sin(roll)
        property real morph: Math.sin(win.phase(win.t, 120))
        property real twist: win.phase(win.t, 135)
        property real dist: 3.1 + 0.2 * Math.sin(win.phase(win.t, 360))
        property real gain: win.level > 0 ? 0.92 : 0.62
        fragmentShader: [
            "precision highp float;",
            "varying highp vec2 qt_TexCoord0;",
            "uniform lowp float qt_Opacity;",
            "uniform float cy;",
            "uniform float sy;",
            "uniform float cp;",
            "uniform float sp;",
            "uniform float cr;",
            "uniform float sr;",
            "uniform float morph;",
            "uniform float twist;",
            "uniform float dist;",
            "uniform float gain;",
            "",
            "const float RING = 0.62;",
            "const float BOUND = 1.02;",
            "",
            "// World to the ring's own space: yaw, then pitch, then roll.",
            "vec3 toObject(vec3 v) {",
            "    v = vec3(cr * v.x + sr * v.y, -sr * v.x + cr * v.y, v.z);",
            "    v = vec3(v.x, cp * v.y + sp * v.z, -sp * v.y + cp * v.z);",
            "    return vec3(cy * v.x - sy * v.z, v.y, sy * v.x + cy * v.z);",
            "}",
            "vec3 toWorld(vec3 v) {",
            "    v = vec3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);",
            "    v = vec3(v.x, cp * v.y - sp * v.z, sp * v.y + cp * v.z);",
            "    return vec3(cr * v.x - sr * v.y, sr * v.x + cr * v.y, v.z);",
            "}",
            "",
            "// The ribbon's cross-section at a point: across it in x, through it in y.",
            "vec2 section(vec3 p) {",
            "    float a = atan(p.z, p.x);",
            "    float bend = RING + 0.05 * morph * sin(2.0 * a + twist);",
            "    vec2 q = vec2(length(p.xz) - bend, p.y);",
            "    // Three half turns round the ring: the section is the same turned by",
            "    // half a turn, so the ribbon meets itself where atan wraps.",
            "    float w = 1.5 * a + twist;",
            "    float c = cos(w), s = sin(w);",
            "    return vec2(c * q.x - s * q.y, s * q.x + c * q.y);",
            "}",
            "",
            "float ribbon(vec3 p) {",
            "    vec2 q = section(p);",
            "    vec2 extent = vec2(0.25 + 0.05 * morph, 0.035);",
            "    vec2 d = abs(q) - extent + 0.025;",
            "    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.025;",
            "}",
            "",
            "vec3 normalAt(vec3 p) {",
            "    const vec2 k = vec2(1.0, -1.0);",
            "    const float e = 0.002;",
            "    return normalize(k.xyy * ribbon(p + k.xyy * e) + k.yyx * ribbon(p + k.yyx * e) +",
            "                     k.yxy * ribbon(p + k.yxy * e) + k.xxx * ribbon(p + k.xxx * e));",
            "}",
            "",
            "float band(float x) { return exp(-x * x); }",
            "",
            "// A studio: a long soft light above, a narrow warm one at the left, a",
            "// faint violet floor; black everywhere else.",
            "vec3 studio(vec3 r) {",
            "    vec3 c = vec3(0.72, 0.86, 1.00) * 1.5 * band((r.y - 0.60) * 7.0) * smoothstep(-0.9, 0.2, r.z);",
            "    c += vec3(0.90, 0.95, 1.00) * 1.1 * band((r.x - 0.32) * 16.0) * smoothstep(-0.1, 0.5, r.z + r.y);",
            "    c += vec3(1.00, 0.66, 0.36) * 0.75 * band((r.x + 0.80) * 9.0) * smoothstep(-0.2, 0.6, r.y + 0.3);",
            "    c += vec3(0.25, 0.80, 0.95) * 0.20 * band((r.x - 0.88) * 6.0);",
            "    c += vec3(0.42, 0.30, 0.80) * 0.08 * (1.0 - smoothstep(-0.9, -0.2, r.y));",
            "    return c;",
            "}",
            "",
            "void main() {",
            "    vec2 uv = (qt_TexCoord0 * 2.0 - 1.0) * vec2(1.0, -1.0);",
            "    vec3 ro = vec3(0.0, 0.0, dist);",
            "    vec3 rd = normalize(vec3(uv * 0.37, -1.0));",
            "    vec3 col = vec3(0.0);",
            "",
            "    // Only rays through the sphere round the ring are marched.",
            "    float b = dot(ro, rd);",
            "    float h = b * b - dot(ro, ro) + BOUND * BOUND;",
            "    if (h > 0.0) {",
            "        h = sqrt(h);",
            "        vec3 o = toObject(ro), d = toObject(rd);",
            "        float t = -b - h, tEnd = -b + h;",
            "        float nearest = 1.0;",
            "        bool hit = false;",
            "        for (int i = 0; i < 64; i++) {",
            "            float s = ribbon(o + d * t);",
            "            nearest = min(nearest, s);",
            "            if (s < 0.0015) { hit = true; break; }",
            "            t += s * 0.7;",
            "            if (t > tEnd) break;",
            "        }",
            "        if (hit) {",
            "            vec3 p = o + d * t;",
            "            vec3 np = normalAt(p);",
            "            vec3 n = toWorld(np);",
            "            vec3 v = -rd;",
            "            float ndv = max(dot(n, v), 0.0);",
            "            vec3 r = reflect(rd, n);",
            "            float fres = 0.35 + 0.65 * pow(1.0 - ndv, 5.0);",
            "            // Titanium: the studio in it, tinted, with fine milling across.",
            "            vec3 metal = vec3(0.80, 0.82, 0.88);",
            "            vec2 q = section(p);",
            "            float mill = 0.93 + 0.07 * sin(q.x * 180.0);",
            "            col = studio(r) * metal * fres * mill;",
            "            vec3 key = normalize(vec3(-0.45, 0.75, 0.55));",
            "            vec3 hv = normalize(key + v);",
            "            col += vec3(0.85, 0.92, 1.00) * pow(max(dot(n, hv), 0.0), 90.0) * 0.9;",
            "            col += metal * 0.05 * max(dot(n, key), 0.0);",
            "            col += vec3(0.20, 0.75, 0.90) * 0.07 * pow(1.0 - ndv, 3.0);",
            "            // Where the ribbon passes close to itself, less light reaches.",
            "            float ao = clamp(ribbon(p + np * 0.10) / 0.10, 0.0, 1.0);",
            "            col *= 0.45 + 0.55 * ao;",
            "            // The far side of the ring falls away into the dark.",
            "            col *= mix(0.15, 1.0, 1.0 - smoothstep(dist - 0.7, dist + 0.9, t));",
            "        } else {",
            "            // A trace of light just off the edge.",
            "            col = vec3(0.20, 0.55, 0.75) * 0.025 * exp(-nearest * 90.0);",
            "        }",
            "    }",
            "    col = 1.0 - exp(-col * 2.0);",
            "    col = pow(col * gain, vec3(0.70));",
            "    gl_FragColor = vec4(col, 1.0) * qt_Opacity;",
            "}"
        ].join("\n")
    }

    ShaderEffectSource {
        id: frame
        sourceItem: ring
        hideSource: true
        live: false
        textureSize: Qt.size(1000, 1000)
    }

    // The ring, centred, drifting a little so no pixel stays lit the same.
    ShaderEffect {
        width: 1000
        height: 1000
        x: 460 + 24 * Math.sin(win.phase(win.t, 600))
        y: 40 + 12 * Math.sin(win.phase(win.t, 450) + 1.0)
        property variant source: frame
    }

    Timer {
        interval: 33; running: true; repeat: true
        onTriggered: {
            var now = Date.now();
            var dt = win.last ? Math.min((now - win.last) / 1000, 0.1) : 0.033;
            win.last = now;
            win.t = (win.t + dt) % 21600;
            frame.scheduleUpdate();
        }
    }
}
