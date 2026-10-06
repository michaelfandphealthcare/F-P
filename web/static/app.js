const message = document.getElementById('message');
const counter = document.getElementById('counter');
const analyseBtn = document.getElementById('analyseBtn');
const exampleBtn = document.getElementById('exampleBtn');
const errorBox = document.getElementById('error');
const resultPanel = document.getElementById('resultPanel');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const imageLightbox = document.getElementById('imageLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightbox = document.getElementById('closeLightbox');
const annotationChecks = document.querySelectorAll('.annotation-check');
const ocrBtn = document.getElementById('ocrBtn');
const useOcrBtn = document.getElementById('useOcrBtn');
const visualResult = document.getElementById('visualResult');
const urlInput = document.getElementById('urlInput');
const inspectUrlBtn = document.getElementById('inspectUrlBtn');
const inspectOnlineBtn = document.getElementById('inspectOnlineBtn');
const urlResult = document.getElementById('urlResult');
const visualExampleBtn = document.getElementById('visualExampleBtn');
const recordingExampleBtn = document.getElementById('recordingExampleBtn');
const removeImageBtn = document.getElementById('removeImageBtn');
let selectedImageData = null;
let selectedEvidenceKind = null;
let selectedVideoUrl = null;
let extractedText = '';
let selectedExampleText = '';
let analysisRequestId = 0;
let visualAnalysisRequestId = 0;
let scannerController = null;
let visualController = null;
let linkController = null;
let linkRequestId = 0;
let lightboxReturnFocus = null;
let lastRecordingExample = '';
const recordingDemoStems = new Set([
  'sms-bank-scam', 'sms-university-scam', 'sms-ticket-scam', 'sms-nhs-scam',
  'email-invoice-scam', 'login-cloud-scam', 'sms-bank-safe', 'sms-university-safe',
  'sms-ticket-safe', 'sms-nhs-safe', 'email-invoice-safe', 'login-cloud-safe',
]);

function setEvidenceState(state, messageText) {
  const status = document.getElementById('ocrStatus');
  const profile = document.getElementById('profileStatus');
  document.querySelector('.evidence-view')?.setAttribute('data-evidence-state', state);
  if (status) {
    status.dataset.state = state;
    status.textContent = messageText || '';
  }
  if (profile) {
    const labels = {idle:'Waiting', ready:'Ready', extracting:'Extracting', analysing:'Analysing', complete:'Complete', error:'Needs attention'};
    profile.textContent = labels[state] || state;
  }
}

async function analyseTextRequest(text, controller, timeoutMs = 12000) {
  const timeout = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const response = await fetch('/api/analyse', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({text}),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('The service returned an unexpected response. Please try again.'); }
    if (!response.ok) throw new Error(data.error || 'Unable to analyse this evidence.');
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      if (controller.signal.reason === 'timeout') throw new Error('The analysis timed out. Check your connection and try again.');
      throw new DOMException('The previous analysis was cancelled.', 'AbortError');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderEvidenceFindings(data, compact = false) {
  const evidence = Array.isArray(data.evidence) ? data.evidence : [];
  if (!evidence.length) return compact ? '<li><span>✓</span><div>No contextual warning signal was returned.</div></li>' : '';
  return evidence.map(item => {
    const phrase = String(item.phrase || '');
    const explanation = String(item.explanation || 'Observable evidence from the submitted text.');
    if (phrase.startsWith('No specific')) {
      return compact
        ? `<li><span>✓</span><div>${escapeHtml(explanation)}</div></li>`
        : `<div class="reason"><i>✓</i><span>${escapeHtml(explanation)}<small class="no-evidence">No warning excerpt was identified.</small></span></div>`;
    }
    return compact
      ? `<li><span>✓</span><div><q>${escapeHtml(phrase)}</q><small>${escapeHtml(explanation)}</small></div></li>`
      : `<div class="reason"><i>✓</i><span><q>${escapeHtml(phrase)}</q> — ${escapeHtml(explanation)}<button type="button" class="reason-evidence" data-evidence-phrase="${escapeHtml(phrase)}" title="Highlight this exact excerpt in the submitted message">View supporting text</button></span></div>`;
  }).join('');
}

function trustedGuidance(data) {
  const signals = new Set(data.signals || []);
  const links = [
    ['NCSC: recognise and report phishing', 'https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email'],
  ];
  if ([...signals].some(signal => ['payment', 'family_impersonation', 'credentials', 'authentication_code', 'login_approval', 'impersonation'].includes(signal))) {
    links.push(['FCA: banking and account scams', 'https://www.fca.org.uk/consumers/banking-online-account-scams']);
  }
  if (data.label !== 'Few warning signs detected') links.push(['Report Fraud', 'https://www.reportfraud.police.uk/']);
  return `<div class="trusted-guidance result-section"><h3>Independent online guidance</h3><p>These are official public resources, not evidence that the submitted sender is genuine.</p><div>${links.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`).join('')}</div></div>`;
}

function openLightbox() {
  const image = imagePreview?.querySelector('img');
  if (!image || !imageLightbox || !lightboxImage) return;
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt || 'Full-size evidence preview';
  imageLightbox.classList.remove('hidden');
  document.body.classList.add('lightbox-open');
  lightboxReturnFocus = document.activeElement;
  closeLightbox?.focus();
}
function closeImageLightbox() {
  if (imageLightbox?.classList.contains('hidden')) return;
  imageLightbox.classList.add('hidden');
  document.body.classList.remove('lightbox-open');
  lightboxReturnFocus?.focus?.();
}
imagePreview?.addEventListener('click', openLightbox);
imagePreview?.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && imagePreview.querySelector('img')) {
    event.preventDefault();
    openLightbox();
  }
});
closeLightbox?.addEventListener('click', closeImageLightbox);
imageLightbox?.addEventListener('click', event => { if (event.target === imageLightbox) closeImageLightbox(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeImageLightbox(); });
let demoExamples = [];

fetch('/data/demo_examples.json').then(response => response.ok ? response.json() : []).then(items => { demoExamples = items; }).catch(() => {});

let dashboardLoaded = false;
const homeData = [['Bank impersonation',34],['Delivery / tax',28],['Student account',19],['Sports / ticketing',17]];
renderBars('homeChart', homeData);

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
  document.body.dataset.activeView = view;
  document.querySelectorAll('.scanner-view').forEach(x => x.classList.toggle('hidden', view !== 'scanner'));
  document.querySelector('.dashboard-view').classList.toggle('hidden', view !== 'dashboard');
  document.querySelector('.evidence-view').classList.toggle('hidden', view !== 'evidence');
  const dashboard = view === 'dashboard';
  if (dashboard) loadDashboard();
}));

document.querySelectorAll('[data-scroll="workspace"]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('message')?.focus({ preventScroll: true });
}));

document.querySelectorAll('[data-open-evidence]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(item => item.classList.toggle('active', item.dataset.view === 'evidence'));
  document.body.dataset.activeView = 'evidence';
  document.querySelectorAll('.scanner-view').forEach(item => item.classList.add('hidden'));
  document.querySelector('.dashboard-view')?.classList.add('hidden');
  document.querySelector('.evidence-view')?.classList.remove('hidden');
  document.querySelector('.upload-card')?.scrollIntoView({behavior:'smooth', block:'start'});
  window.setTimeout(() => imageInput?.focus({preventScroll:true}), 450);
}));

document.querySelectorAll('[data-open-dashboard]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(item => item.classList.toggle('active', item.dataset.view === 'dashboard'));
  document.body.dataset.activeView = 'dashboard';
  document.querySelectorAll('.scanner-view').forEach(item => item.classList.add('hidden'));
  document.querySelector('.evidence-view')?.classList.add('hidden');
  document.querySelector('.dashboard-view')?.classList.remove('hidden');
  loadDashboard();
  document.querySelector('.dashboard-research-hero')?.scrollIntoView({behavior:'smooth', block:'start'});
}));

async function loadDashboard() {
  if (dashboardLoaded) return;
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Dashboard data is unavailable.');
    const data = await response.json();
    renderEvaluation(data.evaluation);
    const baselineNote = document.querySelector('.methodology-disclosure .disclosure-grid > div:first-child p:nth-of-type(2)');
    if (baselineNote) baselineNote.textContent = 'The TF-IDF-only baseline is measured on the same 12-message held-out split. It is a simple comparison point, not a production benchmark.';
    renderMeasuredCharts(data.evaluation);
    renderChallengeEvaluation(data.challenge_evaluation);
    renderBars('sectorChart', data.scenarios.sector_mix);
    renderBars('signalChart', data.scenarios.warning_signals);
    renderBars('officialTrendChart', data.scenarios.official_trend, true);
    renderBars('contactChart', data.scenarios.contact_method);
    dashboardLoaded = true;
  } catch (err) {
    document.getElementById('sectorChart').innerHTML = `<p class="chart-error">${escapeHtml(err.message)}</p>`;
    document.getElementById('signalChart').innerHTML = `<p class="chart-error">Try refreshing the prototype.</p>`;
  }
}

function renderChallengeEvaluation(evaluation) {
  const root = document.getElementById('challengePanel');
  if (!root || !evaluation) return;
  const metrics = evaluation.metrics || {};
  const matrix = metrics.confusion_matrix || {};
  const failures = evaluation.failure_examples || [];
  const resolved = evaluation.resolved_regressions || [];
  const dataset = evaluation.dataset || {};
  const rows = [['Precision', metrics.precision || 0], ['Recall', metrics.recall || 0], ['F1', metrics.f1 || 0]];
  const failureCopy = failures.length ? failures.map(item => `<p><b>${escapeHtml(item.scenario)}</b> — expected ${escapeHtml(item.expected)}, received ${escapeHtml(item.actual)} at score ${escapeHtml(item.score_0_100)}/100.</p>`).join('') : '<p>No errors were observed in this run. This small authored set is not proof of general reliability.</p>';
  root.innerHTML = `<div class="challenge-copy"><span class="chart-kicker">Development regression set</span><h2>Broader challenge checks</h2><p>${escapeHtml(dataset.test_rows || 0)} author-created messages · ${escapeHtml(dataset.class_distribution?.phishing || 0)} scam · ${escapeHtml(dataset.class_distribution?.legitimate || 0)} legitimate</p><small>${escapeHtml(evaluation.dataset_role || 'This development set is not an independent final test set.')}</small></div><div class="challenge-bar-chart" role="img" aria-label="Challenge set performance: precision ${Math.round((metrics.precision || 0) * 100)} percent, recall ${Math.round((metrics.recall || 0) * 100)} percent, F1 ${Math.round((metrics.f1 || 0) * 100)} percent"><div class="percentage-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>${rows.map(([label, value]) => `<div class="percentage-bar-row"><b>${label}</b><div class="percentage-track"><span class="percentage-fill" style="width:${Math.round(value * 100)}%"></span></div><strong>${Math.round(value * 100)}%</strong></div>`).join('')}</div><div class="challenge-error-summary"><span><b>${matrix.false_positive || 0}</b><small>false alarms</small></span><span><b>${matrix.false_negative || 0}</b><small>missed scams</small></span></div><div class="challenge-failures"><strong>Current error analysis</strong>${failureCopy}${resolved.length ? `<strong>Resolved regression cases</strong>${resolved.map(item => `<p><b>${escapeHtml(item.case)}</b> — ${escapeHtml(item.previous)} Current: ${escapeHtml(item.current)}</p>`).join('')}` : ''}</div><details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Development challenge-set performance</caption><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><td>${Math.round(value * 100)}%</td></tr>`).join('')}<tr><th>False alarms</th><td>${matrix.false_positive || 0}</td></tr><tr><th>Missed scams</th><td>${matrix.false_negative || 0}</td></tr></tbody></table></details>`;
}

