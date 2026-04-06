// Bots Strategy v11 - Event Notification System

const MAX_VISIBLE_NOTIFICATIONS = 5;

function showEventNotification(type, message) {
  const feed = document.getElementById('event-feed');
  if (!feed) return;

  // Cap visible notifications
  while (feed.children.length >= MAX_VISIBLE_NOTIFICATIONS) {
    feed.removeChild(feed.lastChild);
  }

  const el = document.createElement('div');
  el.className = `event-notification event-${type}`;
  el.textContent = message;
  feed.prepend(el);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  // Remove after 3.5 seconds
  setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 400);
  }, 3500);
}
