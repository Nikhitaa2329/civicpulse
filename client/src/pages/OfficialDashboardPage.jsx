import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, BarChart2,
  ChevronRight, Users, MapPin, Zap
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../utils/api';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
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

export default function OfficialDashboardPage() {
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [assignError, setAssignError] = useState('');
  const [activeTab, setActiveTab] = useState('queue');
  const [myPincodes, setMyPincodes] = useState([]);


  const fetchPriorityQueue = async () => {
    try {
      const response = await api.get('/insights/priority-queue');
      setPriorityQueue(response.data.queue || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const fetchMyProfile = async () => {
  try {
    const response = await api.get('/auth/profile');
    setMyPincodes(response.data.assignedPincodes || []);
  } catch {
    // silent fail — dashboard still works without this
  }
};
  useEffect(() => {
    fetchPriorityQueue();
    fetchMyProfile();

  }, []);

  const handleAssign = async (complaintId) => {
    setAssigning(complaintId);
    setAssignError('');
    try {
      await api.put(`/complaints/${complaintId}/assign`);
      // Refresh the queue after assignment
      await fetchPriorityQueue();
    } catch (err) {
      setAssignError(
        err.response?.data?.message || 'Could not assign complaint'
      );
    } finally {
      setAssigning(null);
    }
  };

  // Stats from queue data
  const stats = {
    total: priorityQueue.length,
    overdue: priorityQueue.filter(c => c.status === 'overdue').length,
    open: priorityQueue.filter(c => c.status === 'open').length,
    inProgress: priorityQueue.filter(c => c.status === 'in_progress').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
       {/* Header */}
<div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
      Official Dashboard
    </h1>
    <p className="text-slate-500 text-sm mt-1">
      Priority-ranked civic complaints requiring your attention
    </p>
    {myPincodes.length > 0 ? (
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">Your wards:</span>
        {myPincodes.map((pincode) => (
          <span
            key={pincode}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded"
          >
            <MapPin className="w-3 h-3" />
            {pincode}
          </span>
        ))}
      </div>
    ) : (
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
          No ward restriction — viewing all areas
        </span>
      </div>
    )}
  </div>
  <Link
    to="/"
    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
  >
    ← Live map
  </Link>
</div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Active
              </p>
            </div>
            <div className={`border rounded-lg px-4 py-3 ${
              stats.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
            }`}>
              <p className={`text-2xl font-black ${
                stats.overdue > 0 ? 'text-red-600' : 'text-slate-900'
              }`}>
                {stats.overdue}
              </p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Overdue
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-2xl font-black text-blue-600">{stats.open}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Unassigned
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-2xl font-black text-amber-600">{stats.inProgress}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                In Progress
              </p>
            </div>
          </div>
        )}

        {/* Overdue alert */}
        {stats.overdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              {stats.overdue} complaint{stats.overdue > 1 ? 's have' : ' has'} breached SLA —
              these are publicly visible as overdue on the civic map
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-4 border-b border-slate-200 pb-0">
          {[
            { key: 'queue', label: 'Priority Queue', icon: BarChart2 },
            { key: 'overdue', label: `Overdue ${stats.overdue > 0 ? `(${stats.overdue})` : ''}`, icon: AlertTriangle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {assignError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 text-sm">
            {assignError}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-slate-400">
            Loading priority queue...
          </div>
        )}

        {/* Empty state */}
        {!loading && priorityQueue.length === 0 && (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
            <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-4" />
            <h3 className="text-slate-700 font-bold mb-1">All clear</h3>
            <p className="text-slate-400 text-sm">
              No active complaints in the queue right now
            </p>
          </div>
        )}

        {/* Priority Queue */}
        {!loading && activeTab === 'queue' && priorityQueue.length > 0 && (
          <div className="space-y-3">
            {priorityQueue.map((complaint, index) => {
              const config = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;
              const isOverdue = complaint.status === 'overdue';
              const isOpen = complaint.status === 'open';

              return (
                <div
                  key={complaint.complaintId}
                  className={`bg-white border rounded-lg p-4 ${
                    isOverdue
                      ? 'border-red-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority rank */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded font-black text-sm flex items-center justify-center ${
                      index === 0
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>

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
                      <h3 className="font-bold text-slate-900 text-sm leading-snug mb-2">
                        {complaint.title}
                      </h3>

                      {/* Meta */}
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        {complaint.location?.address && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="w-3 h-3" />
                            {complaint.location.address}
                          </span>
                        )}
                        {complaint.affectedCount > 1 && (
                          <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                            <Users className="w-3 h-3" />
                            {complaint.affectedCount} affected
                          </span>
                        )}
                      </div>

                      {/* Priority score breakdown */}
                      <div className="bg-slate-50 rounded px-3 py-2 mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Priority Score
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {complaint.priorityScore}
                          </span>
                        </div>
                        {complaint.breakdown && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-slate-400">
                              Category: <span className="font-semibold text-slate-600">{complaint.breakdown.categoryWeight}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              Validations: <span className="font-semibold text-slate-600">{complaint.breakdown.communityValidations}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              Affected: <span className="font-semibold text-slate-600">{complaint.breakdown.affectedCitizens}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              Age: <span className="font-semibold text-slate-600">{complaint.breakdown.ageInDays}d</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/complaints/${complaint.complaintId}`}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          View details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>

                        {isOpen && (
                          <button
                            onClick={() => handleAssign(complaint.complaintId)}
                            disabled={assigning === complaint.complaintId}
                            className="ml-auto flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                          >
                            {assigning === complaint.complaintId ? (
                              'Assigning...'
                            ) : (
                              'Accept & Assign to me'
                            )}
                          </button>
                        )}

                        {isOverdue && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-red-500 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Publicly flagged as overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overdue tab */}
        {!loading && activeTab === 'overdue' && (
          <div>
            {priorityQueue.filter(c => c.status === 'overdue').length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
                <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">No overdue complaints</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priorityQueue
                  .filter(c => c.status === 'overdue')
                  .map((complaint) => (
                    <Link
                      key={complaint.complaintId}
                      to={`/complaints/${complaint.complaintId}`}
                      className="block bg-red-50 border border-red-200 rounded-lg p-4 hover:border-red-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                            {CATEGORY_LABELS[complaint.category]}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm mt-1">
                            {complaint.title}
                          </h3>
                          {complaint.location?.address && (
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {complaint.location.address}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-red-300 flex-shrink-0 mt-1" />
                      </div>
                      <div className="mt-2 pt-2 border-t border-red-100 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <p className="text-xs text-red-600 font-medium">
                          Publicly visible as overdue — priority score: {complaint.priorityScore}
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}