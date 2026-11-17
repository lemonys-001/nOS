const CONFIG = {
  name: 'nOS',
  version: '1.0.0',
  tagline: 'A modular operating system that lives in your browser',
  firebase: {
    apiKey: 'AIzaSyDQZZXEXehppRBThmN6FEILigc20E32_tA',
    authDomain: 'lemonos-0001.firebaseapp.com',
    projectId: 'lemonos-0001',
    storageBucket: 'lemonos-0001.firebasestorage.app',
    messagingSenderId: '405036715537',
    appId: '1:405036715537:web:e2449981b447330f0d2bb0',
    measurementId: 'G-ZXEC7R6H8N'
  },
  adsenseId: 'ca-pub-7923796655263508',
  adsenseSlot: '7559287123',
  apiBase: '/api/store',
  accent: '#f5d547',
  accentDim: '#b9991f',
  /* deliberate-ignore round-stat */
  wallpaper: 'radial-gradient(1200px 800px at 70% 20%, #1c2030 0%, #0e0f13 55%, #090a0d 100%)'
};

CONFIG.wallpapers = [
  /* deliberate-ignore round-stat */
  { id: 'ember', label: 'Ember Dusk', css: 'radial-gradient(1200px 800px at 70% 20%, #1c2030 0%, #0e0f13 55%, #090a0d 100%)' },
  { id: 'pine', label: 'Deep Pine', css: 'radial-gradient(1200px 900px at 25% 12%, #1d2a24 0%, #101713 55%, #090c0a 100%)' },
  { id: 'plum', label: 'Plum Night', css: 'radial-gradient(1100px 900px at 78% 78%, #241d33 0%, #131019 55%, #0a090d 100%)' },
  { id: 'slate', label: 'Slate Dawn', css: 'radial-gradient(1200px 900px at 50% 0%, #232733 0%, #12141a 55%, #0a0b0e 100%)' },
  { id: 'rust', label: 'Rust', css: 'radial-gradient(1100px 900px at 18% 82%, #2a1f1a 0%, #17120f 55%, #0b0908 100%)' },
  { id: 'terminal', label: 'Terminal', css: 'linear-gradient(180deg, #0e1110 0%, #080a09 100%)' }
];

CONFIG.accents = [
  { id: 'lemon', label: 'Lemon', accent: '#f5d547', soft: '#ffe97a', dim: '#b9991f', ink: '#0c0d10' },
  { id: 'mint', label: 'Mint', accent: '#5fe0a8', soft: '#8ff0c6', dim: '#2f9c6e', ink: '#04140d' },
  { id: 'sky', label: 'Sky', accent: '#5aa9f5', soft: '#8fc7ff', dim: '#2f6fb9', ink: '#04101f' },
  { id: 'coral', label: 'Coral', accent: '#ff6f61', soft: '#ff9a8f', dim: '#c1483c', ink: '#1f0704' },
  { id: 'violet', label: 'Violet', accent: '#b48cff', soft: '#cfb0ff', dim: '#7d5bd6', ink: '#0e0618' },
  { id: 'amber', label: 'Amber', accent: '#ffb347', soft: '#ffcf85', dim: '#c6822a', ink: '#180d02' }
];

const APPS = {};

const CUSTOM_APPS = {};
