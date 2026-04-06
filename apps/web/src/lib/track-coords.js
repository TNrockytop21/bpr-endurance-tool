// GPS coordinates for known tracks.
// bbox: [west, south, east, north] in WGS84
// Used to fetch satellite imagery from Esri World Imagery.

const TRACKS = {
  'spa': {
    center: [50.4372, 5.9714],
    bbox: [5.935, 50.420, 6.010, 50.455],
  },
  'spa-francorchamps': {
    center: [50.4372, 5.9714],
    bbox: [5.935, 50.420, 6.010, 50.455],
  },
  'daytona': {
    center: [29.1852, -81.0705],
    bbox: [-81.085, 29.175, -81.055, 29.195],
  },
  'le mans': {
    center: [47.956, 0.2073],
    bbox: [0.185, 47.935, 0.235, 47.975],
  },
  'nurburgring': {
    center: [50.3356, 6.9475],
    bbox: [6.920, 50.320, 6.985, 50.355],
  },
  'monza': {
    center: [45.6186, 9.2811],
    bbox: [9.265, 45.605, 9.300, 45.635],
  },
  'silverstone': {
    center: [52.0733, -1.0147],
    bbox: [-1.035, 52.060, -0.995, 52.090],
  },
  'mount panorama': {
    center: [-33.4437, 149.5577],
    bbox: [149.545, -33.455, 149.570, -33.430],
  },
  'bathurst': {
    center: [-33.4437, 149.5577],
    bbox: [149.545, -33.455, 149.570, -33.430],
  },
  'suzuka': {
    center: [34.8431, 136.5406],
    bbox: [136.525, 34.835, 136.555, 34.855],
  },
  'sebring': {
    center: [27.4545, -81.3486],
    bbox: [-81.365, 27.440, -81.330, 27.470],
  },
  'watkins glen': {
    center: [42.3369, -76.9272],
    bbox: [-76.945, 42.325, -76.910, 42.350],
  },
  'road america': {
    center: [43.7979, -87.9893],
    bbox: [-88.010, 43.785, -87.970, 43.810],
  },
  'imola': {
    center: [44.3439, 11.7167],
    bbox: [11.700, 44.335, 11.735, 44.355],
  },
};

/**
 * Get satellite image URL for a track from Esri World Imagery.
 * Returns { url, bbox } or null.
 */
export function getSatelliteUrl(trackName, width = 400, height = 300) {
  if (!trackName) return null;
  const key = trackName.toLowerCase().trim();

  let coords = null;
  // Exact match
  if (TRACKS[key]) coords = TRACKS[key];
  // Partial match
  if (!coords) {
    for (const [name, data] of Object.entries(TRACKS)) {
      if (key.includes(name) || name.includes(key)) {
        coords = data;
        break;
      }
    }
  }
  if (!coords) return null;

  const [west, south, east, north] = coords.bbox;
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${west},${south},${east},${north}&size=${width},${height}&f=image&format=jpg&bboxSR=4326&imageSR=4326`;

  return { url, bbox: coords.bbox, center: coords.center };
}
