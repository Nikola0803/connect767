Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(1440, 1040)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
function B($hex) { New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function P($hex, $w = 1) { New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $w) }
function F($size, $style = [System.Drawing.FontStyle]::Regular) { New-Object System.Drawing.Font('Arial', $size, $style) }
function RR($x, $y, $w, $h, $r, $fill, $stroke = $null) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2
  $path.AddArc($x,$y,$d,$d,180,90); $path.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $path.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $path.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $path.CloseFigure(); $g.FillPath($fill,$path); if($stroke){$g.DrawPath($stroke,$path)}; $path.Dispose()
}
function T($value,$font,$brush,$x,$y) { $g.DrawString($value,$font,$brush,$x,$y) }

$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F7F5EF'))
$white=B '#FFFFFF'; $ink=B '#17221B'; $muted=B '#68716C'; $green=B '#006B3C'; $mint=B '#EAF8F1'; $accent=B '#EF5A3C'; $line=P '#E8E1D6'

# Hero
RR 80 44 1280 188 28 $white $line
T 'CONNECT  /  SHARE  /  GROW' (F 9 ([System.Drawing.FontStyle]::Bold)) $green 112 77
T 'Business' (F 34 ([System.Drawing.FontStyle]::Bold)) $ink 110 101
T 'community' (F 34 ([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)) $accent 292 101
T 'Discover business updates, local opportunities and conversations from Dominica and communities abroad.' (F 11) $muted 112 155
RR 1055 174 128 31 15 $white (P '#8CD8B1'); T 'Verified businesses' (F 8 ([System.Drawing.FontStyle]::Bold)) $green 1072 184
RR 1194 174 130 31 15 $white (P '#F3B09F'); T 'Local and global' (F 8 ([System.Drawing.FontStyle]::Bold)) $ink 1215 184

# Composer - intentionally no duplicate heading
RR 80 254 880 212 26 $white $line
RR 660 275 128 38 12 $white (P '#DDD5C9'); RR 670 283 22 22 7 $mint; T '*' (F 12 ([System.Drawing.FontStyle]::Bold)) $green 677 283; T 'For you' (F 9 ([System.Drawing.FontStyle]::Bold)) $ink 705 287; T 'v' (F 8) $muted 768 288
RR 800 275 132 38 12 $white (P '#DDD5C9'); RR 810 283 22 22 7 $mint; T '#' (F 10 ([System.Drawing.FontStyle]::Bold)) $green 817 285; T 'All Posts' (F 9 ([System.Drawing.FontStyle]::Bold)) $ink 845 287; T 'v' (F 8) $muted 912 288
RR 108 330 45 45 15 $green; T 'JL' (F 11 ([System.Drawing.FontStyle]::Bold)) $white 122 345
RR 166 322 766 118 18 (B '#FBFAF7') (P '#E1D9CD')
T 'What would you like to share? from James Local Fruits...' (F 11) $muted 190 347
RR 184 391 30 30 9 $mint; T '@' (F 12 ([System.Drawing.FontStyle]::Bold)) $green 193 396
T 'Type @ to mention a directory listing' (F 8) $muted 226 400

# Sidebar
RR 984 254 376 270 26 $white $line
T 'DISCOVER' (F 8 ([System.Drawing.FontStyle]::Bold)) $accent 1014 285
T 'Trending now' (F 19 ([System.Drawing.FontStyle]::Bold)) $ink 1014 305
$trends=@(@('#ShopLocal767','38 updates'),@('Holiday services','24 offers'),@('Small-business tips','17 conversations')); $y=352; $i=1
foreach($row in $trends){ RR 1014 $y 30 30 10 (B '#FBF3E9'); T "$i" (F 9 ([System.Drawing.FontStyle]::Bold)) $accent 1025 ($y+8); T $row[0] (F 9 ([System.Drawing.FontStyle]::Bold)) $ink 1058 ($y+2); T $row[1] (F 8) $muted 1058 ($y+17); $y+=55; $i++ }

# Feed heading
T 'COMMUNITY FEED' (F 8 ([System.Drawing.FontStyle]::Bold)) $green 84 501
T 'Latest updates' (F 22 ([System.Drawing.FontStyle]::Bold)) $ink 82 518
RR 870 507 72 29 14 $white $line; T '3 posts' (F 8 ([System.Drawing.FontStyle]::Bold)) $muted 892 516

# Posts
function DrawPost($top,$body,$time,$location='') {
  RR 80 $top 880 190 24 $white $line
  RR 108 ($top+24) 44 44 15 $green; T 'JL' (F 11 ([System.Drawing.FontStyle]::Bold)) $white 121 ($top+38)
  T 'James Local Fruits' (F 14 ([System.Drawing.FontStyle]::Bold)) $ink 166 ($top+24)
  RR 344 ($top+23) 72 24 12 $mint; T 'CATERING' (F 7 ([System.Drawing.FontStyle]::Bold)) $green 359 ($top+31)
  T "Connect767 community  /  $time" (F 8) $muted 166 ($top+47)
  if($location){ T $location (F 8 ([System.Drawing.FontStyle]::Bold)) $green 108 ($top+78); T $body (F 10) $ink 108 ($top+104) } else { T $body (F 10) $ink 108 ($top+82) }
  T '0 reactions' (F 8) $muted 108 ($top+130); T '0 comments' (F 8) $muted 874 ($top+130)
  $g.DrawLine((P '#EEE8DE'),108,$top+152,932,$top+152)
  T 'O     Comment     Repost     Share' (F 8 ([System.Drawing.FontStyle]::Bold)) $muted 110 ($top+164)
  T 'View profile' (F 8 ([System.Drawing.FontStyle]::Bold)) $green 860 ($top+164)
}
DrawPost 558 'Fresh fruit deliveries are available today.' 'Just now'
DrawPost 768 'Visit us this weekend for locally grown produce and fresh juices.' '11 hr ago' 'Harris County, Texas, United States'

T 'Modern sans-serif typography  /  duplicate composer heading removed  /  responsive filters retained' (F 9 ([System.Drawing.FontStyle]::Bold)) $green 82 990

$output=Join-Path $PSScriptRoot 'community-modern-typography-preview.png'
$bitmap.Save($output,[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bitmap.Dispose(); $output
