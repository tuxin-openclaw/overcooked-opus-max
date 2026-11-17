import type { RecipeId } from './types.ts'

export interface LevelTheme {
  floorA: string
  floorB: string
  wall: string
  wallLow: string
  counter: string
  counterDark: string
  top: string
  ground: string
}

export interface LevelDef {
  id: string
  name: string
  subtitle: string
  /**
   * Rows run from the back wall (far from camera) to the front.
   *   .  floor            1 2  chef spawn (floor)
   *   #  counter          p    counter with a clean plate
   *   O T M  crates (onion, tomato, mushroom)
   *   C  chopping board   S    stove with a pot
   *   W  sink             R    drying rack (sink puts clean plates here)
   *   D  serving hatch    P    dirty plate return
   *   X  bin
   */
  map: string[]
  recipes: RecipeId[]
  duration: number
  stars: [number, number, number]
  rackPlates: number
  orderInterval: number
  orderPatience: number
  theme: LevelTheme
}

export const LEVELS: LevelDef[] = [
  {
    id: '1-1',
    name: '1-1 洋葱小馆',
    subtitle: '开放厨房，中间有切菜岛台',
    map: [
      '##S#S#DD###',
      'O.........R',
      '#.........W',
      '#..C##C...#',
      'T.........#',
      '#.........P',
      '#.1.....2.X',
      '####p#p####',
    ],
    recipes: ['onion_soup', 'tomato_soup'],
    duration: 180,
    stars: [60, 140, 220],
    rackPlates: 1,
    orderInterval: 17,
    orderPatience: 80,
    theme: {
      floorA: '#f4e8d0',
      floorB: '#e3cfa9',
      wall: '#f7e3c3',
      wallLow: '#7fb3d5',
      counter: '#5f8fbf',
      counterDark: '#476f99',
      top: '#e2ad6e',
      ground: '#8cc56b',
    },
  },
  {
    id: '1-2',
    name: '1-2 隔墙传菜',
    subtitle: '厨房被隔开，要隔着台面传食材',
    map: [
      '##O#M##S#S##',
      'T....#.....D',
      '#....#.....D',
      'C....#.....#',
      'C....#.....R',
      '#....#.....W',
      '#.1..#..2..P',
      '##X#######X#',
    ],
    recipes: ['onion_soup', 'tomato_soup', 'mushroom_soup'],
    duration: 180,
    stars: [60, 130, 200],
    rackPlates: 3,
    orderInterval: 18,
    orderPatience: 90,
    theme: {
      floorA: '#e9f1f4',
      floorB: '#c9dbe3',
      wall: '#fbe9d6',
      wallLow: '#e28b6a',
      counter: '#7a8f9e',
      counterDark: '#5d717f',
      top: '#d9a066',
      ground: '#9acb74',
    },
  },
]
