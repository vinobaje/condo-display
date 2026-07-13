// ═══════════════════════════════════════════════════════════
// Condo Notice Board — Firebase Core Module
// ═══════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── Init Firebase ──
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { db };

// ═══ Auth ═══════════════════════════════════════════════════
export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
    return auth.currentUser;
}

// ═══ Settings ═══════════════════════════════════════════════
const DEFAULT_SETTINGS = {
    building_name: 'Waterview Condominium',
    management_company: 'CPO Property Management',
    slide_duration: 12,
    video_slide_duration: 0,
    transition_speed: 1.5,
    show_clock: true,
    show_weather: true,
    show_news: true,
    weather_location: 'Toronto, ON',
    weather_lat: '43.65',
    weather_lon: '-79.38',
    weather_units: 'metric',
    news_feeds: [
        { name: 'CBC News', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories' },
    ],
    news_max_items: 8,
    news_display_mode: 'both',
    emergency_mode: false,
    emergency_message: '',
    logo_url: '',
    show_emergency_contacts: true,
    show_notice_list: true,
    show_news_sidebar: true,
    display_theme: 'dark-modern',
    emergency_contacts: [
        { label: 'Building Manager', number: '416-555-0100' },
        { label: 'Concierge', number: '416-555-0101' },
        { label: 'Fire Department', number: '911' },
        { label: 'Police (Non-Emergency)', number: '416-808-2222' },
        { label: 'Water Emergency', number: '311' },
    ],
};

export async function getSettings() {
    const snap = await getDoc(doc(db, 'settings', 'main'));
    if (snap.exists()) {
        return { ...DEFAULT_SETTINGS, ...snap.data() };
    }
    // First run: create defaults
    await setDoc(doc(db, 'settings', 'main'), DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings) {
    await setDoc(doc(db, 'settings', 'main'), settings, { merge: true });
}

// ═══ Secrets (auth-gated doc — API keys, super-admin list) ═══
const SECRET_FIELDS = ['gemini_api_key', 'groq_api_key', 'openai_api_key', 'deepseek_api_key', 'pixabay_api_key', 'super_admin_emails'];

export async function getSecrets() {
    const snap = await getDoc(doc(db, 'secrets', 'main'));
    return snap.exists() ? snap.data() : {};
}

export async function saveSecrets(secrets) {
    await setDoc(doc(db, 'secrets', 'main'), secrets, { merge: true });
}

// One-time migration: move any secret fields still in the public settings/main
// doc into the auth-gated secrets/main doc, then strip them from main.
export async function migrateSecrets() {
    const mainSnap = await getDoc(doc(db, 'settings', 'main'));
    if (!mainSnap.exists()) return;
    const main = mainSnap.data();
    const found = {};
    for (const f of SECRET_FIELDS) {
        if (main[f] !== undefined) found[f] = main[f];
    }
    if (Object.keys(found).length === 0) return;
    await setDoc(doc(db, 'secrets', 'main'), found, { merge: true });
    const strip = {};
    for (const f of Object.keys(found)) strip[f] = deleteField();
    await updateDoc(doc(db, 'settings', 'main'), strip);
}

export function onSettingsChange(callback) {
    return onSnapshot(doc(db, 'settings', 'main'), (snap) => {
        if (snap.exists()) {
            callback({ ...DEFAULT_SETTINGS, ...snap.data() });
        } else {
            callback({ ...DEFAULT_SETTINGS });
        }
    });
}

// ═══ Notices ════════════════════════════════════════════════
export async function getNotices() {
    const q = query(collection(db, 'notices'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveNotices() {
    const all = await getNotices();
    const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
    return all.filter(n => {
        if (!n.active) return false;
        if (n.start_date && n.start_date > today) return false;
        if (n.end_date && n.end_date < today) return false;
        return true;
    }).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function onNoticesChange(callback) {
    const q = query(collection(db, 'notices'), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => {
        const notices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(notices);
    });
}

export async function createNotice(data) {
    const id = generateId();
    data.id = id;
    data.created_at = new Date().toISOString();
    data.updated_at = new Date().toISOString();
    data.active = true;
    await setDoc(doc(db, 'notices', id), data);
    return id;
}

export async function updateNotice(id, data) {
    data.updated_at = new Date().toISOString();
    await updateDoc(doc(db, 'notices', id), data);
}

export async function deleteNotice(id) {
    // Get notice to find media URL
    const snap = await getDoc(doc(db, 'notices', id));
    if (snap.exists()) {
        const data = snap.data();
        if (data.media_path) {
            try {
                await deleteObject(ref(storage, data.media_path));
            } catch (e) { console.warn('Could not delete media:', e); }
        }
    }
    await deleteDoc(doc(db, 'notices', id));
}

export async function toggleNotice(id) {
    const snap = await getDoc(doc(db, 'notices', id));
    if (snap.exists()) {
        const active = snap.data().active;
        await updateDoc(doc(db, 'notices', id), { active: !active, updated_at: new Date().toISOString() });
    }
}

// ═══ File Upload ════════════════════════════════════════════
export async function uploadMedia(file, folder = 'uploads') {
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = `${folder}/${generateId()}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, path: filename, type: getFileType(file.name) };
}

export async function uploadLogo(file) {
    return uploadMedia(file, 'logos');
}

export async function deleteMedia(path) {
    if (!path) return;
    try {
        await deleteObject(ref(storage, path));
    } catch (e) { console.warn('Delete media error:', e); }
}

// ═══ Weather (Open-Meteo — free, CORS-friendly) ════════════
export async function fetchWeather(settings) {
    const lat = settings.weather_lat || '43.65';
    const lon = settings.weather_lon || '-79.38';
    const units = settings.weather_units || 'metric';
    const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
    const windUnit = units === 'metric' ? 'kmh' : 'mph';

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,weather_code&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=2`;

    const res = await fetch(url);
    const data = await res.json();
    data.location_name = settings.weather_location || 'Toronto, ON';
    return data;
}

// ═══ Geocoding (Open-Meteo) ════════════════════════════════
export async function geocodeLocation(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
        const r = data.results[0];
        return {
            lat: String(r.latitude),
            lon: String(r.longitude),
            name: r.name,
            admin1: r.admin1 || '',
            country: r.country || '',
        };
    }
    return null;
}

// ═══ RSS News (via CORS proxy + XML parsing) ════════════
// ═══ Shared feed parser (auto-detects RSS vs HTML scrape) ═══
async function parseFeed(feed, maxItems) {
    const proxyUrl = `https://rss-proxy.vino-a6a.workers.dev/?url=${encodeURIComponent(feed.url)}`;
    let text = '';
    try {
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) text = await res.text();
    } catch (e) { console.warn('Proxy failed:', e.message); }
    if (!text) return [];
    let feedItems = [];

    // Try RSS/Atom first
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const parseError = xml.querySelector('parsererror');

    if (!parseError) {
        // RSS 2.0
        xml.querySelectorAll('item').forEach(item => {
            const title = item.querySelector('title')?.textContent?.trim() || '';
            const link = item.querySelector('link')?.textContent?.trim() || '';
            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
            const descRaw = item.querySelector('description')?.textContent?.trim() || '';
            const description = stripHtml(descRaw).substring(0, 200);
            let image = '';
            const mediaThumbnail = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0];
            const mediaContent = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
            const enclosure = item.querySelector('enclosure');
            if (mediaThumbnail) image = mediaThumbnail.getAttribute('url') || '';
            else if (mediaContent) image = mediaContent.getAttribute('url') || '';
            else if (enclosure && (enclosure.getAttribute('type') || '').includes('image')) image = enclosure.getAttribute('url') || '';
            if (!image && descRaw) { const m = descRaw.match(/<img[^>]+src=["']([^"']+)["']/); if (m) image = m[1]; }
            if (title) feedItems.push({ title, source: feed.name || 'News', pub_date: pubDate, link, description, image });
        });

        // Atom feeds
        xml.querySelectorAll('entry').forEach(entry => {
            const title = entry.querySelector('title')?.textContent?.trim() || '';
            const linkEl = entry.querySelector('link');
            const link = linkEl?.getAttribute('href') || '';
            const pubDate = entry.querySelector('updated')?.textContent?.trim() || '';
            const descRaw = entry.querySelector('summary')?.textContent?.trim() || '';
            const description = stripHtml(descRaw).substring(0, 200);
            if (title) feedItems.push({ title, source: feed.name || 'News', pub_date: pubDate, link, description, image: '' });
        });
    }

    // Fallback: HTML scrape if no RSS/Atom items found
    if (feedItems.length === 0) {
        const html = parser.parseFromString(text, 'text/html');
        feedItems = scrapeHtmlArticles(html, feed);
    }

    return feedItems.slice(0, maxItems);
}

// ═══ HTML scraper for non-RSS news sites ═══
function scrapeHtmlArticles(doc, feed) {
    const items = [];
    const seen = new Set();

    // Strategy 1: article/li elements with heading + link + image (most news sites)
    doc.querySelectorAll('article, .post, .story, .article-card, .news-item').forEach(el => {
        const a = el.querySelector('h1 a, h2 a, h3 a, .title a, .headline a');
        const img = el.querySelector('img');
        if (!a) return;
        const title = a.textContent?.trim();
        const link = a.getAttribute('href') || '';
        if (!title || seen.has(title)) return;
        seen.add(title);
        const fullLink = link.startsWith('http') ? link : new URL(link, feed.url).href;
        let image = img?.getAttribute('src') || img?.getAttribute('data-src') || img?.getAttribute('data-lazy-src') || '';
        if (image && !image.startsWith('http')) image = new URL(image, feed.url).href;
        items.push({ title, source: feed.name || 'News', pub_date: '', link: fullLink, description: '', image });
    });

    // Strategy 2: Heading + link pairs anywhere on page (fallback)
    if (items.length === 0) {
        doc.querySelectorAll('h2 a, h3 a').forEach(a => {
            const title = a.textContent?.trim();
            const link = a.getAttribute('href') || '';
            if (!title || title.length < 15 || seen.has(title)) return;
            seen.add(title);
            const fullLink = link.startsWith('http') ? link : new URL(link, feed.url).href;
            // Look for nearby image
            const parent = a.closest('div, article, li, section');
            const img = parent?.querySelector('img');
            let image = img?.getAttribute('src') || img?.getAttribute('data-src') || img?.getAttribute('data-lazy-src') || '';
            if (image && !image.startsWith('http')) image = new URL(image, feed.url).href;
            items.push({ title, source: feed.name || 'News', pub_date: '', link: fullLink, description: '', image });
        });
    }

    return items;
}

export async function fetchNews(settings) {
    const feeds = settings.news_feeds || [];
    const maxItems = settings.news_max_items || 8;
    let allItems = [];

    for (const feed of feeds) {
        try {
            const items = await parseFeed(feed, maxItems);
            allItems.push(...items);
        } catch (e) {
            console.error(`Feed error (${feed.name}):`, e);
        }
    }

    return allItems.slice(0, maxItems);
}

// Same as fetchNews but returns items grouped by feed source
export async function fetchNewsByFeed(settings) {
    const feeds = settings.news_feeds || [];
    const maxPerFeed = Math.max(3, Math.floor((settings.news_max_items || 8) / Math.max(feeds.length, 1)));
    let feedGroups = [];

    for (const feed of feeds) {
        try {
            const feedItems = await parseFeed(feed, maxPerFeed);
            if (feedItems.length > 0) {
                feedGroups.push({ name: feed.name || 'News', items: feedItems });
            }
        } catch (e) { console.error(`Feed error (${feed.name}):`, e); }
    }
    return feedGroups;
}

// ═══ Helpers ════════════════════════════════════════════════
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
const PDF_EXT = ['pdf'];

export function getFileType(filename) {
    if (!filename) return null;
    const ext = filename.split('.').pop().split('?')[0].toLowerCase();
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (VIDEO_EXT.includes(ext)) return 'video';
    if (PDF_EXT.includes(ext)) return 'pdf';
    return 'other';
}

export function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatDate(d) {
    if (!d) return '';
    // Parse date-only strings (YYYY-MM-DD) as local dates, not UTC midnight,
    // so they don't display as the previous day in western timezones
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    } catch { return ''; }
}

export const CATEGORIES = {
    general: { label: 'General', icon: '📋' },
    maintenance: { label: 'Maintenance', icon: '🔧' },
    safety: { label: 'Safety', icon: '🛡️' },
    event: { label: 'Event', icon: '🎉' },
    rules: { label: 'Rules & Policies', icon: '📜' },
    financial: { label: 'Financial', icon: '💰' },
    parking: { label: 'Parking', icon: '🅿️' },
    amenities: { label: 'Amenities', icon: '🏊' },
};

export const WMO_ICONS = {
    0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
    51:'🌦️',53:'🌦️',55:'🌧️',56:'🌨️',57:'🌨️',
    61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',
    71:'🌨️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',
    85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️',
};

export const WMO_DESC = {
    0:'Clear',1:'Mostly Clear',2:'Partly Cloudy',3:'Overcast',
    45:'Foggy',48:'Rime Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',
    61:'Light Rain',63:'Rain',65:'Heavy Rain',66:'Freezing Rain',67:'Heavy Freezing Rain',
    71:'Light Snow',73:'Snow',75:'Heavy Snow',77:'Snow Grains',
    80:'Showers',81:'Heavy Showers',82:'Violent Showers',
    95:'Thunderstorm',96:'Thunderstorm + Hail',99:'Severe Thunderstorm',
};

export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ═══ Smart News Features ═══════════════════════════════════

const BREAKING_KEYWORDS = [
    'breaking:', 'breaking news', 'just in:', 'developing:',
    'amber alert', 'evacuation order', 'lockdown', 'manhunt'
];

const LOCAL_KEYWORDS = [
    'toronto', 'gta', 'mississauga', 'brampton', 'scarborough',
    'etobicoke', 'north york', 'markham', 'vaughan',
    'ttc', 'go transit', 'gardiner expressway', 'dvp',
    'highway 401', 'highway 407', 'city council'
];

export function detectNewsBadge(title, description) {
    const titleLower = (title || '').toLowerCase();

    // BREAKING: only match title, and only specific phrases
    for (const kw of BREAKING_KEYWORDS) {
        if (titleLower.includes(kw)) return { type: 'breaking', label: 'BREAKING' };
    }

    // LOCAL: only match title, not description (too many false positives)
    for (const kw of LOCAL_KEYWORDS) {
        if (titleLower.includes(kw)) return { type: 'local', label: 'LOCAL' };
    }

    return null;
}

export function cleanHeadline(title, sourceName) {
    if (!title) return title;
    let t = title;

    // Remove source prefix patterns: "CBC News: ", "CP24 | ", "Source - "
    const prefixPatterns = [
        new RegExp(`^${escapeRegex(sourceName || '')}\\s*[:\\|\\-–—]\\s*`, 'i'),
        /^[A-Z]{2,10}\s*[:\|]\s*/,
    ];
    for (const p of prefixPatterns) { t = t.replace(p, ''); }

    // Remove trailing source: " - CBC News", " | CP24"
    const suffixPatterns = [
        /\s*[\|–—]\s*[A-Z][\w\s]{2,20}$/,
        new RegExp(`\\s*[\\-–—|]\\s*${escapeRegex(sourceName || '')}$`, 'i'),
    ];
    for (const p of suffixPatterns) { t = t.replace(p, ''); }

    // Remove brackets with metadata: [VIDEO], [UPDATED], (Opinion)
    t = t.replace(/\s*[\[\(](video|updated|opinion|exclusive|photos?|watch|listen|live|breaking)[\]\)]\s*/gi, ' ');

    // Clean extra whitespace
    t = t.replace(/\s+/g, ' ').trim();

    return t;
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sortNewsByPriority(items) {
    return [...items].sort((a, b) => {
        const aBadge = detectNewsBadge(a.title, a.description);
        const bBadge = detectNewsBadge(b.title, b.description);
        const aScore = aBadge?.type === 'breaking' ? 3 : aBadge?.type === 'local' ? 2 : aBadge?.type === 'trending' ? 1 : 0;
        const bScore = bBadge?.type === 'breaking' ? 3 : bBadge?.type === 'local' ? 2 : bBadge?.type === 'trending' ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        // Tie-break: newer first
        return new Date(b.pub_date || 0) - new Date(a.pub_date || 0);
    });
}

export function generateQRUrl(url, size) {
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size || 80}x${size || 80}&data=${encodeURIComponent(url)}&margin=1`;
}
