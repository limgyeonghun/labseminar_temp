# 발표자 노트 브라우저 검사

Python 3 표준 라이브러리, Chrome/Chromium, `pdftotext`(Poppler)가 필요하다.
별도 Node 패키지나 Python 패키지는 설치하지 않는다.

```bash
python3 tests/test_presenter.py
# 화면과 PDF 증거를 보관할 때
python3 tests/test_presenter.py --output /tmp/suvlab-presenter-test
# Chromium 실행 파일을 지정할 때
CHROME_BIN=chromium python3 tests/test_presenter.py
# 실제 창 포커스 전환까지 확인할 때 (데스크톱 필요, 테스트 창만 열고 닫음)
python3 tests/test_presenter.py --headed --output /tmp/suvlab-presenter-headed
```

새 임시 브라우저 프로필에서 오프라인 `file://` 덱을 연다. 로컬 파일 접근·동일 출처
정책을 완화하는 플래그는 사용하지 않는다. 사용 중인 브라우저나 Claude 세션에는
연결하지 않는다.

기본 headless 모드에서는 두 창이 모두 포커스를 가진 것으로 보고되어 `blur` 이벤트를
명시적으로 보내 처리기를 확인한다. `--headed`는 실제 창을 전환하고 원본의 포커스가
해제된 것까지 확인한다. 보고서의 `focusEvidence`에 검사 방식이 기록된다.

검사 범위는 발표자 보기 배치(현재·다음·대본 위치, 대본 중심/슬라이드 중심 전환),
양방향 이동, 단축키, 빈 노트, 긴 대본의 스크롤 유지, 글씨 크기, 타이머,
작은 창 배치, 팝업 재사용·닫기·재열기, 원본 새로고침·닫기 후 연결 해제,
커스텀 애니메이션과 실제 `video` 재생·초기화, 현재 미리보기의 픽셀 동기화,
숫자·입력값·동적으로 바뀐 캔버스 반영, 다음 장의 정지 상태, 노트 미리보기 제외,
화면 캡처에서 캔버스·동영상이 실제 보이는지, 미리보기 CSP의 스크립트 차단,
PDF 노트 숨김, 팝업 차단 처리다. 화면 확장 배치와 프로젝터 하드웨어는 실제 환경에서
확인해야 한다.

실제 덱의 발표자 화면은 같은 조건으로 캡처해 눈으로 확인한다. 장 번호는 1부터 센다.
폭 900px 이하에서는 대본 중심 배치만 저장한다.

```bash
python3 tests/capture_presenter_views.py --deck output/덱.html --output /tmp/presenter-views \
  --slides 1,13,28 --sizes 1280x850,800x700
```
