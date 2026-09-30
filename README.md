# GOLDNET Installation Form (static PWA)

Mobile-first technician form: React + TypeScript + Vite + Tailwind + PWA, barcode scanning with `@zxing/browser`.
No backend: it is a fully static site (GitHub Pages). Submitting opens WhatsApp with the message pre-filled
(click-to-chat to `27689197093`); the technician presses Send.

Part of the GOLDNET tools. Modelled on the WhatsForm "Osama Customer Details" form (https://whatsform.com/g8ztfa): same fields, wording and
required/optional flags. The two "Last 4 digits of serial" fields are replaced by scan barcode -> photo for CPE and Router.

## Commands
    npm install
    npm run dev        # http://localhost:5173 (camera needs https or localhost)
    npm run build      # typecheck + production build in dist/
    npm run preview
    npm test           # message / URL-encoding / validation tests

## Configuration
| Setting | Where | Default |
|---|---|---|
| WhatsApp number (digits, no `+`) | `VITE_WHATSAPP_NUMBER` (env / repo variable) | `27689197093` |
| Served path | `BASE_PATH` (env / repo variable) | `/` locally, `/<repo>/` in the workflow |

The number is baked into the public bundle: it is **not secret**.

## Address autofill (Google Maps)
- **Use my current location** always works: phone GPS + OpenStreetMap reverse geocoding (no key). It also adds a
  Google Maps pin link to the WhatsApp message.
- **Google address search while typing** needs a Google Maps key (the app ships with it switched off):
  1. console.cloud.google.com: create/select a project and attach a billing account (Google's monthly free credit
     covers this usage).
  2. APIs & Services > Library: enable **Maps JavaScript API** and **Places API (New)**.
  3. APIs & Services > Credentials > Create credentials > API key. Restrict it: *Websites*
     `https://owaismai.github.io/*` and *API restrictions* = those two APIs only. (The key is public in the
     site's code by design; the restrictions are what protect it.)
  4. GitHub repo > Settings > Secrets and variables > Actions > **Variables** > new variable
     `VITE_GOOGLE_MAPS_API_KEY` = the key. Re-run the "Deploy to GitHub Pages" workflow.

## Technicians
The Technician dropdown (required, remembered on the phone) is the `TECHNICIANS` list in `src/types.ts`.

## Notes
- Photos live only on the phone (IndexedDB) for the current form session; they are NOT sent with the WhatsApp
  message. Permanent photo storage needs a backend/storage service (future version).
- Text fields are kept in localStorage so an accidental refresh does not lose the form.
- Barcode engine: Android Chrome uses the phone's own Barcode Detection API (Google ML Kit); every other browser
  uses zxing-cpp compiled to WebAssembly (`barcode-detector` + `zxing-wasm`), bundled in the app (works offline).
  Formats: Code 128/39/93, Codabar, EAN, UPC, ITF, QR, Data Matrix, PDF417, Aztec.
- Focus for small barcodes: continuous autofocus is requested, other rear cameras are tried if the default lens has
  no autofocus, tap the picture to refocus, zoom 1-5x and torch appear when the phone allows it (iPhone Safari
  exposes no focus/zoom controls, so they are hidden there), and "Scan from photo" reads the barcode from a photo
  taken with the phone's camera app. The live preview is low resolution, so on Android the scanner also grabs
  high-resolution stills (ImageCapture, which runs a real autofocus) after ~2.5 s without a read, asks for a 4K
  preview, and offers manual Close/Mid focus presets. A small grey line under the scanner shows the camera's
  capabilities, useful when reporting a problem.
- Photos: a wa.me link can carry only text, so after the message opens, the photos are sent through the phone's
  share sheet (Web Share API with files) into the same WhatsApp chat. Browsers without file sharing get Save links.
