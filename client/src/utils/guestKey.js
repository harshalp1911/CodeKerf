import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'guestKey';
let fallbackKey = null;

// A random id this browser keeps, so the server can recognise a guest's share link without
// an account. If storage is blocked, it falls back to an id that lasts until the tab closes.
export const getGuestKey = () => {
  try {
    let key = localStorage.getItem(STORAGE_KEY);
    if (!key) {
      key = uuidv4();
      localStorage.setItem(STORAGE_KEY, key);
    }
    return key;
  } catch (_) {
    if (!fallbackKey) fallbackKey = uuidv4();
    return fallbackKey;
  }
};

// Headers for share API calls: the account token when logged in, plus the guest key
export const shareHeaders = (token) => ({
  'Content-Type': 'application/json',
  'X-Guest-Key': getGuestKey(),
  ...(token && { Authorization: `Bearer ${token}` })
});
