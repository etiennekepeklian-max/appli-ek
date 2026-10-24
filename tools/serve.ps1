$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path (Split-Path $PSScriptRoot -Parent) 'site'))
$port = 8765
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
try { $listener.Start() } catch { Write-Host 'Un serveur utilise deja le port 8765. Ouvrez http://localhost:8765/ ou fermez le precedent lanceur.'; Read-Host 'Entree pour fermer'; exit 1 }
Write-Host 'EK Logistique : http://localhost:8765/' -ForegroundColor Green
Write-Host 'Gardez cette fenetre ouverte pendant l utilisation. Ctrl+C pour arreter.'
Start-Process 'http://localhost:8765/'
$mimes = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json; charset=utf-8';'.webmanifest'='application/manifest+json';'.svg'='image/svg+xml';'.png'='image/png';'.wasm'='application/wasm';'.gz'='application/gzip';'.md'='text/plain; charset=utf-8';'.txt'='text/plain; charset=utf-8';'.ttf'='font/ttf';'.woff2'='font/woff2'}
try {
 while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $first = $reader.ReadLine()
      if (-not $first) { continue }
      while (($line = $reader.ReadLine()) -and $line.Length -gt 0) { }
      $parts = $first.Split(' ')
      if ($parts.Length -lt 2 -or $parts[0] -notin @('GET','HEAD')) {
        $status = '405 Method Not Allowed'; $content = [Text.Encoding]::UTF8.GetBytes('Methode non autorisee'); $mime = 'text/plain'
      } else {
        $urlPath = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0]).Replace('/', '\')
        if ($urlPath.EndsWith('\')) { $urlPath += 'index.html' }
        $file = [IO.Path]::GetFullPath((Join-Path $root $urlPath.TrimStart('\')))
        if (-not $file.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($file)) {
          $status = '404 Not Found'; $content = [Text.Encoding]::UTF8.GetBytes('Fichier introuvable'); $mime = 'text/plain'
        } else {
          $status = '200 OK'; $content = [IO.File]::ReadAllBytes($file); $ext = [IO.Path]::GetExtension($file).ToLowerInvariant(); $mime = $mimes[$ext]; if (-not $mime) { $mime = 'application/octet-stream' }
        }
      }
      $header = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($content.Length)`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
      $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes,0,$headerBytes.Length)
      if ($parts[0] -ne 'HEAD') { $stream.Write($content,0,$content.Length) }
      $stream.Flush()
    } catch { Write-Verbose $_.Exception.Message }
    finally { $client.Close() }
 }
} finally { $listener.Stop() }
