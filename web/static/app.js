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
  const rows = [['Precision', metrics.precision || 0], ['Recall', metrics.recall || 0], ['F1', metrics.f1 || 0]];
  root.innerHTML = `<div class="challenge-copy"><span class="chart-kicker">Separate robustness check</span><h2>Broader challenge set</h2><p>${escapeHtml(evaluation.test_rows)} author-created messages · ${escapeHtml(evaluation.class_distribution?.phishing || 0)} scam · ${escapeHtml(evaluation.class_distribution?.legitimate || 0)} legitimate</p><small>This set was not used for training. It is broader than the held-out set, but remains hand-authored and is not representative of real-world prevalence.</small></div><div class="challenge-bar-chart" role="img" aria-label="Challenge set performance: precision ${Math.round((metrics.precision || 0) * 100)} percent, recall ${Math.round((metrics.recall || 0) * 100)} percent, F1 ${Math.round((metrics.f1 || 0) * 100)} percent"><div class="percentage-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>${rows.map(([label, value]) => `<div class="percentage-bar-row"><b>${label}</b><div class="percentage-track"><span class="percentage-fill" style="width:${Math.round(value * 100)}%"></span></div><strong>${Math.round(value * 100)}%</strong></div>`).join('')}</div><div class="challenge-error-summary"><span><b>${matrix.false_positive || 0}</b><small>false alarms</small></span><span><b>${matrix.false_negative || 0}</b><small>missed scams</small></span></div><div class="challenge-failures"><strong>Observed failure cases</strong>${failures.map(item => `<p><b>${escapeHtml(item.scenario)}</b> — ${escapeHtml(item.summary)}</p>`).join('')}</div><details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Broader challenge-set performance</caption><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><td>${Math.round(value * 100)}%</td></tr>`).join('')}<tr><th>False alarms</th><td>${matrix.false_positive || 0}</td></tr><tr><th>Missed scams</th><td>${matrix.false_negative || 0}</td></tr></tbody></table></details>`;
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
  visualResult.classList.add('hidden');
  document.getElementById('ocrStatus').textContent = 'Analysing the current extracted text. Any previous image result has been cleared.';
  try {
    const response = await fetch('/api/analyse', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: extractedText}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to analyse the extracted evidence.');
    if (requestId !== visualAnalysisRequestId || extractedText !== document.getElementById('ocrText').value.trim()) return;
    const reasons = data.reasons.map(reason => `<li><span>✓</span>${escapeHtml(reason)}</li>`).join('');
    visualResult.innerHTML = `<div class="visual-result-head"><div><span class="eyebrow">Image evidence result</span><h3>${escapeHtml(data.label)}</h3><span class="band">${escapeHtml(data.band)}</span></div></div><h4>Why it was flagged</h4><ul>${reasons}</ul><h4>Safer next step</h4><p class="visual-action">${escapeHtml(data.action)}</p><small class="visual-boundary">${escapeHtml(data.score_meaning || 'This result is based on visible text from the selected image and is not proof of fraud.')}</small>`;
    visualResult.classList.remove('hidden');
  } catch (err) {
    visualResult.classList.add('hidden');
    document.getElementById('ocrStatus').textContent = `${err.message} No result is being shown for this image.`;
  }
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
  const metrics = evaluation.metrics || {};
  const classes = evaluation.class_distribution || {};
  const errors = (metrics.false_positives || 0) + (metrics.missed_scams || 0);
  root.innerHTML = `<div class="evaluation-summary-stats"><span><b>${escapeHtml(evaluation.test_rows)}</b><small>evaluated</small></span><span><b>${escapeHtml(classes.phishing || 0)}</b><small>scams</small></span><span><b>${escapeHtml(classes.legitimate || 0)}</b><small>legitimate</small></span><span><b>${errors}</b><small>errors in this split</small></span></div>`;
  const dateNode = document.getElementById('dashboardEvaluationDate');
  const modelNode = document.getElementById('dashboardModelVersion');
  const datasetNode = document.getElementById('dashboardDatasetVersion');
  if (dateNode) {
    const parsed = new Date(`${evaluation.evaluation_date}T00:00:00Z`);
    dateNode.textContent = Number.isNaN(parsed.getTime()) ? evaluation.evaluation_date : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(parsed);
  }
  if (modelNode) modelNode.textContent = evaluation.model_version || 'Not recorded';
  if (datasetNode) datasetNode.textContent = evaluation.dataset_version || 'Not recorded';
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
      scenarioChart.setAttribute('aria-label', records.map(record => `${record.scenario}: ${Math.round((record.risk_score || 0) * 100)} percent, ${record.label === 'phishing' ? 'scam example' : 'legitimate example'}`).join('; '));
      scenarioChart.className = 'scenario-score-chart';
      scenarioChart.innerHTML = `<div class="scenario-score-legend"><span><i class="legend-swatch legitimate"></i>Legitimate example</span><span><i class="legend-swatch scam"></i>Scam example</span><span><i class="legend-threshold"></i>Decision threshold (35%)</span></div><div class="scenario-score-axis"><span></span><span></span><div><i>0%</i><i class="threshold-tick">35%</i><i>50%</i><i>75%</i><i>100%</i></div><span></span></div>${records.map(record => {
        const score = Math.round((record.risk_score || 0) * 100);
        const actualScam = record.label === 'phishing';
        const predictedScam = record.prediction === 1;
        const correct = actualScam === predictedScam;
        const tone = correct ? (actualScam ? 'scam' : 'legitimate') : (actualScam ? 'missed' : 'false-alarm');
        return `<div class="scenario-score-row"><b>${escapeHtml(record.scenario)}</b><small>${actualScam ? 'Scam example' : 'Legitimate example'}</small><div class="scenario-score-track"><span class="scenario-score-fill ${tone}" style="width:${score}%"></span><i class="scenario-threshold" aria-hidden="true"></i></div><strong>${score}%</strong></div>`;
      }).join('')}<div class="chart-axis-title">Model screening score (%) · not a probability</div>`;
      if (scenarioTable) scenarioTable.innerHTML = `<details class="chart-data-table"><summary>View accessible data table</summary><table><caption>Case-level screening scores</caption><thead><tr><th>Scenario</th><th>Actual class</th><th>Prediction</th><th>Score</th></tr></thead><tbody>${records.map(record => `<tr><th>${escapeHtml(record.scenario)}</th><td>${record.label === 'phishing' ? 'Scam' : 'Legitimate'}</td><td>${record.prediction === 1 ? 'Scam' : 'Legitimate'}</td><td>${Math.round((record.risk_score || 0) * 100)}%</td></tr>`).join('')}</tbody></table></details>`;
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
    const response = await fetch('/api/analyse', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: submittedText}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to analyse the message.');
    if (requestId !== analysisRequestId || submittedText !== message.value.trim()) return;
    renderResult(data);
  } catch (err) {
    if (requestId === analysisRequestId) {
      errorBox.textContent = err.message;
      resultPanel.className = 'result-panel panel empty';
      resultPanel.innerHTML = '<div class="result-placeholder"><div class="shield">!</div><h2>Analysis did not complete</h2><p>No result is being shown for this message. Review the error and try again.</p></div>';
    }
  } finally {
    resultPanel.removeAttribute('aria-busy');
    analyseBtn.disabled = false;
    analyseBtn.innerHTML = 'Analyse message <span aria-hidden="true">→</span>';
  }
});

function renderResult(data) {
  resultPanel.className = 'result-panel panel';
  const evidence = data.evidence || [];
  const reasons = data.reasons.map((reason, index) => {
    const item = evidence[index];
    const phrase = item?.phrase || '';
    const control = phrase && !phrase.startsWith('No specific') ? `<button type="button" class="reason-evidence" data-evidence-phrase="${escapeHtml(phrase)}" title="Highlight this phrase in the submitted message">View supporting text</button>` : '<small class="no-evidence">No exact excerpt available.</small>';
    return `<div class="reason"><i>✓</i><span>${escapeHtml(reason)}${control}</span></div>`;
  }).join('');
  const reasonHeading = data.label === 'Few warning signs detected' ? 'What the analysis found' : 'Signals requiring attention';
  const guided = guidedVerification(data);
  resultPanel.innerHTML = `<div class="result-head"><div><div class="result-label">${escapeHtml(data.label)}</div><span class="band">${escapeHtml(data.band)}</span></div></div><div class="result-section"><h3>${reasonHeading}</h3>${reasons}</div><div class="result-section"><h3>Safer next step</h3><div class="action">${escapeHtml(data.action)}</div></div>${guided}<div class="feedback-box"><strong>Help improve the research</strong><span>Was this explanation useful?</span><div><button type="button" data-feedback="helpful">Yes, helpful</button><button type="button" data-feedback="unclear">Needs improvement</button></div><small id="feedbackStatus" aria-live="polite"></small></div><p class="result-disclaimer">${escapeHtml(data.score_meaning || 'This is decision support, not proof that a message is fraudulent.')}</p>`;
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
  const messages = {yes:'Recorded as user-provided context: yes.', no:'Recorded as user-provided context: no.', unsure:'Recorded as user-provided context: not sure.'};
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
let motionPausedByUser = false;
function updateMotionControl() {
  const systemPaused = reducedMotion.matches;
  document.body.classList.toggle('motion-paused', motionPausedByUser || systemPaused);
  motionToggle.disabled = systemPaused;
  motionToggle.setAttribute('aria-pressed', String(motionPausedByUser || systemPaused));
  motionToggle.textContent = systemPaused ? 'Motion off' : motionPausedByUser ? 'Resume motion' : 'Pause motion';
  motionToggle.setAttribute('aria-label', systemPaused ? 'Background motion off due to system settings' : motionPausedByUser ? 'Resume animated backgrounds' : 'Pause animated backgrounds');
}
motionToggle?.addEventListener('click', () => { motionPausedByUser = !motionPausedByUser; updateMotionControl(); });
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
