const CACHE_NAME = 'task-manager-v1.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://accounts.google.com/gsi/client',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 서비스 워커 설치 시 캐시 생성
self.addEventListener('install', event => {
  console.log('Service Worker 설치됨');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 생성됨:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('캐시 생성 실패:', error);
      })
  );
});

// 서비스 워커 활성화 시 이전 캐시 정리
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화됨');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 네트워크 요청 가로채기 (Cache First 전략)
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // API 요청은 Network First 전략 사용
  if (requestUrl.pathname.startsWith('/.netlify/functions/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 성공적인 응답을 받으면 캐시에 저장
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 네트워크 요청 실패 시 캐시에서 가져오기
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // 캐시에도 없으면 오프라인 응답
            return new Response(
              JSON.stringify({
                success: false,
                message: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.',
                offline: true
              }),
              {
                status: 503,
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
          });
        })
    );
    return;
  }
  
  // 정적 파일은 Cache First 전략 사용
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 캐시에 있으면 캐시에서 반환
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 캐시에 없으면 네트워크에서 가져오기
        return fetch(event.request)
          .then(response => {
            // 유효한 응답이 아니면 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 응답을 복제하여 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // 네트워크 요청 실패 시 오프라인 페이지 반환
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// 백그라운드 동기화 (향후 기능)
self.addEventListener('sync', event => {
  console.log('백그라운드 동기화:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 오프라인에서 저장된 데이터 동기화
      syncOfflineData()
    );
  }
});

// 푸시 메시지 수신 (향후 기능)
self.addEventListener('push', event => {
  console.log('푸시 메시지 수신:', event);
  
  const options = {
    body: event.data ? event.data.text() : '새로운 업무가 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('업무 관리 시스템', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 오프라인 데이터 동기화 함수
async function syncOfflineData() {
  try {
    // IndexedDB에서 오프라인 데이터 가져오기
    // (향후 구현)
    console.log('오프라인 데이터 동기화 시작');
    
    // 서버와 동기화
    // await uploadOfflineData();
    
    console.log('오프라인 데이터 동기화 완료');
  } catch (error) {
    console.error('동기화 실패:', error);
  }
}

// 캐시 용량 관리
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then(size => {
      event.ports[0].postMessage({ cacheSize: size });
    });
  }
});

async function getCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}