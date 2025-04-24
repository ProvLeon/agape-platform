const { execSync } = require('child_process');

console.log('Clearing React Native cache...');
try {
  execSync('watchman watch-del-all');
  console.log('Cleared watchman cache');
} catch (e) {
  console.log('Watchman not installed or error clearing cache');
}

try {
  execSync('rm -rf node_modules/.cache');
  console.log('Removed Node modules cache');
} catch (e) {
  console.log('Error removing node_modules cache:', e.message);
}

try {
  execSync('rm -rf .expo');
  console.log('Removed Expo cache');
} catch (e) {
  console.log('Error removing Expo cache:', e.message);
}

console.log('Starting Metro bundler with cleared cache...');
execSync('npx expo start -c', { stdio: 'inherit' });
