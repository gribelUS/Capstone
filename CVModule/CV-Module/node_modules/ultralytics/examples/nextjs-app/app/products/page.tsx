'use client';

import Link from 'next/link';

const products = [
  { id: 1, name: 'Basic Plan', price: 9.99 },
  { id: 2, name: 'Pro Plan', price: 29.99 },
  { id: 3, name: 'Enterprise', price: 99.99 },
];

export default function Products() {
  const handleProductView = async (product: typeof products[0]) => {
    const { track } = await import('ultralytics');
    track('product_viewed', {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
    });
  };

  const handleAddToCart = async (product: typeof products[0]) => {
    const { track } = await import('ultralytics');
    track('add_to_cart', {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
    });
    alert(`Added ${product.name} to cart!`);
  };

  return (
    <main>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/products">Products</Link>
      </nav>

      <h1>Products</h1>
      <p>View our available plans. Each interaction is tracked!</p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {products.map(product => (
          <div
            key={product.id}
            style={{
              border: '1px solid #ddd',
              padding: '1rem',
              borderRadius: '8px',
            }}
            onMouseEnter={() => handleProductView(product)}
          >
            <h3>{product.name}</h3>
            <p>${product.price}/month</p>
            <button onClick={() => handleAddToCart(product)}>
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
