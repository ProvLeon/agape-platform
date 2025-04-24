module.exports = {
  darkMode: "class", // Enable class-based dark mode
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Add custom fonts here if you have them
        // sans: ['Inter-Regular', 'sans-serif'], // Example
        // heading: ['Poppins-Bold', 'sans-serif'], // Example
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // --- Reference Agape specific variables ---
        agape: {
          primary: 'hsl(var(--agape-primary))',
          secondary: 'hsl(var(--agape-secondary))',
          accent: 'hsl(var(--agape-accent))',
          background: 'hsl(var(--agape-background))',
          card: 'hsl(var(--agape-card))',
          text: 'hsl(var(--agape-text))',
          border: 'hsl(var(--agape-border))',
        }
      },
      borderRadius: {
        xl: "0.75rem", // Larger radius
        lg: "0.5rem",
        md: "0.375rem", // Standard medium
        sm: "0.25rem",
      },
      // Add other theme extensions like spacing, typography sizes if needed
      fontSize: {
        'xxs': '0.65rem', // Extra small
      },
      boxShadow: {
        // Add subtle shadows for cards
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }
    },
  },
  plugins: [],
};
