import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { readCart } from '@/app/_actions/cart';
import { DELIVERY_DATE_KEY } from '@/lib/cart-attributes';
import { getProductRecommendations } from '@/lib/shopify';
import type { ProductSummary } from '@/lib/shopify';
import { CartLineEditor } from './cart-line-editor';
import { DeliveryDate } from './delivery-date';
import { CartLineVariant } from './cart-line-variant';
import { CouponForm } from './coupon-form';
import { CheckoutLink } from './checkout-link';
import { TrackCartView } from './track-cart-view';
import { OrderNote } from './order-note';
import { FreeShippingBar } from './free-shipping-bar';
import { Icon } from '@/app/_components/icon';
import { RecentlyViewedRail } from '@/app/_components/recently-viewed';
import { RelatedRail } from '@/app/products/[handle]/related-rail';
import { formatMoney } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review your order — LA Mattress Store.',
  robots: { index: false, follow: false },
};

// Cart is per-user; never cache.
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await readCart();
  const lines = cart?.lines.nodes ?? [];
  const deliveryDate =
    cart?.attributes.find((a) => a.key === DELIVERY_DATE_KEY)?.value ?? null;

  if (!cart || lines.length === 0) {
    return (
      <>
        <main className="container" style={{ paddingTop: 'var(--s-9)', paddingBottom: 'var(--s-9)' }}>
          <div style={{ maxWidth: 640 }}>
            <div className="eyebrow">Cart</div>
            <h1 className="h1" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>Your cart is empty.</h1>
            <p className="muted" style={{ marginBottom: 'var(--s-5)', maxWidth: '50ch' }}>
              Browse mattresses, adjustable beds, and bedding — or come visit us in person at one of our 5 LA showrooms.
            </p>
            <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
              <Link href="/collections/mattresses" className="btn btn-primary">Shop mattresses</Link>
              <Link href="/sleep-quiz" className="btn btn-ghost">Take the sleep quiz</Link>
              <Link href="/pages/mattress-store-locations" className="btn btn-ghost">Find a store</Link>
            </div>
          </div>
        </main>
        {/* Empty-cart recovery: surface the visitor's recently-viewed
            products so the lower half of the page has shopping context
            instead of dead whitespace. Renders nothing if the visitor
            hasn't viewed any products yet. */}
        <RecentlyViewedRail heading="Pick up where you left off" eyebrow="Recently viewed" />
      </>
    );
  }

  // Cross-sell off the priciest line's product (best anchor for
  // "you may also like"). Resilient: any failure → no rail.
  const anchor = [...lines].sort(
    (a, b) => Number.parseFloat(b.cost.totalAmount.amount) - Number.parseFloat(a.cost.totalAmount.amount),
  )[0];
  const crossSell: ProductSummary[] = anchor
    ? await getProductRecommendations(anchor.merchandise.product.handle).catch(() => [] as ProductSummary[])
    : [];
  // Sum line + cart-level discount allocations for a single "Discount" row.
  const discountTotal = [
    ...cart.discountAllocations,
    ...lines.flatMap((l) => l.discountAllocations),
  ].reduce((sum, d) => sum + (Number.parseFloat(d.discountedAmount.amount) || 0), 0);
  const discountCurrency = cart.cost.totalAmount.currencyCode;

  return (
    <main className="container cart-page" style={{ paddingTop: 'var(--s-7)', paddingBottom: 'var(--s-9)' }}>
      <TrackCartView
        itemCount={cart.totalQuantity}
        cartValue={Number.parseFloat(cart.cost.totalAmount.amount) || 0}
        currency={cart.cost.totalAmount.currencyCode}
      />
      <header style={{ marginBottom: 'var(--s-6)' }}>
        <div style={{ marginBottom: 'var(--s-3)' }}>
          <Link href="/collections/mattresses" className="link-arrow muted" style={{ fontSize: 14 }}>
            <Icon name="arrow-left" size={14} /> Continue shopping
          </Link>
        </div>
        <div className="eyebrow">Cart</div>
        <h1 className="h1" style={{ margin: 'var(--s-3) 0 0' }}>
          {cart.totalQuantity} item{cart.totalQuantity === 1 ? '' : 's'}
        </h1>
      </header>

      <div className="cart-grid">
        <section>
          <ul className="cart-page-lines">
            {lines.map((line) => {
              const v = line.merchandise;
              return (
                <li key={line.id} className="cart-page-line">
                  <Link href={`/products/${v.product.handle}`} className="cart-page-line-img">
                    {v.product.featuredImage ? (
                      <Image
                        src={v.product.featuredImage.url}
                        alt={v.product.featuredImage.altText ?? v.product.title}
                        width={200}
                        height={200}
                        // Cart line items are above the fold on every
                        // cart — lazy-loading caused a visible empty
                        // slot on initial paint (QA P1-3, not a data
                        // bug). Eager removes the flash.
                        loading="eager"
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      />
                    ) : (
                      <div className="ph" style={{ width: '100%', height: '100%' }} />
                    )}
                  </Link>
                  <div className="cart-page-line-meta">
                    <Link href={`/products/${v.product.handle}`} className="cart-page-line-title">
                      {v.product.title}
                    </Link>
                    <CartLineVariant
                      lineId={line.id}
                      handle={v.product.handle}
                      quantity={line.quantity}
                      selectedOptions={v.selectedOptions}
                    />
                    <CartLineEditor
                      lineId={line.id}
                      initialQuantity={line.quantity}
                      productTitle={v.product.title}
                      saveSnapshot={{
                        handle: v.product.handle,
                        title: v.product.title,
                        vendor: null,
                        imageUrl: v.product.featuredImage?.url ?? null,
                        imageAlt: v.product.featuredImage?.altText ?? null,
                        priceAmount: line.cost.totalAmount.amount,
                        priceCurrency: line.cost.totalAmount.currencyCode,
                      }}
                    />
                  </div>
                  <div className="cart-page-line-price">
                    <span className="tnum">{formatMoney(line.cost.totalAmount)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <DeliveryDate initialDate={deliveryDate} />
        </section>

        <aside className="cart-summary">
          <div className="eyebrow">Order summary</div>
          <FreeShippingBar subtotal={cart.cost.subtotalAmount} />
          <div className="cart-summary-row" style={{ marginTop: 'var(--s-4)' }}>
            <span className="muted">Subtotal</span>
            <span className="tnum">{formatMoney(cart.cost.subtotalAmount)}</span>
          </div>
          {discountTotal > 0 ? (
            <div className="cart-summary-row cart-discount-row">
              <span>Discount</span>
              <span className="tnum">
                −{formatMoney({ amount: discountTotal.toFixed(2), currencyCode: discountCurrency })}
              </span>
            </div>
          ) : null}
          <div className="cart-summary-row" style={{ color: 'var(--accent)', fontWeight: 500 }}>
            <span><Icon name="truck" size={14} /> White-glove delivery</span>
            <span className="tnum">Free</span>
          </div>
          {cart.cost.totalTaxAmount ? (
            <div className="cart-summary-row">
              <span className="muted">Tax</span>
              <span className="tnum">{formatMoney(cart.cost.totalTaxAmount)}</span>
            </div>
          ) : null}
          <div className="cart-summary-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            <strong>Estimated total</strong>
            <strong className="tnum">{formatMoney(cart.cost.totalAmount)}</strong>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-2)' }}>
            Tax &amp; shipping calculated at checkout.
          </p>
          <CouponForm />
          <CheckoutLink
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 'var(--s-4)' }}
            checkoutUrl={cart.checkoutUrl}
            itemCount={cart.totalQuantity}
            cartValue={Number.parseFloat(cart.cost.totalAmount.amount) || 0}
            currency={cart.cost.totalAmount.currencyCode}
          >
            Checkout <Icon name="arrow-right" size={16} />
          </CheckoutLink>
          <OrderNote />
          <ul className="pdp-trust" style={{ marginTop: 'var(--s-4)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }}>
            <li><Icon name="lock" size={16} /> Secure checkout — encrypted by Shopify</li>
            <li><Icon name="shield" size={16} /> 120-night Love Your Bed exchange</li>
            <li><Icon name="truck" size={16} /> Free white-glove delivery on $499+</li>
          </ul>
        </aside>
      </div>

      {/* "You may also like" reuses the PDP cross-sell rail. railId is
          intentionally omitted: it's added by PR1 (RelatedRail scroll
          buttons) which is an independent branch. Once PR1 lands the
          cart instance gets the default rail id — collision-free since
          the cart page never co-renders the PDP rail. */}
      {crossSell.length > 0 ? (
        <RelatedRail
          products={crossSell}
          heading="You may also like"
          eyebrow="Complete your order"
        />
      ) : null}
    </main>
  );
}
