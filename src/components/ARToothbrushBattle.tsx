import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ASSET_IMAGES } from '../data/initialData';
import { sounds } from '../utils/audio';
import {
  Camera,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Activity,
  CheckCircle2,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ARToothbrushBattleProps {
  onExit: () => void;
  onRewardEarned: (coins: number, points: number, stickerUrl: string) => void;
}

declare global {
  interface Window {
    FaceDetection?: any;
    Camera?: any;
  }
}

export const ARToothbrushBattle: React.FC<ARToothbrushBattleProps> = ({
  onExit,
  onRewardEarned,
}) => {
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes standard dentist timer
  const [isRunning, setIsRunning] = useState(true);
  const [monsterHp, setMonsterHp] = useState(100);
  const [coinsEarned, setCoinsEarned] = useState(0);

  // Camera & AR State
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [motionIntensity, setMotionIntensity] = useState(0);
  const [isBrushDetected, setIsBrushDetected] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // FX state
  const [bubbles, setBubbles] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const [isTakingDamage, setIsTakingDamage] = useState(false);
  const [isDefeated, setIsDefeated] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const battleArenaRef = useRef<HTMLDivElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDamageTimeRef = useRef<number>(0);
  const faceDetectorRef = useRef<any>(null);

  // Dentist Quadrant Guidance
  const getQuadrantGuide = () => {
    if (timeLeft > 90) {
      return {
        zone: 'Zone 1: Upper Right',
        tip: 'Brush top right teeth in circles!',
        color: '#3498DB',
        icon: '🦷',
      };
    }
    if (timeLeft > 60) {
      return {
        zone: 'Zone 2: Upper Left',
        tip: 'Move over to top left teeth!',
        color: '#9B59B6',
        icon: '✨',
      };
    }
    if (timeLeft > 30) {
      return {
        zone: 'Zone 3: Lower Right',
        tip: 'Now scrub bottom right teeth!',
        color: '#E67E22',
        icon: '🫧',
      };
    }
    if (timeLeft > 10) {
      return {
        zone: 'Zone 4: Lower Left',
        tip: 'Scrub bottom left outer & chewing surfaces!',
        color: '#2ECC71',
        icon: '🌟',
      };
    }
    return {
      zone: 'Zone 5: Tongue & Final Polish',
      tip: 'Gentle sweep on tongue for fresh breath!',
      color: '#F1C40F',
      icon: '👅',
    };
  };

  // Load MediaPipe Face Detection script via CDN
  useEffect(() => {
    let isMounted = true;

    const loadMediaPipe = async () => {
      if (window.FaceDetection) {
        initFaceDetector();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        if (isMounted) {
          initFaceDetector();
        }
      };
      script.onerror = () => {
        console.warn('MediaPipe Face Detection CDN failed to load, using pixel motion detector.');
      };
      document.body.appendChild(script);
    };

    const initFaceDetector = () => {
      try {
        if (window.FaceDetection) {
          const detector = new window.FaceDetection({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
          });
          detector.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5,
          });
          detector.onResults((results: any) => {
            if (results.detections && results.detections.length > 0) {
              const bbox = results.detections[0].boundingBox;
              setFaceBox({
                x: bbox.xCenter - bbox.width / 2,
                y: bbox.yCenter - bbox.height / 2,
                width: bbox.width,
                height: bbox.height,
              });
            } else {
              setFaceBox(null);
            }
          });
          faceDetectorRef.current = detector;
        }
      } catch (err) {
        console.warn('FaceDetector initialization fallback:', err);
      }
    };

    loadMediaPipe();

    return () => {
      isMounted = false;
    };
  }, []);

  // Request & Start Camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionState('unsupported');
      setCameraError('Camera API not supported in this browser. Running in Auto-Brush timer mode.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.warn);
        };
      }
      setIsWebcamActive(true);
      setCameraPermissionState('granted');
    } catch (err: any) {
      console.warn('Camera permission denied or unavailable:', err);
      setCameraPermissionState('denied');
      setIsWebcamActive(false);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. The battle will auto-progress with the 2-minute dentist timer!'
          : 'Front camera not available. Running in Auto-Brush battle mode.'
      );
    }
  }, []);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  }, []);

  // Auto-start camera on component mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [startCamera, stopCamera]);

  // Victory trigger
  const handleVictory = useCallback(() => {
    setIsDefeated(true);
    setIsRunning(false);
    stopCamera();
    if (!soundMuted) sounds.playFanfare();
    const finalBonusCoins = 50 + coinsEarned;
    const finalPoints = 15;
    setTimeout(() => {
      onRewardEarned(finalBonusCoins, finalPoints, ASSET_IMAGES.rewardSticker);
    }, 1200);
  }, [coinsEarned, onRewardEarned, stopCamera, soundMuted]);

  // Damage logic when motion/scrubbing is detected
  const takeDamage = useCallback(
    (amount: number = 3) => {
      if (isDefeated) return;

      const now = Date.now();
      // Throttle damage hits to max once every 120ms
      if (now - lastDamageTimeRef.current < 120) return;
      lastDamageTimeRef.current = now;

      if (!soundMuted) sounds.playScrubHit();
      setIsTakingDamage(true);

      // Spawn soap bubble FX
      const newBubble = {
        id: now + Math.random(),
        x: 30 + Math.random() * 40,
        y: 40 + Math.random() * 30,
        size: Math.random() * 25 + 20,
      };
      setBubbles((prev) => [...prev.slice(-12), newBubble]);

      // Reduce HP
      setMonsterHp((prev) => {
        const nextHp = Math.max(0, prev - amount);
        if (nextHp <= 0 && !isDefeated) {
          handleVictory();
        }
        return nextHp;
      });

      // Coin bonus chance
      if (Math.random() > 0.6) {
        if (!soundMuted) sounds.playCoin();
        setCoinsEarned((prev) => prev + 1);
      }

      setTimeout(() => setIsTakingDamage(false), 160);
    },
    [isDefeated, handleVictory, soundMuted]
  );

  // Real-time Motion Detection & Video Processing Loop
  useEffect(() => {
    if (!isWebcamActive || isDefeated) return;

    let frameCounter = 0;
    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const width = 120;
          const height = 90;
          canvas.width = width;
          canvas.height = height;

          // Draw scaled-down video frame
          ctx.drawImage(video, 0, 0, width, height);

          // Pass to MediaPipe Face Detector periodically (every 5 frames)
          if (faceDetectorRef.current && frameCounter % 5 === 0) {
            try {
              await faceDetectorRef.current.send({ image: video });
            } catch {
              // Ignore MediaPipe worker interruptions
            }
          }
          frameCounter++;

          // Pixel Difference Motion Detection
          const frame = ctx.getImageData(0, 0, width, height);
          const data = frame.data;
          const prevData = prevFrameDataRef.current;

          if (prevData && prevData.length === data.length) {
            let diffSum = 0;
            const step = 4; // Check every 4th pixel for high speed
            let sampledPixels = 0;

            for (let i = 0; i < data.length; i += step * 4) {
              const rDiff = Math.abs(data[i] - prevData[i]);
              const gDiff = Math.abs(data[i + 1] - prevData[i + 1]);
              const bDiff = Math.abs(data[i + 2] - prevData[i + 2]);
              const diff = (rDiff + gDiff + bDiff) / 3;

              if (diff > 18) {
                diffSum += diff;
              }
              sampledPixels++;
            }

            const motionScore = Math.min(100, Math.round((diffSum / (sampledPixels * 15)) * 100));
            setMotionIntensity((prev) => Math.round(prev * 0.6 + motionScore * 0.4));

            // If consistent movement is detected (scrubbing motion > 16)
            if (motionScore > 16) {
              setIsBrushDetected(true);
              takeDamage(2);
            } else {
              setIsBrushDetected(false);
            }
          }

          // Save copy for next diff
          prevFrameDataRef.current = new Uint8ClampedArray(data);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isWebcamActive, isDefeated, takeDamage]);

  // Master 2-Minute Timer Loop + Fallback Auto-Progress
  useEffect(() => {
    if (!isRunning || timeLeft <= 0 || isDefeated) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleVictory();
          return 0;
        }

        // If camera is not active or denied, automatically inflict stage damage based on the 2 min timer
        if (!isWebcamActive || cameraPermissionState === 'denied') {
          // 100 HP spread over ~120 seconds = roughly 0.85 to 1.2 HP per second
          const autoDamage = 1;
          setMonsterHp((hp) => {
            const next = Math.max(0, hp - autoDamage);
            if (next <= 0 && !isDefeated) {
              handleVictory();
            }
            return next;
          });

          // Occasional reward coins in fallback mode
          if (Math.random() > 0.7) {
            setCoinsEarned((c) => c + 1);
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isDefeated, isWebcamActive, cameraPermissionState, handleVictory]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const quadrant = getQuadrantGuide();

  return (
    <div className="fixed inset-0 z-50 bg-[#09141e] flex flex-col items-center justify-between overflow-hidden select-none">
      {/* Hidden processing canvas for optical flow & motion diff */}
      <canvas ref={canvasRef} className="hidden" />

      {/* AR Camera & Boss Arena Background */}
      <div ref={battleArenaRef} className="absolute inset-0 z-0 overflow-hidden">
        {isWebcamActive ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100 filter brightness-95 contrast-105"
            />

            {/* MediaPipe Face & Mouth AR Tracking Hologram Overlay */}
            {faceBox && (
              <div
                style={{
                  left: `${(1 - (faceBox.x + faceBox.width)) * 100}%`,
                  top: `${faceBox.y * 100}%`,
                  width: `${faceBox.width * 100}%`,
                  height: `${faceBox.height * 100}%`,
                }}
                className="absolute border-2 border-dashed border-[#54E98A]/60 rounded-3xl pointer-events-none transition-all duration-75 flex flex-col justify-end items-center pb-2"
              >
                {/* Mouth Zone Indicator */}
                <div className="w-3/4 h-1/3 bg-[#54E98A]/20 border-2 border-[#54E98A] rounded-full animate-pulse flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase text-[#54E98A] tracking-wider">
                    🦷 Scrub Zone
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <img
            src={ASSET_IMAGES.sugarMonsterArena}
            alt="Sugar Monster AR Arena"
            className={`w-full h-full object-cover transition-transform duration-100 ${
              isTakingDamage ? 'scale-[1.02] brightness-110' : 'scale-100'
            }`}
          />
        )}

        {/* Ambient Dark Gradient Layer for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#09141e]/90 via-[#09141e]/40 to-[#09141e]/95 pointer-events-none" />

        {/* Dynamic Foam Bubbles generated by brushing */}
        {bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
            }}
            className="absolute rounded-full bg-cyan-200/50 border-2 border-white pointer-events-none shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-ping"
          />
        ))}
      </div>

      {/* TOP HUD */}
      <div className="relative z-20 w-full max-w-4xl px-4 sm:px-6 pt-3 sm:pt-5 flex items-center justify-between pointer-events-none">
        {/* Flee / Exit Button */}
        <button
          onClick={() => {
            sounds.playTap();
            stopCamera();
            onExit();
          }}
          className="chunky-btn bg-[#F39C12] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 pointer-events-auto cursor-pointer shadow-lg active:translate-y-1"
          style={{ '--shadow-color': '#D68910' } as React.CSSProperties}
        >
          <span>🔙</span> <span className="hidden sm:inline">Flee</span>
        </button>

        {/* Dentist 2-Minute Master Timer */}
        <div className="bg-[#1E293B]/95 border-3 sm:border-4 border-[#3498DB] rounded-2xl px-5 sm:px-8 py-1.5 sm:py-2 text-center shadow-[0_6px_0_#2980B9] pointer-events-auto flex flex-col items-center backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71] animate-pulse" />
            <h3 className="m-0 text-[10px] sm:text-xs font-black text-[#F1C40F] uppercase tracking-widest">
              BRUSH TIMER
            </h3>
          </div>
          <p className="text-2xl sm:text-4xl font-black text-white font-mono m-0 drop-shadow-[2px_2px_0_#000]">
            {formatTime(timeLeft)}
          </p>
        </div>

        {/* Camera Toggle & Audio Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setSoundMuted((m) => !m)}
            className="chunky-btn bg-[#334155] p-2.5 rounded-2xl text-white cursor-pointer shadow-md"
            style={{ '--shadow-color': '#1E293B' } as React.CSSProperties}
            title={soundMuted ? 'Unmute FX' : 'Mute FX'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#54E98A]" />}
          </button>

          <button
            onClick={isWebcamActive ? stopCamera : startCamera}
            className={`chunky-btn px-3 sm:px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg active:translate-y-1 ${
              isWebcamActive ? 'bg-[#2ECC71] text-[#0F172A]' : 'bg-[#3498DB] text-white'
            }`}
            style={{
              '--shadow-color': isWebcamActive ? '#27AE60' : '#2980B9',
            } as React.CSSProperties}
            title={isWebcamActive ? 'Disable AR Camera' : 'Enable AR Camera'}
          >
            {isWebcamActive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <span className="hidden sm:inline">{isWebcamActive ? 'AR Live' : 'Enable AR'}</span>
          </button>
        </div>
      </div>

      {/* CAMERA PERMISSION / FALLBACK NOTICE */}
      {cameraError && (
        <div className="relative z-20 w-full max-w-xl mx-4 mt-2 px-4 py-2 bg-[#E74C3C]/90 border-2 border-red-300 rounded-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-yellow-200" />
            <span>{cameraError}</span>
          </div>
          <button
            onClick={startCamera}
            className="px-2.5 py-1 bg-white text-[#E74C3C] text-xs font-black uppercase rounded-lg cursor-pointer hover:bg-gray-100 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* CENTER BOSS ARENA */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-lg px-4 my-auto">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tight text-center drop-shadow-[2px_2px_0_#000] m-0">
            SUGAR MONSTER BATTLE
          </h1>
          <span className="bg-[#E74C3C] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-black/40">
            Level 5 Boss
          </span>
        </div>

        {/* Boss Health Container */}
        <div className="relative w-full max-w-sm sm:max-w-md bg-[#0F172A]/90 backdrop-blur-md rounded-[32px] border-4 border-[#F39C12] p-4 sm:p-5 shadow-2xl flex flex-col items-center">
          {/* Boss HP Bar */}
          <div className="w-full h-7 sm:h-8 bg-black/90 rounded-full border-3 border-[#334155] mb-3 relative overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#E74C3C] via-[#F39C12] to-[#2ECC71] rounded-full transition-all duration-300"
              style={{ width: `${monsterHp}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-black text-white uppercase tracking-wider drop-shadow-[1px_1px_0_#000]">
              Sugar Monster HP: {monsterHp}%
            </div>
          </div>

          {/* 3D Sugar Monster Avatar & Visual Reaction to Brushing */}
          <div
            className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-[#1E293B]/80 border-4 border-[#E74C3C] shadow-[0_0_35px_rgba(231,76,60,0.5)] flex items-center justify-center transition-transform duration-100 relative ${
              isTakingDamage ? 'boss-shake scale-105 brightness-125' : 'animate-float'
            }`}
          >
            <img
              src={ASSET_IMAGES.sugarMonsterBoss}
              alt="Sugar Monster"
              className="w-full h-full object-contain p-2 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
            />
            {isBrushDetected && (
              <div className="absolute -top-3 bg-[#54E98A] text-[#0F172A] font-black text-xs uppercase px-3 py-0.5 rounded-full border-2 border-white shadow-lg animate-bounce">
                💥 Scrub Hit!
              </div>
            )}
          </div>

          {/* Coins Collected Counter */}
          <div className="mt-3 flex items-center gap-2 bg-[#1E293B] border border-[#334155] px-3.5 py-1 rounded-full text-xs font-black text-[#F1C40F]">
            <span>🪙</span> Coins Earned: +{coinsEarned}
          </div>
        </div>

        {/* Dentist Quadrant Indicator Bar */}
        <div
          className="mt-3 w-full max-w-md rounded-2xl px-4 py-2.5 flex items-center justify-between border-2 shadow-lg backdrop-blur-md transition-colors duration-500"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            borderColor: quadrant.color,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{quadrant.icon}</span>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black uppercase" style={{ color: quadrant.color }}>
                {quadrant.zone}
              </span>
              <span className="text-[11px] font-bold text-white leading-tight">
                {quadrant.tip}
              </span>
            </div>
          </div>
          <div className="text-right pl-2">
            <span className="text-[10px] font-black uppercase text-gray-400">STAGE</span>
            <div className="text-xs font-black text-white">
              {timeLeft > 90 ? '1/5' : timeLeft > 60 ? '2/5' : timeLeft > 30 ? '3/5' : timeLeft > 10 ? '4/5' : '5/5'}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM AR MOTION SENSOR & SCRUBBING HUD (Replaces old manual Scrub button) */}
      <div className="relative z-20 w-full max-w-xl px-4 pb-6 flex flex-col items-center">
        <div className="w-full bg-[#0F172A]/95 border-3 border-[#3498DB] rounded-3xl p-3.5 sm:p-4 shadow-[0_8px_0_#2980B9] backdrop-blur-md flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity
                className={`w-5 h-5 ${
                  isBrushDetected || motionIntensity > 15
                    ? 'text-[#54E98A] animate-pulse'
                    : 'text-gray-400'
                }`}
              />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                {isWebcamActive ? 'Live AR Motion Sensor' : 'Auto-Brush Stage Sync'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBrushDetected || motionIntensity > 15
                    ? 'bg-[#54E98A] animate-ping'
                    : 'bg-[#F39C12]'
                }`}
              />
              <span className="text-xs font-black uppercase text-[#54E98A]">
                {isWebcamActive
                  ? isBrushDetected
                    ? '⚡ Brushing Detected!'
                    : 'Scrub In Front Of Camera'
                  : 'Timer Auto-Sync'}
              </span>
            </div>
          </div>

          {/* Real-time Scrubbing Power / Motion Energy Gauge */}
          <div className="w-full h-4 bg-[#1E293B] rounded-full border-2 border-[#334155] overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#3498DB] via-[#54E98A] to-[#F1C40F] rounded-full transition-all duration-150"
              style={{
                width: `${
                  isWebcamActive
                    ? Math.max(10, Math.min(100, motionIntensity * 1.8))
                    : Math.min(100, ((120 - timeLeft) / 120) * 100)
                }%`,
              }}
            />
          </div>

          <p className="text-[11px] font-bold text-gray-300 text-center m-0">
            {isWebcamActive
              ? '✨ Keep brushing back and forth! Your movements automatically damage the Sugar Monster!'
              : '🕒 Brush along with the 2-minute timer to defeat the monster and unlock your hero reward!'}
          </p>
        </div>
      </div>
    </div>
  );
};
