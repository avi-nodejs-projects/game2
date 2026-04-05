// Bots Strategy v10 - Simple Mode UI (Behavior List)

const expandedBehaviors = {};
const p2ExpandedBehaviors = {};

function randomizeBehaviorWeights(playerIndex = 0) {
  const weights = playerIndex === 0 ? behaviorWeights : playerConfigs[playerIndex].behaviorWeights;

  // Randomize enabled/disabled and weights for all behaviors
  Object.keys(BEHAVIORS).forEach(key => {
    // 50% chance to enable each behavior
    weights[key].enabled = Math.random() > 0.5;
    // Random weight between 10 and 100
    weights[key].weight = Math.floor(Math.random() * 91) + 10;
  });

  // Ensure at least one behavior is enabled
  const enabledCount = Object.values(weights).filter(b => b.enabled).length;
  if (enabledCount === 0) {
    // Enable a random behavior
    const keys = Object.keys(BEHAVIORS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    weights[randomKey].enabled = true;
  }

  renderBehaviorList(playerIndex);
}

function renderBehaviorList(playerIndex = 0) {
  const containerId = playerIndex === 0 ? 'behavior-list' : 'p2-behavior-list';
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const weights = playerIndex === 0 ? behaviorWeights : playerConfigs[playerIndex].behaviorWeights;
  const expanded = playerIndex === 0 ? expandedBehaviors : p2ExpandedBehaviors;

  Object.entries(BEHAVIORS).forEach(([key, behavior]) => {
    const state = weights[key];
    if (!state) return;
    const isExpanded = expanded[key];
    const hasParams = behavior.params && Object.keys(behavior.params).length > 0;
    const item = document.createElement('div');
    item.className = 'behavior-item' + (state.enabled ? ' active' : '');

    let paramsHtml = '';
    if (hasParams) {
      paramsHtml = `<div class="behavior-settings ${isExpanded ? 'expanded' : ''}" data-behavior="${key}">`;
      Object.entries(behavior.params).forEach(([pkey, pdef]) => {
        const currentValue = state.params && state.params[pkey] !== undefined ? state.params[pkey] : pdef.value;
        let inputHtml = '';
        if (pdef.type === 'number') {
          inputHtml = `<input type="number" data-behavior="${key}" data-param="${pkey}" data-player="${playerIndex}"
                       value="${currentValue}" min="${pdef.min}" max="${pdef.max}">`;
        } else if (pdef.type === 'checkbox') {
          inputHtml = `<input type="checkbox" data-behavior="${key}" data-param="${pkey}" data-player="${playerIndex}"
                       ${currentValue ? 'checked' : ''}>`;
        } else if (pdef.type === 'select') {
          inputHtml = `<select data-behavior="${key}" data-param="${pkey}" data-player="${playerIndex}">
            ${pdef.options.map(opt => `<option value="${opt}" ${currentValue === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>`;
        }
        paramsHtml += `
          <div class="behavior-setting-row">
            <label>${pdef.label}</label>
            ${inputHtml}
          </div>`;
      });
      paramsHtml += '</div>';
    }

    item.innerHTML = `
      <div class="behavior-header">
        <input type="checkbox" class="behavior-toggle" data-behavior="${key}" data-player="${playerIndex}" ${state.enabled ? 'checked' : ''}>
        <div class="behavior-info">
          <div class="behavior-name">${behavior.name}</div>
          <div class="behavior-desc">${behavior.desc}</div>
        </div>
        <div class="behavior-weight">
          <input type="range" min="0" max="100" value="${state.weight}"
                 data-behavior="${key}" data-player="${playerIndex}" ${!state.enabled ? 'disabled' : ''}>
          <span class="weight-value">${state.weight}%</span>
        </div>
        ${hasParams ? `<button class="behavior-expand-btn" data-behavior="${key}" data-player="${playerIndex}">${isExpanded ? '▼ Settings' : '▶ Settings'}</button>` : ''}
      </div>
      ${paramsHtml}
    `;
    container.appendChild(item);
  });

  // Event listeners
  container.querySelectorAll('.behavior-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const w = pIdx === 0 ? behaviorWeights : playerConfigs[pIdx].behaviorWeights;
      w[key].enabled = e.target.checked;
      renderBehaviorList(pIdx);
    });
  });

  container.querySelectorAll('.behavior-header input[type="range"]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = e.target.dataset.behavior;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const w = pIdx === 0 ? behaviorWeights : playerConfigs[pIdx].behaviorWeights;
      w[key].weight = parseInt(e.target.value);
      e.target.parentElement.querySelector('.weight-value').textContent = e.target.value + '%';
    });
  });

  container.querySelectorAll('.behavior-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = e.target.dataset.behavior;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const exp = pIdx === 0 ? expandedBehaviors : p2ExpandedBehaviors;
      exp[key] = !exp[key];
      renderBehaviorList(pIdx);
    });
  });

  container.querySelectorAll('.behavior-settings input[type="number"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const w = pIdx === 0 ? behaviorWeights : playerConfigs[pIdx].behaviorWeights;
      w[key].params[param] = parseFloat(e.target.value);
    });
  });

  container.querySelectorAll('.behavior-settings input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const w = pIdx === 0 ? behaviorWeights : playerConfigs[pIdx].behaviorWeights;
      w[key].params[param] = e.target.checked;
    });
  });

  container.querySelectorAll('.behavior-settings select').forEach(select => {
    select.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      const pIdx = parseInt(e.target.dataset.player) || 0;
      const w = pIdx === 0 ? behaviorWeights : playerConfigs[pIdx].behaviorWeights;
      w[key].params[param] = e.target.value;
    });
  });
}
