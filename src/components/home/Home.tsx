import {CSSProperties, useEffect, useRef, useState} from 'react';

import {isMobile} from '@deckdeckgo/utils';

import {defineCustomElements} from 'web-photo-filter/dist/loader';
defineCustomElements();

import {WebPhotoFilter} from 'web-photo-filter-react/dist';

import styles from './Home.module.scss';

import {InfoSize} from '../../hooks/size.hook';

import {savePdf} from '../../utils/pdf.utils';
import {shareImage} from '../../utils/image.utils';

import Toolbar from '../toolbar/Toolbar';

const Home = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const scanRef = useRef<HTMLCanvasElement | null>(null);

  const containerRef = useRef<HTMLElement | null>(null);

  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);

  const [videoSize, setVideoSize] = useState<InfoSize | undefined>(undefined);
  const [canvasHeight, setCanvasHeight] = useState<number | undefined>(undefined);

  const [status, setStatus] = useState<'scan' | 'share' | 'capture'>('scan');

  const [captureSrc, setCaptureSrc] = useState<string | undefined>(undefined);
  const [captureDest, setCaptureDest] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!scanRef?.current || !videoRef?.current || !containerRef?.current) {
      return;
    }

    if (videoSize) {
      return;
    }

    init();
  }, [videoRef, scanRef, containerRef.current]);

  useEffect(() => {
    if (!videoSize || !canvasHeight) {
      return;
    }

    scan();
  }, [canvasHeight, videoSize]);

  useEffect(() => {
    setVideoLoaded(canvasHeight !== undefined);
  }, [canvasHeight]);

  const init = async () => {
    if (!videoRef?.current) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: {ideal: 3456},
        height: {ideal: 4608},
        ...(isMobile() && {facingMode: {exact: 'environment'}}),
      },
    });

    const [track] = stream.getVideoTracks();

    if (!track) {
      return;
    }

    // TODO: flash
    // const capabilities = track.getCapabilities();
    //
    // if ((capabilities as any).torch) {
    //   await track.applyConstraints({
    //     advanced: [{torch: true} as any],
    //   });
    // }

    console.log('getCapabilities', track.getCapabilities());

    const capabilities = track.getCapabilities();
    if ((capabilities as any).focusDistance) {
      console.log('apply focus', (capabilities as any).focusDistance.max);

      await track.applyConstraints({
        focusDistance: (capabilities as any).focusDistance.max,
      } as any);
    }

    const settings = track.getSettings();

    console.log('settings', settings);

    const videoSize = {
      width: settings.width as number,
      height: settings.height as number,
    };

    const video: HTMLVideoElement = (videoRef.current as unknown) as HTMLVideoElement;

    if (video.srcObject) {
      return;
    }

    video.srcObject = stream;

    video.width = videoSize.width;
    video.height = videoSize.height;

    await video.play();

    setVideoSize(videoSize);

    initCanvasHeight(videoSize);
  };

  const initCanvasHeight = (videoSize: InfoSize) => {
    if (!containerRef?.current) {
      return;
    }

    const height = Math.min(containerRef?.current.offsetHeight, videoSize.height);

    const width = (height * 210) / 297;

    const canvasIdealHeight = (width > containerRef?.current.scrollWidth ? (containerRef?.current.scrollWidth / 210) * 297 : height) - 64;

    setCanvasHeight(canvasIdealHeight > height ? height : canvasIdealHeight);
  };

  const streamFeed = () => {
    if (!scanRef?.current || !videoRef.current) {
      return;
    }

    if (videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    if (!videoSize || !canvasHeight) {
      return;
    }

    const y = canvasHeight;
    const x = (y * 210) / 297;

    const deltaX = (videoSize.width - x) / 2;
    const deltaY = (videoSize.height - y) / 2;

    scanRef.current.width = 2100;
    scanRef.current.height = 2970;

    const context = scanRef.current.getContext('2d');
    context?.drawImage(videoRef.current, deltaX, deltaY, x, y, 0, 0, 2100, 2970);

    scan();
  };

  const scan = () => {
    requestAnimationFrame(streamFeed);
  };

  const capture = async () => {
    const video: HTMLVideoElement = (videoRef.current as unknown) as HTMLVideoElement;

    if (status === 'scan') {
      await video.pause();

      setCaptureSrc(scanRef?.current?.toDataURL('image/png'));
      setStatus('capture');
      return;
    }

    await video.play();
    scan();

    setCaptureSrc(undefined);
    setStatus('scan');
  };

  const share = async () => {
    if (!captureDest) {
      return;
    }

    await shareImage(captureDest);
  };

  const download = async () => {
    if (!captureDest) {
      return;
    }

    await savePdf(captureDest);
  };

  const imageLoaded = ($event: {detail: {webGLDetected: boolean; result: HTMLCanvasElement | HTMLImageElement}}) => {
    if (!$event.detail.webGLDetected) {
      setCaptureDest(undefined);
      setStatus('scan');
      return;
    }

    setCaptureDest(($event.detail.result as HTMLCanvasElement).toDataURL('image/png'));
    setStatus('share');
  };

  return (
    <main className={styles.main}>
      <article ref={containerRef} className={styles.container}>
        <video className={styles.video} ref={videoRef}></video>

        <div className={styles.overlay}></div>

        {renderCanvas()}
      </article>

      <Toolbar videoLoaded={videoLoaded} status={status} download={download} capture={capture} share={share}></Toolbar>
    </main>
  );

  function renderCanvas() {
    const canvasStyle = {'--canvas-height': `${canvasHeight}px`} as CSSProperties;

    return (
      <>
        <WebPhotoFilter
          onFilterLoad={($event: any) => imageLoaded($event)}
          src={captureSrc}
          filter="desaturate,saturation"
          className={`${styles.scan} ${styles.filter} ${status === 'scan' || canvasHeight === undefined ? 'hidden' : 'show'}`}
          style={canvasStyle}
        />
        <canvas ref={scanRef} className={`${styles.scan} ${status === 'share' || canvasHeight === undefined ? 'hidden' : 'show'}`} style={canvasStyle}></canvas>

        {!videoLoaded ? <h1 className={styles.loading}>Loading...</h1> : undefined}
      </>
    );
  }
};

export default Home;
