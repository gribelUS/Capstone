import React, { useEffect, useState } from 'react';
import { UltralyticsProvider, useUltralytics } from 'ultralytics/react';
import { ProductCard, TrackingButton } from './components';

// Sample product data
const SAMPLE_PRODUCTS = [
  {
    id: 'prod_001',
    name: 'Wireless Headphones',
    price: 79.99,
    category: 'Electronics',
    description: 'High-quality wireless headphones with noise cancellation.'
  },
  {
    id: 'prod_002',
    name: 'Coffee Mug',
    price: 14.99,
    category: 'Kitchen',
    description: 'Ceramic mug that keeps your coffee warm.'
  },
  {
    id: 'prod_003',
    name: 'Notebook Set',
    price: 24.99,
    category: 'Office',
    description: 'Set of 3 premium lined notebooks.'
  }
];

/**
 * Main application content with tracking examples
 */
function AppContent() {
  const { track, identify, trackPageView } = useUltralytics();
  const [userId, setUserId] = useState('');
  
  // Track page view on mount
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);
  
  const handleIdentify = () => {
    if (userId.trim()) {
      identify(userId.trim());
      track('user_identified', { userId: userId.trim() });
      alert(`User identified as: ${userId}`);
    }
  };
  
  const handleCustomEvent = () => {
    track('custom_button_clicked', {
      timestamp: new Date().toISOString(),
      source: 'demo_app'
    });
    alert('Custom event tracked!');
  };
  
  return (
    <div className="App">
      <header>
        <h1>Ultralytics React Example</h1>
        <p>
          This example demonstrates how to integrate Ultralytics analytics 
          into a React application using the useUltralytics hook.
        </p>
      </header>
      
      <main>
        <section className="demo-section">
          <h2>User Identification</h2>
          <p>Enter a user ID to identify the current user:</p>
          <div className="input-group">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
            />
            <button onClick={handleIdentify}>Identify User</button>
          </div>
        </section>
        
        <section className="demo-section">
          <h2>Custom Event Tracking</h2>
          <p>Click the button to track a custom event:</p>
          <TrackingButton
            eventName="demo_button_clicked"
            eventProperties={{ section: 'custom_events' }}
            onClick={handleCustomEvent}
          >
            Track Custom Event
          </TrackingButton>
        </section>
        
        <section className="demo-section">
          <h2>Product Tracking Example</h2>
          <p>
            These product cards automatically track views and add-to-cart events:
          </p>
          <div className="products-grid">
            {SAMPLE_PRODUCTS.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </main>
      
      <footer>
        <p>Built with React and Ultralytics v1.0.0</p>
      </footer>
    </div>
  );
}

/**
 * Root App component wrapped with UltralyticsProvider
 */
function App() {
  return (
    <UltralyticsProvider
      apiKey={process.env.REACT_APP_ULTRALYTICS_API_KEY || 'your-api-key'}
      endpoint={process.env.REACT_APP_ULTRALYTICS_ENDPOINT || 'http://localhost:3000'}
    >
      <AppContent />
    </UltralyticsProvider>
  );
}

export default App;
