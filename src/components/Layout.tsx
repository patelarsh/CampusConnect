import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Rocket, MessageSquare, BookOpen, HelpCircle, User, LogOut, Bell, X, Check } from 'lucide-react';
import { useAuth, useNotifications } from '../App.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { db } from '../lib/firebase.ts';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: Rocket },
  { name: 'Chat', path: '/chat', icon: MessageSquare },
  { name: 'Notes', path: '/notes', icon: BookOpen },
  { name: 'Doubts', path: '/doubts', icon: HelpCircle },
  { name: 'Profile', path: '/profile', icon: User },
];

export default function Layout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth()!;
  const { notifications, unreadCount } = useNotifications()!;
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar ... */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        {/* ... logo ... */}
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="https://ashishvidhyalay.com/ADM/Connect%20(1).png" width="150px" alt="CampusConnect" />
          </Link>
        </div>

        <nav className="flex-1 px-4 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium relative ${
                    pathname === item.path
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon size={20} />
                  {item.name}
                  {item.path === '/chat' && unreadCount > 0 && notifications.some(n => !n.read && n.type === 'message') && (
                     <span className="absolute right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* ... user stuff ... */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
           <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Campus Insight</h4>
           <div className="flex items-center gap-4">
             <div className="relative">
               <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative"
               >
                 <Bell size={20} />
                 {unreadCount > 0 && (
                   <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                     {unreadCount}
                   </span>
                 )}
               </button>

               <AnimatePresence>
                 {showNotifications && (
                   <>
                     <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setShowNotifications(false)} 
                     />
                     <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
                     >
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                          <h3 className="text-sm font-bold text-slate-900 font-sans">Notifications</h3>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-sans uppercase">{unreadCount} New</span>
                        </div>
                        <div className="max-h-[350px] overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                              <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                              <p className="text-xs text-slate-400 font-medium">All caught up!</p>
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className={`p-4 border-b border-slate-50 flex items-start gap-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                                  n.type === 'message' ? 'bg-indigo-100 text-indigo-600' : 
                                  n.type === 'application' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                   {n.type === 'message' ? <MessageSquare size={14} /> : 
                                    n.type === 'application' ? <Rocket size={14} /> : <HelpCircle size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-xs font-bold text-slate-900 mb-0.5">{n.senderName}</p>
                                   <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2 font-medium">{n.text}</p>
                                   <div className="flex items-center gap-2">
                                      {!n.read && (
                                        <button 
                                          onClick={() => markAsRead(n.id)}
                                          className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 font-sans"
                                        >
                                          <Check size={10} /> Mark read
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => deleteNotification(n.id)}
                                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 hover:underline flex items-center gap-1 font-sans"
                                      >
                                        <X size={10} /> Clear
                                      </button>
                                   </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                     </motion.div>
                   </>
                 )}
               </AnimatePresence>
             </div>

             <Link to="/profile" className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold hover:border-slate-300 transition-all text-xs">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0)}
             </Link>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-8 max-w-6xl mx-auto"
          >
            <Outlet />
          </motion.div>
          
          <footer className="p-8 text-center text-slate-400 text-sm">
            CampusConnect Platform • Developed By Patel Arsh
          </footer>
        </main>
      </div>

      {/* Mobile Nav could be added here */}
    </div>
  );
}
