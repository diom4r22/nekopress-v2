import React, { useEffect, useState } from 'react';

interface PosterImageProps {
  src?: string;
  title: string;
  subtitle?: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}

export const PosterImage: React.FC<PosterImageProps> = ({
  src,
  title,
  subtitle,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover',
  loading = 'lazy',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src, title]);

  if (!src || hasError) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center p-3 text-center select-none border border-zinc-800/80`}
      >
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-500 mb-1">
          猫PRESS
        </span>
        <p className="font-serif font-bold text-xs text-zinc-100 line-clamp-3 leading-snug">
          {title}
        </p>
        {subtitle && (
          <span className="mt-1.5 text-[10px] font-mono text-zinc-400 line-clamp-1">
            {subtitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      loading={loading}
      referrerPolicy="no-referrer"
      className={imgClassName}
      onError={() => setHasError(true)}
    />
  );
};
