# Condo Notice Board — CLAUDE.md

## Project Overview
Digital signage system for condominium buildings. Deployed at **https://condo-notice-board.web.app**. Shows notices, weather, news, contacts on a TV display (Hisense 4K) connected to a Raspberry Pi 4 running Chromium in kiosk mode.

**Owner:** Vino (Stoney Creek Property Maintenance Inc.)
**Building:** Waterview Condominium, Grimsby ON (managed by CPO Property Management)
**GitHub:** https://github.com/vinobaje/condo-display

---

## Firebase Project
- **Project ID:** `condo-notice-board`
- **Project Number:** `874615845455`
- **Region:** northamerica-northeast1
- **Hosting URL:** https://condo-notice-board.web.app
- **Firebase API Key:** `AIzaSyBmamgeL3fugc7jhnQ_DY7zUNF0eXbUz6Q`

### Firestore Collections
- `settings/main` — All display settings (single document)
- `notices/{id}` — Individual notice documents

### Storage
- `uploads/` — Notice media (images, videos, PDFs)
- `logos/` — Building logo files

---

## File Structure
```
public/
├── index.html          (727 lines) — TV DISPLAY page (fullscreen kiosk)
├── admin.html         (1290 lines) — Admin dashboard (notices, settings, layout)
├── notice.html        (1577 lines) — Notice creator/editor + AI poster designer
├── login.html           (89 lines) — Firebase Auth login
├── js/
│   ├── app.js          (497 lines) — Firebase core module (all exports)
│   └── firebase-config.js          — Firebase config + RSS2JSON key
├── css/
│   └── style.css       (238 lines) — Admin panel styles
└── sw.js                            — Service worker for display caching
functions/
├── index.js                         — RSS CORS proxy Cloud Function (NOT deployed yet)
└── package.json
firebase.json                        — Hosting + Firestore + Storage config
firestore.rules
storage.rules
```

---

## Key Architecture Decisions

### All-in-one HTML files
Each page is a self-contained HTML file with inline `<style>` and `<script type="module">`. No build system, no bundler. Firebase SDK loaded from CDN ESM imports.

### Firebase SDK (ESM from CDN)
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
```
All Firebase operations go through `js/app.js` which exports functions used by all pages.

### Real-time sync
Display page (`index.html`) uses `onSettingsChange()` and `onNoticesChange()` — Firestore `onSnapshot` listeners. Changes in admin appear on the TV instantly.

### No server needed
Everything runs client-side. RSS feeds proxied through Cloudflare Worker at `https://rss-proxy.vino-a6a.workers.dev/`.

---

## Pages

### index.html — TV Display
- Full-screen kiosk display for Raspberry Pi/TV
- 12-column × 8-row CSS Grid layout system
- Widget-based: notices (slideshow), notice_list, news, emergency_contacts, weather, clock
- Themes: `dark-modern`, `light-classic`, `warm-luxury`, `corporate-navy`, `nature-green`, `waterview-classic`
- `waterview-classic` theme: hides the standard header, uses a bottom bar with logo + clock + ticker
- Font size overrides: pixel-based (`fs_header_px`, `fs_notice_px`, etc.) — 0 = auto/responsive
- Display zoom: CSS transform scale (1.0–1.5) for different TV sizes
- Logo size: separate slider (60%–200%)
- News ticker at bottom with scrolling headlines
- Expired notice filtering via `setInterval` every 5 minutes
- Service worker caching with admin-triggered cache clear

### admin.html — Admin Dashboard
- 3 tabs: Notices, Settings, Layout
- **Import Schedule** (Notices tab): upload any yearly service schedule (docx via mammoth.js CDN, PDF/photo via Gemini multimodal, or pasted text) → Gemini extracts every date + writes a notice template → bulk-creates one pre-scheduled notice per date (start_date = N days before, end_date = service date, default N=7), optionally with an AI-generated poster each (media_only). Imported notices carry `auto_delete: true` and are deleted (media included) by the admin expiry sweep after their date passes; regular notices are only set inactive
- Expired-notice sweep runs on notice load + every 5 min while admin is open
- Super Admin system: `super_admin_emails` field in Firestore (comma-separated)
  - First user auto-becomes super admin (bootstrap)
  - Regular admins see: Notices, Layout, Building Info, Display toggles, widgets, theme, ticker
  - Super Admin only: Font size sliders, Cache controls, AI API keys, Weather coords, Super Admin management
