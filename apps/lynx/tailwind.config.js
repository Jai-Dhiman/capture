/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {},
  },
  // Disable features that cause problems in Lynx
  corePlugins: {
    preflight: false, // Disable base styles that might conflict with Lynx
    fontFeatureSettings: false,
    fontVariantNumeric: false,
    backdropFilter: false,
    touchAction: false,
    ringOffsetWidth: false,
    ringOffsetColor: false,
    scrollSnapType: false,
    borderOpacity: false,
    textOpacity: false,
    backgroundOpacity: false,
  },
}
