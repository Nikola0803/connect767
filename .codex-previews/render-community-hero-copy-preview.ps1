Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(1360, 300)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
function B($hex) { New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function P($hex, $width = 1) { New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $width) }
function RR($x,$y,$w,$h,$r,$fill,$stroke=$null) {
  $path=New-Object System.Drawing.Drawing2D.GraphicsPath; $d=$r*2
  $path.AddArc($x,$y,$d,$d,180,90); $path.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $path.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $path.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $path.CloseFigure(); $g.FillPath($fill,$path); if($stroke){$g.DrawPath($stroke,$path)}; $path.Dispose()
}

$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F7F5EF'))
$white=B '#FFFFFF'; $ink=B '#17221B'; $green=B '#006B3C'; $accent=B '#EF5A3C'; $muted=B '#53615A'; $mint=B '#EAF8F1'
RR 24 28 1312 240 28 $white (P '#E7E0D5')

$labelFont=New-Object System.Drawing.Font('Arial',10,[System.Drawing.FontStyle]::Bold)
$titleFont=New-Object System.Drawing.Font('Arial',38,[System.Drawing.FontStyle]::Bold)
$accentFont=New-Object System.Drawing.Font('Arial',38,([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic))
$bodyFont=New-Object System.Drawing.Font('Arial',14,[System.Drawing.FontStyle]::Regular)
$badgeFont=New-Object System.Drawing.Font('Arial',9,[System.Drawing.FontStyle]::Bold)

$g.DrawString('CONNECT  /  SHARE  /  GROW',$labelFont,$green,62,64)
$g.DrawString('Connect767',$titleFont,$ink,60,91)
$titleWidth=$g.MeasureString('Connect767',$titleFont).Width
$g.DrawString('Community',$accentFont,$accent,60+$titleWidth-4,91)
$g.DrawString('Where people, businesses, and opportunities connect.',$bodyFont,$muted,62,153)

RR 1012 194 146 38 19 $white (P '#82D8AE')
RR 1024 203 20 20 7 $mint
$g.DrawString('v',$badgeFont,$green,1030,204)
$g.DrawString('Verified Businesses',$badgeFont,$ink,1051,206)
RR 1170 194 136 38 19 $white (P '#F3A995')
$g.DrawString('o',$badgeFont,$accent,1184,205)
$g.DrawString('Local & Global',$badgeFont,$ink,1202,206)

$output=Join-Path $PSScriptRoot 'community-hero-copy-preview.png'
$bitmap.Save($output,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bitmap.Dispose(); $output
