/** Tuning values. Units: tiles (1 tile = 1 world unit) and seconds. */
export const CFG = {
  chefRadius: 0.32,
  chefSpeed: 4.4,
  /** How fast velocity follows the stick (higher = snappier). */
  chefResponse: 16,
  turnRate: 18,
  dashSpeed: 10.5,
  dashTime: 0.15,
  dashCooldown: 0.5,
  /** Max gap between a chef's body and a counter it can use. */
  reach: 0.45,

  chopTime: 1.8,
  chopsPerIngredient: 5,
  washTime: 2,
  cookPerIngredient: 4,
  /** Seconds after a soup is done until it burns. */
  burnAfter: 12,
  /** The last seconds before burning, when the pot flashes and beeps. */
  burnWarn: 5,
  potCapacity: 3,
  plateReturnDelay: 6,

  maxOrders: 4,
  basePoints: 20,
  maxTip: 8,
  expirePenalty: 10,

  countdown: 3,
  timeUpHold: 2.5,
  /** Biggest simulated step. Longer frames are split. */
  maxStep: 1 / 30,
} as const

export const COUNTER_TOP = 0.92
