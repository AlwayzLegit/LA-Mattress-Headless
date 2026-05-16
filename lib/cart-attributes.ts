// Shared cart-attribute keys. Kept in a plain module (NOT the
// 'use server' action file, which may only export async functions)
// so both the server action and the cart page can import it.
//
// Surfaces on the Shopify order as a note attribute, visible to the
// fulfilment team in Admin → Orders. Keep the key human-readable.
export const DELIVERY_DATE_KEY = 'Requested delivery date';
