/* Separate presenter view. Loaded by present.js only after a user opens notes.
 * The popup starts at about:blank and inherits the opener's origin, including file://.
 * Preview frames are sandboxed still images: no slide script runs in them.
 */
(function () {
  'use strict';

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }

  var CSS = [
    '* { box-sizing: border-box; }',
    'html, body { margin: 0; height: 100%; }',
    'body { background: #f1f5f9; color: #0f172a; font-family: "Atkinson Hyperlegible", "Noto Sans KR", system-ui, sans-serif; display: flex; flex-direction: column; }',
    '[hidden] { display: none !important; }',
    'button, input { font: inherit; }',
    'button { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; padding: 9px 13px; border-radius: 8px; cursor: pointer; }',
    'button:hover:not(:disabled) { background: #eff6ff; border-color: #93c5fd; }',
    'button:focus-visible, input:focus-visible, #notes:focus-visible { outline: 3px solid #3b82f6; outline-offset: 2px; }',
    'button:disabled { opacity: .45; cursor: default; }',
    'header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 22px; background: #fff; border-bottom: 1px solid #e2e8f0; }',
    'h1 { margin: 0; font-size: 22px; }',
    '#connection { color: #475569; font-size: 13px; margin-top: 5px; }',
    '#connection.offline { color: #b91c1c; }',
    '.clock { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }',
    '#elapsed { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 92px; }',
    '.clock-label { font-size: 12px; color: #64748b; }',
    'main { display: grid; grid-template-columns: minmax(240px, 30%) minmax(0, 1fr); gap: 18px; padding: 18px 22px; min-height: 0; flex: 1; }',
    '.preview-column { overflow-y: auto; min-height: 0; }',
    '.preview-heading { margin: 0 0 8px; color: #475569; font-size: 13px; font-weight: 700; }',
    '.preview-box { position: relative; width: 100%; aspect-ratio: 16/9; background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 9px; overflow: hidden; }',
    '.preview-box iframe { border: 0; position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; background: #fff; }',
    '.preview-label { font-size: 13px; color: #475569; line-height: 1.45; margin: 7px 0 18px; overflow-wrap: anywhere; }',
    '.help { color: #64748b; font-size: 13px; line-height: 1.6; margin: 15px 0 0; }',
    '.notes-column { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #fff; border: 1px solid #dbe3ed; border-radius: 12px; }',
    '.notes-heading { padding: 17px 22px; border-bottom: 1px solid #e2e8f0; }',
    '.notes-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }',
    '#slide-count { color: #1d4ed8; font-size: 14px; font-weight: 700; }',
    '#note-title { font-size: 21px; margin: 8px 0 0; line-height: 1.3; overflow-wrap: anywhere; }',
    '.font-buttons { display: flex; align-items: center; gap: 7px; }',
    '#font-size { font-size: 13px; color: #64748b; min-width: 36px; text-align: center; }',
    '#notes { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 28px 36px; font-size: 32px; line-height: 1.5; overflow-wrap: anywhere; }',
    '#notes p { margin: 0 0 .8em; }',
    '#notes p:last-child { margin-bottom: 0; }',
    '#notes ul, #notes ol { padding-left: 1.25em; }',
    '#notes pre { white-space: pre-wrap; }',
    '#notes.empty { color: #64748b; font-size: 25px; }',
    '#notes strong { color: #1d4ed8; }',
    '#disconnect-message { margin: 0; padding: 13px 22px; background: #fee2e2; color: #991b1b; font-size: 15px; line-height: 1.5; }',
    'footer { background: #fff; border-top: 1px solid #e2e8f0; padding: 12px 22px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: space-between; }',
    '.controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
    '.nav { min-width: 98px; font-weight: 700; }',
    '#next { color: #fff; background: #1d4ed8; border-color: #1d4ed8; }',
    '#next:hover:not(:disabled) { background: #1e40af; }',
    '#jump { width: 70px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }',
    'label[for="jump"] { font-size: 13px; color: #475569; }',
    '#blank[aria-pressed="true"] { color: #fff; background: #334155; }',
    '@media (max-width: 900px) { main { grid-template-columns: minmax(160px, 24%) minmax(0, 1fr); padding: 12px; gap: 12px; } header { padding: 12px; } .clock button { padding: 7px; } #notes { padding: 20px; } }',
    '@media (max-width: 620px) { header { align-items: flex-start; flex-direction: column; gap: 10px; } main { display: flex; } .preview-column { display: none; } .notes-column { flex: 1; } footer { padding: 10px 12px; } #notes { padding: 16px; } }'
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
      '<header><div><h1>발표자 노트</h1><div id="connection" role="status">슬라이드 창에 연결됨</div></div>' +
      '<div class="clock"><div><div class="clock-label">경과 시간</div><output id="elapsed">00:00</output></div><button id="timer-toggle" type="button">타이머 시작</button><button id="timer-reset" type="button">타이머 초기화</button></div></header>' +
      '<p id="disconnect-message" role="alert" hidden>슬라이드 창 연결이 끊겼습니다. 슬라이드 창에서 N을 눌러 새 발표자 창을 여세요.</p>' +
      '<main><aside class="preview-column"><h2 class="preview-heading">현재 슬라이드 · 정지 미리보기</h2><div class="preview-box"><iframe id="current-preview" title="현재 슬라이드 미리보기" sandbox="allow-same-origin" tabindex="-1"></iframe></div><p id="current-label" class="preview-label"></p>' +
      '<h2 class="preview-heading">다음 슬라이드 · 정지 미리보기</h2><div class="preview-box"><iframe id="next-preview" title="다음 슬라이드 미리보기" sandbox="allow-same-origin" tabindex="-1"></iframe></div><p id="next-label" class="preview-label"></p>' +
      '<p class="help">확장 화면에서 노트 창은 노트북에, 슬라이드 창은 프로젝터에 두세요. 슬라이드 창에서 F를 누르면 전체 화면이 됩니다.<br><br>영상은 청중 화면에서 재생됩니다. 미리보기에는 정지 화면만 표시됩니다.</p></aside>' +
      '<section class="notes-column" aria-label="현재 슬라이드 대본"><div class="notes-heading"><div class="notes-topline"><span id="slide-count"></span><div class="font-buttons"><button id="font-smaller" type="button" aria-label="대본 글씨 줄이기">A−</button><span id="font-size">32px</span><button id="font-larger" type="button" aria-label="대본 글씨 키우기">A＋</button></div></div><h2 id="note-title"></h2></div><div id="notes" tabindex="0"></div></section></main>' +
      '<footer><div class="controls"><button id="prev" class="nav" type="button">← 이전</button><button id="next" class="nav" type="button">다음 →</button><label for="jump">장 이동</label><input id="jump" type="number" min="1" step="1" aria-label="이동할 슬라이드 번호"></div>' +
      '<div class="controls"><button id="media-toggle" type="button">재생 / 일시정지 (P)</button><button id="media-reset" type="button">처음으로 (R)</button><button id="blank" type="button" aria-pressed="false">청중 화면 끄기 (B)</button></div></footer>';

    function el(id) { return doc.getElementById(id); }
    var notes = el('notes');
    var current = null;
    var lastNotes = null;
    var fontSize = 32;
    var scrollPositions = {};
    var timerRunning = false, elapsed = 0, startedAt = 0;
    var disconnected = false, destroyed = false;
    var interval, unsubscribe;

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
      disconnected = true; stopTimer();
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
    function renderPreview(frame, label, index) {
      var data = api.preview(index);
      if (!data) {
        frame.srcdoc = '<!doctype html><html lang="ko"><body style="font:32px system-ui;padding:70px;color:#64748b">다음 슬라이드가 없습니다.</body></html>';
        frame.dataset.width = '640'; frame.dataset.height = '360';
        label.textContent = '마지막 슬라이드'; sizePreview(frame); return;
      }
      frame.dataset.width = String(data.width); frame.dataset.height = String(data.height);
      var reset = 'html,body{width:' + data.width + 'px;height:' + data.height + 'px;margin:0!important;padding:0!important;overflow:hidden;background:white}' +
        'deck-stage{display:block!important;margin:0!important;padding:0!important}' +
        '.slide{position:relative!important;left:auto!important;top:auto!important;width:' + data.width + 'px!important;height:' + data.height + 'px!important;margin:0!important;transform:none!important;box-shadow:none!important}' +
        '.speaker-notes,[data-speaker-notes],.present-btn,.present-status{display:none!important}' +
        '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + escapeHTML(data.baseURL) + '">' + data.styles + '<style>' + reset + '</style></head><body>' + data.html + '</body></html>';
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
      el('blank').textContent = state.blank ? '청중 화면 켜기 (B)' : '청중 화면 끄기 (B)';
      el('blank').setAttribute('aria-pressed', String(state.blank));
      el('connection').textContent = state.blank ? '연결됨 · 청중 화면 꺼짐' : '슬라이드 창에 연결됨';
      if (changed) {
        renderPreview(el('current-preview'), el('current-label'), state.index);
        renderPreview(el('next-preview'), el('next-label'), state.index + 1);
      }
    }
    function setFont(value) {
      fontSize = Math.max(20, Math.min(64, value));
      notes.style.fontSize = fontSize + 'px'; el('font-size').textContent = fontSize + 'px';
      el('font-smaller').disabled = fontSize <= 20; el('font-larger').disabled = fontSize >= 64;
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
