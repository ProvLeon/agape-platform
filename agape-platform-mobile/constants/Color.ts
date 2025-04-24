const primaryLight = '#C62828'; // Red 700
const secondaryLight = '#1565C0'; // Blue 700
const accentLight = '#6A1B9A'; // Purple 700
const backgroundLight = '#F8F9FA'; // Very Light Gray/Off-white
const cardLight = '#FFFFFF'; // White
const textLight = '#212529'; // Dark Gray
const borderLight = '#E9ECEF'; // Light Gray Border

// Dark Theme
const primaryDark = '#E57373'; // Red 300 (Lighter Red for Dark Mode)
const secondaryDark = '#64B5F6'; // Blue 300 (Lighter Blue)
const accentDark = '#BA68C8'; // Purple 300 (Lighter Purple)
const backgroundDark = '#121212'; // Very Dark Gray
const cardDark = '#1E1E1E'; // Slightly Lighter Dark Gray
const textDark = '#E0E0E0'; // Light Gray Text
const borderDark = '#333333'; // Darker Gray Border

export const Colors = {
  light: {
    primary: primaryLight,
    secondary: secondaryLight,
    accent: accentLight,
    background: backgroundLight,
    card: cardLight,
    text: textLight,
    border: borderLight,
    // Shadcn/UI inspired names (can map to above)
    foreground: textLight,
    cardForeground: textLight,
    popover: cardLight,
    popoverForeground: textLight,
    primaryForeground: '#FFFFFF', // White text on primary red
    secondaryForeground: '#FFFFFF', // White text on secondary blue
    muted: '#E9ECEF', // Light gray
    mutedForeground: '#6C757D', // Gray text
    accentForeground: '#FFFFFF', // White text on accent purple
    destructive: '#DC3545', // Standard destructive red
    destructiveForeground: '#FFFFFF',
    ring: secondaryLight, // Use secondary blue for focus rings
    // Old names (keep for compatibility or map)
    tint: primaryLight,
    icon: secondaryLight, // Use secondary blue for icons
    tabIconDefault: '#6C757D', // Muted foreground
    tabIconSelected: primaryLight,
    cardBorder: borderLight, // Specific card border
    error: '#DC3545',
  },
  dark: {
    primary: primaryDark,
    secondary: secondaryDark,
    accent: accentDark,
    background: backgroundDark,
    card: cardDark,
    text: textDark,
    border: borderDark,
    // Shadcn/UI inspired names (can map to above)
    foreground: textDark,
    cardForeground: textDark,
    popover: cardDark,
    popoverForeground: textDark,
    primaryForeground: '#000000', // Black text on light primary red
    secondaryForeground: '#000000', // Black text on light secondary blue
    muted: '#333333', // Darker gray
    mutedForeground: '#ADB5BD', // Lighter gray text
    accentForeground: '#FFFFFF', // White text on light accent purple
    destructive: '#F8828B', // Lighter destructive red
    destructiveForeground: '#000000',
    ring: secondaryDark, // Use secondary blue for focus rings
    // Old names (keep for compatibility or map)
    tint: primaryDark,
    icon: secondaryDark, // Use secondary blue for icons
    tabIconDefault: '#ADB5BD', // Muted foreground
    tabIconSelected: primaryDark,
    cardBorder: borderDark, // Specific card border
    error: '#F8828B',
  },
};
