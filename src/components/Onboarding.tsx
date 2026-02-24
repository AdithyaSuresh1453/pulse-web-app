import { useState } from 'react';
import { Mic, MapPin, Bell, Shield, ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: Mic,
    iconColor: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-100 via-purple-50 to-blue-100',
    title: 'Voice-Activated Assistant',
    description: 'Simply speak to find your belongings. Ask "Where are my keys?" and get instant answers.',
    illustration: '🎤',
  },
  {
    icon: MapPin,
    iconColor: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-100 via-pink-50 to-purple-100',
    title: 'Track Your Items',
    description: 'Keep tabs on your keys, wallet, phone, and important items with real-time location tracking.',
    illustration: '📍',
  },
  {
    icon: Bell,
    iconColor: 'from-orange-500 to-orange-600',
    bgGradient: 'from-orange-100 via-yellow-50 to-orange-100',
    title: 'Smart Alerts',
    description: 'Get notified when items are left behind or when unusual activity is detected at home.',
    illustration: '🔔',
  },
  {
    icon: Shield,
    iconColor: 'from-green-500 to-green-600',
    bgGradient: 'from-green-100 via-emerald-50 to-green-100',
    title: 'Privacy & Safety First',
    description: 'Your data is secure and private. Camera alerts and location data stay on your device.',
    illustration: '🛡️',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const goTo = (index: number) => {
    setCurrentSlide(index);
    setAnimKey((k) => k + 1);
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      goTo(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.05); }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg);  }
          25%       { transform: rotate(8deg);  }
          75%       { transform: rotate(-8deg); }
        }
        .slide-in    { animation: slideIn    0.4s ease both; }
        .pulse-slow  { animation: pulse-slow 2.5s ease-in-out infinite; }
        .wobble      { animation: wobble     3s ease-in-out infinite;   }
      `}</style>

      {/* Skip */}
      <div className="p-4 flex justify-end">
        <button
          onClick={onComplete}
          className="text-sm text-gray-500 hover:text-gray-800 transition px-3 py-1 rounded-lg hover:bg-gray-100"
        >
          Skip
        </button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div key={animKey} className="slide-in w-full max-w-md text-center">

          {/* Illustration box */}
          <div
            className={`w-64 h-64 mx-auto mb-8 rounded-[3rem] bg-gradient-to-br ${slide.bgGradient} flex items-center justify-center shadow-lg pulse-slow`}
          >
            <span className="text-8xl wobble inline-block">{slide.illustration}</span>
          </div>

          {/* Icon badge */}
          <div
            className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${slide.iconColor} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">{slide.title}</h2>
          <p className="text-lg text-gray-600 leading-relaxed">{slide.description}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 space-y-6">
        {/* Dots */}
        <div className="flex gap-2 justify-center">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'w-8 bg-gradient-to-r from-blue-600 to-purple-600'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Next / Get Started */}
        <button
          onClick={handleNext}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 hover:from-blue-700 hover:via-purple-700 hover:to-green-700 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
        >
          {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}