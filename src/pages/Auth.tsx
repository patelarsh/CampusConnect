import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db, handleFirestoreError } from '../lib/firebase.ts';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Rocket, GraduationCap, Users, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            <img src="https://ashishvidhyalay.com/ADM/Connect%20(1).png" width="160px" alt="CampusConnect" />
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
                key={feature.label}
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
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Arsh Patel"
                    />
                  </div>
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
