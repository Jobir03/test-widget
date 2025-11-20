import { useState, useEffect } from "react";
import "./ProductRecommendations.css";
import { ChevronLeft, ChevronRight, Heart, Loader2 } from "lucide-react";
import type { Product } from "../../services/chat/types";

type ProductRecommendationsProps = {
  products: Product[];
  onProductClick?: (product: Product) => void;
};
// ProductRecommendations component
export function ProductRecommendations({
  products,
  onProductClick,
}: ProductRecommendationsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [likedProducts, setLikedProducts] = useState<Set<number>>(new Set());
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  const totalProducts = products?.length || 0;

  console.log(onProductClick);
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
  const isLiked = currentProduct ? likedProducts.has(currentProduct.id) : false;

  const toggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentProduct) return;

    setLikedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentProduct.id)) {
        newSet.delete(currentProduct.id);
      } else {
        newSet.add(currentProduct.id);
      }
      return newSet;
    });
  };

  const getImageUrl = (product: Product | undefined): string => {
    if (!product) return "/placeholder-image.jpg";

    // Check if product has images array (object format)
    if (product.images && product.images.length > 0) {
      const firstImage = product.images[0];
      const imageUrl = firstImage.originalUrl || firstImage.thumbnailUrl;
      if (imageUrl) {
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
          return imageUrl;
        }
        return `https://storage.googleapis.com${imageUrl}`;
      }
    }

    // Fallback to image_urls array (string format)
    if (product.image_urls && product.image_urls.length > 0) {
      const imageUrl = product.image_urls[0];
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        return imageUrl;
      }
      return `https://storage.googleapis.com${imageUrl}`;
    }

    return "/placeholder-image.jpg";
  };

  const handleProductRedirect = (url: string) => {
    if (!url) return;

    const iframe = document.getElementById("productFrame") as HTMLIFrameElement;
    if (iframe) {
      setIsLoadingProduct(true);

      // Remove previous load listener if exists
      const handleLoad = () => {
        setIsLoadingProduct(false);
        iframe.removeEventListener("load", handleLoad);
      };

      iframe.addEventListener("load", handleLoad);
      iframe.src = url;

      // Fallback: if iframe doesn't load within 10 seconds, hide loader
      setTimeout(() => {
        setIsLoadingProduct(false);
        iframe.removeEventListener("load", handleLoad);
      }, 10000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const iframe = document.getElementById(
        "productFrame"
      ) as HTMLIFrameElement;
      if (iframe) {
        iframe.removeEventListener("load", () => setIsLoadingProduct(false));
      }
    };
  }, []);

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
            onClick={() => handleProductRedirect(currentProduct.product_url)}
            // onClick={(e) => {
            //   if (currentProduct?.product_url) {
            //     e.preventDefault();
            //     e.stopPropagation();
            //     window.location.replace(currentProduct.product_url);
            //   } else {
            //     onProductClick?.(currentProduct);
            //   }
            // }}
          >
            <div className="product-content">
              <div className="product-image-container">
                <img
                  src={getImageUrl(currentProduct)}
                  alt={currentProduct?.name}
                  className="product-image"
                />
                <button
                  onClick={toggleLike}
                  className={`product-like-button ${isLiked ? "liked" : ""}`}
                  aria-label={
                    isLiked ? "Remove from favorites" : "Add to favorites"
                  }
                >
                  <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                </button>
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
                      handleProductRedirect(currentProduct.product_url);
                    }}
                    className="details-button"
                    disabled={isLoadingProduct}
                  >
                    {isLoadingProduct ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        Loading...
                      </>
                    ) : (
                      "Details"
                    )}
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
