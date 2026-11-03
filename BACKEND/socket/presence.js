// userId -> Set<socketId>   (a user can be connected from several devices / tabs)
const online = new Map();

const add = (userId, socketId) => {
  const set = online.get(userId) || new Set();
  set.add(socketId);
  online.set(userId, set);
  return set.size === 1; // true when the user just came online
};

const remove = (userId, socketId) => {
  const set = online.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    online.delete(userId);
    return true; // user went fully offline
  }
  return false;
};

const isOnline = (userId) => online.has(String(userId));
const list = () => Array.from(online.keys());

module.exports = { add, remove, isOnline, list };
