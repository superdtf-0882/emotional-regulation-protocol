/**
 * Renders the three-tier emotion wheel as an SVG sunburst.
 *
 * Design choice: only the outer (leaf/granular) ring is clickable.
 * The core and middle rings are visual context — labeled bands that
 * show you which family a granular emotion belongs to.
 *
 * Design choice: leaf wedges carry no inline text. At ~80+ granular
 * emotions, in-wedge labels would be unreadable on any screen, mobile
 * especially — pinch-to-zoom on a single small SVG also fights the
 * page's own scroll/zoom gestures. Instead, focusing or hovering a
 * wedge surfaces its full name in a large, fixed-position readout
 * (#focusReadout in the markup), and selections show as full-size
 * pills. Same underlying goal (nothing forces you to read tiny text)
 * solved in a way that actually works on a phone.
 */

const VIEW_SIZE = 600;
const CENTER = VIEW_SIZE / 2;
const RADIUS = {
  hole: 46,
  coreOuter: 130,
  middleOuter: 205,
  leafOuter: 292,
};
const WEDGE_GAP_DEG = 0.5;

function polarToCartesian(radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function arcPath(rInner, rOuter, startDeg, endDeg) {
  const start = Math.min(startDeg, endDeg);
  const end = Math.max(startDeg, endDeg);
  const largeArc = end - start > 180 ? 1 : 0;

  const outerStart = polarToCartesian(rOuter, start);
  const outerEnd = polarToCartesian(rOuter, end);
  const innerStart = polarToCartesian(rInner, start);
  const innerEnd = polarToCartesian(rInner, end);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Walks the EMOTION_WHEEL tree once and assigns every leaf an equal
 * angular slice (360 / totalLeaves). Middle and core bands then simply
 * span the angle range covered by their descendants — a standard
 * sunburst partition, computed top-down by accumulation.
 */
function computeLayout(wheelData) {
  const totalLeaves = wheelData.reduce(
    (sum, core) => sum + core.middles.reduce((s, m) => s + m.leaves.length, 0),
    0
  );
  const leafAngle = 360 / totalLeaves;

  const cores = [];
  const middles = [];
  const leaves = [];

  let cursor = 0;
  let leafId = 0;

  wheelData.forEach((core, coreIndex) => {
    const coreStart = cursor;
    core.middles.forEach((middle, middleIndex) => {
      const middleStart = cursor;
      middle.leaves.forEach((leafName) => {
        leaves.push({
          id: `leaf-${leafId++}`,
          name: leafName,
          coreIndex,
          middleIndex,
          start: cursor,
          end: cursor + leafAngle,
        });
        cursor += leafAngle;
      });
      middles.push({
        id: `mid-${coreIndex}-${middleIndex}`,
        name: middle.name,
        coreIndex,
        middleIndex,
        start: middleStart,
        end: cursor,
      });
    });
    cores.push({
      id: `core-${coreIndex}`,
      name: core.core,
      coreIndex,
      start: coreStart,
      end: cursor,
    });
  });

  return { cores, middles, leaves, totalLeaves };
}

function withGap(start, end, gapDeg) {
  const gap = Math.min(gapDeg, (end - start) * 0.3);
  return [start + gap / 2, end - gap / 2];
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/**
 * Renders the wheel into the given <svg>, wiring up pointer + keyboard
 * interaction on all three tiers.
 *
 * callbacks.onToggle(id, name) — fired on click/Enter/Space on any wedge
 * callbacks.onFocus(name | null) — fired on hover/focus/blur
 */
function renderWheel(svg, layout, { isSelected, onToggle, onFocus }) {
  const onLeafToggle = onToggle;
  const onLeafFocus = onFocus;
  svg.setAttribute('viewBox', `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  svg.innerHTML = '';

  const group = svgEl('g', { class: 'wheel-group' });
  svg.appendChild(group);

  function wireWedge(path, id, name) {
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');
    path.setAttribute('aria-pressed', isSelected(id) ? 'true' : 'false');
    path.setAttribute('aria-label', name);
    path.setAttribute('data-wedge-id', id);
    path.setAttribute('data-wedge-name', name);
    path.addEventListener('click', () => onLeafToggle(id, name));
    path.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        onLeafToggle(id, name);
      }
    });
    path.addEventListener('mouseenter', () => onLeafFocus(name));
    path.addEventListener('mouseleave', () => onLeafFocus(null));
    path.addEventListener('focus', () => onLeafFocus(name));
    path.addEventListener('blur', () => onLeafFocus(null));
  }

  // Core ring
  layout.cores.forEach((core) => {
    const [s, e] = withGap(core.start, core.end, WEDGE_GAP_DEG * 1.5);
    const selected = isSelected(core.id);
    const path = svgEl('path', {
      d: arcPath(RADIUS.hole, RADIUS.coreOuter, s, e),
      class: `wedge wedge-core core-${core.coreIndex}${selected ? ' is-selected' : ''}`,
    });
    wireWedge(path, core.id, core.name);
    group.appendChild(path);

    const mid = (core.start + core.end) / 2;
    const labelR = (RADIUS.hole + RADIUS.coreOuter) / 2;
    const pos = polarToCartesian(labelR, mid);
    const rotation = mid <= 180 ? mid - 90 : mid + 90;
    const label = svgEl('text', {
      x: pos.x.toFixed(2),
      y: pos.y.toFixed(2),
      class: 'wedge-label wedge-label-core',
      transform: `rotate(${rotation.toFixed(1)}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`,
    });
    label.textContent = core.name;
    group.appendChild(label);
  });

  // Middle ring
  layout.middles.forEach((middle) => {
    const [s, e] = withGap(middle.start, middle.end, WEDGE_GAP_DEG);
    const selected = isSelected(middle.id);
    const path = svgEl('path', {
      d: arcPath(RADIUS.coreOuter, RADIUS.middleOuter, s, e),
      class: `wedge wedge-middle core-${middle.coreIndex}${selected ? ' is-selected' : ''}`,
    });
    wireWedge(path, middle.id, middle.name);
    group.appendChild(path);

    const mid = (middle.start + middle.end) / 2;
    const labelR = (RADIUS.coreOuter + RADIUS.middleOuter) / 2;
    const pos = polarToCartesian(labelR, mid);
    const rotation = mid <= 180 ? mid - 90 : mid + 90;
    const label = svgEl('text', {
      x: pos.x.toFixed(2),
      y: pos.y.toFixed(2),
      class: 'wedge-label wedge-label-middle',
      transform: `rotate(${rotation.toFixed(1)}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`,
    });
    label.textContent = middle.name;
    group.appendChild(label);
  });

  // Leaf ring — the only interactive tier
  layout.leaves.forEach((leaf) => {
    const [s, e] = withGap(leaf.start, leaf.end, WEDGE_GAP_DEG);
    const selected = isSelected(leaf.id);
    const path = svgEl('path', {
      d: arcPath(RADIUS.middleOuter, RADIUS.leafOuter, s, e),
      class: `wedge wedge-leaf core-${leaf.coreIndex}${selected ? ' is-selected' : ''}`,
    });

    wireWedge(path, leaf.id, leaf.name);
    group.appendChild(path);

    const mid = (leaf.start + leaf.end) / 2;
    const labelR = (RADIUS.middleOuter + RADIUS.leafOuter) / 2;
    const pos = polarToCartesian(labelR, mid);
    const rotation = mid <= 180 ? mid - 90 : mid + 90;
    const label = svgEl('text', {
      x: pos.x.toFixed(2),
      y: pos.y.toFixed(2),
      class: 'wedge-label wedge-label-leaf',
      transform: `rotate(${rotation.toFixed(1)}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`,
    });
    label.textContent = leaf.name;
    group.appendChild(label);
  });
}

/** Lightweight update after a selection changes — avoids a full re-render. */
function updateWheelSelectionStyles(svg, isSelected) {
  svg.querySelectorAll('.wedge-core, .wedge-middle, .wedge-leaf').forEach((el) => {
    const id = el.getAttribute('data-wedge-id');
    const selected = isSelected(id);
    el.classList.toggle('is-selected', selected);
    el.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

window.OAEWheel = { computeLayout, renderWheel, updateWheelSelectionStyles };
