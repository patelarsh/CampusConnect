import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User, Mail, GraduationCap, Code, Briefcase, Camera, Settings, Shield, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Profile() {
  const { user } = useAuth()!;
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    semester: '',
    department: '',
    skills: '',
    bio: ''
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          name: data.name || user.displayName || '',
          email: data.email || user.email || '',
          semester: data.semester || 'Semester 6',
          department: data.department || 'Computer Engineering',
          skills: (data.skills || []).join(', '),
          bio: data.bio || 'Product designer and developer'
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const skillsArray = profile.skills.split(',').map(s => s.trim()).filter(s => s !== '');
      await updateDoc(doc(db, 'users', user.uid), {
        name: profile.name,
        semester: profile.semester,
        department: profile.department,
        skills: skillsArray,
        bio: profile.bio,
        updatedAt: serverTimestamp()
      });
      alert('Profile updated successfully!');
    } catch (err) {
      handleFirestoreError(err, 'update', `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Account settings</h1>
        <p className="text-slate-500">Manage your profile information and campus visibility.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 space-y-2">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'preferences', label: 'Preferences', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'text-slate-500 hover:bg-white hover:text-slate-900'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <form onSubmit={handleUpdate} className="flex-1 space-y-8">
          {/* Profile Card */}
          <section className="bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden">
             <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                <div className="relative group">
                   <div className="w-32 h-32 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-4xl font-bold border-4 border-white shadow-xl">
                      {profile.name.charAt(0) || user?.email?.charAt(0)}
                   </div>
                   <button type="button" className="absolute -bottom-2 -right-2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-110 transition-all border-4 border-white">
                      <Camera size={18} />
                   </button>
                </div>
                
                <div className="flex-1 space-y-6 w-full">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <User size={12} /> Full Name
                         </label>
                         <input 
                           value={profile.name}
                           onChange={(e) => setProfile({...profile, name: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" 
                         />
                      </div>
                      <div className="space-y-1.5 opacity-60">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Mail size={12} /> Email Address (Private)
                         </label>
                         <p className="px-4 py-2.5 font-bold text-slate-600">{profile.email}</p>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <GraduationCap size={12} /> Semester
                         </label>
                         <select 
                           value={profile.semester}
                           onChange={(e) => setProfile({...profile, semester: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
                         >
                            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Briefcase size={12} /> Department
                         </label>
                         <input 
                           value={profile.department}
                           onChange={(e) => setProfile({...profile, department: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" 
                         />
                      </div>
                   </div>

                   <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                         <Code size={12} /> Skills (comma separated)
                      </label>
                      <input 
                        value={profile.skills}
                        onChange={(e) => setProfile({...profile, skills: e.target.value})}
                        placeholder="e.g. React, Node.js, UI Design"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" 
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                         <Mail size={12} /> About Me
                      </label>
                      <textarea 
                        value={profile.bio}
                        onChange={(e) => setProfile({...profile, bio: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-600 resize-none" 
                      />
                   </div>
                </div>
             </div>
             
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32" />
          </section>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
             <button type="button" onClick={fetchProfile} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all">
                Reset
             </button>
             <button type="submit" disabled={saving} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
