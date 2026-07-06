// Calculates the distance in METERS between two GPS coordinates
// using the Haversine formula — accounts for the Earth's curvature,
// which simple Pythagorean distance would get wrong over real-world distances
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters

  // Convert degrees to radians — trigonometric functions in JS expect radians
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  // The Haversine formula itself
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // distance in meters

  return distance;
};

module.exports = calculateDistance;