function resetUploadedEvidence() {
  visualController?.abort('evidence changed');
  visualAnalysisRequestId += 1;
  if (selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl);
  selectedVideoUrl = null;
  selectedEvidenceKind = null;
  selectedExampleText = '';
  selectedImageData = null;
  extractedText = '';
  visualResult?.classList.add('hidden');
  document.getElementById('ocrText').value = '';
  useOcrBtn?.classList.add('hidden');
  annotationChecks.forEach(check => { check.checked = false; });
  document.getElementById('annotationResult').textContent = 'Select visible features to generate an explainable visual-risk summary.';
}

function setImagePreviewAccessibility(enabled) {
  if (enabled) {
    imagePreview.tabIndex = 0;
    imagePreview.setAttribute('role', 'button');
    imagePreview.setAttribute('aria-label', 'Open uploaded evidence image at full size');
  } else {
    imagePreview.removeAttribute('tabindex');
    imagePreview.removeAttribute('role');
    imagePreview.removeAttribute('aria-label');
  }
}

function formatDuration(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const target = Math.min(Math.max(time, 0), Math.max(0, video.duration - 0.05));
    if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.02) { resolve(); return; }
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('A recording frame could not be read.')); }, 5000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('The recording could not be decoded.')); };
    video.addEventListener('seeked', onSeeked, {once:true});
    video.addEventListener('error', onError, {once:true});
    video.currentTime = target;
  });
}

function mergeFrameText(frameTexts) {
  const unique = [];
  const seen = new Set();
  frameTexts.forEach(text => text.split(/\n+/).forEach(rawLine => {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const key = line.toLocaleLowerCase().replace(/[^a-z0-9£$@:/.'!? -]/g, '').trim();
    if (key.length < 2 || seen.has(key)) return;
    seen.add(key);
    unique.push(line);
  }));
  return unique.join('\n');
}

async function extractRecordingText() {
  const video = imagePreview?.querySelector('video');
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) throw new Error('The recording duration could not be read. Try MP4 or WebM.');
  const frameCount = Math.min(7, Math.max(4, Math.ceil(video.duration / 8)));
  const timestamps = Array.from({length:frameCount}, (_, index) => Math.min(video.duration - 0.05, Math.max(0.05, video.duration * (index / Math.max(1, frameCount - 1)))));
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, 1));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d', {alpha:false});
  if (!context) throw new Error('This browser could not prepare recording frames for text extraction.');
  const originalTime = video.currentTime;
  const frameTexts = [];
  let worker = null;
  try {
    video.pause();
    worker = await Tesseract.createWorker('eng');
    for (let index = 0; index < timestamps.length; index += 1) {
      setEvidenceState('extracting', `Reading recording frame ${index + 1} of ${timestamps.length} locally…`);
      await seekVideo(video, timestamps[index]);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const result = await worker.recognize(canvas);
      const text = (result.data.text || '').trim();
      if ((text.match(/[A-Za-z]/g) || []).length >= 8) frameTexts.push(text);
    }
  } finally {
    await worker?.terminate?.();
    try { await seekVideo(video, originalTime); } catch { video.currentTime = 0; }
  }
  return {text:mergeFrameText(frameTexts), sampled:timestamps.length};
}

