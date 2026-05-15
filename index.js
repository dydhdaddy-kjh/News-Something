require("dotenv").config();

const express = require("express");
const Parser = require("rss-parser");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use('/fonts', express.static(require('path').join(__dirname, 'fonts')));

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

const CATEGORIES = {
  international: "국제",
  politics: "정치",
  economy: "경제",
  society: "사회",
  culture: "문화",
};

const SOURCES = {
  nyt: {
    name: "The New York Times",
    type: "api",
    enabled: false,
    note: "NYT API 키 발급 후 연결 예정",
  },

  washingtonPost: {
    name: "The Washington Post",
    type: "rss",
    enabled: true,
    feeds: {
      international: "https://feeds.washingtonpost.com/rss/world",
      politics: "https://feeds.washingtonpost.com/rss/politics",
      economy: "https://feeds.washingtonpost.com/rss/business",
      society: "https://feeds.washingtonpost.com/rss/national",
      culture: "https://feeds.washingtonpost.com/rss/entertainment",
    },
  },

  lat: {
    name: "Los Angeles Times",
    type: "rss",
    enabled: true,
    feeds: {
      international: "https://www.latimes.com/world-nation/rss2.0.xml",
      politics: "https://www.latimes.com/politics/rss2.0.xml",
      economy: "https://www.latimes.com/business/rss2.0.xml",
      society: "https://www.latimes.com/california/rss2.0.xml",
      culture: "https://www.latimes.com/entertainment-arts/rss2.0.xml",
    },
  },

  guardian: {
    name: "The Guardian",
    type: "rss",
    enabled: true,
    feeds: {
      international: "https://www.theguardian.com/world/rss",
      politics: "https://www.theguardian.com/politics/rss",
      economy: "https://www.theguardian.com/business/rss",
      society: "https://www.theguardian.com/uk-news/rss",
      culture: "https://www.theguardian.com/culture/rss",
    },
  },

  independent: {
    name: "The Independent",
    type: "rss",
    enabled: true,
    feeds: {
      international: "https://www.independent.co.uk/news/world/rss",
      politics: "https://www.independent.co.uk/news/uk/politics/rss",
      economy: "https://www.independent.co.uk/money/rss",
      society: "https://www.independent.co.uk/news/uk/rss",
      culture: "https://www.independent.co.uk/arts-entertainment/rss",
    },
  },

  bbc: {
    name: "BBC News",
    type: "rss",
    enabled: true,
    feeds: {
      international: "https://feeds.bbci.co.uk/news/world/rss.xml",
      politics: "https://feeds.bbci.co.uk/news/politics/rss.xml",
      economy: "https://feeds.bbci.co.uk/news/business/rss.xml",
      society: "https://feeds.bbci.co.uk/news/uk/rss.xml",
      culture: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    },
  },
};

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 10;

function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;

  if (item["media:content"]?.$.url) return item["media:content"].$.url;
  if (item["media:thumbnail"]?.$.url) return item["media:thumbnail"].$.url;

  const html = item["content:encoded"] || item.content || item.description || "";
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function normalizeArticle(item, sourceName, sourceKey, categoryKey) {
  return {
    sourceKey,
    source: sourceName,
    categoryKey,
    category: CATEGORIES[categoryKey],
    title: item.title || "Untitled",
    link: item.link || "",
    publishedAt: item.isoDate || item.pubDate || null,
    summary: stripHtml(item.contentSnippet || item.description || item.content || ""),
    image: pickImage(item),
  };
}

