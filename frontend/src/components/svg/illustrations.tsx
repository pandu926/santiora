export function NetworkSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.8" />
      <circle cx="100" cy="80" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="300" cy="80" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="80" cy="200" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="320" cy="200" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="150" cy="250" r="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="250" cy="250" r="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="50" cy="130" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="350" cy="130" r="2" fill="currentColor" opacity="0.3" />
      <line x1="200" y1="150" x2="100" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <line x1="200" y1="150" x2="300" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <line x1="200" y1="150" x2="80" y2="200" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="200" y1="150" x2="320" y2="200" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="100" y1="80" x2="50" y2="130" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="300" y1="80" x2="350" y2="130" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="80" y1="200" x2="150" y2="250" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="320" y1="200" x2="250" y2="250" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="100" y1="80" x2="300" y2="80" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
      <line x1="150" y1="250" x2="250" y2="250" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
      <circle cx="200" cy="150" r="30" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <circle cx="200" cy="150" r="60" stroke="currentColor" strokeWidth="0.3" opacity="0.08" />
      <circle cx="200" cy="150" r="100" stroke="currentColor" strokeWidth="0.3" opacity="0.05" />
    </svg>
  );
}

export function BrainSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M60 20C45 20 35 30 35 42C30 42 25 48 25 55C25 62 30 68 37 69C37 78 44 85 53 85H67C76 85 83 78 83 69C90 68 95 62 95 55C95 48 90 42 85 42C85 30 75 20 60 20Z" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <circle cx="48" cy="45" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="72" cy="45" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="60" cy="58" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="42" cy="65" r="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="78" cy="65" r="2.5" fill="currentColor" opacity="0.3" />
      <line x1="48" y1="45" x2="60" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="72" y1="45" x2="60" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="42" y1="65" x2="60" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="78" y1="65" x2="60" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M50 95L60 105L70 95" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="60" y1="85" x2="60" y2="105" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

export function ShieldSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M50 10L15 25V55C15 80 50 105 50 105C50 105 85 80 85 55V25L50 10Z" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <path d="M50 20L25 32V55C25 73 50 93 50 93C50 93 75 73 75 55V32L50 20Z" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="currentColor" fillOpacity="0.03" />
      <polyline points="38,55 47,64 65,46" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

export function ChartSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <polyline points="10,65 30,50 50,55 70,30 90,35 110,15" stroke="currentColor" strokeWidth="2" opacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="10,65 30,60 50,62 70,45 90,50 110,40" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
      <line x1="10" y1="70" x2="110" y2="70" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="10" y1="10" x2="10" y2="70" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <circle cx="70" cy="30" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="110" cy="15" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function RocketSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M40 10C40 10 55 25 55 50C55 65 50 75 40 85C30 75 25 65 25 50C25 25 40 10 40 10Z" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <circle cx="40" cy="42" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M25 55L15 65L25 70" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 55L65 65L55 70" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 85L40 95L45 85" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CodeSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="110" height="70" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="5" y1="18" x2="115" y2="18" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <circle cx="14" cy="12" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="22" cy="12" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="30" cy="12" r="2" fill="currentColor" opacity="0.3" />
      <polyline points="25,42 15,50 25,58" stroke="currentColor" strokeWidth="2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="55,42 65,50 55,58" stroke="currentColor" strokeWidth="2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="35" y1="60" x2="45" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      <rect x="75" y="28" width="30" height="4" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="75" y="36" width="22" height="4" rx="2" fill="currentColor" opacity="0.1" />
      <rect x="75" y="44" width="28" height="4" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="75" y="52" width="18" height="4" rx="2" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function TimelineSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 60" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="30" x2="380" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="60" cy="30" r="6" fill="currentColor" opacity="0.7" />
      <circle cx="150" cy="30" r="6" fill="currentColor" opacity="0.7" />
      <circle cx="240" cy="30" r="6" fill="currentColor" opacity="0.5" />
      <circle cx="330" cy="30" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="60" y1="30" x2="150" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="150" y1="30" x2="240" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="240" y1="30" x2="330" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4 3" />
    </svg>
  );
}

export function WalletSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 80" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="80" height="50" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <rect x="60" y="38" width="30" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" fill="currentColor" fillOpacity="0.05" />
      <circle cx="75" cy="46" r="3" fill="currentColor" opacity="0.5" />
      <path d="M15 20L50 8L85 20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
    </svg>
  );
}
