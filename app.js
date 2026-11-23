(function () {
  const { fitWithin, clamp01, grow, crop } = RecordCore;
  const store = RecordStore;
  const CONFIG = globalThis.RECORD_CONFIG || {};
  const PHOTO_MAX = 1000;
  const PHOTO_LIMIT = 590000; // schema.sql의 사진 글자 수 제한보다 조금 작게
  const PAD_ON_PAPER = 0.2; // 그리는 칸 전체 폭 = 종이 폭의 20%
  const PAD_MARGIN = 8; // 그림 잘라낼 때 둘레 여백(px)
  const COLORS = ['#161616', '#e8412c', '#2f5bff', '#1f9d55', '#f5b800', '#ff6fae'];
  const $ = (id) => document.getElementById(id);

  let entries = [];
  const ids = new Set();

  // 지금 쓰고 있는 기록 하나
  let spot = null; // { x, y } 0~1, 종이 기준
  let mode = 'text'; // text | draw | photo
  let photo = null; // 올릴 그림·사진 data URL
  let photoW = 0.14; // 그림·사진 폭 (판 폭 대비)
  let sizeTouched = false; // 크기 막대를 직접 움직였는지 (안 움직였으면 그림은 그린 크기 그대로)
  let drawn = null; // 그린 범위 { x0, y0, x1, y1 } (칸 기준 px)
  let drawing = false;
  let color = COLORS[0];

  const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  $('about').textContent = CONFIG.about || '';

  // 반마다 판이 따로: ?r=a → A반, ?r=b → B반 (반이 없으면 A반).
  // 참여자에겐 반 표시가 안 보이고, 「기록 중!」을 누르면 반 전환 메뉴가 열린다 (주최자·교수님용)
  const ROOMS = { a: 'A반', b: 'B반' };
  const asked = new URLSearchParams(location.search).get('r');
  const room = Object.hasOwn(ROOMS, asked) ? asked : 'a';
  for (const [key, name] of Object.entries(ROOMS)) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `?r=${key}`;
    a.textContent = name;
    if (key === room) a.setAttribute('aria-current', 'page');
    // 반을 바꿀 땐 매번 새 주소로 → 브라우저가 저장해 둔 옛 화면을 띄우지 않게
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      location.href = `?r=${key}&t=${Date.now()}`;
    });
    li.append(a);
    $('rooms').append(li);
  }
  // 화면 오른쪽 아래: 이 반 판으로 들어오는 QR (띄워 놓은 화면에서 바로 찍게)
  $('qr').src = `qr-${room}.svg`;
  $('qr').hidden = false;

  $('title').addEventListener('click', () => {
    const open = $('rooms').hidden;
    $('rooms').hidden = !open;
    $('title').setAttribute('aria-expanded', String(open));
  });

  // ── 종이 ──────────────────────────────────────────

  function addEntry(e) {
    if (ids.has(e.id)) return;
    ids.add(e.id);
    entries = [...entries, e];
    render();
  }

  function place(el, x, y) {
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
  }

  function noteNode(e) {
    const el = document.createElement('figure');
    el.className = 'note';
    place(el, e.x, e.y);
    if (typeof e.photo === 'string' && e.photo.startsWith('data:image/')) {
      const img = new Image();
      img.src = e.photo;
      img.alt = e.text || '올라온 사진';
      if (e.w) img.style.width = `${e.w * 100}cqw`;
      el.append(img);
    }
    if (e.text) {
      const cap = document.createElement('figcaption');
      cap.textContent = e.text;
      el.append(cap);
    }
    return el;
  }

  // 아직 안 남긴 그림·사진: 판 위에서 끌어 옮기고 크기를 바꾼다
  const draft = document.createElement('figure');
  draft.className = 'note draft';
  const draftImg = new Image();
  draftImg.alt = '올릴 사진';
  draft.append(draftImg);

  function syncDraft() {
    place(draft, spot.x, spot.y);
    draftImg.style.width = `${photoW * 100}cqw`;
  }

  function render() {
    // 모두 한 장에 겹쳐 쌓인다 (나중 것이 위)
    const notes = entries.filter((e) => e.text || e.photo);
    $('paper').replaceChildren($('intro'), ...notes.map(noteNode));
    if (!spot) return;
    if (mode !== 'text' && photo) {
      syncDraft();
      $('paper').append(draft);
      return;
    }
    const dot = document.createElement('span');
    dot.className = 'spot';
    place(dot, spot.x, spot.y);
    $('paper').append(dot);
  }

  function paperPoint(ev) {
    const r = $('paper').getBoundingClientRect();
    return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) };
  }

  $('paper').addEventListener('click', (ev) => {
    if ($('intro').contains(ev.target) || draft.contains(ev.target)) return;
    spot = paperPoint(ev); // 상자가 열려 있으면 자리만 옮긴다
    if ($('box').hidden) openBox();
    else render();
  });

  let dragging = false;
  draft.addEventListener('pointerdown', (ev) => {
    draft.setPointerCapture(ev.pointerId);
    dragging = true;
  });
  draft.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    spot = paperPoint(ev);
    syncDraft();
  });
  const stopDrag = () => { dragging = false; };
  draft.addEventListener('pointerup', stopDrag);
  draft.addEventListener('pointercancel', stopDrag);

  $('size').addEventListener('input', () => {
    photoW = Number($('size').value) / 100;
    sizeTouched = true;
    if (spot) syncDraft();
  });

  // ── 아래 상자 ─────────────────────────────────────

  function setMode(next) {
    mode = next;
    photo = mode === 'photo' ? photo : null;
    if (mode !== 'draw') drawn = null;
    sizeTouched = false;
    $('text').hidden = mode !== 'text';
    $('pad').hidden = mode !== 'draw';
    $('sizer').hidden = mode === 'text' || !photo;
    document.querySelectorAll('.modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    if (mode === 'draw') resetPad();
    if (mode === 'text') $('text').focus();
    $('msg').textContent = '';
    updateSend();
    render();
  }

  function openBox() {
    $('box').hidden = false;
    setMode('text');
  }

  function closeBox() {
    spot = null;
    photo = null;
    drawn = null;
    drawing = false;
    dragging = false;
    $('box').reset();
    photoW = Number($('size').value) / 100; // 크기 막대도 처음 값으로
    sizeTouched = false;
    $('box').hidden = true;
    render();
  }

  function updateSend() {
    const ready = { text: !!$('text').value.trim(), draw: !!photo, photo: !!photo };
    $('send').disabled = !ready[mode];
  }

  document.querySelectorAll('.modes button[data-mode]').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });
  $('text').addEventListener('input', updateSend);
  $('cancel').addEventListener('click', closeBox);

  // ── 그리기 ────────────────────────────────────────

  const pad = $('draw');
  const ctx = pad.getContext('2d');

  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--c', c);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c);
    b.setAttribute('aria-checked', String(c === color));
    b.addEventListener('click', () => {
      color = c;
      $('colors').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    $('colors').append(b);
  });

  function resetPad() {
    const r = pad.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    pad.width = Math.round(r.width * dpr);
    pad.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(ctx, { lineWidth: 3, lineCap: 'round', lineJoin: 'round' });
    drawn = null;
    updateSend();
  }

  function padPoint(ev) {
    const r = pad.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  pad.addEventListener('pointerdown', (ev) => {
    pad.setPointerCapture(ev.pointerId);
    drawing = true;
    const [x, y] = padPoint(ev);
    ctx.strokeStyle = color;
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
  // 한 획이 끝날 때마다 그림을 판 위에 미리 놓는다 → 끌어 옮기고 크기 조절
  function finishStroke() {
    if (!drawing) return;
    drawing = false;
    if (!drawn) return;
    try {
      const out = exportDrawing();
      photo = out.photo;
      draftImg.src = photo;
      if (!sizeTouched) {
        photoW = out.w;
        $('size').value = String(Math.round(out.w * 100));
      }
      $('sizer').hidden = false;
      $('msg').textContent = '';
    } catch (err) {
      $('msg').textContent = err.message;
    }
    updateSend();
    render();
  }
  pad.addEventListener('pointerup', finishStroke);
  pad.addEventListener('pointercancel', finishStroke);
  $('clear').addEventListener('click', () => {
    resetPad();
    photo = null;
    $('sizer').hidden = true;
    render();
  });

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

  // ── 사진 ──────────────────────────────────────────

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

  async function onPhotoPicked(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      photo = await shrink(file);
      draftImg.src = photo;
      setMode('photo');
    } catch (err) {
      photo = null;
      setMode('photo');
      $('msg').textContent = err.message === '사진이 너무 커요' ? err.message : '이 사진은 열 수 없어요. 다른 사진을 골라 주세요';
    }
  }
  $('file').addEventListener('change', () => onPhotoPicked($('file')));
  $('camera').addEventListener('change', () => onPhotoPicked($('camera')));

  // ── 남기기 ────────────────────────────────────────

  function content() {
    if (mode !== 'text') return { text: null, photo, w: photoW };
    return { text: $('text').value.trim(), photo: null, w: null };
  }

  $('box').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!spot || $('send').disabled) return;
    $('send').disabled = true;
    try {
      const row = await store.add({ id: newId(), room, x: spot.x, y: spot.y, ...content() });
      closeBox();
      addEntry(row);
    } catch (err) {
      console.error(err);
      $('msg').textContent = err.message === '그림이 너무 커요' ? err.message : '올리지 못했어요. 잠시 뒤 다시 눌러 주세요';
      updateSend();
    }
  });

  store.subscribe(room, addEntry);
  store.list(room)
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
