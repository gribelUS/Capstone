import React, { useEffect } from 'react';
import { useUltralytics } from 'ultralytics/react';
import TrackingButton from './TrackingButton';

/**
 * A product card component that tracks product views and add-to-cart events
 */
function ProductCard({ product }) {
  const { track } = useUltralytics();
  
  // Track product view when the component mounts
  useEffect(() => {
    track('product_viewed', {
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productCategory: product.category
    });
  }, [product.id, track]);
  
  const handleAddToCart = () => {
    // Additional cart logic would go here
    console.log(`Added ${product.name} to cart`);
  };
  
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p className="price">${product.price.toFixed(2)}</p>
      <p className="description">{product.description}</p>
      <TrackingButton
        eventName="add_to_cart"
        eventProperties={{
          productId: product.id,
          productName: product.name,
          productPrice: product.price
        }}
        onClick={handleAddToCart}
      >
        Add to Cart
      </TrackingButton>
    </div>
  );
}

export default ProductCard;
