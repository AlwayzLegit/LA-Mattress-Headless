import { shopifyFetch } from '../client';
import type { Cart, CartLine } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, VARIANT_FRAGMENT } from '../queries/fragments';

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { ...MoneyFields }
      totalAmount { ...MoneyFields }
      totalTaxAmount { ...MoneyFields }
      totalDutyAmount { ...MoneyFields }
    }
    buyerIdentity { email phone countryCode }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost {
          totalAmount { ...MoneyFields }
          subtotalAmount { ...MoneyFields }
        }
        merchandise {
          ... on ProductVariant {
            ...VariantFields
            product {
              handle
              title
              featuredImage { ...ImageFields }
            }
          }
        }
      }
    }
  }
`;

const FRAGS = `${IMAGE_FRAGMENT}\n${MONEY_FRAGMENT}\n${VARIANT_FRAGMENT}\n${CART_FRAGMENT}`;

const CART_CREATE = /* GraphQL */ `
  ${FRAGS}
  mutation CartCreate($input: CartInput) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
`;

const CART_LINES_ADD = /* GraphQL */ `
  ${FRAGS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
`;

const CART_LINES_UPDATE = /* GraphQL */ `
  ${FRAGS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
`;

const CART_LINES_REMOVE = /* GraphQL */ `
  ${FRAGS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
`;

const GET_CART = /* GraphQL */ `
  ${FRAGS}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) { ...CartFields }
  }
`;

export type CartLineInput = {
  merchandiseId: string;
  quantity: number;
  attributes?: { key: string; value: string }[];
};

export type UserError = { field: string[] | null; message: string; code: string | null };

type RawCart = Omit<Cart, 'lines'> & { lines: { nodes: CartLine[] } };

function unwrap<K extends string>(payload: Record<K, { cart: RawCart | null; userErrors: UserError[] }>, key: K): Cart {
  const out = payload[key];
  if (out.userErrors?.length) {
    throw new Error(`Cart mutation failed: ${out.userErrors.map((e) => e.message).join('; ')}`);
  }
  if (!out.cart) throw new Error('Cart mutation returned no cart');
  return out.cart as unknown as Cart;
}

export async function cartCreate(lines: CartLineInput[] = []): Promise<Cart> {
  const data = await shopifyFetch<{ cartCreate: { cart: RawCart | null; userErrors: UserError[] } }>(
    CART_CREATE,
    { input: lines.length ? { lines } : null },
    { cache: 'no-store' },
  );
  return unwrap(data, 'cartCreate');
}

export async function cartLinesAdd(cartId: string, lines: CartLineInput[]): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesAdd: { cart: RawCart | null; userErrors: UserError[] } }>(
    CART_LINES_ADD,
    { cartId, lines },
    { cache: 'no-store' },
  );
  return unwrap(data, 'cartLinesAdd');
}

export async function cartLinesUpdate(
  cartId: string,
  lines: { id: string; quantity: number; merchandiseId?: string }[],
): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: RawCart | null; userErrors: UserError[] } }>(
    CART_LINES_UPDATE,
    { cartId, lines },
    { cache: 'no-store' },
  );
  return unwrap(data, 'cartLinesUpdate');
}

export async function cartLinesRemove(cartId: string, lineIds: string[]): Promise<Cart> {
  const data = await shopifyFetch<{ cartLinesRemove: { cart: RawCart | null; userErrors: UserError[] } }>(
    CART_LINES_REMOVE,
    { cartId, lineIds },
    { cache: 'no-store' },
  );
  return unwrap(data, 'cartLinesRemove');
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const data = await shopifyFetch<{ cart: RawCart | null }>(GET_CART, { cartId }, { cache: 'no-store' });
  return (data.cart as unknown as Cart) ?? null;
}
