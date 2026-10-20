/*
 * Geomagnetic mesh screen saver, after Attila Kőszeghy's "The Geomagnetic
 * Poles Will Not Swap Places" (T4Terv, 2021): the mesh of texture elements
 * round an observation site, fading with the inverse square of distance;
 * the triad to the three nearest intersections and its summed vector; the
 * rampart of Goseck with its three gates; the degree ring of the
 * transmission circle diagram. As the mesh is squeezed north-south the
 * summed vector swings south and back, while north on the ring stays put.
 *
 * geomesh.js has the figure and every colour and width, so this file only
 * lays it out. A mesh line is a Rectangle laid along it whose vertical
 * gradient carries the fade, over a wider faint one for its glow; the rest
 * are plain Rectangles. All of it is drawn by the scene graph with no
 * shader, since on a C3 (webOS 10.2.2) no ShaderEffect compiles in the screen
 * saver runner. The ring and the rampart's segments are placed once; only
 * their brightness and the figure's position change.
 *
 * Kind to the panel: the background is black, the mesh and the vectors move
 * all the time, and the whole figure drifts gently about the middle.
 */
import QtQuick 2.4
import Eos.Window 0.1
import "geomesh.js" as Geomesh

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
        from: 0; to: Geomesh.CYCLE
        duration: Geomesh.CYCLE * 1000
        loops: Animation.Infinite
    }

    property var geo: Geomesh.frame(win.t)

    function tint(rgb, alpha) {
        return Qt.rgba(rgb[0] * win.gain, rgb[1] * win.gain, rgb[2] * win.gain, alpha);
    }

    // Everything is placed from the observation site, at the middle.
    Item {
        id: figure
        x: win.width / 2 + win.geo.driftX * win.unit
        y: win.height / 2 + win.geo.driftY * win.unit
        scale: win.unit

        // The degree ring, north at the top. It does not turn.
        Repeater {
            model: Geomesh.RING.length
            Item {
                property var tick: Geomesh.RING[index]
                x: tick.x1
                y: tick.y1
                rotation: Math.atan2(tick.y2 - tick.y1, tick.x2 - tick.x1) * 180 / Math.PI
                transformOrigin: Item.TopLeft
                Rectangle {
                    x: 0
                    y: -0.75
                    width: Math.sqrt(Math.pow(parent.tick.x2 - parent.tick.x1, 2) + Math.pow(parent.tick.y2 - parent.tick.y1, 2))
                    height: 1.5
                    antialiasing: true
                    color: win.tint(Geomesh.RING_RGB, parent.tick.alpha)
                }
            }
        }

        // The rampart, a segment each 5 degrees, the gates open.
        Repeater {
            model: Geomesh.RAMPART_SEGMENTS
            Item {
                property real mid: (index + 0.5) / Geomesh.RAMPART_SEGMENTS * 2 * Math.PI
                x: Math.sin(mid) * Geomesh.RAMPART
                y: -Math.cos(mid) * Geomesh.RAMPART
                rotation: mid * 180 / Math.PI
                Rectangle {
                    x: -width / 2
                    y: -height / 2
                    width: 2 * Math.PI * Geomesh.RAMPART / Geomesh.RAMPART_SEGMENTS * 0.86
                    height: 3
                    radius: 1.5
                    antialiasing: true
                    color: win.tint(Geomesh.RAMPART_RGB, 0.40 * win.geo.rampart[index])
                }
            }
        }

        // The mesh: each line fades by the inverse square of distance from
        // the observer, along a vertical gradient laid along the line.
        Repeater {
            model: Geomesh.LINE_COUNT
            Item {
                id: meshLine
                property var line: win.geo.lines[index]
                property real dx: line.x2 - line.x1
                property real dy: line.y2 - line.y1
                property real length: Math.sqrt(dx * dx + dy * dy)
                x: line.x1
                y: line.y1
                rotation: Math.atan2(dy, dx) * 180 / Math.PI - 90
                transformOrigin: Item.TopLeft
                visible: length > 0

                Gradient {
                    id: fade
                    GradientStop { position: 0 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[0]) }
                    GradientStop { position: 1 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[1]) }
                    GradientStop { position: 2 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[2]) }
                    GradientStop { position: 3 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[3]) }
                    GradientStop { position: 4 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[4]) }
                    GradientStop { position: 5 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[5]) }
                    GradientStop { position: 6 / 6; color: win.tint(Geomesh.MESH_RGB, meshLine.line.alphas[6]) }
                }
                Rectangle {
                    x: -5
                    width: 10
                    height: meshLine.length
                    opacity: 0.16
                    gradient: fade
                }
                Rectangle {
                    x: -0.8
                    width: 1.6
                    height: meshLine.length
                    antialiasing: true
                    gradient: fade
                }
            }
        }

        // The triad's arms and the summed vector with its arrowhead.
        Repeater {
            model: Geomesh.STROKE_COUNT
            Item {
                property var stroke: win.geo.strokes[index]
                property real dx: stroke.x2 - stroke.x1
                property real dy: stroke.y2 - stroke.y1
                property real length: Math.sqrt(dx * dx + dy * dy)
                x: stroke.x1
                y: stroke.y1
                rotation: Math.atan2(dy, dx) * 180 / Math.PI
                transformOrigin: Item.TopLeft

                Rectangle {
                    x: -parent.stroke.glow / 2
                    y: -parent.stroke.glow / 2
                    width: parent.length + parent.stroke.glow
                    height: parent.stroke.glow
                    radius: height / 2
                    antialiasing: true
                    color: win.tint(parent.stroke.rgb, parent.stroke.glowAlpha)
                }
                Rectangle {
                    x: -parent.stroke.core / 2
                    y: -parent.stroke.core / 2
                    width: parent.length + parent.stroke.core
                    height: parent.stroke.core
                    radius: height / 2
                    antialiasing: true
                    color: win.tint(parent.stroke.rgb, parent.stroke.alpha)
                }
            }
        }

        // The observer and the three intersections nearest it.
        Repeater {
            model: Geomesh.DOT_COUNT
            Item {
                property var spot: win.geo.dots[index]
                x: spot.x
                y: spot.y
                Rectangle {
                    x: -width / 2
                    y: -height / 2
                    width: parent.spot.halo
                    height: width
                    radius: width / 2
                    antialiasing: true
                    color: win.tint(parent.spot.rgb, parent.spot.haloAlpha)
                }
                Rectangle {
                    x: -width / 2
                    y: -height / 2
                    width: parent.spot.dot
                    height: width
                    radius: width / 2
                    antialiasing: true
                    color: win.tint(parent.spot.rgb, parent.spot.dotAlpha)
                }
            }
        }
    }
}