if (imageInput) imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  resetUploadedEvidence();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
  const isVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || ['mp4', 'webm', 'mov'].includes(extension);
  if (!isImage && !isVideo) {
    document.getElementById('imageMeta').textContent = 'Unsupported file type. Choose a PNG, JPG, WebP, MP4, WebM or MOV file.';
    imageInput.value = '';
    setEvidenceState('error', 'Unsupported file type. Choose a supported screenshot or screen recording.');
    return;
  }
  const sizeLimit = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > sizeLimit) {
    document.getElementById('imageMeta').textContent = `${isVideo ? 'Recording' : 'Image'} is larger than the ${isVideo ? '50' : '8'} MB limit.`;
    imageInput.value = '';
    setEvidenceState('error', `The file is larger than the ${isVideo ? '50' : '8'} MB limit. Choose a shorter or smaller redacted capture.`);
    return;
  }
  setEvidenceState('extracting', `Checking the selected ${isVideo ? 'recording' : 'screenshot'}…`);
  if (isVideo) {
    selectedEvidenceKind = 'video';
    selectedVideoUrl = URL.createObjectURL(file);
    selectedImageData = selectedVideoUrl;
    imagePreview.innerHTML = `<video src="${selectedVideoUrl}" controls playsinline preload="metadata" aria-label="Uploaded redacted chat screen recording"></video>`;
    setImagePreviewAccessibility(false);
    removeImageBtn?.classList.remove('hidden');
    const video = imagePreview.querySelector('video');
    video.addEventListener('loadedmetadata', () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60) {
        document.getElementById('imageMeta').textContent = video.duration > 60 ? 'Recording is longer than 60 seconds. Trim it and try again.' : 'Recording duration could not be read.';
        setEvidenceState('error', video.duration > 60 ? 'Trim the recording to 60 seconds or less before analysis.' : 'This recording could not be decoded. Try MP4 or WebM.');
        ocrBtn.disabled = true;
        return;
      }
      document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${video.videoWidth} × ${video.videoHeight}px · ${formatDuration(video.duration)} · ${(file.size / (1024 * 1024)).toFixed(1)} MB</span>`;
      document.getElementById('previewHint').textContent = 'Play the recording to check it. Text extraction samples several frames locally and combines repeated chat text.';
      document.getElementById('visualFlags').innerHTML = '<span class="flag neutral">Recording preview ready</span><span class="flag neutral">Local frame OCR ready</span><span class="flag neutral">Editable transcript</span>';
      ocrBtn.textContent = 'Extract chat text from recording';
      ocrBtn.disabled = false;
      removeImageBtn?.classList.remove('hidden');
      setEvidenceState('ready', 'Recording ready. Play it to review, then extract visible chat text from sampled frames.');
    }, {once:true});
    video.addEventListener('error', () => {
      ocrBtn.disabled = true;
      setEvidenceState('error', 'This recording could not be played. Try an MP4 (H.264) or WebM file.');
    }, {once:true});
    return;
  }
  selectedEvidenceKind = 'image';
  const reader = new FileReader();
  reader.onload = event => {
    selectedImageData = event.target.result;
    const img = new Image();
    img.onload = () => {
      const ratio = (img.width / img.height).toFixed(2);
      document.getElementById('imagePreview').innerHTML = `<img src="${event.target.result}" alt="Uploaded redacted fraud evidence preview">`;
      setImagePreviewAccessibility(true);
      document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${img.width} × ${img.height}px · ${(file.size / 1024).toFixed(0)} KB · aspect ratio ${ratio}</span>`;
      setEvidenceState('ready', 'Image ready. Select Extract visible text to run browser-local OCR.');
      ocrBtn.disabled = false;
      ocrBtn.textContent = 'Extract visible chat text';
      removeImageBtn?.classList.remove('hidden');
      document.getElementById('previewHint').textContent = 'Select the image or press Enter to inspect it full size.';
      document.getElementById('visualFlags').innerHTML = '<span class="flag neutral">Image preview ready</span><span class="flag neutral">OCR ready</span><span class="flag neutral">Manual annotation available</span>';
    };
    img.onerror = () => {
      selectedImageData = null;
      imageInput.value = '';
      ocrBtn.disabled = true;
      setEvidenceState('error', 'This image could not be opened. It may be corrupt; choose another PNG, JPG or WebP file.');
    };
    img.src = event.target.result;
  };
  reader.onerror = () => setEvidenceState('error', 'The image could not be read from this device. Choose it again or try another file.');
  reader.readAsDataURL(file);
});

if (ocrBtn) ocrBtn.addEventListener('click', async () => {
  if (!selectedImageData) {
    setEvidenceState('error', 'Choose a screenshot or screen recording before extracting visible text.');
    return;
  }
  if (selectedExampleText) {
    extractedText = selectedExampleText;
    document.getElementById('ocrText').value = extractedText;
    setEvidenceState('ready', 'Pre-supplied demonstration text is ready. It is not a fresh OCR result; review it before analysis.');
    document.getElementById('visualFlags').innerHTML = '<span class="flag positive">Readable text found</span><span class="flag neutral">Synthetic example</span><span class="flag neutral">Review warning signs below</span>';
    useOcrBtn.classList.remove('hidden');
    return;
  }
  if (!window.Tesseract) {
    setEvidenceState('error', 'Browser-local OCR is unavailable. You can type the visible text manually; the image was not sent to the server.');
    return;
  }
  ocrBtn.disabled = true;
  setEvidenceState('extracting', selectedEvidenceKind === 'video' ? 'Preparing recording frames locally…' : 'Reading visible text locally…');
  try {
    if (selectedEvidenceKind === 'video') {
      const recording = await extractRecordingText();
      if (recording.text.length < 12) {
        extractedText = '';
        document.getElementById('ocrText').value = '';
        useOcrBtn.classList.add('hidden');
        document.getElementById('visualFlags').innerHTML = `<span class="flag warning">No readable chat text</span><span class="flag neutral">${recording.sampled} frames reviewed locally</span>`;
        setEvidenceState('error', 'No usable chat text was found in the sampled frames. Try a clearer recording, pause longer on each message, or enter the visible text manually.');
        return;
      }
      const reviewedText = recording.text.slice(0, 4000);
      const wasTrimmed = recording.text.length > reviewedText.length;
      extractedText = reviewedText;
      document.getElementById('ocrText').value = reviewedText;
      document.getElementById('visualFlags').innerHTML = `<span class="flag positive">Chat text extracted</span><span class="flag neutral">${recording.sampled} frames reviewed locally</span><span class="flag neutral">Duplicates combined</span>`;
      setEvidenceState('ready', `Recording extraction complete. ${recording.sampled} frames were sampled locally${wasTrimmed ? '; the combined text was limited to 4,000 characters' : ''}. Review and correct it before analysis.`);
      useOcrBtn.classList.remove('hidden');
      return;
    }
    const result = await Tesseract.recognize(selectedImageData, 'eng', { logger: message => {
      if (message.status === 'recognizing text') setEvidenceState('extracting', `Reading visible text locally… ${Math.round(message.progress * 100)}%`);
    }});
    const text = result.data.text.trim().replace(/\n{3,}/g, '\n\n');
    const words = text.split(/\s+/).filter(word => /[A-Za-z]{2,}/.test(word));
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    const confidence = Number(result.data.confidence || 0);
    const useful = text.length >= 18 && words.length >= 3 && letters >= 14 && confidence >= 45;
    if (useful) {
      extractedText = text;
      document.getElementById('ocrText').value = text;
      setEvidenceState('ready', `OCR complete (${Math.round(confidence)}% confidence). Review and edit the text before analysis.`);
      document.getElementById('visualFlags').innerHTML = '<span class="flag positive">Readable text found</span><span class="flag neutral">Review warning signs below</span>';
      useOcrBtn.classList.remove('hidden');
    } else {
      extractedText = '';
      document.getElementById('ocrText').value = '';
      setEvidenceState('error', 'No usable text was found. Try a clearer email, SMS or login-page screenshot, or enter visible text manually.');
      document.getElementById('visualFlags').innerHTML = '<span class="flag warning">No readable scam text</span><span class="flag neutral">Use a message screenshot</span>';
      useOcrBtn.classList.add('hidden');
    }
  } catch (err) {
    setEvidenceState('error', selectedEvidenceKind === 'video' ? 'OCR could not process this recording. Try a clearer or shorter capture, or enter the visible chat text manually.' : 'OCR could not process this image. Try a clearer screenshot or enter the visible text manually.');
  } finally { ocrBtn.disabled = false; }
});

