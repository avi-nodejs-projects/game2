// Bots Strategy v10 - Camera and Viewport Management

// ============ CAMERA STATE ============
const camera = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  followBot: null,
  followIndex: 0,
  smoothing: 0.08,
  offsetY: -100,
  autoFollow: true
};

// Second camera for two-player mode
const camera2 = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  followBot: null,
  followIndex: 0,
  smoothing: 0.08,
  offsetY: -100,
  autoFollow: true
};

// Current active camera for drawing operations
let activeCamera = camera;

// Viewport state for split-screen rendering
let currentViewport = { x: 0, y: 0, width: 0, height: 0 };

// ============ COORDINATE HELPERS ============
function worldToScreen(worldX, worldY) {
  const cam = activeCamera;
  return {
    x: worldX - cam.x + currentViewport.width / 2 + currentViewport.x,
    y: worldY - cam.y + currentViewport.height / 2 + currentViewport.y
  };
}

function isVisible(worldX, worldY, margin = 100) {
  const screen = worldToScreen(worldX, worldY);
  return screen.x > currentViewport.x - margin &&
         screen.x < currentViewport.x + currentViewport.width + margin &&
         screen.y > currentViewport.y - margin &&
         screen.y < currentViewport.y + currentViewport.height + margin;
}

function getScale(worldY) {
  const cam = activeCamera;
  const distFromCamera = worldY - cam.y;
  const scale = 1 + (distFromCamera / WORLD_HEIGHT) * 0.3;
  return Math.max(0.5, Math.min(1.5, scale));
}

// ============ VIEWPORT MANAGEMENT ============

// Set full canvas as viewport (single-player mode)
function setFullViewport() {
  currentViewport = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  activeCamera = camera;
}

// Set left viewport (Player 1 in two-player mode)
function setLeftViewport() {
  currentViewport = { x: 0, y: 0, width: canvas.width / 2 - 2, height: canvas.height };
  activeCamera = camera;
}

// Set right viewport (Player 2 in two-player mode)
function setRightViewport() {
  currentViewport = { x: canvas.width / 2 + 2, y: 0, width: canvas.width / 2 - 2, height: canvas.height };
  activeCamera = camera2;
}

// ============ CAMERA UPDATES ============
function updateCamera() {
  if (camera.followBot && camera.autoFollow) {
    const targetX = camera.followBot.x;
    const targetY = camera.followBot.y + camera.offsetY;

    camera.x += (targetX - camera.x) * camera.smoothing;
    camera.y += (targetY - camera.y) * camera.smoothing;
  }
}

function updateCamera2() {
  if (camera2.followBot && camera2.autoFollow) {
    const targetX = camera2.followBot.x;
    const targetY = camera2.followBot.y + camera2.offsetY;

    camera2.x += (targetX - camera2.x) * camera2.smoothing;
    camera2.y += (targetY - camera2.y) * camera2.smoothing;
  }
}

// ============ CAMERA RESET ============
function resetCameras() {
  camera.x = WORLD_WIDTH / 2;
  camera.y = WORLD_HEIGHT / 2;
  camera.followBot = null;
  camera.followIndex = 0;
  camera.autoFollow = true;

  camera2.x = WORLD_WIDTH / 2;
  camera2.y = WORLD_HEIGHT / 2;
  camera2.followBot = null;
  camera2.followIndex = 0;
  camera2.autoFollow = true;
}
