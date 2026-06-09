// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════
let isRecording = false;
let recognition = null;
let transcriptLines = [];
let timerInterval = null;
let startTime = null;
let allStudentsCache = [];

const TOTAL_SECS = 40 * 60;

// ═══════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ═══════════════════════════════════════════════
// Toast
// ═══════════════════════════════════════════════
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ═══════════════════════════════════════════════
// Loading
// ═══════════════════════════════════════════════
function setLoading(visible, text = 'LLM으로 분석 중...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').classList.toggle('visible', visible);
}

// ═══════════════════════════════════════════════
// Tabs
// ═══════════════════════════════════════════════
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

// ═══════════════════════════════════════════════
// API Key show / hide toggle
// ═══════════════════════════════════════════════
const EYE_OPEN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    btn.innerHTML = showing ? EYE_OFF : EYE_OPEN;
  });
});

// ═══════════════════════════════════════════════
// Settings — localStorage
// ═══════════════════════════════════════════════
const SETTINGS_KEY = 'classvoice_settings';
const FIELDS = [
  'llm-provider', 'llm-api-key',
  'points-api-key', 'class-id', 'points-per-praise', 'points-description',
  'student-list',
];

function saveSettings() {
  const data = {};
  FIELDS.forEach(id => { data[id] = document.getElementById(id).value; });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    FIELDS.forEach(id => {
      if (data[id] !== undefined) document.getElementById(id).value = data[id];
    });
  } catch (e) {}
}

FIELDS.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    saveSettings();
    if (id === 'student-list') renderStudentPreview();
  });
  document.getElementById(id).addEventListener('change', saveSettings);
});

document.getElementById('llm-provider').addEventListener('change', () => {
  const p = document.getElementById('llm-provider').value;
  const keyInput = document.getElementById('llm-api-key');
  const placeholders = { anthropic: 'sk-ant-...', openai: 'sk-...', upstage: 'up_...', gemini: 'AIza...' };
  keyInput.placeholder = placeholders[p] || '';
});

// ═══════════════════════════════════════════════
// Student list parser
// ═══════════════════════════════════════════════
function parseStudents(raw) {
  return raw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/);
      const code = parseInt(parts[0], 10);
      const name = parts.slice(1).join(' ');
      return (!isNaN(code) && name) ? { code, name } : null;
    })
    .filter(Boolean);
}

function renderStudentPreview() {
  const students = parseStudents(document.getElementById('student-list').value);
  const preview = document.getElementById('student-preview');
  preview.innerHTML = '';
  students.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'student-chip';
    chip.textContent = `${s.code}. ${s.name}`;
    preview.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════
// Start Class
// ═══════════════════════════════════════════════
document.getElementById('btn-start-class').addEventListener('click', () => {
  if (!document.getElementById('llm-api-key').value.trim()) {
    showToast('LLM API 키를 입력해주세요'); return;
  }
  if (parseStudents(document.getElementById('student-list').value).length === 0) {
    showToast('학생 명단을 입력해주세요'); return;
  }
  transcriptLines = [];
  renderTranscript();
  resetTimer();
  showScreen('screen-recording');
});

document.getElementById('btn-back-settings').addEventListener('click', () => {
  if (isRecording) stopRecording();
  resetTimer();
  showScreen('screen-settings');
});

// ═══════════════════════════════════════════════
// Timer
// ═══════════════════════════════════════════════
function resetTimer() {
  clearInterval(timerInterval);
  startTime = null;
  document.getElementById('timer-display').textContent = '00:00';
  document.getElementById('progress-bar').style.width = '0%';
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
    document.getElementById('progress-bar').style.width = Math.min(elapsed / TOTAL_SECS * 100, 100) + '%';
  }, 1000);
}