if (useOcrBtn) useOcrBtn.addEventListener('click', async () => {
  extractedText = document.getElementById('ocrText').value.trim();
  if (!extractedText) { setEvidenceState('error', 'There is no text to analyse. Extract, review or enter visible message text first.'); return; }
  const requestId = ++visualAnalysisRequestId;
  visualController?.abort('new analysis');
  visualController = new AbortController();
  useOcrBtn.disabled = true;
  useOcrBtn.textContent = 'Analysing chat evidence...';
  visualResult.classList.add('hidden');
  setEvidenceState('analysing', 'Analysing the current edited text. The previous result has been cleared.');
  try {
    const data = await analyseTextRequest(extractedText, visualController);
    if (requestId !== visualAnalysisRequestId || extractedText !== document.getElementById('ocrText').value.trim()) return;
    const reasons = renderEvidenceFindings(data, true);
    const findingHeading = data.label === 'Few warning signs detected' ? 'What the analysis found' : 'Signals requiring attention';
    visualResult.innerHTML = `<div class="visual-result-head"><div><span class="eyebrow">Uploaded chat evidence result</span><h3>${escapeHtml(data.label)}</h3><span class="band">${escapeHtml(data.band)}</span></div></div><h4>${findingHeading}</h4><ul>${reasons}</ul><h4>Safer next step</h4><p class="visual-action">${escapeHtml(data.action)}</p>${trustedGuidance(data)}<small class="visual-boundary">${escapeHtml(data.score_meaning || 'This result is based on the current visible text and is not proof of fraud.')}</small>`;
    visualResult.classList.remove('hidden');
    setEvidenceState('complete', 'Analysis complete. The result below matches the current edited text.');
  } catch (err) {
    if (err.name === 'AbortError') return;
    visualResult.classList.add('hidden');
    setEvidenceState('error', `${err.message} No result is being shown. Select Analyse extracted conversation to retry.`);
  }
  finally {
    if (requestId === visualAnalysisRequestId) {
      useOcrBtn.disabled = false;
      useOcrBtn.innerHTML = 'Analyse extracted conversation <span aria-hidden="true">→</span>';
    }
  }
});

document.getElementById('ocrText')?.addEventListener('input', () => {
  visualController?.abort('evidence edited');
  visualAnalysisRequestId += 1;
  visualResult?.classList.add('hidden');
  const hasText = document.getElementById('ocrText').value.trim().length > 0;
  useOcrBtn?.classList.toggle('hidden', !hasText);
  setEvidenceState(hasText ? 'ready' : 'error', hasText ? 'Edited text is ready but has not been analysed yet.' : 'Enter or extract visible text before analysis.');
});

annotationChecks.forEach(check => check.addEventListener('change', () => {
  const selected = [...annotationChecks].filter(x => x.checked);
  const score = selected.reduce((total, x) => total + Number(x.dataset.weight), 0);
  const result = document.getElementById('annotationResult');
  const level = score >= 8 ? 'High visual-risk signal' : score >= 4 ? 'Needs human review' : 'Low visual-risk signal';
  const names = selected.map(x => x.parentElement.textContent.trim());
  result.innerHTML = `<strong>${level}</strong><span>${selected.length ? `Recorded signals: ${escapeHtml(names.join(', '))}.` : 'No visible warning features have been selected.'}</span><small>This is a transparent annotation, not proof of fraud. Compare these human labels with the model output during evaluation.</small>`;
}));

