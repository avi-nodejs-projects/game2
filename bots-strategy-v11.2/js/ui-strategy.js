// Bots Strategy v9 - Strategy Tab UI (Simple, Advanced, Expert modes)

// ============ SIMPLE MODE UI ============
const expandedBehaviors = {};

function randomizeBehaviorWeights() {
  // Randomize enabled/disabled and weights for all behaviors
  Object.keys(BEHAVIORS).forEach(key => {
    // 50% chance to enable each behavior
    behaviorWeights[key].enabled = Math.random() > 0.5;
    // Random weight between 10 and 100
    behaviorWeights[key].weight = Math.floor(Math.random() * 91) + 10;
  });

  // Ensure at least one behavior is enabled
  const enabledCount = Object.values(behaviorWeights).filter(b => b.enabled).length;
  if (enabledCount === 0) {
    // Enable a random behavior
    const keys = Object.keys(BEHAVIORS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    behaviorWeights[randomKey].enabled = true;
  }

  renderBehaviorList();
}

function renderBehaviorList() {
  const container = document.getElementById('behavior-list');
  container.innerHTML = '';

  Object.entries(BEHAVIORS).forEach(([key, behavior]) => {
    const state = behaviorWeights[key];
    const isExpanded = expandedBehaviors[key];
    const hasParams = behavior.params && Object.keys(behavior.params).length > 0;
    const item = document.createElement('div');
    item.className = 'behavior-item' + (state.enabled ? ' active' : '');

    let paramsHtml = '';
    if (hasParams) {
      paramsHtml = `<div class="behavior-settings ${isExpanded ? 'expanded' : ''}" data-behavior="${key}">`;
      Object.entries(behavior.params).forEach(([pkey, pdef]) => {
        const currentValue = state.params[pkey] !== undefined ? state.params[pkey] : pdef.value;
        let inputHtml = '';
        if (pdef.type === 'number') {
          inputHtml = `<input type="number" data-behavior="${key}" data-param="${pkey}"
                       value="${currentValue}" min="${pdef.min}" max="${pdef.max}">`;
        } else if (pdef.type === 'checkbox') {
          inputHtml = `<input type="checkbox" data-behavior="${key}" data-param="${pkey}"
                       ${currentValue ? 'checked' : ''}>`;
        } else if (pdef.type === 'select') {
          inputHtml = `<select data-behavior="${key}" data-param="${pkey}">
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
        <label class="toggle-switch" onclick="event.stopPropagation()">
          <input type="checkbox" class="behavior-toggle" data-behavior="${key}" ${state.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <div class="behavior-info">
          <div class="behavior-name">${behavior.name}</div>
          <div class="behavior-desc">${behavior.desc}</div>
        </div>
        <div class="behavior-weight">
          <input type="range" min="0" max="100" value="${state.weight}"
                 data-behavior="${key}" ${!state.enabled ? 'disabled' : ''}>
          <span class="weight-value">${state.weight}%</span>
        </div>
        ${hasParams ? `<button class="behavior-expand-btn" data-behavior="${key}">${isExpanded ? '▼ Settings' : '▶ Settings'}</button>` : ''}
      </div>
      ${paramsHtml}
    `;
    container.appendChild(item);
  });

  // Event listeners
  container.querySelectorAll('.behavior-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      behaviorWeights[key].enabled = e.target.checked;
      renderBehaviorList();
    });
  });

  container.querySelectorAll('.behavior-header input[type="range"]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = e.target.dataset.behavior;
      behaviorWeights[key].weight = parseInt(e.target.value);
      e.target.parentElement.querySelector('.weight-value').textContent = e.target.value + '%';
    });
  });

  container.querySelectorAll('.behavior-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = e.target.dataset.behavior;
      expandedBehaviors[key] = !expandedBehaviors[key];
      renderBehaviorList();
    });
  });

  container.querySelectorAll('.behavior-settings input[type="number"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      behaviorWeights[key].params[param] = parseFloat(e.target.value);
    });
  });

  container.querySelectorAll('.behavior-settings input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      behaviorWeights[key].params[param] = e.target.checked;
    });
  });

  container.querySelectorAll('.behavior-settings select').forEach(select => {
    select.addEventListener('change', (e) => {
      const key = e.target.dataset.behavior;
      const param = e.target.dataset.param;
      behaviorWeights[key].params[param] = e.target.value;
    });
  });
}

