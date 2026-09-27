import React, { useState, useEffect } from 'react';
import { Eye, ExternalLink, Image as ImageIcon } from 'lucide-react';
import ImageModal from './ImageModal';
import { isImageUrl } from '../utils/answerTemplateUtils';
import { apiClient } from '../api/client';

interface ImageLinkProps {
  text: string;
  showImage?: boolean;
  isImage?: boolean;
  className?: string;
}

export default function ImageLink({
  text,
  showImage = true,
  isImage: isImageProp,
  className = "",
}: ImageLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const trimmedText = String(text || '').trim();

  // Normalize URLs to prevent mixed content issues on HTTPS production
  const normalizeUrl = (raw: string): string => {
    let clean = raw.trim();
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (clean.startsWith('http://13.203.137.229/api/')) {
        clean = clean.replace('http://13.203.137.229/api/', 'https://www.focus3rdeye.com/api/');
      } else if (clean.startsWith('http://13.203.137.229/')) {
        clean = clean.replace('http://13.203.137.229/', 'https://www.focus3rdeye.com/');
      }
    }
    return clean;
  };

  useEffect(() => {
    let isMounted = true;
    const convertImage = async () => {
      setLoadError(false);
      if (trimmedText.includes('drive.google.com')) {
        setIsConverting(true);
        try {
          const result = await apiClient.convertImageUrl(trimmedText);
          if (isMounted) setImageUrl(normalizeUrl(result.cloudinaryUrl));
        } catch (error) {
          console.warn('Image conversion failed, using original:', error);
          if (isMounted) setImageUrl(normalizeUrl(trimmedText));
        } finally {
          if (isMounted) setIsConverting(false);
        }
      } else {
        setImageUrl(normalizeUrl(trimmedText));
      }
    };

    if (trimmedText) {
      convertImage();
    }
    return () => {
      isMounted = false;
    };
  }, [trimmedText]);

  if (!trimmedText) {
    return null;
  }

  const isImage = isImageProp ?? isImageUrl(trimmedText);

  if (!isImage) {
    if (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) {
      return (
        <a
          href={trimmedText}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 underline inline-flex items-center gap-1 text-xs truncate max-w-[200px]"
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{trimmedText}</span>
        </a>
      );
    }
    return <span>{trimmedText}</span>;
  }

  if (!showImage) {
    return (
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 transition-colors"
      >
        <ImageIcon className="w-3 h-3" />
        <span>View Photo</span>
      </button>
    );
  }

  const displayUrl = imageUrl || trimmedText;

  return (
    <>
      <div className={`relative group inline-block ${className}`}>
        {!loadError ? (
          <div className="relative">
            <img
              src={displayUrl}
              alt="Evidence preview"
              onClick={() => setIsModalOpen(true)}
              onError={() => setLoadError(true)}
              className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer shadow-xs hover:shadow-md hover:scale-102 transition-all duration-200 bg-gray-50 dark:bg-gray-800"
            />
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="absolute inset-0 w-full h-full bg-black/0 group-hover:bg-black/30 rounded-md transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Click to view full photo"
            >
              <Eye className="w-4 h-4 text-white drop-shadow-sm" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (displayUrl.startsWith('http')) {
                window.open(displayUrl, '_blank', 'noopener,noreferrer');
              } else {
                setIsModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
            title="Click to open evidence photo"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>View Evidence</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
        )}
      </div>
      <ImageModal 
        isOpen={isModalOpen}
        imageUrl={displayUrl}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

