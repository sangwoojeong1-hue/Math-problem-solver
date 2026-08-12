// api/_lib/gemini.js
// solve.js와 report.js가 공통으로 사용하는 Gemini 호출 로직.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// 학년별로 참고할 교육과정 힌트 (모델이 눈높이에 맞는 설명을 하도록 돕는 용도)
const GRADE_CONTEXT = {
  '1': '중학교 1학년 과정: 소인수분해, 최대공약수/최소공배수, 정수와 유리수의 계산, 문자와 식, 일차방정식, 좌표평면과 그래프, 기본 도형과 작도, 평면도형/입체도형의 성질, 통계(자료의 정리)',
  '2': '중학교 2학년 과정: 유리수와 순환소수, 식의 계산(단항식/다항식), 부등식과 연립방정식, 일차함수와 그래프, 도형의 성질(삼각형/사각형), 도형의 닮음, 확률',
  '3': '중학교 3학년 과정: 제곱근과 실수, 다항식의 인수분해, 이차방정식, 이차함수와 그래프, 삼각비, 원의 성질, 통계(대푯값과 산포도)',
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

function extractText(apiResult) {
  try {
    const steps = Array.isArray(apiResult.steps) ? apiResult.steps : [];
    // 마지막 단계부터 역순으로 탐색해 텍스트 콘텐츠를 찾는다.
    for (let i = steps.length - 1; i >= 0; i--) {
      const content = steps[i] && Array.isArray(steps[i].content) ? steps[i].content : [];
      const textPart = content.find((c) => c && c.type === 'text' && typeof c.text === 'string');
      if (textPart) return textPart.text;
    }
  } catch (_) {
    // fall through
  }
  if (typeof apiResult.output_text === 'string') return apiResult.output_text;
  return null;
}

/**
 * Gemini Interactions API를 호출해 텍스트 응답을 받아온다.
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.promptText
 * @param {string} params.mimeType
 * @param {string} params.data - base64 인코딩된 파일 데이터
 * @returns {Promise<{ text: string|null, status: number, raw?: any }>}
 */
async function callGemini({ apiKey, promptText, mimeType, data }) {
  const inputType = mimeType === 'application/pdf' ? 'document' : 'image';

  const requestBody = {
    model: GEMINI_MODEL,
    input: [
      { type: 'text', text: promptText },
      { type: inputType, data, mime_type: mimeType },
    ],
  };

  const geminiRes = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error('Gemini API error:', geminiRes.status, errText);
    return { text: null, status: geminiRes.status };
  }

  const result = await geminiRes.json();
  const text = extractText(result);
  return { text, status: 200, raw: result };
}

function approxBase64Bytes(base64) {
  return Math.floor((base64.length * 3) / 4);
}

module.exports = {
  GEMINI_MODEL,
  GRADE_CONTEXT,
  ALLOWED_MIME_TYPES,
  callGemini,
  approxBase64Bytes,
};
