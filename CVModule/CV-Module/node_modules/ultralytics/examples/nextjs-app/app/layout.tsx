'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Initialize Ultralytics client-side
function UltralyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('ultralytics').then(({ init, trackPageView }) => {
      init({
        apiKey: process.env.NEXT_PUBLIC_ULTRALYTICS_API_KEY || '',
        endpoint: process.env.NEXT_PUBLIC_ULTRALYTICS_ENDPOINT || 'http://localhost:3000',
        autoTrack: false, // We'll handle it manually for better control
        debug: process.env.NODE_ENV === 'development',
      });
    });
  }, []);

  // Track page views on route changes
  useEffect(() => {
    import('ultralytics').then(({ trackPageView }) => {
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      trackPageView({ path: url });
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UltralyticsProvider>{children}</UltralyticsProvider>
      </body>
    </html>
  );
}
