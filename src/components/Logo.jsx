
import React from 'react';

export default function Logo({ size = 180, isMobile = false }) {
    const finalSize = isMobile ? (size * 0.66) : size;
    
    return (
        <svg width={finalSize} height={finalSize} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="sonanceGradV2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f2ff" />
                    <stop offset="45%" stopColor="#7000ff" />
                    <stop offset="100%" stopColor="#ff00c8" />
                </linearGradient>
                <filter id="neonGlowV2" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feFlood floodColor="#7000ff" floodOpacity="0.6" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <path d="M 10 50 Q 25 20, 40 50 T 70 50 T 90 50" stroke="#7000ff" strokeWidth="1" fill="none" opacity="0.2" />

            <path d="M 30 35 C 30 15, 70 15, 70 35 C 70 55, 30 45, 30 65 C 30 85, 70 85, 70 65"
                stroke="url(#sonanceGradV2)" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.1" />

            <path d="M 30 35 C 30 15, 70 15, 70 35 C 70 55, 30 45, 30 65 C 30 85, 70 85, 70 65"
                stroke="url(#sonanceGradV2)" strokeWidth="8" strokeLinecap="round" fill="none" filter="url(#neonGlowV2)" />

            <path d="M 70 50 L 75 50 L 78 30 L 82 70 L 85 40 L 88 60 L 92 50"
                stroke="#00f2ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

            <circle cx="30" cy="35" r="4" fill="#00f2ff" filter="url(#neonGlowV2)" />
            <circle cx="70" cy="65" r="4" fill="#ff00c8" filter="url(#neonGlowV2)" />
        </svg>
    );
}
