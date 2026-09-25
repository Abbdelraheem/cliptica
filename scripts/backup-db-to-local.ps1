# Cliptica - Automated Local Backup Script
# Pulls a fresh PostgreSQL backup from the production EC2 server to this PC

$KeyPath = "C:\Users\Dr.Abdelraheem\Downloads\cliptica-key.pem"
$Server = "ubuntu@13.62.192.145"
$BackupDir = "c:\Users\Dr.Abdelraheem\Desktop\cliptica\backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupDir "cliptica_backup_$Timestamp.sql"
$LatestFile = Join-Path $BackupDir "cliptica_production_backup.sql"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " [Cliptica] Starting Database Backup..." -ForegroundColor Yellow
Write-Host " Remote Server: $Server" -ForegroundColor Gray
Write-Host " Saving To: $BackupFile" -ForegroundColor Gray
Write-Host "=========================================" -ForegroundColor Cyan

# Stream pg_dump directly through SSH to local file
ssh -i $KeyPath -o StrictHostKeyChecking=no $Server "sudo -u postgres pg_dump cliptica" > $BackupFile

if ((Test-Path $BackupFile) -and ((Get-Item $BackupFile).Length -gt 1000)) {
    Copy-Item $BackupFile $LatestFile -Force
    $SizeKB = [math]::Round(((Get-Item $BackupFile).Length / 1KB), 2)
    Write-Host "`n✓ BACKUP SUCCESSFUL!" -ForegroundColor Green
    Write-Host "  File: $BackupFile" -ForegroundColor White
    Write-Host "  Size: $SizeKB KB" -ForegroundColor White
    Write-Host "  Updated Latest: $LatestFile" -ForegroundColor White
} else {
    Write-Host "`n✗ BACKUP FAILED or file is empty!" -ForegroundColor Red
    if (Test-Path $BackupFile) {
        Get-Content $BackupFile | Select-Object -First 10
    }
}
