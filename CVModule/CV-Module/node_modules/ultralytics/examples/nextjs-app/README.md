# Ultralytics Next.js Example

This example demonstrates how to integrate Ultralytics analytics into a Next.js 14 application using the App Router.

## Features

- Automatic page view tracking on route changes
- Custom event tracking with button clicks
- E-commerce tracking example (product views, add to cart)
- Client-side only initialization (no SSR issues)
- TypeScript support

## Prerequisites

1. A running Ultralytics server (see main README for setup)
2. A valid API key from your Ultralytics server
3. Node.js 18+ installed

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

   This will install all dependencies including the `ultralytics` package from npm.

2. Create a `.env.local` file:
   ```
   NEXT_PUBLIC_ULTRALYTICS_API_KEY=your-api-key
   NEXT_PUBLIC_ULTRALYTICS_ENDPOINT=http://localhost:3000
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) to see the example.

## How It Works

### Layout Integration

The root layout (`app/layout.tsx`) sets up Ultralytics:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function UltralyticsProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize on mount
  useEffect(() => {
    import('ultralytics').then(({ init }) => {
      init({
        apiKey: process.env.NEXT_PUBLIC_ULTRALYTICS_API_KEY,
        endpoint: process.env.NEXT_PUBLIC_ULTRALYTICS_ENDPOINT,
      });
    });
  }, []);

  // Track page views on route change
  useEffect(() => {
    import('ultralytics').then(({ trackPageView }) => {
      trackPageView({ path: pathname });
    });
  }, [pathname, searchParams]);

  return children;
}
```

### Custom Events

Track custom events from any client component:

```tsx
const handleClick = async () => {
  const { track } = await import('ultralytics');
  track('button_click', { button: 'primary' });
};
```

## Notes

- The dynamic import pattern is used to ensure Ultralytics only loads on the client side
- This avoids any SSR-related issues with window/document access
- Events are automatically batched and sent efficiently
