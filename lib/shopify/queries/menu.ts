import { shopifyFetch } from '../client';
import type { Menu } from '../types';

/**
 * Storefront API menu query. Note Shopify's menu type only nests `items`
 * one level deep by default; for deeper menus you'd query each level
 * explicitly. The LA Mattress nav is 1-level deep so this is sufficient.
 */
const GET_MENU = /* GraphQL */ `
  query GetMenu($handle: String!) {
    menu(handle: $handle) {
      id
      handle
      title
      items {
        id title url type
        items { id title url type }
      }
    }
  }
`;

export async function getMenu(handle: string): Promise<Menu | null> {
  const data = await shopifyFetch<{ menu: Menu | null }, { handle: string }>(
    GET_MENU,
    { handle },
    { tags: [`menu:${handle}`] },
  );
  return data.menu ?? null;
}