function renderEvidence(items) {
  const root = document.getElementById('evidenceGrid');
  root.innerHTML = items.map(item => {
    const source = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.source)}</a>` : escapeHtml(item.source);
    return `<div class="evidence-card"><span class="evidence-number">${escapeHtml(item.value)}</span><strong>${escapeHtml(item.label)}</strong><small>${source}</small></div>`;
  }).join('');
}

function renderEvaluation(evaluation) {
  const root = document.getElementById('evaluationPanel');
  if (!root || !evaluation) return;
  const metrics = evaluation.metrics || {};
  const dataset = evaluation.dataset || {};
  const classes = dataset.class_distribution || {};
  const errors = (metrics.false_positives || 0) + (metrics.missed_scams || 0);
  root.innerHTML = `<div class="evaluation-summary-stats"><span><b>${escapeHtml(dataset.test_rows || 0)}</b><small>evaluated</small></span><span><b>${escapeHtml(classes.phishing || 0)}</b><small>scams</small></span><span><b>${escapeHtml(classes.legitimate || 0)}</b><small>legitimate</small></span><span><b>${errors}</b><small>errors in this split</small></span><span><b>${Math.round((evaluation.decision_threshold || .36) * 100)}/100</b><small>decision threshold</small></span></div>`;
  const dateNode = document.getElementById('dashboardEvaluationDate');
  const modelNode = document.getElementById('dashboardModelVersion');
  const datasetNode = document.getElementById('dashboardDatasetVersion');
  if (dateNode) {
    const parsed = new Date(`${evaluation.evaluation_date}T00:00:00Z`);
    dateNode.textContent = Number.isNaN(parsed.getTime()) ? evaluation.evaluation_date : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(parsed);
  }
  if (modelNode) modelNode.textContent = evaluation.model_version || 'Not recorded';
  if (datasetNode) datasetNode.textContent = dataset.version || 'Not recorded';
}

function renderMeasuredCharts(evaluation) {
  const metrics = evaluation?.metrics || {};
  const matrix = metrics.confusion_matrix || {};
  const outcomeRows = [
    ['Correct legitimate', matrix.true_negative || 0, 'correct-clear'],
    ['Detected scams', matrix.true_positive || 0, 'detected'],
    ['False alarms', matrix.false_positive || 0, 'false-alarm'],
    ['Missed scams', matrix.false_negative || 0, 'missed'],
  ];
  const confusionChart = document.getElementById('confusionChart');
  if (confusionChart) {
    const max = Math.max(1, ...outcomeRows.map(item => item[1]));
    const ticks = [0, Math.ceil(max * .25), Math.ceil(max * .5), Math.ceil(max * .75), max];
    confusionChart.setAttribute('role', 'img');
    confusionChart.setAttribute('aria-label', outcomeRows.map(([label, value]) => `${label}: ${value}`).join('; '));
    confusionChart.innerHTML = `<div class="count-axis"><span></span><div>${ticks.map(tick => `<i>${tick}</i>`).join('')}</div><span></span></div>${outcomeRows.map(([label, value, tone]) => `<div class="count-bar-row"><b>${label}</b><div class="count-track"><span class="count-fill ${tone}${value === 0 ? ' zero' : ''}" style="width:${Math.round((value / max) * 100)}%"></span></div><strong>${value}</strong></div>`).join('')}<div class="chart-axis-title">Number of messages</div>`;
  }
  const confusionTable = document.getElementById('confusionTable');
  if (confusionTable) confusionTable.innerHTML = `<details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Decision outcome counts</caption><thead><tr><th>Outcome</th><th>Messages</th></tr></thead><tbody>${outcomeRows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')}</tbody></table></details>`;
  const metricChart = document.getElementById('metricChart');
  const metricRows = [['Precision', metrics.precision || 0, 'precision'], ['Recall', metrics.recall || 0, 'recall'], ['F1', metrics.f1 || 0, 'f1']];
  if (metricChart) {
    metricChart.setAttribute('role', 'img');
    metricChart.setAttribute('aria-label', metricRows.map(([label, value]) => `${label}: ${Math.round(value * 100)} percent`).join('; '));
    metricChart.innerHTML = `<div class="percentage-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>${metricRows.map(([label, value, key]) => `<div class="percentage-bar-row"><b>${label}</b><div class="percentage-track"><span class="percentage-fill ${key}" style="width:${Math.round(value * 100)}%"></span></div><strong>${Math.round(value * 100)}%</strong></div>`).join('')}<div class="chart-axis-title">Percentage (%)</div>`;
  }
  const metricTable = document.getElementById('metricTable');
  if (metricTable) metricTable.innerHTML = `<details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Measured performance percentages</caption><thead><tr><th>Metric</th><th>Value</th><th>Meaning</th></tr></thead><tbody><tr><th>Precision</th><td>${Math.round((metrics.precision || 0) * 100)}%</td><td>Share of flagged messages that were scams</td></tr><tr><th>Recall</th><td>${Math.round((metrics.recall || 0) * 100)}%</td><td>Share of scams that were detected</td></tr><tr><th>F1</th><td>${Math.round((metrics.f1 || 0) * 100)}%</td><td>Combined precision and recall</td></tr></tbody></table></details>`;

  const baselineChart = document.getElementById('baselineChart');
  const baselineTable = document.getElementById('baselineTable');
  if (baselineChart) {
    if (evaluation.baseline_metrics) {
      const baseline = evaluation.baseline_metrics;
      const rows = [['Precision', metrics.precision || 0, baseline.precision || 0], ['Recall', metrics.recall || 0, baseline.recall || 0], ['F1', metrics.f1 || 0, baseline.f1 || 0]];
      baselineChart.setAttribute('role', 'img');
      baselineChart.setAttribute('aria-label', rows.map(([label, value, base]) => `${label}: ScamShield ${Math.round(value * 100)} percent, TF-IDF baseline ${Math.round(base * 100)} percent`).join('; '));
      baselineChart.innerHTML = `<div class="comparison-legend"><span><i class="legend-swatch model"></i>ScamShield</span><span><i class="legend-swatch baseline"></i>TF-IDF baseline</span></div><div class="comparison-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>${rows.map(([label, value, base]) => `<div class="comparison-metric-block"><b>${label}</b><div class="comparison-series-row"><small>ScamShield</small><div class="comparison-track"><span class="comparison-fill model" style="width:${Math.round(value * 100)}%"></span></div><strong>${Math.round(value * 100)}%</strong></div><div class="comparison-series-row"><small>Baseline</small><div class="comparison-track"><span class="comparison-fill baseline" style="width:${Math.round(base * 100)}%"></span></div><strong>${Math.round(base * 100)}%</strong></div></div>`).join('')}<p class="baseline-method">${escapeHtml(baseline.method || evaluation.baseline_status || '')}</p>`;
      if (baselineTable) baselineTable.innerHTML = `<details class="chart-data-table"><summary>View accessible data table</summary><table><caption>ScamShield and TF-IDF baseline comparison</caption><thead><tr><th>Metric</th><th>ScamShield</th><th>TF-IDF baseline</th></tr></thead><tbody>${rows.map(([label, value, base]) => `<tr><th>${label}</th><td>${Math.round(value * 100)}%</td><td>${Math.round(base * 100)}%</td></tr>`).join('')}</tbody></table></details>`;
    } else {
      baselineChart.className = 'pending-state';
      baselineChart.innerHTML = `<div class="pending-icon" aria-hidden="true">—</div><strong>Baseline comparison pending</strong><p>${escapeHtml(evaluation.baseline_status || 'No independently measured baseline is available for this split.')}</p>`;
      if (baselineTable) baselineTable.innerHTML = '';
    }
  }

  const scenarioChart = document.getElementById('scenarioChart');
  const scenarioTable = document.getElementById('scenarioTable');
  if (scenarioChart) {
    const records = evaluation.records || [];
    if (!records.length) {
      scenarioChart.className = 'pending-state';
      scenarioChart.innerHTML = `<div class="pending-icon" aria-hidden="true">—</div><strong>Scenario comparison pending</strong><p>${escapeHtml(evaluation.scenario_performance_status || 'No scenario-level records are available.')}</p>`;
      if (scenarioTable) scenarioTable.innerHTML = '';
    } else {
      scenarioChart.setAttribute('role', 'img');
      const threshold = Math.round((evaluation.decision_threshold || .36) * 100);
      scenarioChart.setAttribute('aria-label', records.map(record => `${record.scenario}: score ${record.score_0_100 ?? Math.round((record.risk_score || 0) * 100)} out of 100, ${record.label === 'phishing' ? 'scam example' : 'legitimate example'}`).join('; '));
      scenarioChart.className = 'scenario-score-chart';
      scenarioChart.innerHTML = `<div class="scenario-score-legend"><span><i class="legend-swatch legitimate"></i>Legitimate example</span><span><i class="legend-swatch scam"></i>Scam example</span><span><i class="legend-threshold"></i>Decision threshold (${threshold}/100)</span></div><div class="scenario-score-axis"><span></span><span></span><div><i>0</i><i class="threshold-tick">${threshold}</i><i>50</i><i>75</i><i>100</i></div><span></span></div>${records.map(record => {
        const score = record.score_0_100 ?? Math.round((record.risk_score || 0) * 100);
        const actualScam = record.label === 'phishing';
        const predictedScam = record.prediction === 1;
        const correct = actualScam === predictedScam;
        const tone = correct ? (actualScam ? 'scam' : 'legitimate') : (actualScam ? 'missed' : 'false-alarm');
        return `<div class="scenario-score-row"><b>${escapeHtml(record.scenario)}</b><small>${actualScam ? 'Scam example' : 'Legitimate example'}</small><div class="scenario-score-track"><span class="scenario-score-fill ${tone}" style="width:${score}%"></span><i class="scenario-threshold" style="left:${threshold}%" aria-hidden="true"></i></div><strong>${score}/100</strong></div>`;
      }).join('')}<div class="chart-axis-title">Screening score (0–100) · not a calibrated probability</div>`;
      if (scenarioTable) scenarioTable.innerHTML = `<details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Case-level screening scores</caption><thead><tr><th>Scenario</th><th>Actual class</th><th>Prediction</th><th>Score (0–100)</th></tr></thead><tbody>${records.map(record => `<tr><th>${escapeHtml(record.scenario)}</th><td>${record.label === 'phishing' ? 'Scam' : 'Legitimate'}</td><td>${record.prediction === 1 ? 'Scam' : 'Legitimate'}</td><td>${record.score_0_100 ?? Math.round((record.risk_score || 0) * 100)}</td></tr>`).join('')}</tbody></table></details>`;
    }
  }
}

function renderBars(id, values, compact = false) {
  const root = document.getElementById(id);
  if (!root || root.dataset.ready) return;
  const max = Math.max(...values.map(x => x[1]));
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Chart data: ' + values.map(([label, value]) => `${label}, ${value}`).join('; '));
  const bars = values.map(([label, value]) => {
    const display = compact && value >= 1000000 ? `${(value / 1000000).toFixed(1)}m` : compact && value >= 1000 ? `${Math.round(value / 1000)}k` : value;
    return `<div class="bar-row"><span class="bar-label">${escapeHtml(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(value/max*100)}%"></span></span><span class="bar-value">${display}</span></div>`;
  }).join('');
  const table = `<details class="mini-table"><summary>View data table</summary><table><thead><tr><th>Category</th><th>Value</th></tr></thead><tbody>${values.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table></details>`;
  root.innerHTML = bars + table;
  root.dataset.ready = 'true';
}

message.addEventListener('input', () => {
  counter.textContent = `${message.value.length} / 4000`;
  analysisRequestId += 1;
  scannerController?.abort('message edited');
  if (!resultPanel.classList.contains('empty')) {
    resultPanel.className = 'result-panel panel empty';
    resultPanel.innerHTML = '<div class="result-placeholder"><div class="shield">↻</div><h2>Result needs refreshing</h2><p>The message changed. Analyse this current text to replace the previous result.</p></div>';
  }
});
function showScannerAndFocus({ announce = '' } = {}) {
  document.body.dataset.activeView = 'scanner';
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.toggle('active', x.dataset.view === 'scanner'));
  document.querySelectorAll('.scanner-view').forEach(x => x.classList.remove('hidden'));
  document.querySelector('.dashboard-view')?.classList.add('hidden');
  document.querySelector('.evidence-view')?.classList.add('hidden');
  document.querySelector('.workspace')?.scrollIntoView({behavior: 'smooth', block: 'start'});
  message?.focus({preventScroll: true});
  if (announce) errorBox.textContent = announce;
}

function loadScannerSample(sample, sourceLabel = 'Fictional example') {
  if (!sample) return false;
  const current = message.value.trim();
  if (current && current !== sample.trim()) {
    const replace = window.confirm('Replace the message currently in the Scanner with this fictional example?');
    if (!replace) {
      showScannerAndFocus({ announce: 'Your current Scanner text was kept.' });
      return false;
    }
  }
  message.value = sample;
  message.dispatchEvent(new Event('input'));
  showScannerAndFocus({ announce: `${sourceLabel} loaded. Select Analyse message to generate a new result.` });
  return true;
}

exampleBtn.addEventListener('click', () => {
  const item = demoExamples.length ? demoExamples[Math.floor(Math.random() * demoExamples.length)] : { text: 'Urgent: your account will be suspended today. Confirm your password and payment details using the link below to keep access.' };
  loadScannerSample(item.text, 'Fictional example');
});

