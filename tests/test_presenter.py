#!/usr/bin/env python3
"""Real Chromium integration checks. No browser security relaxation is used."""
import argparse,base64,json,shutil,subprocess,tempfile,time,urllib.request
from pathlib import Path
from chrome_driver import ChromeSession,WebSocket

ROOT=Path(__file__).resolve().parents[1]

def wait_for(page,expression,timeout=8):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        if page.evaluate(expression):return
        time.sleep(.05)
    raise AssertionError('Timed out: '+expression)

def targets(browser):
    with urllib.request.urlopen(f'http://127.0.0.1:{browser.port}/json/list') as response:
        return [t for t in json.load(response) if t['type']=='page']

def attach(browser,target):
    page=object.__new__(ChromeSession)
    page.width=1280;page.height=850;page.timeout=20;page.events=[];page.counter=0
    page.ws=WebSocket(target['webSocketDebuggerUrl'])
    for method in ('Page.enable','Runtime.enable','Log.enable','Network.enable'):page.call(method)
    page.call('Network.emulateNetworkConditions',dict(offline=True,latency=0,downloadThroughput=0,uploadThroughput=0))
    page.call('Emulation.setDeviceMetricsOverride',{'width':1280,'height':850,'deviceScaleFactor':1,'mobile':False})
    return page

def click_text(page,text):
    found=page.evaluate('''(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(%s));if(!b)return false;b.click();b.blur();return true})()'''%json.dumps(text))
    assert found,'Missing button '+text