// ═══════════════════════════════════════════════
// Transcript
// ═══════════════════════════════════════════════
function renderTranscript() {
  const box = document.getElementById('transcript-log');
  if (transcriptLines.length === 0) {
    box.innerHTML = '<span class="transcript-empty">녹음을 시작하면 인식된 텍스트가 여기에 표시됩니다.</span>';
    return;
  }
  box.innerHTML = transcriptLines.map(t => `<div>${t}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

// ═══════════════════════════════════════════════
// Speech Recognition
// ═══════════════════════════════════════════════
function startRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장)'); return; }

  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (e) => {
    const text = Array.from(e.results)
      .filter(r => r.isFinal)
      .map(r => r[0].transcript.trim())
      .join('');
    if (text) { transcriptLines.push(text); renderTranscript(); }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'audio-capture') return;
    if (e.error === 'not-allowed') { showToast('마이크 접근 권한이 필요합니다'); stopRecording(); }
  };

  recognition.onend = () => {
    if (isRecording) { try { recognition.start(); } catch (e) {} }
  };

  recognition.start();
  isRecording = true;

  const btn = document.getElementById('btn-record');
  btn.innerHTML = '녹음<br>중지';
  btn.classList.add('recording');
  document.getElementById('rec-dot').classList.add('visible');
  startTimer();
}

function stopRecording() {
  isRecording = false;
  if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; }
  clearInterval(timerInterval);
  const btn = document.getElementById('btn-record');
  btn.innerHTML = '녹음<br>시작';
  btn.classList.remove('recording');
  document.getElementById('rec-dot').classList.remove('visible');
}

document.getElementById('btn-record').addEventListener('click', () => {
  if (isRecording) stopRecording(); else startRecording();
});

// ═══════════════════════════════════════════════
// End Class → LLM
// ═══════════════════════════════════════════════
document.getElementById('btn-end-class').addEventListener('click', async () => {
  stopRecording();
  const fullText = transcriptLines.join(' ').trim();
  if (!fullText) { showToast('녹취 내용이 없습니다. 먼저 녹음을 진행해주세요.'); return; }
  await analyzeWithLLM(fullText);
});

async function analyzeWithLLM(text) {
  const provider = document.getElementById('llm-provider').value;
  const apiKey   = document.getElementById('llm-api-key').value.trim();
  const students = parseStudents(document.getElementById('student-list').value);
  allStudentsCache = students;

  const studentList = students.map(s => `${s.code}|${s.name}`).join(', ');
  const systemMsg = '당신은 수업 녹취록에서 칭찬받은 학생을 찾는 도우미입니다. 반드시 JSON만 응답하세요.';
  const userMsg = `학생 목록(출석번호|이름): ${studentList}
아래 텍스트에서 교사가 특정 학생을 칭찬한 발언을 찾아주세요.
칭찬 표현 예: 잘했어, 훌륭해, 최고야, 맞아, 잘했다, 대단해, 좋아, 완벽해, 훌륭하다, 최고다 등
결과는 JSON만 반환하세요 (다른 텍스트 없이):
{"praised":[{"code":출석번호,"name":"이름","count":횟수,"examples":["발언1","발언2"]}]}
칭찬받은 학생이 없으면 {"praised":[]} 반환.
텍스트: ${text}`;

  setLoading(true, 'LLM으로 칭찬 학생 분석 중...');
  try {
    const result = await callLLM(provider, apiKey, systemMsg, userMsg);
    const praised = parseLLMResponse(result);
    showResults(praised, students);
  } catch (e) {
    showToast(`오류: ${e.message}`, 4000);
  } finally {
    setLoading(false);
  }
}

// ═══════════════════════════════════════════════
// LLM API (provider별 분기)
// ═══════════════════════════════════════════════
async function callLLM(provider, apiKey, systemMsg, userMsg) {
  let res, data;

  if (provider === 'anthropic') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemMsg,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API 오류 ${res.status}`);
    return data.content[0].text;

  } else if (provider === 'openai') {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
      }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API 오류 ${res.status}`);
    return data.choices[0].message.content;

  } else if (provider === 'upstage') {
    res = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'solar-pro',
        max_tokens: 1024,
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
      }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API 오류 ${res.status}`);
    return data.choices[0].message.content;

  } else { // gemini
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemMsg}\n\n${userMsg}` }] }] }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API 오류 ${res.status}`);
    return data.candidates[0].content.parts[0].text;
  }
}

function parseLLMResponse(text) {
  text = text.trim();
  try { return JSON.parse(text).praised || []; } catch (e) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]).praised || []; } catch (e) {} }
  throw new Error('LLM 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
}

// ═══════════════════════════════════════════════
// Results — 전체 학생 표시, 수동 체크 가능
// ═══════════════════════════════════════════════
function showResults(praised, allStudents) {
  const praisedMap = {};
  praised.forEach(p => { praisedMap[p.code] = p; });
  const praisedCodes = new Set(Object.keys(praisedMap).map(Number));
  const detectedCount = praisedCodes.size;

  document.getElementById('result-title').textContent = `칭찬 감지: ${detectedCount}명`;
  document.getElementById('result-subtitle').textContent =
    `전체 ${allStudents.length}명 중 LLM이 ${detectedCount}명 감지 — 아래에서 수동으로 수정할 수 있습니다.`;

  const list = document.getElementById('praised-list');
  list.innerHTML = '';

  if (detectedCount > 0) {
    list.appendChild(makeSep(`칭찬 감지됨 (${detectedCount}명)`));
    allStudents.filter(s => praisedCodes.has(s.code))
      .forEach(s => list.appendChild(buildCard(s, praisedMap[s.code], true)));
  }

  const undetected = allStudents.filter(s => !praisedCodes.has(s.code));
  if (undetected.length > 0) {
    list.appendChild(makeSep(`수동 선택 (${undetected.length}명)`));
    undetected.forEach(s => list.appendChild(buildCard(s, null, false)));
  }

  syncMasterCheck();
  document.getElementById('btn-give-points').disabled = false;
  showScreen('screen-results');
}

function makeSep(text) {
  const el = document.createElement('div');
  el.className = 'section-sep';
  el.textContent = text;
  return el;
}

