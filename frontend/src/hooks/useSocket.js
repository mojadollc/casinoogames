import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3020';

let sharedSocket = null;

export function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
    });
  }
  return sharedSocket;
}

/**
 * Join personal room (wallet notifications) + optional admin.
 */
export function useSocket(user) {
  const [connected, setConnected] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socket.current = s;

    const onConnect = () => {
      setConnected(true);
      if (user?.id) s.emit('join', user.id);
      if (user?.role === 'admin' || user?.role === 'superadmin') s.emit('join:admin');
    };
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) onConnect();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [user?.id, user?.role]);

  return { socket: socket.current || getSocket(), connected };
}

/**
 * Fishing multiplayer room: shared fish + presence + catch feed.
 */
export function useFishingRoom(gameId, user) {
  const { socket, connected } = useSocket(user);
  const [fishes, setFishes] = useState([]);
  const [players, setPlayers] = useState([]);
  const [catchFeed, setCatchFeed] = useState([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!gameId || !user?.id || !socket) return;

    const join = () => {
      socket.emit('fishing:join', {
        gameId,
        userId: user.id,
        username: user.username || 'Player',
      });
    };

    if (socket.connected) join();
    socket.on('connect', join);

    const onState = (payload) => {
      if (payload?.fishes) setFishes(payload.fishes);
      if (payload?.players) setPlayers(payload.players);
      setSynced(true);
    };
    const onJoined = (payload) => {
      if (payload?.players) setPlayers(payload.players);
    };
    const onLeft = (payload) => {
      if (payload?.players) setPlayers(payload.players);
    };
    const onCatch = (payload) => {
      setCatchFeed(prev => [payload, ...prev].slice(0, 12));
      // Fish removal comes via next fishing:state; optimistically drop if id known
      if (payload?.fishId) {
        setFishes(prev => prev.filter(f => f.id !== payload.fishId));
      }
    };

    socket.on('fishing:state', onState);
    socket.on('fishing:player_joined', onJoined);
    socket.on('fishing:player_left', onLeft);
    socket.on('fishing:catch', onCatch);

    return () => {
      socket.emit('fishing:leave');
      socket.off('connect', join);
      socket.off('fishing:state', onState);
      socket.off('fishing:player_joined', onJoined);
      socket.off('fishing:player_left', onLeft);
      socket.off('fishing:catch', onCatch);
    };
  }, [gameId, user?.id, user?.username, socket]);

  const clearFeed = useCallback(() => setCatchFeed([]), []);

  return {
    socket,
    connected,
    synced,
    fishes,
    players,
    catchFeed,
    clearFeed,
  };
}
