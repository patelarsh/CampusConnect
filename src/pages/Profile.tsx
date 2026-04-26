import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.tsx';
import { db, auth, handleFirestoreError, storage } from '../lib/firebase.ts';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, Mail, GraduationCap, Code, Briefcase, Camera, Settings, Shield, Loader2, School, HardDrive, CheckCircle2, ChevronDown, RotateCcw, FileText, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { hasDriveAccess } from '../lib/googleDrive.ts';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { INDIAN_COLLEGES } from '../constants/colleges.ts';

export default function Profile() {
  const { user } = useAuth()!;
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(hasDriveAccess());
  const [collegeSearch, setCollegeSearch] = useState('');
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCollegeLocked, setIsCollegeLocked] = useState(false);

  const filteredColleges = INDIAN_COLLEGES.filter(c => 
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
        localStorage.setItem('google_token_expiry', (Date.now() + 3500 * 1000).toString());
        setIsDriveConnected(true);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect Google account');
    }
  };

  const handleDisconnectGoogle = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    setIsDriveConnected(false);
  };
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    collegeName: '',
    semester: '',
    department: '',
    skills: '',
    bio: '',
    photoURL: '',
    notes: ''
  });

  useEffect(() => {
    if (user && !profile.name) {
      setProfile(prev => ({
        ...prev,
        name: user.displayName || '',
        email: user.email || ''
      }));
    }
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
          collegeName: data.collegeName || '',
          semester: data.semester || 'Semester 6',
          department: data.department || 'Computer Engineering',
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || ''),
          bio: data.bio || '',
          photoURL: data.photoURL || user.photoURL || '',
          notes: data.notes || ''
        });
        if (data.collegeName) {
          setIsCollegeLocked(true);
        }
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
    if (!profile.collegeName) {
      alert('Please select your college to continue.');
      return;
    }
    setSaving(true);
    try {
      let photoURL = profile.photoURL;

      if (selectedFile) {
        const storageRef = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(storageRef, selectedFile);
        photoURL = await getDownloadURL(storageRef);
      }

      const rawSkills = profile.skills || '';
      const skillsArray = typeof rawSkills === 'string' 
        ? rawSkills.split(',').map(s => s.trim()).filter(s => s !== '')
        : (Array.isArray(rawSkills) ? rawSkills : []);

      await setDoc(doc(db, 'users', user.uid), {
        name: profile.name,
        email: profile.email,
        collegeName: profile.collegeName,
        semester: profile.semester,
        department: profile.department,
        skills: skillsArray,
        bio: profile.bio,
        photoURL: photoURL,
        notes: profile.notes,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      alert('Profile updated successfully!');
      window.location.reload(); 
    } catch (err) {
      handleFirestoreError(err, 'write', `users/${user.uid}`);
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

      {/* Onboarding Alert */}
      {!profile.collegeName && (
        <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
               <School size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-amber-900">Complete your profile</h3>
               <p className="text-sm text-amber-700">Select your college to access campus notes, projects, and community chats.</p>
             </div>
           </div>
           <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-100/50 px-4 py-2 rounded-xl">
             <RotateCcw size={14} className="animate-spin" />
             Setup Pending
           </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 space-y-2">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
            {id: 'security', label: 'Security', icon: Shield},
            {id: 'integrations', label: 'Integrations', icon: HardDrive},
            {id: 'preferences', label: 'Preferences', icon: Settings},
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
        <div className="flex-1 space-y-8">
          {activeTab === 'profile' && (
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleUpdate} 
              className="space-y-8"
            >
              {/* Profile Card */}
              <section className="bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm">
                 <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    <div className="relative group">
                       <div className="w-32 h-32 rounded-3xl bg-indigo-50 overflow-hidden flex items-center justify-center text-indigo-600 text-4xl font-bold border-4 border-white shadow-xl relative">
                          {previewUrl || profile.photoURL ? (
                             <img src={previewUrl || profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                             profile.name.charAt(0) || user?.email?.charAt(0)
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <Camera size={24} className="text-white" />
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                       </div>
                       <div className="absolute -bottom-2 -right-2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg border-4 border-white">
                          <Camera size={18} />
                       </div>
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
                          <div className="space-y-1.5 relative">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <School size={12} /> College
                             </label>
                              <div className="relative">
                               <button
                                 type="button"
                                 disabled={isCollegeLocked}
                                 onClick={() => setShowCollegeDropdown(!showCollegeDropdown)}
                                 className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 flex items-center justify-between group ${isCollegeLocked ? 'cursor-not-allowed opacity-75' : ''}`}
                               >
                                 <span className="truncate">{profile.collegeName || 'Select your college'}</span>
                                 {!isCollegeLocked ? (
                                   <ChevronDown size={18} className={`text-slate-400 transition-transform ${showCollegeDropdown ? 'rotate-180' : ''}`} />
                                 ) : (
                                   <Shield size={14} className="text-indigo-600" />
                                 )}
                               </button>
                               {isCollegeLocked && (
                                 <p className="mt-2 text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1.5 px-1">
                                   <ShieldAlert size={10} /> Note: University selection is permanent and cannot be changed.
                                 </p>
                               )}
                               {!isCollegeLocked && (
                                 <p className="mt-2 text-[10px] text-slate-400 font-medium italic px-1">
                                   Please select carefully. This can only be set once.
                                 </p>
                               )}

                               <AnimatePresence>
                                 {showCollegeDropdown && (
                                   <motion.div
                                     initial={{ opacity: 0, y: 10 }}
                                     animate={{ opacity: 1, y: 0 }}
                                     exit={{ opacity: 0, y: 10 }}
                                     className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                                   >
                                     <div className="p-3 border-b border-slate-100">
                                       <input 
                                         autoFocus
                                         placeholder="Search college..."
                                         value={collegeSearch}
                                         onChange={(e) => setCollegeSearch(e.target.value)}
                                         className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                       />
                                     </div>
                                     <div className="max-h-60 overflow-y-auto">
                                       {filteredColleges.length > 0 ? (
                                         filteredColleges.map((c, i) => (
                                           <button
                                             key={`college-option-${c}`}
                                             type="button"
                                             onClick={() => {
                                               setProfile({...profile, collegeName: c});
                                               setShowCollegeDropdown(false);
                                               setCollegeSearch('');
                                             }}
                                             className="w-full px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-b border-slate-50 last:border-0"
                                           >
                                             {c}
                                           </button>
                                         ))
                                       ) : (
                                         <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                           No colleges found
                                         </div>
                                       )}
                                     </div>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
                             </div>
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

                       <div className="space-y-3">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                             <FileText size={12} /> Personal Notes (Private)
                          </label>
                          <textarea 
                            value={profile.notes}
                            onChange={(e) => setProfile({...profile, notes: e.target.value})}
                            placeholder="Jot down something for yourself..."
                            rows={4}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-600 resize-none" 
                          />
                       </div>
                    </div>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32" />
              </section>
    
              <div className="flex justify-end gap-4">
                 <button type="button" onClick={fetchProfile} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all">
                    Reset
                 </button>
                 <button type="submit" disabled={saving} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                 </button>
              </div>
            </motion.form>
          )}

          {activeTab === 'integrations' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <HardDrive size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Connected Services</h2>
                    <p className="text-sm text-slate-500">Enable cloud storage and other integrations.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                         <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-indigo-600">
                          <path d="M12.5,2L6.2,12.7L2,19.3h12.5l4.3-7.5L12.5,2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900">Google Drive</h3>
                          {isDriveConnected && <CheckCircle2 size={14} className="text-emerald-500" />}
                        </div>
                        <p className="text-xs text-slate-500">Required to store study notes in your private Drive.</p>
                      </div>
                    </div>
                    
                    {isDriveConnected ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                          Connected
                        </span>
                        <button
                          onClick={handleDisconnectGoogle}
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectGoogle}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                      >
                         Connect Drive
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-600 rounded-3xl text-white">
                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Why connect Drive?</p>
                <p className="text-sm font-medium leading-relaxed">
                  By connecting your Google Drive, your shared notes are stored directly in your account's 'Drive File' space. This gives you full control and ownership over your academic resources while sharing with the community.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center py-20">
                <Shield size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Security Settings</h3>
                <p className="text-slate-500 max-w-sm mx-auto">Password management and two-factor authentication coming soon to enhance your campus security.</p>
             </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