// ============ ADVANCED MODE UI ============
function renderRuleList() {
  const container = document.getElementById('rule-list');
  container.innerHTML = '';

  rules.forEach((rule, index) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.draggable = true;
    item.dataset.index = index;

    let conditionsHtml = '';
    if (rule.conditions.length === 0) {
      conditionsHtml = '<span style="color:#888;font-size:12px;">DEFAULT (always matches)</span>';
    } else {
      rule.conditions.forEach((cond, ci) => {
        if (ci > 0) conditionsHtml += '<span class="condition-and">AND</span>';
        conditionsHtml += `
          <div class="condition-block">
            <select class="cond-subject" data-rule="${index}" data-cond="${ci}">
              ${Object.entries(SUBJECTS).map(([k, v]) =>
                `<option value="${k}" ${cond.subject === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
            <select class="cond-operator" data-rule="${index}" data-cond="${ci}">
              ${OPERATORS.map(op =>
                `<option value="${op}" ${cond.operator === op ? 'selected' : ''}>${op}</option>`
              ).join('')}
            </select>
            <input type="number" class="cond-value" data-rule="${index}" data-cond="${ci}"
                   value="${cond.value}" step="0.1">
            <button class="rule-btn delete" data-rule="${index}" data-cond="${ci}"
                    style="padding:2px 6px;font-size:10px;">x</button>
          </div>
        `;
      });
    }

    item.innerHTML = `
      <div class="rule-drag">☰</div>
      <div class="rule-content">
        <div class="rule-conditions">
          <span style="color:#4a7c3f;font-size:12px;margin-right:5px;">IF</span>
          ${conditionsHtml}
          <button class="rule-btn add-condition" data-rule="${index}">+</button>
        </div>
        <div class="preset-buttons" style="margin:5px 0;">
          ${CONDITION_PRESETS.map((p, pi) =>
            `<button class="preset-btn preset-condition-btn" data-rule="${index}" data-preset="${pi}">${p.name}</button>`
          ).join('')}
        </div>
        <div class="rule-action">
          <span style="color:#4a7c3f;">THEN →</span>
          <select class="action-select" data-rule="${index}">
            ${Object.entries(ACTIONS).map(([k, v]) =>
              `<option value="${k}" ${rule.action === k ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="rule-controls">
        <button class="rule-btn delete" data-rule="${index}">Delete</button>
      </div>
      <span class="match-indicator">✓ Would fire</span>
    `;

    container.appendChild(item);
  });

  // Event listeners
  container.querySelectorAll('.cond-subject, .cond-operator').forEach(select => {
    select.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = parseInt(e.target.dataset.cond);
      if (e.target.classList.contains('cond-subject')) {
        rules[ri].conditions[ci].subject = e.target.value;
      } else {
        rules[ri].conditions[ci].operator = e.target.value;
      }
    });
  });

  container.querySelectorAll('.cond-value').forEach(input => {
    input.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = parseInt(e.target.dataset.cond);
      rules[ri].conditions[ci].value = parseFloat(e.target.value);
    });
  });

  container.querySelectorAll('.action-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      rules[ri].action = e.target.value;
    });
  });

  container.querySelectorAll('.add-condition').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      rules[ri].conditions.push({ subject: 'my.lives', operator: '>', value: 0 });
      renderRuleList();
    });
  });

  container.querySelectorAll('.preset-condition-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const presetIdx = parseInt(e.target.dataset.preset);
      const preset = CONDITION_PRESETS[presetIdx];
      if (preset) {
        rules[ri].conditions.push({ ...preset.condition });
        renderRuleList();
      }
    });
  });

  container.querySelectorAll('.rule-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = e.target.dataset.cond;
      if (ci !== undefined) {
        rules[ri].conditions.splice(parseInt(ci), 1);
      } else {
        rules.splice(ri, 1);
      }
      renderRuleList();
    });
  });

  // Drag and drop
  let draggedIndex = null;
  container.querySelectorAll('.rule-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedIndex = parseInt(item.dataset.index);
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.index);
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const [removed] = rules.splice(draggedIndex, 1);
        rules.splice(targetIndex, 0, removed);
        renderRuleList();
      }
    });
  });
}

