<?php

namespace App\Http\Controllers;

use App\Services\AppSettingsService;
use Illuminate\Http\JsonResponse;

class PwaController extends Controller
{
    public function manifest(AppSettingsService $settingsService): JsonResponse
    {
        $settings = $settingsService->publicSettings();
        $appName = $settings['app_name'] ?: config('app.name', 'LaLaPick');
        $themeColor = $settings['theme_color'] ?: '#087f74';
        $iconUrl = $settings['logo_url'] ?: $settings['favicon_url'] ?: url('/pwa-icon.svg');

        return response()
            ->json([
                'name' => $appName,
                'short_name' => $this->shortName($appName),
                'description' => "{$appName} shopping app",
                'start_url' => url('/'),
                'scope' => url('/'),
                'display' => 'standalone',
                'display_override' => ['window-controls-overlay', 'standalone', 'minimal-ui'],
                'orientation' => 'portrait',
                'background_color' => '#ffffff',
                'theme_color' => $themeColor,
                'categories' => ['shopping', 'lifestyle'],
                'icons' => [
                    [
                        'src' => $iconUrl,
                        'sizes' => '192x192',
                        'type' => $this->iconType($iconUrl),
                        'purpose' => 'any',
                    ],
                    [
                        'src' => $iconUrl,
                        'sizes' => '512x512',
                        'type' => $this->iconType($iconUrl),
                        'purpose' => 'any maskable',
                    ],
                ],
            ])
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'no-cache, must-revalidate');
    }

    private function shortName(string $name): string
    {
        return mb_substr(trim($name), 0, 12) ?: 'Shop';
    }

    private function iconType(string $url): string
    {
        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));

        return match ($extension) {
            'svg' => 'image/svg+xml',
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            'ico' => 'image/x-icon',
            default => 'image/png',
        };
    }
}
