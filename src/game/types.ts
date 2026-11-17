export type IngredientKind = 'onion' | 'tomato' | 'mushroom'

export interface Ingredient {
  type: 'ingredient'
  id: number
  kind: IngredientKind
  chopped: boolean
  /** Chopping progress, 0..1. */
  chop: number
}

export interface Pot {
  type: 'pot'
  id: number
  contents: IngredientKind[]
  /** Seconds cooked on a stove. */
  cook: number
}

export interface Plate {
  type: 'plate'
  id: number
  dirty: boolean
  /** Stack size. Only dirty stacks hold more than one plate. */
  count: number
  soup: IngredientKind[] | null
}

export type Item = Ingredient | Pot | Plate

export type StationKind =
  | 'counter'
  | 'crate'
  | 'board'
  | 'stove'
  | 'sink'
  | 'rack'
  | 'serve'
  | 'bin'
  | 'return'

export interface Station {
  id: number
  kind: StationKind
  tx: number
  tz: number
  /** World-space center. */
  x: number
  z: number
  /** Yaw that turns the station's front toward open floor. */
  rot: number
  item: Item | null
  crate: IngredientKind | null
  /** Sink: plates waiting to be washed. Plate return: dirty plates stacked here. */
  dirty: number
  /** Drying rack: clean plates. */
  clean: number
  /** Sink: progress on the plate being washed, 0..1. */
  wash: number
  /** Sink: id of the drying rack it fills. */
  rackId: number | null
  /** Seconds since a chef last used it. Drives small visual pops. */
  used: number
}

export interface Chef {
  id: number
  x: number
  z: number
  vx: number
  vz: number
  facing: number
  held: Item | null
  /** Station the chef is chopping or washing at. */
  working: number | null
  /** Station the chef faces and would interact with. */
  target: number | null
  dashT: number
  dashCd: number
  dashX: number
  dashZ: number
  speed: number
  moving: boolean
}

export type RecipeId = 'onion_soup' | 'tomato_soup' | 'mushroom_soup'

export interface Order {
  id: number
  recipe: RecipeId
  time: number
  total: number
}

export interface PlayerInput {
  mx: number
  mz: number
  pick: boolean
  act: boolean
  dash: boolean
}

export type Phase = 'countdown' | 'playing' | 'timeup' | 'ended'

type At = { x: number; z: number }

export type GameEvent =
  | ({ t: 'pickup' | 'drop' | 'add' | 'plate' | 'trash' | 'dash' | 'chop' | 'chopDone' | 'wash' | 'washDone' } & At)
  | ({ t: 'hint'; chef: number; text: string } & At)
  | ({ t: 'serve'; points: number; tip: number; orderId: number; recipe: RecipeId } & At)
  | ({ t: 'cookDone' | 'burnWarn' | 'burnt'; station: number } & At)
  | ({ t: 'platesBack' } & At)
  | { t: 'orderNew'; orderId: number }
  | { t: 'orderExpired'; orderId: number; recipe: RecipeId; penalty: number }
  | { t: 'countdown'; n: number }
  | { t: 'go' | 'timeUp' | 'end' }
