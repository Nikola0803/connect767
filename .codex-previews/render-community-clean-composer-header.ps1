Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(1360, 420)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
function B($hex) { New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function P($hex, $w = 1) { New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $w) }
function F($family, $size, $style = [System.Drawing.FontStyle]::Regular) { New-Object System.Drawing.Font($family, $size, $style) }
function RR($x, $y, $w, $h, $r, $fill, $stroke = $null) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90); $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure(); $g.FillPath($fill, $path); if ($stroke) { $g.DrawPath($stroke, $path) }; $path.Dispose()
}
function T($text, $font, $brush, $x, $y) { $g.DrawString($text, $font, $brush, $x, $y) }

$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F7F5EF'))
$white = B '#FFFFFF'; $ink = B '#17221B'; $muted = B '#68716C'; $green = B '#006B3C'; $mint = B '#EAF8F1'; $line = P '#E7E0D5'
RR 40 42 1280 330 28 $white $line

# Clean heading row
RR 72 74 42 42 13 $mint
T 'A' (F 'Georgia' 15 ([System.Drawing.FontStyle]::Italic)) $green 84 84
T 'What Would You Like to Share?' (F 'Georgia' 21 ([System.Drawing.FontStyle]::Bold)) $ink 132 73
T 'Publish an update and connect it to your directory profile.' (F 'Arial' 10) $muted 132 103

# Lightweight standalone filters
RR 930 75 150 42 13 $white (P '#DDD5C9')
RR 942 83 26 26 9 $mint
T '*' (F 'Arial' 14 ([System.Drawing.FontStyle]::Bold)) $green 950 84
T 'For you' (F 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $ink 979 87
T 'v' (F 'Arial' 9) $muted 1054 89
RR 1092 75 190 42 13 $white (P '#DDD5C9')
RR 1104 83 26 26 9 $mint
T '#' (F 'Arial' 12 ([System.Drawing.FontStyle]::Bold)) $green 1112 86
T 'All Posts' (F 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $ink 1142 87
T 'v' (F 'Arial' 9) $muted 1256 89

$g.DrawLine((P '#EEE8DE'), 72, 142, 1288, 142)

# Composer preview
RR 72 171 48 48 16 $green
T 'JL' (F 'Arial' 12 ([System.Drawing.FontStyle]::Bold)) $white 88 186
RR 136 164 1152 132 19 (B '#FBFAF7') (P '#E2DACE')
T 'Share a business update from James Local Fruits...' (F 'Arial' 13) $muted 160 187
RR 152 247 32 32 9 $mint
T '@' (F 'Arial' 13 ([System.Drawing.FontStyle]::Bold)) $green 161 252
T 'Type @ to mention a directory listing' (F 'Arial' 9) $muted 196 256

T 'Cleaner hierarchy  /  less visual nesting  /  mobile-ready wrapping' (F 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $green 72 328

$output = Join-Path $PSScriptRoot 'community-clean-composer-header.png'
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bitmap.Dispose(); $output
