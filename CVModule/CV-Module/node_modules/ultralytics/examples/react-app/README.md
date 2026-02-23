# Ultralytics React Example

This example application demonstrates how to integrate Ultralytics analytics into a React application.

## Features Demonstrated

- **Page View Tracking**: Automatic page view tracking on component mount
- **User Identification**: Identify users to associate events with user profiles
- **Custom Event Tracking**: Track custom events with arbitrary properties
- **E-commerce Tracking**: Track product views and add-to-cart events

## Prerequisites

1. A running Ultralytics server
2. A valid API key from your Ultralytics server
3. Node.js 18+ installed

## Setup

1. Install dependencies:

```bash
npm install
```

This will install all dependencies including the `ultralytics` package from npm.

2. Configure your environment:

Create a `.env.local` file in this directory:

```
REACT_APP_ULTRALYTICS_API_KEY=your-api-key-here
REACT_APP_ULTRALYTICS_ENDPOINT=http://localhost:3000
```

3. Start the development server:

```bash
npm start
```

4. Open http://localhost:3000 in your browser.

## Usage Examples

### Basic Event Tracking

```jsx
import { useUltralytics } from 'ultralytics/react';

function MyComponent() {
  const { track } = useUltralytics();
  
  const handleClick = () => {
    track('button_clicked', {
      buttonName: 'signup',
      location: 'header'
    });
  };
  
  return <button onClick={handleClick}>Sign Up</button>;
}
```

### User Identification

```jsx
const { identify } = useUltralytics();

// After user logs in
identify('user-123');
```

### Page View Tracking

```jsx
import { useEffect } from 'react';
import { useUltralytics } from 'ultralytics/react';

function Page() {
  const { trackPageView } = useUltralytics();
  
  useEffect(() => {
    trackPageView();
  }, []);
  
  return <div>Page content</div>;
}
```

## Components

### TrackingButton

A button component that automatically tracks click events:

```jsx
import { TrackingButton } from './components';

<TrackingButton
  eventName="cta_clicked"
  eventProperties={{ variant: 'primary' }}
>
  Click Me
</TrackingButton>
```

### ProductCard

A product card that tracks product views and add-to-cart events:

```jsx
import { ProductCard } from './components';

<ProductCard
  product={{
    id: 'prod_001',
    name: 'Product Name',
    price: 29.99,
    category: 'Category',
    description: 'Product description'
  }}
/>
```

## Project Structure

```
src/
├── App.js              # Main application with Ultralytics setup
├── index.js            # React entry point
└── components/
    ├── index.js        # Component exports
    ├── TrackingButton.js
    └── ProductCard.js
```
