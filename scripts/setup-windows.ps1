$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Cần cài Git trước: https://git-scm.com/download/win' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Cần cài Node.js 22.12+ trước: https://nodejs.org/' }
$version = (node -p 'process.versions.node')
if ([int]($version.Split('.')[0]) -lt 22 -or ([int]($version.Split('.')[0]) -eq 22 -and [int]($version.Split('.')[1]) -lt 12)) { throw "Node.js $version quá cũ; yêu cầu Node 22.12+" }
$source = Join-Path (Get-Location) '.vendor/siwc-devkit'
if (-not (Test-Path $source)) {
  New-Item -ItemType Directory -Force -Path '.vendor' | Out-Null
  git clone --depth 1 https://github.com/openai/sign-in-with-chatgpt-devkit.git $source
  if ($LASTEXITCODE -ne 0) { throw 'Không tải được OpenAI DevKit' }
}
Push-Location $source
try {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Cài DevKit thất bại' }
  npm run build -w '@siwc/local'
  if ($LASTEXITCODE -ne 0) { throw 'Biên dịch DevKit thất bại' }
} finally { Pop-Location }
$dest = 'vendor/siwc-local'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$source/packages/local/dist" "$dest/dist" -Recurse -Force
Copy-Item "$source/packages/local/package.json" "$dest/package.json" -Force
Copy-Item "$source/LICENSE" "$dest/LICENSE" -Force
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install thất bại' }
Write-Host "`n[THANH CONG] Đã cài Novel NAME Plus. Chạy: npm start" -ForegroundColor Green
