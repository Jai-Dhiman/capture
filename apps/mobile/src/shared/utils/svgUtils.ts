/**
 * Converts an SVG string to a data URI for use with expo-image
 */
export function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}