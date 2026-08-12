# AI 수학 도우미 (중학생용)

중학생이 학년을 선택하고 수학 문제 사진(또는 PDF)을 올리면, Gemini API가 문제를 인식해서
학년 수준에 맞는 풀이 과정과 정답을 알려주는 웹 앱입니다. 풀이가 틀린 것 같으면 학생이
직접 신고할 수 있고, AI가 그 자리에서 다시 검토해서 수정된 풀이를 보여줍니다.

- 프론트엔드: 순수 HTML/CSS/JavaScript (프레임워크 없음)
- 백엔드: Vercel Serverless Function 2개 (`/api/solve.js`, `/api/report.js`)
- AI: Google Gemini API (Interactions API, 기본 모델 `gemini-3.6-flash`)
- (선택) 신고 기록 저장: Upstash Redis (Vercel Marketplace 무료 연동)

Gemini API 키는 **서버(백엔드)에서만** 사용하고, 브라우저(프론트엔드)에는 절대 노출되지 않도록
설계되어 있습니다. 그래서 GAS나 AI Studio가 아니어도, 이 방식이 무료로 안전하게 운영할 수 있는
가장 표준적인 구조입니다.

---

## 1. 폴더 구조

```
math-helper/
├─ index.html            # 화면(학년 선택, 업로드, 결과 표시, 오답 신고)
├─ style.css
├─ script.js
├─ api/
│  ├─ solve.js            # 서버리스 함수: 문제 풀이 요청 처리
│  ├─ report.js            # 서버리스 함수: 오답 신고 → AI 재검토 처리
│  └─ _lib/
│     ├─ gemini.js          # Gemini API 호출 공통 로직 (solve.js, report.js가 공유)
│     └─ redis.js           # (선택) 신고 기록 저장용 Redis 헬퍼
├─ package.json
├─ .env.example            # 참고용 (실제 키는 여기에 적지 않음)
└─ README.md
```

## 2. 디자인 시스템

토스(Toss) 스타일에서 영감을 받아 미니멀하고 신뢰감 있는 톤으로 다시 디자인했습니다. 라이트/다크
모드를 모두 지원하고, 이모지 대신 얇은 선 스타일의 SVG 아이콘을 사용합니다.

