/* 발표 모드, 발표자 노트와 동영상 지원.
 *
 * 발표: F 키 또는 오른쪽 아래 버튼으로 전체 화면. 슬라이드 하나를 화면 크기에
 * 맞춰 확대하고 나머지는 감춘다. 방향키와 스페이스로 넘기고 Esc 로 빠져나온다.
 * 동영상: 슬라이드가 바뀌면 이전 슬라이드의 재생을 멈추고, data-autoplay 가
 * 붙은 동영상은 현재 슬라이드로 들어올 때 처음부터 재생한다.
 *
 * 인쇄에는 아무 영향이 없다. 버튼은 숨고, 동영상은 poster 프레임으로 찍힌다.
 *
 * 동영상 슬라이드 작성법 - figure.fig 안에서 img 자리에 video 를 넣는다.
 * poster 는 인쇄에 찍히는 정지 화면이므로 반드시 지정한다.
 *
 *   <figure class="fig"><span class="frame">
 *     <video src="imgs/flight.mp4" poster="imgs/flight_poster.jpg"
 *            controls playsinline></video>
 *   </span></figure>
 *
 * 기본값 - 속성을 적지 않아도 이렇게 동작한다.
 *   무음     모든 동영상을 음소거로 강제한다. 파일 자체도 -an 으로 음성 트랙을
 *            빼서 굽는 것을 원칙으로 한다. 발표장에서 소리가 터지지 않게 한다
 *   자동 재생  그 슬라이드로 들어오면 처음부터 재생하고, 벗어나면 멈춘다
 *
 * 기본값을 끄는 속성 - 필요한 경우에만 적는다.
 *   data-noautoplay  자동 재생을 끈다. 발표자가 직접 눌러 재생
 *   data-sound       음소거를 푼다. 소리가 내용의 일부일 때만 쓴다
 *
 *   poster 만들기  ffmpeg -i flight.mp4 -vframes 1 flight_poster.jpg
 *
 * 조작 - F 시작, N 발표자 노트, Esc 종료, 방향키/스페이스 이동,
 *        Home/End 처음과 끝, B 화면 끄기, P 동영상 재생/정지, R 동영상 초기화.
 * 노트 - 각 .slide 안의 <aside class="speaker-notes" hidden>에 작성한다.
 *        presenter.js 를 이 파일과 같은 폴더에 배포한다. N으로 필요할 때만 읽는다.
 * 슬라이드를 누르면 다음 장으로 넘어가고, 동영상 재생 막대는 눌러도 넘어가지 않는다.
 */
