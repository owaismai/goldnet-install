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

## Notes
- Photos live only on the phone (IndexedDB) for the current form session; they are NOT sent with the WhatsApp
  message. Permanent photo storage needs a backend/storage service (future version).
- Text fields are kept in localStorage so an accidental refresh does not lose the form.
- Data Matrix: listed in the decoder formats but zxing-js support is limited; 1D (Code 128/39, EAN, UPC) and QR are the tested path.
