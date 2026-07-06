import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, Camera, Loader, Sparkles,
  CheckCircle, AlertCircle, Navigation, AlertTriangle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../utils/api';

// Fix Leaflet's broken default marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORIES = [
  { value: 'waterlogging', label: 'Waterlogging' },
  { value: 'power_outage', label: 'Power Outage' },
  { value: 'broken_road', label: 'Broken Road' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'streetlight', label: 'Streetlight' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'open_manhole', label: 'Open Manhole' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS = {
  pending_validation: 'Awaiting validation',
  open: 'Open',
  in_progress: 'Being worked on',
  overdue: 'Overdue',
};

// Headless component — renders nothing, just listens for map clicks
function LocationPicker({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(
        e.latlng.lat.toFixed(6),
        e.latlng.lng.toFixed(6)
      );
    },
  });
  return null;
}

export default function FileComplaintPage() {
  const navigate = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
 

  // UI states
  const [showMap, setShowMap] = useState(false);
  const [pinPosition, setPinPosition] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiSuggested, setAiSuggested] = useState(false);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [checkingNearby, setCheckingNearby] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [pincodeSearching, setPincodeSearching] = useState(false);

  // Shared reverse geocoding helper
  const reverseGeocode = async (selectedLat, selectedLng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${selectedLat}&lon=${selectedLng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      if (data.address) {
        const parts = data.address;
        const shortAddress = [
          parts.road || parts.pedestrian || parts.footway,
          parts.suburb || parts.neighbourhood || parts.city_district,
          parts.city || parts.town,
        ].filter(Boolean).join(', ');
        setAddress(
          shortAddress ||
          data.display_name.split(',').slice(0, 3).join(',').trim()
        );
        if (parts.postcode) setPincode(parts.postcode);

      }
    } catch {
      // Silent fail — user can type address manually
    }
  };

  // GPS detection
  const detectLocation = () => {
    setLocating(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Your browser does not support geolocation');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const detectedLat = position.coords.latitude.toFixed(6);
        const detectedLng = position.coords.longitude.toFixed(6);
        setLat(detectedLat);
        setLng(detectedLng);
        setPinPosition([parseFloat(detectedLat), parseFloat(detectedLng)]);
        await reverseGeocode(detectedLat, detectedLng);
        if (category) {
          await checkNearbyComplaints(category, detectedLat, detectedLng);
        }
        setLocating(false);
      },
      () => {
        setLocationError(
          'Could not detect location — stand near the issue or pick on map'
        );
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Map pin selection
  const handleMapLocationSelect = async (selectedLat, selectedLng) => {
    setLat(selectedLat);
    setLng(selectedLng);
    setPinPosition([parseFloat(selectedLat), parseFloat(selectedLng)]);
    await reverseGeocode(selectedLat, selectedLng);
    if (category) {
      await checkNearbyComplaints(category, selectedLat, selectedLng);
    }
  };

  const lookupByPincode = async () => {
  if (!pincode || pincode.length < 6) return;
  setPincodeSearching(true);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await response.json();
    if (data.length > 0) {
      const foundLat = parseFloat(data[0].lat).toFixed(6);
      const foundLng = parseFloat(data[0].lon).toFixed(6);
      setLat(foundLat);
      setLng(foundLng);
      setPinPosition([parseFloat(foundLat), parseFloat(foundLng)]);
      // Also reverse geocode to get a readable address
      await reverseGeocode(foundLat, foundLng);
      if (category) {
        await checkNearbyComplaints(category, foundLat, foundLng);
      }
    } else {
      alert('Pincode not found — please try a different one');
    }
  } catch {
    alert('Could not look up pincode — please try again');
  } finally {
    setPincodeSearching(false);
  }
};

  // Check for nearby duplicate complaints
  const checkNearbyComplaints = async (detectedCategory, currentLat, currentLng) => {
    if (!detectedCategory || !currentLat || !currentLng) return;
    setCheckingNearby(true);
    try {
      const response = await api.get('/complaints/nearby', {
        params: {
          lat: currentLat,
          lng: currentLng,
          category: detectedCategory,
          radius: 500,
        },
      });
      setNearbyComplaints(response.data.complaints || []);
    } catch {
      // Silent fail — don't block filing
    } finally {
      setCheckingNearby(false);
    }
  };

  // AI assist
  const handleAiAssist = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setNearbyComplaints([]);

    try {
      const response = await api.post('/ai/parse-complaint', { text: aiInput });
      const {
        title: suggestedTitle,
        category: suggestedCategory,
        description: suggestedDescription,
      } = response.data;

      if (suggestedTitle) setTitle(suggestedTitle);
      if (suggestedCategory) setCategory(suggestedCategory);
      if (suggestedDescription) setDescription(suggestedDescription);
      setAiSuggested(true);

      // After AI identifies category, check for nearby duplicates
      if (suggestedCategory && lat && lng) {
        await checkNearbyComplaints(suggestedCategory, lat, lng);
      }
    } catch (aiErr) {
      console.error('AI assist failed:', aiErr);
    } finally {
      setAiLoading(false);
    }
  };

  // Category change — also triggers nearby check
  const handleCategoryChange = async (newCategory) => {
    setCategory(newCategory);
    if (newCategory && lat && lng) {
      await checkNearbyComplaints(newCategory, lat, lng);
    }
  };

  // Photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!photo) {
      setSubmitError('Please attach a photo of the issue');
      return;
    }
    if (!lat || !lng) {
      setSubmitError('Please set the issue location — use GPS or pick on map');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('lat', lat);
      formData.append('lng', lng);
      formData.append('address', address);
      formData.append('pincode', pincode);
      formData.append('photo', photo);

      await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate('/', {
        state: { message: 'Complaint filed — awaiting community validation' },
      });
    } catch (submitErr) {
      setSubmitError(
        submitErr.response?.data?.message || 'Failed to file complaint'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Report a Civic Issue</h2>
          <p className="text-gray-500 text-sm mt-1">
            Your report will be visible to neighbours for community validation
          </p>
        </div>

        {/* AI Natural Language Assist */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">AI Assist</span>
            <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <p className="text-xs text-blue-600 mb-3">
            Describe the issue in any language — AI will structure it formally and check for existing similar reports nearby
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="e.g. road full of holes near meenambakkam signal, very dangerous for bikes"
              className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => e.key === 'Enter' && handleAiAssist()}
            />
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading || !aiInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              {aiLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {aiLoading ? 'Thinking...' : 'Analyse'}
            </button>
          </div>
          {aiSuggested && !aiLoading && (
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-green-600">
                Form structured by AI — review and edit before submitting
              </span>
            </div>
          )}
        </div>

        {/* Nearby Duplicate Warning */}
        {checkingNearby && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-sm text-gray-500">
            <Loader className="w-4 h-4 animate-spin" />
            Checking for similar existing complaints nearby...
          </div>
        )}

        {nearbyComplaints.length > 0 && !checkingNearby && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {nearbyComplaints.length} similar complaint{nearbyComplaints.length > 1 ? 's' : ''} already exist{nearbyComplaints.length === 1 ? 's' : ''} within 500m
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Consider validating an existing report — combined complaints carry more weight with officials
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {nearbyComplaints.map((c) => (
                <div
                  key={c._id}
                  className="bg-white rounded-lg px-3 py-2.5 border border-amber-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {STATUS_LABELS[c.status]}
                      {c.affectedCount > 1 && ` · ${c.affectedCount} affected`}
                      {' · '}Filed {new Date(c.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <Link
                    to={`/complaints/${c._id}`}
                    className="text-xs text-blue-600 hover:underline ml-3 whitespace-nowrap"
                  >
                    View →
                  </Link>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNearbyComplaints([])}
              className="text-xs text-amber-600 hover:underline mt-3 block"
            >
              Dismiss — my issue is different, I'll file a new complaint
            </button>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">

          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Open manhole near bus stop"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe what you see, how long it has been there, any danger it poses"
            />
          </div>

     {/* Location */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Issue location <span className="text-red-500">*</span>
  </label>

  {/* Three location options */}
  <div className="grid grid-cols-3 gap-2 mb-3">
    <button
      type="button"
      onClick={detectLocation}
      disabled={locating}
      className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs px-2 py-2.5 rounded-lg transition-colors justify-center"
    >
      {locating ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : (
        <Navigation className="w-4 h-4 text-blue-500" />
      )}
      {locating ? 'Detecting...' : 'Use GPS'}
    </button>

    <button
      type="button"
      onClick={() => setShowMap(!showMap)}
      className={`flex flex-col items-center gap-1 border text-xs px-2 py-2.5 rounded-lg transition-colors justify-center ${
        showMap
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
      }`}
    >
      <MapPin className="w-4 h-4 text-blue-500" />
      {showMap ? 'Hide map' : 'Pick on map'}
    </button>

    <button
      type="button"
      onClick={() => setShowManualCoords(!showManualCoords)}
      className={`flex flex-col items-center gap-1 border text-xs px-2 py-2.5 rounded-lg transition-colors justify-center ${
        showManualCoords
          ? 'bg-purple-50 border-purple-300 text-purple-700'
          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
      }`}
    >
      <span className="text-sm">📍</span>
      Enter manually
    </button>
  </div>

  <p className="text-xs text-gray-400 mb-3">
    GPS: stand at the scene · Map: click to pin · Manual: enter coordinates or pincode
  </p>

  {locationError && (
    <p className="text-red-500 text-xs mb-2">{locationError}</p>
  )}

  {/* Confirmed location indicator */}
  {lat && lng && (
    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-3">
      <MapPin className="w-3.5 h-3.5" />
      Location set: {lat}, {lng}
      {address && <span className="text-green-500 ml-1">· {address}</span>}
    </div>
  )}

  {/* Inline pin-drop map */}
  {showMap && (
    <div className="rounded-xl overflow-hidden border border-gray-200 mb-3">
      <div className="bg-blue-50 px-3 py-2 text-xs text-blue-600 border-b border-blue-100">
        📍 Click anywhere on the map to place a pin at the issue location
      </div>
      <MapContainer
        center={pinPosition || [13.0827, 80.2707]}
        zoom={pinPosition ? 16 : 13}
        style={{ height: '300px', width: '100%' }}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationPicker onLocationSelect={handleMapLocationSelect} />
        {pinPosition && <Marker position={pinPosition} />}
      </MapContainer>
    </div>
  )}

  {/* Manual coordinate / pincode entry */}
  {showManualCoords && (
    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-3 space-y-3">
      <p className="text-xs font-medium text-purple-700">Enter location manually</p>

      {/* Manual lat/lng */}
      <div>
        <p className="text-xs text-purple-600 mb-1.5">Option 1 — Enter coordinates directly</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Latitude (e.g. 13.0827)"
          />
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Longitude (e.g. 80.2707)"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (lat && lng) {
              setPinPosition([parseFloat(lat), parseFloat(lng)]);
              reverseGeocode(lat, lng);
              if (category) checkNearbyComplaints(category, lat, lng);
            }
          }}
          className="mt-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          Use these coordinates
        </button>
      </div>

      <div className="border-t border-purple-100 pt-3">
        <p className="text-xs text-purple-600 mb-1.5">Option 2 — Look up by pincode</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            maxLength={6}
            className="flex-1 border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="e.g. 600028"
          />
          <button
            type="button"
            onClick={lookupByPincode}
            disabled={pincodeSearching || pincode.length < 6}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            {pincodeSearching ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5" />
            )}
            {pincodeSearching ? 'Looking up...' : 'Find location'}
          </button>
        </div>
        <p className="text-xs text-purple-400 mt-1">
          Finds the centre of this pincode area and sets coordinates automatically
        </p>
      </div>
    </div>
  )}

  {/* Address fields */}
  <div className="grid grid-cols-2 gap-3">
    <input
      type="text"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Street address (auto-filled)"
    />
    <input
      type="text"
      value={pincode}
      onChange={(e) => setPincode(e.target.value)}
      maxLength={6}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Pincode"
    />
  </div>
</div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo evidence <span className="text-red-500">*</span>
            </label>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
              <Camera className="w-8 h-8 text-gray-300 mb-2" />
              <span className="text-sm text-gray-500">Click to attach a photo</span>
              <span className="text-xs text-gray-400 mt-1">JPEG, PNG or WEBP — max 5MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>

            {photoPreview && (
              <div className="mt-3 relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Filing complaint...
              </>
            ) : (
              'File Complaint'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Your complaint will appear on the map after 2 neighbours confirm it
          </p>
        </form>
      </div>
    </div>
  );
}