import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Users, BookOpen, HelpCircle, GraduationCap, ChevronRight, Github, Twitter, Linkedin, Star, Shield, Zap, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App.tsx';

export default function Home() {
  const auth = useAuth();
  const user = auth?.user;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <img src="https://ashishvidhyalay.com/ADM/ConnectSpace.png" width="150px" alt="CampusConnect" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#about" className="hover:text-indigo-600 transition-colors">About</a>
            <a href="#stats" className="hover:text-indigo-600 transition-colors">Impact</a>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                    Log in
                  </Link>
                  <Link
                    to="/auth"
                    className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200"
                  >
                    Join Now
                  </Link>
                </>
              )}
            </div>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-8 space-y-6">
                <div className="flex flex-col gap-4 text-lg font-bold text-slate-600">
                  <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-600">Features</a>
                  <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-600">About</a>
                  <a href="#stats" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-600">Impact</a>
                </div>
                <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                  {user ? (
                    <Link
                      to="/dashboard"
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl text-center shadow-xl shadow-indigo-100"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/auth"
                        className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-center shadow-xl shadow-slate-200"
                      >
                        Join Now
                      </Link>
                      <Link
                        to="/auth"
                        className="w-full py-4 bg-white border border-slate-200 text-slate-900 font-black rounded-2xl text-center"
                      >
                        Log In
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-50 rounded-full blur-[120px] -z-10 opacity-60" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest mb-8 border border-indigo-100"
          >
            <Zap size={14} className="fill-current" />
            The Future of Student Collaboration
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black text-slate-900 tracking-tight leading-[0.9] mb-8"
          >
            Where Students <br />
            <span className="text-indigo-600">Build Together.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            CampusConnect is the decentralized hub for students to find project partners, 
            share high-quality notes, and solve doubts in real-time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/auth"
              className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group"
            >
              Get Started for Free
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 font-black rounded-2xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
            >
              Learn More
            </a>
          </motion.div>

          {/* User count badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex items-center justify-center gap-4"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={`user-avatar-${i}`} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                  <img src={`https://picsum.photos/seed/${i + 15}/100/100`} referrerPolicy="no-referrer" alt="User" />
                </div>
              ))}
            </div>
            <p className="text-sm font-bold text-slate-500">
              Joined by <span className="text-slate-900">5,000+</span> ambitious students
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Built for the Modern Student</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Everything you need to excel in your campus life</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Project Matchmaking',
                desc: 'Find developers, designers, and marketers for your next hackathon or semester project.',
                icon: Rocket,
                color: 'bg-indigo-600',
                light: 'bg-indigo-50'
              },
              {
                title: 'Resource Library',
                desc: 'Access subject-wise notes, previous year question papers, and study guides shared by peers.',
                icon: BookOpen,
                color: 'bg-fuchsia-600', light: 'bg-fuchsia-50'
              },
              {
                title: 'Real-time Doubts',
                desc: 'Stuck on a problem? Post a question and get answers from students across all semesters.',
                icon: HelpCircle,
                color: 'bg-amber-500', light: 'bg-amber-50'
              }
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className={`w-14 h-14 rounded-2xl ${f.light} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <f.icon size={28} className={f.color.replace('bg-', 'text-')} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-20 px-6">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-[40px] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]" />
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            {[
              { label: 'Active Users', value: '12K+' },
              { label: 'Projects Built', value: '450+' },
              { label: 'Notes Shared', value: '2.5K' },
              { label: 'Doubts Solved', value: '98%' },
            ].map((s) => (
              <div key={`stat-label-${s.label}`}>
                <h4 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{s.value}</h4>
                <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-16">
            <div className="max-w-xs">
              <Link to="/" className="flex items-center gap-2.5 mb-6">
                <img src="https://ashishvidhyalay.com/ADM/ConnectSpace.png" width="150px" alt="CampusConnect" />
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                The leading platform for students to collaborate, share resources, and help one another excel in their academic and creative pursuits.
              </p>
              <div className="flex items-center gap-4 text-slate-400">
                <Twitter size={20} className="hover:text-indigo-600 cursor-pointer transition-colors" />
                <Github size={20} className="hover:text-slate-900 cursor-pointer transition-colors" />
                <Linkedin size={20} className="hover:text-indigo-600 cursor-pointer transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div>
                <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Product</h5>
                <ul className="space-y-4 text-sm font-bold text-slate-500">
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Project Hub</li>
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Study Center</li>
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Real-time Chat</li>
                </ul>
              </div>
              <div>
                <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Community</h5>
                <ul className="space-y-4 text-sm font-bold text-slate-500">
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Student Forum</li>
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Campus Ambassadors</li>
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Success Stories</li>
                </ul>
              </div>
              <div>
                <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Legal</h5>
                <ul className="space-y-4 text-sm font-bold text-slate-500">
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Privacy Policy</li>
                  <li className="hover:text-indigo-600 cursor-pointer transition-colors">Terms of Service</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <p>© 2026 CampusConnect. Created by Patel Arsh</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5"><Shield size={14} /> Encrypted Platform</span>
              <span className="flex items-center gap-1.5"><Star size={14} className="fill-amber-400 text-amber-400" /> Rated 4.9/5</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
