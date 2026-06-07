const SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

export default function AppLogo({ size = 'md', className = '', showRing = false }) {
  return (
    <img
      src="/logo.png"
      alt="Jin Deshna"
      className={`${SIZES[size] || SIZES.md} rounded-full object-cover flex-shrink-0 ${
        showRing ? 'ring-2 ring-white/30' : ''
      } ${className}`}
    />
  );
}
