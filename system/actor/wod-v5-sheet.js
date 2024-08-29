/* global DEFAULT_TOKEN, ChatMessage, ActorSheet, game, renderTemplate, Dialog, TextEditor, WOD5E, foundry */

// Data preparation functions
import { prepareSkills } from './scripts/prepare-skills.js'
import { prepareAttributes } from './scripts/prepare-attributes.js'
import { _onHealthChange } from './scripts/on-health-change.js'
import { _onWillpowerChange } from './scripts/on-willpower-change.js'
import { getActorHeader } from './scripts/get-actor-header.js'
// Roll function
import { WOD5eDice } from '../scripts/system-rolls.js'
import { _onRoll } from './scripts/roll.js'
// Resource functions
import { _onResourceChange, _setupDotCounters, _setupSquareCounters, _onDotCounterChange, _onDotCounterEmpty, _onSquareCounterChange } from './scripts/counters.js'
import { _onAddBonus, _onDeleteBonus, _onEditBonus } from './scripts/specialty-bonuses.js'
// Various button functions
import { _onRollItem } from './scripts/item-roll.js'
import { _onAddExperience } from './scripts/experience.js'

/**
 * Extend the base ActorSheet document and put all our base functionality here
 * @extends {ActorSheet}
 */
export class WoDActor extends ActorSheet {
  /** @override */
  static get defaultOptions () {
    // Define the base list of CSS classes
    const classList = ['wod5e', 'sheet', 'actor']

    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: classList,
      width: 1000,
      height: 700,
      tabs: [{
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: 'stats'
      }],
      dragDrop: [{
        dragSelector: '.item',
        dropSelector: null
      }]
    })
  }

  /** @override */
  async _render (...args) {
    // Override _render so that we can save and restore the scroll position during rendering
    this._saveScrollPositions()

    await super._render(...args)

    this._restoreScrollPositions()
  }

  /** @override */
  async getData () {
    const data = await super.getData()
    const actor = this.actor
    const actorData = this.object.system
    data.isCharacter = this.isCharacter
    data.hasBoons = this.hasBoons
    data.locked = actorData.locked

    if (this.object.type !== 'group') {
      await _onHealthChange(actor)
      await _onWillpowerChange(actor)
    }

    data.displayBanner = game.settings.get('vtm5e', 'actorBanner')

    data.headerbg = await getActorHeader(actor)

    // Enrich non-header editor fields
    if (actorData.biography) { data.enrichedBiography = await TextEditor.enrichHTML(actorData.biography) }
    if (actorData.appearance) { data.enrichedAppearance = await TextEditor.enrichHTML(actorData.appearance) }
    if (actorData.notes) { data.enrichedNotes = await TextEditor.enrichHTML(actorData.notes) }
    if (actorData.privatenotes) { data.enrichedPrivateNotes = await TextEditor.enrichHTML(actorData.privatenotes) }
    if (actorData.equipment) { data.enrichedEquipment = await TextEditor.enrichHTML(actorData.equipment) }

    // Enrich actor header editor fields
    const actorHeaders = actorData.headers
    if (actorHeaders.tenets) { data.enrichedTenets = await TextEditor.enrichHTML(actorHeaders.tenets) }
    if (actorHeaders.touchstones) { data.enrichedTouchstones = await TextEditor.enrichHTML(actorHeaders.touchstones) }
    // Vampire stuff
    if (actorHeaders.bane) { data.enrichedBane = await TextEditor.enrichHTML(actorHeaders.bane) }
    // Ghoul stuff
    if (actorHeaders.creedfields) { data.enrichedCreedFields = await TextEditor.enrichHTML(actorHeaders.creedfields) }

    // Enrich item descriptions
    for (const item in data.items) {
      if (data.items[item].system?.description) {
        const enrichedItemDescription = await TextEditor.enrichHTML(data.items[item].system.description)

        data.items[item].system.enrichedDescription = enrichedItemDescription
      }
    }

    return data
  }

  /**
     * Organize and classify Items for all sheets.
     *
     * @param {Object} actorData The actor to prepare.
     * @return {undefined}
     * @override
     */
  async _prepareItems (sheetData) {
    const actor = this.actor
    const actorData = sheetData.actor

    // Handle attribute preparation
    const { attributes, sortedAttributes } = await prepareAttributes(actor)
    actorData.system.attributes = attributes
    actorData.system.sortedAttributes = sortedAttributes

    // Handle skill preparation
    const { skills, sortedSkills } = await prepareSkills(actor)
    actorData.system.skills = skills
    actorData.system.sortedSkills = sortedSkills

    const features = {
      background: [],
      merit: [],
      flaw: [],
      boon: []
    }

    // Initialize containers.
    const customRolls = []
    const equipment = []

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || DEFAULT_TOKEN

      i.uuid = `Actor.${this.actor._id}.Item.${i._id}`

      // Sort the item into its appropriate place
      if (i.type === 'equipment') {
        // Append to equipment
        equipment[i.system.equipmentType].push(i)
      } else if (i.type === 'feature') {
        // Check the featuretype field and set a default
        const featuretype = i.system.featuretype in WOD5E.Features.getList() ? i.system.featuretype : 'background'

        // Append to features
        features[featuretype].push(i)
      } else if (i.type === 'customRoll') {
        // Append to custom rolls
        customRolls.push(i)
      }
    }

    // Assign items to their containers in the actor data
    actorData.system.customRolls = customRolls
    actorData.system.equipment = equipment
    actorData.system.features = features
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    // Activate listeners
    super.activateListeners(html)

    // Top-level variables
    const actor = this.actor

    // Resource squares (Health, Willpower)
    html.find('.resource-counter.editable .resource-counter-step').click(_onSquareCounterChange.bind(this))
    html.find('.resource-plus').click(_onResourceChange.bind(this))
    html.find('.resource-minus').click(_onResourceChange.bind(this))

    // Activate the setup for the counters
    _setupDotCounters(html)
    _setupSquareCounters(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Rollable attributes
    html.find('.rollable').click(_onRoll.bind(this))

    // Lock button
    html.find('.lock-btn').click(this._onToggleLocked.bind(this))

    // Resource dots
    html.find('.resource-value .resource-value-step').click(_onDotCounterChange.bind(this))
    html.find('.resource-value .resource-value-empty').click(_onDotCounterEmpty.bind(this))

    // Create a new item on an actor sheet
    html.find('.item-create').click(this._onCreateItem.bind(this))

    // Roll an item's dicepool
    html.find('.rollable-item').click(_onRollItem.bind(this))

    // Edit a skill
    html.find('.edit-skill').click(this._onSkillEdit.bind(this))

    // Add an experience
    html.find('.add-experience').click(_onAddExperience.bind(this, actor))

    // Send Inventory Item to Chat
    html.find('.item-chat').click(async event => {
      const li = $(event.currentTarget).parents('.item')
      const item = actor.getEmbeddedDocument('Item', li.data('itemId'))
      renderTemplate('systems/vtm5e/display/ui/chat/chat-message.hbs', {
        name: item.name,
        img: item.img,
        description: item.system.description
      }).then(html => {
        ChatMessage.create({
          content: html
        })
      })
    })

    // Update Inventory Item
    html.find('.item-edit').click(async event => {
      const li = $(event.currentTarget).parents('.item')
      const item = actor.getEmbeddedDocument('Item', li.data('itemId'))
      item.sheet.render(true)
    })

    // Delete Inventory Item
    html.find('.item-delete').click(async event => {
      // Primary variables
      const li = $(event.currentTarget).parents('.item')
      const item = actor.getEmbeddedDocument('Item', li.data('itemId'))

      // Define the actor's gamesystem, defaulting to "mortal" if it's not in the systems list
      const system = actor.system.gamesystem in WOD5E.Systems.getList() ? actor.system.gamesystem : 'mortal'

      // Variables yet to be defined
      let buttons = {}

      // Define the template to be used
      const template = `
      <form>
          <div class="form-group">
              <label>${game.i18n.format('WOD5E.ConfirmDeleteDescription', {
                string: item.name
              })}</label>
          </div>
      </form>`

      // Define the buttons and push them to the buttons variable
      buttons = {
        delete: {
          label: game.i18n.localize('WOD5E.Delete'),
          callback: async () => {
            actor.deleteEmbeddedDocuments('Item', [li.data('itemId')])
            li.slideUp(200, () => this.render(false))
          }
        },
        cancel: {
          label: game.i18n.localize('WOD5E.Cancel'),
          callback: async () => {
            actor.update({ 'system.activeForm': 'lupus' })
          }
        }
      }

      new Dialog({
        title: game.i18n.localize('WOD5E.ConfirmDelete'),
        content: template,
        buttons,
        default: 'cancel'
      },
      {
        classes: ['wod5e', system, 'dialog']
      }).render(true)
    })

    // Collapsible items and other elements
    $('.collapsible').on('click', function () {
      $(this).toggleClass('active')

      const content = $(this).closest('.collapsible-container').find('.collapsible-content')

      if (content.css('maxHeight') === '0px') {
        content.css('maxHeight', content.prop('scrollHeight') + 'px')
      } else {
        content.css('maxHeight', '0px')
      }
    })

    // Willpower Rolls
    html.find('.willpower-roll').click(this._onWillpowerRoll.bind(this))

    html.find('.toggle-limited').click(this._onToggleLimited.bind(this))
  }

  // Calculate the dice for a Willpower roll
  getWillpowerDicePool (actor) {
    const willpowerMax = actor.system.willpower.max
    const willpowerAgg = actor.system.willpower.aggravated
    const willpowerSup = actor.system.willpower.superficial

    return Math.max((willpowerMax - willpowerAgg - willpowerSup), 0)
  }

  /**
   * Handle locking and unlocking the actor sheet
   * @param {Event} event   The originating click event
   */
  async _onToggleLocked (event) {
    event.preventDefault()

    // Top-level variables
    const actor = this.actor

    // Update the locked state
    await actor.update({ 'system.locked': !actor.system.locked })
  }

  /**
   * Handle bringing up the skill edit dialog window
   * @param {Event} event   The originating click event
   * @protected
   */
  async _onSkillEdit (event) {
    event.preventDefault()

    // Top-level variables
    const actor = this.actor
    const header = event.currentTarget
    const skill = header.dataset.skill

    // Define the actor's gamesystem, defaulting to "mortal" if it's not in the systems list
    const system = actor.system.gamesystem in WOD5E.Systems.getList() ? actor.system.gamesystem : 'mortal'

    // Render selecting a skill/attribute to roll
    const skillTemplate = 'systems/vtm5e/display/shared/actors/parts/skill-dialog.hbs'
    // Render the template
    const content = await renderTemplate(skillTemplate, {
      id: skill,
      actor,
      system,
      skill: actor.system.skills[skill]
    })

    // Render the dialog window to select which skill/attribute combo to use
    const SkillEditDialog = new Dialog(
      {
        title: WOD5E.Skills.getList({})[skill].displayName,
        content,
        buttons: { },
        close: (html) => {
          // Top-level variables
          const newDescription = html.find('#description')[0].value
          const newMacro = html.find('#macroid')[0].value

          // Update the description of the skill
          actor.update({ [`system.skills.${skill}.description`]: newDescription })
          // Update the macro ID
          actor.update({ [`system.skills.${skill}.macroid`]: newMacro })

          // Remove the dialog from the actor's apps on close.
          delete actor.apps[SkillEditDialog.appId]
        },
        render: (html) => {
          // Define the skill data to send along with any functions
          const skillData = {
            id: skill,
            actor,
            system,
            skill: actor.system.skills[skill]
          }

          // Prompt the dialog to add a new bonus
          html.find('.add-bonus').click(async event => {
            _onAddBonus(event, actor, skillData, SkillEditDialog)
          })

          // Delete a bonus
          html.find('.delete-bonus').click(async event => {
            _onDeleteBonus(event, actor, skillData, SkillEditDialog)
          })

          // Prompt the dialog to edit a bonus
          html.find('.edit-bonus').click(async event => {
            _onEditBonus(event, actor, skillData, SkillEditDialog)
          })
        }
      },
      {
        classes: ['wod5e', system, 'dialog'],
        tabs: [
          {
            navSelector: '.sheet-tabs',
            contentSelector: '.sheet-body',
            initial: 'description'
          }
        ],
        resizeable: true
      }
    ).render(true)

    // Add the dialog to the list of apps on the actor
    // This re-renders the dialog every actor update
    actor.apps[SkillEditDialog.appId] = SkillEditDialog
  }

  // Roll Handlers
  async _onWillpowerRoll (event) {
    event.preventDefault()

    // Top-level variables
    const actor = this.actor

    // Secondary variables
    const dicePool = Math.max(this.getWillpowerDicePool(actor), 1)

    WOD5eDice.Roll({
      basicDice: dicePool,
      title: game.i18n.localize('WOD5E.Chat.RollingWillpower'),
      selectors: ['willpower'],
      actor,
      data: actor.system,
      quickRoll: false,
      disableAdvancedDice: true
    })
  }

  // Handle toggling a field between visible and not visible
  async _onToggleLimited (event) {
    event.preventDefault()

    // Top-level variables
    const actor = this.actor
    const dataset = event.currentTarget.dataset
    const field = dataset.name

    // Secondary variables
    let currentValue = actor
    const fieldParts = field.split('.')

    // Iterate through the fieldParts to get the current value
    for (const part of fieldParts) {
      currentValue = currentValue[part]
    }

    if (field) {
      await actor.update({ [field]: !currentValue })
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in a dataset
   * @param {Event} event   The originating click event
   */
  async _onCreateItem (event) {
    event.preventDefault()

    // Top-level variables
    const actor = this.actor
    const dataset = event.currentTarget.dataset
    const itemsList = WOD5E.ItemTypes.getList()
    const type = dataset.type

    // Variables to be defined later
    let subtype = dataset.subtype
    let itemName = ''
    let selectLabel = ''
    let itemOptions = {}
    let itemData = {}
    let options = ''

    // Define the actor's gamesystem, defaulting to "mortal" if it's not in the systems list
    const system = actor.system.gamesystem in WOD5E.Systems.getList() ? actor.system.gamesystem : 'mortal'

    // Generate the item name
    itemName = subtype ? WOD5E.api.generateLabelAndLocalize({ string: subtype, type }) : itemsList[type].label

    // Generate item-specific data based on type
    switch (type) {
      case 'power':
        selectLabel = game.i18n.localize('WOD5E.VTM.SelectDiscipline')
        itemOptions = WOD5E.Disciplines.getList({})
        itemName = game.i18n.format('WOD5E.VTM.NewStringPower', { string: itemName })
        break
      case 'perk':
        selectLabel = game.i18n.localize('WOD5E.HTR.SelectEdge')
        itemOptions = WOD5E.Edges.getList()
        itemName = game.i18n.format('WOD5E.HTR.NewStringPerk', { string: itemName })
        break
      case 'gift':
        selectLabel = game.i18n.localize('WOD5E.WTA.SelectGift')
        itemOptions = WOD5E.Gifts.getList()

        if (subtype && subtype === 'rite') {
          itemName = game.i18n.format('WOD5E.NewString', { string: itemName })
        } else {
          itemName = game.i18n.format('WOD5E.WTA.NewStringGift', { string: itemName })
        }
        break
      case 'edgepool':
        itemName = game.i18n.format('WOD5E.HTR.NewStringEdgePool', { string: itemName })
        break
      case 'feature':
        selectLabel = game.i18n.localize('WOD5E.ItemsList.SelectFeature')
        itemOptions = WOD5E.Features.getList()
        itemName = game.i18n.format('WOD5E.NewString', { string: itemName })
        break
      default:
        itemName = game.i18n.format('WOD5E.NewString', { string: itemName })
        break
    }

    // Create item if subtype is already defined or not needed
    if (subtype || ['customRoll', 'boon'].includes(type)) {
      if (subtype) {
        itemData = await this.appendSubtypeData(type, subtype, itemData)
      }

      // Create the item
      return this._createItem(actor, itemName, type, itemData)
    } else {
      // Build the options for the select dropdown
      for (const [key, value] of Object.entries(itemOptions)) {
        options += `<option value="${key}">${value.displayName}</option>`
      }

      // Template for the dialog form
      const template = `
        <form>
          <div class="form-group">
            <label>${selectLabel}</label>
            <select id="subtypeSelect">${options}</select>
          </div>
        </form>`

      // Define dialog buttons
      const buttons = {
        submit: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('WOD5E.Add'),
          callback: async (html) => {
            subtype = html.find('#subtypeSelect')[0].value
            itemData = await this.appendSubtypeData(type, subtype, itemData)

            // Create the item
            return this._createItem(actor, itemName, type, itemData)
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('WOD5E.Cancel')
        }
      }

      // Display the dialog
      new Dialog({
        title: game.i18n.localize('WOD5E.Add'),
        content: template,
        buttons,
        default: 'submit'
      }, {
        classes: ['wod5e', system, 'dialog']
      }).render(true)
    }
  }

  /**
  * Append subtype data to the item data based on item type
  * @param {string} type    The item type
  * @param {string} subtype The item subtype
  * @param {object} itemData The existing item data
  * @returns {object} The updated item data
  */
  async appendSubtypeData (type, subtype, itemData) {
    switch (type) {
      case 'power':
        itemData.discipline = subtype
        break
      case 'perk':
        itemData.edge = subtype
        break
      case 'edgepool':
        itemData.edge = subtype
        break
      case 'gift':
        itemData.giftType = subtype
        break
      case 'feature':
        itemData.featuretype = subtype
        break
      default:
        itemData.subtype = subtype
    }

    return itemData
  }

  /**
  * Create an item for the actor
  * @param {object} actor    The actor object
  * @param {string} itemName The name of the item
  * @param {string} type     The type of the item
  * @param {object} itemData The data for the item
  */
  async _createItem (actor, itemName, type, itemData) {
    return actor.createEmbeddedDocuments('Item', [{
      name: itemName,
      type,
      system: itemData
    }])
  }

  // Save the current scroll position
  async _saveScrollPositions () {
    const activeList = this.findActiveList()
    if (activeList.length) {
      this._scroll = activeList.prop('scrollTop')
    }
  }

  // Restore the saved scroll position
  async _restoreScrollPositions () {
    const activeList = this.findActiveList()
    if (activeList.length && this._scroll != null) {
      activeList.prop('scrollTop', this._scroll)
    }
  }

  // Get the scroll area of the current window
  findActiveList () {
    return $(this.element).find('.window-content')
  }
}
