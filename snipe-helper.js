/*
 * Die Stämme – Snipe-Helfer v2.0.1
 * Moderne, deutschsprachige Neufassung des Bottenkraker-Snipe-Helfers.
 * Das Script berechnet und visualisiert den Absendezeitpunkt. Es sendet nicht automatisch.
 *
 * Optionale Konfiguration vor dem Start:
 * window.SNIPE_HELPER_CONFIG = {
 *   zielFarbe: '#2e7d32',
 *   warteFarbe: '#f39c12',
 *   ohneDatumFarbe: '#2e7d32',
 *   breite: null
 * };
 */

(async function snipeHelferV2() {
    'use strict';

    const VERSION = '2.0.1';
    const ROOT_ID = 'snipe-helper-v2';
    const STYLE_ID = 'snipe-helper-v2-style';
    const TICK_NS = '.snipeHelperV2';
    const defaults = {
        zielFarbe: typeof window.timeColor !== 'undefined' ? window.timeColor : '#2e7d32',
        warteFarbe: typeof window.waitingColor !== 'undefined' ? window.waitingColor : '#f39c12',
        ohneDatumFarbe: typeof window.noDateColor !== 'undefined' ? window.noDateColor : '#2e7d32',
        breite: typeof window.timeBarWidth !== 'undefined' ? window.timeBarWidth : null
    };
    const config = Object.assign({}, defaults, window.SNIPE_HELPER_CONFIG || {});

    if (window.__snipeHelperV2?.destroy) window.__snipeHelperV2.destroy();

    const state = {
        targetTime: null,
        milliseconds: 0,
        delay: 0,
        remember: false,
        duration: 0,
        timer: null,
        observer: null,
        active: false,
        soundPlayed: false,
        selectedRow: null,
        settings: null
    };

    const $doc = window.jQuery;
    const world = window.game_data?.world || location.hostname;
    const storageKey = `${world}:snipe-helper:v2`;

    function notify(message, type = 'info') {
        if (window.UI?.[type]) window.UI[type](message);
        else if (window.UI?.InfoMessage) window.UI.InfoMessage(message, 3000);
        else console.log(`[Snipe-Helfer] ${message}`);
    }

    function clampInt(value, min, max, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    }

    function loadSettings() {
        const fallback = { version: VERSION, remember: false, targetTime: null, milliseconds: 0, delay: 0 };
        try {
            const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (!parsed || typeof parsed !== 'object') return fallback;
            return {
                version: VERSION,
                remember: Boolean(parsed.remember),
                targetTime: Number.isFinite(Number(parsed.targetTime)) ? Number(parsed.targetTime) : null,
                milliseconds: clampInt(parsed.milliseconds, 0, 999),
                delay: clampInt(parsed.delay, -9999, 9999)
            };
        } catch (error) {
            console.warn('[Snipe-Helfer] Gespeicherte Einstellungen waren beschädigt.', error);
            return fallback;
        }
    }

    function saveSettings() {
        const payload = {
            version: VERSION,
            remember: state.remember,
            targetTime: state.remember ? state.targetTime : null,
            milliseconds: state.remember ? state.milliseconds : 0,
            delay: state.remember ? state.delay : 0
        };
        try { localStorage.setItem(storageKey, JSON.stringify(payload)); }
        catch (error) { console.warn('[Snipe-Helfer] Einstellungen konnten nicht gespeichert werden.', error); }
    }

    function serverNow() {
        if (window.Timing?.getCurrentServerTime) return Number(window.Timing.getCurrentServerTime());
        return Date.now();
    }

    function pad(value, length = 2) {
        return String(value).padStart(length, '0');
    }

    function toLocalInput(timestamp) {
        if (!Number.isFinite(timestamp)) return '';
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function formatDateTime(timestamp, withMs = false) {
        if (!Number.isFinite(timestamp)) return '—';
        const date = new Date(timestamp);
        const base = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        return withMs ? `${base}.${pad(date.getMilliseconds(), 3)}` : base;
    }

    function formatCountdown(milliseconds) {
        const sign = milliseconds < 0 ? '−' : '';
        let remaining = Math.abs(Math.floor(milliseconds));
        const days = Math.floor(remaining / 86400000); remaining %= 86400000;
        const hours = Math.floor(remaining / 3600000); remaining %= 3600000;
        const minutes = Math.floor(remaining / 60000); remaining %= 60000;
        const seconds = Math.floor(remaining / 1000);
        const ms = remaining % 1000;
        return `${sign}${days ? `${days}T ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
    }

    function getDuration() {
        const span = document.querySelector('#date_arrival span[data-duration]');
        const seconds = Number(span?.dataset.duration);
        return Number.isFinite(seconds) ? seconds * 1000 : 0;
    }

    function getServerDateParts() {
        const text = document.querySelector('#serverDate')?.textContent || '';
        const parts = text.match(/\d+/g)?.map(Number) || [];
        if (parts.length >= 3) return { day: parts[0], month: parts[1], year: parts[2] < 100 ? 2000 + parts[2] : parts[2] };
        const now = new Date(serverNow());
        return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
    }

    function parseArrivalText(text) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        const timeMatch = clean.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/);
        if (!timeMatch) return null;

        const server = getServerDateParts();
        let day = server.day;
        let month = server.month;
        let year = server.year;
        const dateMatch = clean.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
        if (dateMatch) {
            day = Number(dateMatch[1]);
            month = Number(dateMatch[2]);
            if (dateMatch[3]) year = Number(dateMatch[3]) < 100 ? 2000 + Number(dateMatch[3]) : Number(dateMatch[3]);
        } else if (/morgen|tomorrow|demain|jutro|mañana|domani/i.test(clean)) {
            const tomorrow = new Date(year, month - 1, day + 1);
            day = tomorrow.getDate(); month = tomorrow.getMonth() + 1; year = tomorrow.getFullYear();
        }

        const msText = (timeMatch[4] || '0').padEnd(3, '0').slice(0, 3);
        const result = new Date(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3]), Number(msText));
        return Number.isFinite(result.getTime()) ? result.getTime() : null;
    }

    function effectiveTarget() {
        return Number.isFinite(state.targetTime) ? state.targetTime + state.milliseconds + state.delay : null;
    }

    function sendTimestamp() {
        const target = effectiveTarget();
        return target === null ? null : target - state.duration;
    }

    function setTarget(timestamp, source = '') {
        if (!Number.isFinite(timestamp)) {
            notify('Die Ankunftszeit konnte nicht erkannt werden.', 'ErrorMessage');
            return;
        }
        const date = new Date(timestamp);
        state.targetTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), 0).getTime();
        state.milliseconds = date.getMilliseconds();
        const timeInput = document.querySelector('#sh-target');
        const msInput = document.querySelector('#sh-ms');
        if (timeInput) timeInput.value = toLocalInput(state.targetTime);
        if (msInput) msInput.value = state.milliseconds;
        saveSettings();
        renderTime();
        if (source) setStatus(`${source} übernommen.`, 'ok');
    }

    function setStatus(text, type = '') {
        const element = document.querySelector('#sh-status');
        if (!element) return;
        element.textContent = text;
        element.className = `sh-status ${type}`;
    }

    function renderTime() {
        const target = effectiveTarget();
        const send = sendTimestamp();
        const now = serverNow();
        const targetEl = document.querySelector('#sh-effective-target');
        const sendEl = document.querySelector('#sh-send-time');
        const countdownEl = document.querySelector('#sh-countdown');
        const bar = document.querySelector('#sh-progress-value');
        const clock = document.querySelector('#sh-clock');
        if (!targetEl || !sendEl || !countdownEl || !bar || !clock) return;

        clock.textContent = formatDateTime(now, true).split(' · ')[1];
        targetEl.textContent = formatDateTime(target, true);
        sendEl.textContent = formatDateTime(send, true);

        if (send === null) {
            countdownEl.textContent = 'Keine Zielzeit gesetzt';
            countdownEl.className = 'sh-countdown neutral';
            bar.style.width = `${(now % 1000) / 10}%`;
            bar.style.background = config.ohneDatumFarbe;
            document.title = document.title.replace(/^Absenden in: .*? \| /, '');
            return;
        }

        const remaining = send - now;
        countdownEl.textContent = remaining >= 0 ? `Absenden in ${formatCountdown(remaining)}` : `Zeitpunkt verpasst: ${formatCountdown(remaining)}`;
        countdownEl.className = `sh-countdown ${remaining < 0 ? 'late' : remaining <= 5000 ? 'ready' : 'waiting'}`;
        bar.style.width = `${(now % 1000) / 10}%`;
        bar.style.background = remaining >= 0 && remaining <= 1000 ? config.zielFarbe : config.warteFarbe;

        if (remaining >= 0) document.title = `Absenden in: ${formatCountdown(remaining)} | Die Stämme`;
        if (remaining <= 5000 && remaining > 4000 && !state.soundPlayed) {
            try { window.TribalWars?.playSound?.('chat'); } catch (_) { /* Ton ist optional. */ }
            state.soundPlayed = true;
        }
        if (remaining > 5000) state.soundPlayed = false;
    }

    function createStyles() {
        document.getElementById(STYLE_ID)?.remove();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${ROOT_ID}{box-sizing:border-box;width:100%;max-width:${config.breite ? `${Number(config.breite)}px` : '520px'};margin:12px 0;border:1px solid #7d510f;border-radius:6px;background:#f4e4bc;color:#3b2a16;box-shadow:0 2px 6px rgba(0,0,0,.18);font:13px Arial,sans-serif;overflow:hidden}
            #${ROOT_ID} *{box-sizing:border-box}
            #${ROOT_ID} .sh-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;background:linear-gradient(#c9a363,#9c6b28);color:#fff;font-weight:700}
            #${ROOT_ID} .sh-version{font-size:11px;opacity:.8}
            #${ROOT_ID} .sh-body{padding:10px}
            #${ROOT_ID} .sh-progress{position:relative;height:26px;margin-bottom:10px;border:1px solid #76511d;border-radius:4px;background:#d7c59c;overflow:hidden}
            #${ROOT_ID} .sh-progress-value{height:100%;width:0;transition:width .04s linear}
            #${ROOT_ID} .sh-clock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;z-index:1;font-variant-numeric:tabular-nums}
            #${ROOT_ID} .sh-grid{display:grid;grid-template-columns:minmax(180px,2fr) minmax(90px,1fr) minmax(105px,1fr);gap:8px}
            #${ROOT_ID} label{display:flex;flex-direction:column;gap:4px;font-weight:700}
            #${ROOT_ID} input{width:100%;min-height:34px;border:1px solid #9d7b47;border-radius:4px;background:#fff;padding:6px;color:#222;font-size:14px}
            #${ROOT_ID} .sh-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
            #${ROOT_ID} .sh-card{padding:8px;border:1px solid #c6aa75;border-radius:4px;background:#fff8e8}
            #${ROOT_ID} .sh-card span{display:block;color:#765b32;font-size:11px;margin-bottom:3px}
            #${ROOT_ID} .sh-card strong{font-variant-numeric:tabular-nums}
            #${ROOT_ID} .sh-countdown{margin-top:9px;padding:9px;border-radius:4px;text-align:center;font-size:15px;font-weight:700}
            #${ROOT_ID} .sh-countdown.waiting{background:#fff0cb;color:#865308}.sh-countdown.ready{background:#d8f0d6;color:#145c19}.sh-countdown.late{background:#f6d3cf;color:#9c1710}.sh-countdown.neutral{background:#e7dfcc;color:#66573e}
            #${ROOT_ID} .sh-options{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:9px}
            #${ROOT_ID} .sh-check{display:flex;flex-direction:row;align-items:center;gap:6px;font-weight:400}#${ROOT_ID} .sh-check input{flex:0 0 18px;width:18px;height:18px;min-height:0;padding:0}
            #${ROOT_ID} button{min-height:34px;border:1px solid #654315;border-radius:4px;background:linear-gradient(#d7b36c,#aa762e);color:#fff;padding:6px 12px;font-weight:700;cursor:pointer;touch-action:manipulation}
            #${ROOT_ID} button:hover{filter:brightness(1.08)}
            #${ROOT_ID} .sh-status{margin-top:7px;min-height:16px;color:#70552e}.sh-status.ok{color:#246b28}.sh-status.error{color:#a01912}
            #${ROOT_ID} .sh-commands{margin-top:10px;max-height:250px;overflow:auto;border-radius:4px}
            #${ROOT_ID} .sh-commands table{width:100%;border-collapse:collapse;background:#fff8e8}
            #${ROOT_ID} .sh-commands th,#${ROOT_ID} .sh-commands td{padding:6px;border:1px solid #c9af7a;text-align:left}
            #${ROOT_ID} .sh-command-row{cursor:pointer}.sh-command-row:hover td{background:#fff1c6}.sh-command-row.selected td{background:#dcefd8!important}
            @media(max-width:600px){#${ROOT_ID}{max-width:100%;margin:8px 0}#${ROOT_ID} .sh-grid{grid-template-columns:1fr 1fr}#${ROOT_ID} .sh-grid label:first-child{grid-column:1/-1}#${ROOT_ID} .sh-summary{grid-template-columns:1fr}#${ROOT_ID} input,#${ROOT_ID} button{font-size:16px;min-height:42px}#${ROOT_ID} .sh-commands{max-height:210px;overflow:auto}}
        `;
        document.head.appendChild(style);
    }

    function createPanel(anchor) {
        document.getElementById(ROOT_ID)?.remove();
        const panel = document.createElement('section');
        panel.id = ROOT_ID;
        panel.innerHTML = `
            <div class="sh-head"><span>🎯 Snipe-Helfer</span><span class="sh-version">v${VERSION}</span></div>
            <div class="sh-body">
                <div class="sh-progress"><div id="sh-progress-value" class="sh-progress-value"></div><div id="sh-clock" class="sh-clock">--:--:--.---</div></div>
                <div class="sh-grid">
                    <label>Ankunftszeit<input id="sh-target" type="datetime-local" step="1" max="9999-12-31T23:59:59"></label>
                    <label>Millisekunden<input id="sh-ms" type="number" min="0" max="999" step="1" inputmode="numeric"></label>
                    <label>Korrektur (ms)<input id="sh-delay" type="number" min="-9999" max="9999" step="1" inputmode="numeric"></label>
                </div>
                <div class="sh-summary">
                    <div class="sh-card"><span>Effektive Ankunft</span><strong id="sh-effective-target">—</strong></div>
                    <div class="sh-card"><span>Absendezeit</span><strong id="sh-send-time">—</strong></div>
                </div>
                <div id="sh-countdown" class="sh-countdown neutral">Keine Zielzeit gesetzt</div>
                <div class="sh-options">
                    <label class="sh-check"><input id="sh-remember" type="checkbox"> Eingaben merken</label>
                    <button id="sh-clear" type="button">Zeit zurücksetzen</button>
                    <button id="sh-reload" type="button">Angriffe neu laden</button>
                </div>
                <div id="sh-status" class="sh-status">Bereit.</div>
                <div id="sh-commands" class="sh-commands"></div>
            </div>`;
        const commandTable = anchor.closest('table');
        if (commandTable) commandTable.insertAdjacentElement('afterend', panel);
        else anchor.insertAdjacentElement('afterend', panel);
        return panel;
    }

    function bindInputs(panel) {
        const target = panel.querySelector('#sh-target');
        const ms = panel.querySelector('#sh-ms');
        const delay = panel.querySelector('#sh-delay');
        const remember = panel.querySelector('#sh-remember');

        target.value = toLocalInput(state.targetTime);
        ms.value = state.milliseconds;
        delay.value = state.delay;
        remember.checked = state.remember;

        target.addEventListener('input', () => {
            const timestamp = new Date(target.value).getTime();
            state.targetTime = Number.isFinite(timestamp) ? timestamp : null;
            state.soundPlayed = false;
            saveSettings(); renderTime();
        });
        ms.addEventListener('input', () => { state.milliseconds = clampInt(ms.value, 0, 999); ms.value = state.milliseconds; state.soundPlayed = false; saveSettings(); renderTime(); });
        delay.addEventListener('input', () => { state.delay = clampInt(delay.value, -9999, 9999); delay.value = state.delay; state.soundPlayed = false; saveSettings(); renderTime(); });
        remember.addEventListener('change', () => { state.remember = remember.checked; saveSettings(); setStatus(state.remember ? 'Eingaben werden für diese Welt gespeichert.' : 'Gespeicherte Zeitwerte wurden entfernt.', 'ok'); });
        panel.querySelector('#sh-clear').addEventListener('click', event => {
            event.preventDefault();
            state.targetTime = null; state.milliseconds = 0; state.delay = 0; state.soundPlayed = false;
            target.value = ''; ms.value = 0; delay.value = 0; saveSettings(); renderTime(); setStatus('Zielzeit zurückgesetzt.', 'ok');
        });
        panel.querySelector('#sh-reload').addEventListener('click', event => { event.preventDefault(); loadCommands(true); });
    }

    function findVillageId() {
        const href = document.querySelector('#command-data-form .village_anchor a, #command-data-form a[href*="screen=info_village"]')?.href;
        if (!href) return null;
        try { return new URL(href, location.href).searchParams.get('id'); } catch (_) { return null; }
    }

    async function requestHtml(url) {
        if ($doc?.ajax) return $doc.ajax({ url, method: 'GET' });
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    }

    function findArrivalColumn(table) {
        const headers = [...table.querySelectorAll('thead th, tr:first-child th')];
        const index = headers.findIndex(th => /ankunft|arrival|aankomst|arriv/i.test(th.textContent));
        return index >= 0 ? index : 1;
    }

    async function loadCommands(showMessage = false) {
        const container = document.querySelector('#sh-commands');
        if (!container) return;
        const villageId = findVillageId();
        if (!villageId || !window.game_data?.link_base_pure) {
            container.innerHTML = '';
            setStatus('Laufende Angriffe konnten auf dieser Ansicht nicht ermittelt werden.', 'error');
            return;
        }
        if (showMessage) setStatus('Laufende Angriffe werden geladen …');
        try {
            const html = await requestHtml(`${game_data.link_base_pure}info_village&id=${encodeURIComponent(villageId)}`);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const original = doc.querySelector('.commands-container table, table.commands-container, .commands-container');
            if (!original) {
                container.innerHTML = '';
                setStatus('Für dieses Dorf wurden keine laufenden Befehle gefunden.');
                return;
            }
            const table = original.matches('table') ? original.cloneNode(true) : original.querySelector('table')?.cloneNode(true);
            if (!table) throw new Error('Befehlstabelle fehlt');
            table.removeAttribute('id');
            const arrivalIndex = findArrivalColumn(table);
            const rows = [...table.querySelectorAll('tr.command-row, tbody tr')].filter(row => row.querySelectorAll('td').length);
            rows.forEach(row => {
                row.classList.add('sh-command-row');
                row.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
                row.addEventListener('click', event => {
                    event.preventDefault();
                    const cells = row.querySelectorAll('td');
                    const arrivalText = cells[arrivalIndex]?.textContent || row.textContent;
                    const parsed = parseArrivalText(arrivalText);
                    container.querySelectorAll('.selected').forEach(item => item.classList.remove('selected'));
                    if (parsed !== null) {
                        row.classList.add('selected'); state.selectedRow = row; setTarget(parsed, 'Ankunftszeit');
                    } else setStatus('Die Ankunftszeit dieser Zeile konnte nicht gelesen werden.', 'error');
                });
            });
            container.replaceChildren(table);
            setStatus(`${rows.length} laufende${rows.length === 1 ? 'r Befehl' : ' Befehle'} geladen. Zum Übernehmen eine Zeile antippen.`, rows.length ? 'ok' : '');
        } catch (error) {
            console.error('[Snipe-Helfer] Fehler beim Laden der Befehle:', error);
            container.innerHTML = '';
            setStatus('Laufende Angriffe konnten nicht geladen werden.', 'error');
        }
    }

    function stop() {
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        state.active = false;
        if ($doc) $doc(window.TribalWars).off(TICK_NS);
    }

    async function start() {
        if (state.active || document.getElementById(ROOT_ID)) return;
        const arrivalBox = document.getElementById('date_arrival');
        const form = document.getElementById('command-data-form');
        if (!arrivalBox || !form) return;

        state.active = true;
        state.settings = loadSettings();
        state.remember = state.settings.remember;
        state.targetTime = state.remember ? state.settings.targetTime : null;
        state.milliseconds = state.remember ? state.settings.milliseconds : 0;
        state.delay = state.remember ? state.settings.delay : 0;
        state.duration = getDuration();
        createStyles();
        const panel = createPanel(arrivalBox);
        bindInputs(panel);
        renderTime();
        await loadCommands(false);

        state.timer = setInterval(renderTime, 50);
        const sendButton = document.getElementById('troop_confirm_submit');
        sendButton?.addEventListener('click', () => {
            console.log(`[Snipe-Helfer] Bestätigt bei ${Math.round(serverNow()) % 1000} ms Serverzeit.`);
            saveSettings(); stop();
        }, { once: true });
    }

    function watchPage() {
        const root = document.getElementById('ds_body') || document.body;
        if (!root) return;
        state.observer = new MutationObserver(() => {
            const available = Boolean(document.getElementById('date_arrival') && document.getElementById('command-data-form'));
            if (available && !state.active) start();
            if (!available && state.active) {
                stop();
                document.getElementById(ROOT_ID)?.remove();
            }
        });
        state.observer.observe(root, { childList: true, subtree: true });
    }

    window.__snipeHelperV2 = {
        version: VERSION,
        destroy() {
            stop();
            state.observer?.disconnect();
            document.getElementById(ROOT_ID)?.remove();
            document.getElementById(STYLE_ID)?.remove();
        }
    };

    await start();
    watchPage();
})();
