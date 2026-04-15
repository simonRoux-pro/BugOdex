export default function LoadingScreen({ message = 'Identification en cours…' }) {
  return (
    <div className="fixed inset-0 z-50 bg-forest-900/90 flex flex-col items-center justify-center gap-6 text-white">
      {/* Scanning animation */}
      <div className="relative w-48 h-48">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-forest-400/30" />
        {/* Spinning arc */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-forest-400 animate-spin" />
        {/* Inner ring */}
        <div className="absolute inset-4 rounded-full border border-forest-500/40" />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl animate-pulse">🔍</span>
        </div>
        {/* Scan line */}
        <div
          className="absolute left-0 right-0 h-0.5 bg-forest-400/60 animate-scan"
          style={{ top: '50%' }}
        />
      </div>

      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-forest-200">{message}</p>
        <p className="text-sm text-forest-400">Analyse de l'image par IA…</p>
      </div>

      <style>{`
        @keyframes scan {
          0%   { transform: translateY(-96px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(96px); opacity: 0; }
        }
        .animate-scan { animation: scan 2s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
