/* ==========================================================================
   EmmaQQ筆記本 (Elementary_game) — 核心互動邏輯 (app.js)
   包含：
   1. 多玩家獨立檔案管理 (Cookie + LocalStorage)
   2. 簡潔首頁目錄：
      - 四上國語成語 1～6課 (5關+36成語)
      - 四上國語成語 7～12課 (5關+36成語)
      - 四上自然科學 1～2課 (8關+48知識卡)
   3. 圖鑑筆記檢視、即時關鍵字搜尋、上次練習進度記憶
   4. A-Res 自適應防重複抽題演算法 (答對自動降權重、錯題加權)
   5. 單選題 & 無數量提示之 ☑️ 多重勾選題批改與詳解回饋
   6. 專屬錯題溫習本 (含常錯題篩選與錯題重測) & A4 榮譽證書列印
   ========================================================================== */

(function () {
  "use strict";

  const IDIOM_DATA_1_6 = window.GAME_DATA || { lessons: [], idioms: [], bonusIdioms: [], levels: [] };
  const IDIOM_DATA_7_12 = window.GAME_DATA_7_12 || { lessons: [], idioms: [], bonusIdioms: [], levels: [] };
  const SCI_DATA = window.SCIENCE_GAME_DATA || { cards: [], levels: [] };
  const SCI_DATA_3 = window.SCIENCE_GAME_DATA_3 || { cards: [], levels: [] };
  const ENG_DATA = window.ENGLISH_GAME_DATA || { cards: [], levels: [] };

  const STORAGE_KEY = "emmaqq_notebook_v1";
  const THEME_KEY = "emmaqq_theme";
  const QUESTIONS_PER_ROUND = 10;
  const PASS_SCORE = 8; // 10題答對8題(80分)過關

  /* ---------- 狀態管理 ---------- */
  let state = {
    view: "home",        // 'home' | 'study' | 'quiz' | 'mistakes' | 'cert'
    subjFilter: "all",   // 'all' | 'idiom' | 'idiom_7_12' | 'science'
    searchQuery: "",
    studySubj: "idiom",  // 'idiom' | 'idiom_7_12' | 'science'
    studyGroup: "all",
    studyFocusId: null,
    studyEngTab: "mindmap", // 'mindmap' | 'cards'
    mistakeSubj: "all",
    mistakeFrequentOnly: false,
    certSubj: "idiom",
    quiz: null           // 當前測驗狀態
  };

  let store = loadStore();

  function defaultPlayerData() {
    return {
      idiom: {
        passedLevels: [],
        highScores: {},
        seenCards: [],
        mastery: {},   // qKey -> 答對次數
        mistakes: {}   // qKey -> { q, subj:'idiom', level, wrongCount, lastWrong }
      },
      idiom_7_12: {
        passedLevels: [],
        highScores: {},
        seenCards: [],
        mastery: {},
        mistakes: {}
      },
      science: {
        passedLevels: [],
        highScores: {},
        seenCards: [],
        mastery: {},
        mistakes: {}
      },
      science_3: {
        passedLevels: [],
        highScores: {},
        seenCards: [],
        mastery: {},
        mistakes: {}
      },
      english: {
        passedLevels: [],
        highScores: {},
        seenCards: [],
        mastery: {},
        mistakes: {}
      },
      lastActivity: null // { type:'quiz'|'study', subj:'idiom'|'idiom_7_12'|'science', level:1, label:'...' }
    };
  }

  function setCookie(name, val, days) {
    try {
      const d = new Date();
      d.setTime(d.getTime() + (days || 365) * 86400000);
      document.cookie = name + "=" + encodeURIComponent(val) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
      return m ? decodeURIComponent(m[2]) : "";
    } catch (e) {
      return "";
    }
  }

  function loadStore() {
    let data = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {}

    const cookiePlayer = getCookie("emmaqq_current_player");
    if (!data || typeof data !== "object" || !data.players) {
      data = {
        currentPlayer: cookiePlayer || "真真",
        players: {}
      };
    }
    if (cookiePlayer && data.players[cookiePlayer]) {
      data.currentPlayer = cookiePlayer;
    }
    if (!data.players[data.currentPlayer]) {
      data.players[data.currentPlayer] = defaultPlayerData();
    }
    // 確保欄位齊全
    Object.keys(data.players).forEach((p) => {
      const pd = data.players[p];
      const def = defaultPlayerData();
      if (!pd.idiom) pd.idiom = def.idiom;
      if (!pd.idiom_7_12) pd.idiom_7_12 = def.idiom_7_12;
      if (!pd.science) pd.science = def.science;
      ["idiom", "idiom_7_12", "science", "science_3", "english"].forEach((s) => {
        if (!pd[s]) pd[s] = { passedLevels: [], highScores: {}, seenCards: [], mastery: {}, mistakes: {} };
        pd[s].passedLevels = pd[s].passedLevels || [];
        pd[s].highScores = pd[s].highScores || {};
        pd[s].seenCards = pd[s].seenCards || [];
        pd[s].mastery = pd[s].mastery || {};
        pd[s].mistakes = pd[s].mistakes || {};
      });
    });
    return data;
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setCookie("emmaqq_current_player", store.currentPlayer, 365);
    } catch (e) {}
  }

  function curPlayer() {
    if (!store.players[store.currentPlayer]) {
      store.players[store.currentPlayer] = defaultPlayerData();
    }
    return store.players[store.currentPlayer];
  }

  /* ---------- 主題切換 (亮色 / 深色護眼) ---------- */
  function initTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark" || t === "light") {
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch (e) {}
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    renderTopbar();
  }

  /* ---------- 工具函式 ---------- */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[c]));
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function getQuestionKey(subj, q) {
    return subj + "::" + String(q.id || q.prompt).trim();
  }

  function getTotalMistakeCount() {
    const p = curPlayer();
    return (
      Object.keys((p.idiom && p.idiom.mistakes) || {}).length +
      Object.keys((p.idiom_7_12 && p.idiom_7_12.mistakes) || {}).length +
      Object.keys((p.science && p.science.mistakes) || {}).length +
      Object.keys((p.science_3 && p.science_3.mistakes) || {}).length +
      Object.keys((p.english && p.english.mistakes) || {}).length
    );
  }

  function getIdiomData(subj) {
    return subj === "idiom_7_12" ? IDIOM_DATA_7_12 : IDIOM_DATA_1_6;
  }

  function getAllIdiomCards(subj) {
    if (subj) {
      const d = getIdiomData(subj);
      const base = (d.idioms || []).slice();
      const bonus = (d.bonusIdioms || []).map((b, idx) => ({
        id: b.id || ("B-" + (idx + 1)),
        lesson: b.lesson || (subj === "idiom_7_12" ? 13 : 7),
        lessonTitle: b.lessonTitle || "補充精選成語",
        idiom: b.idiom,
        zhuyin: b.zhuyin || "",
        meaning: b.meaning || "",
        example: b.example || "",
        synonyms: b.synonyms || [],
        antonyms: b.antonyms || []
      }));
      return base.concat(bonus);
    }
    return getAllIdiomCards("idiom").concat(getAllIdiomCards("idiom_7_12"));
  }

    function findEngCard(q) {
    if (!q) return null;
    if (q.cardId) {
      const found = (ENG_DATA.cards || []).find((c) => c.id === q.cardId);
      if (found) return found;
    }
    return null;
  }

  function findIdiomCard(q, subj) {
    const all = getAllIdiomCards(subj);
    if (q.idiomId) {
      const byId = all.find((c) => c.id === q.idiomId);
      if (byId) return byId;
    }
    if (q.answer) {
      const byAns = all.find((c) => c.idiom === q.answer || (q.prompt && q.prompt.indexOf(c.idiom) >= 0));
      if (byAns) return byAns;
    }
    return null;
  }

  function findSciCard(q) {
    const cards = SCI_DATA.cards || [];
    if (q.cardId != null) {
      return cards.find((c) => String(c.id) === String(q.cardId)) || null;
    }
    return null;
  }

  /* ---------- 頂部導覽列 ---------- */
  function renderTopbar() {
    const el = document.getElementById("topbar-root");
    if (!el) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const mistakeCount = getTotalMistakeCount();

    el.innerHTML = `
      <header class="topbar-wrap">
        <nav class="topbar" aria-label="主導覽列">
          <button type="button" class="brand" id="nav-home-btn" title="回到 EmmaQQ筆記本 首頁">
            <span class="brand-logo">EQ</span>
            <span>EmmaQQ筆記本</span>
            <span class="brand-sub">國小四上</span>
          </button>
          <div class="topbar-actions">
            <button type="button" class="pill-btn" id="nav-player-btn" title="切換或新增挑戰者">
              👤 挑戰者：<b>${esc(store.currentPlayer)}</b> ▾
            </button>
            <button type="button" class="pill-btn ${mistakeCount > 0 ? "warn-btn" : ""}" id="nav-mistakes-btn" title="檢視錯題溫習本">
              📝 錯題本 ${mistakeCount > 0 ? `<span class="badge-count">${mistakeCount}</span>` : `(0)`}
            </button>
            <button type="button" class="pill-btn" id="nav-theme-btn" title="切換亮色或深色護眼模式">
              ${isDark ? "☀️ 亮色模式" : "🌙 深色護眼"}
            </button>
          </div>
        </nav>
      </header>
    `;

    document.getElementById("nav-home-btn").onclick = () => {
      state.view = "home";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.getElementById("nav-player-btn").onclick = () => openPlayerModal();
    document.getElementById("nav-mistakes-btn").onclick = () => {
      state.view = "mistakes";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.getElementById("nav-theme-btn").onclick = () => toggleTheme();
  }

  /* ---------- 首頁視圖 (簡潔直覺目錄) ---------- */
  function renderHome(container) {
    const p = curPlayer();
    const idiom1Levels = IDIOM_DATA_1_6.levels || [];
    const idiom2Levels = IDIOM_DATA_7_12.levels || [];
    const sciLevels = SCI_DATA.levels || [];
    const totalLevels = idiom1Levels.length + idiom2Levels.length + sciLevels.length;
    const passedTotal = p.idiom.passedLevels.length + p.idiom_7_12.passedLevels.length + p.science.passedLevels.length;

    const allIdioms1 = getAllIdiomCards("idiom");
    const allIdioms2 = getAllIdiomCards("idiom_7_12");
    const sciCards1 = SCI_DATA.cards || [];
    const sciCards3 = SCI_DATA_3.cards || [];
    const engCards = ENG_DATA.cards || [];
    const seenTotal =
      p.idiom.seenCards.length +
      p.idiom_7_12.seenCards.length +
      p.science.seenCards.length +
      ((p.science_3 && p.science_3.seenCards) || []).length +
      ((p.english && p.english.seenCards) || []).length;
    const totalCards = allIdioms1.length + allIdioms2.length + sciCards1.length + sciCards3.length + engCards.length;
    const mistakeCount = getTotalMistakeCount();
    const q = state.searchQuery.trim().toLowerCase();

    let resumeHtml = "";
    if (p.lastActivity) {
      const act = p.lastActivity;
      resumeHtml = `
        <div class="resume-bar">
          <div>
            <span>📌 <b>上次學習進度：</b>${esc(act.label)}</span>
          </div>
          <button type="button" class="pill-btn primary" id="resume-act-btn">▶ 繼續上次練習</button>
        </div>
      `;
    }

    const showIdiom1 = state.subjFilter === "all" || state.subjFilter === "idiom";
    const showIdiom2 = state.subjFilter === "all" || state.subjFilter === "idiom_7_12";
    const showSci1 = state.subjFilter === "all" || state.subjFilter === "science";
    const showSci3 = state.subjFilter === "all" || state.subjFilter === "science_3";
    const showEng = state.subjFilter === "all" || state.subjFilter === "english";

    container.innerHTML = `
      <section class="hero-box">
        <div class="hero-info">
          <h1>歡迎來到 EmmaQQ筆記本 👋</h1>
          <p>國小四年級上學期｜國語成語（第 1～6 課 & 第 7～12 課）＆ 自然科學（第 1～2 課）重點筆記與闖關練習</p>
        </div>
        <div class="hero-stats">
          <div class="stat-chip">
            <small>🏆 闖關總進度</small>
            <b>${passedTotal} / ${totalLevels} 關</b>
          </div>
          <div class="stat-chip">
            <small>📖 已讀筆記卡</small>
            <b>${seenTotal} / ${totalCards} 張</b>
          </div>
          <div class="stat-chip">
            <small>📝 待複習錯題</small>
            <b>${mistakeCount} 題</b>
          </div>
        </div>
      </section>

      ${resumeHtml}

      <div class="filter-bar">
        <div class="subject-tabs" role="tablist">
          <button type="button" class="tab-btn ${state.subjFilter === "all" ? "active" : ""}" data-subj="all">
            ✨ 全部科目 (四上)
          </button>
          <button type="button" class="tab-btn ${state.subjFilter === "idiom" ? "active" : ""}" data-subj="idiom">
            📕 四上成語 1～6 課
          </button>
          <button type="button" class="tab-btn ${state.subjFilter === "idiom_7_12" ? "active" : ""}" data-subj="idiom_7_12">
            📘 四上成語 7～12 課
          </button>
          <button type="button" class="tab-btn ${state.subjFilter === "science" ? "active" : ""}" data-subj="science">
            🌿 四上1~2課
          </button>
          <button type="button" class="tab-btn ${state.subjFilter === "science_3" ? "active" : ""}" data-subj="science_3">
            🔬 四上第3課
          </button>
          <button type="button" class="tab-btn ${state.subjFilter === "english" ? "active" : ""}" data-subj="english">
            🔤 四上英文・文法
          </button>
        </div>
        <div class="search-box">
          <input type="search" id="home-search-input" placeholder="🔍 搜尋成語、課次或自然科學關鍵字..." value="${esc(state.searchQuery)}">
          ${state.searchQuery ? `<button type="button" class="search-clear" id="home-search-clear" title="清除搜尋">✕</button>` : ""}
        </div>
      </div>

      ${showIdiom1 ? buildIdiomSectionHtml(p, q, "idiom") : ""}
      ${showIdiom2 ? buildIdiomSectionHtml(p, q, "idiom_7_12") : ""}
      ${showSci1 ? buildSciSectionHtml(p, q, "science") : ""}
      ${showSci3 ? buildSciSectionHtml(p, q, "science_3") : ""}
      ${showEng ? buildEngSectionHtml(p, q) : ""}
    `;

    const resumeBtn = document.getElementById("resume-act-btn");
    if (resumeBtn && p.lastActivity) {
      resumeBtn.onclick = () => {
        const act = p.lastActivity;
        if (act.type === "quiz") {
          startQuiz(act.subj, act.level);
        } else {
          openStudyView(act.subj, act.group || "all", act.focusId || null);
        }
      };
    }

    container.querySelectorAll(".tab-btn[data-subj]").forEach((btn) => {
      btn.onclick = () => {
        state.subjFilter = btn.getAttribute("data-subj");
        renderHome(container);
      };
    });

    const searchInput = document.getElementById("home-search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.searchQuery = e.target.value;
        const pos = searchInput.selectionStart;
        renderHome(container);
        const newInput = document.getElementById("home-search-input");
        if (newInput) {
          newInput.focus();
          try { newInput.setSelectionRange(pos, pos); } catch (err) {}
        }
      };
    }
    const clearBtn = document.getElementById("home-search-clear");
    if (clearBtn) {
      clearBtn.onclick = () => {
        state.searchQuery = "";
        renderHome(container);
      };
    }

    container.querySelectorAll("[data-start-quiz]").forEach((card) => {
      card.onclick = () => {
        const subj = card.getAttribute("data-subj");
        const lv = parseInt(card.getAttribute("data-level"), 10);
        startQuiz(subj, lv);
      };
    });

    container.querySelectorAll("[data-open-study]").forEach((btn) => {
      btn.onclick = () => {
        const subj = btn.getAttribute("data-open-study");
        const grp = btn.getAttribute("data-group") || "all";
        const fid = btn.getAttribute("data-focus-id") || null;
        const engTab = btn.getAttribute("data-eng-tab") || null;
        openStudyView(subj, grp, fid, engTab);
      };
    });

    container.querySelectorAll("[data-open-cert]").forEach((btn) => {
      btn.onclick = () => {
        state.certSubj = btn.getAttribute("data-open-cert");
        state.view = "cert";
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  }

  function buildIdiomSectionHtml(p, q, subj) {
    const is7_12 = subj === "idiom_7_12";
    const data = getIdiomData(subj);
    const levels = data.levels || [];
    const allIdioms = getAllIdiomCards(subj);
    const pSubj = p[subj];
    const passedCount = pSubj.passedLevels.length;

    const groups = {};
    (data.lessons || []).forEach((l) => {
      groups[l.lesson] = { title: l.title, items: [] };
    });
    allIdioms.forEach((item) => {
      const gKey = item.lesson || (is7_12 ? 13 : 7);
      if (!groups[gKey]) {
        groups[gKey] = { title: item.lessonTitle || "補充精選成語", items: [] };
      }
      if (
        !q ||
        item.idiom.toLowerCase().includes(q) ||
        (item.meaning && item.meaning.toLowerCase().includes(q)) ||
        (item.lessonTitle && item.lessonTitle.toLowerCase().includes(q))
      ) {
        groups[gKey].items.push(item);
      }
    });

    const filteredLevels = levels.filter(
      (lv) => !q || lv.name.toLowerCase().includes(q) || (lv.subtitle && lv.subtitle.toLowerCase().includes(q))
    );

    const levelCardsHtml = filteredLevels
      .map((lv) => {
        const passed = pSubj.passedLevels.includes(lv.level);
        const hi = pSubj.highScores[lv.level];
        return `
          <button type="button" class="level-card ${passed ? "passed" : ""}" data-start-quiz="1" data-subj="${esc(subj)}" data-level="${lv.level}">
            <div>
              <div class="level-top">
                <span class="level-tag">Level ${lv.level}</span>
                <span class="level-status">${passed ? "✅ 已過關" : "🎯 待挑戰"}${hi != null ? `・最高 ${hi} 分` : ""}</span>
              </div>
              <h3>${esc(lv.name.replace(/^Level\s*\d+\s*[：:]\s*/, ""))}</h3>
              <p>${esc(lv.subtitle || "")}</p>
            </div>
            <div class="level-foot">
              <span>題庫 ${lv.questions.length} 題（抽 10 題）</span>
              <span>開始闖關 →</span>
            </div>
          </button>
        `;
      })
      .join("");

    const chapterRowsHtml = Object.keys(groups)
      .map((k) => {
        const g = groups[k];
        if (!g.items.length) return "";
        const pills = g.items
          .map((it) => {
            const seen = pSubj.seenCards.includes(it.id);
            return `<button type="button" class="item-pill ${seen ? "seen" : ""}" data-open-study="${esc(subj)}" data-group="${esc(k)}" data-focus-id="${esc(it.id)}">${esc(it.idiom)}</button>`;
          })
          .join("");
        return `
          <div class="chapter-row">
            <div class="chapter-head">
              <b>${esc(g.title)}</b>
              <span>共 ${g.items.length} 個成語</span>
            </div>
            <div class="item-pills">${pills}</div>
          </div>
        `;
      })
      .join("");

    const sectionTitle = is7_12
      ? "📘 國語成語筆記與闖關（第 7～12 課）"
      : "📕 國語成語筆記與闖關（第 1～6 課）";
    const secBadgeCls = is7_12 ? "idiom2" : "idiom";
    const secBoxCls = is7_12 ? "idiom2-sec" : "idiom-sec";
    const btnPillCls = is7_12 ? "idiom2-btn" : "idiom-btn";

    return `
      <section class="subject-section ${secBoxCls}">
        <div class="sec-header">
          <div class="sec-title-group">
            <span class="sec-badge ${secBadgeCls}">四年級上學期（${is7_12 ? "7～12課" : "1～6課"}）</span>
            <h2>${sectionTitle}</h2>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${passedCount >= levels.length ? `<button type="button" class="pill-btn warn-btn" data-open-cert="${esc(subj)}">🏆 領取結業證書</button>` : ""}
            <button type="button" class="pill-btn ${btnPillCls}" data-open-study="${esc(subj)}" data-group="all">
              📖 展開成語圖鑑 (${allIdioms.length})
            </button>
          </div>
        </div>

        <div class="sub-block-title">
          <span>🎯 成語闖關測驗（已過關 ${passedCount} / ${levels.length} 關）</span>
          <small>每關隨機抽 10 題・答對 8 題過關・答對題目自動降低重複率</small>
        </div>
        <div class="levels-grid">
          ${levelCardsHtml || `<p style="color:var(--text-soft)">沒有符合搜尋條件的成語關卡。</p>`}
        </div>

        <div class="sub-block-title">
          <span>📖 各課成語筆記目錄（點擊成語直接閱讀詳解與造句）</span>
          <small>已讀 ${pSubj.seenCards.length} / ${allIdioms.length} 則</small>
        </div>
        <div class="chapter-list">
          ${chapterRowsHtml || `<p style="color:var(--text-soft)">沒有符合「${esc(state.searchQuery)}」的成語筆記。</p>`}
        </div>
      </section>
    `;
  }

  
  function buildEngSectionHtml(p, q) {
    const cards = ENG_DATA.cards || [];
    const levels = ENG_DATA.levels || [];
    const pSubj = p.english || { passedLevels: [], highScores: {}, seenCards: [] };
    const passedCount = (pSubj.passedLevels || []).length;

    const groupOrder = [
      "現在簡單式",
      "現在進行式",
      "現在完成式",
      "現在完成進行式",
      "完成式時態"
    ];
    const groups = {};
    groupOrder.forEach((t) => (groups[t] = []));

    cards.forEach((c) => {
      const title = c.subUnit || "文法重點";
      if (!groups[title]) groups[title] = [];
      if (
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.summary && c.summary.toLowerCase().includes(q)) ||
        (c.formula && c.formula.toLowerCase().includes(q)) ||
        title.toLowerCase().includes(q)
      ) {
        groups[title].push(c);
      }
    });

    const filteredLevels = levels.filter(
      (lv) => !q || lv.name.toLowerCase().includes(q) || (lv.subtitle && lv.subtitle.toLowerCase().includes(q))
    );

    const levelCardsHtml = filteredLevels
      .map((lv) => {
        const passed = (pSubj.passedLevels || []).includes(lv.level);
        const hi = (pSubj.highScores || {})[lv.level];
        const singleCount = (lv.questions || []).filter((x) => x.type === "single").length;
        const fillCount = (lv.questions || []).filter((x) => x.type === "fill").length;
        return `
          <button type="button" class="level-card ${passed ? "passed" : ""}" data-start-quiz="1" data-subj="english" data-level="${lv.level}">
            <div>
              <div class="level-top">
                <span class="level-tag">Level ${lv.level}</span>
                <span class="level-status">${passed ? "✅ 已過關" : "🎯 待挑戰"}${hi != null ? `・最高 ${hi} 分` : ""}</span>
              </div>
              <h3>${esc(lv.name.replace(/^Level\s*\d+\s*[：:]\s*/, ""))}</h3>
              <p>${esc(lv.subtitle || "")}</p>
            </div>
            <div class="level-foot">
              <span>題庫 ${lv.questions.length} 題（選擇 ${singleCount} + 填空 ${fillCount}）</span>
              <span>開始闖關 →</span>
            </div>
          </button>
        `;
      })
      .join("");

    const chapterRowsHtml = Object.keys(groups)
      .map((gTitle) => {
        const items = groups[gTitle];
        if (!items || !items.length) return "";
        const pills = items
          .map((c) => {
            const seen = (pSubj.seenCards || []).includes(String(c.id));
            return `<button type="button" class="item-pill ${seen ? "seen" : ""}" data-open-study="english" data-group="${esc(gTitle)}" data-focus-id="${esc(c.id)}">${esc(c.title)}</button>`;
          })
          .join("");
        return `
          <div class="chapter-row">
            <div class="chapter-head">
              <b>🔤 ${esc(gTitle)}</b>
              <span>共 ${items.length} 張文法卡</span>
            </div>
            <div class="item-pills">${pills}</div>
          </div>
        `;
      })
      .join("");

    return `
      <section class="subject-section eng-sec">
        <div class="sec-header">
          <div class="sec-title-group">
            <span class="sec-badge eng">國小四年級英文・文法專題</span>
            <h2>🔤 英文文法筆記與闖關（現在式四大時態 Present Tenses）</h2>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${passedCount >= levels.length ? `<button type="button" class="pill-btn warn-btn" data-open-cert="english">🏆 領取英文榮譽證書</button>` : ""}
            <button type="button" class="pill-btn eng-btn" data-open-study="english" data-eng-tab="mindmap">
              🧠 四大時態心智圖
            </button>
            <button type="button" class="pill-btn" data-open-study="english" data-eng-tab="cards">
              📖 文法卡片庫 (${cards.length})
            </button>
          </div>
        </div>
        <p class="sec-subtitle">
          以現在式四大時態筆記為基底，收錄 Level 1 (現在簡單式與進行式) 與 Level 2 (現在完成式與完成進行式)！
          <small>每關隨機抽 10 題・含四選一選擇題與單字填空題！</small>
        </p>

        <div class="sub-block-title">
          <span>🎯 文法闖關測驗（已過關 ${passedCount} / ${levels.length} 關）</span>
          <small>每關抽 10 題・答對 8 題過關・答對題目自動降低重複率</small>
        </div>
        <div class="levels-grid">
          ${levelCardsHtml || `<p style="color:var(--text-soft)">沒有符合搜尋條件的文法關卡。</p>`}
        </div>

        <div class="sub-block-title">
          <span>📖 文法重點筆記（點擊查看公式、例句與陷阱解析）</span>
          <small>已讀 ${(pSubj.seenCards || []).length} / ${cards.length} 則</small>
        </div>
        <div class="chapter-list">
          ${chapterRowsHtml || `<p style="color:var(--text-soft)">沒有符合「${esc(state.searchQuery)}」的文法筆記。</p>`}
        </div>
      </section>
    `;
  }

  function buildSciSectionHtml(p, q, subj = "science") {
    const isSci3 = subj === "science_3";
    const sciObj = isSci3 ? SCI_DATA_3 : SCI_DATA;
    const levels = sciObj.levels || [];
    const cards = sciObj.cards || [];
    const playerSubjData = isSci3 ? (p.science_3 || { passedLevels: [], highScores: {}, seenCards: [] }) : p.science;
    const passedCount = (playerSubjData.passedLevels || []).length;

    const groupOrder = isSci3
      ? [
          "活動1：聲音的產生與振動",
          "活動2：聲音的大小與強弱",
          "活動3：聲音的高低與音調",
          "活動4：聲音傳播介質與噪音防治",
          "活動5：光的直線行進與影子大探索",
          "活動6：光的反射原理與鏡面成像",
          "活動7：生活中的聲光科技與反光器具",
          "活動8：第三課終極綜合挑戰與科學閱讀探究"
        ]
      : [
          "第一課：地表環境與岩石沙土",
          "活動1：認識水域環境",
          "活動2：水生生物的外形與構造",
          "活動3：愛護水生生物與環境"
        ];
    const groups = {};
    groupOrder.forEach((t) => (groups[t] = []));

    cards.forEach((c) => {
      const title = c.activityTitle || "其他單元";
      if (!groups[title]) groups[title] = [];
      if (
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.summary && c.summary.toLowerCase().includes(q)) ||
        (c.experiment && c.experiment.toLowerCase().includes(q)) ||
        title.toLowerCase().includes(q)
      ) {
        groups[title].push(c);
      }
    });

    const filteredLevels = levels.filter(
      (lv) => !q || lv.name.toLowerCase().includes(q) || (lv.subtitle && lv.subtitle.toLowerCase().includes(q))
    );

    const levelCardsHtml = filteredLevels
      .map((lv) => {
        const passed = (playerSubjData.passedLevels || []).includes(lv.level);
        const hi = (playerSubjData.highScores || {})[lv.level];
        const multiCount = (lv.questions || []).filter((x) => x.isMulti).length;
        return `
          <button type="button" class="level-card ${passed ? "passed" : ""}" data-start-quiz="1" data-subj="${subj}" data-level="${lv.level}">
            <div>
              <div class="level-top">
                <span class="level-tag">Level ${lv.level}</span>
                <span class="level-status">${passed ? "✅ 已過關" : "🎯 待挑戰"}${hi != null ? `・最高 ${hi} 分` : ""}</span>
              </div>
              <h3>${esc(lv.name.replace(/^Level\s*\d+\s*[：:]\s*/, ""))}</h3>
              <p>${esc(lv.subtitle || "")}</p>
            </div>
            <div class="level-foot">
              <span>題庫 ${lv.questions.length} 題${multiCount ? ` (含☑️勾選題)` : ""}</span>
              <span>開始闖關 →</span>
            </div>
          </button>
        `;
      })
      .join("");

    const chapterRowsHtml = Object.keys(groups)
      .map((gTitle) => {
        const items = groups[gTitle];
        if (!items || !items.length) return "";
        const displayTitle = gTitle.startsWith("活動") ? (isSci3 ? `第3課・${gTitle}` : `第二課・${gTitle}`) : gTitle;
        const pills = items
          .map((c) => {
            const seen = (playerSubjData.seenCards || []).includes(String(c.id));
            return `<button type="button" class="item-pill ${seen ? "seen" : ""}" data-open-study="${subj}" data-group="${esc(gTitle)}" data-focus-id="${esc(c.id)}">${esc(c.title)}</button>`;
          })
          .join("");
        return `
          <div class="chapter-row">
            <div class="chapter-head">
              <b>${esc(displayTitle)}</b>
              <span>共 ${items.length} 張知識卡</span>
            </div>
            <div class="item-pills">${pills}</div>
          </div>
        `;
      })
      .join("");

    return `
      <section class="subject-section sci-sec">
        <div class="sec-header">
          <div class="sec-title-group">
            <span class="sec-badge sci">四年級上學期（第1～2課）</span>
            <h2>🌿 自然科學筆記與闖關（地表岩石＆水生生物）</h2>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${passedCount >= levels.length ? `<button type="button" class="pill-btn warn-btn" data-open-cert="science">🏆 領取自然榮譽證書</button>` : ""}
            <button type="button" class="pill-btn sci-btn" data-open-study="science" data-group="all">
              🔬 展開全部科學圖鑑 (${cards.length})
            </button>
          </div>
        </div>

        <div class="sub-block-title">
          <span>🎯 自然科學闖關測驗（已過關 ${passedCount} / ${levels.length} 關）</span>
          <small>含單選題與 ☑️ 多重勾選題（不提示應選數量，考驗真功夫！）</small>
        </div>
        <div class="levels-grid">
          ${levelCardsHtml || `<p style="color:var(--text-soft)">沒有符合搜尋條件的自然關卡。</p>`}
        </div>

        <div class="sub-block-title">
          <span>🔬 自然科學實驗與重點圖鑑目錄（點擊小節直接閱讀）</span>
          <small>已讀 ${p.science.seenCards.length} / ${cards.length} 張</small>
        </div>
        <div class="chapter-list">
          ${chapterRowsHtml || `<p style="color:var(--text-soft)">沒有符合「${esc(state.searchQuery)}」的自然知識卡。</p>`}
        </div>
      </section>
    `;
  }

  /* ---------- 圖鑑筆記溫習視圖 (#view-study) ---------- */
  function openStudyView(subj, group, focusId, engTab) {
    state.view = "study";
    state.studySubj = subj;
    state.studyGroup = group || "all";
    state.studyFocusId = focusId != null ? String(focusId) : null;
    if (subj === "english") {
      if (engTab) state.studyEngTab = engTab;
      else if (focusId) state.studyEngTab = "cards";
      else if (!state.studyEngTab) state.studyEngTab = "mindmap";
    }

    const p = curPlayer();
    if (focusId != null && p[subj]) {
      const arr = p[subj].seenCards;
      const sid = String(focusId);
      if (!arr.includes(sid)) arr.push(sid);
    }
    const labelMap = {
      idiom: "四上國語成語圖鑑（1～6課）",
      idiom_7_12: "四上國語成語圖鑑（7～12課）",
      science: "四上自然科學圖鑑",
      science_3: "四上第3課聲音與光圖鑑",
      english: "四上英文文法筆記"
    };
    p.lastActivity = {
      type: "study",
      subj: subj,
      group: state.studyGroup,
      focusId: state.studyFocusId,
      label: labelMap[subj] || "學習圖鑑"
    };
    saveStore();
    render();

    if (state.studyFocusId) {
      setTimeout(() => {
        const target = document.getElementById("study-card-" + state.studyFocusId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function buildEngMindmapHtml(mm) {
    if (!mm || !mm.branches) return "";
    const core = mm.coreNode || {};
    const branches = mm.branches || [];
    const compTable = mm.comparisonTable || [];
    const prep = mm.prepositionTips || {};

    const quickNavHtml = `
      <div class="mindmap-quicknav">
        ${branches.map(b => `<button type="button" class="mindmap-jump-pill" data-target="branch-${esc(b.id)}">${esc(b.number)}. ${esc(b.title.split(' ')[0])}</button>`).join('')}
        <button type="button" class="mindmap-jump-pill" data-target="mindmap-matrix">⚡ 四大時態秒懂對比</button>
        <button type="button" class="mindmap-jump-pill" data-target="mindmap-prep">🎯 for vs since 口訣</button>
      </div>
    `;

    const branchesHtml = branches.map(b => {
      const examplesHtml = (b.examples || []).map(ex => `
        <div class="example-row">
          <span class="example-subj-badge">${esc(ex.subj)}</span>
          <span class="example-text">${esc(ex.text)}</span>
          <span class="example-zh">${esc(ex.zh)}</span>
        </div>
      `).join('');

      const keywordsHtml = (b.keywords || []).map(k => `
        <span class="keyword-chip">⏳ ${esc(k)}</span>
      `).join('');

      const formulasHtml = (b.formulas || []).map(f => `
        <div class="branch-formula-code">${esc(f)}</div>
      `).join('<div style="height:6px"></div>');

      const rulesHtml = (b.rules || []).map(r => `<li>${esc(r)}</li>`).join('');

      return `
        <article class="mindmap-branch-card branch-${esc(b.id)}" id="branch-${esc(b.id)}">
          <div class="branch-header">
            <div class="branch-title-wrap">
              <span class="branch-num-badge">${esc(b.number)}</span>
              <h3 class="branch-title">${esc(b.title)}</h3>
            </div>
            <span class="branch-tagline">${esc(b.tagline)}</span>
          </div>

          <div class="branch-body">
            <div class="branch-box">
              <div class="branch-box-title">📌 核心觀念 (Concept)</div>
              <p style="margin:0 0 10px;line-height:1.6;font-size:0.95rem;">${esc(b.concept)}</p>

              <div class="branch-box-title">📐 句型結構公式 (Formula)</div>
              ${formulasHtml}

              <div class="branch-box-title" style="margin-top:12px;">⏳ 時間標誌關鍵字 (Keywords)</div>
              <div class="branch-keywords-wrap">${keywordsHtml}</div>
            </div>

            <div class="branch-box">
              <div class="branch-box-title">📝 筆記經典例句 (7 大主詞對照)</div>
              <div class="examples-grid">
                ${examplesHtml}
              </div>

              ${rulesHtml ? `
                <div class="branch-box-title" style="margin-top:12px;">💡 規則心法與拼字重點</div>
                <ul style="margin:4px 0 0 1.2rem;padding:0;font-size:0.9rem;line-height:1.5;">
                  ${rulesHtml}
                </ul>
              ` : ''}
            </div>

            ${b.traps ? `
              <div class="branch-trap-box">
                <b>💡 易錯警示：</b>${esc(b.traps)}
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    const matrixRowsHtml = compTable.map(row => `
      <tr>
        <td><b>${esc(row.tense)}</b></td>
        <td><span class="keyword-chip" style="font-weight:700;">${esc(row.meaning)}</span></td>
        <td><code>${esc(row.formula)}</code></td>
        <td>
          <div style="font-weight:700;color:var(--eng);">${esc(row.writeExample)}</div>
          <div style="font-size:0.85rem;color:var(--text-soft);">${esc(row.explain)}</div>
        </td>
        <td>
          <div style="font-weight:700;">${esc(row.studyExample)}</div>
        </td>
        <td><small>${esc(row.timeClue)}</small></td>
      </tr>
    `).join('');

    return `
      <section class="mindmap-root-card">
        <div class="mindmap-root-title">🌟 ${esc(core.label || "現在式四大時態核心心智圖")}</div>
        <p class="mindmap-root-desc">${esc(core.concept || "")}</p>
        ${quickNavHtml}
      </section>

      <section class="mindmap-branches">
        ${branchesHtml}
      </section>

      <section class="mindmap-matrix-card" id="mindmap-matrix">
        <h3 style="margin:0 0 6px;color:var(--eng);">⚡ 四大時態一秒速辨核心對比表 (Master Comparison Matrix)</h3>
        <p style="margin:0 0 10px;font-size:0.92rem;color:var(--text-soft);">
          同一個動作「寫作 (write)」與「讀書 (study)」，在四大時態下的語意與時空狀態完整對照：
        </p>
        <div class="mindmap-matrix-table-wrap">
          <table class="mindmap-matrix-table">
            <thead>
              <tr>
                <th>時態名稱</th>
                <th>核心狀態</th>
                <th>動詞公式</th>
                <th>同動詞對照 (write)</th>
                <th>同動詞對照 (study)</th>
                <th>時間線索詞</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section class="mindmap-prep-card" id="mindmap-prep">
        <h3 style="margin:0 0 6px;color:var(--primary);">${esc(prep.title || "🎯 for 與 since 介系詞秒殺口訣")}</h3>
        <div class="prep-grid">
          <div class="prep-item">
            <h4>⏳ for ＋ 一段時間長度 (Duration)</h4>
            <p style="margin:0;font-size:0.92rem;line-height:1.6;color:var(--text);">
              ${esc(prep.ruleFor || "")}
            </p>
          </div>
          <div class="prep-item">
            <h4>📍 since ＋ 過去的時間起點 (Point in Time)</h4>
            <p style="margin:0;font-size:0.92rem;line-height:1.6;color:var(--text);">
              ${esc(prep.ruleSince || "")}
            </p>
          </div>
        </div>
        <div class="prep-mnemonic-banner">
          ${esc(prep.quickMnemonic || "👉 口訣：『for 一段、since 一點』！")}
        </div>
      </section>
    `;
  }

  function renderStudy(container) {
    const subj = state.studySubj;
    const p = curPlayer();

    if (subj === "idiom" || subj === "idiom_7_12") {
      const is7_12 = subj === "idiom_7_12";
      const data = getIdiomData(subj);
      const allIdioms = getAllIdiomCards(subj);
      const filterGroups = [
        { id: "all", label: "全部課次 (" + allIdioms.length + ")" },
        ...(data.lessons || []).map((l) => ({ id: String(l.lesson), label: l.title })),
        { id: is7_12 ? "13" : "7", label: "補充精選成語" }
      ];

      const filtered = allIdioms.filter(
        (it) => state.studyGroup === "all" || String(it.lesson) === String(state.studyGroup)
      );

      const title = is7_12
        ? "📘 四上・國語成語圖鑑筆記（第 7～12 課）"
        : "📕 四上・國語成語圖鑑筆記（第 1～6 課）";
      const btnCls = is7_12 ? "idiom2-btn" : "idiom-btn";
      const badgeCls = is7_12 ? "idiom2" : "idiom";

      container.innerHTML = `
        <div class="view-header">
          <button type="button" class="pill-btn" id="study-back-btn">← 返回首頁目錄</button>
          <h2 style="margin:0">${title}</h2>
          <button type="button" class="pill-btn ${btnCls}" id="study-go-quiz-btn">🎯 前往成語闖關</button>
        </div>

        <div class="study-filter-pills">
          ${filterGroups
            .map(
              (g) => `
            <button type="button" class="tab-btn ${String(state.studyGroup) === g.id ? "active" : ""}" data-subj="${esc(subj)}" data-study-grp="${esc(g.id)}">
              ${esc(g.label)}
            </button>
          `
            )
            .join("")}
        </div>

        <div class="study-cards-grid">
          ${filtered
            .map((it) => {
              const isFocus = String(it.id) === String(state.studyFocusId);
              const seen = p[subj].seenCards.includes(String(it.id));
              return `
                <article class="study-card ${isFocus ? "highlight-focus" : ""}" id="study-card-${esc(it.id)}" data-card-id="${esc(it.id)}">
                  <div class="study-card-top">
                    <span class="sec-badge ${badgeCls}">${esc(it.lessonTitle || "補充成語")}</span>
                    <span style="font-size:0.8rem;color:${seen ? "var(--ok)" : "var(--text-soft)"};font-weight:700">
                      ${seen ? "✓ 已閱讀" : "點擊標記已讀"}
                    </span>
                  </div>
                  <div>
                    <h3>${esc(it.idiom)}</h3>
                    <div class="zhuyin-text">${esc(it.zhuyin || "")}</div>
                  </div>
                  <div class="study-box">
                    <b>💡 成語解釋</b>
                    ${esc(it.meaning)}
                  </div>
                  <div class="study-box">
                    <b>📝 造句範例</b>
                    ${esc(it.example)}
                  </div>
                  <div class="syn-ant-row">
                    ${(it.synonyms || []).map((s) => `<span class="syn-chip">近義：${esc(s)}</span>`).join("")}
                    ${(it.antonyms || []).map((a) => `<span class="ant-chip">反義：${esc(a)}</span>`).join("")}
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    } else if (state.studySubj === "english") {
      const cards = ENG_DATA.cards || [];
      const mindmap = ENG_DATA.mindmap || {};
      const currentTab = state.studyEngTab || "mindmap";
      const groupList = [
        "all",
        "現在簡單式",
        "現在進行式",
        "現在完成式",
        "現在完成進行式",
        "完成式時態"
      ];
      const filtered = cards.filter(
        (c) => state.studyGroup === "all" || c.subUnit === state.studyGroup
      );

      const contentHtml = currentTab === "mindmap"
        ? buildEngMindmapHtml(mindmap)
        : `
          <div class="study-filter-pills">
            ${groupList
              .map((g) => {
                const label = g === "all" ? `全部時態 (${cards.length})` : g;
                return `
                  <button type="button" class="tab-btn ${state.studyGroup === g ? "active" : ""}" data-subj="english" data-study-grp="${esc(g)}">
                    ${esc(label)}
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="study-cards-grid">
            ${filtered
              .map((c) => {
                const isFocus = String(c.id) === String(state.studyFocusId);
                const pSubjCards = p.english || { seenCards: [] };
                const seen = (pSubjCards.seenCards || []).includes(String(c.id));
                return `
                  <article class="study-card ${isFocus ? "highlight-focus" : ""}" id="study-card-${esc(c.id)}" data-card-id="${esc(c.id)}">
                    <div class="study-card-top">
                      <span class="sec-badge eng">${esc(c.subUnit || "文法")}・${esc(c.category || "公式")}</span>
                      <span style="font-size:0.8rem;color:${seen ? "var(--ok)" : "var(--text-soft)"};font-weight:700">
                        ${seen ? "✓ 已閱讀" : "點擊標記已讀"}
                      </span>
                    </div>
                    <h3>${esc(c.title)}</h3>
                    <div class="study-box">
                      <b>📐 時態公式 (Formula)</b>
                      <pre style="white-space:pre-wrap;margin:4px 0;font-family:inherit;font-weight:700;color:var(--eng);">${esc(c.formula)}</pre>
                    </div>
                    <div class="study-box">
                      <b>📝 筆記例句 (Examples)</b>
                      <ul style="margin:4px 0 0 1.2rem;padding:0;">
                        ${(c.examples || []).map((ex) => `<li>${esc(ex)}</li>`).join("")}
                      </ul>
                    </div>
                    ${
                      c.tip
                        ? `<div class="study-tip"><b>⚠️ 易錯重點與小技巧：</b>${esc(c.tip)}</div>`
                        : ""
                    }
                  </article>
                `;
              })
              .join("")}
          </div>
        `;

      container.innerHTML = `
        <div class="view-header">
          <button type="button" class="pill-btn" id="study-back-btn">← 返回首頁目錄</button>
          <h2 style="margin:0">🔤 英文文法（現在式四大時態 Present Tenses）</h2>
          <button type="button" class="pill-btn eng-btn" id="study-go-quiz-btn">🎯 前往英文文法闖關</button>
        </div>

        <div class="eng-mode-toggle-bar">
          <button type="button" class="tab-btn ${currentTab === "mindmap" ? "active" : ""}" id="eng-tab-mindmap">
            🧠 四大時態核心心智圖 (Mind Map)
          </button>
          <button type="button" class="tab-btn ${currentTab === "cards" ? "active" : ""}" id="eng-tab-cards">
            📚 核心文法卡片庫 (${cards.length} 張)
          </button>
        </div>

        ${contentHtml}
      `;
    } else {
      const isSci3 = state.studySubj === "science_3";
      const cards = isSci3 ? (SCI_DATA_3.cards || []) : (SCI_DATA.cards || []);
      const groupList = isSci3
        ? [
            "all",
            "活動1：聲音的產生與振動",
            "活動2：聲音的大小與強弱",
            "活動3：聲音的高低與音調",
            "活動4：聲音傳播介質與噪音防治",
            "活動5：光的直線行進與影子大探索",
            "活動6：光的反射原理與鏡面成像",
            "活動7：生活中的聲光科技與反光器具",
            "活動8：第三課終極綜合挑戰與科學閱讀探究"
          ]
        : [
            "all",
            "第一課：地表環境與岩石沙土",
            "活動1：認識水域環境",
            "活動2：水生生物的外形與構造",
            "活動3：愛護水生生物與環境"
          ];
      const filtered = cards.filter(
        (c) => state.studyGroup === "all" || c.activityTitle === state.studyGroup
      );

      container.innerHTML = `
        <div class="view-header">
          <button type="button" class="pill-btn" id="study-back-btn">← 返回首頁目錄</button>
          <h2 style="margin:0">${isSci3 ? "🔬 四上 第3課 有趣的聲音與光重點圖鑑" : "🌿 四上1~2課 自然重點圖鑑（地表岩石＆水生生物）"}</h2>
          <button type="button" class="pill-btn ${isSci3 ? "sci3-btn" : "sci-btn"}" id="study-go-quiz-btn">🎯 前往${isSci3 ? "第3課" : "第1～2課"}闖關</button>
        </div>

        <div class="study-filter-pills">
          ${groupList
            .map((g) => {
              const label = g === "all" ? `全部單元 (${cards.length})` : isSci3 ? `第3課・${g}` : (g.startsWith("活動") ? `第二課・${g}` : g);
              return `
                <button type="button" class="tab-btn ${state.studyGroup === g ? "active" : ""}" data-subj="${state.studySubj}" data-study-grp="${esc(g)}">
                  ${esc(label)}
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="study-cards-grid">
          ${filtered
            .map((c) => {
              const isFocus = String(c.id) === String(state.studyFocusId);
              const pSubjCards = (isSci3 ? p.science_3 : p.science) || { seenCards: [] };
              const seen = (pSubjCards.seenCards || []).includes(String(c.id));
              return `
                <article class="study-card ${isFocus ? "highlight-focus" : ""}" id="study-card-${esc(c.id)}" data-card-id="${esc(c.id)}">
                  <div class="study-card-top">
                    <span class="sec-badge ${isSci3 ? "sci3" : "sci"}">${esc(c.activityTitle)}・${esc(c.tag || "核心概念")}</span>
                    <span style="font-size:0.8rem;color:${seen ? "var(--ok)" : "var(--text-soft)"};font-weight:700">
                      ${seen ? "✓ 已閱讀" : "點擊標記已讀"}
                    </span>
                  </div>
                  <h3>${esc(c.title)}</h3>
                  <div class="study-box">
                    <b>🔬 觀察與實驗探究</b>
                    ${esc(c.experiment)}
                  </div>
                  <div class="study-box">
                    <b>💡 核心科學概念</b>
                    ${esc(c.summary)}
                  </div>
                  ${
                    c.tip
                      ? `<div class="study-tip"><b>⚠️ 必考重點與常見陷阱：</b>${esc(c.tip)}</div>`
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    }

    document.getElementById("study-back-btn").onclick = () => {
      state.view = "home";
      render();
    };
    document.getElementById("study-go-quiz-btn").onclick = () => {
      startQuiz(subj, 1);
    };

    const tabMindmap = document.getElementById("eng-tab-mindmap");
    const tabCards = document.getElementById("eng-tab-cards");
    if (tabMindmap) {
      tabMindmap.onclick = () => {
        state.studyEngTab = "mindmap";
        renderStudy(container);
      };
    }
    if (tabCards) {
      tabCards.onclick = () => {
        state.studyEngTab = "cards";
        renderStudy(container);
      };
    }

    container.querySelectorAll(".mindmap-jump-pill").forEach((pill) => {
      pill.onclick = (e) => {
        e.preventDefault();
        const targetId = pill.getAttribute("data-target");
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };
    });

    container.querySelectorAll("[data-study-grp]").forEach((btn) => {
      btn.onclick = () => {
        state.studyGroup = btn.getAttribute("data-study-grp");
        state.studyFocusId = null;
        renderStudy(container);
      };
    });

    container.querySelectorAll(".study-card[data-card-id]").forEach((cardEl) => {
      cardEl.onclick = () => {
        const cid = cardEl.getAttribute("data-card-id");
        const arr = p[subj].seenCards;
        if (!arr.includes(cid)) {
          arr.push(cid);
          saveStore();
          renderStudy(container);
        }
      };
    });
  }

  /* ---------- A-Res 自適應加權抽題與闖關測驗 (#view-quiz) ---------- */
  function sampleAdaptiveQuestions(subj, pool, count) {
    const p = curPlayer()[subj];
    const uniqueMap = new Map();
    pool.forEach((q) => {
      const norm = String(q.prompt || "").trim();
      if (norm && !uniqueMap.has(norm)) {
        uniqueMap.set(norm, q);
      }
    });
    const uniquePool = Array.from(uniqueMap.values());

    const keyed = uniquePool.map((q) => {
      const qKey = getQuestionKey(subj, q);
      const correctCount = p.mastery[qKey] || 0;
      const inMistakes = !!p.mistakes[qKey];
      let weight = 1 / Math.pow(4, correctCount);
      if (inMistakes) weight *= 2.5;
      weight = Math.max(weight, 0.0001);
      const u = Math.max(Math.random(), 1e-9);
      const key = Math.pow(u, 1 / weight);
      return { q, key };
    });

    keyed.sort((a, b) => b.key - a.key);
    return keyed.slice(0, Math.min(count, keyed.length)).map((item) => {
      const qCopy = Object.assign({}, item.q);
      qCopy.shuffledOptions = shuffleArray(qCopy.options || []);
      return qCopy;
    });
  }

  function startQuiz(subj, levelNum, customQuestions, customTitle) {
    let levels = [];
    if (subj === "idiom_7_12") levels = IDIOM_DATA_7_12.levels;
    else if (subj === "idiom") levels = IDIOM_DATA_1_6.levels;
    else levels = SCI_DATA.levels;

    const lvObj = levels.find((l) => l.level === levelNum) || levels[0];
    const questions = customQuestions
      ? customQuestions.map((q) => {
          const c = Object.assign({}, q);
          c.shuffledOptions = shuffleArray(c.options || []);
          return c;
        })
      : sampleAdaptiveQuestions(subj, lvObj.questions || [], QUESTIONS_PER_ROUND);

    state.view = "quiz";
    state.quiz = {
      subj: subj,
      level: lvObj ? lvObj.level : 1,
      title: customTitle || (lvObj ? lvObj.name : "闖關測驗"),
      subtitle: lvObj ? lvObj.subtitle : "",
      isCustomMistakeQuiz: !!customQuestions,
      questions: questions,
      index: 0,
      correctCount: 0,
      answered: false,
      showHint: false,
      selectedMulti: [],
      lastIsCorrect: false,
      roundMistakes: [],
      finished: false
    };

    if (!customQuestions) {
      const p = curPlayer();
      const prefix = subj === "idiom_7_12" ? "四上成語(7~12課)" : subj === "idiom" ? "四上成語(1~6課)" : "四上自然";
      p.lastActivity = {
        type: "quiz",
        subj: subj,
        level: state.quiz.level,
        label: `${prefix}・${state.quiz.title}`
      };
      saveStore();
    }

    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderQuiz(container) {
    const qz = state.quiz;
    if (!qz) {
      state.view = "home";
      render();
      return;
    }

    if (qz.finished) {
      renderQuizResult(container, qz);
      return;
    }

    const total = qz.questions.length;
    const curQ = qz.questions[qz.index];
    const progPct = Math.round(((qz.index + (qz.answered ? 1 : 0)) / total) * 100);
    const isMulti = !!curQ.isMulti;
    const optLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

    let unitTag = qz.subj === "english" ? "四上英文・文法專題" : (qz.subj === "science_3" ? "四上第3課：聲音與光現象" : (qz.subj === "science" ? "四上自然 1～2 課" : (qz.subj === "idiom_7_12" ? "四上國語成語（7～12課）" : "四上國語成語（1～6課）")));
    if (qz.subj === "english") {
      const ec = findEngCard(curQ);
      if (ec && ec.subUnit) unitTag = "英文文法・" + ec.subUnit;
    } else
    if (qz.subj === "idiom" || qz.subj === "idiom_7_12") {
      const ic = findIdiomCard(curQ, qz.subj);
      if (ic && ic.lessonTitle) unitTag = ic.lessonTitle;
    } else {
      const sc = findSciCard(curQ);
      if (sc && sc.activityTitle) unitTag = sc.activityTitle;
    }

    let optionsHtml = "";
    if (isMulti) {
      optionsHtml = (curQ.shuffledOptions || [])
        .map((opt, idx) => {
          const isSel = qz.selectedMulti.includes(opt);
          let cls = isSel ? "selected" : "";
          if (qz.answered) {
            const isAns = (curQ.answers || []).includes(opt);
            if (isAns && isSel) cls = "correct";
            else if (!isAns && isSel) cls = "wrong";
            else if (isAns && !isSel) cls = "missed";
          }
          return `
            <button type="button" class="opt-btn ${cls}" data-opt-idx="${idx}" ${qz.answered ? "disabled" : ""}>
              <span class="opt-chk">${isSel || (qz.answered && (curQ.answers || []).includes(opt)) ? "✓" : ""}</span>
              <span class="opt-key">${optLabels[idx] || idx + 1}</span>
              <span style="flex:1">${esc(opt)}${qz.answered && (curQ.answers || []).includes(opt) && !isSel ? ` <small style="color:var(--ok);font-weight:800">(應選正解)</small>` : ""}</span>
            </button>
          `;
        })
        .join("");
    } else {
      optionsHtml = (curQ.shuffledOptions || [])
        .map((opt, idx) => {
          let cls = "";
          if (qz.answered) {
            if (opt === curQ.answer) cls = "correct";
            else if (opt === qz.selectedSingle) cls = "wrong";
          }
          return `
            <button type="button" class="opt-btn ${cls}" data-opt-idx="${idx}" ${qz.answered ? "disabled" : ""}>
              <span class="opt-key">${optLabels[idx] || idx + 1}</span>
              <span style="flex:1">${esc(opt)}</span>
            </button>
          `;
        })
        .join("");
    }

    let feedbackHtml = "";
    if (qz.answered) {
      feedbackHtml = buildFeedbackHtml(qz.subj, curQ, qz.lastIsCorrect, qz.index + 1 === total);
    }

    const badgeCls = qz.subj === "english" ? "eng" : (qz.subj === "idiom_7_12" ? "idiom2" : (qz.subj === "idiom" ? "idiom" : (qz.subj === "science_3" ? "sci3" : "sci")));

    container.innerHTML = `
      <div class="quiz-container">
        <div class="view-header">
          <button type="button" class="pill-btn" id="quiz-exit-btn">← 返回目錄</button>
          <div style="text-align:center">
            <b style="font-size:1.08rem">${esc(qz.title)}</b>
          </div>
          <button type="button" class="pill-btn warn-btn" id="quiz-force-pass-btn" title="直接強制通過本關卡">
            ⚡ 強制過關
          </button>
        </div>

        <div class="quiz-card">
          <div class="quiz-prog-row">
            <span>📋 進度：第 ${qz.index + 1} / ${total} 題（答對 ${Math.min(PASS_SCORE, total)} 題過關）</span>
            <span>目前答對：<b>${qz.correctCount}</b> 題 (${progPct}%)</span>
          </div>
          <div class="quiz-prog-bar">
            <div class="quiz-prog-fill" style="width:${progPct}%"></div>
          </div>

          <div class="quiz-meta-row">
            <span class="sec-badge ${badgeCls}">📌 ${esc(unitTag)}</span>
            ${
              curQ.hint && !qz.answered
                ? `<button type="button" class="pill-btn" id="quiz-hint-btn">💡 ${qz.showHint ? "隱藏提示" : "看提示"}</button>`
                : ""
            }
          </div>

          ${
            isMulti
              ? `<div class="multi-notice">☑️ 【勾選題・多重選項】請點擊勾選所有正確的選項（可複選），完成後按下方「確認送出答案」！</div>`
              : ""
          }

          ${qz.showHint && curQ.hint && !qz.answered ? `<div class="hint-box">💡 提示：${esc(curQ.hint)}</div>` : ""}

          <h2 class="quiz-prompt">${esc(curQ.prompt)}</h2>

          ${
            curQ.type === "fill"
              ? `
            <div class="fill-container">
              <div style="font-weight:700;color:var(--eng);display:flex;align-items:center;gap:6px">
                <span>✏️ 請在下方空格輸入動詞的正確形式：</span>
              </div>
              <div class="fill-input-row">
                <input type="text" id="quiz-fill-input" class="fill-text-input" placeholder="在此輸入英文單字（如 speaks / am studying）..." value="${esc(qz.fillAnswer || "")}" ${qz.answered ? "disabled" : ""} autocomplete="off" autocapitalize="none" spellcheck="false">
                ${!qz.answered ? `<button type="button" class="fill-submit-btn" id="quiz-fill-submit-btn">✅ 送出答案</button>` : ""}
              </div>
              ${!qz.answered ? `<div style="font-size:0.85rem;color:var(--text-soft)">提示：輸入完畢後按 Enter 鍵或點擊上方「送出答案」按鈕；也可直接點選下方選項。</div>` : ""}
            </div>
          `
              : ""
          }

          <div class="options-list">
            ${optionsHtml}
          </div>

          ${
            isMulti && !qz.answered
              ? `
            <button type="button" class="multi-submit-btn" id="multi-submit-btn" ${qz.selectedMulti.length === 0 ? "disabled" : ""}>
              ✅ 確認送出勾選答案（已勾選 ${qz.selectedMulti.length} 項）
            </button>
          `
              : ""
          }

          ${feedbackHtml}
        </div>
      </div>
    `;

    
    const fillInput = document.getElementById("quiz-fill-input");
    const fillSubmitBtn = document.getElementById("quiz-fill-submit-btn");

    function handleFillSubmit() {
      if (!fillInput || qz.answered) return;
      const val = (fillInput.value || "").trim();
      if (!val) {
        fillInput.focus();
        return;
      }
      qz.fillAnswer = val;
      const cleanUser = val.toLowerCase().replace(/\s+/g, " ");
      const cleanAns = String(curQ.answer || "").trim().toLowerCase().replace(/\s+/g, " ");
      const isOk = cleanUser === cleanAns;
      finalizeQuestionAnswer(qz, curQ, isOk);
      renderQuizQuestion(container);
    }

    if (fillSubmitBtn) {
      fillSubmitBtn.onclick = handleFillSubmit;
    }
    if (fillInput && !qz.answered) {
      fillInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleFillSubmit();
        }
      };
      setTimeout(() => fillInput.focus(), 50);
    }

    document.getElementById("quiz-exit-btn").onclick = () => {
      state.view = "home";
      render();
    };

    document.getElementById("quiz-force-pass-btn").onclick = () => {
      qz.correctCount = total;
      qz.finished = true;
      recordQuizCompletion(qz);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const hintBtn = document.getElementById("quiz-hint-btn");
    if (hintBtn) {
      hintBtn.onclick = () => {
        qz.showHint = !qz.showHint;
        renderQuiz(container);
      };
    }

    container.querySelectorAll(".opt-btn[data-opt-idx]").forEach((btn) => {
      btn.onclick = () => {
        if (qz.answered) return;
        const idx = parseInt(btn.getAttribute("data-opt-idx"), 10);
        const chosen = curQ.shuffledOptions[idx];
        if (isMulti) {
          const pos = qz.selectedMulti.indexOf(chosen);
          if (pos >= 0) qz.selectedMulti.splice(pos, 1);
          else qz.selectedMulti.push(chosen);
          renderQuiz(container);
        } else {
          qz.selectedSingle = chosen;
          const isOk = chosen === curQ.answer;
          finalizeQuestionAnswer(qz, curQ, isOk);
          renderQuiz(container);
          scrollToFeedback();
        }
      };
    });

    const multiSubmitBtn = document.getElementById("multi-submit-btn");
    if (multiSubmitBtn) {
      multiSubmitBtn.onclick = () => {
        if (qz.answered || qz.selectedMulti.length === 0) return;
        const ansSet = new Set(curQ.answers || []);
        const selSet = new Set(qz.selectedMulti);
        let isOk = ansSet.size === selSet.size;
        if (isOk) {
          ansSet.forEach((a) => {
            if (!selSet.has(a)) isOk = false;
          });
        }
        finalizeQuestionAnswer(qz, curQ, isOk);
        renderQuiz(container);
        scrollToFeedback();
      };
    }

    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (qz.index + 1 < total) {
          qz.index++;
          qz.answered = false;
          qz.showHint = false;
          qz.selectedMulti = [];
          qz.selectedSingle = null;
          renderQuiz(container);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          qz.finished = true;
          recordQuizCompletion(qz);
          renderQuiz(container);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      };
    }
  }

  function scrollToFeedback() {
    setTimeout(() => {
      const fb = document.getElementById("quiz-feedback-box");
      if (fb) {
        fb.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  }

  function finalizeQuestionAnswer(qz, curQ, isOk) {
    qz.answered = true;
    qz.lastIsCorrect = isOk;
    const pSubj = curPlayer()[qz.subj];
    const qKey = getQuestionKey(qz.subj, curQ);

    if (isOk) {
      qz.correctCount++;
      pSubj.mastery[qKey] = (pSubj.mastery[qKey] || 0) + 1;
      if (qz.isCustomMistakeQuiz && pSubj.mistakes[qKey]) {
        delete pSubj.mistakes[qKey];
      }
    } else {
      pSubj.mastery[qKey] = 0;
      const existing = pSubj.mistakes[qKey];
      pSubj.mistakes[qKey] = {
        q: curQ,
        subj: qz.subj,
        level: qz.level,
        wrongCount: existing ? existing.wrongCount + 1 : 1,
        lastWrong: Date.now()
      };
      qz.roundMistakes.push(curQ);
    }
    saveStore();
    renderTopbar();
  }

  function buildFeedbackHtml(subj, curQ, isOk, isLast) {
    let detailHtml = "";
    if (subj === "idiom" || subj === "idiom_7_12") {
      const card = findIdiomCard(curQ, subj);
      if (card) {
        detailHtml = `
          <div class="feedback-detail">
            <div><b>📖 【${esc(card.idiom)}】</b> ${esc(card.zhuyin || "")}</div>
            <div style="margin-top:4px"><b>解釋：</b>${esc(card.meaning)}</div>
            <div style="margin-top:4px"><b>例句：</b>${esc(card.example)}</div>
          </div>
        `;
      } else if (curQ.hint) {
        detailHtml = `<div class="feedback-detail"><b>💡 解析：</b>${esc(curQ.hint)}</div>`;
      }
    } else if (subj === "english") {
      const card = findEngCard(curQ);
      if (card) {
        detailHtml = `
          <div class="feedback-detail">
            <div><b>🔤 【${esc(card.title)}】</b>（${esc(card.subUnit || "時態公式")}）</div>
            <div style="margin-top:4px"><b>時態公式：</b><pre style="white-space:pre-wrap;margin:4px 0;font-family:inherit;font-weight:700;color:var(--eng);">${esc(card.formula)}</pre></div>
            <div style="margin-top:4px"><b>💡 解析：</b>${esc(curQ.hint)}</div>
          </div>
        `;
      } else if (curQ.hint) {
        detailHtml = `<div class="feedback-detail"><b>💡 解析：</b>${esc(curQ.hint)}</div>`;
      }
    } else {
      const card = findSciCard(curQ);
      detailHtml = `
        <div class="feedback-detail">
          ${curQ.hint ? `<div><b>💡 題目解析：</b>${esc(curQ.hint)}</div>` : ""}
          ${
            card
              ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">
                   <b>🔬 觀念卡【${esc(card.title)}】：</b>${esc(card.summary)}
                 </div>`
              : ""
          }
        </div>
      `;
    }

    const ansText = curQ.isMulti ? (curQ.answers || []).join("、") : curQ.answer;

    return `
      <div class="feedback-card ${isOk ? "ok" : "bad"}" id="quiz-feedback-box">
        <h3 class="feedback-title">
          ${isOk ? "🎉 答對了！太棒了！" : "❌ 答錯囉！已自動加入錯題本"}
        </h3>
        <div><b>正確答案：</b>${esc(ansText)}</div>
        ${detailHtml}
        <button type="button" class="next-btn" id="quiz-next-btn">
          ${isLast ? "🏁 查看測驗結果 →" : "下一題 →"}
        </button>
      </div>
    `;
  }

  function recordQuizCompletion(qz) {
    if (qz.isCustomMistakeQuiz) return;
    const pSubj = curPlayer()[qz.subj];
    const total = qz.questions.length || 10;
    const score = Math.round((qz.correctCount / total) * 100);
    const prevHi = pSubj.highScores[qz.level] || 0;
    if (score > prevHi) {
      pSubj.highScores[qz.level] = score;
    }
    const needCorrect = Math.min(PASS_SCORE, total);
    if (qz.correctCount >= needCorrect && !pSubj.passedLevels.includes(qz.level)) {
      pSubj.passedLevels.push(qz.level);
    }
    saveStore();
  }

  function renderQuizResult(container, qz) {
    const total = qz.questions.length || 10;
    const score = Math.round((qz.correctCount / total) * 100);
    const passed = qz.correctCount >= Math.min(PASS_SCORE, total);
    let levels = [];
    if (qz.subj === "idiom_7_12") levels = IDIOM_DATA_7_12.levels;
    else if (qz.subj === "idiom") levels = IDIOM_DATA_1_6.levels;
    else levels = SCI_DATA.levels;

    const hasNextLevel = !qz.isCustomMistakeQuiz && levels.some((l) => l.level === qz.level + 1);
    const nextBtnCls = qz.subj === "idiom_7_12" ? "idiom2-btn" : (qz.subj === "idiom" ? "idiom-btn" : "sci-btn");

    container.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-card" style="text-align:center">
          <div style="font-size:3.2rem;margin-bottom:6px">${passed ? "🏆" : "💪"}</div>
          <h2 style="margin:0 0 8px;font-size:1.6rem">
            ${passed ? "恭喜過關！" : "再接再厲，差一點就過關了！"}
          </h2>
          <p style="color:var(--text-soft);margin:0 0 18px">${esc(qz.title)}</p>

          <div style="display:inline-block;padding:16px 32px;border-radius:var(--radius-lg);background:var(--surface-2);border:2px solid var(--border);margin-bottom:22px">
            <div style="font-size:0.85rem;color:var(--text-soft);font-weight:700">本次得分</div>
            <div style="font-size:2.6rem;font-weight:900;color:${passed ? "var(--ok)" : "var(--warn)"}">${score} 分</div>
            <div style="font-size:0.9rem;color:var(--text-soft)">答對 ${qz.correctCount} / ${total} 題</div>
          </div>

          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:8px">
            <button type="button" class="pill-btn primary" id="res-retry-btn">🔄 再挑戰一次</button>
            ${
              hasNextLevel
                ? `<button type="button" class="pill-btn ${nextBtnCls}" id="res-next-lv-btn">⏭️ 挑戰下一關 (Level ${qz.level + 1})</button>`
                : ""
            }
            <button type="button" class="pill-btn" id="res-home-btn">🏠 返回首頁目錄</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("res-retry-btn").onclick = () => {
      if (qz.isCustomMistakeQuiz) {
        state.view = "mistakes";
        render();
      } else {
        startQuiz(qz.subj, qz.level);
      }
    };
    const nextLvBtn = document.getElementById("res-next-lv-btn");
    if (nextLvBtn) {
      nextLvBtn.onclick = () => startQuiz(qz.subj, qz.level + 1);
    }
    document.getElementById("res-home-btn").onclick = () => {
      state.view = "home";
      render();
    };
  }

  /* ---------- 專屬錯題溫習本 (#view-mistakes) ---------- */
  function renderMistakes(container) {
    const p = curPlayer();
    const idiom1Mistakes = Object.entries(p.idiom.mistakes).map(([k, v]) => Object.assign({ key: k }, v));
    const idiom2Mistakes = Object.entries(p.idiom_7_12.mistakes).map(([k, v]) => Object.assign({ key: k }, v));
    const sciMistakes = Object.entries(p.science.mistakes).map(([k, v]) => Object.assign({ key: k }, v));

    let combined = [];
    if (state.mistakeSubj === "all" || state.mistakeSubj === "idiom") combined = combined.concat(idiom1Mistakes);
    if (state.mistakeSubj === "all" || state.mistakeSubj === "idiom_7_12") combined = combined.concat(idiom2Mistakes);
    if (state.mistakeSubj === "all" || state.mistakeSubj === "science") combined = combined.concat(sciMistakes);
    if (state.mistakeSubj === "all" || state.mistakeSubj === "science_3") combined = combined.concat(sci3Mistakes);
    if (state.mistakeSubj === "all" || state.mistakeSubj === "english") combined = combined.concat(engMistakes);

    if (state.mistakeFrequentOnly) {
      combined = combined.filter((m) => m.wrongCount >= 2);
    }
    combined.sort((a, b) => (b.wrongCount || 1) - (a.wrongCount || 1));

    const totalAll = idiom1Mistakes.length + idiom2Mistakes.length + sciMistakes.length;

    container.innerHTML = `
      <div class="view-header">
        <button type="button" class="pill-btn" id="mistakes-back-btn">← 返回首頁目錄</button>
        <h2 style="margin:0">📝 ${esc(store.currentPlayer)} 的專屬錯題溫習本</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${
            combined.length > 0
              ? `<button type="button" class="pill-btn primary" id="mistakes-quiz-btn">🎯 錯題強化測驗 (${Math.min(10, combined.length)} 題)</button>`
              : ""
          }
        </div>
      </div>

      <div class="filter-bar">
        <div class="subject-tabs">
          <button type="button" class="tab-btn ${state.mistakeSubj === "all" ? "active" : ""}" data-m-subj="all">
            全部錯題 (${totalAll})
          </button>
          <button type="button" class="tab-btn ${state.mistakeSubj === "idiom" ? "active" : ""}" data-subj="idiom" data-m-subj="idiom">
            📕 成語 1~6 課 (${idiom1Mistakes.length})
          </button>
          <button type="button" class="tab-btn ${state.mistakeSubj === "idiom_7_12" ? "active" : ""}" data-subj="idiom_7_12" data-m-subj="idiom_7_12">
            📘 成語 7~12 課 (${idiom2Mistakes.length})
          </button>
          <button type="button" class="tab-btn ${state.mistakeSubj === "science" ? "active" : ""}" data-subj="science" data-m-subj="science">
            🌿 四上自然 (${sciMistakes.length})
          </button>
        </div>
        <button type="button" class="pill-btn ${state.mistakeFrequentOnly ? "warn-btn" : ""}" id="mistakes-freq-btn">
          🔥 ${state.mistakeFrequentOnly ? "顯示全部錯題" : "只看常錯題 (錯 2 次以上)"}
        </button>
      </div>

      ${
        combined.length === 0
          ? `
        <div class="subject-section" style="text-align:center;padding:48px 20px">
          <div style="font-size:3rem;margin-bottom:8px">🎉</div>
          <h3>目前沒有符合條件的錯題紀錄！</h3>
          <p style="color:var(--text-soft)">繼續去闖關挑戰，答錯的題目會自動幫你收集在這裡方便溫習喔！</p>
        </div>
      `
          : `
        <div class="study-cards-grid">
          ${combined
            .map((m) => {
              const q = m.q;
              const ans = q.isMulti ? (q.answers || []).join("、") : q.answer;
              const subjTag = m.subj === "idiom_7_12"
                ? "📘 成語 7~12 課"
                : m.subj === "idiom"
                ? "📕 成語 1~6 課"
                : "🌿 四上自然";
              const badgeCls = m.subj === "idiom_7_12" ? "idiom2" : m.subj === "idiom" ? "idiom" : "sci";
              return `
                <article class="study-card">
                  <div class="study-card-top">
                    <span class="sec-badge ${badgeCls}">
                      ${subjTag}・Level ${m.level || 1}
                    </span>
                    <span class="ant-chip">累計答錯 ${m.wrongCount || 1} 次</span>
                  </div>
                  <h3 style="font-size:1.05rem;line-height:1.5">${esc(q.prompt)}</h3>
                  <div class="study-box">
                    <b>✅ 正確答案</b>
                    ${esc(ans)}
                  </div>
                  ${
                    q.hint
                      ? `<div class="study-box"><b>💡 解析與提示</b>${esc(q.hint)}</div>`
                      : ""
                  }
                  <div style="margin-top:auto;padding-top:8px;text-align:right">
                    <button type="button" class="pill-btn" data-remove-mistake="${esc(m.key)}" data-remove-subj="${esc(m.subj)}">
                      ✓ 我學會了（移除此題）
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `
      }
    `;

    document.getElementById("mistakes-back-btn").onclick = () => {
      state.view = "home";
      render();
    };

    const freqBtn = document.getElementById("mistakes-freq-btn");
    if (freqBtn) {
      freqBtn.onclick = () => {
        state.mistakeFrequentOnly = !state.mistakeFrequentOnly;
        renderMistakes(container);
      };
    }

    container.querySelectorAll("[data-m-subj]").forEach((btn) => {
      btn.onclick = () => {
        state.mistakeSubj = btn.getAttribute("data-m-subj");
        renderMistakes(container);
      };
    });

    const quizBtn = document.getElementById("mistakes-quiz-btn");
    if (quizBtn && combined.length > 0) {
      quizBtn.onclick = () => {
        const targetSubj = state.mistakeSubj === "all" ? combined[0].subj : state.mistakeSubj;
        const pool = combined.filter((m) => m.subj === targetSubj).map((m) => m.q);
        const picked = shuffleArray(pool).slice(0, 10);
        startQuiz(targetSubj, 1, picked, "📝 錯題強化複習測驗（答對即自動消除錯題）");
      };
    }

    container.querySelectorAll("[data-remove-mistake]").forEach((btn) => {
      btn.onclick = () => {
        const k = btn.getAttribute("data-remove-mistake");
        const s = btn.getAttribute("data-remove-subj");
        if (p[s] && p[s].mistakes[k]) {
          delete p[s].mistakes[k];
          saveStore();
          renderTopbar();
          renderMistakes(container);
        }
      };
    });
  }

  /* ---------- A4 榮譽證書視圖 (#view-cert) ---------- */
  function renderCert(container) {
    const isIdiom1 = state.certSubj === "idiom";
    const isIdiom2 = state.certSubj === "idiom_7_12";
    const isSci3 = state.certSubj === "science_3";
    const isEng = state.certSubj === "english";
    const today = new Date().toLocaleDateString("zh-TW");
    const certSubjectName = isIdiom2
      ? "【國語成語大挑戰（第 7～12 課）】"
      : isIdiom1
      ? "【國語成語大挑戰（第 1～6 課）】"
      : isSci3
      ? "【自然科學探究大挑戰（第 3 課：聲音與光）】"
      : isEng
      ? "【英文文法專題大挑戰（現在式四大時態）】"
      : "【自然科學探究大挑戰（第 1～2 課）】";

    const certDesc = isIdiom2
      ? "第 7～12 課 36 個成語與 5 大關卡"
      : isIdiom1
      ? "第 1～6 課 36 個成語與 5 大關卡"
      : isSci3
      ? "第 3 課聲音振動傳播、光反射與 8 大關卡"
      : isEng
      ? "現在簡單式、現在進行式、現在完成式、現在完成進行式 2 大關卡全通關"
      : "第 1～2 課地表岩石、水生生物與 8 大關卡";

    container.innerHTML = `
      <div class="view-header no-print">
        <button type="button" class="pill-btn" id="cert-back-btn">← 返回首頁目錄</button>
        <button type="button" class="pill-btn primary" id="cert-print-btn">🖨️ 列印 A4 榮譽證書</button>
      </div>
      <div class="cert-box">
        <div style="font-size:3rem">🎓</div>
        <h1 style="margin:8px 0;font-size:2rem">EmmaQQ筆記本・榮譽結業證書</h1>
        <p style="font-size:1.1rem;color:#475569">國小四年級上學期 ${certSubjectName}</p>
        <hr style="border:none;border-top:2px dashed #cbd5e1;margin:24px 0">
        <p style="font-size:1.25rem;line-height:2">
          茲證明挑戰者 <b style="font-size:1.65rem;color:#4f46e5;text-decoration:underline">${esc(store.currentPlayer)}</b><br>
          已完成四年級上學期 <b>${certDesc}</b> 全部試煉，<br>
          表現優異，特頒此證，以資鼓勵！
        </p>
        <p style="margin-top:32px;color:#64748b;font-weight:700">頒發日期：${esc(today)}</p>
      </div>
    `;
    document.getElementById("cert-back-btn").onclick = () => {
      state.view = "home";
      render();
    };
    document.getElementById("cert-print-btn").onclick = () => window.print();
  }

  /* ---------- 多玩家切換 Modal ---------- */
  function openPlayerModal() {
    let modal = document.getElementById("player-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "player-modal";
      modal.className = "modal-backdrop";
      document.body.appendChild(modal);
    }
    modal.hidden = false;

    const names = Object.keys(store.players);
    modal.innerHTML = `
      <div class="modal-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">👤 切換或新增挑戰者</h3>
          <button type="button" class="pill-btn" id="modal-close-btn">✕ 關閉</button>
        </div>
        <p style="margin:0 0 12px;font-size:0.88rem;color:var(--text-soft)">
          不同挑戰者擁有各自獨立的過關進度、題目熟悉度權重與專屬錯題本。
        </p>
        <div class="player-list">
          ${names
            .map((n) => {
              const pd = store.players[n];
              const passCnt =
                (pd.idiom ? pd.idiom.passedLevels.length : 0) +
                (pd.idiom_7_12 ? pd.idiom_7_12.passedLevels.length : 0) +
                (pd.science ? pd.science.passedLevels.length : 0);
              const mCnt =
                (pd.idiom ? Object.keys(pd.idiom.mistakes).length : 0) +
                (pd.idiom_7_12 ? Object.keys(pd.idiom_7_12.mistakes).length : 0) +
                (pd.science ? Object.keys(pd.science.mistakes).length : 0);
              const isCur = n === store.currentPlayer;
              return `
                <div class="player-item ${isCur ? "active" : ""}">
                  <div>
                    <b>${esc(n)}</b> ${isCur ? `<span class="sec-badge idiom">目前使用</span>` : ""}
                    <div style="font-size:0.78rem;color:var(--text-soft)">已過 ${passCnt} 關・錯題 ${mCnt} 題</div>
                  </div>
                  <div style="display:flex;gap:6px">
                    ${
                      !isCur
                        ? `<button type="button" class="pill-btn primary" data-switch-player="${esc(n)}">切換</button>`
                        : ""
                    }
                    ${
                      names.length > 1
                        ? `<button type="button" class="pill-btn" data-del-player="${esc(n)}" title="刪除此玩家">🗑️</button>`
                        : ""
                    }
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <input type="text" id="new-player-input" placeholder="輸入新挑戰者名稱..." style="flex:1;padding:9px 14px;border-radius:999px;border:1.5px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">
          <button type="button" class="pill-btn primary" id="add-player-btn">＋ 新增</button>
        </div>
      </div>
    `;

    document.getElementById("modal-close-btn").onclick = () => (modal.hidden = true);
    modal.onclick = (e) => {
      if (e.target === modal) modal.hidden = true;
    };

    modal.querySelectorAll("[data-switch-player]").forEach((btn) => {
      btn.onclick = () => {
        store.currentPlayer = btn.getAttribute("data-switch-player");
        saveStore();
        modal.hidden = true;
        state.view = "home";
        render();
      };
    });

    modal.querySelectorAll("[data-del-player]").forEach((btn) => {
      btn.onclick = () => {
        const target = btn.getAttribute("data-del-player");
        if (Object.keys(store.players).length <= 1) return;
        delete store.players[target];
        if (store.currentPlayer === target) {
          store.currentPlayer = Object.keys(store.players)[0];
        }
        saveStore();
        openPlayerModal();
        render();
      };
    });

    document.getElementById("add-player-btn").onclick = () => {
      const inp = document.getElementById("new-player-input");
      const name = (inp.value || "").trim();
      if (!name) return;
      if (!store.players[name]) {
        store.players[name] = defaultPlayerData();
      }
      store.currentPlayer = name;
      saveStore();
      modal.hidden = true;
      state.view = "home";
      render();
    };
  }

  /* ---------- 主渲染入口 ---------- */
  function render() {
    renderTopbar();
    const main = document.getElementById("app-root");
    if (!main) return;
    if (state.view === "home") renderHome(main);
    else if (state.view === "study") renderStudy(main);
    else if (state.view === "quiz") renderQuiz(main);
    else if (state.view === "mistakes") renderMistakes(main);
    else if (state.view === "cert") renderCert(main);
  }

  /* ---------- 啟動與預設科目路由 ---------- */
  function boot() {
    initTheme();
    const defaultSubj = document.body.getAttribute("data-default-subj");
    const urlSubj = new URLSearchParams(window.location.search).get("subj");
    if (["idiom", "idiom_7_12", "science", "science_3", "english"].includes(urlSubj)) {
      state.subjFilter = urlSubj;
    } else if (["idiom", "idiom_7_12", "science", "science_3", "english"].includes(defaultSubj)) {
      state.subjFilter = defaultSubj;
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
