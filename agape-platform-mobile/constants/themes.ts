import { vars } from 'nativewind';

// Approximate HSL values (adjust as needed!)
// Light: Red(0,67,50), Blue(211,75,48), Purple(285,69,36), OffWhite(210,17,98), White(0,0,100), DarkGray(210,10,23), LGrayBorder(210,17,93)
// Dark: LRed(0,73,71), LBlue(207,90,68), LPurple(289,44,60), VDarkGray(0,0,7), LDarkGray(0,0,12), LGrayText(210,14,88), DarkBorder(0,0,20)

export const lightTheme = vars({
  '--background': '210 17% 98%', // #F8F9FA
  '--foreground': '210 10% 23%', // #212529
  '--card': '0 0% 100%', // #FFFFFF
  '--card-foreground': '210 10% 23%', // #212529
  '--popover': '0 0% 100%',
  '--popover-foreground': '210 10% 23%',
  '--primary': '0 67% 50%', // #C62828
  '--primary-foreground': '0 0% 100%', // White
  '--secondary': '211 75% 48%', // #1565C0
  '--secondary-foreground': '0 0% 100%', // White
  '--muted': '210 17% 93%', // #E9ECEF
  '--muted-foreground': '210 9% 49%', // #6C757D
  '--accent': '285 69% 36%', // #6A1B9A
  '--accent-foreground': '0 0% 100%', // White
  '--destructive': '354 70% 54%', // #DC3545
  '--destructive-foreground': '0 0% 100%', // White
  '--border': '210 17% 93%', // #E9ECEF
  '--input': '210 17% 93%', // Same as border for inputs
  '--ring': '211 75% 48%', // Secondary blue for focus ring

  // Agape specific (mapped from above for clarity)
  '--agape-primary': '0 67% 50%',
  '--agape-secondary': '211 75% 48%',
  '--agape-accent': '285 69% 36%',
  '--agape-background': '210 17% 98%',
  '--agape-card': '0 0% 100%',
  '--agape-text': '210 10% 23%',
  '--agape-border': '210 17% 93%',
});

export const darkTheme = vars({
  '--background': '0 0% 7%', // #121212
  '--foreground': '210 14% 88%', // #E0E0E0
  '--card': '0 0% 12%', // #1E1E1E
  '--card-foreground': '210 14% 88%', // #E0E0E0
  '--popover': '0 0% 12%',
  '--popover-foreground': '210 14% 88%',
  '--primary': '0 73% 71%', // #E57373
  '--primary-foreground': '0 0% 10%', // Black text
  '--secondary': '207 90% 68%', // #64B5F6
  '--secondary-foreground': '0 0% 10%', // Black text
  '--muted': '0 0% 20%', // #333333
  '--muted-foreground': '210 13% 74%', // #ADB5BD
  '--accent': '289 44% 60%', // #BA68C8
  '--accent-foreground': '0 0% 100%', // White text
  '--destructive': '355 91% 75%', // #F8828B
  '--destructive-foreground': '0 0% 10%', // Black text
  '--border': '0 0% 20%', // #333333
  '--input': '0 0% 20%',
  '--ring': '207 90% 68%', // Light secondary blue

  // Agape specific (mapped from above for clarity)
  '--agape-primary': '0 73% 71%',
  '--agape-secondary': '207 90% 68%',
  '--agape-accent': '289 44% 60%',
  '--agape-background': '0 0% 7%',
  '--agape-card': '0 0% 12%',
  '--agape-text': '210 14% 88%',
  '--agape-border': '0 0% 20%',
});
