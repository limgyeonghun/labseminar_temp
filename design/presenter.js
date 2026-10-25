/* Separate presenter view. Loaded by present.js only after a user opens notes.
 * The popup starts at about:blank and inherits the opener's origin, including file://.
 * Sandboxed previews run no slide scripts. The current preview mirrors source
 * canvas/video frames and DOM; the next preview remains a still image.
 * Layout follows a slide-show presenter view: current slide left, next slide and script right.
 */
(function () {
  'use strict';

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }

  // Dark application chrome; slide previews keep the deck's own colours.
  var CSS = [
    ':root { color-scheme: dark; }',
    '* { box-sizing: border-box; }',
    'html, body { margin: 0; height: 100%; }',
    'body { background: #0b1120; color: #e2e8f0; font-family: "Atkinson Hyperlegible", "Noto Sans KR", system-ui, sans-serif; display: flex; flex-direction: column; }',
    '[hidden] { display: none !important; }',
    'button, input { font: inherit; font-size: 14px; }',
    'button { border: 1px solid #334155; background: #1e293b; color: #e2e8f0; padding: 7px 12px; border-radius: 7px; cursor: pointer; white-space: nowrap; }',
    'button:hover:not(:disabled) { background: #273449; border-color: #60a5fa; }',
    'button:focus-visible, input:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }',
    'button:disabled { opacity: .4; cursor: default; }',
    'header { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px 16px; padding: 8px 16px; background: #111827; border-bottom: 1px solid #1f2937; }',
    '.brand { display: flex; align-items: baseline; gap: 12px; min-width: 0; }',
    'h1 { margin: 0; font-size: 16px; color: #f8fafc; white-space: nowrap; }',
    '#connection { color: #94a3b8; font-size: 13px; }',
    '#connection::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: #22c55e; }',
    '#connection.offline { color: #fca5a5; }',
    '#connection.offline::before { background: #f87171; }',
    '.clock, .script-tools, .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
    '.script-tools { justify-self: end; }',
    '.clock-label, .tool-label, #font-size, label[for="jump"], #jump-total { font-size: 12px; color: #94a3b8; }',
    '#elapsed { min-width: 72px; font-size: 24px; font-weight: 700; color: #f8fafc; font-variant-numeric: tabular-nums; text-align: center; }',
    '#font-size { min-width: 34px; text-align: center; }',
    '#reading-toggle[aria-pressed="true"] { background: #1d4ed8; border-color: #93c5fd; color: #fff; }',
    '#disconnect-message { margin: 0; padding: 10px 16px; background: #450a0a; color: #fecaca; font-size: 14px; line-height: 1.5; border-bottom: 1px solid #7f1d1d; }',
    'main { flex: 1; min-height: 0; overflow: hidden; display: grid; gap: 14px 16px; padding: 14px 16px; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "current next" "current notes" "help notes"; }',
    'main.reading { grid-template-columns: minmax(0, 9fr) minmax(0, 16fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "current notes" "next notes" ". notes" "help notes"; }',
    '.current-pane { grid-area: current; min-width: 0; min-height: 0; overflow: hidden; }',
    '.next-pane { grid-area: next; min-width: 0; display: grid; grid-template-columns: 54% minmax(0, 1fr); gap: 12px; align-items: start; }',
    '.next-pane .preview-box { order: -1; }',
    '.preview-heading { margin: 0 0 8px; color: #94a3b8; font-size: 12px; font-weight: 700; }',
    '.preview-box { position: relative; width: 100%; aspect-ratio: 16/9; background: #020617; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }',
    '.preview-box iframe { border: 0; position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; background: #fff; }',
    '.slide-caption { display: flex; align-items: baseline; gap: 10px; margin-top: 10px; min-width: 0; }',
    '#slide-count { color: #93c5fd; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }',
    '#note-title { margin: 0; color: #f8fafc; font-size: 18px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }',
    '.preview-label { margin: 0; color: #cbd5e1; font-size: 15px; line-height: 1.4; overflow-wrap: anywhere; }',
    '.help { grid-area: help; align-self: end; margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5; word-break: keep-all; }',
    '.notes-pane { grid-area: notes; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #111827; border: 1px solid #1f2937; border-radius: 10px; }',
    '#notes { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px 32px; border-radius: 10px; color: #f8fafc; font-size: 32px; line-height: 1.5; word-break: keep-all; overflow-wrap: anywhere; }',
    '#notes:focus-visible { outline: 2px solid rgba(147, 197, 253, .55); outline-offset: -2px; }',
    '#notes p { margin: 0 0 .7em; }',
    '#notes p:last-child { margin-bottom: 0; }',
    '#notes ul, #notes ol { padding-left: 1.25em; }',
    '#notes pre { white-space: pre-wrap; }',
    '#notes.empty { color: #94a3b8; font-size: 24px; }',
    '#notes strong { color: #93c5fd; }',
    'footer { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; padding: 8px 16px; background: #111827; border-top: 1px solid #1f2937; }',
    '.nav { min-width: 92px; font-weight: 700; }',
    '#next { color: #fff; background: #2563eb; border-color: #2563eb; }',
    '#next:hover:not(:disabled) { background: #1d4ed8; border-color: #93c5fd; }',
    '#jump { width: 64px; padding: 6px 8px; border: 1px solid #334155; border-radius: 6px; background: #0b1120; color: #f8fafc; }',
    '#blank[aria-pressed="true"] { background: #fbbf24; border-color: #fbbf24; color: #0f172a; }',
    // Narrow windows always give the script the wide column.
    '@media (max-width: 900px) { header { display: flex; flex-wrap: wrap; } .script-tools { margin-left: auto; } #reading-toggle, .help { display: none; } main, main.reading { grid-template-columns: minmax(0, 9fr) minmax(0, 16fr); grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "current notes" "next notes" ". notes"; gap: 10px 12px; padding: 10px 12px; } .next-pane { grid-template-columns: minmax(0, 1fr); gap: 6px; } #notes { padding: 16px 18px 24px; } }',
    '@media (max-width: 620px) { main, main.reading { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); grid-template-areas: "notes"; } .current-pane, .next-pane { display: none; } #notes { padding: 14px; } }'
  ].join('\n');

  function mount(win, api) {
    if (win.closed) return;
    if (win.__SUVPresenterCleanup) win.__SUVPresenterCleanup();
    var doc = win.document;
    doc.open();
    doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>발표자 노트 · SUV Lab</title></head><body></body></html>');
    doc.close();
    var style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
    doc.body.innerHTML =
      '<header><div class="brand"><h1>발표자 노트</h1><div id="connection" role="status">슬라이드 창에 연결됨</div></div>' +
      '<div class="clock"><span class="clock-label">경과 시간</span><output id="elapsed">00:00</output><button id="timer-toggle" type="button">타이머 시작</button><button id="timer-reset" type="button">타이머 초기화</button></div>' +
      '<div class="script-tools"><span class="tool-label">대본 글씨</span><button id="font-smaller" type="button" aria-label="대본 글씨 줄이기">A−</button><span id="font-size">32px</span><button id="font-larger" type="button" aria-label="대본 글씨 키우기">A＋</button>' +
      '<button id="reading-toggle" type="button" aria-pressed="false">대본 중심</button></div></header>' +
      '<p id="disconnect-message" role="alert" hidden>슬라이드 창 연결이 끊겼습니다. 슬라이드 창에서 N을 눌러 새 발표자 창을 여세요.</p>' +
      '<main><section class="current-pane" aria-label="현재 슬라이드"><h2 class="preview-heading">현재 슬라이드 · 실시간 미리보기</h2>' +
      '<div class="preview-box"><iframe id="current-preview" title="현재 슬라이드 미리보기" sandbox="allow-same-origin allow-scripts" tabindex="-1"></iframe></div>' +
      '<p id="current-label" hidden></p><div class="slide-caption"><span id="slide-count"></span><p id="note-title"></p></div></section>' +
      '<section class="next-pane" aria-label="다음 슬라이드"><div><h2 class="preview-heading">다음 슬라이드 · 정지 미리보기</h2><p id="next-label" class="preview-label"></p></div>' +
      '<div class="preview-box"><iframe id="next-preview" title="다음 슬라이드 미리보기" sandbox="allow-same-origin" tabindex="-1"></iframe></div></section>' +
      '<section class="notes-pane" aria-label="현재 슬라이드 대본"><div id="notes" tabindex="0"></div></section>' +
      '<p class="help">노트 창은 노트북, 슬라이드 창은 프로젝터에 둡니다. 슬라이드 창에서 F를 누르면 전체 화면이 됩니다. 현재 슬라이드의 애니메이션과 영상이 청중 화면에 맞춰 표시됩니다.</p></main>' +
      '<footer><div class="controls"><button id="prev" class="nav" type="button">← 이전</button><button id="next" class="nav" type="button">다음 →</button>' +
      '<label for="jump">장 이동</label><input id="jump" type="number" min="1" step="1" aria-label="이동할 슬라이드 번호"><span id="jump-total"></span></div>' +
      '<div class="controls"><button id="media-toggle" type="button">재생 / 일시정지 (P)</button><button id="media-reset" type="button">처음으로 (R)</button><button id="blank" type="button" aria-pressed="false">청중 화면 끄기 (B)</button></div></footer>';

    function el(id) { return doc.getElementById(id); }
    var layout = doc.querySelector('main');
    var notes = el('notes');
    var current = null;
    var lastNotes = null;
    var fontSize = 32;
    var reading = false;
    var scrollPositions = {};
    var scrollRatios = {};
    var timerRunning = false, elapsed = 0, startedAt = 0;
    var disconnected = false, destroyed = false;
    var interval, unsubscribe;
    var liveMirror = null, liveFrame = 0, previewGeneration = 0;

    function timerValue() { return elapsed + (timerRunning ? win.performance.now() - startedAt : 0); }
    function paintTimer() {
      var seconds = Math.floor(timerValue() / 1000);
      el('elapsed').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      el('timer-toggle').textContent = timerRunning ? '타이머 일시정지' : '타이머 시작';
    }
    function stopTimer() {
      if (timerRunning) { elapsed = timerValue(); timerRunning = false; }
      paintTimer();
    }
    function disconnect() {
      if (disconnected || destroyed) return;
      disconnected = true; stopTimer(); stopLivePreview();
      el('connection').textContent = '슬라이드 창 연결 끊김';
      el('connection').className = 'offline';
      el('disconnect-message').hidden = false;
      [].forEach.call(doc.querySelectorAll('button, input'), function (control) { control.disabled = true; });
    }
    function connected() {
      if (disconnected || destroyed) return false;
      try { if (api.connected()) return true; } catch (e) { /* Opener was closed/navigated. */ }
      disconnect(); return false;
    }
    function action(fn) {
      if (!connected()) return;
      try { fn(); } catch (e) { if (!api.connected()) disconnect(); else throw e; }
    }
    function sizePreview(frame) {
      var width = Number(frame.dataset.width) || 1920;
      var height = Number(frame.dataset.height) || 1080;
      frame.style.width = width + 'px'; frame.style.height = height + 'px';
      frame.style.transform = 'scale(' + (frame.parentNode.clientWidth / width) + ')';
    }
    function stopLivePreview() {
      previewGeneration++;
      if (liveFrame) win.cancelAnimationFrame(liveFrame);
      liveFrame = 0;
      if (liveMirror) liveMirror.close();
      liveMirror = null;
      el('current-preview').onload = null;
    }
    function renderPreview(frame, label, index, live) {
      if (live) stopLivePreview();
      var generation = previewGeneration;
      var data = api.preview(index, !!live);
      if (live && data && api.mirrorPreview) {
        frame.onload = function () {
          if (destroyed || disconnected || generation !== previewGeneration || !current || current.index !== index) return;
          var previewDocument = frame.contentDocument;
          // A late load from the previous srcdoc must never bind the wrong slide.
          if (!previewDocument || !previewDocument.body || previewDocument.body.getAttribute('data-suv-preview-index') !== String(index)) return;
          var slide = previewDocument.querySelector('.slide');
          if (!slide) return;
          if (liveFrame) win.cancelAnimationFrame(liveFrame);
          if (liveMirror) liveMirror.close();
          liveMirror = api.mirrorPreview(index, slide);
          if (!liveMirror) return;
          liveMirror.update();
          var last = 0;
          function tick(now) {
            liveFrame = 0;
            if (destroyed || disconnected || generation !== previewGeneration || !connected()) return;
            // Canvas pixels are copied directly, without PNG encoding, duplicate
            // playback clocks, audio, or iframe reloads. Limit work to 30 fps.
            if (now - last >= 1000 / 30) {
              last = now - ((now - last) % (1000 / 30));
              if (!liveMirror || !liveMirror.update()) { stopLivePreview(); return; }
            }
            liveFrame = win.requestAnimationFrame(tick);
          }
          liveFrame = win.requestAnimationFrame(tick);
        };
      }
      if (!data) {
        frame.srcdoc = '<!doctype html><html lang="ko"><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font:600 34px system-ui,sans-serif;color:#94a3b8;background:#111827">다음 슬라이드가 없습니다.</body></html>';
        frame.dataset.width = '640'; frame.dataset.height = '360';
        label.textContent = '마지막 슬라이드'; sizePreview(frame); return;
      }
      frame.dataset.width = String(data.width); frame.dataset.height = String(data.height);
      var reset = 'html,body{width:' + data.width + 'px;height:' + data.height + 'px;margin:0!important;padding:0!important;overflow:hidden;background:white}' +
        'deck-stage{display:block!important;margin:0!important;padding:0!important}' +
        '.slide{position:relative!important;left:auto!important;top:auto!important;width:' + data.width + 'px!important;height:' + data.height + 'px!important;margin:0!important;transform:none!important;box-shadow:none!important}' +
        '.speaker-notes,[data-speaker-notes],.present-btn,.present-status{display:none!important}' +
        '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
      // Canvas displays its fallback instead of its bitmap when sandbox scripting
      // is disabled. Enable that browser capability only for the current frame,
      // while CSP still forbids every script/event handler, plugin and child frame.
      // Source scripts are also removed before constructing or patching the clone.
      var policy = "script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'";
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + escapeHTML(policy) + '"><base href="' + escapeHTML(data.baseURL) + '">' + data.styles + '<style>' + reset + '</style></head><body data-suv-preview-index="' + index + '">' + data.html + '</body></html>';
      label.textContent = data.title; sizePreview(frame);
    }
    function render(state) {
      if (destroyed) return;
      if (!state.connected) { disconnect(); return; }
      if (!connected()) return;
      var changed = !current || state.index !== current.index;
      if (changed && current) scrollPositions[current.index] = notes.scrollTop;
      if (changed || state.notesHTML !== lastNotes) {
        var previousScroll = notes.scrollTop;
        notes.classList.toggle('empty', !state.notesHTML);
        if (state.notesHTML) notes.innerHTML = state.notesHTML;
        else notes.textContent = '이 슬라이드에는 발표자 노트가 없습니다.';
        notes.scrollTop = changed ? (scrollPositions[state.index] || 0) : previousScroll;
        lastNotes = state.notesHTML;
      }
      current = state;
      el('slide-count').textContent = (state.index + 1) + ' / ' + state.count;
      el('note-title').textContent = state.title;
      el('prev').disabled = state.index <= 0;
      el('next').disabled = state.index >= state.count - 1;
      el('jump').max = String(state.count); el('jump').value = String(state.index + 1);
      el('jump-total').textContent = '/ ' + state.count;
      el('blank').textContent = state.blank ? '청중 화면 켜기 (B)' : '청중 화면 끄기 (B)';
      el('blank').setAttribute('aria-pressed', String(state.blank));
      el('connection').textContent = state.blank ? '연결됨 · 청중 화면 꺼짐' : '슬라이드 창에 연결됨';
      if (changed) {
        renderPreview(el('current-preview'), el('current-label'), state.index, true);
        renderPreview(el('next-preview'), el('next-label'), state.index + 1);
      }
    }
    function setFont(value) {
      fontSize = Math.max(20, Math.min(64, value));
      notes.style.fontSize = fontSize + 'px'; el('font-size').textContent = fontSize + 'px';
      el('font-smaller').disabled = fontSize <= 20; el('font-larger').disabled = fontSize >= 64;
    }
    function setReading(on) {
      // Keep the same part of a long script in view while the text reflows.
      var range = notes.scrollHeight - notes.clientHeight;
      // A script may fit entirely in reading mode. Retain this slide's last
      // scrollable position so returning to the narrower layout restores it.
      if (range > 0) scrollRatios[current.index] = notes.scrollTop / range;
      var ratio = scrollRatios[current.index] || 0;
      reading = on;
      layout.classList.toggle('reading', on);
      el('reading-toggle').setAttribute('aria-pressed', String(on));
      el('reading-toggle').textContent = on ? '슬라이드 중심' : '대본 중심';
      resize();
      notes.scrollTop = ratio * (notes.scrollHeight - notes.clientHeight);
    }
    el('prev').onclick = function () { action(api.prev); };
    el('next').onclick = function () { action(api.next); };
    function jumpToSlide() {
      action(function () {
        var index = Number(el('jump').value) - 1;
        if (Number.isInteger(index) && index >= 0 && index < current.count) api.show(index);
        else el('jump').value = String(current.index + 1);
        notes.focus({preventScroll: true});
      });
    }
    el('jump').onchange = jumpToSlide;
    el('jump').onkeydown = function (event) {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault(); event.stopPropagation(); jumpToSlide();
      }
    };
    el('media-toggle').onclick = function () { action(function () { api.media('toggle'); }); };
    el('media-reset').onclick = function () { action(function () { api.media('reset'); }); };
    el('blank').onclick = function () { action(api.toggleBlank); };
    el('font-smaller').onclick = function () { if (connected()) setFont(fontSize - 2); };
    el('font-larger').onclick = function () { if (connected()) setFont(fontSize + 2); };
    el('reading-toggle').onclick = function () { if (connected()) setReading(!reading); };
    el('timer-toggle').onclick = function () {
      if (!connected()) return;
      if (timerRunning) stopTimer();
      else { startedAt = win.performance.now(); timerRunning = true; paintTimer(); }
    };
    el('timer-reset').onclick = function () { if (connected()) { elapsed = 0; startedAt = win.performance.now(); paintTimer(); } };

    function keydown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      var target = event.target;
      if (target && (target.isContentEditable || (target.closest && target.closest('input, textarea, select')))) return;
      if (target && target.closest && target.closest('button') && (event.key === ' ' || event.key === 'Enter')) return;
      if (!connected()) return;
      var key = event.key.toLowerCase(), handled = true;
      if (['arrowright', 'arrowdown', 'pagedown', ' ', 'enter'].indexOf(key) >= 0) action(api.next);
      else if (['arrowleft', 'arrowup', 'pageup', 'backspace'].indexOf(key) >= 0) action(api.prev);
      else if (key === 'home') action(function () { api.show(0); });
      else if (key === 'end') action(function () { api.show(current.count - 1); });
      else if (key === 'p') action(function () { api.media('toggle'); });
      else if (key === 'r') action(function () { api.media('reset'); });
      else if (key === 'b') action(api.toggleBlank);
      else handled = false;
      if (handled) event.preventDefault();
    }
    function pointerControl(event) {
      // Mouse users return to reading/navigation. Keyboard users retain button
      // focus, so Tab and native Space/Enter activation continue to work.
      if (event.detail > 0 && event.target.closest && event.target.closest('button') && connected()) {
        notes.focus({preventScroll: true});
      }
    }
    function resize() { sizePreview(el('current-preview')); sizePreview(el('next-preview')); }
    function cleanup() {
      if (destroyed) return;
      destroyed = true;
      stopLivePreview();
      win.clearInterval(interval);
      if (unsubscribe) unsubscribe();
      doc.removeEventListener('keydown', keydown);
      doc.removeEventListener('click', pointerControl);
      win.removeEventListener('resize', resize);
      win.removeEventListener('pagehide', cleanup);
      win.removeEventListener('beforeunload', cleanup);
      delete win.__SUVPresenterCleanup;
    }
    win.__SUVPresenterCleanup = cleanup;
    doc.addEventListener('keydown', keydown);
    doc.addEventListener('click', pointerControl);
    win.addEventListener('resize', resize);
    win.addEventListener('pagehide', cleanup);
    win.addEventListener('beforeunload', cleanup);
    unsubscribe = api.subscribe(render);
    render(api.getState()); paintTimer();
    interval = win.setInterval(function () { if (connected()) paintTimer(); }, 250);
    notes.focus();
    return cleanup;
  }

  window.SUVPresenter = {mount: mount};
})();