def run(out):
    out.mkdir(parents=True,exist_ok=True)
    checks=[]
    def passed(name):checks.append(name);print('PASS '+name,flush=True)
    with ChromeSession(width=1280,height=850) as c:
        c.call('Network.emulateNetworkConditions',dict(offline=True,latency=0,downloadThroughput=0,uploadThroughput=0))
        c.navigate((ROOT/'examples/presenter-notes.html').as_uri())
        original_id=targets(c)[0]['id']
        assert c.evaluate('SUVPresent.getState().count===4')
        assert c.evaluate('[...document.querySelectorAll(".speaker-notes")].every(n=>getComputedStyle(n).display==="none")')
        assert not c.evaluate('document.body.innerText.includes("Thank you for the introduction.")')
        passed('Notes stay hidden in the ordinary audience view')

        c.key('f');wait_for(c,'!!document.fullscreenElement')
        c.key('n')
        wait_for(c,'!!window.SUVPresenter')
        c.evaluate('window.testNotes=SUVPresent.openNotes();true')
        wait_for(c,'testNotes.document.body.innerText.includes("Thank you for the introduction.")')
        note_target=next(t for t in targets(c) if t['id']!=original_id)
        p=attach(c,note_target)
        assert c.evaluate('testNotes.opener===window')
        assert c.evaluate('document.body.classList.contains("presenting")')
        wait_for(p,'''[...document.querySelectorAll('iframe')].every(f=>f.contentDocument.readyState==='complete' && f.contentDocument.querySelector('.slide') && getComputedStyle(f.contentDocument.querySelector('.slide')).display==='flex')''')
        p.screenshot(out/'presenter.png');c.screenshot(out/'audience.png')
        passed('N opens an offline presenter window with the current script')

        c.call('Page.bringToFront')
        for kind in ['mousePressed','mouseReleased']:
            c.call('Input.dispatchMouseEvent',dict(type=kind,x=800,y=600,button='left',clickCount=1))
        assert c.evaluate('SUVPresent.currentIndex()')==0
        for kind in ['mousePressed','mouseReleased']:
            c.call('Input.dispatchMouseEvent',dict(type=kind,x=800,y=600,button='left',clickCount=1))
        assert c.evaluate('SUVPresent.currentIndex()')==1
        c.key('f');wait_for(c,'!!document.fullscreenElement')
        c.key('Escape');wait_for(c,'!SUVPresent.getState().presenting')
        c.evaluate('SUVPresent.show(0)')
        passed('F→N keeps slide mode; returning focus does not advance; F/Escape still work')

        # N reuses the same window, rather than opening another one for this deck.
        assert c.evaluate('SUVPresent.openNotes()===testNotes')
        assert len(targets(c))==2
        c.evaluate('SUVPresent.show(1)')
        wait_for(p,'document.body.innerText.includes("This is a longer script")')
        click_text(p,'다음')
        assert c.evaluate('SUVPresent.currentIndex()')==2
        wait_for(p,'document.body.innerText.includes("The blue dot now moves")')
        p.key('ArrowLeft')
        assert c.evaluate('SUVPresent.currentIndex()')==1
        p.key('PageDown');assert c.evaluate('SUVPresent.currentIndex()')==2
        p.key('PageUp');assert c.evaluate('SUVPresent.currentIndex()')==1
        passed('Navigation synchronizes in both directions and reuses the popup')

        # Long scripts keep their reading position across status updates and slide changes.
        c.evaluate('''document.querySelectorAll('.speaker-notes')[1].insertAdjacentHTML('beforeend','<p>Long script paragraph.</p>'.repeat(20));SUVPresent.show(1)''')
        p.evaluate("document.querySelector('#font-larger').click();document.querySelector('#notes').scrollTop=200")
        assert p.evaluate("getComputedStyle(document.querySelector('#notes')).fontSize")=='34px'
        p.evaluate("document.querySelector('#blank').click()")
        assert p.evaluate("document.querySelector('#notes').scrollTop")==200
        p.evaluate("document.querySelector('#blank').click();document.querySelector('#next').click();document.querySelector('#prev').click()")
        assert p.evaluate("document.querySelector('#notes').scrollTop")==200
        p.evaluate("document.querySelector('#font-smaller').click();document.querySelector('#timer-toggle').click()")
        wait_for(p,"document.querySelector('#elapsed').textContent!=='00:00'")
        p.evaluate("document.querySelector('#timer-toggle').click()")
        paused=p.evaluate("document.querySelector('#elapsed').textContent")
        time.sleep(1.05)
        assert p.evaluate("document.querySelector('#elapsed').textContent")==paused
        p.evaluate("document.querySelector('#timer-reset').click()")
        assert p.evaluate("document.querySelector('#elapsed').textContent")=='00:00'
        p.call('Emulation.setDeviceMetricsOverride',dict(width=800,height=700,deviceScaleFactor=1,mobile=False))
        assert p.evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('#notes').clientHeight>200")
        p.width=800;p.height=700;p.screenshot(out/'presenter_compact.png')
        p.call('Emulation.setDeviceMetricsOverride',dict(width=1280,height=850,deviceScaleFactor=1,mobile=False))
        p.width=1280;p.height=850
        passed('Long scripts, text size, timer and compact layout remain usable')

        # Form controls must retain their editing keys and must not navigate the deck.
        c.evaluate("let input=document.createElement('input');input.id='test-input';document.body.append(input);input.focus()")
        c.key('ArrowRight');c.key('n')
        assert c.evaluate('SUVPresent.currentIndex()')==1
        assert len(targets(c))==2
        c.evaluate("document.querySelector('#test-input').remove()")
        p.evaluate("let input=document.createElement('textarea');input.id='test-input';document.body.append(input);input.focus()")
        p.key('ArrowRight');p.key(' ')
        assert c.evaluate('SUVPresent.currentIndex()')==1
        p.evaluate("document.querySelector('#test-input').remove()")
        passed('Input fields retain their keys without changing slides')

        p.key('End')
        assert c.evaluate('SUVPresent.currentIndex()')==3
        assert c.evaluate('SUVPresent.getState().notesHTML')==''
        assert p.evaluate('document.body.innerText.includes("노트")')
        p.key('Home')
        assert c.evaluate('SUVPresent.currentIndex()')==0
        c.evaluate('SUVPresent.show(NaN);SUVPresent.show(Infinity);SUVPresent.show("bad")')
        assert c.evaluate('SUVPresent.currentIndex()')==0
        passed('First/last navigation, invalid indices and slides without notes are handled')

        # Source scripts and speaker notes must never be copied into preview HTML.
        c.evaluate('''(()=>{let n=document.querySelector('.speaker-notes');n.insertAdjacentHTML('beforeend','<p onclick="window.__noteRan=1">PRIVATE_NOTE_SENTINEL</p><img src="bad" onerror="window.__noteRan=2"><script>window.__noteRan=3</script>');SUVPresent.show(0)})()''')
        state=c.evaluate('SUVPresent.getState()')
        preview=c.evaluate('SUVPresent.preview(0)')
        assert 'onclick' not in state['notesHTML'] and '<script' not in state['notesHTML'] and '<img' not in state['notesHTML']
        assert 'PRIVATE_NOTE_SENTINEL' not in preview['html'] and 'speaker-notes' not in preview['html']
        assert p.evaluate('[...document.querySelectorAll("iframe")].every(f=>f.sandbox.contains("allow-same-origin")&&!f.sandbox.contains("allow-scripts"))')
        passed('Notes are sanitized and excluded from sandboxed slide previews')

        # No duplicate source animation is started by the previews.
        c.evaluate('SUVPresent.show(2);window.mediaActions=[];document.addEventListener("suv:media",e=>mediaActions.push(e.detail.action))')
        p.key('p');p.key('r')
        assert c.evaluate('mediaActions')==['toggle','reset']
        p.key('b');assert c.evaluate('SUVPresent.getState().blank')
        assert p.evaluate('getComputedStyle(document.body).visibility')=='visible'
        p.key('b');assert not c.evaluate('SUVPresent.getState().blank')
        passed('Presenter media keys and blackout control the audience only')

        # A real HTMLVideoElement exercises play/pause/reset and slide-leave pausing.
        c.evaluate('''(()=>{let v=document.createElement('video');v.id='test-video';v.muted=true;v.setAttribute('data-noautoplay','');let can=document.createElement('canvas');can.width=64;can.height=64;can.getContext('2d').fillRect(0,0,64,64);v.srcObject=can.captureStream(1);window.testStream=v.srcObject;document.querySelectorAll('.slide')[3].append(v);SUVPresent.show(3)})()''')
        p.key('p');wait_for(c,'!document.querySelector("#test-video").paused')
        p.key('p');assert c.evaluate('document.querySelector("#test-video").paused')
        p.key('p');wait_for(c,'!document.querySelector("#test-video").paused')
        p.key('r');assert c.evaluate('document.querySelector("#test-video").paused')
        p.key('p');wait_for(c,'!document.querySelector("#test-video").paused')
        c.evaluate('SUVPresent.show(2)')
        assert c.evaluate('document.querySelector("#test-video").paused')
        c.evaluate('testStream.getTracks().forEach(t=>t.stop());document.querySelector("#test-video").remove()')
        passed('Native video controls work and leaving a slide pauses its video')

        # Printing while blacked out still exports all audience slides, never notes.
        c.evaluate('SUVPresent.toggleBlank()')
        pdf=c.call('Page.printToPDF',dict(printBackground=True,preferCSSPageSize=True))
        (out/'audience.pdf').write_bytes(base64.b64decode(pdf['data']))
        exported=subprocess.check_output(['pdftotext',str(out/'audience.pdf'),'-'],text=True)
        assert 'PRIVATE_NOTE_SENTINEL' not in exported and 'Thank you for the introduction.' not in exported
        assert all(t in exported for t in ['Read the script','Animation controls','Notes are optional'])
        assert len([s for s in exported.split('\f') if s.strip()])==4
        c.evaluate('SUVPresent.toggleBlank()')
        passed('PDF has all four slides and no speaker notes or blackout overlay')

        p.ws.close();c.evaluate('testNotes.close()')
        wait_for(c,'testNotes.closed')
        c.key('n');c.evaluate('window.testNotes=SUVPresent.openNotes();true')
        wait_for(c,'testNotes.document.body.innerText.includes("The blue dot now moves")')
        p=attach(c,next(t for t in targets(c) if t['id']!=original_id))
        assert c.evaluate('SUVPresent.currentIndex()')==2
        passed('Closing and reopening notes keeps the current slide')

        # A reload must disconnect the old UI, so it cannot control a stale document.
        c.call('Page.reload')
        wait_for(c,'typeof SUVPresent!=="undefined" && SUVPresent.getState().connected && SUVPresent.currentIndex()===0')
        wait_for(p,'[...document.querySelectorAll("button")].some(b=>b.textContent.includes("다음")&&b.disabled)')
        before=c.evaluate('SUVPresent.currentIndex()')
        p.key('ArrowRight')
        assert c.evaluate('SUVPresent.currentIndex()')==before
        p.screenshot(out/'disconnected.png');p.ws.close()
        passed('An old presenter cannot control the deck after it reloads')

        # A denied popup gives an explicit, recoverable message without breaking slides.
        c.evaluate('window.realOpen=window.open;window.open=()=>null;window.alert=t=>window.popupMessage=t')
        c.key('n')
        assert c.evaluate('popupMessage.includes("차단")')
        c.evaluate('window.open=realOpen;SUVPresent.show(1)')
        assert c.evaluate('SUVPresent.currentIndex()')==1
        passed('A blocked popup reports the issue and leaves navigation usable')
        errors=[e for e in c.events if e.get('method')=='Runtime.exceptionThrown']
        assert not errors,errors
    # A hand-copied old deck may be missing the new companion asset.
    with tempfile.TemporaryDirectory(prefix='suvlab-missing-') as temp:
        folder=Path(temp)
        shutil.copy2(ROOT/'design/present.js',folder/'present.js')
        (folder/'deck.html').write_text('<!doctype html><meta charset="utf-8"><title>Missing companion</title><section class="slide"><h1>Test</h1></section><script src="present.js"></script>')
        with ChromeSession(width=1280,height=850) as c:
            c.navigate((folder/'deck.html').as_uri())
            c.evaluate('window.failedPopup=SUVPresent.openNotes();true')
            wait_for(c,'failedPopup.document.body.textContent.includes("presenter.js")')
            assert c.evaluate('failedPopup.document.body.textContent.includes("같은 폴더")')
            assert c.evaluate('SUVPresent.getState().count')==1
    passed('Missing presenter.js gives a useful recovery message')
    with ChromeSession(width=1280,height=850) as c:
        c.navigate((ROOT/'examples/presenter-notes.html').as_uri())
        source=targets(c)[0]['id']
        c.key('n');wait_for(c,'!!window.SUVPresenter')
        c.evaluate('window.testNotes=SUVPresent.openNotes();true')
        wait_for(c,'!!testNotes.document.querySelector("#notes")')
        p=attach(c,next(t for t in targets(c) if t['id']!=source))
        p.call('Target.closeTarget',{'targetId':source})
        wait_for(p,'document.querySelector("#next").disabled && !document.querySelector("#disconnect-message").hidden')
        p.ws.close()
    passed('Closing the audience window disables the remaining presenter')
    report={'passed':len(checks),'checks':checks,'browserSecurity':'default; no allow-file-access-from-files or disable-web-security','transport':'offline file://','result':'PASS'}
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,help='Save screenshots, PDF and report here.')
    args=parser.parse_args()
    if args.output:report=run(args.output.resolve())
    else:
        with tempfile.TemporaryDirectory(prefix='suvlab-test-') as temp:report=run(Path(temp))
    print(json.dumps(report,ensure_ascii=False,indent=2))
