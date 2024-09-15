/* global foundry */

// Preparation functions
import { prepareBiographyContext, prepareExperienceContext, prepareFeaturesContext, prepareNotepadContext, prepareSettingsContext, prepareStatsContext } from '../scripts/prepare-partials.js'
import { prepareDisciplinesContext } from './scripts/prepare-partials.js'
// Various button functions
import { _onAddDiscipline } from './scripts/disciplines.js'
// Base actor sheet to extend from
import { WoDActor } from '../wod-v5-sheet.js'
// Mixin
const { HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Extend the WoDActor document
 * @extends {WoDActor}
 */
export class GhoulActorSheet extends HandlebarsApplicationMixin(WoDActor) {
  static DEFAULT_OPTIONS = {
    classes: ['wod5e', 'actor', 'sheet', 'vampire'],
    actions: {
      addDiscipline: _onAddDiscipline
    }
  }

  static PARTS = {
    header: {
      template: 'systems/vtm5e/display/vtm/actors/ghoul-sheet.hbs'
    },
    tabs: {
      template: 'systems/vtm5e/display/shared/actors/parts/tab-navigation.hbs'
    },
    stats: {
      template: 'systems/vtm5e/display/shared/actors/parts/stats.hbs'
    },
    experience: {
      template: 'systems/vtm5e/display/shared/actors/parts/experience.hbs'
    },
    disciplines: {
      template: 'systems/vtm5e/display/vtm/actors/parts/disciplines.hbs'
    },
    features: {
      template: 'systems/vtm5e/display/shared/actors/parts/features.hbs'
    },
    biography: {
      template: 'systems/vtm5e/display/shared/actors/parts/biography.hbs'
    },
    notepad: {
      template: 'systems/vtm5e/display/shared/actors/parts/notepad.hbs'
    },
    settings: {
      template: 'systems/vtm5e/display/shared/actors/parts/actor-settings.hbs'
    },
    banner: {
      template: 'systems/vtm5e/display/shared/actors/parts/type-banner.hbs'
    }
  }

  tabs = {
    stats: {
      id: 'stats',
      group: 'primary',
      title: 'WOD5E.Tabs.Stats',
      icon: '<i class="fa-regular fa-chart-line"></i>'
    },
    experience: {
      id: 'experience',
      group: 'primary',
      title: 'WOD5E.Tabs.Experience',
      icon: '<i class="fa-solid fa-file-contract"></i>'
    },
    disciplines: {
      id: 'disciplines',
      group: 'primary',
      title: 'WOD5E.VTM.Disciplines',
      icon: '<span class="wod5e-symbol">b</span>'
    },
    features: {
      id: 'features',
      group: 'primary',
      title: 'WOD5E.Tabs.Features',
      icon: '<i class="fas fa-gem"></i>'
    },
    biography: {
      id: 'biography',
      group: 'primary',
      title: 'WOD5E.Tabs.Biography',
      icon: '<i class="fas fa-id-card"></i>'
    },
    notepad: {
      id: 'notepad',
      group: 'primary',
      title: 'WOD5E.Tabs.Notes',
      icon: '<i class="fas fa-sticky-note"></i>'
    },
    settings: {
      id: 'settings',
      group: 'primary',
      title: 'WOD5E.Tabs.Settings',
      icon: '<i class="fa-solid fa-gears"></i>'
    }
  }

  async _prepareContext () {
    // Top-level variables
    const data = await super._prepareContext()
    const actor = this.actor
    const actorData = actor.system

    // Prepare vampire-specific items
    data.domitor = actorData.headers.domitor
    data.humanity = actorData.humanity
    data.hunger = actorData.hunger

    return data
  }

  async _preparePartContext (partId, context, options) {
    // Inherit any preparation from the extended class
    context = { ...(await super._preparePartContext(partId, context, options)) }

    // Top-level variables
    const actor = this.actor

    // Prepare each page context
    switch (partId) {
      // Stats
      case 'stats':
        return prepareStatsContext(context, actor)

      // Experience
      case 'experience':
        return prepareExperienceContext(context, actor)

      // Disciplines
      case 'disciplines':
        return prepareDisciplinesContext(context, actor)

      // Features
      case 'features':
        return prepareFeaturesContext(context, actor)

      // Biography
      case 'biography':
        return prepareBiographyContext(context, actor)

      // Notepad
      case 'notepad':
        return prepareNotepadContext(context, actor)

      // Settings
      case 'settings':
        return prepareSettingsContext(context, actor)
    }

    return context
  }
}
