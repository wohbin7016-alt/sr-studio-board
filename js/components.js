/* SR스튜디오 Analytics — UI component library
 * Vanilla JS, runs from file://. Chart.js v4 expected as global `Chart`.
 * Exposes window.UI. No modules, no imports. */
(function () {
  "use strict";

  var PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"];
  var GRID = "rgba(255,255,255,0.06)";
  var TICK = "#94a3b8";

  // ---- tiny element helper ----------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---- number formatting -------------------------------------------------
  function fmt(n) {
    if (n == null) return "-";
    var num = Number(n);
    if (!isFinite(num)) return "-";
    var neg = num < 0;
    var rounded = Math.round(Math.abs(num));
    var s = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return neg ? "-" + s : s;
  }

  // ---- count-up animation (텐빌더 style: easeOutExpo + IO once) -----------
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function runCountUp(node, target, duration, suffix) {
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      var p = Math.min(elapsed / duration, 1);
      var eased = easeOutExpo(p);
      var current = target * eased;
      node.textContent = fmt(current) + suffix;
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        node.textContent = fmt(target) + suffix;
      }
    }
    requestAnimationFrame(frame);
  }

  function countUp(node, target, opts) {
    opts = opts || {};
    var duration = opts.duration || 1200;
    var suffix = opts.suffix || "";
    var fired = false;

    function go() {
      if (fired) return;
      fired = true;
      runCountUp(node, Number(target) || 0, duration, suffix);
    }

    if (typeof IntersectionObserver === "function") {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            go();
            io.disconnect();
            break;
          }
        }
      }, { threshold: 0.2 });
      io.observe(node);
    } else {
      go();
    }
  }

  // ---- KPI card ----------------------------------------------------------
  function kpiCard(cfg) {
    cfg = cfg || {};
    var wrap = el("div", "kpi-card");
    var valEl = el("div", "kpi-value");

    var suffix = cfg.suffix || "";
    var v = cfg.value;
    if (typeof v === "number" && isFinite(v)) {
      valEl.textContent = "0" + suffix;
      countUp(valEl, v, { suffix: suffix });
    } else {
      valEl.textContent = (v == null ? "-" : String(v)) + suffix;
    }
    wrap.appendChild(valEl);

    wrap.appendChild(el("div", "kpi-label", cfg.label || ""));

    if (typeof cfg.delta === "string" && cfg.delta.length > 0) {
      var first = cfg.delta.charAt(0);
      var cls = "kpi-delta";
      if (first === "+" || first === "▲") cls += " good";
      else if (first === "-" || first === "▼") cls += " bad";
      wrap.appendChild(el("div", cls, cfg.delta));
    }
    return wrap;
  }

  // ---- badge -------------------------------------------------------------
  function badge(text, type) {
    var t = type || "neutral";
    if (["good", "warn", "bad", "neutral"].indexOf(t) === -1) t = "neutral";
    var span = el("span", "badge " + t, text == null ? "" : String(text));
    return span;
  }

  // ---- card --------------------------------------------------------------
  function card(title, bodyEl) {
    var wrap = el("div", "card");
    wrap.appendChild(el("h2", "card-title", title || ""));
    if (bodyEl) wrap.appendChild(bodyEl);
    return wrap;
  }

  // ---- chart fallback ----------------------------------------------------
  function chartUnavailable(canvas) {
    var parent = canvas && canvas.parentNode;
    if (parent) {
      if (canvas.parentNode === parent) {
        try { parent.removeChild(canvas); } catch (e) {}
      }
      var note = el("div", "chart-error", "차트 로딩 실패");
      parent.appendChild(note);
    }
    return null;
  }

  function hasChart() {
    return typeof Chart !== "undefined" && Chart;
  }

  // ---- bar chart ---------------------------------------------------------
  function barChart(canvas, labels, values, opts) {
    if (!hasChart()) return chartUnavailable(canvas);
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 320);
    grad.addColorStop(0, "#22d3ee");
    grad.addColorStop(1, "#a78bfa");

    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: opts.label || "",
          data: values,
          backgroundColor: grad,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 48
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: opts.horizontal ? "y" : "x",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            titleColor: "#e2e8f0",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: { grid: { color: GRID }, ticks: { color: TICK } },
          y: { grid: { color: GRID }, ticks: { color: TICK } }
        }
      }
    });
  }

  // ---- line chart --------------------------------------------------------
  function hexToRgba(hex, alpha) {
    var h = (hex || "#22d3ee").replace("#", "");
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function lineChart(canvas, labels, datasets, opts) {
    if (!hasChart()) return chartUnavailable(canvas);
    opts = opts || {};
    var ctx = canvas.getContext("2d");

    var dsets = (datasets || []).map(function (d, i) {
      var color = d.color || PALETTE[i % PALETTE.length];
      return {
        label: d.label || "",
        data: d.data,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.12),
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 2.5,
        pointBackgroundColor: color,
        fill: true
      };
    });

    return new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: dsets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { color: TICK }
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            titleColor: "#e2e8f0",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: { grid: { color: GRID }, ticks: { color: TICK } },
          y: { grid: { color: GRID }, ticks: { color: TICK } }
        }
      }
    });
  }

  // ---- doughnut ----------------------------------------------------------
  function doughnut(canvas, labels, values) {
    if (!hasChart()) return chartUnavailable(canvas);
    var ctx = canvas.getContext("2d");
    var colors = (labels || []).map(function (_, i) {
      return PALETTE[i % PALETTE.length];
    });

    return new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: "rgba(15,23,42,0.6)",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            display: true,
            position: "right",
            labels: { color: TICK }
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            titleColor: "#e2e8f0",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            padding: 10
          }
        }
      }
    });
  }

  // ---- table -------------------------------------------------------------
  function table(headers, rows) {
    var wrap = el("div", "table-wrap");
    var tbl = document.createElement("table");

    var thead = document.createElement("thead");
    var htr = document.createElement("tr");
    var numCols = {};
    (headers || []).forEach(function (h, i) {
      var label = String(h);
      var isNum = false;
      if (label.length >= 4 && label.slice(-4) === "|num") {
        isNum = true;
        label = label.slice(0, -4);
        numCols[i] = true;
      }
      var th = el("th", isNum ? "num" : null, label);
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    tbl.appendChild(thead);

    var tbody = document.createElement("tbody");
    (rows || []).forEach(function (row) {
      var tr = document.createElement("tr");
      (row || []).forEach(function (cell, i) {
        var td = document.createElement("td");
        if (numCols[i]) td.className = "num";
        if (cell instanceof HTMLElement) {
          td.appendChild(cell);
        } else if (typeof cell === "number") {
          td.textContent = fmt(cell);
        } else {
          td.textContent = cell == null ? "" : String(cell);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);

    wrap.appendChild(tbl);
    return wrap;
  }

  // ---- export ------------------------------------------------------------
  window.UI = {
    el: el,
    fmt: fmt,
    countUp: countUp,
    kpiCard: kpiCard,
    badge: badge,
    card: card,
    barChart: barChart,
    lineChart: lineChart,
    doughnut: doughnut,
    table: table
  };
})();
