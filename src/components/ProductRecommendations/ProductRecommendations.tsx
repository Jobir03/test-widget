import { useState, useEffect, useRef } from "react";
import "./ProductRecommendations.css";
import { ChevronLeft, ChevronRight, Heart, Loader2 } from "lucide-react";
import type { Product } from "../../services/chat/types";
import { authService } from "../../services/chat/auth";

type ProductRecommendationsProps = {
  products: Product[];
  onProductClick?: (product: Product) => void;
  messageText?: string;
  sendHomeGeneration?: (
    homeImageUrl: string,
    productImageUrl: string,
    prompt?: string
  ) => Promise<void>;
  isTyping?: boolean;
  onGeneratingImageChange?: (isGenerating: boolean) => void;
  onScrollToBottom?: () => void;
};
// ProductRecommendations component
export function ProductRecommendations({
  products,
  onProductClick,
  sendHomeGeneration,
  isTyping = false,
  onGeneratingImageChange,
  onScrollToBottom,
}: ProductRecommendationsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [likedProducts, setLikedProducts] = useState<Set<number>>(new Set());
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingViewVisual, setIsLoadingViewVisual] = useState(false);
  const [homeImageUrl, setHomeImageUrl] = useState<string | null>(null);
  const productCardRef = useRef<HTMLDivElement>(null);

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
    return "/placeholder-image.jpg";
  };

  const handleProductRedirect = (url: string) => {
    if (!url) return;

    const iframe = document.getElementById("productFrame") as HTMLIFrameElement;
    if (iframe) {
      setIsLoadingDetails(true);

      const handleLoad = () => {
        setIsLoadingDetails(false);
        iframe.removeEventListener("load", handleLoad);
      };

      iframe.addEventListener("load", handleLoad);
      iframe.src = url;
      setTimeout(() => {
        setIsLoadingDetails(false);
        iframe.removeEventListener("load", handleLoad);
      }, 10000);
    }
  };

  // Function to fetch and update homeImageUrl
  const fetchUserData = useRef(false);
  const fetchUserDataFn = async () => {
    // Prevent multiple API calls
    if (fetchUserData.current) {
      return;
    }

    try {
      fetchUserData.current = true;
      const userData = await authService.getUser();
      if (userData?.lastImageUrl) {
        // Add base URL prefix if needed
        let imageUrl = userData.lastImageUrl;
        if (
          !imageUrl.startsWith("http://") &&
          !imageUrl.startsWith("https://")
        ) {
          imageUrl = `https://storage.googleapis.com/${imageUrl}`;
        }
        setHomeImageUrl(imageUrl);
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      fetchUserData.current = false; // Allow retry on error
      // Don't set default URL on error
    }
  };

  // Fetch user data to get lastImageUrl on component mount (only once)
  useEffect(() => {
    fetchUserDataFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Refresh homeImageUrl when image is uploaded
  useEffect(() => {
    // Listen for image upload events via window event
    const handleImageUpload = () => {
      // Reset ref to allow fetching again after image upload
      fetchUserData.current = false;
      fetchUserDataFn();
    };

    // Store the handler on window object
    interface WindowWithHandler extends Window {
      __fcwImageUploadHandler?: () => void;
    }
    (window as WindowWithHandler).__fcwImageUploadHandler = handleImageUpload;

    return () => {
      delete (window as WindowWithHandler).__fcwImageUploadHandler;
    };
  }, []);

  const handleViewVisual = async () => {
    if (!currentProduct || !sendHomeGeneration) return;

    // Use lastImageUrl from user data, return early if not available
    if (!homeImageUrl) {
      console.warn("Home image URL not available");
      return;
    }

    const finalHomeImageUrl = homeImageUrl;

    // Productning birinchi rasmini olish
    let productImageUrl = "";
    if (currentProduct.images && currentProduct.images.length > 0) {
      const firstImage = currentProduct.images[0];
      const imageUrl = firstImage.originalUrl || firstImage.thumbnailUrl;
      if (imageUrl) {
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
          productImageUrl = imageUrl;
        } else {
          productImageUrl = `https://storage.googleapis.com${imageUrl}`;
        }
      }
    } else if (
      currentProduct.image_urls &&
      currentProduct.image_urls.length > 0
    ) {
      const imageUrl = currentProduct.image_urls[0];
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        productImageUrl = imageUrl;
      } else {
        productImageUrl = `https://storage.googleapis.com${imageUrl}`;
      }
    }

    if (!productImageUrl) {
      console.warn("Product image not found");
      return;
    }

    try {
      setIsLoadingViewVisual(true);
      onGeneratingImageChange?.(true);

      // Scroll qilish - messages container'ning eng pastiga scroll qilinadi
      setTimeout(() => {
        onScrollToBottom?.();
      }, 200);

      await sendHomeGeneration(finalHomeImageUrl, productImageUrl, "");
      // Loading state typing animation to'xtaguncha saqlanadi
    } catch (error) {
      console.error("Failed to send home generation:", error);
      setIsLoadingViewVisual(false);
      onGeneratingImageChange?.(false);
    }
  };

  // Typing to'xtaganda (message kelganda) loading state'ni to'xtatish
  useEffect(() => {
    if (!isTyping && isLoadingViewVisual) {
      setIsLoadingViewVisual(false);
      onGeneratingImageChange?.(false);
    }
  }, [isTyping, isLoadingViewVisual, onGeneratingImageChange]);

  useEffect(() => {
    return () => {
      const iframe = document.getElementById(
        "productFrame"
      ) as HTMLIFrameElement;
      if (iframe) {
        iframe.removeEventListener("load", () => setIsLoadingDetails(false));
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
            ref={productCardRef}
            className="product-card"
            // onClick={() => handleProductRedirect(currentProduct.product_url)}
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
                  <div className="fcw-product-title-row">
                    <h4 className="fcw-product-name">{currentProduct.name}</h4>
                    {currentProduct.sku && (
                      <span className="fcw-product-sku">
                        SKU: {currentProduct.sku}
                      </span>
                    )}
                  </div>
                  {currentProduct.description && (
                    <p className="fcw-product-description">
                      {currentProduct.description}
                    </p>
                  )}
                  <div className="fcw-product-specs">
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
                    disabled={isLoadingDetails || isLoadingViewVisual}
                  >
                    {isLoadingDetails ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        Loading...
                      </>
                    ) : (
                      "Details"
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewVisual();
                    }}
                    className="view-visual-button"
                    disabled={isLoadingDetails || isLoadingViewVisual}
                  >
                    {isLoadingViewVisual ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        Loading...
                      </>
                    ) : (
                      "View Visual"
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
