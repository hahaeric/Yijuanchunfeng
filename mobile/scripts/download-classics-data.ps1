$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$sourceDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.data-source"))
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null

$chinesePoetryRevision = "b8594f81a89752241442f2ce267d6f66f96704ee"
$ancientTextRevision = "01a1183cd9bbc243bb156967043c32b6685c0d2f"
$downloads = @(
  @{ name = "daxue.json"; url = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/$chinesePoetryRevision/%E5%9B%9B%E4%B9%A6%E4%BA%94%E7%BB%8F/daxue.json" },
  @{ name = "lunyu.json"; url = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/$chinesePoetryRevision/%E8%AE%BA%E8%AF%AD/lunyu.json" },
  @{ name = "mengzi.json"; url = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/$chinesePoetryRevision/%E5%9B%9B%E4%B9%A6%E4%BA%94%E7%BB%8F/mengzi.json" },
  @{ name = "shijing.json"; url = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/$chinesePoetryRevision/%E8%AF%97%E7%BB%8F/shijing.json" },
  @{ name = "zhongyong.json"; url = "https://raw.githubusercontent.com/hanzhaodeng/chinese-ancient-text/$ancientTextRevision/%E4%B8%AD%E5%BA%B8.json" },
  @{ name = "shangshu.json"; url = "https://raw.githubusercontent.com/hanzhaodeng/chinese-ancient-text/$ancientTextRevision/%E5%B0%9A%E4%B9%A6.json" },
  @{ name = "liji.json"; url = "https://raw.githubusercontent.com/hanzhaodeng/chinese-ancient-text/$ancientTextRevision/%E7%A4%BC%E8%AE%B0.json" },
  @{ name = "zhouyi.json"; url = "https://raw.githubusercontent.com/hanzhaodeng/chinese-ancient-text/$ancientTextRevision/%E5%91%A8%E6%98%93.json" },
  @{ name = "yizhuan.json"; url = "https://raw.githubusercontent.com/hanzhaodeng/chinese-ancient-text/$ancientTextRevision/%E6%98%93%E4%BC%A0.json" }
)

foreach ($item in $downloads) {
  $destination = Join-Path $sourceDir $item.name
  Invoke-WebRequest -Uri $item.url -UseBasicParsing -OutFile $destination -TimeoutSec 60
  Write-Output "已下载 $($item.name)"
}

$wikiPages = @(
  @{ name = "shangshu-taishi-shang.html"; path = "%E5%B0%9A%E6%9B%B8/%E6%B3%B0%E8%AA%93%E4%B8%8A" },
  @{ name = "shangshu-taishi-zhong.html"; path = "%E5%B0%9A%E6%9B%B8/%E6%B3%B0%E8%AA%93%E4%B8%AD" },
  @{ name = "shangshu-taishi-xia.html"; path = "%E5%B0%9A%E6%9B%B8/%E6%B3%B0%E8%AA%93%E4%B8%8B" },
  @{ name = "chunqiu-yin.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E9%9A%B1%E5%85%AC" },
  @{ name = "chunqiu-huan.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E6%A1%93%E5%85%AC" },
  @{ name = "chunqiu-zhuang.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E8%8E%8A%E5%85%AC" },
  @{ name = "chunqiu-min.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E9%96%94%E5%85%AC" },
  @{ name = "chunqiu-xi.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E5%83%96%E5%85%AC" },
  @{ name = "chunqiu-wen.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E6%96%87%E5%85%AC" },
  @{ name = "chunqiu-xuan.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E5%AE%A3%E5%85%AC" },
  @{ name = "chunqiu-cheng.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E6%88%90%E5%85%AC" },
  @{ name = "chunqiu-xiang.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E8%A5%84%E5%85%AC" },
  @{ name = "chunqiu-zhao.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E6%98%AD%E5%85%AC" },
  @{ name = "chunqiu-ding.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E5%AE%9A%E5%85%AC" },
  @{ name = "chunqiu-ai.html"; path = "%E6%98%A5%E7%A7%8B%E7%B6%93/%E5%93%80%E5%85%AC" }
)
foreach ($page in $wikiPages) {
  $destination = Join-Path $sourceDir $page.name
  Invoke-WebRequest -Uri "https://zh.wikisource.org/wiki/$($page.path)?action=render" -UseBasicParsing -OutFile $destination -TimeoutSec 60
  Write-Output "Downloaded $($page.name)"
  Start-Sleep -Milliseconds 350
}
