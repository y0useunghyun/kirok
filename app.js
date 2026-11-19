(function () {
  const { fitWithin, clamp01, grow, crop } = RecordCore;
  const store = RecordStore;
  const CONFIG = globalThis.RECORD_CONFIG || {};
  const PHOTO_MAX = 1000;
  const PHOTO_LIMIT = 590000; // schema.sql의 사진 글자 수 제한보다 조금 작게
  const PAD_ON_PAPER = 0.2; // 그리는 칸 전체 폭 = 종이 폭의 20%
  const PAD_MARGIN = 8; // 그림 잘라낼 때 둘레 여백(px)
  const $ = (id) => document.getElementById(id);

  let entries = [];
  let spot = null; // { x, y } 0~1
  let photo = null; // data URL
  let drawn = null; // 그린 범위 { x0, y0, x1, y1 } (칸 기준 px)
  let drawing = false;
  const ids = new Set();

  const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  $('about').textContent = CONFIG.about || '';

  function addEntry(e) {
    if (ids.has(e.id)) return;
    ids.add(e.id);
    entries = [...entries, e];
    render();
  }

  function noteNode(e) {
    const el = document.createElement('figure');
    el.className = 'note';
    el.style.left = `${e.x * 100}%`;
    el.style.top = `${e.y * 100}%`;
    if (typeof e.photo === 'string' && e.photo.startsWith('data:image/')) {
      const img = new Image();
      img.src = e.photo;
      img.alt = e.text || '올라온 사진';
      if (e.w) img.style.width = `${e.w * 100}cqw`; // 그림은 그린 크기 그대로
      el.append(img);
    }
    if (e.text) {
      const cap = document.createElement('figcaption');
      cap.textContent = e.text;
      el.append(cap);
    }
    return el;
  }

  function render() {
    // 모두 한 장에 겹쳐 쌓인다 (나중 것이 위)
    const notes = entries.filter((e) => e.text || e.photo);
    $('paper').replaceChildren($('intro'), ...notes.map(noteNode));
    if (spot) {
      const dot = document.createElement('span');
      dot.className = 'spot';
      dot.style.left = `${spot.x * 100}%`;
      dot.style.top = `${spot.y * 100}%`;
      $('paper').append(dot);
    }
  }

  function openBox(x, y) {
    spot = { x, y };
    $('box').hidden = false;
    $('msg').textContent = '';
    render();
    $('text').focus();
  }

  function closeBox() {
    spot = null;
    photo = null;
    $('box').reset();
    $('preview').hidden = true;
    closePad();
    $('box').hidden = true;
    updateSend();
    render();
  }

  function updateSend() {
    $('send').disabled = !$('text').value.trim() && !photo && !drawn;
  }

  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, PHOTO_MAX);
      const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      for (const q of [0.8, 0.6, 0.4]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= PHOTO_LIMIT) return data;
      }
      throw new Error('사진이 너무 커요');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  $('paper').addEventListener('click', (ev) => {
    if ($('intro').contains(ev.target)) return;
    const r = $('paper').getBoundingClientRect();
    openBox(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
  });

  $('text').addEventListener('input', updateSend);
  $('cancel').addEventListener('click', closeBox);

  // 그리기 칸
  const pad = $('draw');
  const ctx = pad.getContext('2d');

  function openPad() {
    photo = null;
    $('preview').hidden = true;
    $('pad').hidden = false;
    $('drawBtn').classList.add('on');
    const r = pad.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    pad.width = Math.round(r.width * dpr);
    pad.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(ctx, { lineWidth: 3, lineCap: 'round', lineJoin: 'round', strokeStyle: '#161616' });
    drawn = null;
    updateSend();
  }

  function closePad() {
    $('pad').hidden = true;
    $('drawBtn').classList.remove('on');
    drawn = null;
    drawing = false;
  }

  function padPoint(ev) {
    const r = pad.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  pad.addEventListener('pointerdown', (ev) => {
    pad.setPointerCapture(ev.pointerId);
    drawing = true;
    const [x, y] = padPoint(ev);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y); // 점 하나만 찍어도 남게
    ctx.stroke();
    drawn = grow(drawn, x, y);
    updateSend();
  });
  pad.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const [x, y] = padPoint(ev);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawn = grow(drawn, x, y);
  });
  const stopDrawing = () => { drawing = false; };
  pad.addEventListener('pointerup', stopDrawing);
  pad.addEventListener('pointercancel', stopDrawing);

  $('clear').addEventListener('click', openPad);
  $('drawBtn').addEventListener('click', () => ($('pad').hidden ? openPad() : closePad(), updateSend()));

  // 그린 부분만 잘라 투명 PNG로
  function exportDrawing() {
    const r = pad.getBoundingClientRect();
    const dpr = pad.width / r.width;
    const c = crop(drawn, PAD_MARGIN, r.width, r.height);
    const size = fitWithin(c.w * dpr, c.h * dpr, PHOTO_MAX);
    const out = Object.assign(document.createElement('canvas'), { width: size.w, height: size.h });
    out.getContext('2d').drawImage(pad, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr, 0, 0, size.w, size.h);
    const data = out.toDataURL('image/png');
    if (data.length > PHOTO_LIMIT) throw new Error('그림이 너무 커요');
    return { photo: data, w: (c.w / r.width) * PAD_ON_PAPER };
  }

  async function onPhotoPicked(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    closePad();
    $('msg').textContent = '';
    try {
      photo = await shrink(file);
      $('preview').src = photo;
      $('preview').hidden = false;
    } catch (err) {
      photo = null;
      $('msg').textContent = err.message === '사진이 너무 커요' ? err.message : '이 사진은 열 수 없어요. 다른 사진을 골라 주세요';
    }
    updateSend();
  }
  $('file').addEventListener('change', () => onPhotoPicked($('file')));
  $('camera').addEventListener('change', () => onPhotoPicked($('camera')));

  $('box').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!spot || $('send').disabled) return;
    const text = $('text').value.trim();
    $('send').disabled = true;
    try {
      const image = drawn ? exportDrawing() : { photo, w: null };
      const row = await store.add({
        id: newId(),
        x: spot.x, y: spot.y, text: text || null, ...image,
      });
      closeBox();
      addEntry(row);
    } catch (err) {
      console.error(err);
      $('msg').textContent = err.message === '그림이 너무 커요' ? err.message : '올리지 못했어요. 잠시 뒤 다시 눌러 주세요';
      updateSend();
    }
  });


  store.subscribe(addEntry);
  store.list()
    .then((rows) => {
      const fresh = rows.filter((e) => !ids.has(e.id));
      fresh.forEach((e) => ids.add(e.id));
      entries = [...entries, ...fresh];
      render();
    })
    .catch((err) => {
      console.error(err);
      $('hint').textContent = '기록을 불러오지 못했어요. 새로고침해 주세요';
    });
  render();
})();
