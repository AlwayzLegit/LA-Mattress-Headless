// Barrel export for the Shopify Storefront layer.
// Routes import from `@/lib/shopify`.

export * from './client';
export * from './types';
export { getProductByHandle }                from './queries/product';
export { getCollectionByHandle }              from './queries/collection';
export type { CollectionSort, GetCollectionArgs } from './queries/collection';
export type { ProductFilter, AvailableFilter, AvailableFilterValue } from './types';
export { getPageByHandle }                    from './queries/page';
export { getBlogByHandle, getArticleByHandle } from './queries/blog';
export { getMenu }                            from './queries/menu';
export { getAllProductHandles, getAllCollectionHandles, getAllPageHandles } from './queries/handles';
export { searchProducts, predictiveSearch } from './queries/search';
export { getProductRecommendations }          from './queries/recommendations';
export type { SearchResult, Predictive } from './queries/search';
export { cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove, getCart } from './mutations/cart';
export type { CartLineInput, UserError }     from './mutations/cart';
