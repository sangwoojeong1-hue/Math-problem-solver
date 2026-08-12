// /api/solve.js
// Vercel Serverless Function
// 학생이 업로드한 수학 문제(이미지 또는 PDF)를 Gemini API로 전달하고
// 학년 수준에 맞는 풀이 과정과 정답을 받아 돌려준다.
//
// GEMINI_API_KEY는 반드시 Vercel 프로젝트의 환경 변수로만 설정하고,
// 절대 코드에 직접 적지 않는다. (README.md 참고)

const { GRADE_CONTEXT, ALLOWED_MIME_TYPES, callGemini, approxBase64Bytes } = require('./_lib/gemini');

function buildPrompt(grade) {
  const context = GRADE_CONTEXT[grade] || '';
  return `당신은 대한민국 중학교 수학을 가르치는 친절하고 경험 많은 선생님입니다.
학생은 현재 중학교 ${grade}학년이며, 수학 문제가 담긴 이미지 또는 PDF 파일을 업로드했습니다.
참고로 중학교 ${grade}학년 교육과정 범위는 다음과 같습니다: ${context}

아래 지침을 반드시 지켜서 한국어로 답변하세요.

1. "## 문제 확인" 섹션에서, 이미지(또는 PDF)에서 인식한 문제를 최대한 정확하게 그대로 옮겨 적으세요.
   만약 글씨가 흐리거나 잘려서 정확히 읽을 수 없는 부분이 있다면 솔직하게 알려주고, 짐작한 부분은 짐작이라고 표시하세요.
2. "## 핵심 개념" 섹션에서, 이 문제를 풀기 위해 필요한 개념을 학생의 학년 수준에 맞는 쉬운 말로 짧게 설명하세요.
   그 학년 교육과정에서 아직 배우지 않았을 만한 개념(예: 중1 학생에게 이차방정식 공식)은 사용하지 말고, 배운 범위 안에서 설명하세요.
3. "## 풀이 과정" 섹션에서, 단계를 나누어 차근차근 풀이하세요. 각 단계마다 "왜" 그렇게 계산하는지 이유를 함께 설명하세요.
   계산 실수를 하지 않도록 각 단계를 검산하듯 신중하게 진행하세요.
4. "## 정답" 섹션에서, 최종 답을 명확하고 굵게 제시하세요.
5. 모든 수식은 LaTeX로 작성하고, 문장 속 수식은 \\( ... \\)로, 독립된 줄의 수식은 \\[ ... \\]로 감싸세요.
   일반 텍스트에 $ 기호나 마크다운 굵게(**) 남용은 피하고, 위 섹션 제목은 정확히 "## 문제 확인", "## 핵심 개념", "## 풀이 과정", "## 정답" 형식을 사용하세요.
6. 친절하고 격려하는 말투를 사용하되, 불필요하게 길게 늘어지지 않도록 하세요.
7. 만약 업로드된 파일에 수학 문제가 보이지 않는다면, 그 사실을 정중히 알리고 다시 업로드를 요청하세요.`;
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
    const { grade, mimeType, data } = req.body || {};

    if (!grade || !['1', '2', '3'].includes(String(grade))) {
      res.status(400).json({ error: '학년(1~3) 정보가 올바르지 않습니다.' });
      return;
    }
    if (!mimeType || typeof mimeType !== 'string') {
      res.status(400).json({ error: '파일 형식(mimeType) 정보가 없습니다.' });
      return;
    }
    if (!data || typeof data !== 'string') {
      res.status(400).json({ error: '파일 데이터가 없습니다.' });
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      res.status(400).json({ error: `지원하지 않는 파일 형식입니다: ${mimeType}` });
      return;
    }
    if (approxBase64Bytes(data) > 8 * 1024 * 1024) {
      res.status(413).json({ error: '파일이 너무 큽니다. 8MB 이하의 파일을 업로드해주세요.' });
      return;
    }

    const promptText = buildPrompt(String(grade));
    const { text, status } = await callGemini({ apiKey, promptText, mimeType, data });

    if (!text) {
      res.status(status && status !== 200 ? 502 : 502).json({
        error: `AI 서버 호출 중 오류가 발생했습니다${status ? ` (${status})` : ''}. 잠시 후 다시 시도해주세요.`,
      });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error('solve.js error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err)) });
  }
};
