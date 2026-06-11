// pages.js — SR스튜디오 Analytics 페이지 렌더러
// 의존: window.DATA, window.UI (다른 에이전트가 생성)
(function () {
  'use strict';

  var UI = window.UI;
  var el = UI.el;

  // ---- 공통 헬퍼 ----
  var COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];

  function channels() {
    return (window.DATA && window.DATA.channels) || [];
  }

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function isShorts(dur) {
    return num(dur) > 0 && num(dur) <= 65;
  }

  function fmtDuration(sec) {
    sec = num(sec);
    if (sec <= 0) return '-';
    if (isShorts(sec)) return 'Shorts';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + '분 ' + s + '초';
  }

  function shortDate(d) {
    if (!d) return '';
    var parts = String(d).split('-');
    if (parts.length === 3) return parts[1] + '-' + parts[2];
    return d;
  }

  function linkEl(title, url) {
    var a = el('a', 'vid-link', title || '(제목 없음)');
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  }

  function typeBadge(dur) {
    return isShorts(dur)
      ? UI.badge('Shorts', 'good')
      : UI.badge('롱폼', 'neutral');
  }

  // chart-card 래퍼: 캔버스를 DOM에 붙인 뒤 콜백으로 차트 그림
  function chartCard(title, drawFn) {
    var canvas = el('canvas');
    var body = el('div', 'chart-body');
    body.appendChild(canvas);
    var cardEl = UI.card(title, body);
    if (!cardEl.classList.contains('chart-card')) {
      cardEl.classList.add('chart-card');
    }
    // DOM 부착 후 그리도록 microtask 지연
    Promise.resolve().then(function () {
      try {
        drawFn(canvas);
      } catch (e) {
        /* 차트 실패는 무시 */
      }
    });
    return cardEl;
  }

  // 전 채널 영상 수집(채널명 태그)
  function allTaggedVideos() {
    var out = [];
    channels().forEach(function (ch) {
      var lists = [ch.top_videos, ch.recent_videos];
      lists.forEach(function (list) {
        (list || []).forEach(function (v) {
          out.push({
            channel: ch.name,
            title: v.title,
            views: num(v.views),
            date: v.date || '',
            duration: num(v.duration),
            url: v.url
          });
        });
      });
    });
    return out;
  }

  function dedupeByUrl(list) {
    var seen = {};
    var out = [];
    list.forEach(function (v) {
      var key = v.url || (v.channel + '|' + v.title + '|' + v.date);
      if (seen[key]) return;
      seen[key] = true;
      out.push(v);
    });
    return out;
  }

  // ============ DASHBOARD ============
  function dashboard(root) {
    root.innerHTML = '';
    var chs = channels();

    var totSubs = 0, totViews30 = 0, totUploads30 = 0, avgSum = 0, avgCnt = 0;
    chs.forEach(function (ch) {
      if (typeof ch.subscribers === 'number') totSubs += ch.subscribers;
      totViews30 += num(ch.views_30d);
      totUploads30 += num(ch.uploads_30d);
      if (typeof ch.avg_views === 'number') {
        avgSum += ch.avg_views;
        avgCnt++;
      }
    });
    var avgViews = avgCnt ? Math.round(avgSum / avgCnt) : 0;

    var kpi = el('div', 'kpi-grid');
    kpi.appendChild(UI.kpiCard({ label: '총 구독자', value: totSubs }));
    kpi.appendChild(UI.kpiCard({ label: '30일 총 조회수', value: totViews30 }));
    kpi.appendChild(UI.kpiCard({ label: '30일 업로드', value: totUploads30 }));
    kpi.appendChild(UI.kpiCard({ label: '채널 평균 조회수', value: avgViews }));
    root.appendChild(kpi);
    // countUp 적용
    Array.prototype.forEach.call(kpi.querySelectorAll('[data-countup]'), function (node) {
      var t = parseFloat(node.getAttribute('data-countup'));
      if (isFinite(t)) UI.countUp(node, t);
    });

    // grid-2: 채널별 30일 조회수(가로 막대) + 구독자 분포(도넛)
    var grid2 = el('div', 'grid-2');
    var labels = chs.map(function (c) { return c.name; });
    var views30 = chs.map(function (c) { return num(c.views_30d); });
    grid2.appendChild(chartCard('채널별 30일 조회수', function (cv) {
      UI.barChart(cv, labels, views30, { horizontal: true, label: '30일 조회수' });
    }));
    var subLabels = chs.map(function (c) { return c.name; });
    var subVals = chs.map(function (c) { return typeof c.subscribers === 'number' ? c.subscribers : 0; });
    grid2.appendChild(chartCard('구독자 분포', function (cv) {
      UI.doughnut(cv, subLabels, subVals);
    }));
    root.appendChild(grid2);

    // TOP 10 영상
    var top = [];
    chs.forEach(function (ch) {
      (ch.top_videos || []).forEach(function (v) {
        top.push({ channel: ch.name, title: v.title, views: num(v.views), date: v.date || '', duration: num(v.duration), url: v.url });
      });
    });
    top.sort(function (a, b) { return b.views - a.views; });
    top = top.slice(0, 10);

    var rows = top.map(function (v, i) {
      return [
        i + 1,
        UI.badge(v.channel, 'neutral'),
        linkEl(v.title, v.url),
        v.views,
        shortDate(v.date),
        typeBadge(v.duration)
      ];
    });
    var tbl = UI.table(['순위', '채널', '제목', '조회수|num', '날짜', '유형'], rows);
    root.appendChild(UI.card('전 채널 TOP 10 영상', tbl));
  }

  // ============ CHANNELS ============
  function channels_page(root) {
    root.innerHTML = '';
    var grid = el('div', 'chan-grid');

    channels().forEach(function (ch) {
      var cardBody = el('div', 'chan-card');

      var head = el('div', 'chan-head');
      head.appendChild(el('h3', 'chan-name', ch.name));
      var subTxt = typeof ch.subscribers === 'number'
        ? '구독 ' + UI.fmt(ch.subscribers)
        : '구독 미상';
      head.appendChild(UI.badge(subTxt, 'neutral'));
      cardBody.appendChild(head);

      var mini = el('div', 'kpi-grid');
      mini.appendChild(UI.kpiCard({ label: '평균 조회수', value: num(ch.avg_views) }));
      mini.appendChild(UI.kpiCard({ label: '중간값', value: num(ch.median_views) }));
      mini.appendChild(UI.kpiCard({ label: '30일 업로드', value: num(ch.uploads_30d) }));
      mini.appendChild(UI.kpiCard({ label: '30일 조회수', value: num(ch.views_30d) }));
      cardBody.appendChild(mini);

      var recent = (ch.recent_videos || []).slice().reverse(); // oldest->newest
      var lbls = recent.map(function (v) { return shortDate(v.date); });
      var vals = recent.map(function (v) { return num(v.views); });
      if (recent.length) {
        cardBody.appendChild(chartCard('최근 영상 조회수', function (cv) {
          UI.lineChart(cv, lbls, [{ label: '조회수', data: vals, color: '#22d3ee' }]);
        }));
      }

      var open = el('a', 'chan-open', '채널 열기 →');
      if (ch.url) { open.href = ch.url; open.target = '_blank'; open.rel = 'noopener'; }
      cardBody.appendChild(open);

      grid.appendChild(cardBody);
    });

    root.appendChild(grid);
  }

  // ============ VIDEOS ============
  function videos(root) {
    root.innerHTML = '';
    var chs = channels();
    var all = dedupeByUrl(allTaggedVideos());

    var filterRow = el('div', 'filter-row');
    var selChan = el('select', 'flt-channel');
    var optAll = el('option', null, '전체');
    optAll.value = '__all__';
    selChan.appendChild(optAll);
    chs.forEach(function (c) {
      var o = el('option', null, c.name);
      o.value = c.name;
      selChan.appendChild(o);
    });

    var selSort = el('select', 'flt-sort');
    var oDate = el('option', null, '날짜별'); oDate.value = 'date';
    var oViews = el('option', null, '조회수순'); oViews.value = 'views';
    selSort.appendChild(oDate);
    selSort.appendChild(oViews);

    filterRow.appendChild(selChan);
    filterRow.appendChild(selSort);
    root.appendChild(filterRow);

    var tableHolder = el('div', 'table-holder');
    root.appendChild(tableHolder);

    function toRow(v) {
      return [
        UI.badge(v.channel, 'neutral'),
        linkEl(v.title, v.url),
        v.views,
        shortDate(v.date),
        isShorts(v.duration) ? 'Shorts' : fmtDuration(v.duration)
      ];
    }

    function rebuild() {
      var chFilter = selChan.value;
      var sortBy = selSort.value;
      var rows = all.filter(function (v) {
        return chFilter === '__all__' || v.channel === chFilter;
      });
      tableHolder.innerHTML = '';

      if (sortBy === 'views') {
        rows.sort(function (a, b) { return b.views - a.views; });
        tableHolder.appendChild(
          UI.table(['채널', '제목', '조회수|num', '날짜', '길이'], rows.map(toRow))
        );
        return;
      }

      // 날짜별 그룹 (최신 날짜 먼저, 그룹 안은 조회수순)
      var groups = {};
      rows.forEach(function (v) {
        var d = v.date || '날짜 미상';
        (groups[d] = groups[d] || []).push(v);
      });
      var dates = Object.keys(groups).sort().reverse();
      dates.forEach(function (d) {
        var g = groups[d];
        g.sort(function (a, b) { return b.views - a.views; });
        var sum = g.reduce(function (s, v) { return s + num(v.views); }, 0);
        tableHolder.appendChild(el('h3', 'date-head',
          '📅 ' + d + ' · ' + g.length + '개 · ' + UI.fmt(sum) + '뷰'));
        tableHolder.appendChild(
          UI.table(['채널', '제목', '조회수|num', '날짜', '길이'], g.map(toRow))
        );
      });
      if (!dates.length) {
        tableHolder.appendChild(el('p', 'muted', '영상 없음'));
      }
    }

    selChan.addEventListener('change', rebuild);
    selSort.addEventListener('change', rebuild);
    rebuild();
  }

  // ============ GROWTH ============
  function growth(root) {
    root.innerHTML = '';
    var chs = channels();

    // 날짜 union (정렬)
    var dateSet = {};
    chs.forEach(function (ch) {
      (ch.recent_videos || []).forEach(function (v) {
        if (v.date) dateSet[v.date] = true;
      });
    });
    var dates = Object.keys(dateSet).sort();
    var labels = dates.map(shortDate);

    var datasets = chs.map(function (ch, i) {
      var byDate = {};
      (ch.recent_videos || []).forEach(function (v) {
        if (v.date) byDate[v.date] = num(v.views);
      });
      var data = dates.map(function (d) {
        return Object.prototype.hasOwnProperty.call(byDate, d) ? byDate[d] : null;
      });
      return { label: ch.name, data: data, color: COLORS[i % COLORS.length] };
    });

    root.appendChild(chartCard('채널별 최근 영상 조회수 추이', function (cv) {
      UI.lineChart(cv, labels, datasets);
    }));

    var grid2 = el('div', 'grid-2');

    var upLabels = chs.map(function (c) { return c.name; });
    var upVals = chs.map(function (c) { return num(c.uploads_30d); });
    grid2.appendChild(chartCard('30일 업로드 수', function (cv) {
      UI.barChart(cv, upLabels, upVals, { label: '업로드 수' });
    }));

    var effLabels = chs.map(function (c) { return c.name; });
    var effVals = chs.map(function (c) {
      var subs = Math.max(typeof c.subscribers === 'number' ? c.subscribers : 1, 1);
      return Math.round((num(c.views_30d) / subs) * 100);
    });
    var effCard = chartCard('구독자 대비 30일 조회 효율', function (cv) {
      UI.barChart(cv, effLabels, effVals, { label: '효율(%)' });
    });
    var cap = el('div', 'muted chart-caption', '효율 = 30일 조회수 ÷ 구독자 (왜그럴까처럼 구독자 적은 채널은 수치가 크게 튈 수 있음)');
    effCard.appendChild(cap);
    grid2.appendChild(effCard);

    root.appendChild(grid2);
  }

  // ============ SETTINGS ============
  function settings(root) {
    root.innerHTML = '';
    var chs = channels();

    var rows = chs.map(function (ch) {
      var urlEl = linkEl(ch.url || '', ch.url);
      return [
        ch.name,
        typeof ch.subscribers === 'number' ? ch.subscribers : 0,
        num(ch.sampled),
        ch.analyzed_at || '-',
        urlEl
      ];
    });
    var tbl = UI.table(['채널', '구독자|num', '표본 수|num', '분석 시각', 'URL'], rows);
    root.appendChild(UI.card('분석 채널', tbl));

    var refreshBody = el('div', 'refresh-body');
    var pre = el('pre', 'muted code-block',
      'python3 ~/srstudio/scripts/channel_analyzer.py refresh\n' +
      'python3 ~/srstudio/scripts/gen_data.py');
    refreshBody.appendChild(pre);
    refreshBody.appendChild(el('p', 'muted', '갱신 후 이 페이지 새로고침.'));
    root.appendChild(UI.card('데이터 갱신 방법', refreshBody));

    var gen = (window.DATA && window.DATA.generated_at) || '알 수 없음';
    root.appendChild(el('p', 'muted footer-line', '데이터 생성 시각: ' + gen));
  }

  // ---- 🏭 운영현황 (gen_partner_dashboard.py가 생성하는 ops.html을 iframe으로) ----
  function ops(root) {
    root.innerHTML = '';
    var frame = el('iframe', 'ops-frame');
    frame.src = 'ops.html';
    frame.setAttribute('title', '에스알스튜디오 운영현황');
    frame.onerror = function () {
      root.innerHTML = '';
      root.appendChild(UI.card('운영현황', el('p', 'muted', 'ops.html을 불러오지 못했습니다.')));
    };
    root.appendChild(frame);
  }

  // ---- 💡 AI 어드바이스 (window.ADVICE — gen_advice.py가 Claude로 생성) ----
  function gradeType(g) {
    return g === 'A' ? 'good' : g === 'B' ? 'neutral' : g === 'C' ? 'warn' : 'bad';
  }

  function advice(root) {
    root.innerHTML = '';
    var A = window.ADVICE;
    if (!A || !A.channels) {
      var emptyBody = el('div');
      emptyBody.appendChild(el('p', 'muted',
        '아직 어드바이스가 생성되지 않았습니다. 터미널에서 실행:'));
      emptyBody.appendChild(el('pre', 'muted code-block',
        'python3 ~/srstudio/scripts/gen_advice.py --force'));
      root.appendChild(UI.card('💡 AI 어드바이스', emptyBody));
      return;
    }

    // 종합 전략
    var overallWrap = el('div', 'grid-2');
    (A.overall || []).forEach(function (o) {
      var body = el('div');
      body.appendChild(el('p', '', o.body || ''));
      overallWrap.appendChild(UI.card('🎯 ' + (o.title || ''), body));
    });
    root.appendChild(el('h2', 'card-title section-head', '종합 전략'));
    root.appendChild(overallWrap);

    // 채널별 진단
    root.appendChild(el('h2', 'card-title section-head', '채널별 진단·처방'));
    var grid = el('div', 'chan-grid');
    (A.channels || []).forEach(function (c) {
      var card = el('div', 'chan-card');
      var head = el('div', 'chan-head');
      head.appendChild(el('h3', '', c.name || ''));
      head.appendChild(UI.badge('등급 ' + (c.grade || '?'), gradeType(c.grade)));
      card.appendChild(head);
      card.appendChild(el('p', '', c.diagnosis || ''));
      var ul = el('ul', 'advice-actions');
      (c.actions || []).forEach(function (a) {
        ul.appendChild(el('li', '', a));
      });
      card.appendChild(ul);
      grid.appendChild(card);
    });
    root.appendChild(grid);

    root.appendChild(el('p', 'muted footer-line',
      'AI 분석 생성 시각: ' + (A.generated_at || '-') + ' · 데이터 갱신 시 자동 재분석'));
  }

  window.PAGES = {
    ops: ops,
    dashboard: dashboard,
    channels: channels_page,
    videos: videos,
    growth: growth,
    advice: advice,
    settings: settings
  };
})();
