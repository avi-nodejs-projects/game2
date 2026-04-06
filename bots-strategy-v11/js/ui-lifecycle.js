// Bots Strategy v9 - Lifecycle Tab UI Handlers

// ============ LIFECYCLE TAB HANDLERS ============
function initLifecycleUI() {
  // Respawn Invincibility
  document.getElementById('lc-invincibility-enabled').addEventListener('change', (e) => {
    lifecycleSettings.respawnInvincibility.enabled = e.target.checked;
  });
  document.getElementById('lc-invincibility-duration').addEventListener('change', (e) => {
    lifecycleSettings.respawnInvincibility.duration = parseInt(e.target.value);
  });
  document.getElementById('lc-invincibility-can-damage').addEventListener('change', (e) => {
    lifecycleSettings.respawnInvincibility.canDealDamage = e.target.checked;
  });
  document.getElementById('lc-invincibility-break').addEventListener('change', (e) => {
    lifecycleSettings.respawnInvincibility.breakOnCombatInitiation = e.target.checked;
  });
  document.getElementById('lc-invincibility-effect').addEventListener('change', (e) => {
    lifecycleSettings.respawnInvincibility.visualEffect = e.target.value;
  });

  // Starvation
  document.getElementById('lc-starvation-enabled').addEventListener('change', (e) => {
    lifecycleSettings.starvation.enabled = e.target.checked;
  });
  document.getElementById('lc-starvation-threshold').addEventListener('change', (e) => {
    lifecycleSettings.starvation.inactivityThreshold = parseInt(e.target.value);
  });
  document.getElementById('lc-starvation-damage').addEventListener('change', (e) => {
    lifecycleSettings.starvation.damagePerTick = parseFloat(e.target.value);
  });
  document.getElementById('lc-starvation-interval').addEventListener('change', (e) => {
    lifecycleSettings.starvation.tickInterval = parseInt(e.target.value);
  });
  document.getElementById('lc-starvation-reset-dot').addEventListener('change', (e) => {
    lifecycleSettings.starvation.resetConditions.onDotEaten = e.target.checked;
  });
  document.getElementById('lc-starvation-reset-damage').addEventListener('change', (e) => {
    lifecycleSettings.starvation.resetConditions.onDamageDealt = e.target.checked;
  });
  document.getElementById('lc-starvation-reset-kill').addEventListener('change', (e) => {
    lifecycleSettings.starvation.resetConditions.onKill = e.target.checked;
  });
  document.getElementById('lc-starvation-stat-decay').addEventListener('change', (e) => {
    lifecycleSettings.starvation.statDecay.enabled = e.target.checked;
  });

  // Age + Corpses
  document.getElementById('lc-age-enabled').addEventListener('change', (e) => {
    lifecycleSettings.age.enabled = e.target.checked;
  });
  document.getElementById('lc-age-max').addEventListener('change', (e) => {
    lifecycleSettings.age.maxAge = parseInt(e.target.value);
  });
  document.getElementById('lc-age-visual-start').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) / 100;
    lifecycleSettings.age.visualDecayStart = value;
    document.getElementById('lc-age-visual-value').textContent = e.target.value + '%';
    updateRangeFill(e.target);
  });
  document.getElementById('lc-age-death-behavior').addEventListener('change', (e) => {
    lifecycleSettings.age.deathBehavior = e.target.value;
  });
  document.getElementById('lc-corpse-nutrition').addEventListener('change', (e) => {
    lifecycleSettings.age.corpse.nutritionValue = parseFloat(e.target.value);
  });
  document.getElementById('lc-corpse-duration').addEventListener('change', (e) => {
    lifecycleSettings.age.corpse.duration = parseInt(e.target.value);
  });

  // Asexual Reproduction
  document.getElementById('lc-asexual-enabled').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.asexual.enabled = e.target.checked;
  });
  document.getElementById('lc-asexual-maturity').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.asexual.maturityThreshold = parseInt(e.target.value);
  });
  document.getElementById('lc-asexual-life-cost').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) / 100;
    lifecycleSettings.reproduction.asexual.parentLifeCost = value;
    document.getElementById('lc-asexual-cost-value').textContent = e.target.value + '%';
    updateRangeFill(e.target);
  });
  document.getElementById('lc-asexual-noise').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) / 100;
    lifecycleSettings.reproduction.asexual.statNoise = value;
    document.getElementById('lc-asexual-noise-value').textContent = e.target.value + '%';
    updateRangeFill(e.target);
  });
  document.getElementById('lc-asexual-cooldown').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.asexual.cooldown = parseInt(e.target.value);
  });

  // Sexual Reproduction
  document.getElementById('lc-sexual-enabled').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.sexual.enabled = e.target.checked;
  });
  document.getElementById('lc-sexual-distance').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.sexual.proximityDistance = parseInt(e.target.value);
  });
  document.getElementById('lc-sexual-duration').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.sexual.proximityDuration = parseInt(e.target.value);
  });
  document.getElementById('lc-sexual-compat').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) / 100;
    lifecycleSettings.reproduction.sexual.compatibilityThreshold = value;
    document.getElementById('lc-sexual-compat-value').textContent = value.toFixed(1);
    updateRangeFill(e.target);
  });
  document.getElementById('lc-sexual-cooldown').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.sexual.cooldown = parseInt(e.target.value);
  });
  document.getElementById('lc-sexual-pack-bonus').addEventListener('change', (e) => {
    lifecycleSettings.reproduction.sexual.packBonus.enabled = e.target.checked;
  });

  // Pack Formation
  document.getElementById('lc-packs-enabled').addEventListener('change', (e) => {
    lifecycleSettings.packs.enabled = e.target.checked;
  });
  document.getElementById('lc-packs-similarity').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) / 100;
    lifecycleSettings.packs.formation.similarityThreshold = value;
    document.getElementById('lc-packs-similarity-value').textContent = value.toFixed(1);
    updateRangeFill(e.target);
  });
  document.getElementById('lc-packs-distance').addEventListener('change', (e) => {
    lifecycleSettings.packs.formation.proximityDistance = parseInt(e.target.value);
  });
  document.getElementById('lc-packs-max-size').addEventListener('change', (e) => {
    lifecycleSettings.packs.size.max = parseInt(e.target.value);
  });
  document.getElementById('lc-packs-disband-respawn').addEventListener('change', (e) => {
    lifecycleSettings.packs.bonds.disbandOnRespawn = e.target.checked;
  });
  document.getElementById('lc-packs-disband-starve').addEventListener('change', (e) => {
    lifecycleSettings.packs.bonds.disbandOnStarvation = e.target.checked;
  });

  // Territory + Cannibalism
  document.getElementById('lc-territory-enabled').addEventListener('change', (e) => {
    lifecycleSettings.packs.territory.enabled = e.target.checked;
  });
  document.getElementById('lc-territory-radius').addEventListener('change', (e) => {
    lifecycleSettings.packs.territory.radius = parseInt(e.target.value);
  });
  document.getElementById('lc-cannibalism-enabled').addEventListener('change', (e) => {
    lifecycleSettings.packs.cannibalism.enabled = e.target.checked;
  });
  document.getElementById('lc-cannibalism-trigger').addEventListener('change', (e) => {
    lifecycleSettings.packs.cannibalism.trigger = e.target.value;
  });
  document.getElementById('lc-cannibalism-target').addEventListener('change', (e) => {
    lifecycleSettings.packs.cannibalism.targetPreference = e.target.value;
  });

  // Player Overrides
  document.getElementById('lc-player-overrides').addEventListener('change', (e) => {
    lifecycleSettings.playerOverrides.enabled = e.target.checked;
  });
  document.getElementById('lc-player-immune-starve').addEventListener('change', (e) => {
    lifecycleSettings.playerOverrides.starvation.enabled = !e.target.checked;
  });
  document.getElementById('lc-player-immune-age').addEventListener('change', (e) => {
    lifecycleSettings.playerOverrides.age.enabled = !e.target.checked;
  });
  document.getElementById('lc-player-reproduce').addEventListener('change', (e) => {
    lifecycleSettings.playerOverrides.reproduction.enabled = e.target.checked;
  });
}

