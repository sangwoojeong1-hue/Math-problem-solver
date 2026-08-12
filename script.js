(() => {
  'use strict';

  // --- 다크모드 토글 ---
  // (테마 "값" 자체는 FOUC 방지를 위해 index.html의 인라인 스크립트가 이미 설정해뒀다.
  //  여기서는 토글 버튼 동작 + 저장만 담당한다.)
  const THEME_STORAGE_KEY = 'mathHelperTheme';
  const themeToggle = document.getElementById('theme-toggle');

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {
      // localStorage를 못 쓰는 환경이어도(예: 프라이빗 모드) 토글 자체는 계속 동작해야 한다.
    }
  });

  // --- 상태 아이콘 (이모지 대신 사용) ---
  const ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.5"/></svg>';
  const ICON_ALERT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>';

  const state = {
    grade: null,
    file: null,
    base64: null,
    mimeType: null,
    lastSolutionText: null, // 신고(재풀이) 시 원본 풀이로 함께 전송
  };

  const MAX_BYTES = 8 * 1024 * 1024; // 8MB

  const gradeButtons = document.querySelectorAll('.grade-btn');
  const stepIndex1 = document.getElementById('step-index-1');
  const stepIndex2 = document.getElementById('step-index-2');
  const fileInput = document.getElementById('file-input');
  const dropzoneEmpty = document.getElementById('dropzone-empty');
  const dropzonePreview = document.getElementById('dropzone-preview');
  const previewImage = document.getElementById('preview-image');
  const previewPdf = document.getElementById('preview-pdf');
  const previewFilename = document.getElementById('preview-filename');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const btnSolve = document.getElementById('btn-solve');
  const btnSolveLabel = document.getElementById('btn-solve-label');
  const errorMessage = document.getElementById('error-message');
  const loadingSection = document.getElementById('loading');
  const resultSection = document.getElementById('result-section');
  const revisedBanner = document.getElementById('revised-banner');
  const resultContent = document.getElementById('result-content');
  const btnReset = document.getElementById('btn-reset');

  const btnReportToggle = document.getElementById('btn-report-toggle');
  const reportForm = document.getElementById('report-form');
  const reportComment = document.getElementById('report-comment');
  const btnReportCancel = document.getElementById('btn-report-cancel');
  const btnReportSubmit = document.getElementById('btn-report-submit');
  const reportStatus = document.getElementById('report-status');

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.hidden = false;
  }

  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
  }

  function setReportStatus(type, message) {
    reportStatus.hidden = false;
    reportStatus.className = type ? `report-status is-${type}` : 'report-status';
    if (type === 'success') {
      reportStatus.innerHTML = `${ICON_CHECK}<span>${message}</span>`;
    } else if (type === 'error') {
      reportStatus.innerHTML = `${ICON_ALERT}<span>${message}</span>`;
    } else if (type === 'loading') {
      reportStatus.innerHTML = `<span class="mini-spinner"></span><span>${message}</span>`;
    } else {
      reportStatus.textContent = message;
    }
  }

  function updateSolveButtonState() {
    btnSolve.disabled = !(state.grade && state.base64);
  }

  gradeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      gradeButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.grade = btn.dataset.grade;
      stepIndex1.classList.add('is-done');
      clearError();
      updateSolveButtonState();
    });
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    clearError();

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showError('지원하지 않는 파일 형식이에요. 이미지(JPG, PNG, WEBP) 또는 PDF 파일을 올려주세요.');
      fileInput.value = '';
      return;
    }

    if (file.size > MAX_BYTES) {
      showError('파일 용량이 너무 커요. 8MB 이하의 파일로 다시 시도해주세요.');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // "data:<mime>;base64,<data>"
      const base64 = String(dataUrl).split(',')[1];
      state.file = file;
      state.base64 = base64;
      state.mimeType = file.type;

      dropzoneEmpty.hidden = true;
      dropzonePreview.hidden = false;
      stepIndex2.classList.add('is-done');

      if (file.type === 'application/pdf') {
        previewImage.hidden = true;
        previewImage.removeAttribute('src');
        previewPdf.hidden = false;
        previewFilename.textContent = file.name;
      } else {
        previewPdf.hidden = true;
        previewImage.hidden = false;
        previewImage.src = dataUrl;
      }

      updateSolveButtonState();
    };
    reader.onerror = () => {
      showError('파일을 읽는 중 문제가 발생했어요. 다시 시도해주세요.');
    };
    reader.readAsDataURL(file);
  });

  btnRemoveFile.addEventListener('click', (e) => {
    // 이 버튼은 <label> 내부에 있어서, 클릭 시 파일 선택창이 다시 열리는 것을 막는다.
    e.preventDefault();
    e.stopPropagation();

    state.file = null;
    state.base64 = null;
    state.mimeType = null;
    fileInput.value = '';

    dropzoneEmpty.hidden = false;
    dropzonePreview.hidden = true;
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
    previewPdf.hidden = true;
    stepIndex2.classList.remove('is-done');

    updateSolveButtonState();
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 마크다운 변환기(marked.js)는 "\(" 같은 백슬래시를 이스케이프 문자로 해석해서
  // MathJax 수식 구분 기호(\( \), \[ \])의 백슬래시를 지워버린다.
  // 그래서 마크다운을 돌리기 전에 수식 구간을 통째로 플레이스홀더로 치환해뒀다가,
  // 마크다운 변환이 끝난 뒤 원래 수식 텍스트로 되돌려놓는다.
  function protectMath(text) {
    const store = [];
    const stash = (match) => {
      store.push(match);
      return `@@MATH${store.length - 1}@@`;
    };
    return {
      protectedText: text
        .replace(/\\\[[\s\S]*?\\\]/g, stash) // \[ ... \] (display math)
        .replace(/\\\([\s\S]*?\\\)/g, stash), // \( ... \) (inline math)
      store,
    };
  }

  function restoreMath(html, store) {
    return html.replace(/@@MATH(\d+)@@/g, (_, idx) => {
      const original = store[Number(idx)];
      return original ? escapeHtml(original) : '';
    });
  }

  async function renderResult(text) {
    state.lastSolutionText = text;

    let html;
    try {
      if (window.marked) {
        const { protectedText, store } = protectMath(text);
        html = restoreMath(window.marked.parse(protectedText), store);
      } else {
        html = `<p>${escapeHtml(text)}</p>`;
      }
    } catch (_) {
      html = `<p>${escapeHtml(text)}</p>`;
    }
    resultContent.innerHTML = html;
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.MathJax && window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise([resultContent]);
      } catch (err) {
        console.error('MathJax typeset error:', err);
      }
    }
  }

  function resetReportUI() {
    reportForm.hidden = true;
    reportComment.value = '';
    reportStatus.hidden = true;
    reportStatus.className = 'report-status';
    reportStatus.innerHTML = '';
    btnReportToggle.hidden = false;
    revisedBanner.hidden = true;
  }

  btnSolve.addEventListener('click', async () => {
    if (!state.grade || !state.base64) return;

    clearError();
    resultSection.hidden = true;
    resetReportUI();
    loadingSection.hidden = false;
    btnSolve.disabled = true;
    btnSolveLabel.textContent = '분석 중...';

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: state.grade,
          mimeType: state.mimeType,
          data: state.base64,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (payload && payload.error) || `요청 처리 중 오류가 발생했어요. (status ${res.status})`;
        throw new Error(msg);
      }

      if (!payload || !payload.text) {
        throw new Error('AI로부터 올바른 응답을 받지 못했어요.');
      }

      await renderResult(payload.text);
    } catch (err) {
      console.error(err);
      showError(err.message || '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      loadingSection.hidden = true;
      btnSolve.disabled = false;
      btnSolveLabel.textContent = 'AI에게 풀이 물어보기';
      updateSolveButtonState();
    }
  });

  // --- 오답 신고 & 재풀이 ---

  btnReportToggle.addEventListener('click', () => {
    reportForm.hidden = false;
    btnReportToggle.hidden = true;
    reportComment.focus();
  });

  btnReportCancel.addEventListener('click', () => {
    reportForm.hidden = true;
    btnReportToggle.hidden = false;
    reportStatus.hidden = true;
  });

  btnReportSubmit.addEventListener('click', async () => {
    if (!state.base64 || !state.grade || !state.lastSolutionText) {
      setReportStatus('error', '원본 문제 정보를 찾을 수 없어요. 문제를 다시 업로드한 뒤 시도해주세요.');
      return;
    }

    btnReportSubmit.disabled = true;
    btnReportCancel.disabled = true;
    setReportStatus('loading', 'AI가 신고 내용을 참고해서 다시 확인하고 있어요...');

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: state.grade,
          mimeType: state.mimeType,
          data: state.base64,
          originalSolution: state.lastSolutionText,
          comment: reportComment.value.trim(),
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (payload && payload.error) || `요청 처리 중 오류가 발생했어요. (status ${res.status})`;
        throw new Error(msg);
      }

      if (!payload || !payload.text) {
        throw new Error('AI로부터 올바른 응답을 받지 못했어요.');
      }

      await renderResult(payload.text);
      revisedBanner.hidden = false;

      reportForm.hidden = true;
      reportComment.value = '';
      btnReportToggle.hidden = false; // 다시 이상하면 재신고할 수 있도록 버튼을 되살려둔다
      setReportStatus('success', '신고 내용을 반영해서 다시 확인했어요. 위 풀이를 확인해주세요.');
    } catch (err) {
      console.error(err);
      setReportStatus('error', err.message || '재검토 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      btnReportSubmit.disabled = false;
      btnReportCancel.disabled = false;
    }
  });

  btnReset.addEventListener('click', () => {
    resultSection.hidden = true;
    resultContent.innerHTML = '';
    state.lastSolutionText = null;
    resetReportUI();
    btnRemoveFile.click();
    gradeButtons.forEach((b) => b.classList.remove('selected'));
    stepIndex1.classList.remove('is-done');
    state.grade = null;
    updateSolveButtonState();
    clearError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