- Layout editor: drag-and-drop widget placement on 12×8 grid
- 7 preset layout templates
- Purple accent (#7c6af0) admin UI with Plus Jakarta Sans font

### notice.html — Notice Creator + AI Poster Designer
- Create/edit notices with title, body, category, priority, media upload, date scheduling
- **AI text generation:** "Write with AI" button generates notice text
- **AI poster designer:** "Design Poster" button generates structured poster data
  - Two layout modes: 📋 Detailed (multi-section text) and 🎨 Visual/Bold (billboard-style)
  - 4 base styles: Bold, Corporate, Minimal, Dark
  - 9 visual-only styles: Teal, Sunset, Purple Pop, Forest, Neon, Glass, Diagonal, Luxury, Deep Ocean
  - Each visual style has unique decorative elements (glow effects, glass panels, diagonal cuts, gold borders, wave patterns)
  - **Photo layouts:** When a stock photo is selected, each style triggers a different layout:
    - Split Panel (Teal/Sunset/Purple Pop) — colored panel left + photo right
    - Side Stripe (Neon/Glass) — full photo + dark gradient fade with text overlay
    - Magazine (Diagonal/Luxury) — photo with angled color block overlay
    - Bottom Banner (Ocean/Forest) — full photo + colored banner bar at bottom
    - Centered Hero (Bold/Corporate/Minimal/Dark) — enhanced centered overlay
  - **Image sources:**
    - 🚫 No Image / ✨ Icons Only (20 built-in SVG illustrations)
    - 📤 Upload Photo
    - 📷 Stock Photos (Pixabay API)
    - 🎨 Illustrations (built-in SVG library: garage, fire, elevator, water, pool, etc.)
    - 🤖 AI Generate (Gemini image generation — creates entire poster as an image; if a photo is selected via Upload/Stock first, it is attached to the request and Gemini features the real photo prominently in the poster, unaltered)
  - Auto-fetches stock photo on "Design Poster" click if Pixabay key is set
  - html2canvas for converting poster to PNG → uploaded as notice media

---

## API Keys & External Services

### Stored in Firestore (`settings/main`)
| Field | Service | Notes |
|-------|---------|-------|
| `gemini_api_key` | Google Gemini AI | Text gen: `gemini-2.5-flash-lite`, Image gen: `gemini-2.5-flash-image` |
| `pixabay_api_key` | Pixabay Stock Photos | Key: `55018669-e5f1692a43606a5b4f7fabec3` |
| `groq_api_key` | Groq (alternative AI) | Optional |
| `openai_api_key` | OpenAI (alternative AI) | Optional |
| `deepseek_api_key` | DeepSeek (alternative AI) | Optional |

### AI Models Used
- **Text generation:** `gemini-2.5-flash-lite` (via `v1beta` REST API)
- **Image generation:** `gemini-3-pro-image` (best text rendering), auto-fallback to `gemini-3.1-flash-image` then `gemini-2.5-flash-image` on API error
  - Uses `responseModalities: ['TEXT', 'IMAGE']` and `imageConfig: { aspectRatio: '16:9' }`
- **Available on this account (July 2026):** gemini-2.5-flash-image, gemini-3-pro-image, gemini-3.1-flash-image, gemini-3.1-flash-lite-image, imagen-4.0-generate-001 / -ultra / -fast (predict API)

### RSS News
- Proxied through Cloudflare Worker: `https://rss-proxy.vino-a6a.workers.dev/?url=...`
- Current feeds: CBC News (`https://www.cbc.ca/webfeed/rss/rss-topstories`), CHCH Local (`https://www.chch.com/news-categories/local/`)
- CHCH uses HTML scraping (no images in their RSS feed), CBC uses standard RSS parsing
- `parseFeed()` in app.js: tries RSS/Atom XML first, falls back to HTML article scraping
- `fetchNewsByFeed()` groups items by feed source for sidebar display

### Weather
- Open-Meteo API (free, no key needed)
- Current location: Grimsby ON (43.194, -79.561), Metric units
- Geocoding via Open-Meteo geocoding API

---

## Firestore Settings Schema (`settings/main`)

### Core Display
```
building_name, management_company, logo_url, logo_size (60-200%)
display_theme: 'dark-modern'|'light-classic'|'warm-luxury'|'corporate-navy'|'nature-green'|'waterview-classic'
display_zoom: '1'|'1.1'|'1.25'|'1.4'|'1.5'
slide_duration (seconds), video_slide_duration (0=full), transition_speed
show_clock, show_weather, show_news
```

### Font Size (pixel-based, 0 = auto)
```
fs_header_px (0-72), fs_notice_px (0-40), fs_news_px (0-30)
fs_contacts_px (0-26), fs_ticker_px (0-30)
```
**Important:** Old percentage fields (`fs_header`, `fs_notice`, etc.) may still exist in Firestore from earlier versions. The display page now only reads `_px` fields. Set all to 0 for auto-responsive sizing.

### Layout
```
layout: [{ id: 'notices', x: 0, y: 0, w: 8, h: 8 }, ...]
```
12-column × 8-row grid. Widget IDs: `notices`, `notice_list`, `news_0`, `news_1`, `emergency_contacts`, `weather`, `clock`

### Weather & News
```
weather_location, weather_lat, weather_lon, weather_units ('metric'|'imperial')
news_feeds: [{ name: 'CBC', url: '...' }], news_max_items, smart_news
show_emergency_contacts, show_notice_list, show_news_sidebar
```

### Ticker
```
show_ticker, ticker_mode ('news'|'custom'), ticker_messages: ['msg1', 'msg2']
```

### Emergency
```
emergency_mode (bool), emergency_message (string)
emergency_contacts: [{ label: 'Property Manager', number: '905-296-0420' }]
```

### Super Admin
```
super_admin_emails: 'email1@gmail.com,email2@gmail.com'
```

### AI
```
ai_provider: 'gemini'|'groq'|'openai'|'deepseek'
gemini_api_key, groq_api_key, openai_api_key, deepseek_api_key, pixabay_api_key
```

### Cache
```
cache_version: (integer, incremented to trigger SW cache clear on displays)
```

---

## Notice Schema (Firestore `notices/{id}`)
```javascript
{
  id: 'abc12345',           // 8-char random
  title: 'Notice Title',
  body: 'Full text...',
  category: 'general',      // general|maintenance|safety|event|rules|financial|parking|amenities
  priority: 0,              // 0=normal, 1=important, 2=urgent
  display_mode: 'text',     // 'text'|'media_only'|'media_with_text'
  media_url: 'https://...',
  media_path: 'uploads/abc_123.png',
  file_type: 'image',       // 'image'|'video'|'pdf'|null
  start_date: '2026-03-17',
  end_date: '2026-03-22',
  active: true,
  created_at: '2026-03-17T...',
  updated_at: '2026-03-17T...',
}
```

---

## Raspberry Pi Kiosk (noticeboardpi.local)
- Raspberry Pi 4, Wayland/labwc compositor
- SD card master image v2 created
- Chromium kiosk mode pointing to https://condo-notice-board.web.app
- `unclutter -idle 0.1 -root &` for cursor hiding
- Hisense 4K TV (3840×2160) with display zoom 1.25

---

## Deploy Workflow

### Standard deploy (hosting only — most common):
```bash
cd ~/Downloads/condo-notice-board-firebase
firebase deploy --only hosting
```

### Full deploy:
```bash
firebase deploy
```

### Git push:
```bash
cd ~/Downloads/condo-notice-board-firebase
git add .
git commit -m "description"
git push -u origin main --force
```

### After fresh clone/download:
The `.firebaserc` file contains the project binding. No `npm install` needed for hosting — it's all static files.

---

## Known Issues & Gotchas

1. **Service Worker caching:** After deploy, the Pi/TV may still show old code. Either wait for SW to update, or SSH to Pi and `pkill chromium` (auto-restarts). On browser, use Cmd+Shift+R.

2. **Firestore stale data:** Old font slider percentage values (`fs_header: 100`, `fs_notice: 86`, etc.) may still exist in Firestore. The display page now ignores these and only reads `_px` fields. If the display looks wrong, go to Admin → Settings → reset font sliders to 0 (Auto).

3. **Layout empty:** If the widget grid shows 0 children, the `layout` field in Firestore may be empty or malformed. Fix: Admin → Layout tab → select any template → Save.

4. **Gemini model names change frequently.** Google deprecates models every few months. If AI features fail, check available models:
   ```
   fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY`)
   ```
   Current working models (March 2026): `gemini-2.5-flash-lite` (text), `gemini-2.5-flash-image` (images)

5. **html2canvas + CORS:** Stock photos from Pixabay are pre-fetched as blob URLs to avoid CORS issues when converting poster to PNG. Always use blob URLs, not direct image URLs.

6. **innerHTML += destroys onclick handlers.** Use `appendChild()` instead. This was a major bug source in the stock photo grid.

7. **Cloud Functions not deployed yet.** The `functions/` directory has an RSS CORS proxy ready to deploy, but requires Blaze plan. Currently using Cloudflare Worker instead. Don't add function rewrites to `firebase.json` hosting config unless the function is deployed first — it will block hosting deployment.

8. **Two Firebase projects for Condo Super app:** The `condo-super` project hosts the marketing website, and `condo-super-app-web` has the Cloud Functions. NEVER deploy functions to `condo-super` — it will overwrite the iOS app's functions. This Notice Board project (`condo-notice-board`) is completely separate.

---

## Current Waterview Condominium Settings
- Logo: 200%, Display zoom: 1.25, Theme: light-classic (Waterview Classic)
- Weather: Grimsby ON (43.194, -79.561), Metric
- Contacts: Property Manager (905-296-0420), Concierge (437-221-9795), Police/Fire/Ambulance (911), Police Non-Emergency (905-945-2211)
- RSS: CBC News, CHCH Local News
- Font sizes: all set to 0 (Auto) — use Display Zoom for overall scaling
