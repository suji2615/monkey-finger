import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import monkey01Url from '../videos/monkey01.mp4?url';
import monkey02Url from '../videos/monkey02.mp4?url';
import monkey03Url from '../videos/monkey03.mp4?url';
import monkey04Url from '../videos/monkey04.mp4?url';
import monkey05Url from '../videos/monkey05.mp4?url';
import monkey06Url from '../videos/monkey06.mp4?url';
import monkey07Url from '../videos/monkey07.mp4?url';
import monkey08Url from '../videos/monkey08.mp4?url';
import './style.css';

const videoLayers = [...document.querySelectorAll('.gallery-video')];
const cameraVideo = document.querySelector('#camera-preview');
const cameraButton = document.querySelector('#camera-toggle');
const cameraPreview = document.querySelector('#camera-preview-wrap');
const previousButton = document.querySelector('#previous-video');
const nextButton = document.querySelector('#next-video');

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const wasmUrl = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const filmLibrary = [
  { id: 'monkey01', src: monkey01Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey02', src: monkey02Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey03', src: monkey03Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey04', src: monkey04Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey05', src: monkey05Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey06', src: monkey06Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey07', src: monkey07Url, forwardOnDown: true, sensitivity: 2.2 },
  { id: 'monkey08', src: monkey08Url, forwardOnDown: true, sensitivity: 2.2 },
];
const detectionIntervalMs = 33;
const smoothing = 0.3;
const deadZone = 0.0025;
const transitionDurationMs = 450;

let handLandmarker;
let cameraStream;
let activeFilmIndex = 0;
let activeLayerIndex = 0;
let targetTimes = filmLibrary.map(() => 0);
let detectionFrame = 0;
let lastDetectionAt = 0;
let lastConsoleLogAt = 0;
let smoothedY;
let lastAppliedY;
let targetTime = 0;
let seekFrame = 0;
let handDetected;
let transitionInProgress = false;

function stopVideo() {
  videoLayers[activeLayerIndex].pause();
}

function applyPendingSeek() {
  seekFrame = 0;
  const activeVideo = videoLayers[activeLayerIndex];
  if (activeVideo.seeking || !Number.isFinite(activeVideo.duration)) return;
  if (Math.abs(activeVideo.currentTime - targetTime) > 0.001) {
    activeVideo.currentTime = targetTime;
  }
}

function queueSeek() {
  if (!seekFrame) seekFrame = window.requestAnimationFrame(applyPendingSeek);
}

function updatePlayhead(rawY) {
  const boundedY = Math.min(1, Math.max(0, rawY));
  if (smoothedY === undefined) {
    smoothedY = boundedY;
    lastAppliedY = boundedY;
    return boundedY;
  }

  smoothedY += (boundedY - smoothedY) * smoothing;
  const film = filmLibrary[activeFilmIndex];
  const direction = film.forwardOnDown ? 1 : -1;
  const deltaY = (smoothedY - lastAppliedY) * direction;
  if (Math.abs(deltaY) >= deadZone) {
    const activeVideo = videoLayers[activeLayerIndex];
    if (Number.isFinite(activeVideo.duration)) {
      const duration = activeVideo.duration;
      targetTime = Math.min(
        Math.max(0, duration - 0.001),
        Math.max(0, targetTime + deltaY * duration * film.sensitivity),
      );
      targetTimes[activeFilmIndex] = targetTime;
      queueSeek();
    }
    lastAppliedY = smoothedY;
  }

  return boundedY;
}

function resetTracking() {
  smoothedY = undefined;
  lastAppliedY = undefined;
}

function preloadFilm(layerIndex, filmIndex) {
  const video = videoLayers[layerIndex];
  video.preload = 'auto';
  if (video.dataset.filmId !== filmLibrary[filmIndex].id) {
    video.dataset.filmId = filmLibrary[filmIndex].id;
    video.src = filmLibrary[filmIndex].src;
    video.load();
  }
}

