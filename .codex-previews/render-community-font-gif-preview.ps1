Add-Type -AssemblyName System.Drawing

$width = 1440
$height = 980
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Brush($hex) { New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function Pen($hex, $size = 1) { New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $size) }
function Font($family, $size, $style = [System.Drawing.FontStyle]::Regular) { New-Object System.Drawing.Font($family, $size, $style) }
function RoundRect($g, $x, $y, $w, $h, $r, $fill, $stroke = $null) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($fill, $path)
  if ($stroke) { $g.DrawPath($stroke, $path) }
  $path.Dispose()
}
function Text($g, $value, $font, $brush, $x, $y) { $g.DrawString($value, $font, $brush, $x, $y) }

$bg = Brush '#F8F6F0'
$white = Brush '#FFFFFF'
$ink = Brush '#15251D'
$muted = Brush '#66736C'
$green = Brush '#006B3C'
$mint = Brush '#EAF8F1'
$line = Pen '#E8E1D5'
$accent = Brush '#EF5A3C'
$cream = Brush '#FBFAF7'
$graphics.FillRectangle($bg, 0, 0, $width, $height)

Text $graphics 'CONNECT  /  SHARE  /  GROW' (Font 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $green 92 55
Text $graphics 'Business community' (Font 'Georgia' 38) $ink 90 78
Text $graphics 'Create expressive updates with custom type and animated GIFs.' (Font 'Arial' 13) $muted 92 135

RoundRect $graphics 80 185 1280 710 28 $white $line
Text $graphics 'What Would You Like to Share?' (Font 'Georgia' 21 ([System.Drawing.FontStyle]::Bold)) $ink 115 215
Text $graphics 'Choose a font style, add a GIF, and publish it to your community.' (Font 'Arial' 11) $muted 115 249

# Avatar
RoundRect $graphics 115 292 54 54 18 $green
Text $graphics 'JL' (Font 'Arial' 14 ([System.Drawing.FontStyle]::Bold)) $white 131 309

# Composer
RoundRect $graphics 188 285 1118 180 20 $cream (Pen '#DDD4C6')
Text $graphics 'Fresh fruit boxes are ready for the weekend!' (Font 'Georgia' 22) $ink 220 315
Text $graphics 'Type @ to mention a directory listing' (Font 'Arial' 10) $muted 258 417
RoundRect $graphics 212 402 34 34 10 $mint
Text $graphics '@' (Font 'Arial' 14 ([System.Drawing.FontStyle]::Bold)) $green 220 408

# Controls row
RoundRect $graphics 188 482 1118 68 18 (Brush '#FBFAF7') $line
RoundRect $graphics 208 495 150 42 12 $mint
Text $graphics 'Aa  Editorial' (Font 'Georgia' 13 ([System.Drawing.FontStyle]::Bold)) $green 225 507
RoundRect $graphics 372 495 118 42 12 $cream (Pen '#DED6CB')
Text $graphics 'Attach  v' (Font 'Arial' 11 ([System.Drawing.FontStyle]::Bold)) $ink 395 508
Text $graphics 'Feeling' (Font 'Arial' 11) $ink 520 509
Text $graphics 'Location' (Font 'Arial' 11) $ink 650 509
RoundRect $graphics 1138 495 145 42 12 $green
Text $graphics 'Post update' (Font 'Arial' 11 ([System.Drawing.FontStyle]::Bold)) $white 1170 508

# Font panel
RoundRect $graphics 208 566 454 202 20 $white (Pen '#DDD4C6')
Text $graphics 'TEXT STYLE' (Font 'Arial' 9 ([System.Drawing.FontStyle]::Bold)) $muted 230 587
$fontLabels = @(
  @('Classic', 'Arial', [System.Drawing.FontStyle]::Regular),
  @('Editorial', 'Georgia', [System.Drawing.FontStyle]::Regular),
  @('Bold', 'Arial', [System.Drawing.FontStyle]::Bold),
  @('Typewriter', 'Courier New', [System.Drawing.FontStyle]::Regular)
)
$x = 230
foreach ($item in $fontLabels) {
  $selected = $item[0] -eq 'Editorial'
  RoundRect $graphics $x 620 92 112 14 $(if ($selected) { $mint } else { $cream }) $(if ($selected) { Pen '#4CBF83' 2 } else { Pen '#E5DDD1' })
  Text $graphics 'Aa' (Font $item[1] 21 $item[2]) $ink ($x + 29) 641
  Text $graphics $item[0] (Font 'Arial' 9 ([System.Drawing.FontStyle]::Bold)) $(if ($selected) { $green } else { $muted }) ($x + 14) 697
  $x += 103
}

# Attachment panel
RoundRect $graphics 690 566 593 270 20 $white (Pen '#DDD4C6')
Text $graphics 'ATTACH TO UPDATE' (Font 'Arial' 9 ([System.Drawing.FontStyle]::Bold)) $muted 715 587
$items = @(
  @('Photo', 'JPG, PNG or WebP', '#EAF8F1'),
  @('GIF', 'Animated GIF up to 5 MB', '#FFF0EC'),
  @('Video', 'MP4, WebM or MOV', '#EAF8F1'),
  @('File', 'PDF, Word, Excel and more', '#EAF8F1')
)
$y = 618
foreach ($item in $items) {
  RoundRect $graphics 712 $y 548 45 11 (Brush '#FBFAF7')
  RoundRect $graphics 724 ($y + 7) 32 32 9 (Brush $item[2])
  Text $graphics $(if ($item[0] -eq 'GIF') { 'GIF' } else { '+' }) (Font 'Arial' $(if ($item[0] -eq 'GIF') { 8 } else { 15 }) ([System.Drawing.FontStyle]::Bold)) $(if ($item[0] -eq 'GIF') { $accent } else { $green }) ($xIcon = if ($item[0] -eq 'GIF') { 730 } else { 734 }) ($y + 13)
  Text $graphics $item[0] (Font 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $ink 770 ($y + 7)
  Text $graphics $item[1] (Font 'Arial' 9) $muted 770 ($y + 23)
  $y += 51
}

# GIF preview strip
RoundRect $graphics 115 790 547 70 16 (Brush '#173C2A')
Text $graphics 'GIF' (Font 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $white 136 806
Text $graphics 'weekend-fruit-boxes.gif' (Font 'Arial' 11 ([System.Drawing.FontStyle]::Bold)) $white 180 804
Text $graphics 'Animated preview plays in the feed' (Font 'Arial' 9) (Brush '#CDE8D8') 180 824
Text $graphics 'Font style and GIF are saved with the post' (Font 'Arial' 10 ([System.Drawing.FontStyle]::Bold)) $green 720 856

$output = Join-Path $PSScriptRoot 'community-font-gif-preview.png'
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
$output
