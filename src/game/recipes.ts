import type { IngredientKind, RecipeId } from './types.ts'

export interface Recipe {
  id: RecipeId
  name: string
  ingredients: IngredientKind[]
}

export const RECIPES: Record<RecipeId, Recipe> = {
  onion_soup: { id: 'onion_soup', name: '洋葱汤', ingredients: ['onion', 'onion', 'onion'] },
  tomato_soup: { id: 'tomato_soup', name: '番茄汤', ingredients: ['tomato', 'tomato', 'tomato'] },
  mushroom_soup: { id: 'mushroom_soup', name: '蘑菇汤', ingredients: ['mushroom', 'mushroom', 'mushroom'] },
}

export const INGREDIENT_NAMES: Record<IngredientKind, string> = {
  onion: '洋葱',
  tomato: '番茄',
  mushroom: '蘑菇',
}

const keyOf = (list: readonly IngredientKind[]) => [...list].sort().join(',')

/** The recipe a soup matches exactly, or null. */
export function matchRecipe(soup: readonly IngredientKind[]): RecipeId | null {
  const key = keyOf(soup)
  for (const r of Object.values(RECIPES)) if (keyOf(r.ingredients) === key) return r.id
  return null
}
