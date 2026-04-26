import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError } from '../lib/firebase.ts';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Rocket, GraduationCap, Users, BookOpen, School } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INDIAN_COLLEGES } from '../constants/colleges.ts';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', collegeName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');

  const filteredColleges = INDIAN_COLLEGES.filter(c => 
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      // Add Drive scope for future use
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // If new user, they need to pick a college
        // For now, we'll redirect to profile or show a simple picker if needed
        // But to keep it simple, we'll just create the doc with empty college and let them update later
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName,
          email: user.email,
          collegeName: '', // To be filled later
          createdAt: serverTimestamp(),
          skills: [],
          bio: '',
          semester: ''
        });
      }
      
      // Store the access token in localStorage for Drive API usage
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
        localStorage.setItem('google_token_expiry', (Date.now() + 3500 * 1000).toString());
      }

    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request') {
        // This error happens for a number of reasons:
        // 1. The user closed the popup before signing in
        // 2. Another popup was opened before the first one was closed
        // In many cases, it's safe to ignore.
        console.log('Google Sign-In popup closed or cancelled.');
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('Popup closed by user.');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        // Update Firebase Auth Profile
        await updateProfile(user, { displayName: formData.name });

        // Create Firestore User Document
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: formData.name,
            email: formData.email,
            collegeName: formData.collegeName,
            createdAt: serverTimestamp(),
            skills: [],
            bio: '',
            semester: ''
          });
        } catch (err) {
          handleFirestoreError(err, 'create', `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      setError(err.message.includes('auth/invalid-credential') 
        ? 'Invalid email or password.' 
        : err.message.includes('auth/email-already-in-use')
        ? 'This email is already registered.'
        : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row overflow-hidden">
      {/* Brand Section */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 relative">
        <div className="relative z-10 max-w-lg">
          <Link
            to="/"
            className="flex items-center gap-2 mb-8 group"
          >
            <img src="https://ashishvidhyalay.com/ADM/ConnectSpaceWhite.png" width="160px" alt="CampusConnect" />
          </Link>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-[1.1]"
          >
            Smart Student <span className="text-indigo-400">Collaboration</span> Platform.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-300 mb-8"
          >
            Find project partners, share notes, ask doubts, and build your portfolio with students from your campus.
          </motion.p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: 'Find Partners' },
              { icon: BookOpen, label: 'Share Notes' },
              { icon: GraduationCap, label: 'Solve Doubts' },
              { icon: Rocket, label: 'Grow Skills' },
            ].map((feature, i) => (
              <motion.div
                key={`feature-${feature.label}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl"
              >
                <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
                  <feature.icon size={18} />
                </div>
                <span className="text-sm font-medium text-slate-200">{feature.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[100px]" />
        </div>
      </div>

      {/* Auth Section */}
      <div className="flex-1 bg-white p-8 md:p-16 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-slate-500 mb-8">
                {isLogin ? 'Log in to continue your collaboration journey.' : 'Join the campus community today.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        required={!isLogin}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        placeholder="Arsh Patel"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your College</label>
                      <div className="relative">
                        <input
                          type="text"
                          required={!isLogin}
                          value={formData.collegeName || collegeSearch}
                          onFocus={() => {
                            setShowCollegeDropdown(true);
                            if (formData.collegeName) {
                              setCollegeSearch(formData.collegeName);
                              setFormData({ ...formData, collegeName: '' });
                            }
                          }}
                          onChange={(e) => {
                            setCollegeSearch(e.target.value);
                            setFormData({ ...formData, collegeName: '' });
                            setShowCollegeDropdown(true);
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none pl-10"
                          placeholder="Search or select your college..."
                        />
                        <School className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      </div>

                      {showCollegeDropdown && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                          {filteredColleges.length > 0 ? (
                            filteredColleges.map((college, idx) => (
                              <button
                                key={`${college}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, collegeName: college });
                                  setCollegeSearch('');
                                  setShowCollegeDropdown(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 border-b border-slate-50 last:border-0"
                              >
                                {college}
                              </button>
                            ))
                          ) : (
                             <button
                               type="button"
                               onClick={() => {
                                 setFormData({ ...formData, collegeName: collegeSearch });
                                 setShowCollegeDropdown(false);
                               }}
                               className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-indigo-600 italic"
                             >
                               Click to use: "{collegeSearch}"
                             </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    placeholder="you@campus.edu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none mt-4"
                >
                  {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500 font-medium italic">or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 shadow-sm disabled:opacity-50"
                >
                   <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  Google
                </button>
              </div>

              <div className="mt-8 text-center text-slate-500">
                <span>{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 text-indigo-600 font-bold hover:underline"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
