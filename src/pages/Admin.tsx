import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, orderBy } from 'firebase/firestore';
import { Users, Search, GraduationCap, ShieldAlert, ShieldCheck, Trash2, Edit2, Check, X, Filter, ChevronDown, School, UserX, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INDIAN_COLLEGES } from '../constants/colleges.ts';

interface CampusUser {
  id: string;
  name?: string;
  email?: string;
  collegeName?: string;
  isBanned?: boolean;
  createdAt?: any;
}

export default function Admin() {
  const [users, setUsers] = useState<CampusUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'banned' | 'active'>('all');
  const [editingUniversity, setEditingUniversity] = useState<{id: string, value: string, search: string} | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CampusUser[];
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateUniversity = async (userId: string, newCollege: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        collegeName: newCollege
      });
      setEditingUniversity(null);
    } catch (error) {
      console.error("Error updating university:", error);
    }
  };

  const handleToggleBan = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: !currentStatus
      });
    } catch (error) {
      console.error("Error toggling ban status:", error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.collegeName?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterMode === 'banned') return matchesSearch && user.isBanned;
    if (filterMode === 'active') return matchesSearch && !user.isBanned;
    return matchesSearch;
  });

  const filteredColleges = editingUniversity ? INDIAN_COLLEGES.filter(c => 
    c.toLowerCase().includes(editingUniversity.search.toLowerCase())
  ) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200">
               <Users size={28} />
            </div>
            Management Center
          </h1>
          <p className="text-slate-500 font-medium font-sans">Control panel for user moderation and university routing.</p>
        </div>
        <div className="relative z-10 flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
           <div className="px-5 py-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 flex items-center gap-2">
             <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
             {users.length} Users Total
           </div>
           <div className="px-5 py-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 flex items-center gap-2">
             <span className="w-2 h-2 bg-rose-600 rounded-full" />
             {users.filter(u => u.isBanned).length} Suspended
           </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search by name, email or university..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium shadow-sm"
          />
        </div>
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem]">
          {(['all', 'active', 'banned'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${
                filterMode === mode 
                  ? 'bg-white text-slate-900 shadow-md transform scale-[1.02]' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity & Credentials</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campus Routing</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium font-sans">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-50">
                       <Search size={32} />
                    </div>
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <motion.tr 
                    layout
                    key={user.id}
                    className={`group hover:bg-slate-50/80 transition-colors ${user.isBanned ? 'bg-rose-50/20' : ''}`}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base transition-transform group-hover:scale-105 ${user.isBanned ? 'bg-rose-100 text-rose-700 shadow-rose-100 shadow-xl' : 'bg-indigo-50 text-indigo-700 shadow-indigo-100 shadow-xl'}`}>
                          {user.name?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none mb-1.5">{user.name || 'Anonymous User'}</p>
                          <p className="text-xs text-slate-500 font-medium font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 relative">
                      {editingUniversity?.id === user.id ? (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                           <motion.div 
                             initial={{ scale: 0.9, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6"
                           >
                              <div className="flex items-center justify-between">
                                 <h3 className="font-black text-slate-900 flex items-center gap-3">
                                   <School className="text-indigo-600" />
                                   Route University
                                 </h3>
                                 <button onClick={() => setEditingUniversity(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                   <X size={20} />
                                 </button>
                              </div>

                              <div className="space-y-4">
                                 <input 
                                   autoFocus
                                   placeholder="Search and select university..."
                                   value={editingUniversity.search}
                                   onChange={(e) => setEditingUniversity({ ...editingUniversity, search: e.target.value })}
                                   className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 outline-none"
                                 />
                                 
                                 <div className="max-h-60 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                                   {filteredColleges.map((c, i) => (
                                     <button
                                       key={`college-option-${c}`}
                                       onClick={() => handleUpdateUniversity(user.id, c)}
                                       className="w-full px-4 py-3.5 text-left text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                                     >
                                       {c}
                                     </button>
                                   ))}
                                 </div>
                              </div>
                           </motion.div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/u">
                          <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                             <span className="text-xs text-slate-600 font-bold uppercase tracking-tight">
                               {user.collegeName || 'Unassigned'}
                             </span>
                          </div>
                          <button 
                            onClick={() => setEditingUniversity({ id: user.id, value: user.collegeName || '', search: '' })}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        {user.isBanned ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 shadow-sm">
                            <ShieldAlert size={12} /> Banned Access
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                            <ShieldCheck size={12} /> Verified Member
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button 
                         onClick={() => handleToggleBan(user.id, user.isBanned || false)}
                         className={`group flex items-center gap-2 ml-auto px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                           user.isBanned 
                             ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100' 
                             : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-100'
                         }`}
                       >
                         {user.isBanned ? (
                           <>
                             <UserCheck size={14} /> Restore Access
                           </>
                         ) : (
                           <>
                             <UserX size={14} /> Revoke Access
                           </>
                         )}
                       </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

