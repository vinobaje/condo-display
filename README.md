# Condo Notice Board — Firebase Edition

A digital notice board for condominium buildings. Deploy once to Firebase, manage from any device, display on any screen.

## Architecture

- **Firebase Hosting** → Serves display + admin pages
- **Cloud Firestore** → Stores notices and settings (real-time sync)
- **Firebase Storage** → Stores uploaded images/videos
- **Firebase Auth** → Admin login
- **Open-Meteo API** → Free weather data (no API key needed)
- **rss2json.com** → RSS feed proxy (free tier: 100 req/day, with key: 10,000/day)

No server needed. Everything runs client-side.

## Quick Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → Name it (e.g., `condo-notice-board`)
3. Disable Google Analytics (not needed) → Create

### 2. Enable Services

In the Firebase Console:

**Authentication:**
- Go to **Authentication** → **Get started**
- Enable **Email/Password** provider
- Go to **Users** tab → **Add user**
- Enter your admin email and password

**Firestore:**
- Go to **Firestore Database** → **Create database**
- Choose **Start in production mode**
- Select nearest region (e.g., `northamerica-northeast1` for Canada)

**Storage:**
- Go to **Storage** → **Get started**
- Accept default rules for now (we'll deploy proper rules)

### 3. Get Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Under **Your apps**, click **Web** (`</>`)
3. Register app (name: `notice-board`)
4. Copy the `firebaseConfig` object

### 4. Configure the App

Edit `public/js/firebase-config.js` and paste your config values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 5. Deploy

Install Firebase CLI and deploy:

```bash
npm install -g firebase-tools
firebase login
firebase init
# Select: Hosting, Firestore, Storage
# Use existing project → select yours
# Public directory: public
# Single-page app: No
# DON'T overwrite existing files

firebase deploy
```

### 6. Access

After deploy:
- **Display:** `https://your-project.web.app` (open on TV/Raspberry Pi)
- **Admin:** `https://your-project.web.app/admin.html` (open on phone/laptop)
- **Login:** `https://your-project.web.app/login.html`

## Features

### Notices
- 8 categories (General, Maintenance, Safety, Event, Rules, Financial, Parking, Amenities)
- 3 priority levels with visual styling
- Image/video upload (stored in Firebase Storage)
- 3 display modes: Media+Text, Media Only, Text Only
- Date scheduling (start/end dates)
- Real-time sync — changes appear on TV instantly

### Widgets
- **Weather** — City/postal code lookup, 3-day forecast
- **News** — RSS feeds with images, ticker + sidebar slideshow
- **Emergency Contacts** — Configurable contact list
- **Clock** — Date and time

### Emergency Mode
- One-click activation from admin
- Full-screen emergency message on all displays
- Real-time — activates instantly via Firestore

## Raspberry Pi Kiosk (for the TV)

On a Raspberry Pi, open the display URL in Chromium kiosk mode:

```bash
# Install Chromium if needed
sudo apt-get install chromium-browser unclutter

# Auto-start in kiosk mode (add to ~/.config/lxsession/LXDE-pi/autostart)
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0
@chromium-browser --kiosk --noerrdialogs --disable-infobars https://your-project.web.app
```

## RSS News

The app uses [rss2json.com](https://rss2json.com) as a CORS proxy for RSS feeds.

- **Without API key:** 100 requests/day (fine for one display refreshing every 10 min)
- **With free API key:** 10,000 requests/day (recommended if multiple displays)

To add your key, edit `public/js/firebase-config.js`:
```javascript
const RSS2JSON_API_KEY = "your_key_here";
```

## Multiple Buildings

Deploy separate Firebase projects per building, or use Firestore subcollections to manage multiple buildings from one project. Each TV points to its own display URL.

## Cost

Firebase free tier (Spark plan) covers:
- **Firestore:** 50K reads/day, 20K writes/day
- **Storage:** 5GB, 1GB/day download
- **Hosting:** 10GB/month transfer
- **Auth:** Unlimited users

For a single building notice board, you'll never exceed the free tier.
