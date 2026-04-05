// Bots Strategy v10 - Relationship System
// Handles: Parent/child tracking, Protection system, Generational tracking

// ============ RELATIONSHIP TRACKING ============

function setParent(child, parent) {
  if (!child.relationships) initBotLifecycleProperties(child);
  if (!parent.relationships) initBotLifecycleProperties(parent);

  child.relationships.parentId = parent.index;
  child.generation = parent.generation + 1;

  // Track if child is from player lineage
  if (parent.isPlayer) {
    child.isPlayerOffspring = true;
    child.playerLineage = 1;
  } else if (parent.isPlayerOffspring) {
    child.isPlayerOffspring = true;
    child.playerLineage = parent.playerLineage + 1;
  }

  // Add child to parent's child list
  if (!parent.relationships.childIds.includes(child.index)) {
    parent.relationships.childIds.push(child.index);
  }

  parent.offspringCount = (parent.offspringCount || 0) + 1;
}

function getParent(bot) {
  if (!bot.relationships || bot.relationships.parentId === null) return null;
  return bots.find(b => b.index === bot.relationships.parentId);
}

function getChildren(bot) {
  if (!bot.relationships || !bot.relationships.childIds.length) return [];
  return bot.relationships.childIds
    .map(id => bots.find(b => b.index === id))
    .filter(b => b !== undefined);
}

function getGeneration(bot) {
  return bot.generation || 0;
}

function getAllDescendants(bot) {
  const descendants = [];
  const queue = [...getChildren(bot)];

  while (queue.length > 0) {
    const child = queue.shift();
    if (child) {
      descendants.push(child);
      queue.push(...getChildren(child));
    }
  }

  return descendants;
}

function getAllAncestors(bot) {
  const ancestors = [];
  let current = getParent(bot);

  while (current) {
    ancestors.push(current);
    current = getParent(current);
  }

  return ancestors;
}

function areRelated(bot1, bot2, maxGenerations = Infinity) {
  // Check if bot1 is ancestor of bot2
  let current = bot2;
  let generations = 0;
  while (current && generations < maxGenerations) {
    const parent = getParent(current);
    if (parent && parent.index === bot1.index) return true;
    current = parent;
    generations++;
  }

  // Check if bot2 is ancestor of bot1
  current = bot1;
  generations = 0;
  while (current && generations < maxGenerations) {
    const parent = getParent(current);
    if (parent && parent.index === bot2.index) return true;
    current = parent;
    generations++;
  }

  return false;
}

// ============ PROTECTION SYSTEM ============

function addProtection(bot1, bot2, duration) {
  const expiryFrame = frameCount + duration;

  // Add bidirectional protection
  const key1 = `${Math.min(bot1.index, bot2.index)}-${Math.max(bot1.index, bot2.index)}`;
  protectionPairs.set(key1, expiryFrame);

  // Update bot protection arrays
  if (!bot1.relationships) initBotLifecycleProperties(bot1);
  if (!bot2.relationships) initBotLifecycleProperties(bot2);

  bot1.relationships.protectedFrom.push({ botId: bot2.index, expiresAtFrame: expiryFrame });
  bot2.relationships.protectedFrom.push({ botId: bot1.index, expiresAtFrame: expiryFrame });

  if (lifecycleSettings.reproduction.offspring.protection.bidirectional) {
    bot1.relationships.protectedBy.push({ botId: bot2.index, expiresAtFrame: expiryFrame });
    bot2.relationships.protectedBy.push({ botId: bot1.index, expiresAtFrame: expiryFrame });
  }

  logEvent('PROTECTION_STARTED', {
    bot1Index: bot1.index,
    bot2Index: bot2.index,
    duration: duration,
    expiresAtFrame: expiryFrame
  });
}

function isProtected(bot1, bot2) {
  const key = `${Math.min(bot1.index, bot2.index)}-${Math.max(bot1.index, bot2.index)}`;
  const expiry = protectionPairs.get(key);

  if (expiry && frameCount < expiry) {
    return true;
  }

  return false;
}

function updateProtections() {
  // Clean up expired protections
  for (const [key, expiry] of protectionPairs.entries()) {
    if (frameCount >= expiry) {
      protectionPairs.delete(key);

      // Parse bot indices from key
      const [bot1Index, bot2Index] = key.split('-').map(Number);

      // Clean up bot protection arrays
      const bot1 = bots.find(b => b.index === bot1Index);
      const bot2 = bots.find(b => b.index === bot2Index);

      if (bot1 && bot1.relationships) {
        bot1.relationships.protectedFrom = bot1.relationships.protectedFrom.filter(
          p => p.botId !== bot2Index || p.expiresAtFrame > frameCount
        );
        bot1.relationships.protectedBy = bot1.relationships.protectedBy.filter(
          p => p.botId !== bot2Index || p.expiresAtFrame > frameCount
        );
      }

      if (bot2 && bot2.relationships) {
        bot2.relationships.protectedFrom = bot2.relationships.protectedFrom.filter(
          p => p.botId !== bot1Index || p.expiresAtFrame > frameCount
        );
        bot2.relationships.protectedBy = bot2.relationships.protectedBy.filter(
          p => p.botId !== bot1Index || p.expiresAtFrame > frameCount
        );
      }

      logEvent('PROTECTION_ENDED', {
        bot1Index: bot1Index,
        bot2Index: bot2Index
      });
    }
  }
}

function getProtectedBots(bot) {
  if (!bot.relationships) return [];

  const protectedBots = [];

  for (const protection of bot.relationships.protectedFrom) {
    if (protection.expiresAtFrame > frameCount) {
      const protectedBot = bots.find(b => b.index === protection.botId);
      if (protectedBot) {
        protectedBots.push(protectedBot);
      }
    }
  }

  return protectedBots;
}

function clearBotProtections(bot) {
  if (!bot.relationships) return;

  // Remove all protections involving this bot
  for (const [key, _] of protectionPairs.entries()) {
    const indices = key.split('-').map(Number);
    if (indices.includes(bot.index)) {
      protectionPairs.delete(key);
    }
  }

  bot.relationships.protectedFrom = [];
  bot.relationships.protectedBy = [];
}

// ============ GENERATIONAL PROTECTION ============

function shouldProtectByGeneration(bot1, bot2) {
  const cfg = lifecycleSettings.reproduction.offspring.protection;
  if (!cfg.duration || cfg.duration <= 0) return false;

  const maxGenerations = cfg.generations || 1;
  return areRelated(bot1, bot2, maxGenerations);
}

// ============ RELATIONSHIP CLEANUP ============

function clearRelationshipsOnDeath(bot) {
  if (!bot.relationships) return;

  // Clear protections
  clearBotProtections(bot);

  // Remove from parent's child list
  const parent = getParent(bot);
  if (parent && parent.relationships) {
    parent.relationships.childIds = parent.relationships.childIds.filter(
      id => id !== bot.index
    );
  }

  // Note: We don't clear children's parentId - they keep their lineage
  // even if parent dies
}

function resetRelationshipsOnRespawn(bot) {
  if (!bot.relationships) {
    initBotLifecycleProperties(bot);
    return;
  }

  // Clear protections on respawn
  clearBotProtections(bot);

  // Clear mating history on respawn
  bot.relationships.mateHistory = [];
  bot.matingProgress.clear();

  // Keep parent/child relationships for lineage tracking
  // Keep pack ID - pack system handles respawn separately
}
