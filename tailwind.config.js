// tailwind.config.js
// Tailwind configuration for the OSS portal.
//
// This file extends the default Tailwind colour palette by overriding
// the green and emerald scales with an amber palette centred on the
// hue `#FFC107`. Many components in the project rely on utility
// classes like `bg-green-100` or `text-emerald-600`. Rather than
// individually refactoring each occurrence, we redefine these colour
// scales here so that all existing classes seamlessly adopt the new
// colour scheme. The amber palette provides a range of tints and
// shades from very light to deep orange, ensuring visual variety
// while maintaining cohesion across the UI.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override the default Tailwind green palette with an amber
        // gradient. Each numeric key corresponds to increasing
        // saturation/darkness, mirroring Tailwind's standard scale. This
        // allows utility classes (e.g. `bg-green-50`, `text-green-700`)
        // to continue working, but they now render using these warm
        // amber hues instead of greens.
        green: {
          50:  '#FFF8E1', // very light amber
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFC107', // primary brand colour
          600: '#FFB300',
          700: '#FFA000',
          800: '#FF8F00',
          900: '#FF6F00',
        },
        // Emerald is another greenish palette used in the codebase.
        // We mirror the same amber spectrum here so that
        // `emerald-*` utility classes map directly to the amber hues.
        emerald: {
          50:  '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFC107',
          600: '#FFB300',
          700: '#FFA000',
          800: '#FF8F00',
          900: '#FF6F00',
        },
      },
    },
  },
  plugins: [],
}