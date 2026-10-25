# 발표자 노트 브라우저 검사

Python 3 표준 라이브러리, Chrome/Chromium, `pdftotext`(Poppler)가 필요하다.
별도 Node 패키지나 Python 패키지는 설치하지 않는다.

```bash
python3 tests/test_presenter.py
# 화면과 PDF 증거를 보관할 때
python3 tests/test_presenter.py --output /tmp/suvlab-presenter-test
# Chromium 실행 파일을 지정할 때
CHROME_BIN=chromium python3 tests/test_presenter.py
```

새 임시 브라우저 프로필에서 오프라인 `file://` 덱을 연다. 로컬 파일 접근·동일 출처
정책을 완화하는 플래그는 사용하지 않는다. 사용 중인 브라우저나 Claude 세션에는
연결하지 않는다.

검사 범위는 양방향 이동, 단축키, 빈 노트, 긴 대본의 스크롤 유지, 글씨 크기, 타이머,
작은 창 배치, 팝업 재사용·닫기·재열기, 원본 새로고침·닫기 후 연결 해제,
커스텀 애니메이션과 실제 `video` 재생·초기화, 노트 미리보기 제외,
PDF 노트 숨김, 팝업 차단 처리다. 화면 확장 배치와 프로젝터 하드웨어는 실제 환경에서
확인해야 한다.
