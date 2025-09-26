// Punjab Public Transport SPA - Maps + Voice + Amigo baseline

// -------- Utilities --------
const Storage = {
    get(key, fallback = null) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return fallback; }
    },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    remove(key) { localStorage.removeItem(key); }
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// -------- I18n --------
const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English', stt: 'en-US', tts: 'en-US' },
    { code: 'hi', label: 'हिन्दी', stt: 'hi-IN', tts: 'hi-IN' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ', stt: 'pa-IN', tts: 'pa-IN' },
    { code: 'ta', label: 'தமிழ்', stt: 'ta-IN', tts: 'ta-IN' },
    { code: 'te', label: 'తెలుగు', stt: 'te-IN', tts: 'te-IN' },
    { code: 'kn', label: 'ಕನ್ನಡ', stt: 'kn-IN', tts: 'kn-IN' },
    { code: 'ml', label: 'മലയാളം', stt: 'ml-IN', tts: 'ml-IN' },
    { code: 'gu', label: 'ગુજરાતી', stt: 'gu-IN', tts: 'gu-IN' },
    { code: 'mr', label: 'मराठी', stt: 'mr-IN', tts: 'mr-IN' },
    { code: 'bn', label: 'বাংলা', stt: 'bn-IN', tts: 'bn-IN' },
    { code: 'or', label: 'ଓଡ଼ିଆ', stt: 'or-IN', tts: 'or-IN' },
    { code: 'as', label: 'অসমীয়া', stt: 'as-IN', tts: 'as-IN' },
    { code: 'ur', label: 'اردو', stt: 'ur-IN', tts: 'ur-IN' },
];

const I18n = {
    current: Storage.get('lang') || 'en',
    dict: {},
    async load(lang) {
        const fallback = await fetch(`/i18n/en.json`).then(r => r.json()).catch(() => ({}));
        let specific = {};
        try { specific = await fetch(`/i18n/${lang}.json`).then(r => r.json()); } catch {}
        I18n.dict = { ...fallback, ...specific };
        I18n.current = lang;
        Storage.set('lang', lang);
        I18n.apply();
        UI.populateVoiceLanguages();
    },
    t(key) { return I18n.dict[key] || key; },
    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = I18n.t(key);
        });
    }
};

