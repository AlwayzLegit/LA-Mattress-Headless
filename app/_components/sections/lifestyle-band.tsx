import Link from 'next/link';
import Image from 'next/image';
import { imgUrl } from '../images';

/**
 * Full-bleed lifestyle band (#13). Breaks up the text-dense middle of the
 * homepage with a single strong image + a short headline and one CTA —
 * the pattern competitor mattress homepages use to add visual rhythm
 * between content sections. Placed between <WhyUs /> and <WaysToFindMatch />.
 * The image is decorative (alt=""); the copy carries the message.
 */
export function LifestyleBand() {
  return (
    <section className="lifestyle-band">
      <div className="lifestyle-band-media">
        <Image
          src={imgUrl('lifestyle-lie-down')}
          alt="A couple lying on a mattress while an LA Mattress Store consultant helps them choose, inside a Los Angeles showroom"
          fill
          sizes="100vw"
          quality={70}
          style={{ objectFit: 'cover', objectPosition: 'center 28%' }}
        />
      </div>
      <div className="container">
        <div className="lifestyle-band-copy">
          <div className="eyebrow">Five LA showrooms</div>
          <h2 className="h2">Lie down before you buy.</h2>
          <p>
            Test every brand on the floor with zero pressure, then take it home with free same-day
            white-glove delivery across Los Angeles, and 120 nights to be sure.
          </p>
          <Link href="/pages/mattress-store-locations" className="btn btn-lg btn-on-dark">
            Find your showroom
          </Link>
        </div>
      </div>
    </section>
  );
}
