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
const visualExampleBtn = document.getElementById('visualExampleBtn');
const removeImageBtn = document.getElementById('removeImageBtn');
let selectedImageData = null;
let extractedText = '';
let selectedExampleText = '';
let analysisRequestId = 0;
let visualAnalysisRequestId = 0;

function openLightbox() {
  const image = imagePreview?.querySelector('img');
  if (!image || !imageLightbox || !lightboxImage) return;
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt || 'Full-size evidence preview';
  imageLightbox.classList.remove('hidden');
  document.body.classList.add('lightbox-open');
}
function closeImageLightbox() { imageLightbox?.classList.add('hidden'); document.body.classList.remove('lightbox-open'); }
imagePreview?.addEventListener('click', openLightbox);
closeLightbox?.addEventListener('click', closeImageLightbox);
imageLightbox?.addEventListener('click', event => { if (event.target === imageLightbox) closeImageLightbox(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeImageLightbox(); });
let demoExamples = [];

fetch('/data/demo_examples.json').then(response => response.ok ? response.json() : []).then(items => { demoExamples = items; }).catch(() => {});

let dashboardLoaded = false;
const homeData = [['Bank impersonation',34],['Delivery / tax',28],['University account',19],['Sports / ticketing',17]];
renderBars('homeChart', homeData);

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
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

async function loadDashboard() {
  if (dashboardLoaded) return;
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Dashboard data is unavailable.');
    const data = await response.json();
    renderEvidence(data.evidence);
    renderEvaluation(data.evaluation);
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

if (imageInput) imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  selectedExampleText = '';
  visualResult?.classList.add('hidden');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    document.getElementById('imageMeta').textContent = 'Unsupported file type. Choose a PNG, JPG or WebP screenshot.';
    imageInput.value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    document.getElementById('imageMeta').textContent = 'Image is larger than 8 MB. Choose a smaller redacted sample.';
    return;
  }
  const reader = new FileReader();
  reader.onload = event => {
    selectedImageData = event.target.result;
    const img = new Image();
    img.onload = () => {
      const ratio = (img.width / img.height).toFixed(2);
      document.getElementById('imagePreview').innerHTML = `<img src="${event.target.result}" alt="Uploaded redacted fraud evidence preview">`;
      document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${img.width} × ${img.height}px · ${(file.size / 1024).toFixed(0)} KB · aspect ratio ${ratio}</span>`;
      document.getElementById('profileStatus').textContent = 'Image ready';
      ocrBtn.disabled = false;
      removeImageBtn?.classList.remove('hidden');
      document.getElementById('visualFlags').innerHTML = '<span class="flag neutral">Image preview ready</span><span class="flag neutral">OCR ready</span><span class="flag neutral">Manual annotation available</span>';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

if (ocrBtn) ocrBtn.addEventListener('click', async () => {
  if (!selectedImageData) {
    document.getElementById('ocrStatus').textContent = 'Choose an image before extracting visible text.';
    return;
  }
  if (selectedExampleText) {
    extractedText = selectedExampleText;
    document.getElementById('ocrText').value = extractedText;
    document.getElementById('ocrStatus').textContent = 'Demo text extracted from the visible synthetic screenshot. Review it before analysis.';
    document.getElementById('visualFlags').innerHTML = '<span class="flag positive">Readable text found</span><span class="flag neutral">Synthetic example</span><span class="flag neutral">Review warning signs below</span>';
    useOcrBtn.classList.remove('hidden');
    return;
  }
  if (!window.Tesseract) {
    document.getElementById('ocrStatus').textContent = 'Browser OCR is unavailable in this deployment. Use the visible-text box or manual annotation; no image was sent anywhere.';
    return;
  }
  ocrBtn.disabled = true;
  document.getElementById('ocrStatus').textContent = 'Reading visible text locally...';
  try {
    const result = await Tesseract.recognize(selectedImageData, 'eng', { logger: message => {
      if (message.status === 'recognizing text') document.getElementById('ocrStatus').textContent = `Reading visible text locally... ${Math.round(message.progress * 100)}%`;
    }});
    const text = result.data.text.trim().replace(/\n{3,}/g, '\n\n');
    const words = text.split(/\s+/).filter(word => /[A-Za-z]{2,}/.test(word));
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    const confidence = Number(result.data.confidence || 0);
    const useful = text.length >= 18 && words.length >= 3 && letters >= 14 && confidence >= 45;
    if (useful) {
      extractedText = text;
      document.getElementById('ocrText').value = text;
      document.getElementById('ocrStatus').textContent = `OCR complete (${Math.round(confidence)}% confidence). Review the extracted text before using it.`;
      document.getElementById('visualFlags').innerHTML = '<span class="flag positive">Readable text found</span><span class="flag neutral">Review warning signs below</span>';
      useOcrBtn.classList.remove('hidden');
    } else {
      extractedText = '';
      document.getElementById('ocrText').value = '';
      document.getElementById('ocrStatus').textContent = 'This does not look like a readable email, SMS or login-page screenshot. Try a clearer scam screenshot; portraits and ordinary photos cannot be analysed for phishing text.';
      document.getElementById('visualFlags').innerHTML = '<span class="flag warning">No readable scam text</span><span class="flag neutral">Use a message screenshot</span>';
      useOcrBtn.classList.add('hidden');
    }
  } catch (err) {
    document.getElementById('ocrStatus').textContent = 'OCR could not read this image. Manual annotation remains available.';
  } finally { ocrBtn.disabled = false; }
});

if (useOcrBtn) useOcrBtn.addEventListener('click', async () => {
  extractedText = document.getElementById('ocrText').value.trim();
  if (!extractedText) { document.getElementById('ocrStatus').textContent = 'There is no extracted text to analyse. Review or enter visible message text first.'; return; }
  const requestId = ++visualAnalysisRequestId;
  useOcrBtn.disabled = true;
  useOcrBtn.textContent = 'Analysing image evidence...';
  try {
    const response = await fetch('/api/analyse', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: extractedText}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to analyse the extracted evidence.');
    if (requestId !== visualAnalysisRequestId || extractedText !== document.getElementById('ocrText').value.trim()) return;
    const reasons = data.reasons.map(reason => `<li><span>✓</span>${escapeHtml(reason)}</li>`).join('');
    visualResult.innerHTML = `<div class="visual-result-head"><div><span class="eyebrow">Image evidence result</span><h3>${escapeHtml(data.label)}</h3><span class="band">${escapeHtml(data.band)}</span></div></div><h4>Why it was flagged</h4><ul>${reasons}</ul><h4>Safer next step</h4><p class="visual-action">${escapeHtml(data.action)}</p><small class="visual-boundary">${escapeHtml(data.score_meaning || 'This result is based on visible text from the selected image and is not proof of fraud.')}</small>`;
    visualResult.classList.remove('hidden');
  } catch (err) { document.getElementById('ocrStatus').textContent = err.message; }
  finally { useOcrBtn.disabled = false; useOcrBtn.innerHTML = 'Analyse image evidence <span aria-hidden="true">→</span>'; }
});

document.getElementById('ocrText')?.addEventListener('input', () => {
  visualAnalysisRequestId += 1;
  visualResult?.classList.add('hidden');
  document.getElementById('ocrStatus').textContent = 'Edited text has not been analysed yet.';
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
  const m = evaluation.metrics || {};
  root.innerHTML = `<div><span class="eyebrow">Measured model evaluation</span><h2>Held-out result · ${escapeHtml(evaluation.dataset_version || 'versioned dataset')}</h2><p>${escapeHtml(evaluation.test_rows)} messages · ${escapeHtml(evaluation.evaluation_date)} · model ${escapeHtml(evaluation.model_version)}</p></div><div class="evaluation-metrics"><span><b>${Math.round((m.precision || 0) * 100)}%</b><small>precision</small></span><span><b>${Math.round((m.recall || 0) * 100)}%</b><small>recall</small></span><span><b>${(m.f1 || 0).toFixed(3)}</b><small>F1</small></span><span><b>${escapeHtml(m.missed_scams)}</b><small>missed scams</small></span></div><small class="evaluation-note">These results are measured on a small held-out set, not a claim of real-world accuracy.</small>`;
}

function renderBars(id, values, compact = false) {
  const root = document.getElementById(id);
  if (!root || root.dataset.ready) return;
  const max = Math.max(...values.map(x => x[1]));
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Chart data: ' + values.map(([label, value]) => `${label}, ${value}`).join('; '));
  root.innerHTML = values.map(([label, value]) => {
    const display = compact && value >= 1000000 ? `${(value / 1000000).toFixed(1)}m` : compact && value >= 1000 ? `${Math.round(value / 1000)}k` : value;
    return `<div class="bar-row"><span class="bar-label">${escapeHtml(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(value/max*100)}%"></span></span><span class="bar-value">${display}</span></div>`;
  }).join('');
  root.dataset.ready = 'true';
}

message.addEventListener('input', () => {
  counter.textContent = `${message.value.length} / 4000`;
  analysisRequestId += 1;
  if (!resultPanel.classList.contains('empty')) {
    resultPanel.className = 'result-panel panel empty';
    resultPanel.innerHTML = '<div class="result-placeholder"><div class="shield">↻</div><h2>Result needs refreshing</h2><p>The message changed. Analyse this current text to replace the previous result.</p></div>';
  }
});
exampleBtn.addEventListener('click', () => {
  const item = demoExamples.length ? demoExamples[Math.floor(Math.random() * demoExamples.length)] : { text: 'Urgent: your account will be suspended today. Confirm your password and payment details using the link below to keep access.' };
  message.value = item.text;
  message.dispatchEvent(new Event('input'));
  message.focus();
});

visualExampleBtn?.addEventListener('click', () => {
  if (!demoExamples.length) return;
  const item = demoExamples[Math.floor(Math.random() * demoExamples.length)];
  selectedImageData = `/static/assets/demo-examples/${item.asset}`;
  selectedExampleText = item.text;
  extractedText = '';
  visualResult?.classList.add('hidden');
  document.getElementById('imagePreview').innerHTML = `<img src="${selectedImageData}" alt="Synthetic ${escapeHtml(item.label)} ${escapeHtml(item.type)} evidence example">`;
  document.getElementById('imageMeta').innerHTML = `<strong>${escapeHtml(item.asset)}</strong><span>${escapeHtml(item.type)} · synthetic ${escapeHtml(item.label)} sample</span>`;
  document.getElementById('profileStatus').textContent = 'Example ready';
  document.getElementById('visualFlags').innerHTML = `<span class="flag ${item.label === 'scam' ? 'warning' : 'positive'}">Synthetic ${escapeHtml(item.label)} example</span><span class="flag neutral">OCR ready</span><span class="flag neutral">Manual annotation available</span>`;
  document.getElementById('ocrStatus').textContent = 'Review the visible message, then extract the text locally if required.';
  document.getElementById('ocrText').textContent = '';
  document.getElementById('ocrText').value = '';
  ocrBtn.disabled = false;
  useOcrBtn.classList.add('hidden');
  removeImageBtn?.classList.remove('hidden');
});

removeImageBtn?.addEventListener('click', () => {
  selectedImageData = null; selectedExampleText = ''; extractedText = '';
  imageInput.value = '';
  document.getElementById('imagePreview').innerHTML = '<div class="preview-placeholder">Your redacted email, SMS or login-page screenshot will appear here.</div>';
  document.getElementById('imageMeta').textContent = 'No image selected yet.';
  document.getElementById('profileStatus').textContent = 'Waiting';
  document.getElementById('visualFlags').innerHTML = '<span>Awaiting screenshot</span>';
  document.getElementById('ocrStatus').textContent = '';
  document.getElementById('ocrText').value = '';
  ocrBtn.disabled = true; useOcrBtn.classList.add('hidden'); visualResult?.classList.add('hidden');
  removeImageBtn.classList.add('hidden');
});

analyseBtn.addEventListener('click', async () => {
  errorBox.textContent = '';
  const requestId = ++analysisRequestId;
  const submittedText = message.value.trim();
  analyseBtn.disabled = true;
  analyseBtn.innerHTML = 'Analysing...';
  try {
    const response = await fetch('/api/analyse', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: submittedText}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to analyse the message.');
    if (requestId !== analysisRequestId || submittedText !== message.value.trim()) return;
    renderResult(data);
  } catch (err) { if (requestId === analysisRequestId) errorBox.textContent = err.message; }
  finally { analyseBtn.disabled = false; analyseBtn.innerHTML = 'Analyse message <span aria-hidden="true">→</span>'; }
});

function renderResult(data) {
  resultPanel.className = 'result-panel panel';
  const reasons = data.reasons.map(reason => `<div class="reason"><i>✓</i><span>${escapeHtml(reason)}</span></div>`).join('');
  const reasonHeading = data.label === 'Few warning signs detected' ? 'What the analysis found' : 'Signals requiring attention';
  resultPanel.innerHTML = `<div class="result-head"><div><div class="result-label">${escapeHtml(data.label)}</div><span class="band">${escapeHtml(data.band)}</span></div></div><div class="result-section"><h3>${reasonHeading}</h3>${reasons}</div><div class="result-section"><h3>Safer next step</h3><div class="action">${escapeHtml(data.action)}</div></div><p class="result-disclaimer">${escapeHtml(data.score_meaning || 'This is decision support, not proof that a message is fraudulent.')}</p>`;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