- **폰트**: [Pretendard](https://github.com/orioncactus/pretendard) — 한국어 UI에 최적화된
  무료 오픈소스 폰트로, 토스를 비롯한 다수의 국내 서비스가 사용합니다. `index.html`에서 CDN으로
  불러오며, 접속이 안 되는 환경에서는 시스템 기본 폰트로 자연스럽게 대체됩니다.
- **컬러/타이포/그림자 등 디자인 토큰**: `style.css` 최상단 `:root`와 `html[data-theme='light'|'dark']`
  블록에 CSS 변수로 정의돼 있습니다. `--primary` 색상 하나만 바꿔도 버튼·포인트 컬러 전체가 바뀝니다.
- **다크모드**: 처음 방문 시 기기의 시스템 설정(`prefers-color-scheme`)을 따라가고, 우측 상단
  토글 버튼으로 직접 바꾸면 그 선택이 브라우저에 저장되어 다음 방문에도 유지됩니다.
- **아이콘**: 카메라·문서·체크·깃발 등 모든 아이콘은 `index.html`/`script.js`에 인라인 SVG로
  직접 그려져 있어 별도 아이콘 폰트나 이미지 파일이 필요 없습니다. `currentColor`를 사용하므로
  다크모드에서도 자동으로 색이 맞춰집니다.
- **반응형**: 모바일에서는 카메라로 바로 촬영하기 좋은 단일 컬럼 레이아웃, 데스크톱(720px 이상)에서는
  여백과 글자 크기를 넉넉하게 키워 화면을 꽉 채우지 않고 중앙에 카드 형태로 보여줍니다.

디자인을 더 바꾸고 싶으신 부분(포인트 컬러, 로고, 톤앤매너 등)이 있으면 언제든 말씀해주세요.

## 3. 준비물

1. **Gemini API 키** — 이미 발급받으셨다고 하셨으니 그대로 사용하시면 됩니다.
   (혹시 재발급이 필요하면 [Google AI Studio](https://aistudio.google.com/apikey)에서
   무료로 새로 만들 수 있습니다.)
2. **Vercel 계정** (무료) — <https://vercel.com> 에서 GitHub/Google 계정으로 가입 가능합니다.
3. *(선택)* 오답 신고 기록을 남기고 싶다면 Upstash 계정도 필요하지만, 이건 Vercel
   대시보드에서 클릭 몇 번으로 만들 수 있어서 미리 가입해둘 필요는 없습니다. (5번 섹션 참고)

## 4. 배포 방법 (가장 쉬운 방법: Vercel 웹 대시보드)

1. 이 프로젝트 폴더를 GitHub 저장소로 올립니다. (GitHub 데스크톱 앱이나 `git` 명령어 사용)
2. [vercel.com](https://vercel.com) 에 로그인 후 **Add New → Project** 를 클릭합니다.
3. 방금 올린 GitHub 저장소를 선택하고 **Import** 합니다. (별도 빌드 설정 필요 없음 — Vercel이 자동 인식)
4. **Environment Variables** 항목에서 아래처럼 등록합니다.
   - `GEMINI_API_KEY` = 발급받은 Gemini API 키 값
5. **Deploy** 버튼을 누르면 1~2분 안에 배포가 끝나고, `https://프로젝트이름.vercel.app` 같은
   주소가 생성됩니다. 이 주소를 학생들에게 공유하면 됩니다.

> GitHub 없이 배포하고 싶다면 Vercel CLI를 사용하는 방법도 있습니다.

### Vercel CLI로 배포하기 (선택)

```bash
npm install -g vercel
cd math-helper
vercel login
vercel            # 질문에 답하면 미리보기 배포가 생성됩니다
vercel env add GEMINI_API_KEY    # 배포된 프로젝트에 API 키 등록
vercel --prod     # 실제 서비스용(프로덕션) 배포
```

## 5. 오답 신고 기록 저장하기 (선택 — Upstash Redis 연동)

학생이 "이 풀이가 틀린 것 같아요"를 누르면, **DB를 연결하지 않아도** AI가 즉시 다시
검토해서 수정된 풀이를 보여줍니다. 다만 어떤 문제가 자주 신고되는지 나중에 살펴보고
싶다면, 아래처럼 무료 Redis(Upstash)를 연결하면 신고 기록이 쌓입니다.

1. 배포한 Vercel 프로젝트 대시보드 → **Storage** 탭(또는 Integrations) → **Marketplace Database Integrations**로 이동합니다.
2. **Upstash (Redis)** 를 선택해 설치합니다. 새 Upstash 계정을 만들거나 기존 계정을 연결할 수 있습니다.
3. 설치 마법사에서 방금 만든 Vercel 프로젝트를 연결합니다.
4. 완료되면 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 두 환경변수가
   프로젝트에 **자동으로** 추가됩니다. (직접 값을 입력할 필요 없음)
5. 프로젝트를 한 번 다시 배포(Redeploy)하면 연동이 적용됩니다.

연결 후에는 신고할 때마다 다음 정보가 저장됩니다: 신고 시각, 학년, 학생이 남긴 코멘트,
신고 전/후 풀이 텍스트. **문제 사진/PDF 원본은 저장되지 않습니다** (개인정보 보호 + 용량 절약).

저장된 기록은 Upstash 콘솔의 **Data Browser**에서 `math-helper:reports` 라는 키(list)를
열어보면 최신순으로 확인할 수 있습니다. 별도의 관리자 화면은 아직 만들지 않았는데,
나중에 목록을 보기 편한 웹 페이지로 만들고 싶으시면 말씀해주세요 — 추가해드릴게요.

## 6. 로컬에서 테스트하기 (선택)

```bash
npm install -g vercel
cd math-helper
echo "GEMINI_API_KEY=발급받은_키_값" > .env.local
vercel dev
```

`vercel dev`를 실행하면 터미널에 나오는 주소(보통 `http://localhost:3000`)로 접속해서
배포 전에 미리 테스트해볼 수 있습니다. Upstash를 연동했다면 `vercel env pull .env.local`로
로컬에도 같은 환경변수를 받아올 수 있습니다.

## 7. 커스터마이징 팁

- **학년별 설명 톤/범위 수정**: `api/_lib/gemini.js`의 `GRADE_CONTEXT`와, `api/solve.js` /
  `api/report.js` 안의 프롬프트 함수에서 학년별 교육과정 범위나 말투, 풀이 형식을 조정할 수 있습니다.
- **재검토(신고) 프롬프트 수정**: `api/report.js`의 `buildReviewPrompt()` 함수에서 AI가 오답
  신고를 어떻게 재검토할지(예: 더 엄격하게 검산하기, 다른 방식으로 재설명하기 등) 조정할 수 있습니다.
- **모델 변경**: `.env`에 `GEMINI_MODEL=원하는_모델명`을 추가하면 기본값(`gemini-3.6-flash`) 대신
  다른 모델을 사용할 수 있습니다. Google이 모델을 계속 업데이트하므로, 만약 나중에
  "모델을 찾을 수 없다"는 오류가 나면 [Gemini API 문서](https://ai.google.dev/gemini-api/docs)에서
  최신 모델 이름을 확인해서 바꿔주세요.
- **디자인**: 컬러/폰트/다크모드 등 디자인 관련 내용은 위 "2. 디자인 시스템" 섹션과
  `style.css`의 CSS 변수를 참고하세요.
- **신고 기록 보관 개수**: `api/_lib/redis.js`의 `MAX_REPORTS` 값(기본 500건)을 조정하면
  더 많거나 적게 보관할 수 있습니다.

## 8. 안내 및 주의사항

- 업로드 파일은 이미지(JPG/PNG/WEBP/HEIC) 또는 PDF, **최대 8MB**까지 지원합니다.
  더 큰 파일이 필요하면 Vercel의 요청 크기 제한 및 Gemini Files API 사용을 별도로 검토해야 합니다.
- 업로드된 사진/PDF는 풀이(그리고 신고 시 재검토)를 위해 Google Gemini API로 전송됩니다.
  Upstash를 연동하지 않으면 신고 기록조차 저장되지 않고, 연동해도 사진 원본은 저장되지
  않습니다. 그래도 문제 사진에 학생 얼굴이나 이름 등 개인정보가 함께 찍히지 않도록
  안내 문구를 화면 하단에 넣어두었습니다.
- Gemini API는 무료 사용량에 한도가 있습니다. 사용자가 많아지면 유료 요금제 전환이나
  요청 빈도 제한(rate limit) 로직 추가를 고려하세요. 신고 후 재풀이는 Gemini 호출을
  한 번 더 소모하니, 남용이 걱정되면 신고 버튼에 쿨다운을 추가하는 것도 고려해보세요.
- AI가 항상 100% 정확한 것은 아닙니다. 신고 기능이 있긴 하지만, 여전히 손글씨가 흐리거나
  복잡한 도형 문제는 인식 오류가 날 수 있으니, "AI의 풀이가 계속 이상하면 선생님께 다시
  확인하자"는 안내를 학생들에게 함께 해주시면 좋습니다.

## 9. 문제 해결 (Troubleshooting)

| 증상 | 원인/해결 |
|---|---|
| "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다" | Vercel 프로젝트의 Environment Variables에 `GEMINI_API_KEY`를 등록했는지 확인 후 재배포 |
| "AI 서버 호출 중 오류가 발생했습니다 (404)" 등 | `GEMINI_MODEL` 값이 더 이상 존재하지 않는 모델일 수 있음 → 최신 모델명으로 교체 |
| "파일이 너무 큽니다" | 사진을 좀 더 압축하거나 여러 장 대신 한 문제씩 업로드 |
| 신고는 되는데 Upstash Data Browser에 아무것도 안 보임 | `UPSTASH_REDIS_REST_URL`/`TOKEN`이 제대로 연결됐는지, 연동 후 재배포했는지 확인 (연동 안 해도 재풀이 자체는 정상 동작합니다) |
| 배포는 됐는데 흰 화면만 나옴 | 브라우저 개발자도구(F12) Console 탭에서 에러 메시지 확인 |
