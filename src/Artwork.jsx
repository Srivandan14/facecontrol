import React, { useEffect, useRef } from 'react';
import { drawArtwork } from './artwork.js';

export function Artwork({ variant }) {
  const canvas = useRef(null);

  useEffect(() => {
    const element = canvas.current;
    const render = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * density);
      element.height = Math.round(height * density);
      const context = element.getContext('2d');
      if (!context) return;
      context.scale(density, density);
      drawArtwork(context, variant, width, height);
    };
    const observer = new ResizeObserver(render);
    observer.observe(element);
    render();
    return () => observer.disconnect();
  }, [variant]);

  return <canvas ref={canvas} aria-hidden="true" />;
}
