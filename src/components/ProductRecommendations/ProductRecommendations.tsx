import { useState } from "react";
import "./ProductRecommendations.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "../../services/chat/types";

type ProductRecommendationsProps = {
  products: Product[];
  onProductClick?: (product: Product) => void;
};

export function ProductRecommendations({
  products,
  onProductClick,
}: ProductRecommendationsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const totalProducts = products?.length || 0;

  const handleNext = () => {
    if (currentIndex < totalProducts - 1) {
      setDirection("next");
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection("prev");
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const currentProduct = products[currentIndex];
  const showPrev = currentIndex > 0;
  const showNext = currentIndex < totalProducts - 1;

  if (!currentProduct) return null;

  return (
    <div className="carousel-wrapper">
      <div className="carousel-viewport">
        <div
          key={currentIndex}
          className={`product-grid ${
            direction === "next" ? "slide-next" : "slide-prev"
          }`}
        >
          <div
            className="product-card"
            onClick={() => onProductClick?.(currentProduct)}
          >
            <div className="product-content">
              <div className="product-image-container">
                <img
                  src={
                    currentProduct?.image_urls?.[0]
                      ? `https://storage.googleapis.com${currentProduct.image_urls[0]}`
                      : "/placeholder-image.jpg"
                  }
                  alt={currentProduct?.name}
                  className="product-image"
                />
              </div>
              <div className="product-info">
                <div className="fcw-product-details">
                  <h4>{currentProduct.name}</h4>
                  <p className="fcw-product-description">
                    {currentProduct.description}
                  </p>
                  <div className="fcw-product-specs">
                    {currentProduct.sku && (
                      <span>SKU: {currentProduct.sku}</span>
                    )}
                    {currentProduct.dimensions?.width && (
                      <span>Width: {currentProduct.dimensions.width}</span>
                    )}
                    {currentProduct.dimensions?.height && (
                      <span>Height: {currentProduct.dimensions.height}</span>
                    )}
                    {currentProduct.color && (
                      <span>Color: {currentProduct.color}</span>
                    )}
                    {currentProduct.material && (
                      <span>Material: {currentProduct.material}</span>
                    )}
                  </div>
                </div>
                <div className="product-footer">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick?.(currentProduct);
                    }}
                    className="details-button"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="carousel-controls">
          <button
            onClick={handlePrev}
            className={`carousel-control-btn ${!showPrev ? "disabled" : ""}`}
            disabled={!showPrev}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span className="page-indicator">
            {currentIndex + 1} / {totalProducts}
          </span>

          <button
            onClick={handleNext}
            className={`carousel-control-btn ${!showNext ? "disabled" : ""}`}
            disabled={!showNext}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
