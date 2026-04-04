export const NIPHAD_BUS_STAND_COORDS = {
  latitude: 20.0827,
  longitude: 74.1097,
};

export const MAX_ORDER_DISTANCE_KM = 8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function getDistanceInKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLatitude - fromLatitude);
  const deltaLon = toRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function validateDeliveryDistance(userLatitude: number, userLongitude: number) {
  const distanceKm = getDistanceInKm(
    NIPHAD_BUS_STAND_COORDS.latitude,
    NIPHAD_BUS_STAND_COORDS.longitude,
    userLatitude,
    userLongitude,
  );

  return {
    distanceKm,
    allowed: distanceKm <= MAX_ORDER_DISTANCE_KM,
  };
}
