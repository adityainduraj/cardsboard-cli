import React from "react";

interface ArrowIconProps {
    color?: string;
    size?: number;
}

export function ArrowRightIcon({ color = "#878787", size = 20 }: ArrowIconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.4688 4.375L16.0938 10L10.4688 15.625M15.3125 10H3.90625" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
