import React, { useEffect, useRef } from 'react';

const HeroCanvasBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const images = [
    "https://res.cloudinary.com/dapvuniyx/image/upload/v1762062681/banner4_tal8h5.png",
    "https://res.cloudinary.com/dapvuniyx/image/upload/v1762063361/banner5_xnmkix.png",
    "https://res.cloudinary.com/dapvuniyx/image/upload/v1762063361/banner6_cr1oxy.png"
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let imageObjects = [];
    let currentImageIndex = 0;
    let nextImageIndex = 1;
    let transitionProgress = 0;
    let isTransitioning = false;
    let lastSwitchTime = 0;
    const SLIDE_INTERVAL = 5000; // 5s
    const TRANSITION_DURATION = 1500; // 1.5s

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const loadImages = async () => {
      const promises = images.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          })
      );
      imageObjects = (await Promise.all(promises)).filter(Boolean);
    };

    const drawImage = (img, offsetX = 0, offsetY = 0, opacity = 1) => {
      if (!img) return;
      ctx.save();
      ctx.globalAlpha = opacity;

      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.width / img.height;

      let drawWidth, drawHeight, drawX, drawY;
      if (canvasRatio > imgRatio) {
        drawHeight = canvas.width / imgRatio;
        drawWidth = canvas.width;
        drawX = offsetX;
        drawY = (canvas.height - drawHeight) / 2 + offsetY;
      } else {
        drawWidth = canvas.height * imgRatio;
        drawHeight = canvas.height;
        drawX = (canvas.width - drawWidth) / 2 + offsetX;
        drawY = offsetY;
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    };

    const easeInOut = (t) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const animate = (timestamp) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (imageObjects.length === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = timestamp - lastSwitchTime;

      if (!isTransitioning && elapsed >= SLIDE_INTERVAL) {
        isTransitioning = true;
        transitionProgress = 0;
        nextImageIndex = (currentImageIndex + 1) % imageObjects.length;
        lastSwitchTime = timestamp; // reset time here
      }

      if (isTransitioning) {
        transitionProgress += 16 / TRANSITION_DURATION; // smooth
        const eased = easeInOut(Math.min(transitionProgress, 1));

        const offset = canvas.width * eased;
        const currentImg = imageObjects[currentImageIndex];
        const nextImg = imageObjects[nextImageIndex];

        // Slide effect
        drawImage(currentImg, -offset, 0, 1);
        drawImage(nextImg, canvas.width - offset, 0, 1);

        if (transitionProgress >= 1) {
          isTransitioning = false;
          currentImageIndex = nextImageIndex;
        }
      } else {
        // subtle parallax when idle
        const parallaxX = Math.sin(timestamp * 0.0003) * 8;
        const parallaxY = Math.cos(timestamp * 0.0002) * 4;
        drawImage(imageObjects[currentImageIndex], parallaxX, parallaxY, 1);
      }

      // gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(255,255,255,0.08)");
      gradient.addColorStop(0.5, "rgba(0,176,149,0.06)");
      gradient.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationRef.current = requestAnimationFrame(animate);
    };

    const init = async () => {
      resizeCanvas();
      await loadImages();
      requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas);
    init();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero-canvas-background"
    />
  );
};

export default HeroCanvasBackground;
