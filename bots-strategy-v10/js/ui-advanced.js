// Bots Strategy v10 - Advanced Mode UI (Rule List)

function renderRuleList(playerIndex = 0) {
  const containerId = playerIndex === 0 ? 'rule-list' : 'p2-rule-list';
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const ruleList = playerIndex === 0 ? rules : playerConfigs[playerIndex].rules;
  if (!ruleList) return;

  ruleList.forEach((rule, index) => {
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

  // Event listeners (use closure to capture playerIndex)
  const pIdx = playerIndex;

  container.querySelectorAll('.cond-subject, .cond-operator').forEach(select => {
    select.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = parseInt(e.target.dataset.cond);
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      if (e.target.classList.contains('cond-subject')) {
        rl[ri].conditions[ci].subject = e.target.value;
      } else {
        rl[ri].conditions[ci].operator = e.target.value;
      }
    });
  });

  container.querySelectorAll('.cond-value').forEach(input => {
    input.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = parseInt(e.target.dataset.cond);
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      rl[ri].conditions[ci].value = parseFloat(e.target.value);
    });
  });

  container.querySelectorAll('.action-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      rl[ri].action = e.target.value;
    });
  });

  container.querySelectorAll('.add-condition').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      rl[ri].conditions.push({ subject: 'my.lives', operator: '>', value: 0 });
      renderRuleList(pIdx);
    });
  });

  container.querySelectorAll('.preset-condition-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const presetIdx = parseInt(e.target.dataset.preset);
      const preset = CONDITION_PRESETS[presetIdx];
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      if (preset) {
        rl[ri].conditions.push({ ...preset.condition });
        renderRuleList(pIdx);
      }
    });
  });

  container.querySelectorAll('.rule-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ri = parseInt(e.target.dataset.rule);
      const ci = e.target.dataset.cond;
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      if (ci !== undefined) {
        rl[ri].conditions.splice(parseInt(ci), 1);
      } else {
        rl.splice(ri, 1);
      }
      renderRuleList(pIdx);
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
      const rl = pIdx === 0 ? rules : playerConfigs[pIdx].rules;
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const [removed] = rl.splice(draggedIndex, 1);
        rl.splice(targetIndex, 0, removed);
        renderRuleList(pIdx);
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
    renderRuleList(0);
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
        case '=': match = value == condition.value; break;  // Use == for type coercion (matches game.js)
        case '!=': match = value != condition.value; break; // Use != for type coercion (matches game.js)
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

function loadTemplate(templateKey, playerIndex = 0) {
  const template = RULE_TEMPLATES[templateKey];
  if (!template) return;

  const ruleList = playerIndex === 0 ? rules : playerConfigs[playerIndex].rules;
  ruleList.length = 0;
  template.rules.forEach(r => {
    ruleList.push(JSON.parse(JSON.stringify(r)));
  });
  renderRuleList(playerIndex);
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