function initAdvancedModeUI() {
  document.getElementById('add-rule-btn').addEventListener('click', () => {
    rules.push({
      conditions: [{ subject: 'my.lives', operator: '>', value: 0 }],
      action: 'gather'
    });
    renderRuleList();
  });

  addTestRulesButton();
  addTemplateButtons();
}

function addTestRulesButton() {
  const ruleSection = document.querySelector('#advanced-mode .section');
  if (!ruleSection || document.getElementById('test-rules-btn')) return;

  const testBtn = document.createElement('button');
  testBtn.id = 'test-rules-btn';
  testBtn.className = 'rule-test-btn';
  testBtn.textContent = 'Test Rules (Preview)';

  const addRuleBtn = document.getElementById('add-rule-btn');
  addRuleBtn.parentNode.insertBefore(testBtn, addRuleBtn.nextSibling);

  testBtn.addEventListener('click', testRules);
}

function testRules() {
  if (!playerBot) {
    alert('Start the game first to test rules with actual context.');
    return;
  }

  const context = playerBot.getContext();
  const ruleItems = document.querySelectorAll('.rule-item');

  ruleItems.forEach(item => item.classList.remove('would-fire'));

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    let allMatch = true;

    for (const condition of rule.conditions) {
      const value = context[condition.subject];
      if (value === undefined) {
        allMatch = false;
        break;
      }

      let match = false;
      switch (condition.operator) {
        case '<': match = value < condition.value; break;
        case '<=': match = value <= condition.value; break;
        case '>': match = value > condition.value; break;
        case '>=': match = value >= condition.value; break;
        case '=': match = value === condition.value; break;
        case '!=': match = value !== condition.value; break;
      }

      if (!match) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      if (ruleItems[i]) {
        ruleItems[i].classList.add('would-fire');
      }
      break;
    }
  }
}

function loadTemplate(templateKey) {
  const template = RULE_TEMPLATES[templateKey];
  if (!template) return;

  rules.length = 0;
  template.rules.forEach(r => {
    rules.push(JSON.parse(JSON.stringify(r)));
  });
  renderRuleList();
}

