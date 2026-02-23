'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [events, setEvents] = useState<string[]>([]);

  const trackEvent = async (eventName: string, properties?: Record<string, any>) => {
    const { track } = await import('ultralytics');
    track(eventName, properties);
    setEvents(prev => [...prev, `${new Date().toISOString()} - ${eventName}`]);
  };

  return (
    <main>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/products">Products</Link>
      </nav>

      <h1>Ultralytics Next.js Example</h1>
      <p>
        This example demonstrates how to integrate Ultralytics analytics into a Next.js 14
        application using the App Router.
      </p>

      <h2>Track Custom Events</h2>
      <p>Click these buttons to send custom events:</p>

      <div>
        <button onClick={() => trackEvent('button_click', { button: 'primary' })}>
          Primary Button
        </button>
        <button onClick={() => trackEvent('button_click', { button: 'secondary' })}>
          Secondary Button
        </button>
        <button onClick={() => trackEvent('signup_started')}>
          Sign Up
        </button>
        <button onClick={() => trackEvent('purchase_initiated', { value: 99.99 })}>
          Purchase ($99.99)
        </button>
      </div>

      <div className="events-log">
        <h3>Tracked Events</h3>
        <ul>
          {events.map((event, index) => (
            <li key={index}>{event}</li>
          ))}
        </ul>
        {events.length === 0 && <p>No events tracked yet. Click a button above!</p>}
      </div>
    </main>
  );
}
