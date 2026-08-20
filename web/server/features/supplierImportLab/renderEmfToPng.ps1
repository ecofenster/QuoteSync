param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [int]$LongEdgePixels = 2400
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$metafile = [System.Drawing.Imaging.Metafile]::new($InputPath)
try {
  $aspect = $metafile.Width / [double]$metafile.Height
  if ($aspect -ge 1) {
    $width = $LongEdgePixels
    $height = [Math]::Max(1, [Math]::Round($LongEdgePixels / $aspect))
  } else {
    $height = $LongEdgePixels
    $width = [Math]::Max(1, [Math]::Round($LongEdgePixels * $aspect))
  }
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $bitmap.SetResolution(300, 300)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($metafile, 0, 0, $width, $height)
    } finally { $graphics.Dispose() }
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $bitmap.Dispose() }
  @{ widthPx = $width; heightPx = $height; dpi = 300 } | ConvertTo-Json -Compress
} finally { $metafile.Dispose() }
