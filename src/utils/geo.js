// ===========================================
// GEO UTILITY
// File: src/utils/geo.util.js
// Geographic calculations for nearby designer search
// ===========================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Get bounding box coordinates for a center point and radius
 * Useful for initial database filtering before precise distance calculation
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} { minLat, maxLat, minLon, maxLon }
 */
const getBoundingBox = (lat, lon, radiusKm) => {
  const R = 6371; // Earth's radius in km
  
  // Angular distance in radians
  const radDist = radiusKm / R;
  
  const minLat = lat - (radDist * 180 / Math.PI);
  const maxLat = lat + (radDist * 180 / Math.PI);
  
  const deltaLon = Math.asin(Math.sin(radDist) / Math.cos(toRad(lat)));
  const minLon = lon - (deltaLon * 180 / Math.PI);
  const maxLon = lon + (deltaLon * 180 / Math.PI);
  
  return { minLat, maxLat, minLon, maxLon };
};

/**
 * Check if a point is within a circular radius
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude
 * @param {number} pointLat - Point latitude
 * @param {number} pointLon - Point longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean}
 */
const isWithinRadius = (centerLat, centerLon, pointLat, pointLon, radiusKm) => {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusKm;
};

/**
 * Sort locations by distance from a point
 * @param {number} lat - Reference latitude
 * @param {number} lon - Reference longitude
 * @param {Array} locations - Array of objects with latitude and longitude properties
 * @returns {Array} Sorted array with distance added
 */
const sortByDistance = (lat, lon, locations) => {
  return locations
    .map(loc => ({
      ...loc,
      distance: calculateDistance(lat, lon, loc.latitude, loc.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Parse coordinates from string
 * @param {string} coordString - Coordinate string (e.g., "25.2048,55.2708")
 * @returns {Object|null} { latitude, longitude } or null if invalid
 */
const parseCoordinates = (coordString) => {
  if (!coordString || typeof coordString !== 'string') return null;
  
  const parts = coordString.split(',').map(p => parseFloat(p.trim()));
  
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return null;
  }
  
  const [latitude, longitude] = parts;
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  
  return { latitude, longitude };
};

/**
 * Validate coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
const isValidCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

module.exports = {
  calculateDistance,
  toRad,
  getBoundingBox,
  isWithinRadius,
  sortByDistance,
  formatDistance,
  parseCoordinates,
  isValidCoordinates
};