function addTemplateButtons() {
  const ruleSection = document.querySelector('#advanced-mode .section');
  if (!ruleSection) return;

  const templateDiv = document.createElement('div');
  templateDiv.className = 'template-section';
  templateDiv.innerHTML = `
    <div style="font-size:12px;color:#888;margin-bottom:8px;">Load Template:</div>
    <div class="template-buttons">
      ${Object.entries(RULE_TEMPLATES).map(([key, tmpl]) =>
        `<button class="template-btn" data-template="${key}">${tmpl.name}</button>`
      ).join('')}
    </div>
  `;

  const ruleList = document.getElementById('rule-list');
  ruleSection.insertBefore(templateDiv, ruleList);

  templateDiv.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Load "${RULE_TEMPLATES[btn.dataset.template].name}" template? This will replace current rules.`)) {
        loadTemplate(btn.dataset.template);
      }
    });
  });
}

// ============ EXPERT MODE UI (STATE MACHINE) ============
let stateCanvas, stateCtx;
let mouseX = 0, mouseY = 0;
let draggingState = null;
let dragOffset = { x: 0, y: 0 };

function initStateMachineUI() {
  stateCanvas = document.getElementById('state-canvas');
  stateCtx = stateCanvas.getContext('2d');

  stateCanvas.addEventListener('mousemove', (e) => {
    const rect = stateCanvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (transitionStart) {
      renderStateMachine();
    }
  });

  stateCanvas.addEventListener('click', handleStateCanvasClick);
  stateCanvas.addEventListener('mousedown', handleStateCanvasMouseDown);
  stateCanvas.addEventListener('mousemove', handleStateCanvasMouseMove);
  stateCanvas.addEventListener('mouseup', () => { draggingState = null; });
  stateCanvas.addEventListener('mouseleave', () => { draggingState = null; });

  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedTool = item.dataset.tool;
      transitionStart = null;
      renderStateMachine();
    });
  });

  document.getElementById('state-name-input').addEventListener('input', (e) => {
    if (!selectedState) return;
    const state = states.find(s => s.id === selectedState);
    if (state) {
      state.name = e.target.value;
      document.getElementById('edit-state-name').textContent = e.target.value;
      renderStateMachine();
    }
  });

  document.getElementById('state-behavior-select').addEventListener('change', (e) => {
    if (!selectedState) return;
    const state = states.find(s => s.id === selectedState);
    if (state) {
      state.behavior = e.target.value;
    }
  });

  document.getElementById('state-entry-action').addEventListener('change', (e) => {
    if (!selectedState) return;
    const state = states.find(s => s.id === selectedState);
    if (state) {
      state.entryAction = e.target.value;
    }
  });

  document.getElementById('state-exit-action').addEventListener('change', (e) => {
    if (!selectedState) return;
    const state = states.find(s => s.id === selectedState);
    if (state) {
      state.exitAction = e.target.value;
    }
  });
}

function handleStateCanvasClick(e) {
  const rect = stateCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedState = states.find(s => {
    const dx = s.x - x;
    const dy = s.y - y;
    return Math.sqrt(dx * dx + dy * dy) < 50;
  });

  switch (selectedTool) {
    case 'select':
      selectedState = clickedState ? clickedState.id : null;
      updateStateEditor();
      break;

    case 'add-state':
      if (!clickedState) {
        const id = 'state_' + Date.now();
        states.push({
          id,
          name: 'New State',
          x,
          y,
          behavior: 'gather'
        });
      }
      break;

    case 'add-transition':
      if (clickedState) {
        if (!transitionStart) {
          transitionStart = clickedState.id;
        } else if (transitionStart !== clickedState.id) {
          const exists = transitions.some(t => t.from === transitionStart && t.to === clickedState.id);
          if (!exists) {
            transitions.push({
              from: transitionStart,
              to: clickedState.id,
              condition: { subject: 'my.lives', operator: '<=', value: 2 },
              priority: 1
            });
          }
          transitionStart = null;
        }
      } else {
        transitionStart = null;
      }
      break;

    case 'delete':
      if (clickedState) {
        states = states.filter(s => s.id !== clickedState.id);
        transitions = transitions.filter(t => t.from !== clickedState.id && t.to !== clickedState.id);
        if (selectedState === clickedState.id) {
          selectedState = null;
          updateStateEditor();
        }
      }
      break;
  }

  renderStateMachine();
}

function handleStateCanvasMouseDown(e) {
  if (selectedTool !== 'select') return;

  const rect = stateCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedState = states.find(s => {
    const dx = s.x - x;
    const dy = s.y - y;
    return Math.sqrt(dx * dx + dy * dy) < 50;
  });

  if (clickedState) {
    draggingState = clickedState;
    dragOffset = { x: clickedState.x - x, y: clickedState.y - y };
  }
}

function handleStateCanvasMouseMove(e) {
  if (!draggingState) return;

  const rect = stateCanvas.getBoundingClientRect();
  draggingState.x = e.clientX - rect.left + dragOffset.x;
  draggingState.y = e.clientY - rect.top + dragOffset.y;

  draggingState.x = Math.max(60, Math.min(stateCanvas.width - 60, draggingState.x));
  draggingState.y = Math.max(40, Math.min(stateCanvas.height - 40, draggingState.y));

  renderStateMachine();
}

function renderStateMachine() {
  stateCtx.clearRect(0, 0, stateCanvas.width, stateCanvas.height);

  // Draw grid
  stateCtx.strokeStyle = 'rgba(255,255,255,0.05)';
  stateCtx.lineWidth = 1;
  for (let x = 0; x < stateCanvas.width; x += 50) {
    stateCtx.beginPath();
    stateCtx.moveTo(x, 0);
    stateCtx.lineTo(x, stateCanvas.height);
    stateCtx.stroke();
  }
  for (let y = 0; y < stateCanvas.height; y += 50) {
    stateCtx.beginPath();
    stateCtx.moveTo(0, y);
    stateCtx.lineTo(stateCanvas.width, y);
    stateCtx.stroke();
  }

  // Draw transitions
  transitions.forEach(trans => {
    const fromState = states.find(s => s.id === trans.from);
    const toState = states.find(s => s.id === trans.to);
    if (!fromState || !toState) return;

    const dx = toState.x - fromState.x;
    const dy = toState.y - fromState.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const startX = fromState.x + nx * 50;
    const startY = fromState.y + ny * 35;
    const endX = toState.x - nx * 50;
    const endY = toState.y - ny * 35;

    stateCtx.strokeStyle = '#4a7c3f';
    stateCtx.lineWidth = 2;
    stateCtx.beginPath();
    stateCtx.moveTo(startX, startY);
    stateCtx.lineTo(endX, endY);
    stateCtx.stroke();

    const arrowSize = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    stateCtx.fillStyle = '#4a7c3f';
    stateCtx.beginPath();
    stateCtx.moveTo(endX, endY);
    stateCtx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
    stateCtx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
    stateCtx.closePath();
    stateCtx.fill();

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const label = `${SUBJECTS[trans.condition.subject] || trans.condition.subject} ${trans.condition.operator} ${trans.condition.value}`;
    stateCtx.fillStyle = 'rgba(0,0,0,0.7)';
    stateCtx.fillRect(midX - 60, midY - 10, 120, 20);
    stateCtx.fillStyle = '#fff';
    stateCtx.font = '10px Arial';
    stateCtx.textAlign = 'center';
    stateCtx.fillText(label.substring(0, 20), midX, midY + 4);
  });

  // Draw states
  states.forEach(state => {
    const isSelected = selectedState === state.id;
    const isCurrent = currentStateId === state.id;

    stateCtx.fillStyle = 'rgba(0,0,0,0.3)';
    stateCtx.beginPath();
    stateCtx.ellipse(state.x + 3, state.y + 3, 50, 35, 0, 0, Math.PI * 2);
    stateCtx.fill();

    stateCtx.fillStyle = isSelected ? '#5a9c4f' : (isCurrent ? '#4a7c3f' : 'rgba(74, 124, 63, 0.5)');
    stateCtx.strokeStyle = isSelected ? '#fff' : '#4a7c3f';
    stateCtx.lineWidth = isSelected ? 3 : 2;
    stateCtx.beginPath();
    stateCtx.ellipse(state.x, state.y, 50, 35, 0, 0, Math.PI * 2);
    stateCtx.fill();
    stateCtx.stroke();

    stateCtx.fillStyle = '#fff';
    stateCtx.font = 'bold 14px Arial';
    stateCtx.textAlign = 'center';
    stateCtx.fillText(state.name, state.x, state.y + 5);
  });

  // Draw transition in progress
  if (transitionStart && selectedTool === 'add-transition') {
    const fromState = states.find(s => s.id === transitionStart);
    if (fromState) {
      stateCtx.strokeStyle = 'rgba(255,255,255,0.5)';
      stateCtx.lineWidth = 2;
      stateCtx.setLineDash([5, 5]);
      stateCtx.beginPath();
      stateCtx.moveTo(fromState.x, fromState.y);
      stateCtx.lineTo(mouseX, mouseY);
      stateCtx.stroke();
      stateCtx.setLineDash([]);
    }
  }
}

function updateStateEditor() {
  const panel = document.getElementById('state-editor');
  if (!selectedState) {
    panel.classList.remove('visible');
    return;
  }

  const state = states.find(s => s.id === selectedState);
  if (!state) return;

  panel.classList.add('visible');
  document.getElementById('edit-state-name').textContent = state.name;
  document.getElementById('state-name-input').value = state.name;
  document.getElementById('state-behavior-select').value = state.behavior;
  document.getElementById('state-entry-action').value = state.entryAction || 'none';
  document.getElementById('state-exit-action').value = state.exitAction || 'none';

  const transList = document.getElementById('transition-list');
  const stateTransitions = transitions.filter(t => t.from === selectedState);

  let html = '<strong>Transitions out:</strong>';
  if (stateTransitions.length === 0) {
    html += '<p style="color:#888;font-size:12px;">No transitions</p>';
  } else {
    stateTransitions.forEach((trans, i) => {
      const toState = states.find(s => s.id === trans.to);
      html += `
        <div class="transition-item">
          → ${toState ? toState.name : trans.to}<br>
          <small>When: ${SUBJECTS[trans.condition.subject]} ${trans.condition.operator} ${trans.condition.value}</small>
          <div class="transition-priority">
            <label>Priority:</label>
            <input type="number" value="${trans.priority || 1}" min="1" max="10"
                   data-transition="${i}" class="trans-priority-input">
          </div>
        </div>
      `;
    });
  }
  transList.innerHTML = html;

  transList.querySelectorAll('.trans-priority-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.transition);
      const matchingTransitions = stateTransitions;
      if (matchingTransitions[idx]) {
        const globalIdx = transitions.indexOf(matchingTransitions[idx]);
        if (globalIdx >= 0) {
          transitions[globalIdx].priority = parseInt(e.target.value);
        }
      }
    });
  });
}