document.querySelectorAll('.case-action').forEach(button => {
  button.textContent = 'Load in Scanner';
  button.addEventListener('click', () => {
  const sample = button.dataset.caseText || '';
  loadScannerSample(sample, 'Fictional scenario');
  });
});

visualExampleBtn?.addEventListener('click', () => {
  if (!demoExamples.length) return;
  resetUploadedEvidence();
  const item = demoExamples[Math.floor(Math.random() * demoExamples.length)];
  selectedImageData = `/static/assets/demo-examples/${item.asset}`;
  selectedEvidenceKind = 'image';
  selectedExampleText = item.text;
  extractedText = '';
  visualResult?.classList.add('hidden');
  visualController?.abort('example changed');
  visualAnalysisRequestId += 1;
  document.getElementById('imagePreview').innerHTML = `<img src="${selectedImageData}" alt="Synthetic ${escapeHtml(item.label)} ${escapeHtml(item.type)} evidence example">`;
  document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(item.asset)}</strong><span>${escapeHtml(item.type)} · synthetic ${escapeHtml(item.label)} sample</span>`;
  setImagePreviewAccessibility(true);
  imagePreview.setAttribute('aria-label', 'Open synthetic evidence image at full size');
  document.getElementById('visualFlags').innerHTML = `<span class="flag ${item.label === 'scam' ? 'warning' : 'positive'}">Synthetic ${escapeHtml(item.label)} example</span><span class="flag neutral">OCR ready</span><span class="flag neutral">Manual annotation available</span>`;
  setEvidenceState('ready', 'Synthetic example ready. Its pre-supplied demonstration text is separate from fresh-upload OCR.');
  document.getElementById('ocrText').textContent = '';
  document.getElementById('ocrText').value = '';
  ocrBtn.disabled = false;
  ocrBtn.textContent = 'Extract visible chat text';
  document.getElementById('previewHint').textContent = 'Select the image or press Enter to inspect it full size.';
  useOcrBtn.classList.add('hidden');
  removeImageBtn?.classList.remove('hidden');
});

recordingExampleBtn?.addEventListener('click', () => {
  const candidates = demoExamples.filter(item => recordingDemoStems.has(item.asset.replace(/\.svg$/i, '')));
  if (!candidates.length) {
    setEvidenceState('error', 'The recording demonstration library is unavailable. Try a screenshot example instead.');
    return;
  }
  resetUploadedEvidence();
  const choices = candidates.filter(item => item.asset !== lastRecordingExample);
  const item = (choices.length ? choices : candidates)[Math.floor(Math.random() * (choices.length || candidates.length))];
  lastRecordingExample = item.asset;
  const stem = item.asset.replace(/\.svg$/i, '');
  selectedEvidenceKind = 'video';
  selectedImageData = `/static/assets/demo-recordings/${stem}.mp4`;
  imagePreview.innerHTML = `<video src="${selectedImageData}" controls autoplay muted loop playsinline preload="metadata" aria-label="Synthetic ${escapeHtml(item.label)} ${escapeHtml(item.type)} chat screen recording"></video>`;
  setImagePreviewAccessibility(false);
  const video = imagePreview.querySelector('video');
  video.addEventListener('loadedmetadata', () => {
    document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(stem)}.mp4</strong><span>${video.videoWidth} × ${video.videoHeight}px · ${formatDuration(video.duration)} · synthetic ${escapeHtml(item.label)} recording</span>`;
  }, {once:true});
  document.getElementById('previewHint').textContent = 'This short fictional recording moves continuously. Extracting it uses real sampled-frame OCR rather than pre-supplied text.';
  document.getElementById('visualFlags').innerHTML = `<span class="flag ${item.label === 'scam' ? 'warning' : 'positive'}">Synthetic ${escapeHtml(item.label)} recording</span><span class="flag neutral">Local frame OCR ready</span><span class="flag neutral">Review before analysis</span>`;
  ocrBtn.textContent = 'Extract chat text from recording';
  ocrBtn.disabled = false;
  useOcrBtn.classList.add('hidden');
  removeImageBtn?.classList.remove('hidden');
  setEvidenceState('ready', 'Random synthetic recording ready. Play it or extract its visible chat text from sampled frames.');
});

removeImageBtn?.addEventListener('click', () => {
  resetUploadedEvidence();
  imageInput.value = '';
  document.getElementById('imagePreview').innerHTML = '<div class="preview-placeholder">Your redacted chat screenshot or screen recording will appear here.</div>';
  document.getElementById('imageMeta').textContent = 'No screenshot or recording selected yet.';
  setImagePreviewAccessibility(false);
  document.getElementById('previewHint').textContent = 'Images can be opened full size. Recordings can be played before frame-by-frame text extraction.';
  document.getElementById('visualFlags').innerHTML = '<span>Awaiting chat evidence</span>';
  setEvidenceState('idle', 'Choose a redacted screenshot or recording to begin.');
  ocrBtn.textContent = 'Extract visible chat text';
  ocrBtn.disabled = true;
  removeImageBtn.classList.add('hidden');
});

analyseBtn.addEventListener('click', async () => {
  errorBox.textContent = '';
  const requestId = ++analysisRequestId;
  scannerController?.abort('new analysis');
  scannerController = new AbortController();
  const submittedText = message.value.trim();
  if (!submittedText) {
    errorBox.textContent = 'Paste or type a message before analysing it.';
    message.focus();
    return;
  }
  analyseBtn.disabled = true;
  analyseBtn.innerHTML = 'Analysing...';
  resultPanel.className = 'result-panel panel empty';
  resultPanel.setAttribute('aria-busy', 'true');
  resultPanel.innerHTML = '<div class="result-placeholder"><div class="shield">…</div><h2>Analysing this message</h2><p>The previous result has been cleared.</p></div>';
  try {
    const data = await analyseTextRequest(submittedText, scannerController);
    if (requestId !== analysisRequestId || submittedText !== message.value.trim()) return;
    renderResult(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (requestId === analysisRequestId) {
      errorBox.innerHTML = `<span>${escapeHtml(err.message)}</span><button type="button" class="inline-retry" data-retry-analysis>Retry analysis</button>`;
      resultPanel.className = 'result-panel panel empty';
      resultPanel.innerHTML = '<div class="result-placeholder"><div class="shield">!</div><h2>Analysis did not complete</h2><p>No result is being shown for this message. Review the error and try again.</p></div>';
    }
  } finally {
    if (requestId === analysisRequestId) {
      resultPanel.removeAttribute('aria-busy');
      analyseBtn.disabled = false;
      analyseBtn.innerHTML = 'Analyse message <span aria-hidden="true">→</span>';
    }
  }
});

errorBox?.addEventListener('click', event => {
  if (event.target.closest('[data-retry-analysis]')) analyseBtn.click();
});

function renderResult(data) {
  resultPanel.className = 'result-panel panel';
  const reasons = renderEvidenceFindings(data);
  const reasonHeading = data.label === 'Few warning signs detected' ? 'What the analysis found' : 'Signals requiring attention';
  const guided = guidedVerification(data);
  resultPanel.innerHTML = `<div class="result-head"><div><div class="result-label">${escapeHtml(data.label)}</div><span class="band">${escapeHtml(data.band)}</span></div></div><div class="result-section"><h3>${reasonHeading}</h3>${reasons}</div><div class="result-section"><h3>Safer next step</h3><div class="action">${escapeHtml(data.action)}</div></div>${trustedGuidance(data)}${guided}<div class="feedback-box"><strong>Help improve the research</strong><span>Was this explanation useful?</span><div><button type="button" data-feedback="helpful">Yes, helpful</button><button type="button" data-feedback="unclear">Needs improvement</button></div><small id="feedbackStatus" aria-live="polite"></small></div><p class="result-disclaimer">${escapeHtml(data.score_meaning || 'This is decision support, not proof that a message is fraudulent.')}</p>`;
  resultPanel.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
    const feedback = button.dataset.feedback;
    const key = `scamshield-feedback-${feedback}`;
    localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
    resultPanel.querySelector('#feedbackStatus').textContent = 'Thank you — your feedback stays on this device for the prototype.';
  }));
}

