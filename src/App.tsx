import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './lib/firebase.ts';
import Layout from './components/Layout.tsx';
import Home from './pages/Home.tsx';
import Auth from './pages/Auth.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Projects from './pages/Projects.tsx';
import Chat from './pages/Chat.tsx';
import Notes from './pages/Notes.tsx';
import Questions from './pages/Questions.tsx';
import Profile from './pages/Profile.tsx';
import Workspace from './pages/Workspace.tsx';
import Admin from './pages/Admin.tsx';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

// --- Auth Context ---
interface AuthContextType {
  user: any;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => useContext(AuthContext);

// --- Notifications Context ---
interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => useContext(NotificationContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Bootstrap specific email as admin if needed
        if (firebaseUser.email === 'patelarsh.aps@gmail.com') {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
            if (!adminDoc.exists()) {
              await setDoc(doc(db, 'admins', firebaseUser.uid), {
                email: firebaseUser.email,
                bootstrapped: true
              });
            }
          } catch (e) {
            console.error("Admin bootstrap failed:", e);
          }
        }

        const [userDoc, adminDoc] = await Promise.all([
          getDoc(doc(db, 'users', firebaseUser.uid)),
          getDoc(doc(db, 'admins', firebaseUser.uid))
        ]);

        const isAdmin = adminDoc.exists();
        let userData = userDoc.exists() ? userDoc.data() : {};
        
        setUser({ 
          ...firebaseUser, 
          ...userData, 
          isAdmin,
          isBanned: userData.isBanned || false
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function NotificationProvider({ children }: { children: React.ReactNode }) {
  const authContext = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authContext?.user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', authContext.user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.read).length);
      setLoading(false);
    }, (err) => {
      console.error("Notifications listener error:", err);
      handleFirestoreError(err, 'list', 'notifications');
    });
  }, [authContext?.user?.uid]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading }}>
      {children}
    </NotificationContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth?.loading) return <div>Loading...</div>;
  if (!auth?.user) return <Navigate to="/" />;
  return <>{children}</>;
}

function AppContent() {
  const { user, loading } = useAuth()!;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Authenticating...</span>
        </div>
      </div>
    );
  }

  if (user?.isBanned) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-800 p-10 rounded-3xl border border-rose-500/20 shadow-2xl">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Your account has been permanently banned from the platform due to violation of community guidelines.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Check if onboarding is complete (has collegeName)
  const isOnboarded = user && user.collegeName;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home />} />
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* If the user is logged in but not onboarded, redirect everything to profile EXCEPT profile itself */}
          <Route path="dashboard" element={isOnboarded ? <Dashboard /> : <Navigate to="/profile" replace />} />
          <Route path="projects" element={isOnboarded ? <Projects /> : <Navigate to="/profile" replace />} />
          <Route path="chat" element={isOnboarded ? <Chat /> : <Navigate to="/profile" replace />} />
          <Route path="notes" element={isOnboarded ? <Notes /> : <Navigate to="/profile" replace />} />
          <Route path="doubts" element={isOnboarded ? <Questions /> : <Navigate to="/profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={user?.isAdmin ? <Admin /> : <Navigate to="/dashboard" replace />} />
          <Route path="workspace/:id" element={isOnboarded ? <Workspace /> : <Navigate to="/profile" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

