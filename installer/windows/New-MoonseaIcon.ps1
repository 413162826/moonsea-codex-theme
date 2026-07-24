[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "moonsea.ico")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MoonseaIconNative {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr handle);
}
"@

$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$ink = [System.Drawing.Color]::FromArgb(255, 16, 40, 46)
$paper = [System.Drawing.Color]::FromArgb(255, 241, 242, 237)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $ink), 8, 8, 240, 240)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $paper), 79, 59, 105, 138)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $ink), 112, 59, 105, 138)

$handle = $bitmap.GetHicon()
try {
    $icon = [System.Drawing.Icon]::FromHandle($handle)
    $stream = [System.IO.File]::Create([System.IO.Path]::GetFullPath($OutputPath))
    try {
        $icon.Save($stream)
    }
    finally {
        $stream.Dispose()
        $icon.Dispose()
    }
}
finally {
    [MoonseaIconNative]::DestroyIcon($handle) | Out-Null
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Output ([System.IO.Path]::GetFullPath($OutputPath))
