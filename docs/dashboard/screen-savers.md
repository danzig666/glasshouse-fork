# Screen savers

The **Screensaver** tab, `/?tab=screensaver`, provides nine alternatives to LG's default:

* Clock
* Starfield
* Fireworks
* Bokeh, soft circles of light drifting in and out
* Harmonograph, pendulum ribbons of light weaving and fading on black
* Tesseract, a four-dimensional cube turning through the fourth dimension, in fine lines of light that dim and turn violet with depth
* Sacred geometry, an icosahedron and its dual dodecahedron turning together, the dodecahedron breathing between sitting inside the icosahedron and crossing it as their compound, with the cube in the dodecahedron
* Geomagnetic mesh, after Attila Kőszeghy's *The Geomagnetic Poles Will Not Swap Places* (T4Terv, 2021): the mesh of geomagnetic effects round an observer, fading with the inverse square of distance, the triad to the three nearest intersections and its summed direction, inside the rampart of Goseck with its three gates and the degree ring of the book's transmission circle diagram. As the mesh is squeezed north-south the summed direction swings south and back, while north on the ring stays put. The ground plane they lie on leans back and swings from side to side in 3D inside the flat ring, north still at the top
* Panel vitals, showing the TV's own panel hours and refresher countdown

Each mode offers dim and bright variants, and visual elements continuously drift across the screen to prevent OLED burn-in or image retention.

A firmware update restores the LG default.

On webOS 10 and later they are experimental: the tab shows a switch above the list that turns them on, after a warning, and until then only LG's default can be chosen. See [Experimental features](../experimental.md) for why.

**Start screen saver** asks the TV for its screen saver. Some TVs accept the request and then refuse it; a G3 on webOS 9.2.2 refused every one, its own idle screen saver included. There the dashboard opens the screen saver itself, unless something is playing full screen or playback cannot be checked. Any key on the remote, including Home and the coloured buttons, or a second press of the button closes it. A failed close leaves it tracked so another press can retry. The TV does not know about a screen saver opened this way: its power state stays On, in the dashboards and in Home Assistant, and watch time counts the app beneath it. The Screen Saver sensor does show it.

![Screensaver tab: LG default, Clock, Starfield, Fireworks, Bokeh and Panel vitals, with brightness and a start button beside them](../screenshots/screensaver.png)

*Built-in screen saver choices, including the panel-vitals display.*

![Starfield screen saver on OLED: drifting stars and meteor with ion trail](../screenshots/screensaver-starfield.png)

*The Starfield screen saver with continuously moving elements.*