// -------- Google Maps Loader --------
const GoogleMaps = {
    map: null,
    markers: new Map(), // busId -> marker
    pathPolylines: new Map(),
    async load(apiKey) {
        if (window.google && window.google.maps) return true;
        if (!apiKey) return false;
        const id = 'gmaps-sdk';
        if (document.getElementById(id)) return true;
        const script = document.createElement('script');
        script.id = id;
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,marker&v=weekly`;
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            setTimeout(() => resolve(), 6000);
        });
        return !!(window.google && window.google.maps);
    },
    initMap() {
        if (!window.google || !google.maps) return;
        const el = document.getElementById('map');
        this.map = new google.maps.Map(el, {
            center: { lat: 30.7333, lng: 76.7794 },
            zoom: 11,
            disableDefaultUI: true,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
                { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
                { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
                { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
                { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
                { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] }
            ]
        });
        document.getElementById('gmaps-status').textContent = 'Ready';
        document.getElementById('gmaps-status').classList.add('ok');
    },
    ensureMarker(busId) {
        if (this.markers.has(busId)) return this.markers.get(busId);
        const icon = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: '#2ee6a6',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#0a66c2',
        };
        const marker = new google.maps.Marker({
            position: this.map.getCenter(),
            map: this.map,
            icon,
            title: `Bus ${busId}`,
        });
        this.markers.set(busId, marker);
        return marker;
    },
    animateTo(marker, newPos, durationMs = 900) {
        const start = marker.getPosition();
        const startLat = start.lat();
        const startLng = start.lng();
        const endLat = newPos.lat;
        const endLng = newPos.lng;
        const startTs = performance.now();
        const step = (ts) => {
            const p = Math.min(1, (ts - startTs) / durationMs);
            const lat = startLat + (endLat - startLat) * p;
            const lng = startLng + (endLng - startLng) * p;
            marker.setPosition({ lat, lng });
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },
    upsertBus(busId, lat, lng) {
        if (!this.map) return;
        const marker = this.ensureMarker(busId);
        const newPos = { lat, lng };
        if (marker.getPosition()) {
            this.animateTo(marker, newPos);
        } else {
            marker.setPosition(newPos);
        }
        this.map.panTo(newPos);
        // Trail path
        let poly = this.pathPolylines.get(busId);
        if (!poly) {
            poly = new google.maps.Polyline({ path: [newPos], geodesic: true, strokeColor: '#2ee6a6', strokeOpacity: 0.7, strokeWeight: 3, map: this.map });
            this.pathPolylines.set(busId, poly);
        } else {
            const path = poly.getPath();
            path.push(new google.maps.LatLng(newPos));
            if (path.getLength() > 200) path.removeAt(0);
        }
    }
};

// -------- Supabase --------
let supabase = null;
async function ensureSupabase() {
    const url = Storage.get('supabaseUrl');
    const key = Storage.get('supabaseKey');
    if (!url || !key) return null;
    if (supabase) return supabase;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
    return supabase;
}

async function subscribeBusLocations(busId) {
    const client = await ensureSupabase();
    if (!client) return;
    const channel = client.channel('bus_locations_stream');
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bus_locations', filter: `bus_id=eq.${busId}` }, (payload) => {
        const { latitude, longitude } = payload.new;
        GoogleMaps.upsertBus(busId, latitude, longitude);
        Cache.saveLastLocation(busId, { latitude, longitude, timestamp: Date.now() });
    }).subscribe();
}

async function insertBusLocation(busId, latitude, longitude) {
    const client = await ensureSupabase();
    if (!client) return { error: 'Supabase not configured' };
    return await client.from('bus_locations').insert({ bus_id: busId, latitude, longitude, timestamp: new Date().toISOString() });
}

// -------- Cache / Offline --------
const Cache = {
    saveLastLocation(busId, loc) { Storage.set(`bus:${busId}:last_loc`, loc); },
    getLastLocation(busId) { return Storage.get(`bus:${busId}:last_loc`); }
};

// -------- Voice (STT + TTS) --------
const Voice = {
    recognition: null,
    recognizing: false,
    supportsSTT: false,
    supportsTTS: 'speechSynthesis' in window,
    auto: false,
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.supportsSTT = !!SpeechRecognition;
        const statusEl = document.getElementById('voice-capability');
        if (this.supportsSTT) {
            statusEl.textContent = 'Ready'; statusEl.classList.add('ok');
        } else { statusEl.textContent = 'Unavailable'; statusEl.classList.add('err'); }
    },
    start(langCode) {
        if (!this.supportsSTT || this.recognizing) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = langCode || 'en-US';
        this.recognition.interimResults = false;
        this.recognition.continuous = false;
        this.recognition.onstart = () => { this.recognizing = true; UI.setListening(true); };
        this.recognition.onerror = () => { this.recognizing = false; UI.setListening(false); if (this.auto) setTimeout(() => this.start(UI.getSTTLang()), 600); };
        this.recognition.onend = () => { this.recognizing = false; UI.setListening(false); if (this.auto) setTimeout(() => this.start(UI.getSTTLang()), 300); };
        this.recognition.onresult = (e) => {
            const text = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
            if (text) Chat.handleUserText(text, true);
        };
        this.recognition.start();
    },
    stop() {
        try { this.recognition && this.recognition.stop(); } catch {}
        this.recognizing = false; UI.setListening(false);
    },
    speak(text, langCode) {
        if (!this.supportsTTS) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = langCode || 'en-US';
        utter.rate = 1;
        utter.pitch = 1;
        speechSynthesis.speak(utter);
    },
    toggleAuto(lang) {
        this.auto = !this.auto;
        const btn = document.getElementById('btn-voice-auto');
        btn.dataset.active = this.auto ? 'true' : 'false';
        btn.textContent = this.auto ? I18n.t('auto_listening_on') : I18n.t('auto_listen');
        if (this.auto && !this.recognizing) this.start(lang);
        if (!this.auto) this.stop();
    }
};

// -------- UI and Chat --------
const UI = {
    elements: {},
    init() {
        this.elements.languageScreen = document.getElementById('language-screen');
        this.elements.languageGrid = document.getElementById('language-grid');
        this.elements.voiceLangSelect = document.getElementById('voice-language');
        this.elements.btnVoiceToggle = document.getElementById('btn-voice-toggle');
        this.elements.btnVoiceTest = document.getElementById('btn-voice-test');
        this.elements.btnVoiceAuto = document.getElementById('btn-voice-auto');
        this.elements.waves = document.getElementById('listening-waves');
        this.elements.fab = document.getElementById('fab-amigo');
        this.elements.chat = document.getElementById('chat');
        this.elements.chatMessages = document.getElementById('chat-messages');
        this.elements.chatForm = document.getElementById('chat-form');
        this.elements.chatInput = document.getElementById('chat-input');
        this.elements.btnStart = document.getElementById('btn-start-tracking');
        this.elements.btnStop = document.getElementById('btn-stop-tracking');
        this.elements.btnChooseLanguage = document.getElementById('btn-choose-language');
        this.elements.btnBack = document.getElementById('btn-back');

        this.elements.btnOpenSettings = document.getElementById('btn-open-settings');
        this.elements.btnCloseSettings = document.getElementById('btn-close-settings');
        this.elements.btnSaveSettings = document.getElementById('btn-save-settings');
        this.elements.settingsDialog = document.getElementById('settings-dialog');
        this.elements.inputGmapsKey = document.getElementById('input-gmaps-key');
        this.elements.inputSupabaseUrl = document.getElementById('input-supabase-url');
        this.elements.inputSupabaseKey = document.getElementById('input-supabase-key');

        // Build language grid
        this.elements.languageGrid.innerHTML = '';
        SUPPORTED_LANGUAGES.forEach(l => {
            const btn = document.createElement('button');
            btn.textContent = l.label;
            btn.onclick = () => I18n.load(l.code).then(() => this.hideLanguageScreen());
            this.elements.languageGrid.appendChild(btn);
        });

        // Voice button (press and hold)
        const startHold = () => Voice.start(this.getSTTLang());
        const endHold = () => Voice.stop();
        this.elements.btnVoiceToggle.addEventListener('mousedown', startHold);
        this.elements.btnVoiceToggle.addEventListener('touchstart', startHold);
        window.addEventListener('mouseup', endHold);
        window.addEventListener('touchend', endHold);
        this.elements.btnVoiceTest.onclick = () => Voice.speak(I18n.t('voice_ready'), this.getTTSLang());
        this.elements.btnVoiceAuto.onclick = () => Voice.toggleAuto(this.getSTTLang());

        // Chat form
        this.elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = this.elements.chatInput.value.trim();
            if (!text) return;
            this.elements.chatInput.value = '';
            Chat.handleUserText(text);
        });

        // FAB toggles chat panel visibility
        this.elements.fab.onclick = () => { this.elements.chat.classList.toggle('hidden'); };

        // Back button: simple scroll-top or history back
        this.elements.btnBack.onclick = () => window.history.length > 1 ? window.history.back() : window.scrollTo({ top: 0, behavior: 'smooth' });

        // Settings dialog
        this.elements.btnOpenSettings.onclick = () => this.openSettings();
        this.elements.btnCloseSettings.onclick = () => this.closeSettings();
        this.elements.btnSaveSettings.onclick = () => this.saveSettings();
        const existing = { g: Storage.get('gmapsKey'), u: Storage.get('supabaseUrl'), k: Storage.get('supabaseKey') };
        if (existing.g) this.elements.inputGmapsKey.value = existing.g;
        if (existing.u) this.elements.inputSupabaseUrl.value = existing.u;
        if (existing.k) this.elements.inputSupabaseKey.value = existing.k;

        // Choose language button
        this.elements.btnChooseLanguage.onclick = () => this.showLanguageScreen();

        // Start/Stop tracking buttons
        this.elements.btnStart.onclick = () => Tracking.start();
        this.elements.btnStop.onclick = () => Tracking.stop();
    },
    populateVoiceLanguages() {
        const current = I18n.current;
        this.elements.voiceLangSelect.innerHTML = '';
        SUPPORTED_LANGUAGES.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.code; opt.textContent = `${l.label}`; opt.selected = l.code === current;
            this.elements.voiceLangSelect.appendChild(opt);
        });
    },
    getSTTLang() {
        const code = this.elements.voiceLangSelect.value || I18n.current;
        return (SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]).stt;
    },
    getTTSLang() {
        const code = this.elements.voiceLangSelect.value || I18n.current;
        return (SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]).tts;
    },
    setListening(on) {
        this.elements.waves.hidden = !on;
        this.elements.btnVoiceToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        document.getElementById('mic-label').textContent = on ? I18n.t('listening') : I18n.t('hold_to_talk');
    },
    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `bubble ${role}`;
        div.textContent = text;
        this.elements.chatMessages.appendChild(div);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    },
    showLanguageScreen() { this.elements.languageScreen.classList.remove('hidden'); this.elements.languageScreen.removeAttribute('hidden'); },
    hideLanguageScreen() { this.elements.languageScreen.classList.add('hidden'); this.elements.languageScreen.setAttribute('hidden', ''); },
    openSettings() { this.elements.settingsDialog.removeAttribute('hidden'); },
    closeSettings() { this.elements.settingsDialog.setAttribute('hidden', ''); },
    async saveSettings() {
        const g = this.elements.inputGmapsKey.value.trim();
        const u = this.elements.inputSupabaseUrl.value.trim();
        const k = this.elements.inputSupabaseKey.value.trim();
        if (g) Storage.set('gmapsKey', g);
        if (u) Storage.set('supabaseUrl', u);
        if (k) Storage.set('supabaseKey', k);
        this.closeSettings();
        // Attempt reload of Maps
        const ok = await GoogleMaps.load(Storage.get('gmapsKey'));
        if (ok && !GoogleMaps.map) GoogleMaps.initMap();
    }
};

const Commands = {
    // Simple multilingual command keywords
    keywords: {
        start: ['start tracking', 'tracking start', 'शुरू', 'ਸ਼ੁਰੂ', 'شروع', 'prarambh', 'begin'],
        stop: ['stop tracking', 'tracking stop', 'रोक', 'ਰੋਕੋ', 'روک', 'band', 'end'],
        show: ['show my bus', 'where is my bus', 'मेरी बस', 'ਮੇਰੀ ਬੱਸ', 'میری بس', 'bus kaha', 'bus kahan'],
        change_language: ['change language', 'भाषा बदलो', 'ਭਾਸ਼ਾ ਬਦਲੋ', 'زبان تبدیل']
    },
    match(text) {
        const t = text.toLowerCase();
        for (const [cmd, arr] of Object.entries(this.keywords)) {
            if (arr.some(k => t.includes(k))) return cmd;
        }
        return null;
    }
};

const Tracking = {
    watchId: null,
    busId: Storage.get('busId') || 1,
    async start() {
        if (!navigator.geolocation) { UI.addMessage('bot', I18n.t('no_geo')); return; }
        if (this.watchId) return;
        UI.addMessage('bot', I18n.t('tracking_started'));
        this.watchId = navigator.geolocation.watchPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            GoogleMaps.upsertBus(this.busId, latitude, longitude);
            Cache.saveLastLocation(this.busId, { latitude, longitude, timestamp: Date.now() });
            await insertBusLocation(this.busId, latitude, longitude);
        }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    },
    stop() {
        if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        UI.addMessage('bot', I18n.t('tracking_stopped'));
    }
};

const Chat = {
    async handleUserText(text, fromVoice = false) {
        UI.addMessage('user', text);
        const cmd = Commands.match(text);
        if (cmd) {
            await this.execute(cmd);
            return;
        }
        // Fallback FAQ responses
        const reply = this.faq(text) || I18n.t('amigo_default');
        UI.addMessage('bot', reply);
        if (fromVoice) Voice.speak(reply, UI.getTTSLang());
    },
    async execute(cmd) {
        switch (cmd) {
            case 'start': await Tracking.start(); break;
            case 'stop': Tracking.stop(); break;
            case 'show': {
                const loc = Cache.getLastLocation(Tracking.busId);
                if (loc) { GoogleMaps.upsertBus(Tracking.busId, loc.latitude, loc.longitude); UI.addMessage('bot', I18n.t('showing_bus')); }
                else UI.addMessage('bot', I18n.t('no_bus_location'));
                break;
            }
            case 'change_language': UI.showLanguageScreen(); break;
            default: UI.addMessage('bot', I18n.t('amigo_default'));
        }
    },
    faq(text) {
        const t = text.toLowerCase();
        if (t.includes('ticket')) return I18n.t('faq_tickets');
        if (t.includes('language')) return I18n.t('faq_language');
        if (t.includes('who are you') || t.includes('tum kaun ho') || t.includes('tusi kaun') ) return I18n.t('faq_who');
        if (t.includes('where is my bus')) return I18n.t('faq_where_bus');
        return null;
    }
};

// -------- Boot --------
(async function boot() {
    UI.init();
    Voice.init();
    await I18n.load(Storage.get('lang') || 'en');

    // Language screen if not chosen
    if (!Storage.get('lang')) UI.showLanguageScreen(); else UI.hideLanguageScreen();

    // Load Maps if key present
    const key = Storage.get('gmapsKey');
    const ok = await GoogleMaps.load(key);
    if (ok) GoogleMaps.initMap(); else { const s = document.getElementById('gmaps-status'); s.textContent = 'Unavailable'; s.classList.add('err'); }

    // Try to restore last known bus location
    const last = Cache.getLastLocation(Tracking.busId);
    if (last) GoogleMaps.upsertBus(Tracking.busId, last.latitude, last.longitude);

    // Subscribe to realtime if configured
    subscribeBusLocations(Tracking.busId);
})();

