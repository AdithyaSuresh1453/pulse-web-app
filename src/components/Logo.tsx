/*interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 10 C35 10, 25 18, 20 30 C15 42, 15 60, 20 72 C23 80, 28 88, 35 93 L42 98 C45 100, 48 100, 50 100 C52 100, 55 100, 58 98 L65 93 C72 88, 77 80, 80 72 C85 60, 85 42, 80 30 C75 18, 65 10, 50 10 Z"
          stroke="#10B981"
          strokeWidth="3"
          fill="none"
          className="dark:stroke-green-400"
        />

        <ellipse
          cx="50"
          cy="35"
          rx="12"
          ry="15"
          fill="#2563EB"
          opacity="0.3"
          className="dark:fill-blue-400"
        />
        <ellipse
          cx="43"
          cy="32"
          rx="5"
          ry="6"
          fill="#2563EB"
          className="dark:fill-blue-400"
        />
        <ellipse
          cx="57"
          cy="32"
          rx="5"
          ry="6"
          fill="#2563EB"
          className="dark:fill-blue-400"
        />
        <path
          d="M40 42 Q50 48, 60 42"
          stroke="#2563EB"
          strokeWidth="2.5"
          fill="none"
          className="dark:stroke-blue-400"
        />

        <rect
          x="46"
          y="50"
          width="8"
          height="12"
          rx="4"
          fill="#2563EB"
          className="dark:fill-blue-400"
        />
        <rect
          x="44"
          y="62"
          width="12"
          height="4"
          rx="2"
          fill="#2563EB"
          className="dark:fill-blue-400"
        />
        <circle
          cx="50"
          cy="54"
          r="2"
          fill="white"
          opacity="0.6"
        />

        <path
          d="M45 88 L40 95 L42 95 L42 100 L48 92 L46 92 Z"
          fill="#10B981"
          className="dark:fill-green-400"
        />
        <circle
          cx="43"
          cy="90"
          r="4"
          fill="#10B981"
          className="dark:fill-green-400"
        />

        <path
          d="M15 50 L20 48 L23 52 L28 46 L32 54 L37 50 L40 52"
          stroke="#FBCFE8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-pink-300"
        />

        <circle
          cx="15"
          cy="50"
          r="2"
          fill="#FBCFE8"
          className="dark:fill-pink-300"
        >
          <animate
            attributeName="r"
            values="2;4;2"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400 bg-clip-text text-transparent">
            Pulse
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400 -mt-1">
            Keep a Beat on Your Belongings
          </span>
        </div>
      )}
    </div>
  );
}*/

/*import logoImg from "@/assets/neardear-logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" };

const Logo = ({ size = "md", showText = true }: LogoProps) => (
  <div className="flex items-center gap-2.5">
    <img src={logoImg} alt="NearDear logo" className={`${sizes[size]} object-contain`} />
    {showText && (
      <div className="flex flex-col leading-none">
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">
          Near<span className="text-gradient-primary">Dear</span>
        </span>
        <span className="text-[10px] font-body text-muted-foreground tracking-widest uppercase">
          Always close to you
        </span>
      </div>
    )}
  </div>
);

export default Logo;*/

import { Home } from 'lucide-react';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

const Logo = ({ size = 40, showText = true }: LogoProps) => {
  return (
    <div className="flex items-center gap-3">
      <div 
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
        style={{ width: size, height: size }}
      >
        <Home style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
      {showText && (
        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
          Pulse
        </span>
      )}
    </div>
  );
};

export default Logo;