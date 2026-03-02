import React, { useEffect, useRef, useState } from 'react';
import styles from './CursorGlow.module.css';

const CursorGlow = () => {
    const glowRef = useRef(null);
    const pos = useRef({ x: 0, y: 0 });
    const target = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            target.current = { x: e.clientX, y: e.clientY };
            if (!isVisible) setIsVisible(true);
        };

        const handleMouseLeave = () => setIsVisible(false);
        const handleMouseEnter = () => setIsVisible(true);

        let animationId;
        const animate = () => {
            // Smooth lerp — glow lags slightly behind for a natural trail feel
            pos.current.x += (target.current.x - pos.current.x) * 0.08;
            pos.current.y += (target.current.y - pos.current.y) * 0.08;

            if (glowRef.current) {
                glowRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
            }

            animationId = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);
        animationId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mouseenter', handleMouseEnter);
            cancelAnimationFrame(animationId);
        };
    }, [isVisible]);

    // Don't show on touch devices
    if ('ontouchstart' in window) return null;

    return (
        <div
            ref={glowRef}
            className={`${styles.glow} ${isVisible ? styles.glowVisible : ''}`}
        />
    );
};

export default CursorGlow;
