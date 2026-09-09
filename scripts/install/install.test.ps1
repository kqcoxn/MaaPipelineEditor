$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'install.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
$ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false) | ForEach-Object {
    Invoke-Expression $_.Extent.Text
}

# 只加载函数并模拟网络与文件状态，不运行安装入口、不写入用户运行环境。
function Invoke-RestMethod { param($Uri, $Headers) return @{ tag_name = 'v5.13.0' } }
function Invoke-WebRequest { param($Uri, [switch]$UseBasicParsing)
    if ($Uri -notlike '*/v2.0.0/Editor/src/stores/app/configStore.ts') { throw "Unexpected config URL: $Uri" }
    return @{ Content = 'mfwVersion: "5.13.0",' }
}
$REPO = 'kqcoxn/MaaPipelineEditor'
if ((Get-RequiredMaaFrameworkVersion 'v2.0.0') -ne 'v5.13.0') { throw 'Incorrect required version' }

$MAAFW_BIN_DIR = 'managed-bin'
$MAAFW_AGENT_DIR = 'managed-agent'
function Test-NonEmptyDirectory($path) { return $path -eq $MAAFW_BIN_DIR -or $script:hasAgent }
function Get-InstalledMaaFrameworkVersion { return $script:installed }
function Get-GitHubRelease($repo, $tag) {
    if ($repo -ne 'MaaXYZ/MaaFramework' -or $tag -ne 'v5.13.0') { throw 'Incorrect release requested' }
    $script:requested = $true
    throw 'DownloadRequired'
}
foreach ($case in @(
    @{ Version = 'v5.13.0'; Agent = $true; Download = $false },
    @{ Version = '5.13.0'; Agent = $true; Download = $false },
    @{ Version = 'v5.12.0'; Agent = $true; Download = $true },
    @{ Version = 'v5.14.0'; Agent = $true; Download = $true },
    @{ Version = ''; Agent = $true; Download = $true },
    @{ Version = 'v5.13.0'; Agent = $false; Download = $true }
)) {
    $script:installed = $case.Version
    $script:hasAgent = $case.Agent
    $script:requested = $false
    try { Install-MaaFramework 'v5.13.0' } catch {
        if ($_.Exception.Message -ne 'DownloadRequired') { throw }
    }
    if ($script:requested -ne $case.Download) { throw "Wrong decision: $($case | ConvertTo-Json -Compress)" }
}
Write-Host 'MaaFramework version selection tests passed.'
