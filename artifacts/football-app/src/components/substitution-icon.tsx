export function SubstitutionIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`}>
      {/* Green up arrow */}
      <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
        <path d="M6.5 1L12 8H8.5V15H4.5V8H1L6.5 1Z" fill="#22c55e" stroke="#16a34a" strokeWidth="0.5" strokeLinejoin="round"/>
      </svg>
      {/* Red down arrow */}
      <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
        <path d="M6.5 15L1 8H4.5V1H8.5V8H12L6.5 15Z" fill="#ef4444" stroke="#dc2626" strokeWidth="0.5" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}
