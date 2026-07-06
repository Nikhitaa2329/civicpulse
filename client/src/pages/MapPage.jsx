import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { AlertTriangle, Clock, CheckCircle, Activity, X } from 'lucide-react';import Navbar from '../components/Navbar';
import api from '../utils/api';

const STATUS_COLORS = {
  pending_validation: '#94A3B8',
  open: '#3B82F6',
  in_progress: '#F59E0B',
  overdue: '#EF4444',
  pending_verification: '#8B5CF6',
  reopened: '#F97316',
  resolved: '#22C55E',
};

const CATEGORY_LABELS = {
  waterlogging: 'Waterlogging',
  power_outage: 'Power Outage',
  broken_road: 'Broken Road',
  garbage: 'Garbage',
  streetlight: 'Streetlight',
  water_supply: 'Water Supply',
  open_manhole: 'Open Manhole',
  other: 'Other',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending_validation', label: 'Pending' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending_verification', label: 'Awaiting Verify' },
  { key: 'reopened', label: 'Reopened' },
];
  
export default function MapPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showIntro, setShowIntro] = useState(() => {
  // Only show if the user hasn't dismissed it before
  // localStorage persists the dismissal across page reloads
  return localStorage.getItem('civicpulse_intro_dismissed') !== 'true';
});

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const response = await api.get('/complaints/map-data');
        setComplaints(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, []);

  const handleDismissIntro = () => {
  setShowIntro(false);
  localStorage.setItem('civicpulse_intro_dismissed', 'true');
};
  const filteredComplaints = activeFilter === 'all'
    ? complaints
    : complaints.filter(c => c.status === activeFilter);

  // Compute stats from real data
  const stats = {
    total: complaints.length,
    overdue: complaints.filter(c => c.status === 'overdue').length,
    open: complaints.filter(c => c.status === 'open').length,
    inProgress: complaints.filter(c => c.status === 'in_progress').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading civic data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
    <Navbar />

      {/* Stat bar — the signature element */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-xs uppercase tracking-wider">
              Live Issues
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xl">{stats.total}</span>
              <span className="text-slate-400 text-xs">active</span>
            </div>

            <div className="w-px h-4 bg-slate-600" />

            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-bold text-sm">{stats.overdue}</span>
              <span className="text-slate-500 text-xs">overdue</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-bold text-sm">{stats.open}</span>
              <span className="text-slate-500 text-xs">awaiting action</span>
            </div>

            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400 font-bold text-sm">{stats.inProgress}</span>
              <span className="text-slate-500 text-xs">in progress</span>
            </div>
          </div>

          {stats.overdue > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-red-900/40 border border-red-800 rounded px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 text-xs font-medium">
                {stats.overdue} issue{stats.overdue > 1 ? 's have' : ' has'} missed deadline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Landing context strip — dismissible, shown to first-time visitors */}
{showIntro && (
  <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
    <div className="flex items-start justify-between gap-4 max-w-5xl mx-auto">
      <div className="flex-1">
        <p className="text-sm font-bold text-blue-800 mb-1">
          How CivicPulse works
        </p>
        <p className="text-xs text-blue-600 leading-relaxed">
          Citizens report civic issues — neighbours confirm them are real before officials
          act — officials are held to public deadlines — citizens verify the fix is genuine.
          Every overdue complaint stays visible here until it's actually resolved.
        </p>
      </div>
      <button
        onClick={handleDismissIntro}
        className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors p-1"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
)}

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-1.5">
        <span className="text-slate-400 text-xs mr-2 uppercase tracking-wider">Filter</span>
        {FILTERS.map((filter) => {
  const count = filter.key === 'all'
    ? complaints.length
    : complaints.filter(c => c.status === filter.key).length;

  // ADD THIS ONE LINE:
  if (count === 0 && filter.key !== 'all') return null;

  return (
    <button
      key={filter.key}
      onClick={() => setActiveFilter(filter.key)}
      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
        activeFilter === filter.key
          ? 'bg-slate-900 text-white'
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {filter.label}
      {count > 0 && (
        <span className={`ml-1.5 ${
          activeFilter === filter.key ? 'text-slate-400' : 'text-slate-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
})}
      </div>

      {/* Map */}
     <div className="flex-1 relative">
   <MapContainer
  center={[13.0827, 80.2707]}
  zoom={12}
    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredComplaints.map((complaint) => (
            <CircleMarker
              key={complaint._id}
              center={[complaint.location.lat, complaint.location.lng]}
              radius={complaint.affectedCount > 1 ? 10 + complaint.affectedCount : 8}
              pathOptions={{
                color: STATUS_COLORS[complaint.status] || '#94A3B8',
                fillColor: STATUS_COLORS[complaint.status] || '#94A3B8',
                fillOpacity: 0.85,
                weight: complaint.status === 'overdue' ? 2 : 1,
              }}
            >
              <Popup>
  <div className="min-w-48 p-1">
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-xs font-bold px-2 py-0.5 rounded text-white uppercase tracking-wide"
        style={{ backgroundColor: STATUS_COLORS[complaint.status] }}
      >
        {complaint.status.replace(/_/g, ' ')}
      </span>
      {complaint.affectedCo1unt > 1 && (
        <span className="text-xs text-slate-500">
          {complaint.affectedCount} affected
        </span>
      )}
    </div>
    <p className="font-bold text-slate-800 text-sm">
      {CATEGORY_LABELS[complaint.category] || complaint.category}
    </p>
    <p className="text-xs text-slate-500 mt-1">
      {complaint.location.address}
    </p>
    <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-2">
      Filed {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      })}
    </p>
    {/* ADD THIS — the missing link */}
    
    <a href={`/complaints/${complaint._id}`}
      className="mt-2 block text-xs font-semibold text-blue-600 hover:underline"
    >
      {complaint.status === 'pending_validation'
        ? 'View & Validate →'
        : 'View details →'
      }
    </a>
  </div>
</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center gap-5">
        <span className="text-slate-400 text-xs uppercase tracking-wider">Legend</span>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-slate-500 capitalize">
              {status.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}