async function getRssArticles(sourceKey, categoryKey, limit = 3) {
  const source = SOURCES[sourceKey];

  if (!source || !source.enabled || source.type !== "rss") {
    return {
      sourceKey,
      source: source?.name || sourceKey,
      categoryKey,
      category: CATEGORIES[categoryKey],
      status: "disabled",
      articles: [],
      error: source?.note || "비활성화된 소스입니다.",
    };
  }

  const feedUrl = source.feeds?.[categoryKey];

  if (!feedUrl) {
    return {
      sourceKey,
      source: source.name,
      categoryKey,
      category: CATEGORIES[categoryKey],
      status: "missing_feed",
      articles: [],
      error: "해당 분야 RSS 주소가 등록되지 않았습니다.",
    };
  }

  const cacheKey = `${sourceKey}:${categoryKey}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const feed = await parser.parseURL(feedUrl);

    const articles = (feed.items || [])
      .map((item) => normalizeArticle(item, source.name, sourceKey, categoryKey))
      .filter((article) => article.title && article.link)
      .slice(0, limit);

    const data = {
      sourceKey,
      source: source.name,
      categoryKey,
      category: CATEGORIES[categoryKey],
      status: "ok",
      feedTitle: feed.title || source.name,
      feedUrl,
      articles,
    };

    cache.set(cacheKey, {
      createdAt: Date.now(),
      data,
    });

    return data;
  } catch (err) {
    return {
      sourceKey,
      source: source.name,
      categoryKey,
      category: CATEGORIES[categoryKey],
      status: "error",
      feedUrl,
      articles: [],
      error: err.message,
    };
  }
}

async function getNytPlaceholder(categoryKey) {
  return {
    sourceKey: "nyt",
    source: SOURCES.nyt.name,
    categoryKey,
    category: CATEGORIES[categoryKey],
    status: "pending",
    articles: [],
    error: "NYT API 키 발급 후 연결 예정입니다.",
  };
}

app.get("/api/meta", (req, res) => {
  res.json({
    categories: CATEGORIES,
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([key, value]) => [
        key,
        {
          name: value.name,
          type: value.type,
          enabled: value.enabled,
          note: value.note || null,
        },
      ])
    ),
  });
});

app.get("/api/news", async (req, res) => {
  const sourceParam = req.query.source || "all";
  const categoryParam = req.query.category || "all";
  const limit = Math.min(Number(req.query.limit || 3), 10);

  const sourceKeys =
    sourceParam === "all"
      ? Object.keys(SOURCES)
      : String(sourceParam)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

  const categoryKeys =
    categoryParam === "all"
      ? Object.keys(CATEGORIES)
      : String(categoryParam)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

  const jobs = [];

  for (const sourceKey of sourceKeys) {
    for (const categoryKey of categoryKeys) {
      if (!SOURCES[sourceKey]) continue;
      if (!CATEGORIES[categoryKey]) continue;

      if (sourceKey === "nyt") {
        jobs.push(getNytPlaceholder(categoryKey));
      } else {
        jobs.push(getRssArticles(sourceKey, categoryKey, limit));
      }
    }
  }

  const results = await Promise.all(jobs);

  res.json({
    generatedAt: new Date().toISOString(),
    limit,
    results,
  });
});

app.get("/", (req, res) => {
  res.send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>News Something</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @font-face {
      font-family: 'DoHee';
      src: url('/fonts/dohee.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    :root {
      --bg: #141414;
      --panel: #1e1414;
      --panel2: #2a1a1a;
      --text: #f4a7b9;
      --muted: #7a5060;
      --line: #2a1a1a;
      --accent: #f4a7b9;
      --bad: #e07080;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: 'DoHee', -apple-system, 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.5;
      text-align: center;
    }

    body.light {
      --bg: #fde8ef;
      --panel: #fff0f4;
      --panel2: #f8e0ea;
      --text: #3a2030;
      --muted: #c090a0;
      --line: #f0c0d0;
      --accent: #c06080;
      --bad: #c04060;
      background: var(--bg);
      color: var(--text);
    }
    body.light .controls { background: #f5d0dc; }
      width: min(1180px, calc(100% - 44px));
      margin: 0 auto;
    }

    header {
      border-bottom: 1px solid var(--line);
    }

    .header-inner {
      padding: 32px 0 22px;
      position: relative;
    }

    .theme-btn {
      position: absolute;
      top: 32px;
      right: 0;
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 13px;
      font-family: 'DoHee', sans-serif;
      cursor: pointer;
      border: none;
      background: #2a1a1a;
      color: #f4a7b9;
      transition: all 0.3s;
    }
    .theme-btn:hover { opacity: 0.75; }
    body.light .theme-btn { background: #f0c0d0; color: #3a2030; }

    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
    }

    .desc {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }

    .controls {
      border-bottom: 1px solid var(--line);
      background: #1a1010;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .controls-inner {
      width: min(1180px, calc(100% - 44px));
      margin: 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 18px 0;
    }

    select,
    button {
      background: var(--panel2);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: 'DoHee', sans-serif;
    }

    button {
      cursor: pointer;
      background: var(--accent);
      color: #141414;
      border: none;
      font-weight: 700;
      font-family: 'DoHee', sans-serif;
    }

    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    main {
      width: min(1180px, calc(100% - 44px));
      margin: 0 auto;
      padding: 24px 0;
    }

    .status {
      color: var(--muted);
      margin-bottom: 22px;
      font-size: 14px;
      text-align: center;
    }

    .group {
      margin-bottom: 34px;
    }

    .group-title {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 10px;
      margin: 0 auto 16px;
      font-size: 19px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 10px;
      text-align: center;
    }

    .source-name {
      color: var(--accent);
    }

    .category-name {
      color: var(--text);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 340px));
      justify-content: center;
      gap: 16px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      min-height: 190px;
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .thumb {
      width: 100%;
      height: 130px;
      object-fit: cover;
      background: #2b2b2b;
      display: block;
    }

    .card-body {
      padding: 14px;
    }

    .card h3 {
      margin: 0 0 8px;
      font-size: 16px;
      line-height: 1.35;
    }

    .card h3 a {
      color: var(--text);
      text-decoration: none;
    }

    .card h3 a:hover {
      text-decoration: underline;
    }

    .meta {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .summary {
      color: #cfcfcf;
      font-size: 13px;
      margin: 0;
    }

    .empty {
      width: min(520px, 100%);
      margin: 0 auto;
      color: var(--muted);
      background: var(--panel);
      border: 1px dashed var(--line);
      padding: 14px;
      border-radius: 12px;
      font-size: 14px;
      text-align: center;
    }

    .error {
      color: var(--bad);
    }

    footer {
      border-top: 1px solid var(--line);
    }

    .footer-inner {
      width: min(1180px, calc(100% - 44px));
      margin: 0 auto;
      padding: 30px 0;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }

    @media (max-width: 640px) {
      .page,
      .controls-inner,
      main,
      .footer-inner {
        width: min(100% - 28px, 1180px);
      }

      .cards {
        grid-template-columns: 1fr;
      }

      .card {
        width: 100%;
      }

      h1 {
        font-size: 23px;
      }

      .group-title {
        flex-direction: column;
        gap: 2px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="page header-inner">
      <button class="theme-btn" onclick="toggleTheme()">☀️ 밝게</button>
      <h1>News Something</h1>
      <p class="desc">NYT는 메뉴만 표시. 나머지는 RSS로 분야별 3건씩 불러온다.</p>
    </div>
  </header>

  <section class="controls">
    <div class="controls-inner">
      <select id="source">
        <option value="all">전체 매체</option>
        <option value="nyt">NYT - 준비 중</option>
        <option value="washingtonPost">Washington Post</option>
        <option value="lat">Los Angeles Times</option>
        <option value="guardian">The Guardian</option>
        <option value="independent">The Independent</option>
        <option value="bbc">BBC News</option>
      </select>

      <select id="category">
        <option value="all">전체 분야</option>
        <option value="international">국제</option>
        <option value="politics">정치</option>
        <option value="economy">경제</option>
        <option value="society">사회</option>
        <option value="culture">문화</option>
      </select>

      <button id="loadBtn">불러오기</button>
    </div>
  </section>

  <main>
    <div id="status" class="status">불러오기를 누르면 기사 목록을 가져온다.</div>
    <div id="results"></div>
  </main>

  <footer>
    <div class="footer-inner">
      제목, 링크, 발행일, RSS 요약만 표시한다. 본문 전체 복제나 페이월 우회는 하지 않는다.
    </div>
  </footer>

  <script>
    const saved = localStorage.getItem('news-theme') || 'dark';
    document.body.className = saved;
    function toggleTheme() {
      const next = document.body.className === 'dark' ? 'light' : 'dark';
      document.body.className = next;
      localStorage.setItem('news-theme', next);
      document.querySelector('.theme-btn').textContent = next === 'dark' ? '☀️ 밝게' : '🌙 어둡게';
    }
    document.querySelector('.theme-btn').textContent = saved === 'dark' ? '☀️ 밝게' : '🌙 어둡게';

    const sourceSelect = document.getElementById("source");
    const categorySelect = document.getElementById("category");
    const loadBtn = document.getElementById("loadBtn");
    const statusEl = document.getElementById("status");
    const resultsEl = document.getElementById("results");

    function formatDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    function escapeHtml(value = "") {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function renderGroup(group) {
      const articles = group.articles || [];
      const statusText =
        group.status === "ok"
          ? ""
          : group.status === "pending"
          ? "준비 중"
          : group.status === "error"
          ? "오류"
          : group.status;

      const cardsHtml = articles.length
        ? articles
            .map((article) => {
              const imageHtml = article.image
                ? '<img class="thumb" src="' + escapeHtml(article.image) + '" alt="" loading="lazy" />'
                : "";

              return \`
                <article class="card">
                  \${imageHtml}
                  <div class="card-body">
                    <h3>
                      <a href="\${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">
                        \${escapeHtml(article.title)}
                      </a>
                    </h3>
                    <div class="meta">\${escapeHtml(formatDate(article.publishedAt))}</div>
                    <p class="summary">\${escapeHtml((article.summary || "").slice(0, 180))}</p>
                  </div>
                </article>
              \`;
            })
            .join("")
        : \`
          <div class="empty \${group.status === "error" ? "error" : ""}">
            \${escapeHtml(group.error || "표시할 기사가 없습니다.")}
          </div>
        \`;

      return \`
        <section class="group">
          <h2 class="group-title">
            <span class="source-name">\${escapeHtml(group.source)}</span>
            <span class="category-name">\${escapeHtml(group.category)}</span>
            \${statusText ? '<span class="meta">' + escapeHtml(statusText) + '</span>' : ""}
          </h2>
          <div class="cards">
            \${cardsHtml}
          </div>
        </section>
      \`;
    }

    async function loadNews() {
      const source = sourceSelect.value;
      const category = categorySelect.value;

      loadBtn.disabled = true;
      statusEl.textContent = "가져오는 중...";
      resultsEl.innerHTML = "";

      try {
        const res = await fetch(
          "/api/news?source=" +
            encodeURIComponent(source) +
            "&category=" +
            encodeURIComponent(category) +
            "&limit=3"
        );

        const data = await res.json();

        statusEl.textContent =
          "갱신 시각: " + new Date(data.generatedAt).toLocaleString("ko-KR");

        resultsEl.innerHTML = data.results.map(renderGroup).join("");
      } catch (err) {
        statusEl.textContent = "오류: " + err.message;
      } finally {
        loadBtn.disabled = false;
      }
    }

    loadBtn.addEventListener("click", loadNews);
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`News test app running: http://localhost:${PORT}`);
});