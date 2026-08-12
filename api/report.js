// /api/report.js
// Vercel Serverless Function
// 학생이 "이 풀이가 틀렸어요"를 눌렀을 때 호출된다.
// 1) 원래 문제 이미지/PDF를 다시 Gemini에게 보내 스스로 재검토하게 하고
// 2) (선택) Upstash Redis가 연결되어 있으면 신고 기록을 남긴다.
//
// Redis 연동은 선택 사항이다 — 환경변수가 없으면 저장 없이 재풀이만 동작한다.

const { GRADE_CONTEXT, ALLOWED_MIME_TYPES, callGemini, approxBase64Bytes } = require('./_lib/gemini');
const { saveReport } = require('./_lib/redis');

const MAX_COMMENT_LENGTH = 500;
const MAX_SOLUTION_LENGTH = 6000;

function buildReviewPrompt({ grade, originalSolution, comment }) {
  const context = GRADE_CONTEXT[grade] || '';
  const trimmedOriginal = String(originalSolution || '').slice(0, MAX_SOLUTION_LENGTH);
  const trimmedComment = String(comment || '').trim().slice(0, MAX_COMMENT_LENGTH);

  return `당신은 대한민국 중학교 수학을 가르치는 친절하고 경험 많은 선생님입니다.
학생은 중학교 ${grade}학년이고, 교육과정 범위는 다음과 같습니다: ${context}

이전에 같은 문제 이미지에 대해 아래와 같은 풀이를 제공했는데, 학생이 이 풀이에 오류가 있는 것 같다고 신고했습니다.

[이전에 제공한 풀이]
${trimmedOriginal}

[학생이 남긴 신고 코멘트]
${trimmedComment || '(코멘트 없음 — 어디가 틀렸는지 구체적으로 적지는 않았습니다)'}

첨부된 원본 문제 이미지를 처음부터 다시 꼼꼼히 살펴본 뒤, 아래 지침에 따라 한국어로 답변하세요.

1. 이전 풀이의 문제 해석, 개념 적용, 계산 과정을 하나씩 다시 검산하세요. 정말로 오류가 있는지, 아니면 이전 풀이가 맞는데 설명이 부족했던 것인지 냉정하게 판단하세요.
2. 만약 이전 풀이에 실제 오류가 있었다면:
   - "## 무엇이 틀렸나요" 섹션에서 어떤 부분이 왜 틀렸는지 학생이 이해할 수 있게 설명하세요.
   - "## 수정된 풀이" 섹션에서 처음부터 다시 정확한 풀이 과정을 제시하세요.
   - "## 정답" 섹션에서 정확한 최종 답을 명확하게 제시하세요.
3. 만약 다시 검토한 결과 이전 풀이가 맞다고 판단되면:
   - "## 다시 확인한 결과" 섹션에서 이전 풀이가 왜 맞는지, 이전과는 다른 방식(다른 예시나 비유 등)으로 한 번 더 쉽게 설명해주세요. 학생이 이해하지 못했을 가능성을 고려하세요.
4. 학년 수준(위 교육과정 범위)에 맞는 용어와 개념만 사용하세요.
5. 모든 수식은 LaTeX로 작성하고, 문장 속 수식은 \\( ... \\), 독립된 줄의 수식은 \\[ ... \\]로 감싸세요.
6. 친절하고 침착한 말투를 사용하세요. 학생이 신고했다고 방어적이거나 사과가 과도한 태도를 보이지 마세요.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경 변수를 확인해주세요.',
    });
    return;
  }

  try {
    const { grade, mimeType, data, originalSolution, comment } = req.body || {};

    if (!grade || !['1', '2', '3'].includes(String(grade))) {
      res.status(400).json({ error: '학년(1~3) 정보가 올바르지 않습니다.' });
      return;
    }
    if (!mimeType || typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      res.status(400).json({ error: '파일 형식(mimeType) 정보가 올바르지 않습니다.' });
      return;
    }
    if (!data || typeof data !== 'string') {
      res.status(400).json({ error: '원본 문제 파일 데이터가 없습니다. 다시 업로드 후 시도해주세요.' });
      return;
    }
    if (approxBase64Bytes(data) > 8 * 1024 * 1024) {
      res.status(413).json({ error: '파일이 너무 큽니다. 8MB 이하의 파일로 다시 시도해주세요.' });
      return;
    }
    if (!originalSolution || typeof originalSolution !== 'string') {
      res.status(400).json({ error: '이전 풀이 내용이 없습니다.' });
      return;
    }
    if (comment && typeof comment !== 'string') {
      res.status(400).json({ error: '신고 코멘트 형식이 올바르지 않습니다.' });
      return;
    }

    const promptText = buildReviewPrompt({ grade: String(grade), originalSolution, comment });
    const { text: revisedText, status } = await callGemini({ apiKey, promptText, mimeType, data });

    if (!revisedText) {
      res.status(502).json({
        error: `AI 재검토 중 오류가 발생했습니다${status ? ` (${status})` : ''}. 잠시 후 다시 시도해주세요.`,
      });
      return;
    }

    // 신고 기록 저장은 선택 사항 — 실패해도 학생에게는 재풀이 결과를 그대로 돌려준다.
    // 원본 이미지/PDF 파일 자체는 저장하지 않는다 (개인정보 보호 + 용량 절약).
    // Vercel 서버리스 함수는 응답을 보내고 나면 곧바로 종료될 수 있으므로,
    // 저장이 끝날 때까지 반드시 기다렸다가 응답한다 (fire-and-forget 금지).
    try {
      await saveReport({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        grade: String(grade),
        comment: (comment || '').trim().slice(0, MAX_COMMENT_LENGTH),
        originalSolution: String(originalSolution).slice(0, MAX_SOLUTION_LENGTH),
        revisedSolution: revisedText.slice(0, MAX_SOLUTION_LENGTH),
      });
    } catch (err) {
      console.error('saveReport unexpected error:', err);
    }

    res.status(200).json({ text: revisedText });
  } catch (err) {
    console.error('report.js error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err)) });
  }
};
