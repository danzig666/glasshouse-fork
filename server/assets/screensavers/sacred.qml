/*
 * Sacred geometry screen saver: an icosahedron, its dual dodecahedron and
 * the cube inside that, in fine lines of light, turning together while the
 * dodecahedron breathes between the dual inside the icosahedron and the
 * compound of the two.
 *
 * sacred.js has the figure, and sets each edge's colour, widths and alphas,
 * so this file only lays them out: each edge is a thin rounded Rectangle
 * over a wider faint one for its glow, drawn by the scene graph with no
 * shader, since on a C3 (webOS 10.2.2) no ShaderEffect compiles in the screen
 * saver runner. The icosahedron leads, in ice-blue with a point of light at
 * each corner; the dodecahedron is cyan, the cube a faint amber.
 *
 * Kind to the panel: the background is black, every line moves all the time,
 * and the whole figure drifts gently about the middle of the screen.
 */
import QtQuick 2.4
import Eos.Window 0.1
import "sacred.js" as Sacred

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

    property real unit: win.height / 1080

    // Dim or bright, written in when the screen saver is staged. Dim lowers
    // the colours themselves as well as the alpha.
    property int level: __TVWEB_LEVEL__
    property real gain: level > 0 ? 1.0 : 0.6

    // Seconds, round a six-hour cycle that every period divides.
    property real t: 0
    NumberAnimation on t {
        from: 0; to: Sacred.CYCLE
        duration: Sacred.CYCLE * 1000
        loops: Animation.Infinite
    }

    property var geo: Sacred.frame(win.t)
    property real cx: win.width / 2 + win.geo.driftX * win.unit
    property real cy: win.height / 2 + win.geo.driftY * win.unit

    function tint(rgb, alpha) {
        return Qt.rgba(rgb[0] * win.gain, rgb[1] * win.gain, rgb[2] * win.gain, alpha);
    }

    Repeater {
        model: Sacred.EDGE_COUNT
        Item {
            property var edge: win.geo.edges[index]
            property real dx: (edge.x2 - edge.x1) * win.unit
            property real dy: (edge.y2 - edge.y1) * win.unit
            property real length: Math.sqrt(dx * dx + dy * dy)
            property real core: edge.core * win.unit
            property real glow: edge.glow * win.unit

            x: win.cx + edge.x1 * win.unit
            y: win.cy + edge.y1 * win.unit
            transformOrigin: Item.TopLeft
            rotation: Math.atan2(dy, dx) * 180 / Math.PI

            Rectangle {
                x: -parent.glow / 2
                y: -parent.glow / 2
                width: parent.length + parent.glow
                height: parent.glow
                radius: height / 2
                antialiasing: true
                color: win.tint(parent.edge.rgb, parent.edge.glowAlpha)
            }
            Rectangle {
                x: -parent.core / 2
                y: -parent.core / 2
                width: parent.length + parent.core
                height: parent.core
                radius: height / 2
                antialiasing: true
                color: win.tint(parent.edge.rgb, parent.edge.coreAlpha)
            }
        }
    }

    Repeater {
        model: Sacred.DOT_COUNT
        Item {
            property var spot: win.geo.dots[index]
            x: win.cx + spot.x * win.unit
            y: win.cy + spot.y * win.unit

            Rectangle {
                x: -width / 2
                y: -height / 2
                width: parent.spot.halo * win.unit
                height: width
                radius: width / 2
                antialiasing: true
                color: win.tint(parent.spot.rgb, parent.spot.haloAlpha)
            }
            Rectangle {
                x: -width / 2
                y: -height / 2
                width: parent.spot.dot * win.unit
                height: width
                radius: width / 2
                antialiasing: true
                color: win.tint(parent.spot.rgb, parent.spot.dotAlpha)
            }
        }
    }
}
