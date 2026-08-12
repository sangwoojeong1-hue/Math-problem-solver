// api/_lib/redis.js
// 오답 신고 기록을 저장하기 위한 선택적(optional) Redis 저장소.
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경변수가 없으면
// 저장 기능은 조용히 비활성화되고, 신고 자체(재풀이)는 계속 정상 동작한다.
// (Vercel Marketplace > Upstash 통합을 연결하면 이 두 환경변수가 자동으로 추가된다.)

const REPORTS_KEY = 'math-helper:reports';
const MAX_REPORTS = 500; // 무한정 쌓이지 않도록 최근 500건만 보관

let cachedClient = null;
let triedInit = false;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (cachedClient) return cachedClient;
  if (triedInit) return null;

  triedInit = true;
  try {
    // 의존성이 설치되어 있지 않으면(=아직 Upstash 연동 전) 여기서 조용히 실패시킨다.
    const { Redis } = require('@upstash/redis');
    cachedClient = Redis.fromEnv();
    return cachedClient;
  } catch (err) {
    console.error('Upstash Redis 초기화 실패 (신고 저장은 건너뜁니다):', err.message);
    return null;
  }
}

async function saveReport(record) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.lpush(REPORTS_KEY, JSON.stringify(record));
    await redis.ltrim(REPORTS_KEY, 0, MAX_REPORTS - 1);
    return true;
  } catch (err) {
    console.error('신고 내용 저장 실패:', err.message);
    return false;
  }
}

module.exports = { getRedis, saveReport, REPORTS_KEY };
