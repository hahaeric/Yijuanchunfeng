param()

$ErrorActionPreference = "Stop"
$assetDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\assets")).Path
$logoPath = Join-Path $assetDirectory "brand-logo.png"

if (-not (Test-Path -LiteralPath $logoPath)) {
  throw "Place the square source logo at $logoPath before generating icon assets."
}

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies @("System.dll", "System.Drawing.dll") -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class BrandIconGenerator
{
    public static void Generate(string sourcePath, string assetDirectory)
    {
        using (var source = new Bitmap(sourcePath))
        {
            if (source.Width != source.Height)
                throw new InvalidOperationException("The source logo must be square.");

            SaveResized(source, System.IO.Path.Combine(assetDirectory, "favicon.png"), 64);
            SaveAdaptiveForeground(source, System.IO.Path.Combine(assetDirectory, "android-icon-foreground.png"));
            SaveBackground(source, System.IO.Path.Combine(assetDirectory, "android-icon-background.png"));
            SaveMonochrome(source, System.IO.Path.Combine(assetDirectory, "android-icon-monochrome.png"));
        }
    }

    private static void SaveResized(Bitmap source, string path, int size)
    {
        using (var output = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(output))
        {
            Configure(graphics);
            graphics.DrawImage(source, new Rectangle(0, 0, size, size));
            output.Save(path, ImageFormat.Png);
        }
    }

    private static void SaveAdaptiveForeground(Bitmap source, string path)
    {
        using (var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(output))
        {
            graphics.Clear(Color.Transparent);
            Configure(graphics);
            int inset = (int)Math.Round(source.Width * 0.09);
            int size = source.Width - inset * 2;
            graphics.DrawImage(source, new Rectangle(inset, inset, size, size));
            output.Save(path, ImageFormat.Png);
        }
    }

    private static void SaveBackground(Bitmap source, string path)
    {
        using (var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(output))
        {
            for (int y = 0; y < source.Height; y++)
            {
                Color color = source.GetPixel(10, y);
                using (var brush = new SolidBrush(color))
                    graphics.FillRectangle(brush, 0, y, source.Width, 1);
            }
            output.Save(path, ImageFormat.Png);
        }
    }

    private static void SaveMonochrome(Bitmap source, string path)
    {
        using (var silhouette = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        using (var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(output))
        {
            for (int y = 0; y < source.Height; y++)
            {
                Color background = source.GetPixel(10, y);
                for (int x = 0; x < source.Width; x++)
                {
                    Color pixel = source.GetPixel(x, y);
                    double alpha = (
                        RelativeWhite(pixel.R, background.R) +
                        RelativeWhite(pixel.G, background.G) +
                        RelativeWhite(pixel.B, background.B)
                    ) / 3.0;

                    if (alpha < 0.015) alpha = 0;
                    int alphaByte = (int)Math.Round(Math.Max(0, Math.Min(1, alpha)) * 255);
                    silhouette.SetPixel(x, y, Color.FromArgb(alphaByte, 255, 255, 255));
                }
            }

            graphics.Clear(Color.Transparent);
            Configure(graphics);
            int inset = (int)Math.Round(source.Width * 0.09);
            int size = source.Width - inset * 2;
            graphics.DrawImage(silhouette, new Rectangle(inset, inset, size, size));
            output.Save(path, ImageFormat.Png);
        }
    }

    private static double RelativeWhite(int value, int background)
    {
        int range = 255 - background;
        return range <= 0 ? 0 : (double)(value - background) / range;
    }

    private static void Configure(Graphics graphics)
    {
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.SmoothingMode = SmoothingMode.HighQuality;
    }
}
"@

[BrandIconGenerator]::Generate($logoPath, $assetDirectory)
Write-Output "Generated favicon and Android adaptive icon assets from brand-logo.png."