function changeFilm(step) {
  if (transitionInProgress) return;

  const nextFilmIndex = (activeFilmIndex + step + filmLibrary.length) % filmLibrary.length;
  const incomingLayerIndex = 1 - activeLayerIndex;
  const incomingVideo = videoLayers[incomingLayerIndex];
  const outgoingVideo = videoLayers[activeLayerIndex];
  const incomingFilm = filmLibrary[nextFilmIndex];
  transitionInProgress = true;
  incomingVideo.pause();
  incomingVideo.classList.remove('is-visible');
  if (incomingVideo.dataset.filmId !== incomingFilm.id) {
    incomingVideo.dataset.filmId = incomingFilm.id;
    incomingVideo.src = incomingFilm.src;
    incomingVideo.load();
  }

  const showIncomingFilm = () => {
    incomingVideo.removeEventListener('loadeddata', showIncomingFilm);
    activeFilmIndex = nextFilmIndex;
    activeLayerIndex = incomingLayerIndex;
    targetTime = 0;
    targetTimes[activeFilmIndex] = 0;
    resetTracking();
    incomingVideo.currentTime = 0;
    incomingVideo.classList.add('is-visible');
    outgoingVideo.classList.remove('is-visible');
    stopVideo();

    window.setTimeout(() => {
      preloadFilm(1 - activeLayerIndex, (activeFilmIndex + 1) % filmLibrary.length);
      transitionInProgress = false;
    }, transitionDurationMs);
  };

  if (incomingVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    showIncomingFilm();
  } else {
    incomingVideo.addEventListener('loadeddata', showIncomingFilm, { once: true });
  }
}

function handleGalleryKeydown(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  if (event.repeat) return;
  changeFilm(event.key === 'ArrowRight' ? 1 : -1);
}

function detectHands() {
  if (!handLandmarker || !cameraStream) return;
  detectionFrame = window.requestAnimationFrame(detectHands);

  const now = performance.now();
  if (now - lastDetectionAt < detectionIntervalMs
    || cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  lastDetectionAt = now;

  try {
    const result = handLandmarker.detectForVideo(cameraVideo, now);
    const indexTip = result.landmarks?.[0]?.[8];

    if (!indexTip) {
      if (handDetected !== false) console.info('[Hand tracking] 손을 찾을 수 없음; 영상 정지');
      handDetected = false;
      resetTracking();
      stopVideo();
      return;
    }

    const y = updatePlayhead(indexTip.y);
    if (handDetected !== true) console.info('[Hand tracking] 손 감지됨');
    handDetected = true;
    if (now - lastConsoleLogAt >= 750) {
      console.info(`[Hand tracking] 검지 끝 landmark 8: y=${y.toFixed(3)}, 영상=${targetTime.toFixed(2)}s`);
      lastConsoleLogAt = now;
    }
  } catch (error) {
    stopVideo();
    console.error('Hand tracking failed:', error);
  }
}

async function stopCamera() {
  if (detectionFrame) window.cancelAnimationFrame(detectionFrame);
  detectionFrame = 0;
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraVideo.srcObject = null;
  cameraPreview.hidden = true;
  if (handLandmarker) handLandmarker.close();
  handLandmarker = undefined;
  handDetected = undefined;
  resetTracking();
}

async function startCamera() {
  cameraButton.disabled = true;
  cameraButton.textContent = 'connecting camera';
  cameraButton.dataset.state = 'loading';

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('카메라를 사용하려면 localhost 또는 HTTPS 연결이 필요합니다.');
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();

    const vision = await FilesetResolver.forVisionTasks(wasmUrl);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl },
      runningMode: 'VIDEO',
      numHands: 1,
    });

    cameraPreview.hidden = false;
    cameraButton.hidden = true;
    handDetected = undefined;
    lastDetectionAt = 0;
    lastConsoleLogAt = 0;
    targetTime = videoLayers[activeLayerIndex].currentTime;
    resetTracking();
    console.info('[Hand tracking] Hand Landmarker 준비 완료. 검지 끝 landmark 8 추적을 시작합니다.');
    detectionFrame = window.requestAnimationFrame(detectHands);
  } catch (error) {
    await stopCamera();
    cameraButton.disabled = false;
    cameraButton.textContent = 'turn on camera';
    cameraButton.dataset.state = 'error';
    console.error('Camera startup failed:', error);
  }
}

cameraButton.addEventListener('click', startCamera);
videoLayers.forEach((video) => {
  video.addEventListener('seeked', queueSeek);
  video.addEventListener('ended', stopVideo);
});
previousButton.addEventListener('click', () => changeFilm(-1));
nextButton.addEventListener('click', () => changeFilm(1));
window.addEventListener('keydown', handleGalleryKeydown);

const firstVideo = videoLayers[activeLayerIndex];
firstVideo.dataset.filmId = filmLibrary[activeFilmIndex].id;
firstVideo.src = filmLibrary[activeFilmIndex].src;
firstVideo.classList.add('is-visible');
firstVideo.pause();
preloadFilm(1 - activeLayerIndex, (activeFilmIndex + 1) % filmLibrary.length);