resultPanel.addEventListener('click', event => {
  const button = event.target.closest('[data-evidence-phrase]');
  if (!button || !message) return;
  const phrase = button.dataset.evidencePhrase;
  const start = message.value.toLowerCase().indexOf(phrase.toLowerCase());
  if (start < 0) { button.textContent = 'Excerpt not found in current text'; return; }
  message.focus();
  message.setSelectionRange(start, start + phrase.length);
  button.textContent = 'Highlighted in message';
});

function guidedVerification(data) {
  const signals = new Set(data.signals || []);
  const questions = [];
  if (signals.has('credentials') || signals.has('authentication_code') || signals.has('login_approval')) questions.push('Were you expecting this login, support request or code prompt?');
  if (signals.has('payment') || signals.has('family_impersonation')) questions.push('Did you independently confirm the payment request using a trusted contact?');
  if (signals.has('impersonation') || signals.has('support_impersonation') || signals.has('link')) questions.push('Did you initiate contact, or verify the sender through an official channel you found yourself?');
  if (!questions.length) return '';
  return `<div class="guided-check result-section"><h3>Guided verification</h3><p class="guided-intro">These answers add user-provided context. They do not change the model evidence or prove what happened.</p>${questions.map((question, index) => `<div class="guided-question"><span>${escapeHtml(question)}</span><div><button type="button" data-context="yes" data-question="${index}">Yes</button><button type="button" data-context="no" data-question="${index}">No</button><button type="button" data-context="unsure" data-question="${index}">Not sure</button></div><small id="context-${index}" aria-live="polite"></small></div>`).join('')}</div>`;
}

resultPanel.addEventListener('click', event => {
  const button = event.target.closest('[data-context]');
  if (!button) return;
  const target = resultPanel.querySelector(`#context-${button.dataset.question}`);
  const messages = {
    yes:'User-provided answer: Yes. Continue using only a contact route you found independently before acting.',
    no:'User-provided answer: No. Do not act on the request; verify it through a previously trusted route.',
    unsure:'User-provided answer: Not sure. Pause and verify independently before sharing information or money.',
  };
  if (target) target.textContent = messages[button.dataset.context];
  resultPanel.querySelectorAll(`[data-question="${button.dataset.question}"]`).forEach(x => x.classList.toggle('selected', x === button));
});

