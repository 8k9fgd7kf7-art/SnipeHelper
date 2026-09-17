/*
 * Die Stämme – Snipe-Helfer v2.3.0
 * Moderne, deutschsprachige Neufassung des Bottenkraker-Snipe-Helfers.
 * Das Script berechnet und visualisiert den Absendezeitpunkt und sendet nur nach bewusster Scharfschaltung automatisch.
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

    const VERSION = '2.3.0';
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
        sendCorrection: 150,
        remember: false,
        duration: 0,
        timer: null,
        autoTimer: null,
        autoSendArmed: false,
        autoSent: false,
        observer: null,
        active: false,
        soundPlayed: false,
        selectedRow: null,
        settings: null,
        originalTitle: document.title,
        tabId: null,
        channel: null,
        storageHandler: null,
        syncTimer: null,
        peers: new Map(),
        lastBroadcast: 0
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
        const fallback = { version: VERSION, remember: false, targetTime: null, milliseconds: 0, delay: 0, sendCorrection: 150 };
        try {
            const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (!parsed || typeof parsed !== 'object') return fallback;
            return {
                version: VERSION,
                remember: Boolean(parsed.remember),
                targetTime: Number.isFinite(Number(parsed.targetTime)) ? Number(parsed.targetTime) : null,
                milliseconds: clampInt(parsed.milliseconds, 0, 999),
                delay: clampInt(parsed.delay, -9999, 9999),
                sendCorrection: clampInt(parsed.sendCorrection, 0, 2000, 150)
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
            delay: state.remember ? state.delay : 0,
            sendCorrection: state.remember ? state.sendCorrection : 150
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

    function toMinuteInput(timestamp) {
        if (!Number.isFinite(timestamp)) return '';
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

    function createPlausibleTarget() {
        const minimumArrival = serverNow() + state.duration + 120000;
        const fiveMinutes = 5 * 60 * 1000;
        return Math.ceil(minimumArrival / fiveMinutes) * fiveMinutes;
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
        return target === null ? null : target - state.duration + state.sendCorrection;
    }

    function formatTimeOnly(timestamp) {
        if (!Number.isFinite(timestamp)) return '—';
        const date = new Date(timestamp);
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
    }

    function getCommandMeta() {
        const targetText = document.querySelector('#command-data-form .village_anchor, #command-data-form a[href*="screen=info_village"]')?.textContent || '—';
        const targetCoord = targetText.match(/\d+\|\d+/)?.[0] || targetText.replace(/\s+/g, ' ').trim().slice(0, 24) || '—';
        const sourceCoord = window.game_data?.village?.coord || window.game_data?.village?.id || 'dieses Dorf';
        return { source: String(sourceCoord), target: targetCoord };
    }

    function getTabSnapshot() {
        const meta = getCommandMeta();
        const target = effectiveTarget();
        const send = sendTimestamp();
        return {
            tabId: state.tabId,
            source: meta.source,
            target: meta.target,
            offset: state.delay,
            targetTime: target,
            sendTime: send,
            status: state.autoSendArmed ? 'SCHARF' : Number.isFinite(send) ? 'Bereit' : 'Keine Zeit',
            updatedAt: Date.now()
        };
    }

    function sendTabMessage(message) {
        const payload = Object.assign({ world, sender: state.tabId, sentAt: Date.now() }, message);
        if (state.channel) state.channel.postMessage(payload);
        else {
            try {
                localStorage.setItem(`${world}:snipe-helper:bus`, JSON.stringify(Object.assign({ nonce: Math.random() }, payload)));
            } catch (_) { /* Tab-Verbund ist optional. */ }
        }
    }

    function renderTabs() {
        const container = document.querySelector('#sh-tabs-table');
        const summary = document.querySelector('#sh-tabs-summary');
        if (!container || !summary) return;

        const cutoff = Date.now() - 7000;
        for (const [id, peer] of state.peers) if (!peer || peer.updatedAt < cutoff) state.peers.delete(id);
        const snapshots = [getTabSnapshot(), ...[...state.peers.values()].filter(peer => peer.tabId !== state.tabId)]
            .sort((a, b) => String(a.source).localeCompare(String(b.source), undefined, { numeric: true }));
        summary.textContent = `Verbundene Tabs (${snapshots.length})`;

        const table = document.createElement('table');
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['Dorf', 'Ziel', 'Versatz', 'Absenden', 'Status'].forEach(label => {
            const th = document.createElement('th'); th.textContent = label; headRow.appendChild(th);
        });
        head.appendChild(headRow); table.appendChild(head);
        const body = document.createElement('tbody');
        snapshots.forEach(snapshot => {
            const row = document.createElement('tr');
            if (snapshot.tabId === state.tabId) row.classList.add('sh-tab-current');
            const values = [snapshot.source, snapshot.target, `${snapshot.offset > 0 ? '+' : ''}${snapshot.offset} ms`, formatTimeOnly(snapshot.sendTime), snapshot.status];
            values.forEach((value, index) => {
                const td = document.createElement('td'); td.textContent = value;
                if (index === 4 && snapshot.status === 'SCHARF') td.classList.add('sh-tab-armed');
                row.appendChild(td);
            });
            body.appendChild(row);
        });
        table.appendChild(body);
        container.replaceChildren(table);
    }

    function broadcastStatus(force = false) {
        const now = Date.now();
        if (!force && now - state.lastBroadcast < 1000) return;
        state.lastBroadcast = now;
        const snapshot = getTabSnapshot();
        state.peers.set(state.tabId, snapshot);
        sendTabMessage({ type: 'status', snapshot });
        renderTabs();
    }

    function handleTabMessage(message) {
        if (!message || message.world !== world || message.sender === state.tabId) return;
        if (message.type === 'status' && message.snapshot?.tabId) {
            state.peers.set(message.snapshot.tabId, message.snapshot);
            renderTabs();
            return;
        }
        if (message.type !== 'sync-target') return;
        const sharedTarget = Number(message.targetTime);
        if (!Number.isFinite(sharedTarget)) return;
        if (state.autoSendArmed) {
            setStatus('Geteilte Zielzeit nicht übernommen: Dieser Tab ist bereits scharf.', 'error');
            return;
        }
        const candidateSend = sharedTarget - state.duration + state.sendCorrection;
        if (candidateSend - serverNow() < 1500) {
            setStatus('Geteilte Zielzeit ist für die Laufzeit dieses Tabs zu früh.', 'error');
            return;
        }
        const delayInput = document.querySelector('#sh-delay');
        if (delayInput) {
            delayInput.value = 0;
            delayInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else state.delay = 0;
        setTarget(sharedTarget, 'Geteilte Zielzeit');
        broadcastStatus(true);
    }

    function initTabSync() {
        window.__snipeHelperTabId = window.__snipeHelperTabId || (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
        state.tabId = window.__snipeHelperTabId;

        if (typeof BroadcastChannel === 'function') {
            state.channel = new BroadcastChannel(`${world}:snipe-helper-tabs`);
            state.channel.addEventListener('message', event => handleTabMessage(event.data));
        } else {
            state.storageHandler = event => {
                if (event.key !== `${world}:snipe-helper:bus` || !event.newValue) return;
                try { handleTabMessage(JSON.parse(event.newValue)); } catch (_) { /* Fremde Daten ignorieren. */ }
            };
            window.addEventListener('storage', state.storageHandler);
        }
        state.syncTimer = setInterval(() => broadcastStatus(true), 2000);
        broadcastStatus(true);
    }

    function cleanupTabSync() {
        if (state.syncTimer) clearInterval(state.syncTimer);
        state.syncTimer = null;
        state.channel?.close?.();
        state.channel = null;
        if (state.storageHandler) window.removeEventListener('storage', state.storageHandler);
        state.storageHandler = null;
        state.peers.clear();
    }

    function disarmAutoSend(message = '') {
        state.autoSendArmed = false;
        state.autoSent = false;
        if (state.autoTimer) clearTimeout(state.autoTimer);
        state.autoTimer = null;
        const button = document.querySelector('#sh-auto-send');
        document.getElementById(ROOT_ID)?.classList.remove('compact');
        if (button) {
            button.classList.remove('armed');
            button.textContent = 'Auto-Senden vorbereiten';
        }
        if (message) setStatus(message);
        broadcastStatus(true);
    }

    function performAutoSend() {
        if (!state.autoSendArmed || state.autoSent) return;
        const submit = document.getElementById('troop_confirm_submit');
        if (!submit || submit.disabled) {
            disarmAutoSend();
            setStatus('Auto-Senden abgebrochen: Der Bestätigen-Button ist nicht verfügbar.', 'error');
            return;
        }
        state.autoSent = true;
        state.autoSendArmed = false;
        document.title = 'GESENDET · SnipeHelper';
        console.log(`[Snipe-Helfer] Automatisch ausgelöst bei ${Math.round(serverNow()) % 1000} ms Serverzeit.`);
        setStatus('Angriff wurde automatisch ausgelöst.', 'ok');
        submit.click();
    }

    function scheduleAutoSend() {
        if (state.autoTimer) clearTimeout(state.autoTimer);
        const check = () => {
            if (!state.autoSendArmed) return;
            const send = sendTimestamp();
            const remaining = send === null ? Number.NaN : send - serverNow();
            if (!Number.isFinite(remaining)) {
                disarmAutoSend();
                setStatus('Auto-Senden abgebrochen: keine gültige Absendezeit.', 'error');
                return;
            }
            if (remaining <= 0) {
                if (remaining >= -1000) performAutoSend();
                else {
                    disarmAutoSend();
                    setStatus('Auto-Senden abgebrochen: Der Absendezeitpunkt ist bereits vorbei.', 'error');
                }
                return;
            }
            const nextCheck = remaining > 2000 ? remaining - 1500 : Math.max(1, Math.min(20, remaining / 2));
            state.autoTimer = setTimeout(check, nextCheck);
        };
        check();
    }

    function setTarget(timestamp, source = '') {
        if (!Number.isFinite(timestamp)) {
            notify('Die Ankunftszeit konnte nicht erkannt werden.', 'ErrorMessage');
            return;
        }
        const date = new Date(timestamp);
        state.targetTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), 0).getTime();
        state.milliseconds = date.getMilliseconds();
        disarmAutoSend();
        const timeInput = document.querySelector('#sh-target');
        const secondsInput = document.querySelector('#sh-seconds');
        const msInput = document.querySelector('#sh-ms');
        if (timeInput) timeInput.value = toMinuteInput(state.targetTime);
        if (secondsInput) secondsInput.value = date.getSeconds();
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
            document.title = state.originalTitle;
            broadcastStatus();
            return;
        }

        const remaining = send - now;
        countdownEl.textContent = remaining >= 0 ? `Absenden in ${formatCountdown(remaining)}` : `Zeitpunkt verpasst: ${formatCountdown(remaining)}`;
        countdownEl.className = `sh-countdown ${remaining < 0 ? 'late' : remaining <= 5000 ? 'ready' : 'waiting'}`;
        bar.style.width = `${(now % 1000) / 10}%`;
        bar.style.background = remaining >= 0 && remaining <= 1000 ? config.zielFarbe : config.warteFarbe;

        if (remaining >= 0) document.title = state.autoSendArmed ? `SCHARF · ${formatCountdown(remaining)} · SnipeHelper` : `Bereit · ${formatCountdown(remaining)} · SnipeHelper`;
        if (remaining <= 5000 && remaining > 4000 && !state.soundPlayed) {
            try { window.TribalWars?.playSound?.('chat'); } catch (_) { /* Ton ist optional. */ }
            state.soundPlayed = true;
        }
        if (remaining > 5000) state.soundPlayed = false;
        broadcastStatus();
    }

    function createStyles() {
        document.getElementById(STYLE_ID)?.remove();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${ROOT_ID}{box-sizing:border-box;width:100%;max-width:${config.breite ? `${Number(config.breite)}px` : '540px'};margin:10px 0;border:1px solid #c1a264;background:#f4e4bc;color:#3b2a16;font:12px Verdana,Arial,sans-serif;overflow:hidden}
            #${ROOT_ID} *{box-sizing:border-box}
            #${ROOT_ID} .sh-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 7px;border-bottom:1px solid #99752d;background:#c1a264;color:#3b2a16;font-weight:700}
            #${ROOT_ID} .sh-version{font-size:10px;font-weight:400}
            #${ROOT_ID} .sh-body{padding:7px}
            #${ROOT_ID} .sh-progress{position:relative;height:22px;margin-bottom:8px;border:1px solid #99752d;background:#d8c79f;overflow:hidden}
            #${ROOT_ID} .sh-progress-value{height:100%;width:0;transition:width .04s linear}
            #${ROOT_ID} .sh-clock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;text-shadow:0 1px 1px #000;z-index:1;font-variant-numeric:tabular-nums}
            #${ROOT_ID} .sh-grid{display:grid;grid-template-columns:minmax(180px,2fr) repeat(3,minmax(70px,1fr));gap:8px}
            #${ROOT_ID} label{display:flex;min-width:0;flex-direction:column;gap:3px;font-weight:700}
            #${ROOT_ID} .sh-field-label{display:flex;align-items:flex-end;min-height:28px;line-height:14px}
            #${ROOT_ID} input{width:100%;height:30px;min-height:30px;border:1px solid #99752d;border-radius:0;background:#fff;padding:4px 5px;color:#222;font:12px Verdana,Arial,sans-serif}
            #${ROOT_ID} .sh-summary{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
            #${ROOT_ID} .sh-card{padding:6px;border:1px solid #c1a264;background:#f8edcf}
            #${ROOT_ID} .sh-card span{display:block;color:#765b32;font-size:11px;margin-bottom:3px}
            #${ROOT_ID} .sh-card strong{font-variant-numeric:tabular-nums}
            #${ROOT_ID} .sh-countdown{margin-top:6px;padding:7px;border:1px solid #c1a264;text-align:center;font-size:14px;font-weight:700}
            #${ROOT_ID} .sh-countdown.waiting{background:#fff0cb;color:#865308}.sh-countdown.ready{background:#d8f0d6;color:#145c19}.sh-countdown.late{background:#f6d3cf;color:#9c1710}.sh-countdown.neutral{background:#e7dfcc;color:#66573e}
            #${ROOT_ID} .sh-sync{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px;padding:5px 6px;border:1px solid #c1a264;background:#f8edcf}
            #${ROOT_ID} .sh-sync-label{white-space:nowrap;font-weight:700}
            #${ROOT_ID} .sh-sync-buttons{display:flex;flex:1;justify-content:flex-end;gap:3px;white-space:nowrap}
            #${ROOT_ID} .sh-sync button{min-height:25px;padding:2px 7px;color:#3b2a16;background:#e3c98f;font-size:11px}
            #${ROOT_ID} .sh-sync button.active{background:#c1a264;box-shadow:inset 0 0 0 1px #6f4d16}
            #${ROOT_ID} .sh-check{display:flex;flex-direction:row;align-items:center;gap:6px;font-weight:400}#${ROOT_ID} .sh-check input{flex:0 0 18px;width:18px;height:18px;min-height:0;padding:0}
            #${ROOT_ID} button{min-height:28px;border:1px solid #654315;border-radius:2px;background:linear-gradient(#d7b36c,#aa762e);color:#fff;padding:4px 9px;font:700 12px Verdana,Arial,sans-serif;cursor:pointer;touch-action:manipulation}
            #${ROOT_ID} button:hover{filter:brightness(1.05)}
            #${ROOT_ID} .sh-main-action{display:flex;margin-top:7px}
            #${ROOT_ID} #sh-auto-send{width:100%;background:linear-gradient(#6d8c3d,#45651e)}
            #${ROOT_ID} #sh-auto-send.armed{background:linear-gradient(#c83f32,#8e1f16)}
            #${ROOT_ID} .sh-selected{margin-top:7px;padding:5px 6px;border:1px solid #99752d;background:#e8d7aa;font-weight:700}
            #${ROOT_ID} .sh-selected[hidden]{display:none}
            #${ROOT_ID} .sh-details{margin-top:7px;border:1px solid #c1a264;background:#f8edcf}
            #${ROOT_ID} .sh-details summary{padding:5px 6px;background:#e3c98f;font-weight:700;cursor:pointer;list-style-position:inside}
            #${ROOT_ID} .sh-details-body{padding:6px}
            #${ROOT_ID} .sh-advanced{display:flex;align-items:flex-end;gap:7px;flex-wrap:wrap}
            #${ROOT_ID} .sh-advanced>label:first-child{min-width:150px;flex:1}
            #${ROOT_ID} .sh-status{margin-top:6px;min-height:15px;color:#70552e}.sh-status.ok{color:#246b28}.sh-status.error{color:#a01912}
            #${ROOT_ID} .sh-commands{margin-top:6px;max-height:250px;overflow:auto}
            #${ROOT_ID} .sh-commands table{width:100%;border-collapse:collapse;background:#fff8e8}
            #${ROOT_ID} .sh-commands th,#${ROOT_ID} .sh-commands td{padding:6px;border:1px solid #c9af7a;text-align:left}
            #${ROOT_ID} .sh-command-row{cursor:pointer}.sh-command-row:hover td{background:#fff1c6}.sh-command-row.selected td{background:#dcefd8!important}
            #${ROOT_ID} .sh-tabs-table{margin-top:6px;overflow:auto}
            #${ROOT_ID} .sh-tabs-table table{width:100%;border-collapse:collapse;background:#fff8e8;font-size:11px}
            #${ROOT_ID} .sh-tabs-table th,#${ROOT_ID} .sh-tabs-table td{padding:4px;border:1px solid #c9af7a;text-align:left;white-space:nowrap}
            #${ROOT_ID} .sh-tab-armed{color:#9c1710;font-weight:700}
            #${ROOT_ID} .sh-tab-current{background:#f1dfb4}
            #${ROOT_ID}.compact .sh-grid,#${ROOT_ID}.compact .sh-sync,#${ROOT_ID}.compact .sh-selected,#${ROOT_ID}.compact .sh-details{display:none}
            #${ROOT_ID}.compact .sh-body{padding:6px}
            #${ROOT_ID}.compact .sh-main-action{margin-top:6px}
            @media(max-width:600px){#${ROOT_ID}{max-width:100%;margin:6px 0}#${ROOT_ID} .sh-grid{grid-template-columns:1fr 1fr}#${ROOT_ID} .sh-grid label:first-child,#${ROOT_ID} .sh-grid .sh-wide-mobile{grid-column:1/-1}#${ROOT_ID} .sh-field-label{min-height:18px}#${ROOT_ID} .sh-summary{grid-template-columns:1fr}#${ROOT_ID} input{font-size:16px;height:40px}#${ROOT_ID} button{font-size:14px;min-height:38px}#${ROOT_ID} .sh-sync{display:block}#${ROOT_ID} .sh-sync-buttons{margin-top:5px;justify-content:stretch}#${ROOT_ID} .sh-sync button{flex:1;min-width:0;padding:3px 4px;font-size:13px}#${ROOT_ID} .sh-advanced{display:grid;grid-template-columns:1fr}#${ROOT_ID} .sh-commands{max-height:210px;overflow:auto}}
        `;
        document.head.appendChild(style);
    }

    function createPanel(anchor) {
        document.getElementById(ROOT_ID)?.remove();
        const panel = document.createElement('section');
        panel.id = ROOT_ID;
        panel.innerHTML = `
            <div class="sh-head"><span>Snipe-Helfer</span><span class="sh-version">Version ${VERSION}</span></div>
            <div class="sh-body">
                <div class="sh-progress"><div id="sh-progress-value" class="sh-progress-value"></div><div id="sh-clock" class="sh-clock">--:--:--.---</div></div>
                <div class="sh-grid">
                    <label><span class="sh-field-label">Datum und Uhrzeit</span><input id="sh-target" type="datetime-local" step="60" max="9999-12-31T23:59"></label>
                    <label><span class="sh-field-label">Sekunden</span><input id="sh-seconds" type="number" min="0" max="59" step="1" inputmode="numeric"></label>
                    <label><span class="sh-field-label">Millisekunden</span><input id="sh-ms" type="number" min="0" max="999" step="1" inputmode="numeric"></label>
                    <label class="sh-wide-mobile"><span class="sh-field-label">Versatz (ms)</span><input id="sh-delay" type="number" min="-9999" max="9999" step="1" inputmode="numeric"></label>
                </div>
                <div class="sh-sync"><span class="sh-sync-label">Relative Ankunft</span><div class="sh-sync-buttons"><button type="button" data-sh-offset="-1000">−1 s</button><button type="button" data-sh-offset="0">Gleichzeitig</button><button type="button" data-sh-offset="1000">+1 s</button></div></div>
                <div class="sh-summary">
                    <div class="sh-card"><span>Effektive Ankunft</span><strong id="sh-effective-target">—</strong></div>
                    <div class="sh-card"><span>Absendezeit</span><strong id="sh-send-time">—</strong></div>
                </div>
                <div id="sh-countdown" class="sh-countdown neutral">Keine Zielzeit gesetzt</div>
                <div class="sh-main-action"><button id="sh-auto-send" type="button">Auto-Senden vorbereiten</button></div>
                <div id="sh-selected-command" class="sh-selected" hidden></div>
                <details id="sh-command-details" class="sh-details"><summary id="sh-command-summary">Laufende Angriffe</summary><div class="sh-details-body"><button id="sh-reload" type="button">Angriffe neu laden</button><div id="sh-commands" class="sh-commands"></div></div></details>
                <details id="sh-tabs-details" class="sh-details"><summary id="sh-tabs-summary">Verbundene Tabs (1)</summary><div class="sh-details-body"><button id="sh-share-target" type="button">Zielzeit an Tabs senden</button><div id="sh-tabs-table" class="sh-tabs-table"></div></div></details>
                <details class="sh-details"><summary>Erweiterte Einstellungen</summary><div class="sh-details-body sh-advanced"><label><span class="sh-field-label">Sendeausgleich (ms)</span><input id="sh-send-correction" type="number" min="0" max="2000" step="10" inputmode="numeric"></label><label class="sh-check"><input id="sh-remember" type="checkbox"> Eingaben merken</label><button id="sh-clear" type="button">Zeit zurücksetzen</button></div></details>
                <div id="sh-status" class="sh-status">Bereit.</div>
            </div>`;
        const commandTable = anchor.closest('table');
        if (commandTable) commandTable.insertAdjacentElement('afterend', panel);
        else anchor.insertAdjacentElement('afterend', panel);
        return panel;
    }

    function bindInputs(panel) {
        const target = panel.querySelector('#sh-target');
        const seconds = panel.querySelector('#sh-seconds');
        const ms = panel.querySelector('#sh-ms');
        const delay = panel.querySelector('#sh-delay');
        const sendCorrection = panel.querySelector('#sh-send-correction');
        const remember = panel.querySelector('#sh-remember');
        const offsetButtons = [...panel.querySelectorAll('[data-sh-offset]')];
        const updateOffsetButtons = () => offsetButtons.forEach(button => {
            button.classList.toggle('active', Number(button.dataset.shOffset) === state.delay);
        });

        target.value = toMinuteInput(state.targetTime);
        seconds.value = Number.isFinite(state.targetTime) ? new Date(state.targetTime).getSeconds() : 0;
        ms.value = state.milliseconds;
        delay.value = state.delay;
        sendCorrection.value = state.sendCorrection;
        remember.checked = state.remember;
        updateOffsetButtons();

        target.addEventListener('input', () => {
            disarmAutoSend();
            const date = new Date(target.value);
            if (Number.isFinite(date.getTime())) {
                date.setSeconds(clampInt(seconds.value, 0, 59), 0);
                state.targetTime = date.getTime();
            } else state.targetTime = null;
            state.soundPlayed = false;
            saveSettings(); renderTime();
        });
        seconds.addEventListener('input', () => {
            disarmAutoSend();
            const value = clampInt(seconds.value, 0, 59);
            seconds.value = value;
            if (Number.isFinite(state.targetTime)) {
                const date = new Date(state.targetTime);
                date.setSeconds(value, 0);
                state.targetTime = date.getTime();
            }
            state.soundPlayed = false; saveSettings(); renderTime();
        });
        ms.addEventListener('input', () => { disarmAutoSend(); state.milliseconds = clampInt(ms.value, 0, 999); ms.value = state.milliseconds; state.soundPlayed = false; saveSettings(); renderTime(); });
        delay.addEventListener('input', () => { disarmAutoSend(); state.delay = clampInt(delay.value, -9999, 9999); delay.value = state.delay; state.soundPlayed = false; updateOffsetButtons(); saveSettings(); renderTime(); });
        sendCorrection.addEventListener('input', () => { disarmAutoSend(); state.sendCorrection = clampInt(sendCorrection.value, 0, 2000, 150); sendCorrection.value = state.sendCorrection; state.soundPlayed = false; saveSettings(); renderTime(); });
        remember.addEventListener('change', () => { state.remember = remember.checked; saveSettings(); setStatus(state.remember ? 'Eingaben werden für diese Welt gespeichert.' : 'Gespeicherte Zeitwerte wurden entfernt.', 'ok'); });
        panel.querySelector('#sh-clear').addEventListener('click', event => {
            event.preventDefault();
            disarmAutoSend();
            state.targetTime = createPlausibleTarget(); state.milliseconds = 0; state.delay = 0; state.soundPlayed = false;
            target.value = toMinuteInput(state.targetTime); seconds.value = new Date(state.targetTime).getSeconds(); ms.value = 0; delay.value = 0; updateOffsetButtons(); saveSettings(); renderTime(); setStatus('Zielzeit wurde auf den nächsten sinnvollen Zeitpunkt gesetzt.', 'ok');
        });
        panel.querySelector('#sh-reload').addEventListener('click', event => { event.preventDefault(); loadCommands(true); });
        panel.querySelector('#sh-share-target').addEventListener('click', event => {
            event.preventDefault();
            const targetTime = effectiveTarget();
            if (!Number.isFinite(targetTime)) {
                setStatus('Es gibt keine gültige Zielzeit zum Verteilen.', 'error');
                return;
            }
            sendTabMessage({ type: 'sync-target', targetTime });
            setStatus(`Zielzeit ${formatDateTime(targetTime, true)} wurde an die verbundenen Tabs gesendet.`, 'ok');
            broadcastStatus(true);
        });
        offsetButtons.forEach(button => button.addEventListener('click', event => {
            event.preventDefault();
            disarmAutoSend();
            state.delay = clampInt(button.dataset.shOffset, -9999, 9999);
            delay.value = state.delay;
            state.soundPlayed = false;
            updateOffsetButtons();
            saveSettings(); renderTime();
            setStatus(state.delay === 0 ? 'Gleichzeitige Ankunft eingestellt.' : `${Math.abs(state.delay / 1000)} Sekunde${Math.abs(state.delay) === 1000 ? '' : 'n'} ${state.delay < 0 ? 'früher' : 'später'} eingestellt.`, 'ok');
        }));
        panel.querySelector('#sh-auto-send').addEventListener('click', event => {
            event.preventDefault();
            if (state.autoSendArmed) {
                disarmAutoSend('Auto-Senden wurde abgebrochen.');
                return;
            }
            const send = sendTimestamp();
            if (!Number.isFinite(send)) {
                setStatus('Bitte zuerst eine gültige Zielzeit festlegen.', 'error');
                return;
            }
            if (send - serverNow() < 1500) {
                setStatus('Zum Scharfschalten muss die Absendezeit mindestens 1,5 Sekunden in der Zukunft liegen.', 'error');
                return;
            }
            state.autoSendArmed = true;
            state.autoSent = false;
            panel.classList.add('compact');
            event.currentTarget.classList.add('armed');
            event.currentTarget.textContent = 'SCHARF – zum Abbrechen klicken';
            setStatus(`Auto-Senden ist scharf für ${formatDateTime(send, true)}.`, 'ok');
            broadcastStatus(true);
            scheduleAutoSend();
        });
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
        const details = document.querySelector('#sh-command-details');
        const summary = document.querySelector('#sh-command-summary');
        const selected = document.querySelector('#sh-selected-command');
        if (!container) return;
        const villageId = findVillageId();
        if (!villageId || !window.game_data?.link_base_pure) {
            container.innerHTML = '';
            if (summary) summary.textContent = 'Laufende Angriffe (0)';
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
                if (summary) summary.textContent = 'Laufende Angriffe (0)';
                if (details) details.open = false;
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
                        if (selected) {
                            selected.hidden = false;
                            selected.textContent = `Gewählter Angriff · Ankunft ${arrivalText.replace(/\s+/g, ' ').trim()}`;
                        }
                        if (details) details.open = false;
                    } else setStatus('Die Ankunftszeit dieser Zeile konnte nicht gelesen werden.', 'error');
                });
            });
            container.replaceChildren(table);
            if (summary) summary.textContent = `Laufende Angriffe (${rows.length})`;
            if (details) details.open = rows.length > 0 && !state.selectedRow;
            setStatus(`${rows.length} laufende${rows.length === 1 ? 'r Befehl' : ' Befehle'} geladen. Zum Übernehmen eine Zeile antippen.`, rows.length ? 'ok' : '');
        } catch (error) {
            console.error('[Snipe-Helfer] Fehler beim Laden der Befehle:', error);
            container.innerHTML = '';
            if (summary) summary.textContent = 'Laufende Angriffe (Fehler)';
            setStatus('Laufende Angriffe konnten nicht geladen werden.', 'error');
        }
    }

    function stop() {
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        if (state.autoTimer) clearTimeout(state.autoTimer);
        state.autoTimer = null;
        state.autoSendArmed = false;
        state.active = false;
        cleanupTabSync();
        document.title = state.originalTitle;
        if ($doc) $doc(window.TribalWars).off(TICK_NS);
    }

    async function start() {
        if (state.active || document.getElementById(ROOT_ID)) return;
        const arrivalBox = document.getElementById('date_arrival');
        const form = document.getElementById('command-data-form');
        if (!arrivalBox || !form) return;

        state.active = true;
        state.settings = loadSettings();
        state.duration = getDuration();
        state.remember = state.settings.remember;
        state.targetTime = state.remember && Number.isFinite(state.settings.targetTime) ? state.settings.targetTime : createPlausibleTarget();
        state.milliseconds = state.remember ? state.settings.milliseconds : 0;
        state.delay = state.remember ? state.settings.delay : 0;
        state.sendCorrection = state.remember ? state.settings.sendCorrection : 150;
        createStyles();
        const panel = createPanel(arrivalBox);
        bindInputs(panel);
        initTabSync();
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
