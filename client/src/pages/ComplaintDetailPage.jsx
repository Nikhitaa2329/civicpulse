import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, User, CheckCircle,
  AlertTriangle, Camera, Calendar, Users, Loader,
  Shield, Upload, ThumbsUp, ThumbsDown, Download
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { generateComplaintPDF } from '../utils/generateComplaintPDF';

const STATUS_CONFIG = {
  pending_validation: {
    label: 'Pending Validation',
    color: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  },
  open: {
    label: 'Open',
    color: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  pending_verification: {
    label: 'Pending Verification',
    color: 'bg-purple-50 text-purple-700',
    dot: 'bg-purple-500',
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-50 text-green-700',
    dot: 'bg-green-500',
  },
  reopened: {
    label: 'Reopened',
    color: 'bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
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
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isCitizen, isOfficial, isAdmin } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationSuccess, setValidationSuccess] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [validationCount, setValidationCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  // Proof of Fix state — official only
  const [showProofForm, setShowProofForm] = useState(false);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState('');

  // Verification voting state — citizen only
  const [voteSummary, setVoteSummary] = useState(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [voteSuccess, setVoteSuccess] = useState('');

  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  const fetchComplaint = async () => {
    try {
      const response = await api.get(`/complaints/${id}`);
      setComplaint(response.data);
    } catch {
      setError('Complaint not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationCount = async () => {
  try {
    const response = await api.get(`/validations/${id}/count`);
    setValidationCount(response.data.count);
  } catch {
    // silent fail
  } finally {
    setLoadingCount(false);
  }
};

const fetchVoteSummary = async () => {
  // Only fetch if the complaint is in pending_verification
  // No point querying the votes collection for other statuses
  if (!complaint || complaint.status !== 'pending_verification') return;
  setLoadingVotes(true);
  try {
    const response = await api.get(`/verifications/${id}/summary`);
    setVoteSummary(response.data);
  } catch {
    // silent fail — voting panel simply won't show vote counts
  } finally {
    setLoadingVotes(false);
  }
};

  useEffect(() => {
    fetchComplaint();
    fetchValidationCount();
  }, [id]);

  useEffect(() => {
  if (complaint) {
    fetchVoteSummary();
  }
}, [complaint?.status]); // re-runs whenever status changes
 
// Step 1 — detect user's GPS location
  const getUserLocation = () => {
    setLocating(true);
    setValidationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setValidationError('Could not detect your location — please enable GPS');
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Step 2 — submit validation with detected location
  const handleValidate = async () => {
    if (!userLocation) {
      getUserLocation();
      return;
    }
    setValidating(true);
    setValidationError('');
    try {
      await api.post(`/validations/${id}`, {
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
      setValidationSuccess('Confirmed — your validation has been recorded');
      await fetchComplaint(); // refresh timeline to show new entry
      await fetchValidationCount();
    } catch (err) {
      setValidationError(
        err.response?.data?.message ||
        'Could not validate — you may be too far from the issue location'
      );
    } finally {
      setValidating(false);
    }
  };
// Handles photo selection for proof of fix
const handleProofPhotoChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setProofPhoto(file);
  // Creates a temporary browser-local URL for image preview
  // URL.createObjectURL makes the file viewable without uploading it yet
  setProofPreview(URL.createObjectURL(file));
};

// Submits the after-photo as proof of fix
const handleSubmitProof = async (e) => {
  e.preventDefault(); // prevent default form submission behaviour
  if (!proofPhoto) {
    setProofError('Please attach a photo showing the fix');
    return;
  }
  setSubmittingProof(true);
  setProofError('');
  try {
    // Must use FormData — same reason as complaint filing
    // The request contains a binary file, which JSON cannot carry
    const formData = new FormData();
    formData.append('photo', proofPhoto);

    await api.put(`/complaints/${id}/resolve`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // Reset the form state
    setShowProofForm(false);
    setProofPhoto(null);
    setProofPreview(null);

    // Refresh the complaint — status is now pending_verification
    // The panel will disappear and the status badge will update
    await fetchComplaint();
  } catch (err) {
    setProofError(
      err.response?.data?.message || 'Failed to submit proof — please try again'
    );
  } finally {
    setSubmittingProof(false);
  }
};
const handleVote = async (vote) => {
  setVoting(true);
  setVoteError('');
  try {
    await api.post(`/verifications/${id}`, { vote });

    setVoteSuccess(
      vote === 'fixed'
        ? 'You confirmed this issue is fixed — thank you for verifying'
        : 'You reported this is not fixed — the complaint will be reviewed for reopening'
    );

    // Refresh both the complaint and the vote summary
    // If enough "not_fixed" votes crossed the threshold,
    // the complaint status will have changed to 'reopened'
    await fetchComplaint();
    await fetchVoteSummary();
  } catch (err) {
    setVoteError(
      err.response?.data?.message ||
      'Could not record your vote — you may not be eligible or may have already voted'
    );
  } finally {
    setVoting(false);
  }
};

const handleDownloadPDF = async () => {
  setGeneratingPDF(true);
  try {
    await generateComplaintPDF(complaint);
  } catch (error) {
    console.error('PDF generation failed:', error);
  } finally {
    setGeneratingPDF(false);
  }
};
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-500 mb-4">{error || 'Complaint not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:underline text-sm"
          >
            Back to map
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">

     <div className="flex items-center justify-between mb-6">
  <button
    onClick={() => navigate(-1)}
    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
  >
    <ArrowLeft className="w-4 h-4" />
    Back
  </button>

  <div className="flex items-center gap-3">
    {/* Download PDF button */}
    <button
      onClick={handleDownloadPDF}
      disabled={generatingPDF}
      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm transition-colors disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      {generatingPDF ? 'Generating...' : 'Download PDF'}
    </button>

    <Link
      to="/"
      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm transition-colors"
    >
      <MapPin className="w-3.5 h-3.5" />
      View on map
    </Link>
  </div>
</div>

 {/* PANEL 1 — Community Validation with Poll UI */}
{isAuthenticated && isCitizen &&
  ['pending_validation', 'open', 'in_progress', 'overdue'].includes(complaint.status) &&
  !validationSuccess && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold text-blue-800 mb-3">
          Community Validation
        </p>

        {/* Poll bar */}
        {!loadingCount && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-blue-700 font-semibold">
                {validationCount} neighbour{validationCount !== 1 ? 's' : ''} confirmed
              </span>
              <span className="text-xs text-blue-500">
                {validationCount >= 2 ? '✓ Threshold reached' : `${2 - validationCount} more needed to file`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  validationCount >= 2 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{
                  // Each validation fills a segment — capped at 100% visually
                  // but shows real number in the label above
                  width: validationCount === 0
                    ? '0%'
                    : validationCount === 1
                    ? '35%'
                    : validationCount === 2
                    ? '70%'
                    : `${Math.min(100, 70 + (validationCount - 2) * 10)}%`,
                }}
              />
            </div>

            {/* Tick marks at key thresholds */}
            <div className="flex items-center mt-1">
              <div className="flex-1 text-xs text-blue-400">Filed once 2+ confirm</div>
              {validationCount >= 5 && (
                <div className="text-xs text-blue-600 font-semibold">
                  Strong community signal
                </div>
              )}
              {validationCount >= 10 && (
                <div className="text-xs text-green-600 font-semibold">
                  High priority — {validationCount} witnesses
                </div>
              )}
            </div>
          </div>
        )}

        {/* Only show validation button if complaint still pending */}
        {complaint.status === 'pending_validation' && (
          <>
            <p className="text-xs text-blue-600 mb-3">
              If you're within 500m of this location and can see the issue,
              your confirmation helps it get officially filed faster.
            </p>

            {validationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mb-3 text-xs">
                {validationError}
              </div>
            )}

            {!userLocation ? (
              <button
                onClick={getUserLocation}
                disabled={locating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
              >
                {locating
                  ? <Loader className="w-4 h-4 animate-spin" />
                  : <MapPin className="w-4 h-4" />
                }
                {locating ? 'Detecting location...' : 'Detect my location first'}
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Location detected
                </div>
                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                >
                  {validating
                    ? <Loader className="w-4 h-4 animate-spin" />
                    : <CheckCircle className="w-4 h-4" />
                  }
                  {validating ? 'Confirming...' : 'Yes, I can confirm this issue'}
                </button>
              </div>
            )}
          </>
        )}

        {/* If already past pending_validation, just show the count */}
        {complaint.status !== 'pending_validation' && (
          <p className="text-xs text-blue-600">
            This complaint was filed after receiving community validation.
            {validationCount > 2 && ` ${validationCount} neighbours confirmed this issue.`}
          </p>
        )}
      </div>
    </div>
  </div>
)}

        {/* Validation success banner */}
        {validationSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">{validationSuccess}</p>
          </div>
        )}

        {/* PANEL 2 — Proof of Fix — shown to assigned official when in_progress or overdue */}
{isAuthenticated &&
  (isOfficial || isAdmin) &&
  complaint.assignedTo &&
  complaint.assignedTo._id === user?._id &&
  ['in_progress', 'overdue'].includes(complaint.status) && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Camera className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800 mb-0.5">
            Submit Proof of Fix
          </p>
          <p className="text-xs text-amber-600">
            Upload an after-photo showing the issue has been resolved.
            Citizens who reported this issue will verify your fix.
          </p>
        </div>
      </div>
      {/* Only show the button when form is hidden */}
      {!showProofForm && (
        <button
          onClick={() => setShowProofForm(true)}
          className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
        >
          Upload proof
        </button>
      )}
    </div>

    {/* Expandable form — only visible when showProofForm is true */}
    {showProofForm && (
      <form onSubmit={handleSubmitProof} className="mt-4 pt-4 border-t border-amber-200">

        {proofError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mb-3 text-xs">
            {proofError}
          </div>
        )}

        {/* Photo upload area */}
        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-amber-300 rounded-lg p-5 cursor-pointer hover:bg-amber-100 transition-colors mb-3">
          <Upload className="w-6 h-6 text-amber-400 mb-2" />
          <span className="text-sm text-amber-700 font-medium">
            Click to attach after-photo
          </span>
          <span className="text-xs text-amber-500 mt-0.5">
            JPEG, PNG or WEBP — shows the issue is resolved
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleProofPhotoChange}
            className="hidden"
          />
        </label>

        {/* Preview — appears after photo is selected */}
        {proofPreview && (
          <div className="relative mb-3">
            <img
              src={proofPreview}
              alt="Proof preview"
              className="w-full h-40 object-cover rounded border border-amber-200"
            />
            <button
              type="button"
              onClick={() => { setProofPhoto(null); setProofPreview(null); }}
              className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded"
            >
              Remove
            </button>
          </div>
        )}

        {/* Submit + Cancel */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submittingProof || !proofPhoto}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-bold px-4 py-2 rounded transition-colors"
          >
            {submittingProof ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {submittingProof ? 'Submitting...' : 'Submit proof of fix'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowProofForm(false);
              setProofPhoto(null);
              setProofPreview(null);
              setProofError('');
            }}
            className="text-sm text-amber-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    )}
  </div>
)}

{/* PANEL 3 — Verification Voting Poll — shown to eligible citizens when pending_verification */}
{isAuthenticated && isCitizen &&
  complaint.status === 'pending_verification' &&
  !voteSuccess && (
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold text-purple-800 mb-1">
          Is this issue actually fixed?
        </p>
        <p className="text-xs text-purple-600 mb-4">
          An official has submitted proof of fix — view the after-photo below.
          As someone who reported or validated this issue, your vote determines
          whether it's genuinely resolved.
        </p>

        {/* Vote poll bar — shows current community sentiment */}
        {!loadingVotes && voteSummary && voteSummary.totalVotes > 0 && (
          <div className="bg-white rounded-lg border border-purple-100 p-3 mb-4">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-3">
              Community Verdict — {voteSummary.totalVotes} vote{voteSummary.totalVotes !== 1 ? 's' : ''} so far
            </p>

            {/* Fixed votes bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" />
                  Fixed
                </span>
                <span className="text-xs font-bold text-green-700">
                  {voteSummary.fixedVotes}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all duration-500"
                  style={{
                    width: voteSummary.totalVotes > 0
                      ? `${(voteSummary.fixedVotes / voteSummary.totalVotes) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Not fixed votes bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-700 flex items-center gap-1">
                  <ThumbsDown className="w-3 h-3" />
                  Not Fixed
                </span>
                <span className="text-xs font-bold text-red-700">
                  {voteSummary.notFixedVotes}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-red-500 transition-all duration-500"
                  style={{
                    width: voteSummary.totalVotes > 0
                      ? `${(voteSummary.notFixedVotes / voteSummary.totalVotes) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Reopen threshold warning */}
            {voteSummary.totalVotes >= 2 &&
              (voteSummary.notFixedVotes / voteSummary.totalVotes) >= 0.3 && (
              <p className="text-xs text-red-600 font-medium mt-2">
                ⚠ Approaching reopen threshold — {Math.round((voteSummary.notFixedVotes / voteSummary.totalVotes) * 100)}% say not fixed (40% triggers reopen)
              </p>
            )}
          </div>
        )}

        {/* Already voted state */}
        {voteSummary?.userVote && (
          <div className={`rounded-lg px-3 py-2 mb-3 text-xs font-medium flex items-center gap-2 ${
            voteSummary.userVote === 'fixed'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {voteSummary.userVote === 'fixed'
              ? <><ThumbsUp className="w-3.5 h-3.5" /> You voted: Fixed</>
              : <><ThumbsDown className="w-3.5 h-3.5" /> You voted: Not Fixed</>
            }
          </div>
        )}

        {voteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mb-3 text-xs">
            {voteError}
          </div>
        )}

        {/* Voting buttons — only if user hasn't voted yet */}
        {!voteSummary?.userVote && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleVote('fixed')}
              disabled={voting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              {voting
                ? <Loader className="w-4 h-4 animate-spin" />
                : <ThumbsUp className="w-4 h-4" />
              }
              Yes, it's fixed
            </button>
            <button
              onClick={() => handleVote('not_fixed')}
              disabled={voting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              {voting
                ? <Loader className="w-4 h-4 animate-spin" />
                : <ThumbsDown className="w-4 h-4" />
              }
              No, still broken
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* Vote success banner */}
{voteSuccess && (
  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
    <CheckCircle className="w-4 h-4 text-green-600" />
    <p className="text-sm text-green-700 font-medium">{voteSuccess}</p>
  </div>
)}

        {/* Detail card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {CATEGORY_LABELS[complaint.category] || complaint.category}
                </span>
                <span className="text-slate-300">·</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded ${statusConfig.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {complaint.title}
              </h1>
            </div>

            {complaint.affectedCount > 1 && (
              <div className="flex-shrink-0 text-center bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-2xl font-black text-blue-700">{complaint.affectedCount}</p>
                <p className="text-xs text-blue-500 font-medium">affected</p>
              </div>
            )}
          </div>

          <p className="text-slate-600 text-sm leading-relaxed mb-5">
            {complaint.description}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                  Location
                </p>
                <p className="text-sm text-slate-700">
                  {complaint.location.address ||
                    `${complaint.location.lat}, ${complaint.location.lng}`}
                </p>
                {complaint.pincode && (
                  <p className="text-xs text-slate-400 mt-0.5">{complaint.pincode}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                  Filed
                </p>
                <p className="text-sm text-slate-700">
                  {formatDate(complaint.createdAt)}
                </p>
              </div>
            </div>

            {complaint.filedBy && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                    Reported by
                  </p>
                  <p className="text-sm text-slate-700">
                    {complaint.filedBy.name || 'Citizen'}
                  </p>
                </div>
              </div>
            )}

            {complaint.assignedTo && (
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                    Assigned to
                  </p>
                  <p className="text-sm text-slate-700">
                    {complaint.assignedTo.name || 'Official'}
                    {complaint.assignedTo.credibilityScore !== undefined && (
                      <span className="text-xs text-slate-400 ml-1">
                        ({complaint.assignedTo.credibilityScore} credibility)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {complaint.slaDeadline && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                    SLA Deadline
                  </p>
                  <p className={`text-sm font-medium ${
                    complaint.status === 'overdue' ? 'text-red-600' : 'text-slate-700'
                  }`}>
                    {formatDate(complaint.slaDeadline)}
                    {complaint.status === 'overdue' && (
                      <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                        Missed
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {complaint.affectedCount > 1 && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                    Community
                  </p>
                  <p className="text-sm text-slate-700">
                    {complaint.affectedCount} citizens affected
                    <span className="text-xs text-slate-400 block">
                      includes merged reports
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photo Evidence */}
        {(complaint.beforePhoto || complaint.afterPhoto) && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" />
              Photo Evidence
            </h2>
            <div className={`grid gap-3 ${complaint.afterPhoto ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {complaint.beforePhoto && (
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                    Before
                  </p>
                  <img
                    src={complaint.beforePhoto}
                    alt="Before"
                    className="w-full h-48 object-cover rounded border border-slate-100"
                  />
                </div>
              )}
              {complaint.afterPhoto && (
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                    After (proof of fix)
                  </p>
                  <img
                    src={complaint.afterPhoto}
                    alt="After"
                    className="w-full h-48 object-cover rounded border border-slate-100"
                  />
                  {complaint.hashSimilarity !== null &&
                    complaint.hashSimilarity !== undefined && (
                    <p className={`text-xs mt-1.5 font-medium ${
                      complaint.hashSimilarity < 10
                        ? 'text-red-500'
                        : 'text-green-600'
                    }`}>
                      {complaint.hashSimilarity < 10
                        ? `⚠ Flagged for review (hash distance: ${complaint.hashSimilarity})`
                        : `✓ Visually different from before (hash distance: ${complaint.hashSimilarity})`
                      }
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        {complaint.timeline && complaint.timeline.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Activity Timeline
            </h2>
            <div className="relative">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-5">
                {complaint.timeline.map((entry, index) => (
                  <div key={entry._id || index} className="flex gap-4 relative">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 z-10 ${
                      index === complaint.timeline.length - 1
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-white border-slate-300'
                    }`} />
                    <div className="flex-1 pb-1">
                      <p className="text-sm text-slate-700 font-medium leading-snug">
                        {entry.event}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {complaint.status === 'overdue' && (
          <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              This complaint has missed its SLA deadline and remains unresolved.
              It is publicly visible on the map as overdue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}