# Gera o assets/moneymap.ico a partir da geometria do frontend/app/icon.svg.
#
#   powershell -ExecutionPolicy Bypass -File scripts\make-icon.ps1
#
# Nao le o SVG: nao ha rasterizador de SVG disponivel no PowerShell 5.1 sem
# instalar alguma coisa ou levantar um browser em modo headless. Como a marca sao
# duas formas simples -- uma polilinha e um circulo -- redesenha-se aqui com a
# mesma geometria exacta, na mesma caixa de 32x32 do viewBox.
#
# Se mexeres no icon.svg, mexe tambem aqui. Sao dois sitios para a mesma marca, e
# o motivo e a falta de rasterizador, nao uma escolha de arquitectura.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outDir = Join-Path $RepoRoot "assets"
$outFile = Join-Path $outDir "moneymap.ico"

# Os tons do tema escuro do icon.svg, nao os do claro. O icone vive na barra de
# tarefas e no ambiente de trabalho do Windows 11, que sao escuros por
# predefinicao: o roxo escuro do tema claro desaparecia ali. Ao contrario, este
# roxo mais claro continua a ler-se sobre branco no Explorador.
$strokeColor = [System.Drawing.ColorTranslator]::FromHtml("#b58bf9")
$dotColor = [System.Drawing.ColorTranslator]::FromHtml("#34d399")

# Coordenadas do viewBox 0 0 32 32 do icon.svg, na mesma ordem.
$points = @(
    [System.Drawing.PointF]::new(4.5, 26.5),
    [System.Drawing.PointF]::new(11.0, 7.5),
    [System.Drawing.PointF]::new(16.0, 18.5),
    [System.Drawing.PointF]::new(21.0, 7.5),
    [System.Drawing.PointF]::new(27.5, 26.5)
)
$strokeWidth = 3.6
$dotCenter = [System.Drawing.PointF]::new(21.0, 7.5)
$dotRadius = 3.6

function New-Frame {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.Clear([System.Drawing.Color]::Transparent)

        # Uma escala unica em vez de coordenadas por tamanho: assim os 16 pixeis e
        # os 256 sao literalmente o mesmo desenho.
        $g.ScaleTransform($Size / 32.0, $Size / 32.0)

        $pen = New-Object System.Drawing.Pen($strokeColor, $strokeWidth)
        try {
            # Equivalente ao stroke-linecap e stroke-linejoin round do SVG.
            $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
            $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
            $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
            $g.DrawLines($pen, $points)
        }
        finally {
            $pen.Dispose()
        }

        $brush = New-Object System.Drawing.SolidBrush($dotColor)
        try {
            $g.FillEllipse(
                $brush,
                ($dotCenter.X - $dotRadius),
                ($dotCenter.Y - $dotRadius),
                ($dotRadius * 2),
                ($dotRadius * 2))
        }
        finally {
            $brush.Dispose()
        }
    }
    finally {
        $g.Dispose()
    }
    return $bmp
}

# Converte uma moldura para DIB, o formato antigo de dentro do .ico: cabecalho
# BITMAPINFOHEADER, os pixeis em BGRA de baixo para cima, e a mascara AND a
# seguir. O Windows usa o canal alfa e ignora a mascara, mas o formato exige-a.
function ConvertTo-Dib {
    param([System.Drawing.Bitmap]$Bitmap)

    $w = $Bitmap.Width
    $h = $Bitmap.Height
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    try {
        $bw.Write([UInt32]40)
        $bw.Write([Int32]$w)
        # Altura a dobrar: o campo conta as duas imagens, a de cor e a mascara.
        $bw.Write([Int32]($h * 2))
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]0)
        $bw.Write([UInt32]($w * $h * 4))
        $bw.Write([Int32]0)
        $bw.Write([Int32]0)
        $bw.Write([UInt32]0)
        $bw.Write([UInt32]0)

        for ($y = $h - 1; $y -ge 0; $y--) {
            for ($x = 0; $x -lt $w; $x++) {
                $p = $Bitmap.GetPixel($x, $y)
                $bw.Write([Byte]$p.B)
                $bw.Write([Byte]$p.G)
                $bw.Write([Byte]$p.R)
                $bw.Write([Byte]$p.A)
            }
        }

        # Mascara a zeros, com as linhas alinhadas a 4 bytes.
        $maskRow = [Math]::Floor(($w + 31) / 32) * 4
        $zeros = New-Object Byte[] ($maskRow * $h)
        $bw.Write($zeros)

        $bw.Flush()
        # A virgula nao e decorativa: sem ela o PowerShell desenrola o byte[] em
        # bytes soltos a saida da funcao, e quem recebe fica com um Object[] que
        # o BinaryWriter nao escreve.
        return , $ms.ToArray()
    }
    finally {
        $bw.Dispose()
        $ms.Dispose()
    }
}

# DIB ate aos 64 e PNG nos dois maiores. E o que as ferramentas de icones fazem,
# e por uma razao concreta: o GDI+ (o Icon.ToBitmap do .NET Framework) nao le
# molduras em PNG e rebenta. O Explorador le as duas desde o Vista, mas assim o
# icone funciona tambem nos caminhos antigos.
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @()
foreach ($size in $sizes) {
    $bmp = New-Frame -Size $size
    if ($size -le 64) {
        $bytes = ConvertTo-Dib -Bitmap $bmp
        $isPng = $false
    } else {
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        $isPng = $true
    }
    $bmp.Dispose()
    $frames += , @{ Size = $size; Bytes = $bytes; Png = $isPng }
}

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$fs = [System.IO.File]::Create($outFile)
$bw = New-Object System.IO.BinaryWriter($fs)
try {
    # ICONDIR: reservado, tipo 1 (icone), numero de imagens.
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$frames.Count)

    # Cada ICONDIRENTRY ocupa 16 bytes; os dados comecam depois de todas elas.
    $offset = 6 + (16 * $frames.Count)
    foreach ($f in $frames) {
        # 256 escreve-se como 0: o campo tem um byte so.
        $dim = $f.Size
        if ($dim -ge 256) { $dim = 0 }
        $bw.Write([Byte]$dim)
        $bw.Write([Byte]$dim)
        $bw.Write([Byte]0)
        $bw.Write([Byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$f.Bytes.Length)
        $bw.Write([UInt32]$offset)
        $offset += $f.Bytes.Length
    }

    foreach ($f in $frames) {
        $bw.Write($f.Bytes)
    }
}
finally {
    $bw.Dispose()
    $fs.Dispose()
}

Write-Host "Icon written: $outFile"
Write-Host "Sizes: $($sizes -join ', ')"

# Le o que acabou de escrever, em vez de acreditar que escreveu. Um .ico mal
# formado nao da erro nenhum -- o Windows limita-se a mostrar o icone generico,
# e isso passa por escolha de design em vez de avaria.
foreach ($size in @(16, 32, 48, 64)) {
    $probe = New-Object System.Drawing.Icon($outFile, $size, $size)
    try {
        $frame = $probe.ToBitmap()
        try {
            if ($frame.Width -ne $size) {
                throw "Asked for the ${size}px frame and got ${($frame.Width)}px."
            }
        }
        finally {
            $frame.Dispose()
        }
    }
    finally {
        $probe.Dispose()
    }
}
Write-Host "Verified: Windows reads every DIB frame back."
