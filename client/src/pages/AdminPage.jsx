import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Plus, Eye, EyeOff, CheckCircle,
  AlertCircle, MapPin, X, GitMerge, Repeat, Download
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../utils/api';

function MergeClusterCard({ cluster, onMerge, merging }) {
  const [selectedMaster, setSelectedMaster] = useState(cluster.complaintIds[0]);

  const handleMergeClick = () => {
    const duplicateIds = cluster.complaintIds.filter((id) => id !== selectedMaster);
    onMerge(selectedMaster, duplicateIds);
  };

  return (
    <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
          {cluster._id.category?.replace(/_/g, ' ')} · {cluster.count} reports clustered
        </span>
        <button
          onClick={handleMergeClick}
          disabled={merging === cluster._id.category}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
        >
          {merging === cluster._id.category ? 'Merging...' : 'Merge selected'}
        </button>
      </div>

      <p className="text-xs text-purple-600 mb-3">
        Select which report should become the master complaint:
      </p>

      <div className="space-y-2">
        {cluster.titles.map((title, index) => {
          const complaintId = cluster.complaintIds[index];
          const isMaster = selectedMaster === complaintId;

          return (
            <label
              key={complaintId}
              className={`flex items-center gap-3 bg-white rounded p-3 border cursor-pointer transition-colors ${
                isMaster ? 'border-purple-400 ring-1 ring-purple-300' : 'border-purple-100'
              }`}
            >
              <input
                type="radio"
                name={`master-${cluster._id.roundedLat}-${cluster._id.roundedLng}`}
                checked={isMaster}
                onChange={() => setSelectedMaster(complaintId)}
                className="accent-purple-600"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{title}</p>
                {isMaster && (
                  <span className="text-xs text-purple-600 font-semibold">
                    Will become master
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    assignedPincodes: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [suspiciousPatterns, setSuspiciousPatterns] = useState([]);
  const [loadingSuspicious, setLoadingSuspicious] = useState(true);
  const [escalationStats, setEscalationStats] = useState(null);
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [loadingMerges, setLoadingMerges] = useState(true);
  const [merging, setMerging] = useState(null);
  const [mergeError, setMergeError] = useState('');
  const [recurringIssues, setRecurringIssues] = useState([]);
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const [allComplaints, setAllComplaints] = useState([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const assignedPincodes = formData.assignedPincodes
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length === 6 && /^\d+$/.test(p));

    setLoading(true);
    try {
      const response = await api.post('/auth/create-official', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        assignedPincodes,
      });
      setSuccess(response.data);
      setFormData({ name: '', email: '', password: '', assignedPincodes: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create official account');
    } finally {
      setLoading(false);
    }
  };

  const fetchMergeCandidates = async () => {
  try {
    const response = await api.get('/insights/merge-candidates');
    setMergeCandidates(response.data.candidates || []);
  } catch {
    // silent fail
  } finally {
    setLoadingMerges(false);
  }
};

const fetchRecurringIssues = async () => {
  try {
    const response = await api.get('/insights/recurring-issues');
    setRecurringIssues(response.data.issues || []);
  } catch {
    // silent fail
  } finally {
    setLoadingRecurring(false);
  }
};

const handleMerge = async (masterId, duplicateIds) => {
  setMerging(masterId);
  setMergeError('');
  try {
    await api.post('/insights/merge', { masterId, duplicateIds });
    await fetchMergeCandidates();
  } catch (err) {
    setMergeError(err.response?.data?.message || 'Could not merge complaints');
  } finally {
    setMerging(null);
  }
};

  const fetchSuspiciousPatterns = async () => {
    try {
      const response = await api.get('/validations/suspicious');
      setSuspiciousPatterns(response.data.patterns || []);
    } catch {
      // silent fail
    } finally {
      setLoadingSuspicious(false);
    }
  };
  const fetchEscalationStats = async () => {
  try {
    const response = await api.get('/insights/escalation-stats');
    setEscalationStats(response.data);
  } catch {
    // silent fail
  }
};

const fetchAllComplaints = async () => {
  try {
    const response = await api.get('/complaints');
    setAllComplaints(response.data);
  } catch {
    // silent fail
  }
};
const handleGenerateReport = async () => {
  setGeneratingReport(true);
  try {
    const { generateAnalyticsPDF } = await import('../utils/generateAnalyticsPDF');
    await generateAnalyticsPDF({
      complaints: allComplaints,
      escalationStats,
      recurringIssues,
      generatedBy: 'CivicPulse Admin',
    });
  } catch (error) {
    console.error('Report generation failed:', error);
  } finally {
    setGeneratingReport(false);
  }
};

 useEffect(() => {
  fetchSuspiciousPatterns();
  fetchEscalationStats();
  fetchMergeCandidates();
  fetchRecurringIssues();
  fetchAllComplaints();
}, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
  <div>
    <div className="flex items-center gap-2 mb-1">
      <Shield className="w-5 h-5 text-slate-700" />
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">
        Admin Panel
      </h1>
    </div>
    <p className="text-slate-500 text-sm">
      Create and manage official accounts for ward officers
    </p>
  </div>
  <div className="flex items-center gap-3">
    <button
      onClick={handleGenerateReport}
      disabled={generatingReport}
      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm transition-colors disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      {generatingReport ? 'Generating...' : 'Download Report'}
    </button>
    <Link to="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
      ← Live map
    </Link>
  </div>
</div>
        {/* Escalation Stats */}
{escalationStats && (
  <div className="grid grid-cols-3 gap-3 mb-6">
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-2xl font-black text-slate-900">
        {escalationStats.currentlyOverdue}
      </p>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
        Currently Overdue
      </p>
    </div>
    <div className={`border rounded-lg px-4 py-3 ${
      escalationStats.escalatedComplaints > 0
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-slate-200'
    }`}>
      <p className={`text-2xl font-black ${
        escalationStats.escalatedComplaints > 0
          ? 'text-amber-600'
          : 'text-slate-900'
      }`}>
        {escalationStats.escalatedComplaints}
      </p>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
        Ever Escalated
      </p>
    </div>
    <div className={`border rounded-lg px-4 py-3 ${
      escalationStats.lowCredibilityOfficials?.length > 0
        ? 'bg-red-50 border-red-200'
        : 'bg-white border-slate-200'
    }`}>
      <p className={`text-2xl font-black ${
        escalationStats.lowCredibilityOfficials?.length > 0
          ? 'text-red-600'
          : 'text-slate-900'
      }`}>
        {escalationStats.lowCredibilityOfficials?.length || 0}
      </p>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
        Low Credibility
      </p>
    </div>
  </div>
)}

{/* Low credibility officials list */}
{escalationStats?.lowCredibilityOfficials?.length > 0 && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
      Officials with credibility below 90
    </p>
    {escalationStats.lowCredibilityOfficials.map((official) => (
      <div
        key={official._id}
        className="flex items-center justify-between py-2 border-b border-red-100 last:border-0"
      >
        <div>
          <p className="text-sm font-medium text-slate-800">{official.name}</p>
          <p className="text-xs text-slate-400">{official.email}</p>
        </div>
        <span className={`text-sm font-black px-2 py-1 rounded ${
          official.credibilityScore < 80
            ? 'bg-red-200 text-red-800'
            : 'bg-amber-100 text-amber-800'
        }`}>
          {official.credibilityScore}
        </span>
      </div>
    ))}
  </div>
)}
        {/* Create Official Form */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Official Account
          </h2>

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Official account created</p>
                    <p className="text-xs text-green-600 mt-1">
                      <span className="font-semibold">{success.name}</span> ({success.email})
                      can now log in with the password you set.
                    </p>
                    {success.assignedPincodes?.length > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Assigned pincodes: {success.assignedPincodes.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Full name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                placeholder="Ward Officer Name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                placeholder="officer@corporation.gov.in"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-10"
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Assigned Pincodes
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  name="assignedPincodes"
                  value={formData.assignedPincodes}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  placeholder="600028, 600017, 600040"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Comma-separated 6-digit pincodes this officer is responsible for.
                Used for automatic complaint routing to the right officer.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold py-2.5 rounded text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create official account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Suspicious Validation Patterns */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Suspicious Validation Patterns
            </h2>
            <button
              onClick={fetchSuspiciousPatterns}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>

          {loadingSuspicious ? (
            <p className="text-sm text-slate-400">Checking patterns...</p>
          ) : suspiciousPatterns.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">
                  No suspicious patterns detected
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  All validators have confirmed complaints from multiple different filers
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-3">
                The following validators have only ever confirmed complaints filed by
                a single person — this may indicate coordinated validation.
                Review manually before taking action.
              </p>
              {suspiciousPatterns.map((pattern) => (
                <div
                  key={pattern._id}
                  className="border border-amber-200 bg-amber-50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {pattern.validatorName}
                        <span className="text-xs text-slate-400 font-normal ml-2">
                          {pattern.validatorEmail}
                        </span>
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Validated <span className="font-bold">{pattern.totalValidations}</span> complaints —
                        all filed by the same person
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      {pattern.totalValidations}x same filer
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs text-slate-500">
                      Always validated complaints filed by:{' '}
                      <span className="font-semibold text-slate-700">{pattern.filerName}</span>
                      <span className="text-slate-400 ml-1">({pattern.filerEmail})</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
       </div>
        {/* ↑ this closes Suspicious Validation Patterns */}

        {/* Merge Candidates — ADD THIS ENTIRE BLOCK */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-purple-500" />
              Potential Duplicate Complaints
            </h2>
            <button
              onClick={fetchMergeCandidates}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>

          {mergeError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mb-4 text-xs">
              {mergeError}
            </div>
          )}

          {loadingMerges ? (
            <p className="text-sm text-slate-400">Checking for duplicates...</p>
          ) : mergeCandidates.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">No duplicate clusters detected</p>
                <p className="text-xs text-green-600 mt-0.5">
                  All recent complaints appear to be distinct issues
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 mb-3">
                These complaints share the same category and are clustered in roughly the same
                location — likely duplicate reports of the same underlying issue. Select which
                one should become the master, the rest will merge into it.
              </p>
              {mergeCandidates.map((cluster, clusterIndex) => (
                <MergeClusterCard
                  key={clusterIndex}
                  cluster={cluster}
                  onMerge={handleMerge}
                  merging={merging}
                />
              ))}
            </div>
          )}
       </div>
        {/* ↑ END of Merge Candidates block */}

        {/* Recurring Issues — structural problems beyond routine maintenance */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Repeat className="w-4 h-4 text-orange-500" />
              Recurring Issues
            </h2>
            <button
              onClick={fetchRecurringIssues}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>

          {loadingRecurring ? (
            <p className="text-sm text-slate-400">Checking for recurring patterns...</p>
          ) : recurringIssues.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">No recurring issues detected</p>
                <p className="text-xs text-green-600 mt-0.5">
                  No location has had 3+ complaints of the same type in the last 6 months
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-3">
                These locations have had repeated complaints of the same type over the last
                6 months — likely a structural problem (broken drain, faulty wiring) rather
                than a one-off issue. Consider escalating to a zonal engineer for a permanent fix.
              </p>
              {recurringIssues.map((issue, index) => (
                <div
                  key={index}
                  className="border border-orange-200 bg-orange-50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                          {issue._id.category?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-black text-orange-800 bg-orange-200 px-2 py-0.5 rounded">
                          {issue.count}× reported
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mb-1">
                        {issue.sampleAddress || 'Location data unavailable'}
                      </p>
                      <p className="text-xs text-slate-400">
                        First reported {new Date(issue.firstReported).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })} · Most recent {new Date(issue.lastReported).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {issue.titles?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1.5">
                        Past reports
                      </p>
                      <ul className="space-y-1">
                        {issue.titles.map((title, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            · {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* ↑ END of Recurring Issues block */}

      </div>
    </div>
  );
}