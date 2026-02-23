# Ultralytics Examples

This directory contains example applications demonstrating how to integrate Ultralytics analytics into your projects.

## Prerequisites

Before running any example, make sure you have:

1. An Ultralytics server running (see main README for setup)
2. A valid API key
3. Node.js 18+ installed

## Installation

All examples use the official `ultralytics` npm package:

```bash
npm install ultralytics
```

The package is available at https://www.npmjs.com/package/ultralytics

## Available Examples

### React App

A basic React application showing Ultralytics integration.

**Location:** `react-app/`

**Features demonstrated:**
- Basic project setup with Ultralytics
- Page view tracking
- Custom event tracking
- User identification

**Running the example:**

```bash
cd react-app
npm install
npm start
```

The app will be available at http://localhost:3000

### Next.js App

A Next.js 14 application using the App Router with Ultralytics integration.

**Location:** `nextjs-app/`

**Features demonstrated:**
- App Router integration
- Automatic page view tracking on navigation
- Custom event tracking
- E-commerce tracking patterns
- Client-side only initialization (SSR-safe)

**Running the example:**

```bash
cd nextjs-app
npm install
npm run dev
```

The app will be available at http://localhost:3001

## Configuration

Each example includes a configuration section where you'll need to set:

- `ULTRALYTICS_API_KEY`: Your API key from the server
- `ULTRALYTICS_ENDPOINT`: The URL of your Ultralytics server (defaults to http://localhost:3000)

## More Examples Coming Soon

We plan to add examples for:
- Vue.js
- Svelte
- Plain JavaScript
