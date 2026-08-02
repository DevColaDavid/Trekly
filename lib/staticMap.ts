const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;

export function staticMapUrl(lat: number, lng: number, width = 600, height = 240, zoom = 11): string {
  if (GEOAPIFY_KEY) {
    return (
      `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=${width}&height=${height}&scaleFactor=1` +
      `&center=lonlat:${lng},${lat}&zoom=${zoom}` +
      `&marker=lonlat:${lng},${lat};color:%23ff0000;size:large` +
      `&apiKey=${GEOAPIFY_KEY}`
    );
  }
  // ponytail: key-less Yandex fallback, capped at 650px source resolution.
  return `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lng},${lat}&z=${zoom}&l=map&size=${width},${height}&pt=${lng},${lat},pm2rdl`;
}

export function mapsSearchUrl(location: string, lat?: number | null, lng?: number | null) {
  const query = lat != null && lng != null ? `${lat},${lng}` : location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
