# EmmaQQ筆記本 (Elementary_game)

國小互動學習平台，整合 **國語成語（1～6 課、7～12 課）**、**自然科學（四上1~2課、四上 第3課有趣的聲光現象）** 與 **英文文法專題（現在式四大時態）** 的重點圖鑑筆記、A-Res 自適應闖關練習與專屬錯題本。

## 🌐 線上網址 (GitHub Pages)
- **平台首頁**：https://bgbgterry.github.io/Elementary_game/
- 📕 **四上成語 1～6 課**：https://bgbgterry.github.io/Elementary_game/idiom.html
- 📘 **四上成語 7～12 課**：https://bgbgterry.github.io/Elementary_game/idiom_7_12.html
- 🌿 **四上1~2課（地表岩石＆水生生物）**：https://bgbgterry.github.io/Elementary_game/science.html
- 🔬 **四上 第3課有趣的聲光現象**：https://bgbgterry.github.io/Elementary_game/science_3.html
- 🔤 **英文・文法專題（現在式四大時態）**：https://bgbgterry.github.io/Elementary_game/english.html

## 📚 單元與題庫規模總覽

| 單元名稱 | 圖鑑／重點卡 | 關卡數 | 總題庫數 | 題型特色 |
| :--- | :---: | :---: | :---: | :--- |
| **四上成語 1～6 課** | 36 張 | 5 關 | 210 題 | 四選一單選題（含釋義、注音、例句、近反義詞） |
| **四上成語 7～12 課** | 36 張 | 5 關 | 210 題 | 四選一單選題（含釋義、注音、例句、近反義詞） |
| **四上1~2課（自然）** | 48 張 | 8 關 | 336 題 | 單選題 ＋ ☑️ 多重勾選題（不提示應選數量） |
| **四上 第3課有趣的聲光現象** | 48 張 | 8 關 | 336 題 | 單選題 ＋ ☑️ 多重勾選題（不提示應選數量） |
| **英文・文法（現在式四大時態）** | 8 張 ＋ 核心心智圖 | 2 關 | 60 題 | 四選一單選題 ＋ 英文動詞變化填空題 |

## ✨ 核心功能特色
1. **簡潔直覺首頁目錄**：快速切換全部科目或單一單元，支援關鍵字即時搜尋與「繼續上次練習」記憶。
2. **題目與觀念卡 100% 精準對應**：每道題目皆精確綁定所屬單元標籤與專屬觀念卡，答題後與錯題本內皆同步呈現「題目解析 ＋ 觀念卡摘要」。
3. **A-Res 自適應加權抽題**：每關隨機抽取 10 題（答對 8 題過關），答對過的題目自動降低重複率，優先抽取未答過的新題與常錯題。
4. **多玩家獨立紀錄與專屬錯題本**：支援多位挑戰者切換、各科目錯題分類篩選、常錯題篩選與錯題強化複習測驗（答對自動消除）。
5. **A4 榮譽結業證書與護眼深色模式**：單科全數通關即可領取並列印專屬榮譽證書。

## 📂 目錄檔案架構總覽

```text
Elementary_game/
├── index.html               # 平台總首頁（預設顯示全部科目）
├── idiom.html               # 四上成語 1～6 課專頁
├── idiom_7_12.html          # 四上成語 7～12 課專頁
├── science.html             # 四上1~2課 自然專頁
├── science_3.html           # 四上 第3課有趣的聲光現象 專頁
├── english.html             # 英文・文法（現在式四大時態）專頁
├── idioms_data.json         # 成語 1～6 課原始 JSON 題庫
├── game_data.js             # 成語 1～6 課前端載入資料 (window.GAME_DATA)
├── idioms_data_7_12.json    # 成語 7～12 課原始 JSON 題庫
├── game_data_7_12.js        # 成語 7～12 課前端載入資料 (window.GAME_DATA_7_12)
├── science_data.json        # 四上1~2課 336 題與 48 張觀念卡 JSON
├── science_game_data.js     # 四上1~2課 前端載入資料 (window.SCIENCE_GAME_DATA)
├── science_data_3.json      # 四上第3課 336 題與 48 張觀念卡 JSON
├── science_game_data_3.js   # 四上第3課 前端載入資料 (window.SCIENCE_GAME_DATA_3)
├── english_data.json        # 英文文法 60 題、8 張文法卡與心智圖 JSON
├── english_game_data.js     # 英文文法 前端載入資料 (window.ENGLISH_GAME_DATA)
├── PushGitHub.bat           # 一鍵提交與推送至 GitHub 批次檔
├── README.md                # 專案架構與功能說明文件
└── assets/
    ├── css/
    │   └── style.css        # 全站響應式卡片風格、深色模式、心智圖與列印樣式
    └── js/
        └── app.js           # 核心 SPA 路由、自適應抽題、題目觀念卡對應與錯題本引擎
```

## 🚀 本地使用與部署方式
- **本地瀏覽**：直接以瀏覽器開啟 `index.html`（或任一科目專頁 HTML）即可離線使用，無須安裝伺服器。
- **發布至 GitHub Pages**：於目錄下執行 `git add -A && git commit -m "..." && git push origin main`（或雙擊 `PushGitHub.bat`）。
