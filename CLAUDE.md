# news-rss-test 프로젝트 규칙

## 기술 스택
- Node.js + Express 5
- rss-parser (RSS 피드 파싱)
- dotenv
- 배포: 미정 (로컬 테스트 중)

## 프로젝트 개요

해외 주요 언론사 RSS 피드를 분야별로 파싱해서 카드형 UI로 보여주는 뉴스 리더.
제목·링크·발행일·RSS 요약만 표시. 본문 전체 복제·페이월 우회 없음.

## 핵심 구조

### SOURCES (index.js 상단)
- `type: 'rss'` + `enabled: true` → RSS 파싱 활성
- `type: 'api'` + `enabled: false` → 플레이스홀더만 표시
- 각 소스는 5개 분야(international/politics/economy/society/culture) 피드 URL 보유

### CATEGORIES
| key | 표시명 |
|---|---|
| international | 국제 |
| politics | 정치 |
| economy | 경제 |
| society | 사회 |
| culture | 문화 |

### 현재 소스 목록 (ABC순)
| key | 매체 | 상태 |
|---|---|---|
| abcAustralia | ABC News (Australia) | RSS 활성 |
| bbc | BBC News | RSS 활성 |
| cbc | CBC News | RSS 활성 |
| guardian | The Guardian | RSS 활성 |
| independent | The Independent | RSS 활성 |
| lat | Los Angeles Times | RSS 활성 |
| nyt | The New York Times | 비활성 (API 키 대기) |
| pbs | PBS NewsHour | RSS 활성 |
| washingtonPost | The Washington Post | RSS 활성 |

### 캐시
- `Map` 기반 인메모리 캐시
- TTL: 10분 (`CACHE_TTL_MS = 1000 * 60 * 10`)
- 키: `sourceKey:categoryKey`

## API 엔드포인트

- `GET /` — 메인 UI
- `GET /api/meta` — 카테고리·소스 목록 반환
- `GET /api/news?source=all&category=all&limit=3` — 기사 반환
  - source: 소스 key 또는 `all` 또는 콤마 구분 복수
  - category: 카테고리 key 또는 `all` 또는 콤마 구분 복수
  - limit: 소스당 기사 수 (최대 10, 기본 3)

## 소스 추가 순서

### 1. RSS 소스 추가
1. `SOURCES`에 객체 추가
   ```js
   newSource: {
     name: '매체명',
     type: 'rss',
     enabled: true,
     feeds: {
       international: 'https://...',
       politics: 'https://...',
       economy: 'https://...',
       society: 'https://...',
       culture: 'https://...',
     },
   }
   ```
2. UI `<select id="source">`에 `<option>` 추가
3. `node index.js` 실행 후 `curl "http://localhost:3000/api/news?source=newSource&category=international"` 로 검증

### 2. API 소스 추가 (NYT처럼)
1. `SOURCES`에 `type: 'api'`, `enabled: false`로 추가
2. API 연결 함수 작성 후 `/api/news` 분기에 추가
3. 준비되면 `enabled: true`로 전환

### 3. 분야 추가
1. `CATEGORIES`에 추가
2. 모든 활성 소스에 해당 분야 피드 URL 추가
3. UI `<select id="category">`에 `<option>` 추가

## 절대 건드리지 않는 것
- 모바일 CSS 블록 (`@media (max-width: 640px)` 내부)
- footer 저작권 안내 문구

## 검증 방법
```
node index.js
curl "http://localhost:3000/api/news?source=bbc&category=international"
curl "http://localhost:3000/api/meta"
```
