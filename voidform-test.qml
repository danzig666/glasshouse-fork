import QtQuick 2.4
import Eos.Window 0.1

// Voidform test: a titanium ribbon ring, ray-marched in a fragment shader,
// set up the way Veils (upstream PR #889) is, which draws on a C3.
WebOSWindow {
    id: win
    width: 1920
    height: 1080
    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    appId: "com.webos.app.screensaver"
    title: "Screen Saver"
    visible: true
    color: "black"
    property int level: 1
    property double t: (Date.now() / 1000) % 21600
    property double last: 0
    function phase(s, T) { return (s % T) / T * 2 * Math.PI; }

    ShaderEffect {
        id: ring
        width: 640
        height: 640
        property real cy: Math.cos(win.phase(win.t, 180))
        property real sy: Math.sin(win.phase(win.t, 180))
        property real cp: Math.cos(0.55 + 0.35 * Math.sin(win.phase(win.t, 150)))
        property real sp: Math.sin(0.55 + 0.35 * Math.sin(win.phase(win.t, 150)))
        property real cr: Math.cos(0.30 * Math.sin(win.phase(win.t, 216)))
        property real sr: Math.sin(0.30 * Math.sin(win.phase(win.t, 216)))
        property real morph: Math.sin(win.phase(win.t, 120))
        property real twist: win.phase(win.t, 135)
        property real dist: 3.1 + 0.2 * Math.sin(win.phase(win.t, 360))
        property real gain: win.level > 0 ? 0.92 : 0.62
        fragmentShader: "precision highp float;\nvarying highp vec2 qt_TexCoord0;\nuniform lowp float qt_Opacity;\nuniform float cy;\nuniform float sy;\nuniform float cp;\nuniform float sp;\nuniform float cr;\nuniform float sr;\nuniform float morph;\nuniform float twist;\nuniform float dist;\nuniform float gain;\n\nconst float RING = 0.62;\nconst float BOUND = 1.02;\n\n// World to the ring's own space: yaw, then pitch, then roll.\nvec3 toObject(vec3 v) {\n    v = vec3(cr * v.x + sr * v.y, -sr * v.x + cr * v.y, v.z);\n    v = vec3(v.x, cp * v.y + sp * v.z, -sp * v.y + cp * v.z);\n    return vec3(cy * v.x - sy * v.z, v.y, sy * v.x + cy * v.z);\n}\nvec3 toWorld(vec3 v) {\n    v = vec3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);\n    v = vec3(v.x, cp * v.y - sp * v.z, sp * v.y + cp * v.z);\n    return vec3(cr * v.x - sr * v.y, sr * v.x + cr * v.y, v.z);\n}\n\n// The ribbon's cross-section at a point: across it in x, through it in y.\nvec2 section(vec3 p) {\n    float a = atan(p.z, p.x);\n    float bend = RING + 0.05 * morph * sin(2.0 * a + twist);\n    vec2 q = vec2(length(p.xz) - bend, p.y);\n    // Three half turns round the ring: the section is the same turned by\n    // half a turn, so the ribbon meets itself where atan wraps.\n    float w = 1.5 * a + twist;\n    float c = cos(w), s = sin(w);\n    return vec2(c * q.x - s * q.y, s * q.x + c * q.y);\n}\n\nfloat ribbon(vec3 p) {\n    vec2 q = section(p);\n    vec2 extent = vec2(0.25 + 0.05 * morph, 0.035);\n    vec2 d = abs(q) - extent + 0.025;\n    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.025;\n}\n\nvec3 normalAt(vec3 p) {\n    const vec2 k = vec2(1.0, -1.0);\n    const float e = 0.002;\n    return normalize(k.xyy * ribbon(p + k.xyy * e) + k.yyx * ribbon(p + k.yyx * e) +\n                     k.yxy * ribbon(p + k.yxy * e) + k.xxx * ribbon(p + k.xxx * e));\n}\n\nfloat band(float x) { return exp(-x * x); }\n\n// A studio: a long soft light above, a narrow warm one at the left, a\n// faint violet floor; black everywhere else.\nvec3 studio(vec3 r) {\n    vec3 c = vec3(0.72, 0.86, 1.00) * 1.5 * band((r.y - 0.60) * 7.0) * smoothstep(-0.9, 0.2, r.z);\n    c += vec3(0.90, 0.95, 1.00) * 1.1 * band((r.x - 0.32) * 16.0) * smoothstep(-0.1, 0.5, r.z + r.y);\n    c += vec3(1.00, 0.66, 0.36) * 0.75 * band((r.x + 0.80) * 9.0) * smoothstep(-0.2, 0.6, r.y + 0.3);\n    c += vec3(0.25, 0.80, 0.95) * 0.20 * band((r.x - 0.88) * 6.0);\n    c += vec3(0.42, 0.30, 0.80) * 0.08 * (1.0 - smoothstep(-0.9, -0.2, r.y));\n    return c;\n}\n\nvoid main() {\n    vec2 uv = (qt_TexCoord0 * 2.0 - 1.0) * vec2(1.0, -1.0);\n    vec3 ro = vec3(0.0, 0.0, dist);\n    vec3 rd = normalize(vec3(uv * 0.37, -1.0));\n    vec3 col = vec3(0.0);\n\n    // Only rays through the sphere round the ring are marched.\n    float b = dot(ro, rd);\n    float h = b * b - dot(ro, ro) + BOUND * BOUND;\n    if (h > 0.0) {\n        h = sqrt(h);\n        vec3 o = toObject(ro), d = toObject(rd);\n        float t = -b - h, tEnd = -b + h;\n        float nearest = 1.0;\n        bool hit = false;\n        for (int i = 0; i < 64; i++) {\n            float s = ribbon(o + d * t);\n            nearest = min(nearest, s);\n            if (s < 0.0015) { hit = true; break; }\n            t += s * 0.7;\n            if (t > tEnd) break;\n        }\n        if (hit) {\n            vec3 p = o + d * t;\n            vec3 np = normalAt(p);\n            vec3 n = toWorld(np);\n            vec3 v = -rd;\n            float ndv = max(dot(n, v), 0.0);\n            vec3 r = reflect(rd, n);\n            float fres = 0.35 + 0.65 * pow(1.0 - ndv, 5.0);\n            // Titanium: the studio in it, tinted, with fine milling across.\n            vec3 metal = vec3(0.80, 0.82, 0.88);\n            vec2 q = section(p);\n            float mill = 0.93 + 0.07 * sin(q.x * 180.0);\n            col = studio(r) * metal * fres * mill;\n            vec3 key = normalize(vec3(-0.45, 0.75, 0.55));\n            vec3 hv = normalize(key + v);\n            col += vec3(0.85, 0.92, 1.00) * pow(max(dot(n, hv), 0.0), 90.0) * 0.9;\n            col += metal * 0.05 * max(dot(n, key), 0.0);\n            col += vec3(0.20, 0.75, 0.90) * 0.07 * pow(1.0 - ndv, 3.0);\n            // Where the ribbon passes close to itself, less light reaches.\n            float ao = clamp(ribbon(p + np * 0.10) / 0.10, 0.0, 1.0);\n            col *= 0.45 + 0.55 * ao;\n            // The far side of the ring falls away into the dark.\n            col *= mix(0.15, 1.0, 1.0 - smoothstep(dist - 0.7, dist + 0.9, t));\n        } else {\n            // A trace of light just off the edge.\n            col = vec3(0.20, 0.55, 0.75) * 0.025 * exp(-nearest * 90.0);\n        }\n    }\n    col = 1.0 - exp(-col * 2.0);\n    col = pow(col * gain, vec3(0.70));\n    gl_FragColor = vec4(col, 1.0) * qt_Opacity;\n}"
    }

    ShaderEffectSource {
        id: frame
        sourceItem: ring
        hideSource: true
        live: false
        textureSize: Qt.size(480, 480)
    }

    ShaderEffect {
        width: 640
        height: 640
        x: 640 + 90 * Math.sin(win.phase(win.t, 600))
        y: 220 + 45 * Math.sin(win.phase(win.t, 450) + 1.0)
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
