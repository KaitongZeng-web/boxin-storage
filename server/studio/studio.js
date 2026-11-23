const el = id => document.getElementById(id);
let photo, sourceUrl, stickerUrl, generation = 0;
let vision = false;

function message(value) { el('status').textContent = value; }
function resetSticker() {
  URL.revokeObjectURL(stickerUrl);
  stickerUrl = null;
  for (const id of ['output', 'mini']) el(id).hidden = true;
  el('empty').hidden = false;
  el('save').disabled = el('identify').disabled = true;
}
async function cut(point) {
  const version = ++generation;
  resetSticker();
  message('正在提取物品轮廓…');
  const data = new FormData();
  data.append('image', photo);
  if (point) {
    data.append('x', point.x);
    data.append('y', point.y);
  }
  try {
    const response = await fetch('/api/v1/cutout', {method:'POST', body:data});
    if (!response.ok) throw Error((await response.json()).detail);
    const blob = await response.blob();
    if (version !== generation) return;
    stickerUrl = URL.createObjectURL(blob);
    for (const id of ['output', 'mini']) {
      el(id).src = stickerUrl;
      el(id).hidden = false;
    }
    el('empty').hidden = true;
    el('save').disabled = false;
    el('identify').disabled = !vision;
    message(vision ? '贴纸已就绪，可识别或编辑名称。' : '贴纸已就绪，可手动命名。自动命名需要配置视觉服务。');
  } catch (error) { if (version === generation) message(error.message); }
}
function load(file, name) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) {
    message('请选择 10 MB 以内的 JPG、PNG 或 WebP 照片。'); return;
  }
  photo = file;
  URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  el('source').src = sourceUrl;
  el('name').value = name;
  cut();
}
el('choose').onclick = () => el('file').click();
el('file').onchange = event => {
  load(event.target.files[0], '我的物品');
  event.target.value = '';
};
el('drop').ondragover = event => event.preventDefault();
el('drop').ondrop = event => { event.preventDefault(); load(event.dataTransfer.files[0], '我的物品'); };
el('source').onclick = event => {
  if (!photo) return;
  const rect = event.target.getBoundingClientRect();
  el('name').value = '我的物品';
  cut({x:(event.clientX-rect.left)/rect.width, y:(event.clientY-rect.top)/rect.height});
};
el('save').onclick = () => {
  const link = document.createElement('a');
  link.href = stickerUrl;
  link.download = (el('name').value.trim() || '物品贴纸') + '.png';
  link.click();
};
el('identify').onclick = async () => {
  const version = generation;
  const originalName = el('name').value;
  el('identify').disabled = true;
  message('正在识别贴纸中的物品…');
  try {
    const data = new FormData();
    data.append('image', await (await fetch(stickerUrl)).blob(), 'sticker.png');
    const response = await fetch('/api/v1/recognize', {method:'POST', body:data});
    const result = await response.json();
    if (version !== generation) return;
    if (!response.ok || result.mode !== 'vision' || !result.items?.length) throw Error('未识别到名称，可手动填写。');
    if (el('name').value === originalName) el('name').value = result.items[0].name;
    message('识别完成，可编辑物品名称。');
  } catch { if (version === generation) message('名称识别失败，可手动填写。'); }
  finally { if (version === generation) el('identify').disabled = false; }
};
async function start() {
  try {
    vision = (await (await fetch('/health')).json()).mode === 'vision';
    const sample = await (await fetch('coffee.png')).blob();
    if (!photo) load(sample, '咖啡杯');
  } catch { if (!photo) message('请先选择一张照片。'); }
}
start();
