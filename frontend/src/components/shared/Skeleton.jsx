import React from 'react';

const s = (extra = {}) => ({ ...extra });

export const SkeletonBox = ({ w = '100%', h = 16, radius = 8, style = {} }) => (
  <div className="skeleton" style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, ...style }} />
);

export const GameCardSkeleton = () => (
  <div className="skeleton-card" style={{ overflow: 'hidden' }}>
    {/* Thumbnail area */}
    <div className="skeleton" style={{ height: 140, borderRadius: '18px 18px 0 0' }} />
    {/* Info area */}
    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.4)' }}>
      <SkeletonBox h={13} w="75%" style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonBox h={10} w="40%" />
        <SkeletonBox h={10} w="25%" />
      </div>
    </div>
  </div>
);

export const HotGameSkeleton = () => (
  <div style={{ flexShrink: 0, width: 110 }}>
    <div className="skeleton" style={{ width: 110, height: 110, borderRadius: 16, marginBottom: 8 }} />
    <SkeletonBox h={11} w="80%" style={{ margin: '0 auto' }} />
  </div>
);

export const WalletBalanceSkeleton = () => (
  <div className="balance-card" style={{ textAlign: 'center' }}>
    <SkeletonBox h={12} w={80} style={{ margin: '0 auto 12px' }} />
    <SkeletonBox h={40} w={180} style={{ margin: '0 auto 10px' }} />
    <SkeletonBox h={10} w={120} style={{ margin: '0 auto' }} />
  </div>
);

export const TransactionSkeleton = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <div style={{ flex: 1 }}>
      <SkeletonBox h={13} w="50%" style={{ marginBottom: 6 }} />
      <SkeletonBox h={10} w="30%" />
    </div>
    <SkeletonBox h={16} w={70} />
  </div>
);

export const BannerSkeleton = () => (
  <div className="skeleton" style={{ height: 100, borderRadius: 16, margin: '0 16px 16px' }} />
);

export const CategorySkeleton = () => (
  <div style={{ display: 'flex', gap: 12, padding: '0 16px', overflowX: 'hidden' }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <SkeletonBox key={i} h={38} w={90} radius={25} style={{ flexShrink: 0 }} />
    ))}
  </div>
);
