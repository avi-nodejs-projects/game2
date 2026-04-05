// Bots Strategy v10 - Expert Mode UI (State Machine)

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
              condition: { subject: 'my.lives', operator: '<=', value: 2 }
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
