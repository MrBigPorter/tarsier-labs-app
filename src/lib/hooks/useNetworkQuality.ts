import { useState, useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkQuality {
  /** 0-100 quality score */
  quality: number;
  /** Preferred image format */
  imageFormat: 'webp' | 'jpg';
  /** Image size tier: 'thumbnail' | 'medium' | 'large' | 'original' */
  imageSize: 'thumbnail' | 'medium' | 'large' | 'original';
  /** Whether to show blurhash placeholder */
  showBlurhash: boolean;
  /** Connection type */
  connectionType: string | null;
  /** Is connected */
  isConnected: boolean;
  /** Device pixel ratio hint */
  pixelRatio: number;
}

function getQualityFromNetInfo(state: NetInfoState): Omit<
  NetworkQuality,
  'pixelRatio'
> {
  const { type, isConnected, isInternetReachable } = state;
  const connected = isConnected && isInternetReachable !== false;

  if (!connected) {
    return {
      quality: 0,
      imageFormat: 'jpg',
      imageSize: 'thumbnail',
      showBlurhash: true,
      connectionType: type,
      isConnected: false,
    };
  }

  switch (type) {
    case 'wifi':
    case 'ethernet':
      return {
        quality: 100,
        imageFormat: 'webp',
        imageSize: 'original',
        showBlurhash: false,
        connectionType: type,
        isConnected: true,
      };
    case 'cellular': {
      const cellularGeneration = state.details?.cellularGeneration;
      if (cellularGeneration === '4g' || cellularGeneration === '5g') {
        return {
          quality: 75,
          imageFormat: 'webp',
          imageSize: 'large',
          showBlurhash: false,
          connectionType: `${type}_${cellularGeneration}g`,
          isConnected: true,
        };
      }
      if (cellularGeneration === '3g') {
        return {
          quality: 45,
          imageFormat: 'webp',
          imageSize: 'medium',
          showBlurhash: true,
          connectionType: `${type}_${cellularGeneration}g`,
          isConnected: true,
        };
      }
      // 2G or unknown
      return {
        quality: 20,
        imageFormat: 'jpg',
        imageSize: 'thumbnail',
        showBlurhash: true,
        connectionType: `${type}_${cellularGeneration ?? 'unknown'}g`,
        isConnected: true,
      };
    }
    default:
      return {
        quality: 50,
        imageFormat: 'webp',
        imageSize: 'medium',
        showBlurhash: true,
        connectionType: type,
        isConnected: true,
      };
  }
}

export function useNetworkQuality(): NetworkQuality {
  const pixelRatioRef = useRef(1);
  const [quality, setQuality] = useState<NetworkQuality>(() => ({
    quality: 75,
    imageFormat: 'webp',
    imageSize: 'large',
    showBlurhash: false,
    connectionType: 'unknown',
    isConnected: true,
    pixelRatio: 1,
  }));

  useEffect(() => {
    // PixelRatio is static in RN, get it once
    const { PixelRatio } = require('react-native');
    pixelRatioRef.current = PixelRatio.get();

    const unsubscribe = NetInfo.addEventListener(state => {
      const netQuality = getQualityFromNetInfo(state);
      setQuality({
        ...netQuality,
        pixelRatio: pixelRatioRef.current,
      });
    });

    return () => unsubscribe();
  }, []);

  return quality;
}
