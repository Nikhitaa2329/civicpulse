import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Clock, AlertTriangle, CheckCircle,
  Plus, ChevronRight, Users, FileText
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../utils/api';

const STATUS_CONFIG = {
  pending_validation: {
    label: 'Awaiting Validation',
    color: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    icon: Clock,
  },
  open: {
    label: 'Open',
    color: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    icon: FileText,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  overdue: {
    label: 'Overdue — Action Required',
    color: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
  pending_verification: {
    label: 'Verify Fix',
    color: 'bg-purple-50 text-purple-700',
    dot: 'bg-purple-500',
    icon: CheckCircle,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-50 text-green-700',
    dot: 'bg-green-500',
    icon: CheckCircle,
  },
  reopened: {
    label: 'Reopened',
    color: 'bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
    icon: AlertTriangle,
  },
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

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchMyComplaints = async () => {
      try {
        const response = await api.get('/complaints/my-complaints');
        setComplaints(response.data);
      } catch {
        // Silent fail — user sees empty state
      } finally {
        setLoading(false);
      }
    };
    fetchMyComplaints();
  }, []);

  const filteredComplaints = filter === 'all'
    ? complaints
    : complaints.filter(c => c.status === filter);

  // Compute summary stats
  const stats = {
    total: complaints.length,
    active: complaints.filter(c =>
      ['pending_validation', 'open', 'in_progress', 'overdue'].includes(c.status)
    ).length,
    needsAction: complaints.filter(c =>
      ['overdue', 'pending_verification'].includes(c.status)
    ).length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
      My Reports
    </h1>
    <p className="text-slate-500 text-sm mt-1">
      Track the status of civic issues you've reported
    </p>
  </div>
  <div className="flex items-center gap-3">
    {/* ADD THIS */}
    <Link
      to="/"
      className="text-sm text-slate-400 hover:text-slate-600 transition-colors hidden sm:block"
    >
      ← Live map
    </Link>
    <Link
      to="/file-complaint"
      className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
    >
      <Plus className="w-4 h-4" />
      New report
    </Link>
  </div>
</div>

        {/* Stats row */}
        {!loading && complaints.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Total filed
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-2xl font-black text-blue-600">{stats.active}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Active
              </p>
            </div>
            <div className={`border rounded-lg px-4 py-3 ${
              stats.needsAction > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-slate-200'
            }`}>
              <p className={`text-2xl font-black ${
                stats.needsAction > 0 ? 'text-red-600' : 'text-slate-900'
              }`}>
                {stats.needsAction}
              </p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Need action
              </p>
            </div>
          </div>
        )}

        {/* Needs action banner */}
        {stats.needsAction > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              {complaints.filter(c => c.status === 'pending_verification').length > 0 && (
                <span>
                  You have complaints awaiting your verification — officials have submitted proof of fix.{' '}
                </span>
              )}
              {complaints.filter(c => c.status === 'overdue').length > 0 && (
                <span>
                  {complaints.filter(c => c.status === 'overdue').length} complaint(s) have missed their SLA deadline.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Filter tabs */}
        {complaints.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending_validation', label: 'Pending' },
              { key: 'open', label: 'Open' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'pending_verification', label: 'Verify Fix' },
              { key: 'resolved', label: 'Resolved' },
            ].map(({ key, label }) => {
              const count = key === 'all'
                ? complaints.length
                : complaints.filter(c => c.status === key).length;
              if (count === 0 && key !== 'all') return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    filter === key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label} {count > 0 && <span className="opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <p className="text-slate-400">Loading your reports...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && complaints.length === 0 && (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
            <MapPin className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-700 font-bold mb-1">No reports yet</h3>
            <p className="text-slate-400 text-sm mb-5">
              Spot a civic issue? Report it and your neighbours will confirm it.
            </p>
            <Link
              to="/file-complaint"
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-5 py-2.5 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              File your first report
            </Link>
          </div>
        )}

        {/* Complaint list */}
        {!loading && filteredComplaints.length > 0 && (
          <div className="space-y-3">
            {filteredComplaints.map((complaint) => {
              const config = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;

              return (
                <Link
                  key={complaint._id}
                  to={`/complaints/${complaint._id}`}
                  className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Category + status */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {CATEGORY_LABELS[complaint.category] || complaint.category}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${config.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          {config.label}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-slate-900 text-sm leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                        {complaint.title}
                      </h3>

                      {/* Meta */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {complaint.location?.address && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="w-3 h-3" />
                            {complaint.location.address}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {formatDate(complaint.createdAt)}
                        </span>
                        {complaint.affectedCount > 1 && (
                          <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                            <Users className="w-3 h-3" />
                            {complaint.affectedCount} affected
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
                  </div>

                  {/* Special banners for actionable statuses */}
                  {complaint.status === 'pending_verification' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <p className="text-xs text-purple-700 font-medium">
                        Official has submitted proof of fix — tap to verify
                      </p>
                    </div>
                  )}

                  {complaint.status === 'overdue' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600 font-medium">
                        SLA deadline missed — this issue is publicly flagged as overdue
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty filtered state */}
        {!loading && complaints.length > 0 && filteredComplaints.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No complaints with status "{filter}"
          </div>
        )}
      </div>
    </div>
  );
}