import * as React from "react";
import type { DesignSystemNodeData } from "@/types/design-system";

interface ContextPreviewCardProps {
    type: "text" | "image" | "sketch" | "design" | "section" | "designSystem";
    title: string;
    imageUrl?: string;
    designSystem?: DesignSystemNodeData;
    onRemove: () => void;
}

// Close button icon (10x10 white cross)
const CloseIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M7.5 2.5L2.50034 7.49967M7.49967 7.5L2.5 2.50035"
            stroke="white"
            strokeWidth="1.16667"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const ContextPreviewCard = React.memo(function ContextPreviewCard({
    type,
    title,
    imageUrl,
    designSystem,
    onRemove,
}: ContextPreviewCardProps) {
    const [isHovered, setIsHovered] = React.useState(false);

    // For images, calculate width from aspect ratio (height is fixed at 75px)
    const [imageWidth, setImageWidth] = React.useState(100);

    React.useEffect(() => {
        if (type === "image" && imageUrl) {
            const img = new window.Image();
            img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                setImageWidth(Math.round(75 * aspectRatio));
            };
            img.src = imageUrl;
        }
    }, [type, imageUrl]);

    const cardWidth = type === "image" ? imageWidth : 120;
    const cardHeight = 75;

    // Get the type label to display
    const getTypeLabel = (): string => {
        switch (type) {
            case "text": return "Note";
            case "image": return "Image";
            case "sketch": return "Sketch";
            case "design": return "Design";
            case "section": return "Section";
            case "designSystem": return "Design System";
            default: return "Note";
        }
    };

    // Whether to show background image (only for image type)
    const hasBackgroundImage = type === "image" && imageUrl;

    // Whether to show label and title (all except image type with imageUrl)
    const showLabelAndTitle = type !== "image" || !imageUrl;

    // Design system accent color (purple)
    const isDesignSystem = type === "designSystem";
    const accentColor = isDesignSystem ? "#A855F7" : "#ABABAB";

    return (
        <div
            style={{
                position: "relative",
                width: cardWidth,
                height: cardHeight,
                flexShrink: 0,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Card container with overflow hidden for content */}
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 8,
                    backgroundColor: isDesignSystem ? "#FAF5FF" : "#F7F7F7",
                    boxShadow: isDesignSystem ? "0 0 0 1px #E9D5FF" : "0 0 0 1px #F1EEEE",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                {/* Background image for image type */}
                {hasBackgroundImage && (
                    <img
                        src={imageUrl}
                        alt={title}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                )}

                {/* Color palette preview for design system */}
                {isDesignSystem && designSystem?.colors?.palette && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 24,
                            display: "flex",
                            gap: 1,
                        }}
                    >
                        {Object.values(designSystem.colors.palette).slice(0, 6).map((color, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    backgroundColor: color as string,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Label - shown for all types except image with background */}
                {showLabelAndTitle && (
                    <span
                        style={{
                            position: "absolute",
                            top: 4,
                            left: 8,
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: 500,
                            fontSize: 10,
                            letterSpacing: "-0.015em",
                            color: isDesignSystem ? "#A855F7" : "#C6C4C4",
                        }}
                    >
                        {getTypeLabel()}
                    </span>
                )}

                {/* Title text - shown for all types except image with background */}
                {showLabelAndTitle && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: isDesignSystem ? 28 : 6,
                            left: 8,
                            width: 100,
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: 500,
                            fontSize: 12,
                            letterSpacing: "-0.015em",
                            color: isDesignSystem ? "#7C3AED" : "#898989",
                            lineHeight: "14px",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {title || "Untitled"}
                    </div>
                )}
            </div>

            {/* Close button - positioned on corner, overflows outside */}
            <div
                style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: accentColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.15s ease",
                    zIndex: 20,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
            >
                <CloseIcon />
            </div>
        </div>
    );
});
