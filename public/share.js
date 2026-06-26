(function () {
  'use strict';

  /**
   * Share page script — handles the recipient experience for a shared link.
   * Intentionally self-contained: does NOT load emotions-data.js or wheel.js
   * since recipients don't interact with the wheel at all.
   *
   * Token comes from the URL path: /share/TOKEN (after the vercel.json rewrite)
   * or fallback to ?token=TOKEN for local dev testing (since the rewrite only
   * applies on Vercel, not with `npm start`).
   */

  // ---------- Token extraction ----------
  function getToken() {
    // Production path: /share/TOKEN (vercel rewrite maps this to share.html)
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'share' && parts[1] && /^[A-Za-z0-9]{6}$/.test(parts[1])) {
      return parts[1];
    }
    // Local dev fallback: /share.html?token=TOKEN
    return new URLSearchParams(window.location.search).get('token');
  }

  const token = getToken();
  let shareData = null;   // payload from GET /api/share/:token
  let currentResult = null;
  let sessionId = crypto.randomUUID();

  // ---------- Screens ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) =>
      s.classList.toggle('is-active', s.id === id)
    );
  }

  // ---------- Animation (plain — no family color mapping without the wheel) ----------
  function animateSeedReveal(names, tier) {
    return new Promise((resolve) => {
      const sorted = [...names].map(n => n.trim().toLowerCase()).filter(Boolean).sort();
      const dateStr = new Date().toISOString().slice(0, 10);
      const seed = `${sorted.join('-')}-${dateStr}-${tier}`;
      const el = document.getElementById('seedReadout');
      el.innerHTML = '';
      const intervalMs = Math.max(30, Math.round(5000 / seed.length));

      const cursor = document.createElement('span');
      cursor.className = 'seed-cursor';
      cursor.textContent = '▌';
      el.appendChild(cursor);

      let i = 0;
      const interval = window.setInterval(() => {
        if (i >= seed.length) {
          window.clearInterval(interval);
          cursor.remove();
          const pause = 1000 + Math.random() * 2000;
          window.setTimeout(resolve, pause);
          return;
        }
        const span = document.createElement('span');
        span.textContent = seed[i];
        el.insertBefore(span, cursor);
        i++;
      }, intervalMs);
    });
  }

  function populateProcessingPills(emotions) {
    const container = document.getElementById('processingPills');
    container.innerHTML = '';
    emotions.forEach((name) => {
      const pill = document.createElement('span');
      pill.className = 'pill-wheel';
      pill.textContent = name;
      // No family color available without the wheel — use the clinical accent
      pill.style.background = 'var(--accent-clinical)';
      container.appendChild(pill);
    });
  }

  // ---------- Fetch comic by ID (direct, bypassing hash) ----------
  async function fetchComicById(comicId, tier) {
    const res = await fetch('/api/comic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comicId, tier }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `request failed (${res.status})`);
    }
    return res.json();
  }

  // ---------- Feedback ----------
  async function postFeedback(response) {
    if (!currentResult) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          tier: currentResult.tier,
          emotions: currentResult.emotionNames,
          comicSource: currentResult.source,
          comicId: currentResult.comic.id,
          response,
        }),
      });
    } catch (err) {
      console.warn('[share/feedback]', err.message);
    }
  }

  // ---------- Regulation check ----------
  function resetRegulationCheck(tier, hasUpgrade) {
    const ack = document.getElementById('regulationAck');
    ack.hidden = true;
    ack.textContent = '';
    document.querySelectorAll('.regulation-button').forEach(btn => {
      btn.disabled = false;
      btn.hidden = false;
    });
    // Hide upgrade button if already on upgraded tier, or if upgrade wasn't
    // pre-computed at share-creation time (upgradedComicId absent)
    const upgradeBtn = document.getElementById('upgradeButton');
    upgradeBtn.hidden = tier === 'upgraded' || !hasUpgrade;
    document.getElementById('regulationButtons').hidden = false;
    document.getElementById('resetButton').hidden = true;
  }

  async function onRegulationResponse(response) {
    document.querySelectorAll('.regulation-button').forEach(btn => { btn.disabled = true; });

    if (response === 'upgrade_requested') {
      const ack = document.getElementById('regulationAck');
      ack.hidden = false;
      ack.textContent = 'Escalating to upgraded protocol…';
      postFeedback(response);
      document.getElementById('regulationButtons').hidden = true;
      window.setTimeout(() => runSharedAlignment(shareData, true), 500);
      return;
    }

    postFeedback(response);
    document.getElementById('responseMessage').textContent = response === 'yes'
      ? 'Awesome! Keep feeling better!'
      : "Awwww... we're sorry that didn't help. Wanna try again?";
    showScreen('screen-response');
  }

  document.getElementById('regulationButtons').addEventListener('click', (evt) => {
    const btn = evt.target.closest('.regulation-button');
    if (!btn || btn.disabled) return;
    onRegulationResponse(btn.dataset.response);
  });

  // ---------- Reveal ----------
  function showReveal(data, emotions, tier) {
    const tagsEl = document.getElementById('revealTags');
    tagsEl.innerHTML = '';
    emotions.forEach(n => {
      const tag = document.createElement('span');
      tag.className = 'reveal-tag';
      tag.textContent = n;
      tagsEl.appendChild(tag);
    });

    const img = document.getElementById('comicImage');
    img.src = data.comic.imageUrl;
    img.alt = data.comic.blurb || data.comic.title || `Comic #${data.comic.id}`;

    const source = tier === 'upgraded' ? 'xkcd' : 'qwantz';

    document.getElementById('revealCaption').textContent =
      tier === 'upgraded'
        ? 'Your Holocene Gödelian Therapy is ready.'
        : 'Your Dino Therapy is ready.';

    document.getElementById('comicMeta').innerHTML =
      `Comic #${data.comic.id} of ${data.totalComics} on file · ` +
      `<a href="${data.comic.pageUrl}" target="_blank" rel="noopener">view on ${source}.com</a>`;

    currentResult = { comic: data.comic, tier, source, emotionNames: emotions };

    const hasUpgrade = tier !== 'upgraded' && Boolean(shareData && shareData.upgradedComicId);
    resetRegulationCheck(tier, hasUpgrade);
    showScreen('screen-reveal');
  }

  // ---------- Main alignment flow ----------
  async function runSharedAlignment(data, isUpgrade = false) {
    const tier = isUpgrade ? 'upgraded' : data.tier;
    const emotions = data.emotions;
    const comicId = isUpgrade ? data.upgradedComicId : data.comicId;

    // Update branding for upgraded tier
    if (tier === 'upgraded') {
      document.title = 'Holocene Gödelian Emotional Regulation Protocol — Shared';
      document.getElementById('siteTitle').textContent = 'Holocene Gödelian Emotional Regulation Protocol';
      document.getElementById('siteSub').textContent = 'H.G.E.R.P. · Methodology v2.1';
      document.getElementById('siteFooter').innerHTML =
        'The Holocene Gödelian Emotional Regulation Protocol helps you identify your emotions and practice healthy emotional regulation with a curated <a href="https://xkcd.com" target="_blank" rel="noopener">xkcd</a> comic by Randall Munroe. ' +
        'Feelings Wheel by <a href="https://feelingswheel.app/" target="_blank" rel="noopener">Geoffrey Roberts</a>. ' +
        '&middot; <a href="/stats.html">Protocol Outcomes</a>' +
        '&middot; <a href="/about.html">About the Emotional Regulation Protocol</a>';
    }

    document.getElementById('processingLabel').textContent =
      tier === 'upgraded'
        ? 'Escalating emotional resolution protocol…'
        : 'Resolving emotional state…';

    showScreen('screen-processing');
    populateProcessingPills(emotions);

    // Fetch the comic by ID directly (bypasses the hash — same comic as the sharer saw)
    const fetchPromise = fetchComicById(comicId, tier);

    await animateSeedReveal(emotions, tier);

    try {
      const comicData = await fetchPromise;
      showReveal(comicData, emotions, tier);
    } catch (err) {
      document.getElementById('errorMessage').textContent =
        `Could not load the comic: ${err.message}`;
      showScreen('screen-error');
    }
  }

  // ---------- Reset ----------
  document.getElementById('responseResetButton').addEventListener('click', () => {
    window.location.href = '/';
  });
  document.getElementById('resetButton').addEventListener('click', () => {
    window.location.href = '/';
  });

  // ---------- Init ----------
  if (!token) {
    document.getElementById('errorMessage').textContent =
      'No share token found in this URL.';
    showScreen('screen-error');
  } else {
    fetch(`/api/share/${token}`)
      .then(res => {
        if (!res.ok) throw new Error(`Share not found (${res.status})`);
        return res.json();
      })
      .then(data => {
        shareData = data;
        return runSharedAlignment(data);
      })
      .catch(err => {
        document.getElementById('errorMessage').textContent = err.message;
        showScreen('screen-error');
      });
  }
})();
