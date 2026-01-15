const KEY_FROGS="frogs.pool.v1";
const KEY_TODAY="frogs.today.v1";
const KEY_REWARD="frogs.reward.v1";

function uid(){return "f_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9);}
function todayISO(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${dd}`;}
function monthKey(date=new Date()){const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");return `${y}-${m}`;}
function parseISO(iso){const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d,12,0,0,0);}
function fmtDate(iso){return iso?parseISO(iso).toLocaleDateString("ru-RU",{day:"2-digit",month:"short",year:"numeric"}):"";}
function fmtShort(iso){return iso?parseISO(iso).toLocaleDateString("ru-RU",{day:"2-digit",month:"short"}):"";}
function escapeHtml(s){const div=document.createElement("div");div.textContent=String(s??"");return div.innerHTML;}
function load(k,f){try{const r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch{return f;}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v));}

let pool=load(KEY_FROGS,null);
let todayMap=load(KEY_TODAY,{});
let rewardMap=load(KEY_REWARD,{});

if(!Array.isArray(pool)){
  pool=[
    {id:uid(),title:"Сделать самое неприятное первым делом",estMin:25,deadline:null,createdAt:todayISO(),doneAt:null},
    {id:uid(),title:"Разобрать 1 папку/почту 15 минут",estMin:15,deadline:null,createdAt:todayISO(),doneAt:null},
  ];
  save(KEY_FROGS,pool);
}

const subtitleEl=document.getElementById("subtitle");
const tabs=[...document.querySelectorAll(".tab")];
const viewToday=document.getElementById("viewToday");
const viewList=document.getElementById("viewList");
const viewReward=document.getElementById("viewReward");
const exportBtn=document.getElementById("exportBtn");
const importFile=document.getElementById("importFile");

function registerSW(){if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});}

function getTodayIds(){const t=todayISO();if(!Array.isArray(todayMap[t]))todayMap[t]=[];return todayMap[t];}
function setTodayIds(ids){todayMap[todayISO()]=ids;save(KEY_TODAY,todayMap);}
function getFrogById(id){return pool.find(f=>f.id===id)||null;}

function deadlinePill(f){
  if(!f.deadline)return "";
  const dl=parseISO(f.deadline);
  const now=new Date();now.setHours(12,0,0,0);
  const diffDays=Math.round((dl-now)/(1000*60*60*24));
  if(diffDays<0)return `<span class="pill dead">Дедлайн прошёл</span>`;
  if(diffDays===0)return `<span class="pill warn">Дедлайн сегодня</span>`;
  if(diffDays<=3)return `<span class="pill warn">Дедлайн скоро</span>`;
  return `<span class="pill">Дедлайн: ${escapeHtml(fmtShort(f.deadline))}</span>`;
}
function doneThisMonthCount(mKey){return pool.filter(f=>f.doneAt&&f.doneAt.startsWith(mKey)).length;}

function render(tab){
  tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  viewToday.classList.toggle("hidden",tab!=="today");
  viewList.classList.toggle("hidden",tab!=="list");
  viewReward.classList.toggle("hidden",tab!=="reward");
  if(tab==="today")renderToday();
  if(tab==="list")renderList();
  if(tab==="reward")renderReward();
}
tabs.forEach(b=>b.addEventListener("click",()=>render(b.dataset.tab)));

// TODAY
function renderToday(){
  subtitleEl.textContent=`Сегодня • ${new Date().toLocaleDateString("ru-RU",{day:"2-digit",month:"long"})}`;
  const ids=getTodayIds();
  const frogsToday=ids.map(getFrogById).filter(Boolean);
  const doneToday=frogsToday.filter(f=>f.doneAt===todayISO()).length;
  const candidates=pool.filter(f=>!f.doneAt).sort((a,b)=>{
    const da=a.deadline?a.deadline:"9999-12-31";
    const db=b.deadline?b.deadline:"9999-12-31";
    if(da!==db)return da.localeCompare(db);
    return (a.createdAt||"").localeCompare(b.createdAt||"");
  });

  viewToday.innerHTML=`
    <div class="card">
      <div class="row">
        <div class="stack">
          <div class="cardTitle">Мои лягушки сегодня</div>
          <div class="cardMeta">Выбери 1–3 задачи из общего списка и закрой их. <b>Лимит: 3</b>.</div>
        </div>
        <div class="stack" style="align-items:flex-end">
          <span class="pill ok">Сделано: ${doneToday}/${frogsToday.length}</span>
          <span class="pill">Выбрано: ${ids.length}/3</span>
        </div>
      </div>
      <div class="btnRow">
        <button class="btn primary" id="openPickerBtn">${ids.length?"Изменить выбор":"Выбрать из списка"}</button>
        <button class="btn" id="clearTodayBtn" ${ids.length?"":"disabled"}>Очистить сегодня</button>
      </div>
    </div>
    <div id="todayCards"></div>
    <div id="picker" class="card hidden">
      <div class="cardTitle">Выбор на сегодня</div>
      <div class="cardMeta">Отметь до 3 лягушек из пула (только незакрытые).</div>
      <div class="sep"></div>
      <div id="pickerList"></div>
      <div class="btnRow">
        <button class="btn" id="pickerCancelBtn">Отмена</button>
        <button class="btn primary" id="pickerSaveBtn">Сохранить выбор</button>
      </div>
    </div>
  `;

  const todayCards=viewToday.querySelector("#todayCards");
  if(!frogsToday.length){
    todayCards.innerHTML=`<div class="card"><div class="cardTitle">Пока ничего не выбрано</div><div class="cardMeta">Нажми «Выбрать из списка» и отметь 1–3 лягушки на сегодня.</div></div>`;
  }else{
    todayCards.innerHTML=frogsToday.map(f=>`
      <div class="card">
        <div class="row">
          <div class="stack">
            <div class="cardTitle">${escapeHtml(f.title)}</div>
            <div class="cardMeta">
              <div>⏱ Примерно: <b>${escapeHtml(String(f.estMin||0))} мин</b></div>
              ${f.deadline?`<div>📅 Дедлайн: <b>${escapeHtml(fmtDate(f.deadline))}</b></div>`:`<div>📅 Дедлайн: —</div>`}
            </div>
          </div>
          <div class="stack" style="align-items:flex-end">
            <span class="pill warn">В работе</span>
            ${deadlinePill(f)}
          </div>
        </div>
        <div class="btnRow">
          <button class="btn primary" data-action="done" data-id="${f.id}">Сделано ✅</button>
          <button class="btn danger" data-action="removeFromToday" data-id="${f.id}">Убрать из «Сегодня»</button>
        </div>
      </div>
    `).join("");
  }

  todayCards.onclick=(e)=>{
    const btn=e.target.closest("button[data-action]");
    if(!btn)return;
    const id=btn.dataset.id;
    const action=btn.dataset.action;
    const f=getFrogById(id);
    if(!f)return;
    if(action==="done"){
      f.doneAt=todayISO();
      save(KEY_FROGS,pool);
      // remove from today's selection so it disappears immediately
      const idsNow=getTodayIds().filter(x=>x!==id);
      setTodayIds(idsNow);
      renderToday();
      return;
    }
    if(action==="removeFromToday"){
      const idsNow=getTodayIds().filter(x=>x!==id);
      setTodayIds(idsNow);
      renderToday();
      return;
    }
  };

  const picker=viewToday.querySelector("#picker");
  const openPickerBtn=viewToday.querySelector("#openPickerBtn");
  const clearTodayBtn=viewToday.querySelector("#clearTodayBtn");

  function openPicker(){
    picker.classList.remove("hidden");
    const pickerList=viewToday.querySelector("#pickerList");
    const current=new Set(getTodayIds());
    pickerList.innerHTML=candidates.length?candidates.map(f=>{
      const checked=current.has(f.id);
      const disabled=(!checked && current.size>=3);
      return `
        <div class="card" style="background: rgba(255,255,255,0.04); box-shadow:none;">
          <div class="checkboxRow">
            <input type="checkbox" class="pickChk" data-id="${f.id}" ${checked?"checked":""} ${disabled?"disabled":""} />
            <div class="stack" style="gap:4px">
              <div style="font-weight:900">${escapeHtml(f.title)}</div>
              <div class="small">⏱ ${escapeHtml(String(f.estMin||0))} мин • ${f.deadline?("📅 "+escapeHtml(fmtShort(f.deadline))):"без дедлайна"}</div>
            </div>
          </div>
        </div>`;
    }).join(""):`<div class="note">Нет незакрытых лягушек. Добавь новые во вкладке «Список».</div>`;

    pickerList.onchange=(ev)=>{
      const chk=ev.target.closest(".pickChk"); if(!chk)return;
      const checked=[...pickerList.querySelectorAll(".pickChk:checked")].map(x=>x.dataset.id);
      if(checked.length>3) chk.checked=false;
      const final=[...pickerList.querySelectorAll(".pickChk:checked")];
      pickerList.querySelectorAll(".pickChk").forEach(x=>{ if(!x.checked) x.disabled = final.length>=3; });
    };
  }
  function closePicker(){picker.classList.add("hidden");}

  openPickerBtn.onclick=openPicker;
  clearTodayBtn.onclick=()=>{
    if(!getTodayIds().length)return;
    if(!confirm("Очистить выбор на сегодня?"))return;
    setTodayIds([]); renderToday();
  };
  viewToday.querySelector("#pickerCancelBtn")?.addEventListener("click", closePicker);
  viewToday.querySelector("#pickerSaveBtn")?.addEventListener("click", ()=>{
    const pickerList=viewToday.querySelector("#pickerList");
    const idsSelected=[...pickerList.querySelectorAll(".pickChk:checked")].map(x=>x.dataset.id).slice(0,3);
    setTodayIds(idsSelected);
    closePicker(); renderToday();
  });
}

// LIST
function renderList(){
  subtitleEl.textContent="Список • общий пул";
  const openFrogs=pool.filter(f=>!f.doneAt);
  const doneFrogs=pool.filter(f=>!!f.doneAt);

  viewList.innerHTML=`
    <div class="card">
      <div class="row">
        <div class="stack">
          <div class="cardTitle">Общий список лягушек</div>
          <div class="cardMeta">Добавляй задачи в пул. Утром выбирай 1–3 во вкладке «Сегодня».</div>
        </div>
        <div class="stack" style="align-items:flex-end">
          <span class="pill">Открытые: ${openFrogs.length}</span>
          <span class="pill ok">Закрытые: ${doneFrogs.length}</span>
        </div>
      </div>
      <div class="sep"></div>
      <div class="grid2">
        <div class="field"><span>Название лягушки</span><input id="newTitle" class="input" placeholder="например: Позвонить в банк" /></div>
        <div class="field"><span>Примерное время (мин)</span><input id="newEst" class="input" type="number" min="5" step="5" value="25" /></div>
        <div class="field"><span>Дедлайн (если есть)</span><input id="newDeadline" class="input" type="date" /></div>
        <div class="field"><span>&nbsp;</span><button id="addFrogBtn" class="btn primary">+ Добавить в пул</button></div>
      </div>
    </div>

    <div class="card">
      <div class="cardTitle">Открытые лягушки</div>
      <div class="cardMeta">${openFrogs.length?"Нажми «В работу сегодня», чтобы быстро добавить в выбор.":"Открытых лягушек нет."}</div>
      <div class="sep"></div>
      <div id="openList"></div>
    </div>

    <div class="card">
      <div class="row">
        <div class="stack">
          <div class="cardTitle">Закрытые</div>
          <div class="cardMeta">История закрытых лягушек (по датам закрытия).</div>
        </div>
        <button class="btn danger" id="clearDoneBtn" ${doneFrogs.length?"":"disabled"}>Очистить историю</button>
      </div>
      <div class="sep"></div>
      <div id="doneList"></div>
    </div>
  `;

  const openList=viewList.querySelector("#openList");
  const sortedOpen=openFrogs.slice().sort((a,b)=>{
    const da=a.deadline?a.deadline:"9999-12-31";
    const db=b.deadline?b.deadline:"9999-12-31";
    if(da!==db)return da.localeCompare(db);
    return (a.createdAt||"").localeCompare(b.createdAt||"");
  });
  openList.innerHTML=sortedOpen.length?sortedOpen.map(f=>`
    <div class="card" style="background: rgba(255,255,255,0.04); box-shadow:none;">
      <div class="listRow">
        <div class="stack" style="gap:4px">
          <div style="font-weight:900">${escapeHtml(f.title)}</div>
          <div class="small">⏱ ${escapeHtml(String(f.estMin||0))} мин • ${f.deadline?("📅 "+escapeHtml(fmtShort(f.deadline))):"без дедлайна"}</div>
        </div>
        <div class="btnRow" style="margin-top:0">
          <button class="btn primary" data-action="toToday" data-id="${f.id}">В работу сегодня</button>
          <button class="btn danger" data-action="del" data-id="${f.id}">Удалить</button>
        </div>
      </div>
    </div>
  `).join(""):`<div class="note">Добавь лягушку выше — и она появится тут.</div>`;

  const doneList=viewList.querySelector("#doneList");
  const sortedDone=doneFrogs.slice().sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||""));
  doneList.innerHTML=sortedDone.length?sortedDone.map(f=>`
    <div class="card" style="background: rgba(255,255,255,0.04); box-shadow:none;">
      <div class="listRow">
        <div class="stack" style="gap:4px">
          <div style="font-weight:900">${escapeHtml(f.title)}</div>
          <div class="small">✅ ${escapeHtml(fmtDate(f.doneAt))} • ⏱ ${escapeHtml(String(f.estMin||0))} мин</div>
        </div>
        <div class="btnRow" style="margin-top:0">
          <button class="btn" data-action="reopen" data-id="${f.id}">Вернуть</button>
          <button class="btn danger" data-action="del" data-id="${f.id}">Удалить</button>
        </div>
      </div>
    </div>
  `).join(""):`<div class="note">Пока нет закрытых лягушек.</div>`;

  viewList.querySelector("#addFrogBtn").onclick=()=>{
    const title=viewList.querySelector("#newTitle").value.trim();
    const est=Number(viewList.querySelector("#newEst").value||0);
    const deadline=viewList.querySelector("#newDeadline").value||null;
    if(!title){alert("Напиши название лягушки.");return;}
    const estMin=Math.max(5,Math.min(600,Math.round(est||25)));
    pool.push({id:uid(),title,estMin,deadline:deadline||null,createdAt:todayISO(),doneAt:null});
    save(KEY_FROGS,pool);
    viewList.querySelector("#newTitle").value="";
    viewList.querySelector("#newEst").value="25";
    viewList.querySelector("#newDeadline").value="";
    renderList();
  };

  viewList.onclick=(e)=>{
    const btn=e.target.closest("button[data-action]");
    if(!btn)return;
    const id=btn.dataset.id;
    const action=btn.dataset.action;
    const f=getFrogById(id);
    if(!f)return;

    if(action==="toToday"){
      const ids=getTodayIds().slice();
      if(ids.includes(id)) return alert("Эта лягушка уже выбрана на сегодня.");
      if(ids.length>=3) return alert("Лимит 3 лягушки на день.");
      ids.push(id); setTodayIds(ids); alert("Добавлено в «Сегодня».");
      return;
    }
    if(action==="reopen"){
      f.doneAt=null; save(KEY_FROGS,pool); renderList(); return;
    }
    if(action==="del"){
      if(!confirm("Удалить лягушку?"))return;
      pool=pool.filter(x=>x.id!==id);
      const ids=getTodayIds().filter(x=>x!==id);
      setTodayIds(ids);
      save(KEY_FROGS,pool);
      renderList();
      return;
    }
  };

  viewList.querySelector("#clearDoneBtn").onclick=()=>{
    if(!confirm("Очистить всю историю закрытых лягушек?"))return;
    pool.forEach(f=>{if(f.doneAt)f.doneAt=null;});
    save(KEY_FROGS,pool);
    renderList();
  };
}

// REWARD
function renderReward(){
  const mk=monthKey(new Date());
  subtitleEl.textContent=`Награда • ${mk}`;
  const current=rewardMap[mk]||{text:""};
  const done=doneThisMonthCount(mk);
  const target=20;
  const pct=Math.min(100,Math.round(done*100/target));
  const unlocked=done>=target;

  viewReward.innerHTML=`
    <div class="card">
      <div class="row">
        <div class="stack">
          <div class="cardTitle">Награда месяца</div>
          <div class="cardMeta">Если закрыто <b>${target}</b> лягушек за месяц — награда разблокируется 🎉</div>
        </div>
        <div class="stack" style="align-items:flex-end">
          <span class="pill ${unlocked?"ok":"warn"}">${done}/${target}</span>
          <span class="pill">${pct}%</span>
        </div>
      </div>

      <div class="field">
        <span>Твоя награда на ${mk}</span>
        <textarea id="rewardText" class="textarea" placeholder="Например: Термалка + массаж / подарок себе / выходной без задач"></textarea>
      </div>

      <div class="btnRow">
        <button class="btn primary" id="saveRewardBtn">Сохранить награду</button>
        <button class="btn" id="fillExampleBtn">Пример</button>
      </div>

      <div class="sep"></div>

      <div class="card" style="background: rgba(255,255,255,0.04); box-shadow:none;">
        <div class="cardTitle">${unlocked?"Награда разблокирована! 🥳":"Почти там… 🐸"}</div>
        <div class="cardMeta" style="font-size:14px; margin-top:10px;">
          ${unlocked?`<div><b>Ты закрыла минимум ${target} лягушек.</b> Забирай награду 😄</div>`:`<div>Закрой ещё <b>${Math.max(0,target-done)}</b> лягушек в этом месяце — и награда откроется.</div>`}
        </div>
      </div>
    </div>
  `;

  const txt=viewReward.querySelector("#rewardText");
  txt.value=current.text||"";
  viewReward.querySelector("#saveRewardBtn").onclick=()=>{
    rewardMap[mk]={text:txt.value.trim()};
    save(KEY_REWARD,rewardMap);
    alert("Сохранено ✅");
  };
  viewReward.querySelector("#fillExampleBtn").onclick=()=>{txt.value="Награда: 1 день в термах + вкусный ужин без чувства вины 🙂";};
}

// EXPORT/IMPORT
exportBtn.addEventListener("click",()=>{
  const data={pool,todayMap,rewardMap,meta:{app:"Frogs",version:"1.0"}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`frogs-backup-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
importFile.addEventListener("change",async()=>{
  const file=importFile.files?.[0]; if(!file)return;
  try{
    const text=await file.text(); const data=JSON.parse(text);
    if(!data||!Array.isArray(data.pool)) throw 0;
    pool=data.pool; todayMap=data.todayMap||{}; rewardMap=data.rewardMap||{};
    save(KEY_FROGS,pool); save(KEY_TODAY,todayMap); save(KEY_REWARD,rewardMap);
    alert("Импорт выполнен ✅"); render("today");
  }catch{ alert("Не удалось импортировать файл."); }
  finally{ importFile.value=""; }
});

function init(){registerSW(); render("today");}
init();
