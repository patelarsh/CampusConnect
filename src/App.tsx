/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase.ts';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import Home from './pages/Home.tsx';
import Auth from './pages/Auth.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Projects from './pages/Projects.tsx';
import Chat from './pages/Chat.tsx';
import Notes from './pages/Notes.tsx';
import Questions from './pages/Questions.tsx';
import Profile from './pages/Profile.tsx';
import Workspace from './pages/Workspace.tsx';
import Layout from './components/Layout.tsx';

// Simple Auth Contex
const AuthContext = createContext<{
  user: FirebaseUser | null;
  logout: () => Promise<void>;
} | null>(null);

export const useAuth = () => useContext(AuthContext);

// Notification Context
const NotificationContext = createContext<{
  notifications: any[];
  unreadCount: number;
} | null>(null);

export const useNotifications = () => useContext(NotificationContext);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotes = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setNotifications(notes);
      setUnreadCount(notes.filter((n: any) => !n.read).length);
    }, (err) => {
      console.error("Notifications list error:", err);
    });

    return () => unsubscribeNotes();
  }, [user]);

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-sans">
    <div className="flex flex-col items-center gap-6">
      <img src="https://ashishvidhyalay.com/ADM/Connect%20(1).png" width="200px" alt="CampusConnect" className="animate-pulse" />
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  </div>;

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <NotificationContext.Provider value={{ notifications, unreadCount }}>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
              <Route path="/projects" element={user ? <Projects /> : <Navigate to="/" />} />
              <Route path="/chat" element={user ? <Chat /> : <Navigate to="/" />} />
              <Route path="/notes" element={user ? <Notes /> : <Navigate to="/" />} />
              <Route path="/doubts" element={user ? <Questions /> : <Navigate to="/" />} />
              <Route path="/profile" element={user ? <Profile /> : <Navigate to="/" />} />
              <Route path="/projects/:id/workspace" element={user ? <Workspace /> : <Navigate to="/" />} />
            </Route>
          </Routes>
        </Router>
      </NotificationContext.Provider>
    </AuthContext.Provider>
  );
}

