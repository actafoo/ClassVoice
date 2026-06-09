# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassVoice는 초등학교 교사가 40분 수업 중 칭찬한 학생을 Web Speech API로 자동 추적하고, LLM으로 이름을 추출한 뒤 외부 포인트 API(Grownd)로 보상을 부여하는 순수 프론트엔드 웹앱입니다. 서버/DB 없음.

## File Structure

```
index.html   — HTML 구조 (화면 3개: 설정 / 녹음 / 결과)
styles.css   — 모든 CSS (CSS 변수로 색상 관리)
app.js       — 모든 JS 로직
```

## Deployment

```bash
vercel --prod --yes   # Vercel로 프로덕션 배포
```

프로덕션 URL: **https://classvoice.vercel.app**  
Vercel 프로젝트: `actafoos-projects/classvoice`

## Architecture

### 화면 전환
`showScreen(id)` 함수로 `#screen-settings` → `#screen-recording` → `#screen-results` 전환.

### 설정 저장
`localStorage` 키 `classvoice_settings`에 JSON으로 전체 설정 저장. `FIELDS` 배열에 정의된 input ID들이 자동으로 저장/복원됨.

### 음성 인식 흐름
`startRecording()` → Web Speech API(`ko-KR`, `interimResults: false`) → final 결과만 `transcriptLines[]`에 누적 → `recognition.onend`에서 `isRecording === true`면 자동 재시작 (브라우저 5분 제한 우회).

### LLM 분석
`btn-end-class` 클릭 → `analyzeWithLLM(fullText)` → `callLLM(provider, apiKey, systemMsg, userMsg)` → `parseLLMResponse()`. LLM은 수업 종료 후 **1회만** 호출. `callLLM`은 `provider` 값(`anthropic` / `openai` / `upstage` / `gemini`)에 따라 분기.

### 결과 화면
`showResults(praised, allStudents)`가 전체 학생 명단을 렌더링:
- LLM 감지 학생: `is-praised` 클래스, pre-checked
- 미감지 학생: `is-manual` 클래스, unchecked (수동 체크 가능)

카드에 `data-code`, `data-name` 저장 → 포인트 부여 시 사용.

### 포인트 API
`POST https://growndcard.com/api/v1/classes/{classId}/students/{code}/points`  
헤더: `X-API-Key`, `Content-Type: application/json`  
바디: `{ type: "reward", points, description }`  
응답의 `leveledUp` 필드로 레벨업 뱃지 표시. 호출 간 200ms delay (rate limit 대응).

## LLM Provider 추가 시

`callLLM()` 함수에 분기 추가 + `<select id="llm-provider">`에 옵션 추가 + `llm-provider` change 핸들러에 placeholder 추가.