const conversationText = document.getElementById('conversationText');
const conversationBtn = document.getElementById('conversationBtn');
const conversationResult = document.getElementById('conversationResult');
function parseConversationLine(rawLine, index) {
  const raw = rawLine.trim();
  const quoted = /^>/.test(raw) || /^\s*(?:quote|quoted|example)\s*:/i.test(raw) || /^[\"“‘]/.test(raw);
  const withoutQuote = raw.replace(/^>\s*/, '').replace(/^\s*(?:quote|quoted|example)\s*:\s*/i, '');
  const match = withoutQuote.match(/^([^:]{1,40}):\s*(.+)$/);
  return { index: index + 1, speaker: match ? match[1].trim() : 'Unlabelled speaker', text: match ? match[2].trim() : withoutQuote, quoted };
}
function analyseConversationLines(rawLines) {
  const lines = rawLines.map(parseConversationLine);
  const observations = [];
  const denial = /\b(?:i|we|you)\s+(?:did\s+not|didn't|didnt|never|have not|haven't|wasn't|was not)\s+(?:request|ask for|approve|authori[sz]e|send|share|click|open|make|recognise|recognize)\b|\b(?:not|no)\s+(?:requested|authori[sz]ed|approved)\b/i;
  const advice = /\b(?:never|do not|don't|dont|avoid|be careful|remember to|stay safe|report)\b[^.?!]*(?:password|passcode|code|link|payment|bank|account|login|scam|sender)/i;
  const education = /\b(?:this is (?:an? )?(?:example|scam|phishing)|that is (?:an? )?(?:example|scam|phishing)|an example of|example:|security advice|security awareness|phishing is|scammers? may)\b/i;
  const credentialRequest = /\b(?:send|share|give|provide|forward|enter|type|reply with|tell me|confirm|verify|submit)\b[^.?!]{0,100}\b(?:password|passcode|one[- ]time code|otp|security code|verification code|login details|sign[- ]in details)\b|\b(?:password|passcode|one[- ]time code|otp|security code|verification code|login details|sign[- ]in details)\b[^.?!]{0,80}\b(?:required|needed|confirm|send|share|enter|provide)\b/i;
  const paymentRequest = /\b(?:send|pay|transfer|wire|settle|authori[sz]e|confirm)\b[^.?!]{0,90}(?:£\s?\d[\d,.]*|\$\s?\d[\d,.]*|€\s?\d[\d,.]*|payment|money|bank details|card details|account number|fee|charge)\b|\b(?:payment|money|bank details|card details|account number|fee|charge)\b[^.?!]{0,70}\b(?:required|needed|confirm|send|pay|transfer|today|now)\b/i;
  const approvalRequest = /\b(?:approve|authori[sz]e|allow|confirm)\b[^.?!]{0,80}\b(?:login|sign[- ]?in|account|payment|request)\b|\b(?:login|sign[- ]?in|account|payment)\b[^.?!]{0,80}\b(?:approval|approve|authori[sz]ation|confirm)\b/i;
  const urgency = /\b(?:urgent(?:ly)?|immediately|act now|final warning|within\s+\d+|today|tonight|before\s+\d+|expires?|suspend|close)\b/i;
  lines.forEach(line => {
    const text = line.text;
    const personal = /^(?:me|i|myself|user|customer|victim)$/i.test(line.speaker) || /\b(?:i|we)\b/i.test(text);
    const base = {index: line.index, name: '', explanation: '', quote: `${line.speaker}: ${text}`};
    if (line.quoted || education.test(text)) {
      if (credentialRequest.test(text) || paymentRequest.test(text) || approvalRequest.test(text)) observations.push({...base, name: 'Quoted or educational content', explanation: 'This line describes or quotes scam content; it is not treated as a request from the speaker.'});
      return;
    }
    if (denial.test(text) || (personal && /\b(?:did not|didn't|never|not)\b/i.test(text))) {
      observations.push({...base, name: 'Denial or refusal', explanation: 'This line says the speaker did not request or approve the action; it is not labelled as a request.'});
      return;
    }
    if (advice.test(text)) {
      observations.push({...base, name: 'Security advice', explanation: 'This line advises the reader to avoid a risky action; advice is distinct from an instruction to disclose or pay.'});
      return;
    }
    if (credentialRequest.test(text)) observations.push({...base, name: 'Credential request', explanation: 'This line asks the reader to disclose, enter or send a password, passcode or verification code.'});
    else if (paymentRequest.test(text)) observations.push({...base, name: 'Payment request', explanation: 'This line asks or pressures the reader to send money or confirm payment details.'});
    else if (approvalRequest.test(text)) observations.push({...base, name: 'Approval request', explanation: 'This line asks the reader to approve or authorise a login, account or payment request.'});
    if (urgency.test(text) && (credentialRequest.test(text) || paymentRequest.test(text) || approvalRequest.test(text))) observations.push({...base, name: 'Pressure or deadline', explanation: 'This same message adds a deadline or pressure cue to the request.'});
  });
  return observations;
}
conversationBtn?.addEventListener('click', () => {
  conversationBtn.disabled = true;
  conversationBtn.classList.add('is-building');
  conversationBtn.textContent = 'Building timeline…';
  window.setTimeout(() => {
    conversationBtn.disabled = false;
    conversationBtn.classList.remove('is-building');
    conversationBtn.textContent = 'Build conversation timeline';
  }, 520);
  const lines = (conversationText?.value || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) { conversationResult.textContent = 'Paste a redacted conversation first.'; return; }
  const observations = window.ScamShieldConversation?.analyse(lines) || [];
  conversationResult.innerHTML = observations.length ? `<div class="conversation-meta">${lines.length} message${lines.length === 1 ? '' : 's'} reviewed locally · each observation is attached to its exact supporting excerpt · speaker labels are user supplied, not identity checks</div>${observations.map(item => `<article class="conversation-observation"><b>Message ${item.index} · ${escapeHtml(item.name)}</b><span>${escapeHtml(item.explanation)}</span><q>${escapeHtml(item.speaker)}: ${escapeHtml(item.excerpt)}</q></article>`).join('')}` : '<div class="conversation-meta">No supported request, denial, verification warning or quoted tactic was found in the supplied text. This does not prove the conversation is safe.</div>';
  conversationResult.classList.remove('is-ready');
  void conversationResult.offsetWidth;
  conversationResult.classList.add('is-ready');
});

function parseUrlInput() {
  const raw = urlInput?.value.trim();
  if (!raw) throw new Error('Paste a public web address first.');
  const extracted = raw.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/i)?.[0] || raw;
  const candidate = extracted.replace(/[),.;!?]+$/, '');
  try { return new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`); }
  catch { throw new Error('Unable to parse this as a normal web address. Paste the complete address, for example https://example.com.'); }
}

function inspectUrl() {
  let parsed;
  try { parsed = parseUrlInput(); }
  catch (error) {
    urlResult.innerHTML = `<strong class="url-danger">Address needs attention</strong><span>${escapeHtml(error.message)}</span>`;
    return;
  }
  const host = parsed.hostname.toLowerCase();
  const findings = [];
  if (parsed.protocol !== 'https:') findings.push('not using HTTPS');
  if (host.includes('xn--')) findings.push('uses encoded international characters');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) findings.push('uses a raw IP address');
  if (parsed.username || parsed.password) findings.push('contains embedded sign-in details');
  if (/(login|verify|secure|claim|refund|payment|urgent|gift|wallet)/i.test(`${host}${parsed.pathname}`)) findings.push('contains high-pressure or account-related wording');
  const status = findings.length ? 'Caution' : 'No obvious pattern found';
  const tone = findings.length ? 'url-caution' : 'url-clear';
  urlResult.innerHTML = `<strong class="${tone}">${status}</strong><span>Host: <b>${escapeHtml(host)}</b></span><span>${findings.length ? escapeHtml(findings.join('; ')) + '. Verify the organisation independently before acting.' : 'This local check found no obvious URL pattern. It does not prove the site is safe.'}</span><small>Local pattern check only · the address was not visited.</small>`;
}

async function inspectUrlOnline() {
  let parsed;
  try { parsed = parseUrlInput(); }
  catch (error) {
    urlResult.innerHTML = `<strong class="url-danger">Address needs attention</strong><span>${escapeHtml(error.message)}</span>`;
    return;
  }
  const requestId = ++linkRequestId;
  linkController?.abort('new link check');
  linkController = new AbortController();
  const timeout = window.setTimeout(() => linkController.abort('timeout'), 10000);
  inspectOnlineBtn.disabled = true;
  inspectOnlineBtn.textContent = 'Checking…';
  urlResult.innerHTML = '<strong class="url-caution">Checking the public internet</strong><span>Confirming public DNS, HTTPS, redirects and response metadata. The page body is not downloaded for analysis.</span>';
  try {
    const response = await fetch('/api/link-inspect', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({url: parsed.href}),
      signal: linkController.signal,
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('The online checker returned an unexpected response.'); }
    if (!response.ok) throw new Error(data.error || 'The online checker could not inspect this address.');
    if (requestId !== linkRequestId || parsed.href !== parseUrlInput().href) return;
    const redirectCopy = data.redirects?.length
      ? `${data.redirects.length} redirect${data.redirects.length === 1 ? '' : 's'}; final host: ${data.final_host}.`
      : `No redirect observed; final host: ${data.final_host}.`;
    const tone = data.https && data.status >= 200 && data.status < 400 ? 'url-clear' : 'url-caution';
    urlResult.innerHTML = `<strong class="${tone}">Live public response: HTTP ${escapeHtml(data.status)}</strong><span>Requested host: <b>${escapeHtml(data.requested_host)}</b></span><span>${escapeHtml(redirectCopy)} ${data.https ? 'The final address uses HTTPS.' : 'The final address does not use HTTPS.'}</span><span>Content type: ${escapeHtml(data.content_type)} · ${escapeHtml(data.resolved_addresses)} public DNS address${data.resolved_addresses === 1 ? '' : 'es'} observed.</span><small>${escapeHtml(data.meaning)}</small>`;
  } catch (error) {
    if (requestId !== linkRequestId) return;
    const message = linkController.signal.aborted && linkController.signal.reason === 'timeout'
      ? 'The online check timed out. The site may be unavailable; try again later.'
      : error.message;
    urlResult.innerHTML = `<strong class="url-danger">Online check did not complete</strong><span>${escapeHtml(message)}</span><small>No safety verdict has been substituted. You can retry or use the official guidance links below.</small>`;
  } finally {
    window.clearTimeout(timeout);
    if (requestId === linkRequestId) {
      inspectOnlineBtn.disabled = false;
      inspectOnlineBtn.textContent = 'Check online';
    }
  }
}
inspectUrlBtn?.addEventListener('click', inspectUrl);
inspectOnlineBtn?.addEventListener('click', inspectUrlOnline);
urlInput?.addEventListener('keydown', event => { if (event.key === 'Enter') inspectUrl(); });
urlInput?.addEventListener('input', () => {
  linkRequestId += 1;
  linkController?.abort('address edited');
});
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

const journeyTrack = document.querySelector('.journey-track');
const journeySteps = journeyTrack ? [...journeyTrack.querySelectorAll('.journey-step')] : [];
const journeyPrev = document.querySelector('.journey-prev');
const journeyNext = document.querySelector('.journey-next');
const journeyReset = document.querySelector('.journey-reset');
const journeyProgress = document.querySelector('.journey-progress');
let journeyIndex = 0;
function updateJourney(index) {
  if (!journeySteps.length) return;
  journeyIndex = Math.max(0, Math.min(index, journeySteps.length - 1));
  journeyTrack.dataset.currentStep = String(journeyIndex);
  journeySteps.forEach((step, stepIndex) => {
    const active = stepIndex === journeyIndex;
    step.classList.toggle('journey-active', active);
    step.setAttribute('aria-current', active ? 'step' : 'false');
  });
  if (journeyPrev) journeyPrev.disabled = journeyIndex === 0;
  if (journeyNext) journeyNext.disabled = journeyIndex === journeySteps.length - 1;
  if (journeyProgress) journeyProgress.textContent = `Stage ${journeyIndex + 1} of ${journeySteps.length}`;
}
journeyPrev?.addEventListener('click', () => updateJourney(journeyIndex - 1));
journeyNext?.addEventListener('click', () => updateJourney(journeyIndex + 1));
journeyReset?.addEventListener('click', () => updateJourney(0));
updateJourney(0);

const motionToggle = document.getElementById('motionToggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPausedByUser = localStorage.getItem('scamshield-motion-paused') === 'true';
function updateMotionControl() {
  const systemPaused = reducedMotion.matches;
  document.body.classList.toggle('motion-paused', motionPausedByUser || systemPaused);
  motionToggle.disabled = systemPaused;
  motionToggle.setAttribute('aria-pressed', String(motionPausedByUser || systemPaused));
  motionToggle.textContent = systemPaused ? 'Motion off' : motionPausedByUser ? 'Resume motion' : 'Pause motion';
  motionToggle.setAttribute('aria-label', systemPaused ? 'Background motion off due to system settings' : motionPausedByUser ? 'Resume animated backgrounds' : 'Pause animated backgrounds');
}
motionToggle?.addEventListener('click', () => {
  motionPausedByUser = !motionPausedByUser;
  localStorage.setItem('scamshield-motion-paused', String(motionPausedByUser));
  updateMotionControl();
});
reducedMotion.addEventListener?.('change', updateMotionControl);
document.addEventListener('visibilitychange', () => document.body.classList.toggle('motion-hidden', document.hidden));
document.body.classList.toggle('motion-hidden', document.hidden);
updateMotionControl();
const animatedSections = document.querySelectorAll('.hero, .evidence-lab, .dashboard');
if ('IntersectionObserver' in window) {
  const motionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('motion-out-of-view', !entry.isIntersecting));
  }, { threshold: 0.01 });
  animatedSections.forEach(section => { section.classList.add('motion-out-of-view'); motionObserver.observe(section); });
}