(function () {
  'use strict';

  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var deckDocument = document;
  var sourceURL = document.currentScript && document.currentScript.src;
  var presenterURL = new URL('presenter.js', sourceURL || document.baseURI).href;
  var NOTES = '.speaker-notes, [data-speaker-notes]';

  var CSS = [
    '.present-btn {',
    '  position: fixed; right: 24px; bottom: 24px; z-index: 20;',
    '  font-family: "Atkinson Hyperlegible", "Noto Sans KR", system-ui, sans-serif;',
    '  font-size: 20px; font-weight: 700;',
    '  color: #1d4ed8; background: #ffffff; border: 2px solid #93c5fd;',
    '  border-radius: 999px; padding: 10px 22px; cursor: pointer;',
    '  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); opacity: 0.5;',
    '}',
    '.present-btn:hover { opacity: 1; }',
    '.presenter-btn { right: 180px; }',
    '.present-status { position: fixed; right: 24px; bottom: 88px; z-index: 30;',
    '  max-width: 520px; background: #fff; color: #0f172a; padding: 12px 18px;',
    '  border: 1px solid #93c5fd; border-radius: 8px; font: 18px/1.5 system-ui; }',
    '.present-status:empty { display: none; }',
    '.speaker-notes, [data-speaker-notes] { display: none !important; }',
    /* 한 장만 화면 크기에 맞춰 띄우고 나머지는 치운다. */
    'body.presenting { background: #000; overflow: hidden; }',
    'body.presenting .present-btn { display: none; }',
    'body.presenting .present-status { display: none; }',
    'body.presenting.suv-blackout::after { content: ""; position: fixed; inset: 0;',
    '  background: #000; z-index: 99999; pointer-events: none; }',
    'body.presenting .slide { display: none; }',
    'body.presenting .slide.current {',
    '  display: flex; position: fixed; left: 50%; top: 50%;',
    '  transform: translate(-50%, -50%) scale(var(--present-scale, 1));',
    '  transform-origin: center center; box-shadow: none;',
    '}',
    /* 동영상은 그림과 같은 상자 규칙을 쓴다. deck.css 의 `figure.fig img` 가
       타입+클래스(0,1,1) 이므로 여기도 같은 형태로 맞춘다. */
    'figure.fig video {',
    '  display: block; width: 100%; height: 100%;',
    '  max-height: 100%; object-fit: contain; background: transparent;',
    '}',
    '.body[data-layout] .body-media video {',
    '  width: 100%; height: 100%; max-width: 100%; max-height: 100%;',
    '  object-fit: contain;',
    '}',
    '.body[data-layout="right"] > .body-media video,',
    '.body[data-layout="left"] > .body-media video { object-position: center top; }',
    '@media print {',
    '  .present-btn, .present-status { display: none !important; }',
    '  .speaker-notes, [data-speaker-notes] { display: none !important; }',
    '  body.presenting.suv-blackout::after { display: none !important; }',
    '  video::-webkit-media-controls, video::-webkit-media-controls-enclosure {',
    '    display: none !important; opacity: 0 !important;',
    '  }',
    '  body.presenting { background: #fff; overflow: visible; }',
    '  body.presenting .slide {',
    '    display: flex !important; position: static !important; transform: none !important;',
    '  }',
    '}'
  ].join('\n');

  function injectCss() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var slides = [];
  var at = 0;
  var listeners = [];
  var popup = null;
  var presenterLoaded = null;
  var presenterMounted = false;
  var activeDocument = true;
  var preserveOnFullscreenExit = false;
  var suppressFocusClick = false;
  var status;

  function interactive(el) {
    if (!el || !el.closest) return false;      // document / window targets
    return !!(el.isContentEditable || el.closest('button, a, video, audio, input, textarea, select, pre, canvas'));
  }

  function typing(el) {
    return !!(el && (el.isContentEditable || (el.closest && el.closest('input, textarea, select'))));
  }

  function connected() {
    try { return activeDocument && !window.closed && window.document === deckDocument; }
    catch (e) { return false; }
  }

  // Canvas animations keep their state in the audience document, but an occluded
  // audience window may stop receiving native animation frames. Use one visible
  // presentation window as the clock, never one independent clock per window.
  var animationWindow = null;
  var animationDetach = null;
  var animationRequests = new Map();
  var animationNextId = 1;
  var animationFrame = null;
  var animationGeneration = 0;
  var lastPlaybackVisible = !document.hidden;
  var playbackHiddenTimer = 0;

  function visibleWindow(win) {
    try { return !!win && !win.closed && !win.document.hidden; }
    catch (e) { return false; }
  }

  function playbackVisible() {
    return connected() && (visibleWindow(window) || visibleWindow(animationWindow));
  }

  function animationDriver() {
    if (!connected()) return null;
    var sourceVisible = visibleWindow(window);
    var presenterVisible = visibleWindow(animationWindow);
    // Prefer the window the presenter is actually using. In particular, the
    // notes window continues driving the source while it covers the audience.
    if (presenterVisible) {
      try {
        if (animationWindow.document.hasFocus() || !sourceVisible || !document.hasFocus()) return animationWindow;
      } catch (e) { /* A closing popup falls back to the audience. */ }
    }
    if (sourceVisible) return window;
    return presenterVisible ? animationWindow : null;
  }

  function cancelNativeAnimationFrame() {
    animationGeneration++;
    if (animationFrame) {
      try { animationFrame.window.cancelAnimationFrame(animationFrame.id); } catch (e) { /* Closed window. */ }
      animationFrame = null;
    }
  }

  function scheduleAnimationFrame() {
    var driver = animationDriver();
    if (!driver || !animationRequests.size) { cancelNativeAnimationFrame(); return; }
    if (animationFrame && animationFrame.window === driver) return;
    cancelNativeAnimationFrame();
    var generation = animationGeneration;
    var pending = {window: driver, id: 0};
    animationFrame = pending;
    pending.id = driver.requestAnimationFrame(function () {
      if (generation !== animationGeneration || animationFrame !== pending || !connected()) return;
      animationFrame = null;
      // Windows can have different time origins. Every callback receives the
      // source document's clock, including after a focus/driver transfer.
      var now = window.performance.now();
      var batch = Array.from(animationRequests.keys());
      batch.forEach(function (id) {
        var callback = animationRequests.get(id);
        if (!callback) return; // A previous callback may have cancelled this one.
        animationRequests.delete(id);
        try { callback(now); }
        catch (error) {
          // Match native rAF: one failing callback must not stop the others.
          window.setTimeout(function () { throw error; }, 0);
        }
      });
      scheduleAnimationFrame();
    });
  }

  function refreshAnimationClock() {
    scheduleAnimationFrame();
    var visible = playbackVisible();
    if (playbackHiddenTimer) { window.clearTimeout(playbackHiddenTimer); playbackHiddenTimer = 0; }
    function notifyVisibility(value) {
      if (value === lastPlaybackVisible) return;
      lastPlaybackVisible = value;
      document.dispatchEvent(new CustomEvent('suv:playbackvisibility', {detail: {visible: value}}));
    }
    if (visible || !connected()) notifyVisibility(visible);
    else {
      // Closing notes can reveal the audience one event later. Reconcile that
      // handoff before telling a player to pause because both windows are hidden.
      playbackHiddenTimer = window.setTimeout(function () {
        playbackHiddenTimer = 0;
        notifyVisibility(playbackVisible());
      }, 150);
    }
  }

  function requestPresentationFrame(callback) {
    if (typeof callback !== 'function') throw new TypeError('Animation callback must be a function.');
    var id = animationNextId++;
    animationRequests.set(id, callback);
    scheduleAnimationFrame();
    return id;
  }

  function cancelPresentationFrame(id) {
    animationRequests.delete(id);
    if (!animationRequests.size) cancelNativeAnimationFrame();
  }

  function attachAnimationWindow(win) {
    if (animationDetach) animationDetach();
    var targetDocument = win.document;
    var detached = false;
    animationWindow = win;
    function detach() {
      if (detached) return;
      detached = true;
      win.removeEventListener('focus', refreshAnimationClock);
      win.removeEventListener('blur', refreshAnimationClock);
      targetDocument.removeEventListener('visibilitychange', refreshAnimationClock);
      win.removeEventListener('pagehide', detach);
      win.removeEventListener('beforeunload', detach);
      if (animationWindow === win) animationWindow = null;
      if (animationDetach === detach) animationDetach = null;
      refreshAnimationClock();
    }
    animationDetach = detach;
    win.addEventListener('focus', refreshAnimationClock);
    win.addEventListener('blur', refreshAnimationClock);
    targetDocument.addEventListener('visibilitychange', refreshAnimationClock);
    win.addEventListener('pagehide', detach);
    win.addEventListener('beforeunload', detach);
    refreshAnimationClock();
    return detach;
  }

  function titleOf(slide, index) {
    if (!slide) return '';
    var heading = slide.querySelector('.title, .display, .part-name, h1, h2');
    return (heading && heading.textContent.trim()) || slide.getAttribute('data-label') || 'Slide ' + (index + 1);
  }

  // Preserve simple formatting; scripts and event attributes never enter the notes pane.
  function notesOf(slide) {
    var source = slide && slide.querySelector(NOTES);
    if (!source) return '';
    var result = document.createElement('div');
    var allowed = /^(P|BR|STRONG|B|EM|I|UL|OL|LI|CODE|PRE|SPAN)$/;
    var discard = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH)$/;
    function copy(node, parent) {
      if (node.nodeType === 3) { parent.appendChild(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== 1 || discard.test(node.tagName)) return;
      var target = parent;
      if (allowed.test(node.tagName)) {
        target = document.createElement(node.tagName.toLowerCase());
        parent.appendChild(target);
      }
      [].forEach.call(node.childNodes, function (child) { copy(child, target); });
    }
    [].forEach.call(source.childNodes, function (node) { copy(node, result); });
    return result.innerHTML.trim();
  }

  function getState() {
    return {index: at, count: slides.length, title: titleOf(slides[at], at),
      notesHTML: notesOf(slides[at]), blank: document.body.classList.contains('suv-blackout'),
      presenting: document.body.classList.contains('presenting'), connected: connected()};
  }

  function notify() {
    var state = getState();
    listeners.slice().forEach(function (fn) {
      try { fn(state); } catch (e) { /* A closed presenter must not interrupt the audience. */ }
    });
    document.dispatchEvent(new CustomEvent('suv:slidechange', {detail: {index: at, count: slides.length}}));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
  }

  // SVG/SMIL timelines must not run independently in either preview.
  var PREVIEW_SKIP = NOTES + ', script, iframe, object, embed, audio, source, track, animate, animateColor, animateMotion, animateTransform, set';
  var PREVIEW_DROP_ATTR = /^(?:on.*|srcdoc|autofocus|contenteditable)$/i;
  var videoPreviewStates = new WeakMap();

  function videoResource(source) {
    return source.srcObject || source.currentSrc || source.src;
  }

  function videoPreviewState(source) {
    var resource = videoResource(source);
    var state = videoPreviewStates.get(source);
    if (!state || state.resource !== resource) {
      state = {resource: resource, started: false};
      videoPreviewStates.set(source, state);
    }
    // A presenter may be opened after playback has already started. A decoded
    // frame alone is insufficient: preload can finish while the poster is shown.
    if (source.paused === false || source.seeking || source.currentTime > 0 ||
        (source.played && source.played.length)) state.started = true;
    return state;
  }

  function trackVideoPreviewState(event) {
    var source = event.target;
    if (!source || source.localName !== 'video') return;
    if (event.type === 'emptied' || event.type === 'loadstart') {
      videoPreviewStates.set(source, {resource: videoResource(source), started: false});
    } else {
      videoPreviewState(source).started = true;
    }
  }

  function videoShowsPoster(source) {
    return !!source.poster && !videoPreviewState(source).started;
  }

  // Capture also sees non-bubbling media events and videos added after setup.
  ['play', 'seeking', 'emptied', 'loadstart'].forEach(function (type) {
    document.addEventListener(type, trackVideoPreviewState, true);
  });

  function previewNodeAllowed(node) {
    return node.nodeType === 3 || (node.nodeType === 1 && !node.matches(PREVIEW_SKIP));
  }

  function previewNodeTag(node) {
    return node.nodeType === 1 && node.localName === 'video' ? 'canvas' : node.localName;
  }

  function newPreviewNode(source, targetDocument) {
    if (source.nodeType === 3) return targetDocument.createTextNode(source.data);
    return targetDocument.createElementNS(source.namespaceURI, previewNodeTag(source));
  }

  // Patch the inert preview in place. Replacing iframe HTML on every frame would
  // reload fonts/images, clear canvases, and make the presenter visibly flicker.
  // Only the audience document runs the presentation's scripts and media clock.
  function patchPreviewNode(source, target, mediaPairs, propertyPairs) {
    if (source.nodeType === 3) {
      if (target.data !== source.data) target.data = source.data;
      return;
    }
    var video = source.localName === 'video';
    var canvas = source.localName === 'canvas';
    var names = {};
    [].forEach.call(source.attributes, function (attr) {
      if (PREVIEW_DROP_ATTR.test(attr.name)) return;
      if (video && /^(src|poster|autoplay|controls|loop|preload|width|height|style)$/i.test(attr.name)) return;
      names[attr.name] = true;
      if (target.getAttribute(attr.name) !== attr.value) {
        if (attr.namespaceURI) target.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
        else target.setAttribute(attr.name, attr.value);
      }
    });
    if (canvas || video) names['data-suv-preview-media'] = true;
    if (video) { names.width = true; names.height = true; names.style = true; }
    [].slice.call(target.attributes).forEach(function (attr) {
      if (!names[attr.name]) target.removeAttribute(attr.name);
    });
    if (canvas || video) {
      target.setAttribute('data-suv-preview-media', video ? 'video' : 'canvas');
      if (video) {
        // A canvas must retain styles selected by `video` in the source deck.
        // Computed dimensions are unscaled slide pixels; object-fit preserves
        // letterboxing/cropping when the video's aspect ratio differs from its box.
        var computed = window.getComputedStyle(source);
        for (var i = 0; i < computed.length; i++) {
          var name = computed[i];
          var value = computed.getPropertyValue(name);
          if (target.style.getPropertyValue(name) !== value) target.style.setProperty(name, value);
        }
      }
      mediaPairs.push({source: source, target: target, video: video});
      return;
    }
    if (/^(input|textarea|select|option)$/.test(source.localName)) {
      propertyPairs.push({source: source, target: target});
    }
    var position = 0;
    [].forEach.call(source.childNodes, function (child) {
      if (!previewNodeAllowed(child)) return;
      var copy = target.childNodes[position];
      if (!copy || copy.nodeType !== child.nodeType ||
          (child.nodeType === 1 && (copy.localName !== previewNodeTag(child) || copy.namespaceURI !== child.namespaceURI))) {
        var replacement = newPreviewNode(child, target.ownerDocument);
        if (copy) target.replaceChild(replacement, copy);
        else target.appendChild(replacement);
        copy = replacement;
      }
      patchPreviewNode(child, copy, mediaPairs, propertyPairs);
      position++;
    });
    while (target.childNodes.length > position) target.removeChild(target.lastChild);
  }

  function preview(index, live) {
    if (!Number.isInteger(index) || index < 0 || index >= slides.length) return null;
    var original = slides[index];
    var clone;
    if (live) {
      clone = newPreviewNode(original, document);
      patchPreviewNode(original, clone, [], []);
    } else {
      clone = original.cloneNode(true);
      var originals = original.querySelectorAll('canvas, video');
      [].forEach.call(clone.querySelectorAll('canvas, video'), function (media, i) {
        var source = originals[i];
        var showPoster = source.tagName === 'VIDEO' && videoShowsPoster(source);
        // Retain the existing poster fallback if browser origin rules prevent
        // a static snapshot of a decoded video frame.
        var url = source.tagName === 'VIDEO' ? source.poster : '';
        try {
          if (source.tagName === 'CANVAS') url = source.toDataURL();
          else if (!showPoster && source.readyState >= 2 && source.videoWidth) {
            var canvas = document.createElement('canvas');
            canvas.width = source.videoWidth; canvas.height = source.videoHeight;
            canvas.getContext('2d').drawImage(source, 0, 0);
            url = canvas.toDataURL();
          }
        } catch (e) { /* A cross-origin frame can still use its poster. */ }
        var still = document.createElement(url ? 'img' : 'div');
        ['class', 'style', 'width', 'height'].forEach(function (name) {
          if (media.hasAttribute(name)) still.setAttribute(name, media.getAttribute(name));
        });
        if (url) { still.src = url; still.alt = 'Media preview'; }
        else still.textContent = '동영상 / 애니메이션';
        media.replaceWith(still);
      });
      [].forEach.call(clone.querySelectorAll(PREVIEW_SKIP), function (el) { el.remove(); });
      [clone].concat([].slice.call(clone.querySelectorAll('*'))).forEach(function (el) {
        [].slice.call(el.attributes).forEach(function (attr) {
          if (PREVIEW_DROP_ATTR.test(attr.name)) el.removeAttribute(attr.name);
        });
      });
    }
    var styles = [].map.call(document.querySelectorAll('link[rel="stylesheet"], style'), function (el) {
      var copy = el.cloneNode(true);
      if (el.tagName === 'LINK') copy.href = el.href;
      return copy.outerHTML;
    }).join('\n');
    var stage = original.closest('deck-stage');
    if (stage) { stage = stage.cloneNode(false); stage.appendChild(clone); }
    return {html: stage ? stage.outerHTML : clone.outerHTML, styles: styles, baseURL: document.baseURI,
      width: STAGE_W, height: STAGE_H, title: titleOf(original, index)};
  }

  // Bind a script-free current-slide clone to the source's rendered canvas/video
  // pixels and DOM. CSS/SVG changes made through DOM attributes are mirrored too;
  // independent CSS/SMIL timelines are not started in the preview.
  function mirrorPreview(index, target) {
    if (!Number.isInteger(index) || !slides[index] || !target) return null;
    var original = slides[index];
    var dirty = true, closed = false;
    var mediaPairs = [], propertyPairs = [];
    var posters = new WeakMap();
    var observer = new MutationObserver(function () { dirty = true; });
    observer.observe(original, {subtree: true, childList: true, characterData: true, attributes: true});
    function update() {
      if (closed || !connected() || index !== at || !target.isConnected) return false;
      if (dirty) {
        dirty = false; mediaPairs = []; propertyPairs = [];
        patchPreviewNode(original, target, mediaPairs, propertyPairs);
      }
      propertyPairs.forEach(function (pair) {
        if ('value' in pair.source && pair.target.value !== pair.source.value) pair.target.value = pair.source.value;
        if ('checked' in pair.source) pair.target.checked = pair.source.checked;
        if ('selected' in pair.source) pair.target.selected = pair.source.selected;
        if ('selectedIndex' in pair.source) pair.target.selectedIndex = pair.source.selectedIndex;
      });
      mediaPairs.forEach(function (pair) {
        var source = pair.source, copy = pair.target;
        var width = pair.video ? source.videoWidth : source.width;
        var height = pair.video ? source.videoHeight : source.height;
        var image = source;
        if (pair.video && videoShowsPoster(source)) {
          var poster = posters.get(source);
          if (!poster || poster.src !== source.poster) {
            poster = new Image(); poster.src = source.poster; posters.set(source, poster);
          }
          if (!poster.complete || !poster.naturalWidth) return;
          image = poster; width = poster.naturalWidth; height = poster.naturalHeight;
        } else if (pair.video && (source.readyState < 2 || !width)) {
          // Keep the last displayed frame during a seek/load stall after Play;
          // returning to the poster here would flash a frame the audience lacks.
          return;
        }
        if (!width || !height) return;
        if (copy.width !== width) copy.width = width;
        if (copy.height !== height) copy.height = height;
        try {
          var context = copy.getContext('2d');
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
        } catch (e) { /* A temporarily unavailable media frame must not stop the deck. */ }
      });
      return true;
    }
    return {update: update, close: function () {
      if (closed) return;
      closed = true; observer.disconnect(); mediaPairs = []; propertyPairs = [];
    }};
  }

  function fit() {
    if (!document.body.classList.contains('presenting')) return;
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    document.body.style.setProperty('--present-scale', s);
  }

  /* 동영상은 무음 자동 재생이 기본이다. 슬라이드를 벗어나면 멈추고, 들어오면
     처음부터 튼다. data-noautoplay 는 자동 재생을, data-sound 는 음소거를 끈다. */
  function muteAll() {
    [].forEach.call(document.querySelectorAll('video'), function (v) {
      if (!v.hasAttribute('data-sound')) { v.muted = true; v.defaultMuted = true; }
    });
  }

  function syncVideos(slide) {
    [].forEach.call(document.querySelectorAll('video'), function (v) {
      if (slide && slide.contains(v)) return;
      if (!v.paused) v.pause();
    });
    if (!slide) return;
    [].forEach.call(slide.querySelectorAll('video'), function (v) {
      if (v.hasAttribute('data-noautoplay')) return;
      if (!v.hasAttribute('data-sound')) v.muted = true;   // 무음이라야 브라우저가 허용
      v.currentTime = 0;
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* 차단되면 발표자가 직접 재생 */ });
    });
  }

  function show(i) {
    if (!slides.length || typeof i !== 'number' || !isFinite(i)) return;
    at = Math.max(0, Math.min(slides.length - 1, Math.floor(i)));
    var changed = !slides[at].classList.contains('current');
    slides.forEach(function (sl, n) { sl.classList.toggle('current', n === at); });
    if (changed) syncVideos(slides[at]);
    notify();
  }

  function nearestSlide() {
    var mid = window.scrollY + window.innerHeight / 2;
    var best = 0, bestGap = Infinity;
    slides.forEach(function (sl, n) {
      var box = sl.getBoundingClientRect();
      var gap = Math.abs(window.scrollY + box.top + box.height / 2 - mid);
      if (gap < bestGap) { bestGap = gap; best = n; }
    });
    return best;
  }

  function startPresenting(fullscreen) {
    if (!document.body.classList.contains('presenting')) {
      var from = nearestSlide();
      document.body.classList.add('presenting');
      show(from);
      fit();
    }
    if (fullscreen !== false && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () { /* 창 모드로 계속 */ });
    }
  }

  function stopPresenting() {
    if (!document.body.classList.contains('presenting')) return;
    document.body.classList.remove('presenting');
    document.body.classList.remove('suv-blackout');
    preserveOnFullscreenExit = false;
    suppressFocusClick = false;
    slides.forEach(function (sl) { sl.classList.remove('current'); });
    syncVideos(null);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    slides[at].scrollIntoView();
    notify();
  }

  function toggleBlank() {
    if (!connected()) return;
    if (!document.body.classList.contains('presenting')) startPresenting(false);
    document.body.classList.toggle('suv-blackout');
    notify();
  }

  function navigate(index) {
    if (!connected() || typeof index !== 'number' || !isFinite(index)) return;
    if (!document.body.classList.contains('presenting')) {
      document.body.classList.add('presenting');
      fit();
    }
    show(index);
  }

  function controlMedia(action) {
    var event = new CustomEvent('suv:media', {cancelable: true,
      detail: {action: action, index: at, slide: slides[at]}});
    if (!document.dispatchEvent(event)) return;
    var videos = slides[at] ? slides[at].querySelectorAll('video') : [];
    var pause = [].some.call(videos, function (v) { return !v.paused; });
    [].forEach.call(videos, function (v) {
      if (action === 'reset') {
        v.pause();
        try { v.currentTime = 0; } catch (e) { /* Live streams may not be seekable. */ }
      }
      else if (pause) v.pause();
      else { var playing = v.play(); if (playing && playing.catch) playing.catch(function () {}); }
    });
  }

  function loadPresenter() {
    if (window.SUVPresenter) return Promise.resolve();
    if (!presenterLoaded) {
      presenterLoaded = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = presenterURL;
        script.onload = function () {
          if (window.SUVPresenter) resolve();
          else { presenterLoaded = null; reject(new Error('발표자 화면을 불러오지 못했습니다.')); }
        };
        script.onerror = function () {
          script.remove(); presenterLoaded = null;
          reject(new Error('presenter.js를 present.js와 같은 폴더에 두고 다시 열어 주세요.'));
        };
        document.head.appendChild(script);
      });
    }
    return presenterLoaded;
  }

  function openPresenter() {
    if (!connected()) return null;
    // Chrome exits native fullscreen when opening/focusing a second window. Request that
    // exit explicitly and keep our single-slide mode for the resulting event.
    if (document.fullscreenElement && document.exitFullscreen) {
      preserveOnFullscreenExit = true;
      document.exitFullscreen().catch(function () { preserveOnFullscreenExit = false; });
    }
    if (popup && !popup.closed) {
      try {
        // Refreshing the popup clears its UI without unloading this deck.
        if (presenterMounted && typeof popup.__SUVPresenterCleanup === 'function') {
          suppressFocusClick = true; popup.focus(); return popup;
        }
      } catch (e) { /* A refreshed about:blank popup can have a new file origin. */ }
      popup.close(); popup = null;
    }
    presenterMounted = false;
    // Open synchronously in the click/keypress; loading first loses user activation.
    if (!popup || popup.closed) {
      popup = window.open('', '_blank', 'popup,width=1280,height=850');
    }
    if (!popup) {
      if (status) status.textContent = '발표자 창이 차단되었습니다. 팝업을 허용한 뒤 N을 다시 누르세요.';
      window.alert('발표자 창이 차단되었습니다. 팝업을 허용한 뒤 N을 다시 누르세요.');
      return null;
    }
    var target = popup;
    suppressFocusClick = true;
    target.document.title = '발표자 노트';
    target.document.body.textContent = '발표자 화면을 불러오는 중입니다…';
    if (!document.body.classList.contains('presenting')) startPresenting(false);
    loadPresenter().then(function () {
      if (target.closed || target !== popup || presenterMounted) return;
      window.SUVPresenter.mount(target, api);
      presenterMounted = true;
      if (status) status.textContent = '';
      target.focus();
    }).catch(function (error) {
      if (!target.closed) target.document.body.textContent = error.message;
      if (status) status.textContent = error.message;
    });
    return target;
  }

  var api = {
    getState: getState, show: navigate, currentIndex: function () { return at; },
    next: function () { navigate(at + 1); }, prev: function () { navigate(at - 1); },
    toggleBlank: toggleBlank, subscribe: subscribe, preview: preview, mirrorPreview: mirrorPreview, connected: connected,
    openNotes: openPresenter,
    requestAnimationFrame: requestPresentationFrame, cancelAnimationFrame: cancelPresentationFrame,
    playbackVisible: playbackVisible, attachAnimationWindow: attachAnimationWindow,
    media: function (action) {
      if (!connected() || (action !== 'toggle' && action !== 'reset')) return;
      if (!document.body.classList.contains('presenting')) navigate(at);
      // Canvas players listening for P/R receive the same keys as native videos.
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: action === 'reset' ? 'r' : 'p', bubbles: true, cancelable: true
      }));
    }
  };
  window.SUVPresent = api;

  var NEXT = { ' ': 1, Spacebar: 1, ArrowRight: 1, ArrowDown: 1, PageDown: 1, Enter: 1 };
  var PREV = { ArrowLeft: 1, ArrowUp: 1, PageUp: 1, Backspace: 1 };

  function setup() {
    injectCss();
    muteAll();
    slides = [].slice.call(document.querySelectorAll('.slide'));
    if (!slides.length) return;
    [].forEach.call(document.querySelectorAll(NOTES), function (el) { el.hidden = true; });

    var btn = document.createElement('button');
    btn.className = 'present-btn';
    btn.type = 'button';
    btn.textContent = '전체 화면';
    btn.title = 'F 키로도 시작. Esc 로 종료';
    btn.addEventListener('click', function () { btn.blur(); startPresenting(); });
    document.body.appendChild(btn);

    var notesButton = document.createElement('button');
    notesButton.className = 'present-btn presenter-btn';
    notesButton.type = 'button';
    notesButton.textContent = '발표자 노트';
    notesButton.title = 'N: 별도 발표자 창 열기 (확장 화면에서 사용)';
    notesButton.addEventListener('click', function () { notesButton.blur(); openPresenter(); });
    document.body.appendChild(notesButton);
    status = document.createElement('div');
    status.className = 'present-status';
    status.setAttribute('role', 'status');
    document.body.appendChild(status);

    document.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
      if (ev.key !== 'Escape' && typing(ev.target)) return;
      if ((ev.key === ' ' || ev.key === 'Enter') && ev.target.closest && ev.target.closest('button')) return;
      if (ev.isTrusted) suppressFocusClick = false;
      if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); openPresenter(); return; }
      if (ev.key === 'f' || ev.key === 'F') { ev.preventDefault(); startPresenting(); return; }

      if (!document.body.classList.contains('presenting')) {
        return;
      }
      if (ev.key === 'Escape') { stopPresenting(); return; }
      if (ev.key === 'b' || ev.key === 'B') {     // 화면 잠깐 끄기
        ev.preventDefault(); toggleBlank();
        return;
      }
      if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); controlMedia('toggle'); return; }
      if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); controlMedia('reset'); return; }
      if (NEXT[ev.key]) { ev.preventDefault(); show(at + 1); return; }
      if (PREV[ev.key]) { ev.preventDefault(); show(at - 1); return; }
      if (ev.key === 'Home') { ev.preventDefault(); show(0); return; }
      if (ev.key === 'End') { ev.preventDefault(); show(slides.length - 1); }
    });

    // 슬라이드를 누르면 다음 장. 눌러서 쓰는 것들은 그대로 둔다.
    document.addEventListener('click', function (ev) {
      if (!document.body.classList.contains('presenting')) return;
      if (interactive(ev.target)) return;
      if (suppressFocusClick) { suppressFocusClick = false; return; }
      show(at + 1);
    });

    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) {
        if (preserveOnFullscreenExit) {
          preserveOnFullscreenExit = false; fit(); notify();
        } else stopPresenting();
      }
    });
    window.addEventListener('blur', function () {
      if (popup && !popup.closed) suppressFocusClick = true;
      refreshAnimationClock();
    });
    window.addEventListener('focus', refreshAnimationClock);
    document.addEventListener('visibilitychange', refreshAnimationClock);
    window.addEventListener('pagehide', function () { activeDocument = false; refreshAnimationClock(); notify(); });
    window.addEventListener('pageshow', function () { activeDocument = true; refreshAnimationClock(); notify(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
