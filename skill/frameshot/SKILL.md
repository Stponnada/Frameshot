---
name: frameshot
description: Turn a 3D model (.glb, .gltf, .obj, .stl or .fbx) into product stills and a short MP4 ad with camera moves, lighting and large text captions. Use when the user wants product shots, a hero image, a turntable, a teaser or an ad video made from a 3D model file.
---

# Frameshot

Frameshot renders a 3D model as a sequence of framed shots. Each shot has its own camera, lighting and captions. You describe the sequence as JSON, render stills to check it, then render the video.

Repository: https://github.com/Stponnada/Frameshot

## Setup (once)

```bash
git clone https://github.com/Stponnada/Frameshot.git
cd Frameshot
npm install
npx playwright install chromium   # skip if Google Chrome is installed
```

Requirements: Node 18 or later, and internet access (three.js and the video writer load from cdn.jsdelivr.net).

If the repository is already on disk, use it. Run every command from its root.

## Workflow

1. **Get the facts.** Ask the user for the product name and the claims they want on screen. Never invent specifications, numbers or claims. If the user gives none, use the product name and neutral lines, or no captions.
2. **Describe the model.**
   ```bash
   node tools/frameshot.mjs describe path/to/model.glb
   ```
   This prints the model's size, centre and suggested camera distances (`closeUp`, `medium`, `wide`), plus mesh and material names that hint at what the parts are.
3. **Write a shot list** (`shots.json`, format below). Start from `examples/shots.example.json`.
4. **Render stills and look at every one.**
   ```bash
   node tools/frameshot.mjs stills shots.json --out out
   ```
   Open each `out/still-NN.png` and check it against the checklist below. Fix the shot list and repeat until every still passes.
5. **Render the video.**
   ```bash
   node tools/frameshot.mjs render shots.json --out out --no-stills
   ```
   The result is `out/<videoName>` (default `sequence.mp4`). Report its path, length and size to the user.

Every command prints one JSON object. On failure it prints `{ "ok": false, "error": "…" }`. The error says what went wrong and how to fix it.

## Shot list format

```json
{
  "model": "models/product.glb",
  "frame": "landscape",
  "background": "#000",
  "output": { "dir": "out", "videoName": "ad.mp4", "longEdge": 1920, "stillScale": 1 },
  "views": [
    {
      "caption": "Reveal",
      "orbit": { "azimuth": 0, "elevation": 8, "distance": 16 },
      "light": { "exposure": 0.9, "keyIntensity": 5, "keyAzimuth": 150, "keyElevation": 40, "rimIntensity": 3, "ambient": 0.05 },
      "title": { "left": "Meet", "right": "the", "bottom": "Product" },
      "hold": 2.5
    }
  ]
}
```

- `model`: path relative to the shot list file.
- `frame`: `landscape` (16:9), `portrait` (9:16, for Reels, Shorts and TikTok), `square` (1:1), or `{ "width": …, "height": … }`.
- `output.longEdge`: video size along its long side, in pixels. Use 960 for fast drafts.
- `views`: the shots, in order. Full field reference: [reference.md](reference.md).

## Camera

Place the camera with `orbit`:

- `azimuth`: degrees around the model. 0 = front, 90 = right side, 180 = back, -90 = left side. This assumes the model faces +Z, the glTF convention. If a still shows the wrong side, add 180.
- `elevation`: degrees above level. 0 = eye level, 30 = looking down, negative = looking up from below (heroic).
- `distance`: world units from the target. Use the `distances` from `describe`. In `portrait` and `square` frames, multiply by about 1.5.
- `target`: the point to look at, `[x, y, z]`. Defaults to the model's centre. Move it to frame a detail. The model rests on the ground (y = 0) and its longest side is 10 units.

You can give `pos` and `target` directly instead of `orbit`.

## Lighting

| Setting | Range | What it does |
| --- | --- | --- |
| `exposure` | 0.2–2.5 | Overall brightness. |
| `keyIntensity` | 0–6 | Main light strength. |
| `keyAzimuth` | -180–180 | Main light direction, same convention as the camera. |
| `keyElevation` | 0–90 | Main light height. Low = long shadows and texture. |
| `rimIntensity` | 0–5 | Light from behind that outlines edges. |
| `ambient` | 0–1 | Shadow fill. 0 = black shadows. |

Starting points:

- **Dramatic, premium:** `ambient` 0–0.1, `rimIntensity` 3–5, key from the side or behind (`keyAzimuth` 120–160 or -120 to -160).
- **Clean, technical:** `ambient` 0.3–0.5, `exposure` 1.2–1.6, key in front and above (`keyAzimuth` near the camera's azimuth, `keyElevation` 45–70).
- **Silhouette or teaser:** `exposure` 0.3–0.6, `keyIntensity` under 1, `rimIntensity` 3–5.

## Captions

`title` places large white text. Positions:

| Position | Use |
| --- | --- |
| `top`, `bottom` | One or two huge words, such as the product name. |
| `left`, `right` | One short word each, at mid-height. Behind the model by default, so the model passes in front of them. |
| `statement` | One sentence along the bottom. |
| `statementTop` + `statementBottom` | A sentence split above and below the model. |
| `statementLeft` + `statementRight` | A sentence split either side of the model. |

`titleLayer` sets per position whether the text is in front of the model (`true`) or behind it (`false`). `titlePos` moves a position to `{ "x": %, "y": % }` of the frame.

## Pacing

- `hold`: seconds on the shot after the camera arrives. Default 3. Allow about 1 second plus 1 second per 3 words of caption.
- `move`: seconds for the camera to travel into the shot. Default 0.67. Use 1–2 for smooth, slow moves and 0 for a hard cut.
- A 15-second ad is usually 4–6 shots. A 30-second ad is 7–10.

## Directing an ad

- Open on a strong silhouette or a partial reveal, and say the product name by the second shot.
- Give one idea per shot: one caption, one feature, one angle.
- Change at least two of azimuth, elevation and distance between consecutive shots, so every move reads as motion.
- Alternate wide and close shots. Use close shots for the parts named in the captions.
- Keep captions to 8 words or fewer, in sentence case, as plain statements. A number with a unit beats an adjective.
- End on a wide hero shot with the product name, held 3–4 seconds.
- Keep lighting consistent within the ad unless a change is the point (for example, a dark teaser cutting to a bright reveal).

## Still checklist

Check every still before rendering the video:

- The subject fills a good share of the frame and isn't cut off at an edge, unless that's a deliberate detail crop.
- No caption overlaps the model, unless it's a `left`/`right` word deliberately behind it. If text collides, move the camera (change `distance`, `elevation` or `target`), or use another caption position.
- No caption runs off the frame or wraps awkwardly. Shorten it.
- The intended side of the model is facing the camera.
- The model is lit well enough to read its shape: not a black blob, not washed out.

## Other ways to drive Frameshot

- **In a browser.** Open the tool's page (`python3 -m http.server 8137` in the repository, then http://localhost:8137/?fresh) and call the `window.frameshot` API from page scripts. Run `frameshot.help()` for the method list. See [reference.md](reference.md).
- **Views from the UI.** A views file exported from the tool's Author panel works as a shot list: `node tools/frameshot.mjs render views.json --model model.glb`.

## Limits

- Videos have no audio. Add music or voice-over in an editor afterwards.
- Captions are white, bold and in one typeface. There is no colour, logo or image overlay.
- The background is a solid colour.
- On a machine without a GPU, set `FRAMESHOT_SOFTWARE_GL=1`. Rendering is then much slower.
