$files = Get-ChildItem -Path 'C:\Users\Imran hossan\store\webstore-backend' -Recurse -File -Include *.js,*.ts | Where-Object { $_.FullName -notmatch '\\node_modules\\' }
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'models/codex\.model\.js') {
        Write-Host "Fixed: $($file.FullName)"
        $updated = $content -replace 'models/codex\.model\.js', 'models/Codex.model.js'
        Set-Content $file.FullName $updated -Encoding UTF8 -NoNewline
    }
}
Write-Host "Search and Replace Complete."
