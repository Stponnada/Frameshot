# Frameshot

Frameshot sets up camera shots of 3D models in the browser. Open a model, frame a series of shots with their own lighting and text captions, then save any shot as an image or export the whole sequence as an MP4 video.

The whole tool is one HTML file. There is nothing to install and no build step.

## Run it

Serve the folder over HTTP and open it in a browser:

```bash
python3 -m http.server 8137
```

Then go to http://localhost:8137.

The page loads three.js from a CDN, so it needs an internet connection.

## Open a model

Drop a file anywhere on the page, or click **Open model**.

| Format | Notes |
| --- | --- |
| `.glb` | Recommended. Draco, Meshopt and KTX2 compression are supported. |
| `.gltf` | Open it together with its `.bin` and texture files. |
| `.obj` | Geometry only, with a default material. |
| `.stl` | Geometry only, with a default material. |
| `.fbx` | FBX 7.0 (2011) or later, binary or ASCII. |

Every model is centred, placed on the ground and scaled to a standard size, whatever units it was exported in.

To open a model that is served next to the page, add it to the URL: `http://localhost:8137/?model=models/robot.glb`

If a file can't be opened, a panel explains why and how to fix it. For example, it names missing texture files, unsupported glTF extensions or a Git LFS pointer that hasn't been downloaded.

## Build a sequence

1. Click **Author**.
2. Orbit to the shot you want: drag to orbit, right-drag to pan, scroll to zoom.
3. Adjust the lighting with the sliders: exposure, key light strength, angle and height, rim light and shadow fill.
4. Type a name for the view and click **Capture new**. The view is added to the **Views** list.
5. Repeat for each shot. Drag views in the list to reorder them.

To change a view, select it, re-frame it, and click **Update selected**.

### Caption overlay

Each view can show large text captions. Nine fixed positions are available:

- **Top / Bottom:** large words above or below the model.
- **Left / Right:** smaller words at mid-height.
- **Statement:** one sentence along the bottom.
- **Top line / Bottom line:** a sentence split above and below the model.
- **Left line / Right line:** a sentence split to the left and right of the model.

**Front** puts a caption over the model. **Behind** puts it behind, so the model covers it. **Place on stage** lets you drag captions to any position and double-click to edit their text.

### Portrait framing

Click **Phone frame** to preview the stage as a tall phone screen. While the frame is portrait, **Update selected** saves a separate portrait version of the selected view. The landscape version is left unchanged.

## Export

- **Play** runs the sequence in the browser. The camera moves between views, captions fade in, and each view holds for 3 seconds.
- **Take an image** saves the current frame as a PNG at twice the on-screen resolution, with a transparent background. Captions are not included in the image.
- **Export video** renders the sequence to an MP4 file (H.264, 30 fps, no audio). The long edge is 1920 pixels, and the video keeps the stage's shape. Captions are included. Frames are rendered one at a time, so playback is smooth even on a slow machine.

Video export uses the WebCodecs API. It works in recent Chrome, Edge and Safari (16.4 or later).

## Where your work is saved

Everything is stored in your browser. Nothing is uploaded.

- **Views** are saved per model file name. Opening a file with the same name brings its views back.
- **The last model you opened from disk** is reopened when you reload the page.
- **Export / Import** in Author mode moves views between browsers or machines as a JSON file.

Clearing your browser's site data removes all of this.

## Sound (optional)

To add sound to Play, put these files in `audio/`:

| File | Plays |
| --- | --- |
| `bed.mp3` | A looping background track during Play. |
| `whoosh.mp3` | Each camera move. |
| `tick.mp3` | When captions appear. |

The **Sound** button only appears when `bed.mp3` exists. Exported videos have no audio.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | The whole tool: styles, markup and script. |
| `CLAUDE.md` | Architecture notes and design rules for contributors and AI coding assistants. |
| `audio/` | Optional sound files. |

Model files are listed in `.gitignore`, so they stay on your machine.
