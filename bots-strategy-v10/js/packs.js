// Bots Strategy v10 - Pack System
// Handles: Pack formation, Territory, Cannibalism

// ============ STRATEGY SIMILARITY ============

function calculateStrategySimilarity(bot1, bot2) {
  // Get behavior weights for both bots
  let weights1, weights2;

  if (bot1.isPlayer) {
    // Use player-specific weights for two-player mode
    const pIdx = bot1.playerIndex !== undefined ? bot1.playerIndex : 0;
    weights1 = (gameMode === 'two-player' && playerConfigs[pIdx])
      ? playerConfigs[pIdx].behaviorWeights
      : behaviorWeights;
  } else if (bot1.npcWeights) {
    weights1 = {};
    Object.keys(BEHAVIORS).forEach(key => {
      weights1[key] = { weight: bot1.npcWeights[key] || 0 };
    });
  } else {
    return 0; // Can't compare without strategy
  }

  if (bot2.isPlayer) {
    // Use player-specific weights for two-player mode
    const pIdx = bot2.playerIndex !== undefined ? bot2.playerIndex : 0;
    weights2 = (gameMode === 'two-player' && playerConfigs[pIdx])
      ? playerConfigs[pIdx].behaviorWeights
      : behaviorWeights;
  } else if (bot2.npcWeights) {
    weights2 = {};
    Object.keys(BEHAVIORS).forEach(key => {
      weights2[key] = { weight: bot2.npcWeights[key] || 0 };
    });
  } else {
    return 0;
  }

  // Cosine similarity
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  Object.keys(BEHAVIORS).forEach(key => {
    const v1 = weights1[key]?.weight || 0;
    const v2 = weights2[key]?.weight || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ============ PACK FORMATION ============

function createPack(members) {
  const packId = nextPackId++;
  const pack = {
    id: packId,
    members: new Set(members.map(b => b.index)),
    founderId: members[0].index,
    leaderId: members[0].index,
    formedAtFrame: frameCount,
    territory: null,
    hue: Math.random() * 360 // Unique color for pack
  };

  packs.set(packId, pack);

  // Update bot pack references
  members.forEach(bot => {
    if (!bot.relationships) initBotLifecycleProperties(bot);
    bot.relationships.packId = packId;
  });

  // Calculate initial leader if leadership enabled
  if (lifecycleSettings.packs.leadership.enabled) {
    pack.leaderId = selectPackLeader(pack);
  }

  logEvent('PACK_FORMED', {
    packId: packId,
    memberIndices: members.map(b => b.index),
    similarity: calculateStrategySimilarity(members[0], members[1] || members[0])
  });

  return pack;
}

function joinPack(bot, pack) {
  const cfg = lifecycleSettings.packs;

  // Check size limit
  if (cfg.size.max > 0 && pack.members.size >= cfg.size.max) {
    if (cfg.size.overflowBehavior === 'reject') {
      return false;
    } else if (cfg.size.overflowBehavior === 'kick') {
      // Kick weakest member
      const weakest = findWeakestPackMember(pack);
      if (weakest) {
        leavePack(weakest, 'kicked');
      }
    }
  }

  pack.members.add(bot.index);
  if (!bot.relationships) initBotLifecycleProperties(bot);
  bot.relationships.packId = pack.id;

  // Recalculate leader
  if (cfg.leadership.enabled) {
    pack.leaderId = selectPackLeader(pack);
  }

  logEvent('PACK_JOINED', {
    packId: pack.id,
    botIndex: bot.index,
    packSize: pack.members.size
  });

  return true;
}

function leavePack(bot, reason) {
  if (!bot.relationships || bot.relationships.packId === null) return;

  const packId = bot.relationships.packId;
  const pack = packs.get(packId);

  if (pack) {
    pack.members.delete(bot.index);

    logEvent('PACK_LEFT', {
      packId: packId,
      botIndex: bot.index,
      reason: reason,
      remainingMembers: pack.members.size
    });

    // Disband if too few members
    if (pack.members.size < 2) {
      disbandPack(pack, 'tooFewMembers');
    } else if (lifecycleSettings.packs.leadership.enabled && pack.leaderId === bot.index) {
      // Select new leader
      pack.leaderId = selectPackLeader(pack);
    }
  }

  bot.relationships.packId = null;
}

function disbandPack(pack, reason) {
  // Remove pack reference from all members
  pack.members.forEach(botIndex => {
    const bot = bots.find(b => b.index === botIndex);
    if (bot && bot.relationships) {
      bot.relationships.packId = null;
    }
  });

  packs.delete(pack.id);

  logEvent('PACK_DISBANDED', {
    packId: pack.id,
    reason: reason
  });
}

function selectPackLeader(pack) {
  const cfg = lifecycleSettings.packs.leadership;
  const members = getPackMembers(pack);

  if (members.length === 0) return null;

  switch (cfg.selection) {
    case 'oldest':
      return members.reduce((oldest, m) => m.age > oldest.age ? m : oldest).index;
    case 'founder':
      return pack.founderId;
    case 'strongest':
    default:
      return members.reduce((strongest, m) => {
        const mStats = m.speed + m.attack + m.defence + m.lives;
        const sStats = strongest.speed + strongest.attack + strongest.defence + strongest.lives;
        return mStats > sStats ? m : strongest;
      }).index;
  }
}

function findWeakestPackMember(pack) {
  const members = getPackMembers(pack);
  if (members.length === 0) return null;

  return members.reduce((weakest, m) => {
    const mStats = m.speed + m.attack + m.defence + m.lives;
    const wStats = weakest.speed + weakest.attack + weakest.defence + weakest.lives;
    return mStats < wStats ? m : weakest;
  });
}

// ============ PACK QUERIES ============

function getPackMembers(pack) {
  if (!pack) return [];
  return Array.from(pack.members)
    .map(index => bots.find(b => b.index === index))
    .filter(b => b !== undefined);
}

function arePackMates(bot1, bot2) {
  if (!bot1.relationships || !bot2.relationships) return false;
  if (bot1.relationships.packId === null || bot2.relationships.packId === null) return false;
  return bot1.relationships.packId === bot2.relationships.packId;
}

function getBotPack(bot) {
  if (!bot.relationships || bot.relationships.packId === null) return null;
  return packs.get(bot.relationships.packId);
}

// ============ PACK FORMATION CHECK ============

function evaluatePackFormation() {
  const cfg = lifecycleSettings.packs;
  if (!cfg.enabled) return;

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const bot1 = bots[i];
      const bot2 = bots[j];

      // Skip if both already in packs (can't merge packs)
      // Note: Must check for both null and undefined since optional chaining returns undefined when relationships is missing
      const bot1PackId = bot1.relationships?.packId;
      const bot2PackId = bot2.relationships?.packId;
      if (bot1PackId != null && bot2PackId != null) {
        continue; // Both already in packs - no action possible
      }

      const dist = Math.sqrt(
        Math.pow(bot1.x - bot2.x, 2) + Math.pow(bot1.y - bot2.y, 2)
      );

      if (dist <= cfg.formation.proximityDistance) {
        const similarity = calculateStrategySimilarity(bot1, bot2);

        if (similarity >= cfg.formation.similarityThreshold) {
          const currentFrames = (bot1.packProximityMap?.get(bot2.index) || 0) + 1;

          if (!bot1.packProximityMap) bot1.packProximityMap = new Map();
          if (!bot2.packProximityMap) bot2.packProximityMap = new Map();

          bot1.packProximityMap.set(bot2.index, currentFrames);
          bot2.packProximityMap.set(bot1.index, currentFrames);

          if (currentFrames >= cfg.formation.proximityDuration) {
            // Form or join pack
            handlePackFormation(bot1, bot2);

            // Reset proximity tracking
            bot1.packProximityMap.delete(bot2.index);
            bot2.packProximityMap.delete(bot1.index);
          }
        }
      } else {
        // Reset proximity if too far
        if (bot1.packProximityMap) bot1.packProximityMap.delete(bot2.index);
        if (bot2.packProximityMap) bot2.packProximityMap.delete(bot1.index);
      }
    }
  }
}

function handlePackFormation(bot1, bot2) {
  const pack1 = getBotPack(bot1);
  const pack2 = getBotPack(bot2);

  if (pack1 && pack2) {
    // Both in different packs - no merger
    return;
  } else if (pack1) {
    // bot2 joins bot1's pack
    joinPack(bot2, pack1);
  } else if (pack2) {
    // bot1 joins bot2's pack
    joinPack(bot1, pack2);
  } else {
    // Neither in pack - form new pack
    createPack([bot1, bot2]);
  }
}

// ============ PACK UPDATES ============

function updatePacks() {
  const cfg = lifecycleSettings.packs;
  if (!cfg.enabled) return;

  // Check disband conditions
  for (const [packId, pack] of packs.entries()) {
    // Check starvation disband
    if (cfg.bonds.disbandOnStarvation) {
      const members = getPackMembers(pack);
      if (members.length === 0) continue; // Skip empty packs
      const starvingCount = members.filter(m => m.isStarving).length;
      const starvingRatio = starvingCount / members.length;

      if (starvingRatio >= cfg.bonds.starvationDisbandThreshold) {
        // Kick starving members
        members.filter(m => m.isStarving).forEach(m => {
          leavePack(m, 'starving');
        });
      }
    }

    // Update territory
    if (cfg.territory.enabled && pack.members.size >= 2) {
      updatePackTerritory(pack);
    }
  }
}

// ============ TERRITORY ============

function updatePackTerritory(pack) {
  const cfg = lifecycleSettings.packs.territory;
  const members = getPackMembers(pack);

  if (members.length === 0) {
    pack.territory = null;
    return;
  }

  // Calculate center of pack
  let sumX = 0, sumY = 0;
  members.forEach(m => {
    sumX += m.x;
    sumY += m.y;
  });

  const centerX = sumX / members.length;
  const centerY = sumY / members.length;

  // Apply positioning preferences
  let targetX = centerX;
  let targetY = centerY;

  if (cfg.positioning.preferDotClusters) {
    const nearestCluster = findNearestDotCluster(centerX, centerY);
    if (nearestCluster) {
      targetX = centerX + (nearestCluster.x - centerX) * cfg.positioning.clusterWeight;
      targetY = centerY + (nearestCluster.y - centerY) * cfg.positioning.clusterWeight;
    }
  }

  if (cfg.positioning.avoidEnemyClusters) {
    const nearestEnemyCluster = findNearestEnemyCluster(members, centerX, centerY);
    if (nearestEnemyCluster) {
      const dx = centerX - nearestEnemyCluster.x;
      const dy = centerY - nearestEnemyCluster.y;
      targetX += dx * cfg.positioning.enemyWeight;
      targetY += dy * cfg.positioning.enemyWeight;
    }
  }

  // Update or create territory
  if (!pack.territory) {
    pack.territory = {
      center: { x: targetX, y: targetY },
      radius: cfg.radius,
      settledSince: null
    };
  } else {
    const prevCenter = pack.territory.center;
    const moved = Math.sqrt(
      Math.pow(targetX - prevCenter.x, 2) + Math.pow(targetY - prevCenter.y, 2)
    );

    pack.territory.center = { x: targetX, y: targetY };

    // Check if settled
    if (moved < 20) {
      if (pack.territory.settledSince === null) {
        pack.territory.settledSince = frameCount;
      }
    } else {
      pack.territory.settledSince = null;
    }
  }
}

function findNearestDotCluster(x, y) {
  // Simple clustering - find area with most dots nearby
  let bestCluster = null;
  let bestScore = 0;

  for (const dot of yellowDots) {
    let count = 0;
    yellowDots.forEach(d => {
      const dist = Math.sqrt(Math.pow(d.x - dot.x, 2) + Math.pow(d.y - dot.y, 2));
      if (dist < 150) count++;
    });

    const distToPoint = Math.sqrt(Math.pow(dot.x - x, 2) + Math.pow(dot.y - y, 2));
    const score = count / (distToPoint + 100);

    if (score > bestScore) {
      bestScore = score;
      bestCluster = { x: dot.x, y: dot.y, size: count };
    }
  }

  return bestCluster;
}

function findNearestEnemyCluster(packMembers, x, y) {
  const packIndices = new Set(packMembers.map(m => m.index));

  let bestCluster = null;
  let bestCount = 0;
  let bestDist = Infinity;

  for (const bot of bots) {
    if (packIndices.has(bot.index)) continue;

    let count = 0;
    bots.forEach(b => {
      if (packIndices.has(b.index)) return;
      const dist = Math.sqrt(Math.pow(b.x - bot.x, 2) + Math.pow(b.y - bot.y, 2));
      if (dist < 150) count++;
    });

    const distToPoint = Math.sqrt(Math.pow(bot.x - x, 2) + Math.pow(bot.y - y, 2));

    if (count > bestCount || (count === bestCount && distToPoint < bestDist)) {
      bestCount = count;
      bestDist = distToPoint;
      bestCluster = { x: bot.x, y: bot.y, size: count };
    }
  }

  return bestCluster;
}

function isInTerritory(x, y, pack) {
  if (!pack.territory) return false;

  const dist = Math.sqrt(
    Math.pow(x - pack.territory.center.x, 2) +
    Math.pow(y - pack.territory.center.y, 2)
  );

  return dist <= pack.territory.radius;
}

function getTerritoryOwner(x, y) {
  for (const [_, pack] of packs.entries()) {
    if (pack.territory && isInTerritory(x, y, pack)) {
      return pack;
    }
  }
  return null;
}

function isDefendingTerritory(bot) {
  const pack = getBotPack(bot);
  if (!pack || !pack.territory) return false;

  const cfg = lifecycleSettings.packs.territory;

  switch (cfg.defenseMode) {
    case 'always':
      return true;
    case 'whenSettled':
      return pack.territory.settledSince !== null &&
        (frameCount - pack.territory.settledSince) >= cfg.settledThreshold;
    case 'whenStationary':
      // Bot must be stationary
      const dist = Math.sqrt(
        Math.pow(bot.targetX - bot.x, 2) + Math.pow(bot.targetY - bot.y, 2)
      );
      return dist < 10;
    default:
      return true;
  }
}

// ============ CANNIBALISM ============

function canCannibalize(attacker, target) {
  const cfg = lifecycleSettings.packs.cannibalism;
  if (!cfg.enabled) return false;

  // Check if corpse-only mode
  if (cfg.corpseOnly && !(target instanceof Corpse)) return false;

  // Check pack-only restriction
  if (cfg.packOnly) {
    if (target instanceof Corpse) {
      // Check if corpse was from same pack
      if (!attacker.relationships || attacker.relationships.packId !== target.packId) {
        return false;
      }
    } else {
      if (!arePackMates(attacker, target)) return false;
    }
  }

  // Check trigger condition
  switch (cfg.trigger) {
    case 'starving':
      if (!attacker.isStarving) return false;
      break;
    case 'lowLives':
      if (attacker.lives > cfg.lowLivesThreshold) return false;
      break;
    case 'always':
      // Always allowed
      break;
    default:
      return false;
  }

  return true;
}

function selectCannibalismTarget(attacker) {
  const cfg = lifecycleSettings.packs.cannibalism;
  const pack = getBotPack(attacker);
  if (!pack) return null;

  const members = getPackMembers(pack).filter(m => m.index !== attacker.index);
  if (members.length === 0) return null;

  switch (cfg.targetPreference) {
    case 'weakest':
      return members.reduce((w, m) => m.lives < w.lives ? m : w);
    case 'oldest':
      return members.reduce((o, m) => m.age > o.age ? m : o);
    case 'nearest':
      return members.reduce((n, m) => {
        const distM = Math.sqrt(Math.pow(m.x - attacker.x, 2) + Math.pow(m.y - attacker.y, 2));
        const distN = Math.sqrt(Math.pow(n.x - attacker.x, 2) + Math.pow(n.y - attacker.y, 2));
        return distM < distN ? m : n;
      });
    case 'random':
    default:
      return members[Math.floor(Math.random() * members.length)];
  }
}

// ============ PACK RESPAWN HANDLING ============

function handlePackMemberRespawn(bot) {
  if (!lifecycleSettings.packs.bonds.disbandOnRespawn) return;

  if (bot.relationships && bot.relationships.packId !== null) {
    leavePack(bot, 'respawn');
  }
}
