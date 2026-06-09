# ClassVoice

수업 중 교사가 칭찬한 학생을 자동으로 추적하고, 포인트를 부여하는 웹앱입니다.

🌐 **[classvoice.vercel.app](https://classvoice.vercel.app)**

---

## 주요 기능

- **실시간 음성 인식** — Web Speech API (한국어)로 수업 중 발화를 자동 수집
- **LLM 분석** — 수업 종료 후 전체 녹취를 LLM에 1회 전송해 칭찬받은 학생 추출
- **수동 보정** — 결과 화면에서 감지 누락/오감지 학생을 직접 체크/해제
- **포인트 자동 부여** — [Grownd](https://growndcard.com) 포인트 API 연동

## 지원 LLM

| 제공사 | 모델 |
|--------|------|
| Anthropic | claude-haiku-4-5 |
| OpenAI | gpt-4o-mini |
| Google | gemini-2.0-flash |
| Upstage | solar-pro |

## 사용 방법

### 1. 설정
- **LLM 설정**: 사용할 LLM 제공사와 API 키 입력
- **포인트 API 설정**: Grownd API 키, 클래스 ID, 칭찬 1회당 포인트 수 입력
- **학생 명단**: `출석번호 이름` 형식으로 한 줄씩 입력
  ```
  1 김지수
  2 이민준
  3 박서연
  ```

### 2. 수업 녹음
- **녹음 시작** 버튼을 눌러 수업 진행 (40분 타이머 / 진행바 표시)
- 음성은 자동으로 텍스트로 수집되며, 브라우저 5분 제한은 자동 재시작으로 우회

### 3. 결과 확인 및 포인트 부여
- 수업 종료 후 LLM이 칭찬받은 학생을 자동 감지
- 감지 목록에서 체크/해제로 수동 보정 가능
- **포인트 부여** 버튼으로 선택된 학생에게 일괄 포인트 지급

## 기술 스택

- 순수 HTML + CSS + JavaScript (빌드 도구 없음)
- 서버 없음, DB 없음
- 설정값은 브라우저 `localStorage`에 저장 (새로고침 유지)

## 파일 구조

```
index.html   — HTML 구조
styles.css   — 스타일
app.js       — 앱 로직
```

## 로컬 실행

별도 설치 없이 `index.html`을 Chrome에서 열면 됩니다.  
음성 인식은 **Chrome** 브라우저에서만 동작합니다.

## 배포

```bash
vercel --prod --yes
```
