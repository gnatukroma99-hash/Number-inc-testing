$rules = Get-Content 'c:\Users\HomePC\Desktop\my adblock\rules.json' -Raw | ConvertFrom-Json
Write-Host "Total rules parsed: $($rules.Count)"
$dup = $rules | Group-Object id | Where-Object { $_.Count -gt 1 }
if ($dup) {
    Write-Host "Duplicate IDs found!"
} else {
    Write-Host "All rule IDs are unique!"
}
