import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/global.css';

import Login from './pages/player/Login';
import Register from './pages/player/Register';
import Home from './pages/player/Home';
import GamePlay from './pages/player/GamePlay';
import CardGame from './pages/player/CardGame';
import SlotGame from './pages/player/SlotGame';
import SicBoGame from './pages/player/SicBoGame';
import FishingGame from './pages/player/FishingGame';
import Wallet from './pages/player/Wallet';
import Promotions from './pages/player/Promotions';
import Profile from './pages/player/Profile';
import AdminDashboard from './pages/admin/Dashboard';
import AdminPlayers from './pages/admin/Players';
import AdminWithdrawals from './pages/admin/Withdrawals';
import AdminGames from './pages/admin/Games';
import AdminLayout from './components/admin/AdminLayout';

import BottomNav from './components/shared/BottomNav';
import Header from './components/shared/Header';

// Card games use CardGame component (Blackjack-style gameplay)
const CARD_GAMES = ['blackjack-vip', 'texas-holdem', 'teen-patti', 'andar-bahar', 'baccarat', 'dragon-tiger', 'speed-baccarat'];

// Sic Bo games
const SICBO_GAMES = ['sic-bo', 'sicbo', 'sic-bo-game'];

// Fishing games
const FISHING_GAMES = ['fishing-god', 'ocean-king', 'fishing', 'fishing-game', 'golden-dragon', 'fish-hunter'];

// Live / show games — use GamePlay (slot-style spin UI)
const LIVE_GAMES = ['monopoly-live', 'crazy-time', 'lightning-roulette', 'dream-catcher', 'european-roulette', 'american-roulette', 'craps'];

// Game router component that determines which game UI to show
const GameRouter = () => {
  const { slug } = useParams();
  const lowerSlug = slug?.toLowerCase() || '';
  
  if (CARD_GAMES.some(game => lowerSlug.includes(game))) {
    return <CardGame />;
  }
  if (SICBO_GAMES.some(game => lowerSlug.includes(game))) {
    return <SicBoGame />;
  }
  if (FISHING_GAMES.some(game => lowerSlug.includes(game))) {
    return <FishingGame />;
  }
  // Slots and all other games (live, table, etc.) use GamePlay
  return <GamePlay />;
};

const ProtectedRoute = ({ children, admin }) => {
  const { user, loading } = useAuth();
  // Only block if still loading AND no cached user yet
  if (loading && !user) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (admin && user.role_id < 2) return <Navigate to="/" />;
  return children;
};

// Full-width layout for Home page (no max-width constraint)
const HomeLayout = ({ children }) => (
  <div className="app">
    <div style={{ flex: 1 }}>{children}</div>
    <BottomNav />
  </div>
);

// Standard layout for inner pages (wallet, profile, etc.)
const PageLayout = ({ children, showNav = true }) => (
  <div className="app">
    <Header />
    <div className="page">{children}</div>
    {showNav && <BottomNav />}
  </div>
);

// Game layout — no nav, no header padding constraint
const GameLayout = ({ children }) => (
  <div className="app">
    <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
  </div>
);

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login"    element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

      {/* Home — public landing page, guests can browse */}
      <Route path="/" element={<HomeLayout><Home /></HomeLayout>} />

      {/* Game — full screen. Determine component based on game type */}
      <Route path="/game/:slug" element={
        <ProtectedRoute>
          <GameLayout><GameRouter /></GameLayout>
        </ProtectedRoute>
      } />

      {/* Inner pages */}
      <Route path="/wallet"     element={<ProtectedRoute><PageLayout><Wallet /></PageLayout></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute><PageLayout><Promotions /></PageLayout></ProtectedRoute>} />
      <Route path="/profile"    element={<ProtectedRoute><PageLayout><Profile /></PageLayout></ProtectedRoute>} />

      {/* Admin — use AdminLayout (sidebar + header) instead of PageLayout */}
      <Route path="/admin"              element={<ProtectedRoute admin><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/players"      element={<ProtectedRoute admin><AdminLayout><AdminPlayers /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/withdrawals"  element={<ProtectedRoute admin><AdminLayout><AdminWithdrawals /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/games"        element={<ProtectedRoute admin><AdminLayout><AdminGames /></AdminLayout></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
