import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { readCart } from '@/app/_actions/cart';
import { CartLineEditor } from './cart-line-editor';
import { Icon } from '@/app/_components/icon';
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

  if (!cart || lines.length === 0) {
    return (
      <main className="container" style={{ padding: 'var(--s-9) 0' }}>
        <div style={{ maxWidth: 640 }}>
          <div className="eyebrow">Cart</div>
          <h1 className="h1" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>Your cart is empty.</h1>
          <p className="muted" style={{ marginBottom: 'var(--s-5)', maxWidth: '50ch' }}>
            Browse mattresses, adjustable beds, and bedding — or come visit us in person at one of our 5 LA showrooms.
          </p>
          <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
            <Link href="/collections/mattresses" className="btn btn-primary">Shop mattresses</Link>
            <Link href="/pages/mattress-store-locations" className="btn btn-ghost">Find a store</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container cart-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
      <header style={{ marginBottom: 'var(--s-6)' }}>
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
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      />
                    ) : (
                      <div className="ph" style={{ width: '100%', height: '100%' }} />
                    )}
                  </Link>
                  <div className="cart-page-line-meta">
                    <Link href={`/products/${v.product.handle}`} className="cart-page-line-title">
                      <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
                        {v.selectedOptions.find((o) => o.name === 'Size')?.value ?? v.title}
                      </span>
                      {v.product.title}
                    </Link>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {v.selectedOptions.map((o) => `${o.name}: ${o.value}`).join(' · ')}
                    </div>
                    <CartLineEditor lineId={line.id} initialQuantity={line.quantity} />
                  </div>
                  <div className="cart-page-line-price">
                    <span className="tnum">{formatMoney(line.cost.totalAmount)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="cart-summary">
          <div className="eyebrow">Order summary</div>
          <div className="cart-summary-row" style={{ marginTop: 'var(--s-4)' }}>
            <span className="muted">Subtotal</span>
            <span className="tnum">{formatMoney(cart.cost.subtotalAmount)}</span>
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
          <a className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--s-4)' }} href={cart.checkoutUrl}>
            Checkout <Icon name="arrow-right" size={16} />
          </a>
          <ul className="pdp-trust" style={{ marginTop: 'var(--s-4)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }}>
            <li><Icon name="lock" size={16} /> Secure checkout on checkout.mattressstoreslosangeles.com</li>
            <li><Icon name="truck" size={16} /> Free white glove delivery</li>
            <li><Icon name="shield" size={16} /> 120-night comfort exchange</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
