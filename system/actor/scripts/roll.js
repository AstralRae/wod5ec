/* global WOD5E */

import { WOD5eDice } from '../../scripts/system-rolls.js'
import { getActiveModifiers } from '../../scripts/rolls/situational-modifiers.js'
import { potencyToRouse } from '../vtm/scripts/blood-potency.js'

/**
   * Handle clickable rolls activated through buttons
   * @param {Event} event   The originating click event
   * @private
*/
export const _onRoll = async function (event, target) {
  event.preventDefault()

  // Top-level variables
  const actor = this.actor

  // Secondary variables
  const dataset = $(target).data()

  WOD5E.api.RollFromDataset({
    dataset,
    actor,
    data: actor.system
  })
}

/**
  * Handle rolls after the selection dialog window is closed
  * @param {Event} event   The originating click event
  * @private
*/
export const _onConfirmRoll = async function (dataset, actor) {
  // Secondary variables
  const { willpowerDamage, difficulty, disableBasicDice, quickRoll, rerollHunger, useAbsoluteValue, increaseHunger, decreaseRage } = dataset
  const title = dataset.label
  const data = dataset.itemId ? actor.items.get(dataset.itemId).system : actor.system
  const flavor = dataset.useFlavorPath ? await WOD5E.api.getFlavorDescription({ valuePath: dataset.flavorPath, data }) : dataset.flavor
  const flatMod = parseInt(dataset.flatMod) || 0
  const absoluteValue = parseInt(dataset.absoluteValue) || 0
  const selectors = dataset.selectors ? dataset.selectors.split(' ') : []
  const macro = dataset.itemId ? data.macroid : dataset.macroid
  let disableAdvancedDice = dataset.disableAdvancedDice || false

  // Add despair to the selectors if the Hunter is in despair
  if (actor.type === 'hunter' && actor.system.despair.value === 1) {
    selectors.push('despair')
  }

  // Disable advanced dice for ghouls, SPC, and group sheets
  if (['ghoul', 'group'].includes(actor.type)) {
    disableAdvancedDice = true
  }

  // Variables yet to be defined
  let basicDice, advancedDice

  // Handle getting any situational modifiers
  const activeModifiers = await getActiveModifiers({
    actor,
    selectors
  })
  const advancedCheckDice = activeModifiers.totalACDValue

  // Get the number of basicDice and advancedDice
  if (disableBasicDice && useAbsoluteValue) {
    // For when basic dice are disabled and we want the
    // advanced dice to equal the absoluteValue given
    advancedDice = absoluteValue + activeModifiers.totalValue
    basicDice = 0
  } else if (disableBasicDice) {
    // If just the basicDice are disabled, set it to 0
    // and retrieve the appropriate amount of advanced dice
    basicDice = 0
    advancedDice = disableAdvancedDice ? 0 + activeModifiers.totalValue : await WOD5E.api.getAdvancedDice(actor) + activeModifiers.totalValue
  } else {
    // Calculate basicDice based on different conditions
    if (useAbsoluteValue) {
      // If basic dice aren't disabled, but we use the absolute
      // value, add the absoluteValue and the flatMod together
      basicDice = absoluteValue + flatMod + activeModifiers.totalValue
    } else {
      // All other, more normal, circumstances where basicDice
      // are calculated normally
      basicDice = await WOD5E.api.getBasicDice({ valuePaths: dataset.valuePaths, flatMod: flatMod + activeModifiers.totalValue, actor })
    }

    // Retrieve the appropriate amount of advanced dice
    advancedDice = disableAdvancedDice ? 0 : await WOD5E.api.getAdvancedDice({ actor })
  }

  // Define the actor's gamesystem, defaulting to "mortal" if it's not in the systems list
  const system = actor.system.gamesystem

  // Some quick modifications to vampire and werewolf rolls
  // in order to properly display the dice in the dialog window
  if (!disableBasicDice) {
    if (system === 'vampire') {
      // Ensure that the number of hunger dice doesn't exceed the
      // total number of dice
      advancedDice = Math.min(basicDice, advancedDice)

      // Calculate the number of normal dice to roll by subtracting
      // the number of hunger dice from them, minimum zero
      basicDice = Math.max(basicDice - advancedDice, 0)
    } else if (system === 'werewolf') {
      // Ensure that the number of rage dice doesn't exceed the
      // total number of dice
      advancedDice = Math.min(basicDice, advancedDice)

      // Calculate the number of normal dice to roll by subtracting
      // the number of rage dice from them, minimum zero
      basicDice = Math.max(basicDice - advancedDice, 0)
    } else if (system === 'changeling') {
      // Ensure that the number of nightmare dice doesn't exceed the
      // total number of dice
      advancedDice = Math.min(basicDice, advancedDice)

      // Calculate the number of normal dice to roll by subtracting
      // the number of hunger dice from them, minimum zero
      basicDice = Math.max(basicDice - advancedDice, 0)
    }
  }

  // Send the roll to the system
  WOD5eDice.Roll({
    basicDice,
    advancedDice,
    actor,
    data: actor.system,
    title,
    disableBasicDice,
    disableAdvancedDice,
    willpowerDamage,
    difficulty,
    flavor,
    quickRoll,
    rerollHunger: dataset?.itemId && await potencyToRouse(actor.system.blood.potency, data.level) ? true : rerollHunger,
    increaseHunger,
    decreaseRage,
    selectors,
    macro,
    advancedCheckDice
  })
}
