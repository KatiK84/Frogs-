
(() => {
  const NS = 'frogsPWA.';
  const KEY_POOL = NS + 'pool';
  const KEY_TODAY = NS + 'today';
  const KEY_REWARD_PREFIX = NS + 'reward.'; // + YYYY-MM
  const KEY_EXPORT_HINT = NS + 'exportHint';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const tabs = $$('.tab');
  const viewToday = $('#viewToday');
  const viewList = $('#viewList');
  const viewReward = $('#viewReward');
  const statDone = $('#statDone');
  const statPicked = $('#statPicked');

  const todayCards = $('#todayCards');
  const listCards = $('#listCards');

  const backdrop = $('#backdrop');
  const pickModal = $('#pickModal');
  const pickList = $('#pickList');
  const pickCountPill = $('#pickCountPill');
  const pickBtn = $('#pickBtn');
  const clearTodayBtn = $('#clearTodayBtn');
  const closePick = $('#closePick');
  const cancelPick = $('#cancelPick');
  const savePick = $('#savePick');

  const editModal = $('#editModal');
  const editTitle = $('#editTitle');
  const fTitle = $('#fTitle');
  const fDeadline = $('#fDeadline');
  const fEst = $('#fEst');
  const closeEdit = $('#closeEdit');
  const cancelEdit = $('#cancelEdit');
  const saveEdit = $('#saveEdit');
  const deleteBtn = $('#deleteBtn');
  const addBtn = $('#addBtn');

  const rewardInput = $('#rewardInput');
  const rewardBanner = $('#rewardBanner');
  const monthKeyEl = $('#monthKey');
  const monthProgress = $('#monthProgress');
  const monthBar = $('#monthBar');
  const progressHint = $('#progressHint');

  const exportBtn = $('#exportBtn');
  const importBtn = $('#importBtn');
  const importFile = $('#importFile');

  const frogOverlay = $('#frogOverlay');
  const frogSprite = $('#frogSprite');

  // ===== storage helpers =====
  const load = (k, defVal) => {
    try {
      const v = localStorage.getItem(k);
      if (v === null) return defVal;
      return JSON.parse(v);
    } catch {
      return defVal;
    }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const todayISO = () => new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const monthKey = () => new Date().toISOString().slice(0,7); // YYYY-MM

  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

  // Frog item: {id, title, deadline?, estMin?, createdAt, doneAt? (YYYY-MM-DD), doneMonth? (YYYY-MM)}
  let pool = load(KEY_POOL, []);
  let todayIds = load(KEY_TODAY, []);
  if (!Array.isArray(todayIds)) todayIds = [];

  // Seed if empty
  if (!pool.length) {
    pool = [
      { id: uid(), title: 'Вода', deadline: null, estMin: 25, createdAt: Date.now(), doneAt: null, doneMonth: null },
      { id: uid(), title: 'Прогулка', deadline: null, estMin: 15, createdAt: Date.now(), doneAt: null, doneMonth: null },
    ];
    save(KEY_POOL, pool);
  }

  // ===== tabs =====
  const renderTabs = (tab) => {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    viewToday.classList.toggle('hidden', tab !== 'today');
    viewList.classList.toggle('hidden', tab !== 'list');
    viewReward.classList.toggle('hidden', tab !== 'reward');
  };
  tabs.forEach(b => b.addEventListener('click', () => {
    renderTabs(b.dataset.tab);
    if (b.dataset.tab === 'today') renderToday();
    if (b.dataset.tab === 'list') renderList();
    if (b.dataset.tab === 'reward') renderReward();
  }));

  // ===== modal helpers =====
  const openModal = (modal) => {
    backdrop.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = (modal) => {
    modal.classList.add('hidden');
    if (pickModal.classList.contains('hidden') && editModal.classList.contains('hidden')) {
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };
  backdrop.addEventListener('click', () => {
    closeModal(pickModal);
    closeModal(editModal);
  });

  // ===== pick today =====
  const openPick = () => {
    // Build list of non-done frogs (still can pick done? let's hide done)
    const active = pool.filter(f => !f.doneAt);
    const picked = new Set(todayIds);
    pickList.innerHTML = active.length ? '' : `<div class="help" style="padding:14px 0">Пока нет лягушек. Добавь их во вкладке «Список».</div>`;
    active.forEach(f => {
      const item = document.createElement('div');
      item.className = 'pickItem';
      const checked = picked.has(f.id);
      item.innerHTML = `
        <input type="checkbox" data-id="${f.id}" ${checked ? 'checked' : ''}/>
        <div>
          <div class="pickTitle">${escapeHtml(f.title)}</div>
          <div class="pickMeta">
            ${f.estMin ? `⏱ Примерно: <b>${escapeHtml(String(f.estMin))} мин</b>` : ''}
            ${f.deadline ? ` &nbsp; 📅 Дедлайн: <b>${fmtDate(f.deadline)}</b>` : ''}
          </div>
        </div>
      `;
      pickList.appendChild(item);
    });

    const updatePickUI = () => {
      const checks = $$(`#pickList input[type="checkbox"]`);
      const chosen = checks.filter(c => c.checked);
      const n = chosen.length;
      if (pickCountPill) pickCountPill.textContent = `${n}/${LIMIT}`;
      // lock remaining checkboxes when limit reached
      checks.forEach(c => {
        c.disabled = (n >= LIMIT) && !c.checked;
      });
    };

    // enforce max 3 with a friendly toast
    pickList.onchange = (e) => {
      const t = e?.target;
      if (!(t && t.matches && t.matches('input[type="checkbox"]'))) {
        updatePickUI();
        return;
      }

      const checks = $$(`#pickList input[type="checkbox"]`);
      const chosen = checks.filter(c => c.checked);

      if (chosen.length > LIMIT) {
        // revert the checkbox that triggered the overflow
        t.checked = false;
        showToast(`Лимит ${LIMIT} лягушки. Сначала сними выбор с одной.`, 'warn');
      }

      updatePickUI();
    };

    updatePickUI();

    openModal(pickModal);
  };

  pickBtn.addEventListener('click', openPick);
  closePick.addEventListener('click', () => closeModal(pickModal));
  cancelPick.addEventListener('click', () => closeModal(pickModal));
  savePick.addEventListener('click', () => {
    const chosen = $$(`#pickList input[type="checkbox"]`).filter(c => c.checked).map(c => c.dataset.id);
    todayIds = chosen.slice(0,3);
    save(KEY_TODAY, todayIds);
    closeModal(pickModal);
    renderToday();
  });

  clearTodayBtn.addEventListener('click', () => {
    todayIds = [];
    save(KEY_TODAY, todayIds);
    renderToday();
  });

  // ===== add/edit =====
  let editingId = null;

  addBtn.addEventListener('click', () => openEdit(null));

  const openEdit = (id) => {
    editingId = id;
    const f = id ? pool.find(x => x.id === id) : null;
    editTitle.textContent = id ? 'Редактировать лягушку' : 'Добавить лягушку';
    fTitle.value = f?.title || '';
    fDeadline.value = f?.deadline || '';
    fEst.value = (f?.estMin ?? '') === 0 ? 0 : (f?.estMin ?? '');
    deleteBtn.classList.toggle('hidden', !id);
    openModal(editModal);
    setTimeout(()=>fTitle.focus(), 50);
  };

  closeEdit.addEventListener('click', () => closeModal(editModal));
  cancelEdit.addEventListener('click', () => closeModal(editModal));

  saveEdit.addEventListener('click', () => {
    const title = fTitle.value.trim();
    if (!title) {
      fTitle.focus();
      fTitle.style.borderColor = 'rgba(226,109,109,.8)';
      setTimeout(()=> fTitle.style.borderColor = '', 900);
      return;
    }
    const deadline = fDeadline.value ? fDeadline.value : null;
    const estMin = fEst.value ? Number(fEst.value) : null;

    if (editingId) {
      const idx = pool.findIndex(x => x.id === editingId);
      if (idx >= 0) {
        pool[idx] = { ...pool[idx], title, deadline, estMin };
      }
    } else {
      pool.unshift({ id: uid(), title, deadline, estMin, createdAt: Date.now(), doneAt: null, doneMonth: null });
    }
    save(KEY_POOL, pool);
    closeModal(editModal);
    renderList();
    renderToday();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    pool = pool.filter(x => x.id !== editingId);
    todayIds = todayIds.filter(id => id !== editingId);
    save(KEY_POOL, pool);
    save(KEY_TODAY, todayIds);
    closeModal(editModal);
    renderList();
    renderToday();
  });

  // ===== render list =====
  function renderList() {
    const active = pool.filter(f => !f.doneAt);
    const done = pool.filter(f => f.doneAt);
    listCards.innerHTML = '';

    const renderSection = (title, arr, doneSection=false) => {
      if (!arr.length) return;
      const sec = document.createElement('div');
      sec.className = 'card';
      sec.innerHTML = `<div class="cardTitle">${title}</div><div class="cardMeta">${doneSection ? 'Закрытые задачи (для истории).' : 'Задачи в общем списке.'}</div>`;
      listCards.appendChild(sec);

      arr.forEach(f => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="badgeRow">
            <div>
              <div class="cardTitle">${escapeHtml(f.title)}</div>
              <div class="cardMeta">
                ${f.estMin ? `⏱ Примерно: <b>${escapeHtml(String(f.estMin))} мин</b>` : '⏱ Примерно: —'}
                ${f.deadline ? ` &nbsp; 📅 Дедлайн: <b>${fmtDate(f.deadline)}</b>` : ' &nbsp; 📅 Дедлайн: —'}
              </div>
            </div>
            <div class="badge ${doneSection ? 'done':'work'}">${doneSection ? `Сделано ${fmtDate(f.doneAt)}` : 'В списке'}</div>
          </div>
          <div class="cardActions">
            ${doneSection ? '' : `<button class="btn primary" data-action="edit" data-id="${f.id}">Редактировать</button>`}
            ${doneSection ? '' : `<button class="btn" data-action="addToToday" data-id="${f.id}">В «Сегодня»</button>`}
            ${doneSection ? `<button class="btn" data-action="restore" data-id="${f.id}">Вернуть в список</button>` : ''}
          </div>
        `;
        listCards.appendChild(card);
      });
    };

    renderSection('Активные лягушки', active, false);
    renderSection('История', done, true);

    listCards.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const f = pool.find(x => x.id === id);
      if (!f) return;

      if (action === 'edit') openEdit(id);
      if (action === 'addToToday') {
        if (todayIds.includes(id)) return;
        if (todayIds.length >= 3) {
          toast('Лимит: 3 лягушки на сегодня');
          return;
        }
        todayIds.push(id);
        save(KEY_TODAY, todayIds);
        toast('Добавлено в «Сегодня»');
        renderToday();
      }
      if (action === 'restore') {
        f.doneAt = null;
        f.doneMonth = null;
        save(KEY_POOL, pool);
        renderList();
        renderReward();
      }
    };
  }

  // ===== render today =====
  function renderToday() {
    // Keep todayIds stable for the whole day.
    // We only remove ids that point to deleted frogs.
    // (Done frogs stay in todayIds so the counters don't go backwards.)
    const map = new Map(pool.map(f => [f.id, f]));
    todayIds = todayIds.filter(id => map.has(id));
    save(KEY_TODAY, todayIds);

    const frogsTodayAll = todayIds.map(id => map.get(id)).filter(Boolean);
    const pickedTotal = frogsTodayAll.length;
    const doneTotal = frogsTodayAll.filter(f => !!f.doneAt).length;

    // Show only not-done frogs as cards (done ones disappear from the list)
    const frogsToday = frogsTodayAll.filter(f => !f.doneAt);

    statPicked.textContent = `Выбрано: ${pickedTotal}/3`;

    todayCards.innerHTML = '';
    if (!frogsToday.length) {
      if (pickedTotal === 0) {
        todayCards.innerHTML = `
          <div class="card">
            <div class="cardTitle">Пока ничего не выбрано</div>
            <div class="cardMeta">Нажми «Выбрать из списка» и отметь 1–3 лягушки на сегодня.</div>
          </div>
        `;
      } else {
        todayCards.innerHTML = `
          <div class="card">
            <div class="cardTitle">Все лягушки на сегодня закрыты 🎉</div>
            <div class="cardMeta">Можешь выбрать новые из списка или нажать «Очистить сегодня».</div>
          </div>
        `;
      }
      statDone.textContent = `Сделано: ${doneTotal}/${pickedTotal}`;
      return;
    }

    statDone.textContent = `Сделано: ${doneTotal}/${pickedTotal}`;

    frogsToday.forEach(f => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="badgeRow">
          <div>
            <div class="cardTitle">${escapeHtml(f.title)}</div>
            <div class="cardMeta">
              ⏱ Примерно: <b>${escapeHtml(String(f.estMin || 0))} мин</b>
              &nbsp; 📅 Дедлайн: <b>${f.deadline ? fmtDate(f.deadline) : '—'}</b>
            </div>
          </div>
          <div class="badge work">В работе</div>
        </div>
        <div class="cardActions">
          <button class="btn primary" data-action="done" data-id="${f.id}">Сделано ✅</button>
          <button class="btn danger" data-action="removeFromToday" data-id="${f.id}">Убрать из «Сегодня»</button>
        </div>
      `;
      todayCards.appendChild(card);
    });

    todayCards.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const f = pool.find(x => x.id === id);
      if (!f) return;

      const card = btn.closest('.card');

      if (action === 'removeFromToday') {
        todayIds = todayIds.filter(x => x !== id);
        save(KEY_TODAY, todayIds);
        if (card) {
          card.classList.add('frog-hop');
          const spark = document.createElement('div');
          spark.className = 'frog-spark';
          card.appendChild(spark);
        }
        setTimeout(renderToday, 180);
        return;
      }

      if (action === 'done') {
        // local card hop + spark
        if (card) {
          card.classList.remove('frog-hop');
          void card.offsetWidth;
          card.classList.add('frog-hop');
          const spark = document.createElement('div');
          spark.className = 'frog-spark';
          card.style.position = 'relative';
          card.appendChild(spark);
          setTimeout(() => spark.remove(), 520);
        }

        // mark done
        f.doneAt = todayISO();
        f.doneMonth = monthKey();
        save(KEY_POOL, pool);

        // keep in today's selection for correct counters (picked stays the same),
        // but hide completed cards via renderToday().
        setTimeout(() => {
          renderToday();
          renderList();  // reflect status
          renderReward(); // progress
        }, 240);

        // fullscreen frog + sound
        playDoneFX();
      }
    };
  }

  // ===== reward =====
  function renderReward() {
    const mk = monthKey();
    monthKeyEl.textContent = mk;
    const goal = 20;
    const doneThisMonth = pool.filter(f => f.doneMonth === mk).length;
    monthProgress.textContent = `Прогресс: ${doneThisMonth}/${goal}`;

    const pct = Math.max(0, Math.min(100, Math.round((doneThisMonth / goal) * 100)));
    if (monthBar) monthBar.style.width = `${pct}%`;

    const rKey = KEY_REWARD_PREFIX + mk;
    const reward = load(rKey, '');
    rewardInput.value = reward;

    if (doneThisMonth >= goal && reward.trim()) {
      rewardBanner.classList.remove('hidden');
      rewardBanner.textContent = `🎉 Ты закрыла минимум ${goal} лягушек! Награда: ${reward}`;
      if (progressHint) progressHint.textContent = 'Разблокировано 🎉';
    } else if (doneThisMonth >= goal && !reward.trim()) {
      rewardBanner.classList.remove('hidden');
      rewardBanner.textContent = `🎉 Ты закрыла минимум ${goal} лягушек! Добавь награду выше — и она будет ждать тебя.`;
      if (progressHint) progressHint.textContent = 'Разблокировано 🎉';
    } else {
      rewardBanner.classList.add('hidden');
      rewardBanner.textContent = '';
      const left = Math.max(0, goal - doneThisMonth);
      if (progressHint) progressHint.textContent = `Осталось ${left} до награды`;
    }
  }
  rewardInput.addEventListener('input', () => {
    save(KEY_REWARD_PREFIX + monthKey(), rewardInput.value);
    renderReward();
  });

  // ===== export/import =====
  exportBtn.addEventListener('click', () => {
    const data = {
      v: 1,
      exportedAt: new Date().toISOString(),
      pool,
      todayIds,
      rewards: exportRewards()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `frogs-backup-${monthKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    save(KEY_EXPORT_HINT, true);
  });

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.pool)) throw new Error('bad');
      pool = data.pool;
      todayIds = Array.isArray(data.todayIds) ? data.todayIds : [];
      save(KEY_POOL, pool);
      save(KEY_TODAY, todayIds);
      if (data.rewards && typeof data.rewards === 'object') {
        Object.entries(data.rewards).forEach(([k,v]) => {
          localStorage.setItem(KEY_REWARD_PREFIX + k, JSON.stringify(v));
        });
      }
      toast('Импортировано ✅');
      renderToday(); renderList(); renderReward();
    } catch {
      toast('Не удалось импортировать файл');
    } finally {
      importFile.value = '';
    }
  });

  function exportRewards() {
    const out = {};
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(KEY_REWARD_PREFIX)) {
        const mk = k.slice(KEY_REWARD_PREFIX.length);
        out[mk] = load(k,'');
      }
    }
    return out;
  }

  // ===== FX (frog jump + sound) =====
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
  }

  function playSplat(ctx, t0) {
    // noise burst
    const dur = 0.10;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t0);
    filter.frequency.exponentialRampToValueAtTime(180, t0 + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  function playRibbit(ctx, t0) {
    // playful "kvaaa": two tones with slight vibrato
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(310, t0);
    osc1.frequency.exponentialRampToValueAtTime(220, t0 + 0.20);
    osc1.frequency.exponentialRampToValueAtTime(250, t0 + 0.42);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(620, t0);
    osc2.frequency.exponentialRampToValueAtTime(440, t0 + 0.22);
    osc2.frequency.exponentialRampToValueAtTime(500, t0 + 0.42);

    // vibrato
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8, t0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(18, t0);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(gain);
    osc2.connect(gain);

    lfo.start(t0);
    osc1.start(t0);
    osc2.start(t0);
    lfo.stop(t0 + 0.45);
    osc1.stop(t0 + 0.45);
    osc2.stop(t0 + 0.45);
  }

  function playDoneFX() {
    // Visual
    frogOverlay.classList.remove('hidden');
    frogSprite.classList.remove('frogRun');
    void frogSprite.offsetWidth; // restart
    frogSprite.classList.add('frogRun');

    setTimeout(() => {
      frogOverlay.classList.add('hidden');
      frogSprite.classList.remove('frogRun');
    }, 750);

    // Sound
    try {
      ensureAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t0 = audioCtx.currentTime + 0.01;
      playSplat(audioCtx, t0);
      playSplat(audioCtx, t0 + 0.07);
      playRibbit(audioCtx, t0 + 0.12);
    } catch {}
  }

  // ===== utils =====
  function fmtDate(iso) {
    try {
      const [y,m,d] = iso.split('-').map(Number);
      const dt = new Date(y, m-1, d);
      return dt.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
    } catch {
      return iso;
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function toast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.position = 'fixed';
    t.style.left = '50%';
    t.style.bottom = '22px';
    t.style.transform = 'translateX(-50%)';
    t.style.padding = '10px 14px';
    t.style.borderRadius = '14px';
    t.style.background = 'rgba(0,0,0,.5)';
    t.style.border = '1px solid rgba(255,255,255,.18)';
    t.style.backdropFilter = 'blur(10px)';
    t.style.fontWeight = '800';
    t.style.zIndex = '2000';
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .25s ease'; }, 1300);
    setTimeout(()=>t.remove(), 1650);
  }

  // ===== register SW =====
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  // init
  renderTabs('today');
  renderToday();
  renderList();
  renderReward();
})();
// 🐸 encouragement toast (no settings, local only)
const FROG_TOASTS = [
  "🐸 Прыгнула! Отличная работа",
  "Готово ✔ Хороший шаг",
  "Минус одна лягушка 🐸✨",
  "Сделано. Ты молодец",
  "Ещё одна победа 🐸",
  "Отлично! Дыши 🙂",
];

function showFrogToast(text){
  try{
    let t = document.querySelector(".frogToast");
    if(!t){
      t = document.createElement("div");
      t.className = "frogToast";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
  }catch(_e){}
}

function randomToast(){
  return FROG_TOASTS[Math.floor(Math.random()*FROG_TOASTS.length)];
}

