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
export { searchProducts, searchArticles, predictiveSearch } from './queries/search';
export { getProductRecommendations }          from './queries/recommendations';
export { getQuizPicks }                       from './queries/quiz-picks';
export { getShopBrand }                       from './queries/shop';
export type { ShopBrand }                     from './queries/shop';
export { getActiveAnnouncement }              from './queries/announcement';
export type { Announcement, AnnouncementStyle } from './queries/announcement';
export { getHeroSlides }                      from './queries/hero-slides';
export type { HeroSlideData }                 from './queries/hero-slides';
export { getBrands }                          from './queries/brands';
export { getShowrooms }                       from './queries/showrooms';
export { getSiteConfig }                      from './queries/site-config';
export type { LiveSiteConfig }                from './queries/site-config';
export { getWhyUsItems, getFeaturedGuides, getTrustItems, getCategoryTiles } from './queries/homepage-sections';
export type { WhyUsItem, FeaturedGuide, TrustItem, CategoryTile } from './queries/homepage-sections';
export type { Brand }                         from './queries/brands';
export type { SearchResult, Predictive, PredictiveArticle, ArticleSearchResult } from './queries/search';
export { cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove, cartDiscountCodesUpdate, cartNoteUpdate, cartAttributesUpdate, getCart } from './mutations/cart';
export type { CartLineInput, UserError }     from './mutations/cart';
