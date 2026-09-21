// Service Worker for PWA App Badging and Cache Management
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sync badge on message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    const count = Number(event.data.count) || 0;
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch((err) => {
          console.debug('SW setAppBadge failed:', err);
        });
      } else if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch((err) => {
          console.debug('SW clearAppBadge failed:', err);
        });
      }
    }
  }
});

// Handle push notification badge if push events are used
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: event.data.text() };
    }
  }
  const count = data.badgeCount || data.count;
  if (count !== undefined && 'setAppBadge' in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
