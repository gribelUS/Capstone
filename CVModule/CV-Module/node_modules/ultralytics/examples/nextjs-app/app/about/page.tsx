import Link from 'next/link';

export default function About() {
  return (
    <main>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/products">Products</Link>
      </nav>

      <h1>About</h1>
      <p>
        This is the about page. Navigating here automatically tracks a page view
        event thanks to the integration in the root layout.
      </p>
      <p>
        The Ultralytics Next.js integration handles:
      </p>
      <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
        <li>Automatic page view tracking on route changes</li>
        <li>Client-side only initialization (no SSR issues)</li>
        <li>Dynamic imports for optimal bundle size</li>
        <li>TypeScript support out of the box</li>
      </ul>
      <p>
        Check the <Link href="/">home page</Link> to see custom event tracking in action.
      </p>
    </main>
  );
}
