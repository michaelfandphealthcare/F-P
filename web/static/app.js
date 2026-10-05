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
const urlResult = document.getElementById('urlResult');
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
    renderEvaluation(data.evaluation);
    renderMeasuredCharts(data.evaluation);
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
  const classes = evaluation.class_distribution || {};
  root.innerHTML = `<div class="evaluation-summary-copy"><span class="eyebrow">Measured held-out evaluation</span><h2>${escapeHtml(evaluation.dataset_version || 'Versioned dataset')}</h2><p>${escapeHtml(evaluation.test_rows)} messages · evaluated ${escapeHtml(evaluation.evaluation_date)} · model ${escapeHtml(evaluation.model_version)}</p></div><div class="evaluation-summary-stats"><span><b>${escapeHtml(evaluation.test_rows)}</b><small>messages</small></span><span><b>${escapeHtml(classes.phishing || 0)}</b><small>scams</small></span><span><b>${escapeHtml(classes.legitimate || 0)}</b><small>legitimate</small></span><span><b>${Math.round((m.recall || 0) * 100)}%</b><small>recall</small></span></div><small class="evaluation-note">Small hand-curated held-out set; not a claim of real-world accuracy.</small>`;
}

function renderMeasuredCharts(evaluation) {
  const metrics = evaluation?.metrics || {};
  const matrix = metrics.confusion_matrix || {};
  const confusion = [
    ['Correctly legitimate', matrix.true_negative || 0, 'tn'],
    ['False alarm', matrix.false_positive || 0, 'fp'],
    ['Missed scam', matrix.false_negative || 0, 'fn'],
    ['Correctly detected scam', matrix.true_positive || 0, 'tp'],
  ];
  const confusionChart = document.getElementById('confusionChart');
  if (confusionChart) {
    const max = Math.max(1, ...confusion.map(item => item[1]));
    confusionChart.innerHTML = `<div class="matrix-axis"><span></span><b>Predicted legitimate</b><b>Predicted scam</b></div><div class="matrix-row"><b>Actual legitimate</b><span class="matrix-cell tn" style="--cell:${matrix.true_negative / max}" title="Correctly legitimate: ${matrix.true_negative}">${matrix.true_negative}<small>correct</small></span><span class="matrix-cell fp" style="--cell:${matrix.false_positive / max}" title="False alarm: ${matrix.false_positive}">${matrix.false_positive}<small>false alarm</small></span></div><div class="matrix-row"><b>Actual scam</b><span class="matrix-cell fn" style="--cell:${matrix.false_negative / max}" title="Missed scam: ${matrix.false_negative}">${matrix.false_negative}<small>missed</small></span><span class="matrix-cell tp" style="--cell:${matrix.true_positive / max}" title="Correctly detected scam: ${matrix.true_positive}">${matrix.true_positive}<small>correct</small></span></div>`;
  }
  const confusionTable = document.getElementById('confusionTable');
  if (confusionTable) confusionTable.innerHTML = `<table><caption>Confusion matrix counts</caption><thead><tr><th>Actual / predicted</th><th>Legitimate</th><th>Scam</th></tr></thead><tbody><tr><th>Legitimate</th><td>${matrix.true_negative || 0} correct</td><td>${matrix.false_positive || 0} false alarms</td></tr><tr><th>Scam</th><td>${matrix.false_negative || 0} missed</td><td>${matrix.true_positive || 0} correct</td></tr></tbody></table>`;
  const metricChart = document.getElementById('metricChart');
  const metricRows = [['Precision', metrics.precision || 0, 'precision'], ['Recall', metrics.recall || 0, 'recall'], ['F1', metrics.f1 || 0, 'f1']];
  if (metricChart) metricChart.innerHTML = `<div class="metric-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>${metricRows.map(([label, value, key]) => `<div class="metric-row"><b>${label}</b><div class="metric-track"><span class="metric-fill ${key}" style="width:${Math.round(value * 100)}%"></span></div><strong>${Math.round(value * 100)}%</strong></div>`).join('')}`;
  const metricTable = document.getElementById('metricTable');
  if (metricTable) metricTable.innerHTML = `<table><caption>Measured performance percentages</caption><thead><tr><th>Metric</th><th>Value</th><th>Meaning</th></tr></thead><tbody><tr><th>Precision</th><td>${Math.round((metrics.precision || 0) * 100)}%</td><td>How many flagged messages were scams</td></tr><tr><th>Recall</th><td>${Math.round((metrics.recall || 0) * 100)}%</td><td>How many scams were detected</td></tr><tr><th>F1</th><td>${Math.round((metrics.f1 || 0) * 100)}%</td><td>Combined precision/recall measure</td></tr></tbody></table>`;
  const scenarioChart = document.getElementById('scenarioChart');
  if (scenarioChart) {
    const records = evaluation.records || [];
    scenarioChart.innerHTML = records.map(record => {
      const actual = record.label === 'phishing' ? 'scam' : 'legitimate';
      const predicted = record.prediction === 1 ? 'scam' : 'legitimate';
      const correct = actual === predicted;
      const status = correct ? (actual === 'scam' ? 'Detected' : 'Correctly clear') : (actual === 'scam' ? 'Missed' : 'False alarm');
      const tone = correct ? (actual === 'scam' ? 'success' : 'neutral') : 'error';
      return `<div class="scenario-outcome-row"><span class="scenario-outcome-label">${escapeHtml(record.scenario)}</span><span class="scenario-outcome-track"><span class="scenario-outcome-fill ${tone}"></span></span><strong class="scenario-outcome-status ${tone}">${status}</strong><small>n=1</small></div>`;
    }).join('');
  }
  const baselineChart = document.getElementById('baselineChart');
  if (baselineChart) {
    if (evaluation.baseline_metrics) {
      const baseline = evaluation.baseline_metrics;
      const rows = [['Precision', metrics.precision || 0, baseline.precision || 0], ['Recall', metrics.recall || 0, baseline.recall || 0], ['F1', metrics.f1 || 0, baseline.f1 || 0]];
      baselineChart.innerHTML = `<div class="grouped-metric-legend"><span><i class="legend-swatch model"></i>ScamShield</span><span><i class="legend-swatch baseline"></i>TF-IDF-only baseline</span></div>${rows.map(([label, value, base]) => `<div class="grouped-metric-row"><b>${label}</b><div class="grouped-track"><span class="grouped-fill model" style="width:${Math.round(value * 100)}%"></span><span class="grouped-fill baseline" style="width:${Math.round(base * 100)}%"></span></div><small>${Math.round(value * 100)}% / ${Math.round(base * 100)}%</small></div>`).join('')}<p class="baseline-method">${escapeHtml(baseline.method || evaluation.baseline_status || '')}</p>`;
    } else {
      baselineChart.innerHTML = `<div class="pending-icon" aria-hidden="true">—</div><strong>Baseline comparison pending</strong><p>${escapeHtml(evaluation.baseline_status || 'No independently measured baseline is available for this split.')}</p>`;
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
  resultPanel.innerHTML = `<div class="result-head"><div><div class="result-label">${escapeHtml(data.label)}</div><span class="band">${escapeHtml(data.band)}</span></div></div><div class="result-section"><h3>${reasonHeading}</h3>${reasons}</div><div class="result-section"><h3>Safer next step</h3><div class="action">${escapeHtml(data.action)}</div></div><div class="feedback-box"><strong>Help improve the research</strong><span>Was this explanation useful?</span><div><button type="button" data-feedback="helpful">Yes, helpful</button><button type="button" data-feedback="unclear">Needs improvement</button></div><small id="feedbackStatus" aria-live="polite"></small></div><p class="result-disclaimer">${escapeHtml(data.score_meaning || 'This is decision support, not proof that a message is fraudulent.')}</p>`;
  resultPanel.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
    const feedback = button.dataset.feedback;
    const key = `scamshield-feedback-${feedback}`;
    localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
    resultPanel.querySelector('#feedbackStatus').textContent = 'Thank you — your feedback stays on this device for the prototype.';
  }));
}

function inspectUrl() {
  const raw = urlInput?.value.trim();
  if (!raw) { urlResult.textContent = 'Paste a link first. ScamShield will inspect the text locally and will not open it.'; return; }
  const extracted = raw.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/i)?.[0] || raw;
  const candidate = extracted.replace(/[),.;!?]+$/, '');
  let parsed;
  try { parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`); } catch { urlResult.innerHTML = '<strong class="url-danger">Unable to parse this as a normal web address.</strong><span>Paste the complete address, for example <b>https://example.com</b>.</span>'; return; }
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
inspectUrlBtn?.addEventListener('click', inspectUrl);
urlInput?.addEventListener('keydown', event => { if (event.key === 'Enter') inspectUrl(); });
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
