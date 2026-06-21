(function () {
  'use strict';

  // EMOTION_WHEEL comes from emotions-data.js, OAEWheel from wheel.js —
  // both loaded as plain <script> tags before this file, sharing the
  // same global scope.
  const layout = OAEWheel.computeLayout(EMOTION_WHEEL);
  const svg = document.getElementById('wheel');

  // Fast lookup: wedge id → core family index (for pill colors)
  const idToCoreIndex = {};
  layout.cores.forEach(c => { idToCoreIndex[c.id] = c.coreIndex; });
  layout.middles.forEach(m => { idToCoreIndex[m.id] = m.coreIndex; });
  layout.leaves.forEach(l => { idToCoreIndex[l.id] = l.coreIndex; });

  /** @type {{id: string, name: string, coreIndex: number|undefined}[]} */
  const selected = [];

  // Spans from selection through standard + optional upgrade; resets on "New session"
  let sessionId = crypto.randomUUID();

  // Most recently resolved comic — needed by regulation-check feedback buttons
  let currentResult = null; // { comic, tier, source, emotionNames }

  function isSelected(id) {
    return selected.some((s) => s.id === id);
  }

  // ---------- Time-of-day greeting, fixed to GMT-7 regardless of visitor's locale ----------
  function getTimeOfDayPhrase() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const gmtMinus7 = new Date(utcMs - 7 * 60 * 60 * 1000);
    const hour = gmtMinus7.getUTCHours();
    if (hour >= 5 && hour < 12) return 'this morning';
    if (hour >= 12 && hour < 17) return 'this afternoon';
    if (hour >= 17 && hour < 21) return 'this evening';
    return 'today';
  }

  // ---------- Selection tray ----------
  function renderTray() {
    document.getElementById('selectedCount').textContent = String(selected.length);
    const tray = document.getElementById('trayPills');
    tray.innerHTML = '';
    selected.forEach((s) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.textContent = s.name;
      pill.setAttribute('aria-label', `Remove ${s.name} from selection`);
      if (s.coreIndex !== undefined) {
        pill.style.background = `var(--c${s.coreIndex}-core)`;
        pill.style.color = 'var(--white)';
        pill.style.borderColor = 'transparent';
      }
      pill.addEventListener('click', () => toggleItem(s.id, s.name));
      tray.appendChild(pill);
    });
    const btn = document.getElementById('alignButton');
    btn.disabled = selected.length === 0;
    btn.textContent = selected.length === 0 ? 'Choose up to Three' : 'Get Dino Therapy';
  }

  function flashTrayLimit() {
    const tray = document.querySelector('.selection-tray');
    tray.classList.add('limit-flash');
    window.setTimeout(() => tray.classList.remove('limit-flash'), 420);
  }

  function toggleItem(id, name) {
    const idx = selected.findIndex((s) => s.id === id);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= 3) {
        flashTrayLimit();
        return;
      }
      selected.push({ id, name, coreIndex: idToCoreIndex[id] });
    }
    OAEWheel.updateWheelSelectionStyles(svg, isSelected);
    renderTray();
  }

  function onLeafFocus(name) {
    document.getElementById('focusReadoutValue').textContent = name || '—';
  }

  OAEWheel.renderWheel(svg, layout, { isSelected, onToggle: toggleItem, onFocus: onLeafFocus });

  // ---------- Screens ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  }

  function populateProcessingPills() {
    const container = document.getElementById('processingPills');
    container.innerHTML = '';
    selected.forEach((s) => {
      const pill = document.createElement('span');
      pill.className = 'pill-wheel';
      pill.textContent = s.name;
      if (s.coreIndex !== undefined) {
        pill.style.background = `var(--c${s.coreIndex}-core)`;
      }
      container.appendChild(pill);
    });
  }

  // Builds a {char, color}[] array mirroring the exact seed the server hashes —
  // emotions get their family color, separators/date/tier are neutral.
  function buildColoredChars(names, tier) {
    const nameToCoreIndex = Object.fromEntries(selected.map(s => [s.name.toLowerCase(), s.coreIndex]));
    const sorted = [...names].map(n => n.trim().toLowerCase()).filter(Boolean).sort();
    const dateStr = new Date().toISOString().slice(0, 10);
    const chars = [];
    sorted.forEach((n) => {
      const ci = nameToCoreIndex[n];
      const color = ci !== undefined ? `var(--c${ci}-core)` : null;
      for (const ch of n) chars.push({ char: ch, color });
      chars.push({ char: '-', color: null });
    });
    for (const ch of dateStr) chars.push({ char: ch, color: null });
    const suffix = `-${tier}`;
    for (const ch of suffix) chars.push({ char: ch, color: null });
    return chars;
  }

  function animateSeedReveal(names, tier) {
    return new Promise((resolve) => {
      const chars = buildColoredChars(names, tier);
      const el = document.getElementById('seedReadout');
      el.innerHTML = '';
      const intervalMs = Math.max(30, Math.round(5000 / chars.length));

      const cursor = document.createElement('span');
      cursor.className = 'seed-cursor';
      cursor.textContent = '▌';
      el.appendChild(cursor);

      let i = 0;
      const interval = window.setInterval(() => {
        if (i >= chars.length) {
          window.clearInterval(interval);
          cursor.remove();
          const pause = 1000 + Math.random() * 2000;
          window.setTimeout(resolve, pause);
          return;
        }
        const { char, color } = chars[i];
        const span = document.createElement('span');
        span.textContent = char;
        if (color) span.style.color = color;
        el.insertBefore(span, cursor);
        i++;
      }, intervalMs);
    });
  }

  function clearProcessingError() {
    const screen = document.getElementById('screen-processing');
    screen.classList.remove('has-error');
    screen.querySelectorAll('.processing-error').forEach((el) => el.remove());
  }

  function showProcessingError(err) {
    const screen = document.getElementById('screen-processing');
    screen.classList.add('has-error');
    const msg = document.createElement('div');
    msg.className = 'processing-error';
    msg.textContent = `Alignment failed: ${err.message}`;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'retry-button';
    retry.textContent = 'Back to wheel';
    retry.addEventListener('click', () => {
      clearProcessingError();
      showScreen('screen-intake');
    });
    msg.appendChild(document.createElement('br'));
    msg.appendChild(retry);
    screen.appendChild(msg);
  }

  // ---------- Regulation check ----------
  function resetRegulationCheck(tier) {
    const ack = document.getElementById('regulationAck');
    ack.hidden = true;
    ack.textContent = '';

    document.querySelectorAll('.regulation-button').forEach((btn) => {
      btn.disabled = false;
      btn.hidden = false;
    });
    // No further upgrade to offer once already on the upgraded tier
    document.getElementById('upgradeButton').hidden = tier === 'upgraded';
    document.getElementById('regulationButtons').hidden = false;
    document.getElementById('resetButton').hidden = true;
  }

  async function postFeedback(response) {
    if (!currentResult) return;
    const payload = {
      sessionId,
      tier: currentResult.tier,
      emotions: currentResult.emotionNames,
      comicSource: currentResult.source,
      comicId: currentResult.comic.id,
      response,
    };
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
    } catch (err) {
      // Feedback is supplementary — log it but don't interrupt the experience
      console.warn('[feedback] failed to record response:', err.message);
    }
  }

  async function onRegulationResponse(response) {
    document.querySelectorAll('.regulation-button').forEach((btn) => { btn.disabled = true; });

    if (response === 'upgrade_requested') {
      const ack = document.getElementById('regulationAck');
      ack.hidden = false;
      ack.textContent = 'Escalating to upgraded protocol…';
      postFeedback(response);
      document.getElementById('regulationButtons').hidden = true;
      const names = currentResult.emotionNames;
      window.setTimeout(() => runAlignment(names, 'upgraded'), 500);
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
  function showReveal(data, names, tier) {
    const tagsEl = document.getElementById('revealTags');
    tagsEl.innerHTML = '';
    names.forEach((n) => {
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

    currentResult = { comic: data.comic, tier, source, emotionNames: names };

    resetRegulationCheck(tier);
    showScreen('screen-reveal');
  }

  // ---------- Alignment ----------
  async function runAlignment(names, tier) {
    clearProcessingError();
    document.getElementById('processingLabel').textContent =
      tier === 'upgraded'
        ? 'Escalating emotional resolution protocol…'
        : 'Resolving emotional state…';
    if (tier === 'upgraded') {
      document.title = 'Holocene Gödelian Emotional Regulation Protocol';
      document.querySelector('.masthead-text h1').textContent = 'Holocene Gödelian Emotional Regulation Protocol';
      document.querySelector('.masthead-sub').textContent = 'H.G.E.R.P. · Methodology v2.1';
      document.getElementById('siteFooter').innerHTML =
        'The Holocene Gödelian Emotional Regulation Protocol helps you identify your emotions and practice healthy emotional regulation with a curated <a href="https://xkcd.com" target="_blank" rel="noopener">xkcd</a> comic by Randall Munroe. ' +
        'Feelings Wheel by <a href="https://feelingswheel.app/" target="_blank" rel="noopener">Geoffrey Roberts</a>. ' +
        '&middot; <a href="/stats.html">Protocol Outcomes</a>';
    }
    showScreen('screen-processing');
    populateProcessingPills();

    // Fetch runs in parallel with the animation so the comic is ready when the pause ends
    const fetchPromise = fetch('/api/comic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emotions: names, tier }),
    });

    await animateSeedReveal(names, tier);

    try {
      const res = await fetchPromise;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `request failed (${res.status})`);
      }
      const data = await res.json();
      showReveal(data, names, tier);
    } catch (err) {
      showProcessingError(err);
    }
  }

  document.getElementById('alignButton').addEventListener('click', () => {
    const names = selected.map((s) => s.name);
    runAlignment(names, 'standard');
  });

  function resetToIntake() {
    sessionId = crypto.randomUUID();
    currentResult = null;
    selected.length = 0;
    document.title = 'Dinosaur Comics Therapy';
    document.querySelector('.masthead-text h1').textContent = 'Dinosaur Comics Therapy';
    document.querySelector('.masthead-sub').textContent = 'Maastrichtian emotional regulation protocol — Methodology v1.3';
    document.getElementById('siteFooter').innerHTML =
      'The Maastrichtian emotional regulation protocol helps you identify your emotions and practice healthy emotional regulation with a selected <a href="https://www.qwantz.com" target="_blank" rel="noopener">Dinosaur Comic</a> by Ryan North. ' +
      'Feelings Wheel by <a href="https://feelingswheel.app/" target="_blank" rel="noopener">Geoffrey Roberts</a>. ' +
      '&middot; <a href="/stats.html">Protocol Outcomes</a>';
    OAEWheel.updateWheelSelectionStyles(svg, isSelected);
    renderTray();
    showScreen('screen-intake');
  }

  document.getElementById('responseResetButton').addEventListener('click', resetToIntake);

  document.getElementById('resetButton').addEventListener('click', resetToIntake);

  // ---------- Init ----------
  document.getElementById('timeOfDay').textContent = getTimeOfDayPhrase();
  renderTray();
})();