function initLifecycleAccordion() {
  document.querySelectorAll('.lifecycle-card').forEach(card => {
    const header = card.querySelector('.lifecycle-header');
    const checkbox = card.querySelector('.lifecycle-header .toggle-switch input[type="checkbox"]');
    const badge = card.querySelector('.status-badge');

    // Toggle accordion on header click
    header.addEventListener('click', (e) => {
      // Don't toggle accordion when clicking the toggle switch
      if (e.target.closest('.toggle-switch')) return;
      card.classList.toggle('expanded');
    });

    // Update enabled state on checkbox change
    if (checkbox) {
      const updateEnabled = () => {
        if (checkbox.checked) {
          card.classList.add('enabled');
          if (badge) {
            badge.textContent = 'Active';
            badge.className = 'status-badge on';
          }
        } else {
          card.classList.remove('enabled');
          if (badge) {
            badge.textContent = 'Disabled';
            badge.className = 'status-badge off';
          }
        }
      };
      checkbox.addEventListener('change', updateEnabled);
      // Set initial state
      updateEnabled();
    }
  });
}

function updateLifecycleUI() {
  // Respawn Invincibility
  document.getElementById('lc-invincibility-enabled').checked = lifecycleSettings.respawnInvincibility.enabled;
  document.getElementById('lc-invincibility-duration').value = lifecycleSettings.respawnInvincibility.duration;
  document.getElementById('lc-invincibility-can-damage').checked = lifecycleSettings.respawnInvincibility.canDealDamage;
  document.getElementById('lc-invincibility-break').checked = lifecycleSettings.respawnInvincibility.breakOnCombatInitiation;
  document.getElementById('lc-invincibility-effect').value = lifecycleSettings.respawnInvincibility.visualEffect;

  // Starvation
  document.getElementById('lc-starvation-enabled').checked = lifecycleSettings.starvation.enabled;
  document.getElementById('lc-starvation-threshold').value = lifecycleSettings.starvation.inactivityThreshold;
  document.getElementById('lc-starvation-damage').value = lifecycleSettings.starvation.damagePerTick;
  document.getElementById('lc-starvation-interval').value = lifecycleSettings.starvation.tickInterval;
  document.getElementById('lc-starvation-reset-dot').checked = lifecycleSettings.starvation.resetConditions.onDotEaten;
  document.getElementById('lc-starvation-reset-damage').checked = lifecycleSettings.starvation.resetConditions.onDamageDealt;
  document.getElementById('lc-starvation-reset-kill').checked = lifecycleSettings.starvation.resetConditions.onKill;
  document.getElementById('lc-starvation-stat-decay').checked = lifecycleSettings.starvation.statDecay.enabled;

  // Age + Corpses
  document.getElementById('lc-age-enabled').checked = lifecycleSettings.age.enabled;
  document.getElementById('lc-age-max').value = lifecycleSettings.age.maxAge;
  const ageVisualStart = Math.round(lifecycleSettings.age.visualDecayStart * 100);
  document.getElementById('lc-age-visual-start').value = ageVisualStart;
  document.getElementById('lc-age-visual-value').textContent = ageVisualStart + '%';
  document.getElementById('lc-age-death-behavior').value = lifecycleSettings.age.deathBehavior;
  document.getElementById('lc-corpse-nutrition').value = lifecycleSettings.age.corpse.nutritionValue;
  document.getElementById('lc-corpse-duration').value = lifecycleSettings.age.corpse.duration;

  // Asexual Reproduction
  document.getElementById('lc-asexual-enabled').checked = lifecycleSettings.reproduction.asexual.enabled;
  document.getElementById('lc-asexual-maturity').value = lifecycleSettings.reproduction.asexual.maturityThreshold;
  const asexualCost = Math.round(lifecycleSettings.reproduction.asexual.parentLifeCost * 100);
  document.getElementById('lc-asexual-life-cost').value = asexualCost;
  document.getElementById('lc-asexual-cost-value').textContent = asexualCost + '%';
  const asexualNoise = Math.round(lifecycleSettings.reproduction.asexual.statNoise * 100);
  document.getElementById('lc-asexual-noise').value = asexualNoise;
  document.getElementById('lc-asexual-noise-value').textContent = asexualNoise + '%';
  document.getElementById('lc-asexual-cooldown').value = lifecycleSettings.reproduction.asexual.cooldown;

  // Sexual Reproduction
  document.getElementById('lc-sexual-enabled').checked = lifecycleSettings.reproduction.sexual.enabled;
  document.getElementById('lc-sexual-distance').value = lifecycleSettings.reproduction.sexual.proximityDistance;
  document.getElementById('lc-sexual-duration').value = lifecycleSettings.reproduction.sexual.proximityDuration;
  const sexualCompat = Math.round(lifecycleSettings.reproduction.sexual.compatibilityThreshold * 100);
  document.getElementById('lc-sexual-compat').value = sexualCompat;
  document.getElementById('lc-sexual-compat-value').textContent = (sexualCompat / 100).toFixed(1);
  document.getElementById('lc-sexual-cooldown').value = lifecycleSettings.reproduction.sexual.cooldown;
  document.getElementById('lc-sexual-pack-bonus').checked = lifecycleSettings.reproduction.sexual.packBonus.enabled;

  // Pack Formation
  document.getElementById('lc-packs-enabled').checked = lifecycleSettings.packs.enabled;
  const packsSimilarity = Math.round(lifecycleSettings.packs.formation.similarityThreshold * 100);
  document.getElementById('lc-packs-similarity').value = packsSimilarity;
  document.getElementById('lc-packs-similarity-value').textContent = (packsSimilarity / 100).toFixed(1);
  document.getElementById('lc-packs-distance').value = lifecycleSettings.packs.formation.proximityDistance;
  document.getElementById('lc-packs-max-size').value = lifecycleSettings.packs.size.max;
  document.getElementById('lc-packs-disband-respawn').checked = lifecycleSettings.packs.bonds.disbandOnRespawn;
  document.getElementById('lc-packs-disband-starve').checked = lifecycleSettings.packs.bonds.disbandOnStarvation;

  // Territory + Cannibalism
  document.getElementById('lc-territory-enabled').checked = lifecycleSettings.packs.territory.enabled;
  document.getElementById('lc-territory-radius').value = lifecycleSettings.packs.territory.radius;
  document.getElementById('lc-cannibalism-enabled').checked = lifecycleSettings.packs.cannibalism.enabled;
  document.getElementById('lc-cannibalism-trigger').value = lifecycleSettings.packs.cannibalism.trigger;
  document.getElementById('lc-cannibalism-target').value = lifecycleSettings.packs.cannibalism.targetPreference;

  // Player Overrides
  document.getElementById('lc-player-overrides').checked = lifecycleSettings.playerOverrides.enabled;
  document.getElementById('lc-player-immune-starve').checked = !lifecycleSettings.playerOverrides.starvation.enabled;
  document.getElementById('lc-player-immune-age').checked = !lifecycleSettings.playerOverrides.age.enabled;
  document.getElementById('lc-player-reproduce').checked = lifecycleSettings.playerOverrides.reproduction.enabled;

  // Update accordion enabled states
  document.querySelectorAll('.lifecycle-card').forEach(card => {
    const checkbox = card.querySelector('.lifecycle-header .toggle-switch input[type="checkbox"]');
    const badge = card.querySelector('.status-badge');
    if (checkbox && badge) {
      if (checkbox.checked) {
        card.classList.add('enabled');
        badge.textContent = 'Active';
        badge.className = 'status-badge on';
      } else {
        card.classList.remove('enabled');
        badge.textContent = 'Disabled';
        badge.className = 'status-badge off';
      }
    }
  });
}

function updateBillboardUI() {
  document.getElementById('billboard-enabled').checked = billboardSettings.enabled;
  document.getElementById('billboard-max').value = billboardSettings.maxBillboards;
  const spawnChanceSlider = Math.round(billboardSettings.spawnChance * 1000);
  document.getElementById('billboard-spawn-chance').value = spawnChanceSlider;
  document.getElementById('billboard-spawn-value').textContent = billboardSettings.spawnChance.toFixed(3);
  document.getElementById('billboard-min-duration').value = billboardSettings.minDuration;
  document.getElementById('billboard-max-duration').value = billboardSettings.maxDuration;
  document.getElementById('billboard-proximity').value = billboardSettings.clusterProximityRadius;
  document.getElementById('billboard-min-cluster').value = billboardSettings.minClusterSize;
  document.getElementById('billboard-width').value = billboardSettings.boardWidth;
  document.getElementById('billboard-height').value = billboardSettings.boardHeight;
  document.getElementById('billboard-pole-height').value = billboardSettings.poleHeight;
}
