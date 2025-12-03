import React, { useState } from "react";
import { X } from "lucide-react";
import "./ImageMessage.css";

interface ImageMessageProps {
  images: string[];
  onScrollToBottom?: () => void;
}

const ImageMessage: React.FC<ImageMessageProps> = ({
  images,
  onScrollToBottom,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  return (
    <>
      <div
        style={{
          marginTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            loading="lazy"
            referrerPolicy="no-referrer"
            alt={`Attachment ${idx + 1}`}
            style={{
              maxWidth: "100%",
              maxHeight: "200px",
              borderRadius: "8px",
              objectFit: "cover",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onClick={() => handleImageClick(img)}
            onLoad={() => {
              // Scroll to bottom after image is fully loaded
              if (onScrollToBottom && idx === images.length - 1) {
                setTimeout(() => {
                  onScrollToBottom();
                }, 50);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          />
        ))}
      </div>

      {selectedImage && (
        <div
          className="fcw-image-modal-overlay"
          onClick={handleModalBackdropClick}
        >
          <div className="fcw-image-modal-content">
            <button
              className="fcw-image-modal-close"
              onClick={handleCloseModal}
              aria-label="Close modal"
              title="Close"
            >
              <X size={24} />
            </button>
            <img
              src={selectedImage}
              alt="Full size"
              className="fcw-image-modal-image"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ImageMessage;

