// 图片压缩工具：全部在浏览器本地完成，不上传任何数据
const input = document.getElementById('image-input');
const dropZone = document.getElementById('drop-zone');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const formatSelect = document.getElementById('format');
const maxWidthSelect = document.getElementById('max-width');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const summaryText = document.getElementById('summary-text');

// 每个条目：{ file, blob, url, li }
let items = [];

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function outputType(file) {
  const choice = formatSelect.value;
  if (choice !== 'keep') return choice;
  return EXT[file.type] ? file.type : 'image/jpeg';
}

function outputName(file, type) {
  const base = file.name.replace(/\.[^.]+$/, '');
  return `${base}-compressed.${EXT[type]}`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')); };
    img.src = url;
  });
}

async function compress(file) {
  const img = await loadImage(file);
  const maxW = Number(maxWidthSelect.value);
  const scale = maxW && img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const type = outputType(file);
  if (type === 'image/jpeg') {
    // JPG 不支持透明，先铺白底，避免透明区域变黑
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, type, Number(qualityInput.value) / 100)
  );
  if (!blob) throw new Error('浏览器不支持这种输出格式');
  // 没缩小尺寸、压完反而更大（例如本来就很小的 PNG）：直接保留原图
  if (scale === 1 && blob.size >= file.size && EXT[file.type]) {
    return { blob: file, type: file.type, w, h, kept: true };
  }
  // 浏览器不支持 WebP 编码时会退回 PNG，按实际类型命名
  return { blob, type: blob.type || type, w, h };
}

function renderItem(item) {
  const li = item.li || document.createElement('li');
  item.li = li;
  li.className = 'item';
  li.innerHTML = '';

  const thumb = document.createElement('img');
  thumb.alt = '';
  thumb.src = item.url || '';
  li.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.file.name;
  const meta = document.createElement('div');
  meta.className = 'meta';
  info.append(name, meta);
  li.appendChild(info);

  if (item.error) {
    meta.textContent = item.error;
    meta.classList.add('error');
  } else if (!item.blob) {
    meta.textContent = '压缩中…';
  } else {
    const saved = 1 - item.blob.size / item.file.size;
    const pct = Math.round(saved * 100);
    meta.innerHTML = '';
    const sizes = document.createElement('span');
    sizes.textContent = `${formatBytes(item.file.size)} → ${formatBytes(item.blob.size)} · ${item.w}×${item.h}`;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (pct > 0 ? 'good' : 'bad');
    badge.textContent = item.kept ? '已经很小，保留原图' : pct > 0 ? `减少 ${pct}%` : '没有变小';
    meta.append(sizes, badge);

    const btn = document.createElement('button');
    btn.className = 'primary small';
    btn.textContent = '下载';
    btn.addEventListener('click', () => download(item));
    li.appendChild(btn);
  }
  if (!li.parentNode) results.appendChild(li);
}

function updateSummary() {
  const done = items.filter((i) => i.blob);
  summary.hidden = items.length === 0;
  if (!done.length) { summaryText.textContent = `${items.length} 张图片处理中…`; return; }
  const before = done.reduce((s, i) => s + i.file.size, 0);
  const after = done.reduce((s, i) => s + i.blob.size, 0);
  const pct = Math.round((1 - after / before) * 100);
  summaryText.textContent = `${done.length} 张，共 ${formatBytes(before)} → ${formatBytes(after)}（${pct >= 0 ? '减少' : '增加'} ${Math.abs(pct)}%）`;
}

async function process(item) {
  item.blob = null;
  item.error = null;
  renderItem(item);
  try {
    const r = await compress(item.file);
    if (item.url) URL.revokeObjectURL(item.url);
    item.blob = r.blob;
    item.type = r.type;
    item.w = r.w;
    item.h = r.h;
    item.kept = !!r.kept;
    item.url = URL.createObjectURL(r.blob);
  } catch (e) {
    item.error = e.message;
  }
  renderItem(item);
  updateSummary();
}

function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    const item = { file };
    items.push(item);
    process(item);
  }
  updateSummary();
}

function download(item) {
  const a = document.createElement('a');
  a.href = item.url;
  a.download = outputName(item.file, item.type);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// 设置变化时，重新压缩已有图片
let timer;
function reprocessAll() {
  clearTimeout(timer);
  timer = setTimeout(() => items.forEach(process), 250);
}

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
  reprocessAll();
});
formatSelect.addEventListener('change', reprocessAll);
maxWidthSelect.addEventListener('change', reprocessAll);

input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

['dragenter', 'dragover'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('over'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('over'); })
);
dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

// 也支持直接粘贴截图
window.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) addFiles(files);
});

document.getElementById('download-all').addEventListener('click', () => {
  items.filter((i) => i.blob).forEach((item, n) => setTimeout(() => download(item), n * 300));
});

document.getElementById('clear-all').addEventListener('click', () => {
  items.forEach((i) => i.url && URL.revokeObjectURL(i.url));
  items = [];
  results.innerHTML = '';
  updateSummary();
});
