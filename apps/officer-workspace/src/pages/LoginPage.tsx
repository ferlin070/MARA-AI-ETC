import { useState } from 'react';
import { BrandPanel } from '../components/LoginPage/BrandPanel';
import { LoginCard } from '../components/LoginPage/LoginCard';
import styles from '../components/LoginPage/LoginPage.module.css';

/**
 * Route-facing login page (/login). Lives here — not re-exported from
 * a same-named component module — so a stray `LoginPage` symbol can never
 * shadow this one in imports again. BrandPanel/LoginCard stay presentational
 * under components/LoginPage/.
 */
export function LoginPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  const dismissSplash = () => {
    setSplashFading(true);
    setTimeout(() => setShowSplash(false), 500);
  };

  return (
    <>
      {showSplash && (
        <div
          className={`${styles.splashOverlay} ${splashFading ? styles.splashFadeOut : ''}`}
          onClick={dismissSplash}
        >
          <video
            src="/mara-ai-etc.mp4"
            autoPlay
            muted
            playsInline
            onEnded={dismissSplash}
            onError={() => setShowSplash(false)}
            className={styles.splashVideo}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissSplash();
            }}
            className={styles.skipButton}
          >
            Skip
          </button>
        </div>
      )}
      <div className={`${styles.container} ${!showSplash ? styles.visible : ''}`}>
        <BrandPanel />
        <LoginCard />
      </div>
    </>
  );
}
