import { Link } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Brand strip */}
      <div className="bg-slate-900 py-6 flex justify-center">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-1.5 rounded">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">
            Civic<span className="text-blue-400">Pulse</span>
          </span>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-8xl font-black text-slate-200 mb-4">404</p>
          <h1 className="text-xl font-black text-slate-900 mb-2">
            Page not found
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-bold px-6 py-2.5 rounded text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to live map
          </Link>
        </div>
      </div>
    </div>
  );
}