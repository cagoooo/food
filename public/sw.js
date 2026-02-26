const CACHE_NAME = 'food-manager-cache-v1';

// 排除 Vite 內部資源與 HMR 請求
const EXCLUDE_URLS = [
    '/@vite/client',
    '/@react-refresh',
    'node_modules',
    'chrome-extension',
    '/src/main.jsx',
    '/vite.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 如果是本地開發資源或非 GET 請求，直接跳過快取
    if (
        event.request.method !== 'GET' ||
        // ✅ 只快取 http / https 請求，排除 chrome-extension:// 等 scheme
        !event.request.url.startsWith('http') ||
        EXCLUDE_URLS.some(path => event.request.url.includes(path)) ||
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1'
    ) {
        return;
    }

    // 網路優先策略 (Stale-While-Revalidate)
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => {
                    // 網路失敗
                    console.log('[SW] 網路請求失敗，嘗試使用快取:', event.request.url);
                });
                return response || fetchPromise;
            });
        })
    );
});

// 資料庫同步 (針對離線訂單)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-orders') {
        console.log('[SW] 偵測到連線恢復，開始啟動背景同步...');
        event.waitUntil(syncOfflineOrders());
    }
});

// 同步離線訂單的具體邏輯
async function syncOfflineOrders() {
    // 透過訊息告知所有活躍的客戶端主動執行同步邏輯
    const allClients = await clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ type: 'SYNC_ORDERS' });
    });
}
