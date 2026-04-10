import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton = ({ className = '', style }: SkeletonProps) => {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-100 ${className}`} style={style} />
  );
};

export const ChartSkeleton = () => (
  <div className="h-[400px] w-full flex flex-col gap-4">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-10 w-10" />
    </div>
    <div className="flex-1 flex items-end gap-2 px-2">
      {[...Array(12)].map((_, i) => (
        <Skeleton 
          key={i} 
          className="flex-1" 
          style={{ height: `${Math.random() * 60 + 20}%` }} 
        />
      ))}
    </div>
  </div>
);
