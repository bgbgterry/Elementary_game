@echo off
chcp 65001 >nul
echo ========================================================
echo 🚀 EmmaQQ筆記本 (Elementary_game) —— 一鍵發布至 GitHub
echo ========================================================
echo.

cd /d "H:\真真\Elementary_game"

echo 1. 正在檢查 Git 狀態並加入變更...
git add -A

git diff --cached --quiet
if %errorlevel% equ 0 (
    echo    [*] 本地檔案無新增變更，準備確認遠端同步...
) else (
    echo    [OK] 正在建立更新紀錄 Commit...
    git commit -m "Update EmmaQQ筆記本 (Elementary_game)"
)

echo.
echo 2. 正在同步並上傳至 GitHub (bgbgterry/Elementary_game)...
git pull --rebase origin main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo 🎉 上傳成功！GitHub Pages 將在 1~2 分鐘內自動更新：
    echo 🌐 https://bgbgterry.github.io/Elementary_game/
    echo ========================================================
) else (
    echo.
    echo ⚠️ 上傳遇到問題，請確認網路連線或 GitHub 權限。
)
echo.
pause
