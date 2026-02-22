import React, { useEffect, useRef } from 'react';
import styles from './CursorGlow.module.css';

const CursorGlow = () => {
    const glowRef = useRef(null);
    const trailRef = useRef(null);
    const pos = useRef({ x: 0, y: 0 });
    const target = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            target.current = { x: e.clientX, y: e.clientY };
        };

        let animationId;
        const animate = () => {
            // Smooth lerp follow
            pos.current.x += (target.current.x - pos.current.x) * 0.15;
            pos.current.y += (target.current.y - pos.current.y) * 0.15;

            if (glowRef.current) {
                glowRef.current.style.transform = `translate(${target.current.x}px, ${target.current.y}px)`;
            }
            if (trailRef.current) {
                trailRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
            }

            animationId = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        animationId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationId);
        };
    }, []);

    // Don't show on touch devices
    if ('ontouchstart' in window) return null;

    return (
        <>
            <div ref={glowRef} className={styles.glow} />
            <div ref={trailRef} className={styles.trail} />
        </>
    );
};

export default CursorGlow;