function buildCard(student, praisedData, isChecked) {
  const card = document.createElement('div');
  card.className = 'praised-card ' + (praisedData ? 'is-praised' : 'is-manual');
  card.dataset.code = student.code;
  card.dataset.name = student.name;

  const examplesHtml = (praisedData?.examples || [])
    .map(ex => `<div class="example-item">"${ex}"</div>`).join('');
  const uid = `card-${student.code}`;

  card.innerHTML = `
    <input type="checkbox" class="praised-check" id="${uid}" ${isChecked ? 'checked' : ''}>
    <div class="praised-card-body">
      <div>
        <label for="${uid}" style="cursor:pointer">
          <span class="praised-name">${student.name}</span>
        </label>
        ${praisedData
          ? `<span class="praised-count">칭찬 ${praisedData.count}회</span>`
          : '<span class="manual-badge">수동</span>'}
      </div>
      <div class="praised-meta">출석번호 ${student.code}</div>
      ${examplesHtml
        ? `<span class="examples-toggle">발언 보기 ▾</span><div class="examples-list">${examplesHtml}</div>`
        : ''}
    </div>`;

  card.querySelector('.praised-check').addEventListener('change', syncMasterCheck);

  const toggle = card.querySelector('.examples-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const ex = card.querySelector('.examples-list');
      const open = ex.classList.toggle('open');
      toggle.textContent = open ? '발언 숨기기 ▴' : '발언 보기 ▾';
    });
  }

  return card;
}

function syncMasterCheck() {
  const all     = document.querySelectorAll('.praised-check');
  const checked = document.querySelectorAll('.praised-check:checked');
  const master  = document.getElementById('check-all');
  master.indeterminate = checked.length > 0 && checked.length < all.length;
  master.checked = checked.length === all.length;
}

document.getElementById('check-all').addEventListener('change', (e) => {
  document.querySelectorAll('.praised-check').forEach(c => { c.checked = e.target.checked; });
});

// ═══════════════════════════════════════════════
// Give Points
// ═══════════════════════════════════════════════
document.getElementById('btn-give-points').addEventListener('click', async () => {
  const selected = [];
  document.querySelectorAll('.praised-check:checked').forEach(cb => {
    const card = cb.closest('.praised-card');
    selected.push({ code: parseInt(card.dataset.code), name: card.dataset.name, card });
  });
  if (selected.length === 0) { showToast('선택된 학생이 없습니다'); return; }

  const apiKey      = document.getElementById('points-api-key').value.trim();
  const classId     = document.getElementById('class-id').value.trim();
  const points      = parseFloat(document.getElementById('points-per-praise').value) || 10;
  const description = document.getElementById('points-description').value.trim() || '수업 중 칭찬';

  if (!apiKey)  { showToast('포인트 API 키를 입력해주세요'); return; }
  if (!classId) { showToast('클래스 ID를 입력해주세요'); return; }

  document.getElementById('btn-give-points').disabled = true;

  for (let i = 0; i < selected.length; i++) {
    const { code, card } = selected[i];
    setLoading(true, `포인트 부여 중... (${i + 1} / ${selected.length})`);
    try {
      const res = await fetch(
        `https://growndcard.com/api/v1/classes/${classId}/students/${code}/points`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({ type: 'reward', points, description }),
        }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        card.classList.add('success');
        const badge = document.createElement('div');
        badge.className = 'status-badge ' + (data.leveledUp ? 'levelup' : 'ok');
        badge.textContent = data.leveledUp ? `🎉 레벨업! +${points}p` : `✓ +${points}p 완료`;
        card.querySelector('.praised-card-body').appendChild(badge);
      } else {
        card.classList.add('error');
        const badge = document.createElement('div');
        badge.className = 'status-badge err';
        badge.textContent = getErrorMessage(res.status, data);
        card.querySelector('.praised-card-body').appendChild(badge);
      }
    } catch (e) {
      card.classList.add('error');
      const badge = document.createElement('div');
      badge.className = 'status-badge err';
      badge.textContent = '네트워크 오류';
      card.querySelector('.praised-card-body').appendChild(badge);
    }
    await delay(200);
  }

  setLoading(false);
  showToast('포인트 부여가 완료되었습니다!');
});

function getErrorMessage(status, data) {
  const code = data?.error?.code || data?.code || '';
  if (status === 404 || code === 'student_not_found')    return '출석번호를 확인해주세요';
  if (status === 429 || code === 'rate_limit_exceeded')  return '잠시 후 다시 시도해주세요';
  if (status === 401 || code === 'unauthorized')         return '포인트 API 키를 확인해주세요';
  return `오류 (${status})`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════
// Restart
// ═══════════════════════════════════════════════
document.getElementById('btn-restart').addEventListener('click', () => {
  transcriptLines = [];
  allStudentsCache = [];
  renderTranscript();
  resetTimer();
  const btn = document.getElementById('btn-record');
  btn.innerHTML = '녹음<br>시작';
  btn.classList.remove('recording');
  document.getElementById('rec-dot').classList.remove('visible');
  document.getElementById('btn-give-points').disabled = false;
  showScreen('screen-recording');
});

// ═══════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════
loadSettings();
renderStudentPreview();
