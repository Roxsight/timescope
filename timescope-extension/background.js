// TimeScope Browser Tracker - background.js
// Matches Python logger behavior: one POST per 30 seconds of activity.

const API_URL = "http://localhost:8080/api/logs";
const FLUSH_INTERVAL_SECONDS = 60;

// In-memory accumulator: { "domain | title": secondsSpent }
let accumulator = {};

// Currently active tab info
let activeTab = null;
let activeStart = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isTrackableUrl(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ─── Accumulation ────────────────────────────────────────────────────────────

function commitActiveTab() {
  if (!activeTab || !activeStart) return;
  const elapsed = Math.floor((Date.now() - activeStart) / 1000);
  if (elapsed < 2) return;

  const key = `${activeTab.domain} | ${(activeTab.title || activeTab.domain).slice(0, 80).trim()}`;
  accumulator[key] = (accumulator[key] || 0) + elapsed;
}

function setActiveTab(url, title) {
  commitActiveTab();

  if (!isTrackableUrl(url)) {
    activeTab = null;
    activeStart = null;
    return;
  }

  const domain = getDomain(url);
  if (!domain) {
    activeTab = null;
    activeStart = null;
    return;
  }

  activeTab = { domain, title: title || domain };
  activeStart = Date.now();
}

// ─── Flush to Backend ────────────────────────────────────────────────────────
// Mirrors Python logger: one row per 30 seconds of activity.
// AppLog model fields: appName, windowTitle, timestamp

async function flush() {
  commitActiveTab();
  if (activeTab) activeStart = Date.now(); // reset for ongoing tab

  if (Object.keys(accumulator).length === 0) return;

  const toSend = { ...accumulator };
  accumulator = {};

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  for (const [key, seconds] of Object.entries(toSend)) {
    const [domain, ...titleParts] = key.split(" | ");
    const title = titleParts.join(" | "); // rejoin in case title contained " | "

    // One POST per 30-second interval — matches how UsageController counts minutes
    const rowCount = Math.floor(seconds / 30);
    if (rowCount < 1) {
      // Less than 30s — carry it forward instead of discarding
      accumulator[key] = (accumulator[key] || 0) + seconds;
      continue;
    }

    // Carry over remainder so it's not lost
    const remainder = seconds % 30;
    if (remainder > 0) {
      accumulator[key] = (accumulator[key] || 0) + remainder;
    }

    for (let i = 0; i < rowCount; i++) {
      try {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appName: key,          // "github.com | Page Title" — shown in dashboard
            windowTitle: title,    // just the title part
            timestamp              // "2025-04-15 14:32:00" — matches deleteByTimestampStartingWith(date)
          })
        });
      } catch (e) {
        // Spring Boot down — put seconds back
        accumulator[key] = (accumulator[key] || 0) + 30;
        console.warn("[TimeScope] Failed to send log, will retry:", key);
      }
    }
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    setActiveTab(tab.url, tab.title);
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.status === "complete" || changeInfo.title) {
    setActiveTab(tab.url, tab.title);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    commitActiveTab();
    activeTab = null;
    activeStart = null;
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) setActiveTab(tab.url, tab.title);
  } catch {}
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    commitActiveTab();
    activeTab = null;
    activeStart = null;
  } else if (state === "active") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) setActiveTab(tab.url, tab.title);
    });
  }
});

// ─── Alarm ───────────────────────────────────────────────────────────────────

chrome.alarms.create("flush", { periodInMinutes: FLUSH_INTERVAL_SECONDS / 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flush();
});

// ─── Startup ─────────────────────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) setActiveTab(tab.url, tab.title);
});