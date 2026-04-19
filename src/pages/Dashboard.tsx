import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.tsx';
import { getDocs, collection, query, where, orderBy, updateDoc, doc, addDoc, serverTimestamp, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { Rocket, Users, BookOpen, HelpCircle, ArrowRight, Check, X, MessageSquare, Loader2, Sparkles, UserPlus, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth()!;
  const navigate = useNavigate();
  const [stats, setStats] = useState({ posts: 0, notes: 0, doubts: 0 });
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReq, setLoadingReq] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetchStats();

    // Real-time listener for incoming requests
    const qIncoming = query(
      collection(db, 'collaborationRequests'),
      where('recipientId', '==', user.uid)
    );
    const unsubIncoming = onSnapshot(qIncoming, (snap) => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory to avoid index requirements for now
      setIncomingRequests(reqs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (err) => {
      console.error("Incoming requests listener error:", err);
      handleFirestoreError(err, 'list', 'collaborationRequests');
    });

    // Real-time listener for outgoing requests
    const qOutgoing = query(
      collection(db, 'collaborationRequests'),
      where('senderId', '==', user.uid)
    );
    const unsubOutgoing = onSnapshot(qOutgoing, (snap) => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOutgoingRequests(reqs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (err) => {
      console.error("Outgoing requests listener error:", err);
      handleFirestoreError(err, 'list', 'collaborationRequests');
    });

    // Real-time listener for my projects
    const qProjects = query(
      collection(db, 'posts'),
      where('authorId', '==', user.uid)
    );
    const unsubProjects = onSnapshot(qProjects, (snap) => {
       setMyProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
       console.error("My projects listener error:", err);
       handleFirestoreError(err, 'list', 'posts');
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubProjects();
    };
  }, [user]);

  const fetchStats = async () => {
    try {
      const [pSnap, nSnap, dSnap] = await Promise.all([
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'notes')),
        getDocs(collection(db, 'questions'))
      ]);
      setStats({ 
        posts: pSnap.size || 0, 
        notes: nSnap.size || 0, 
        doubts: dSnap.size || 0 
      });
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const handleRequestStatus = async (request: any, status: 'accepted' | 'declined') => {
    setLoadingReq(request.id);
    try {
      await updateDoc(doc(db, 'collaborationRequests', request.id), { status });

      if (status === 'accepted') {
        const postRef = doc(db, 'posts', request.projectId);
        await updateDoc(postRef, {
          collaborators: arrayUnion(request.senderId)
        });

        await addDoc(collection(db, 'notifications'), {
          recipientId: request.senderId,
          senderId: user?.uid,
          senderName: user?.displayName,
          type: 'collab_accept',
          relatedId: request.projectId,
          text: `Accepted your collaboration request for: ${request.projectTitle}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      handleFirestoreError(e, 'update', `collaborationRequests/${request.id}`);
    } finally {
      setLoadingReq(null);
    }
  };

  const pendingIncoming = incomingRequests.filter(r => r.status === 'pending');
  const acceptedIncoming = incomingRequests.filter(r => r.status === 'accepted');

  if (loading) {
     return (
       <div className="h-[60vh] flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
       </div>
     );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium">Welcome back, <span className="text-indigo-600 font-bold">{user?.displayName || 'Student'}</span>! 👋</p>
        </div>
        <div className="flex gap-4">
           <Link to="/projects" className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-2">
              <Sparkles size={18} />
              Explore Hub
           </Link>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Live Projects', count: stats.posts, icon: Rocket, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/projects' },
          { label: 'Notes Shared', count: stats.notes, icon: BookOpen, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', link: '/notes' },
          { label: 'Active Doubts', count: stats.doubts, icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-50', link: '/doubts' },
        ].map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-inner`}>
                <stat.icon size={28} />
              </div>
              <ArrowRight className="text-slate-200 group-hover:text-slate-900 transition-colors" size={24} />
            </div>
            <p className="text-4xl font-black text-slate-900 mb-1">{stat.count}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Collaboration Column */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Incoming Management */}
          <section className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                   <UserPlus size={20} className="text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Collaboration Requests</h2>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full uppercase tracking-tighter border border-amber-100">
                  {pendingIncoming.length} New
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-tighter border border-emerald-100">
                  {acceptedIncoming.length} Partners
                </span>
              </div>
            </div>
            
            <div className="p-8">
               <AnimatePresence mode="popLayout">
                 {pendingIncoming.length === 0 && acceptedIncoming.length === 0 ? (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <Users size={32} />
                      </div>
                      <p className="text-slate-400 font-medium">No team activities at the moment.</p>
                   </motion.div>
                 ) : (
                   <div className="space-y-6">
                     {/* Pending */}
                     {pendingIncoming.map((req) => (
                       <motion.div
                         key={req.id}
                         layout
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                       >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 font-bold text-lg">
                               {req.senderName?.charAt(0)}
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-900">{req.senderName}</h4>
                               <p className="text-xs text-slate-500 font-medium">
                                 Wants to join <span className="text-indigo-600 font-bold">{req.projectTitle}</span>
                               </p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <button
                               onClick={() => handleRequestStatus(req, 'accepted')}
                               disabled={!!loadingReq}
                               className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center gap-2"
                            >
                               <Check size={14} /> Accept
                            </button>
                            <button
                               onClick={() => handleRequestStatus(req, 'declined')}
                               disabled={!!loadingReq}
                               className="px-4 py-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all"
                            >
                               <X size={14} /> Decline
                            </button>
                            <button
                               onClick={() => navigate('/chat', { state: { recipientId: req.senderId, recipientName: req.senderName } })}
                               className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-slate-400 transition-all"
                            >
                               <MessageSquare size={16} />
                            </button>
                         </div>
                       </motion.div>
                     ))}

                     {/* Partners */}
                     {acceptedIncoming.map((req) => (
                       <motion.div
                         key={req.id}
                         layout
                         className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                       >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 font-bold text-lg border-2 border-indigo-100">
                               {req.senderName?.charAt(0)}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900">{req.senderName}</h4>
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded uppercase tracking-widest">Partner</span>
                               </div>
                               <p className="text-xs text-slate-500 font-medium">Working on <span className="font-bold text-slate-700">{req.projectTitle}</span></p>
                            </div>
                         </div>
                         <button
                           onClick={() => navigate('/chat', { state: { recipientId: req.senderId, recipientName: req.senderName } })}
                           className="px-4 py-2 bg-white border border-indigo-100 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-2"
                         >
                            <MessageSquare size={14} /> Chat with Partner
                         </button>
                       </motion.div>
                     ))}
                   </div>
                 )}
               </AnimatePresence>
            </div>
          </section>

          {/* My Active Projects */}
          <section className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
             <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <ShieldCheck size={20} className="text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Your Projects</h2>
                </div>
                <Link to="/projects" className="text-indigo-600 text-xs font-bold hover:underline">Post New Idea</Link>
             </div>
             <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {myProjects.length === 0 ? (
                  <div className="md:col-span-2 py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                     <p className="text-slate-400 text-sm font-medium">You haven't posted any projects yet.</p>
                  </div>
                ) : (
                  myProjects.map(p => (
                    <Link to="/projects" key={p.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-slate-100 transition-all group">
                       <h4 className="font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors uppercase text-xs tracking-tight">{p.title}</h4>
                       <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${p.status === 'open' ? 'text-emerald-500' : 'text-slate-400'}`}>
                             {p.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                             {p.collaborators?.length || 0} Partners
                          </span>
                       </div>
                    </Link>
                  ))
                )}
             </div>
          </section>
        </div>

        {/* Sidebar Status Column */}
        <div className="space-y-8">
           {/* Your Applications (Outgoing) */}
           <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-900/10">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Rocket size={18} className="text-indigo-400" />
                 Your Applications
              </h3>
              <div className="space-y-4">
                 {outgoingRequests.length === 0 ? (
                    <p className="text-slate-500 text-xs font-medium bg-slate-800/50 p-6 rounded-3xl border border-slate-800 italic">No applications sent. Start collaborating!</p>
                 ) : (
                    outgoingRequests.map(req => (
                       <div key={req.id} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                          <p className="text-xs font-bold mb-1 truncate">{req.projectTitle}</p>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'accepted' ? 'bg-emerald-500' : req.status === 'declined' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{req.status}</span>
                             </div>
                             {req.status === 'accepted' && (
                                <button
                                   onClick={() => navigate('/chat', { state: { recipientId: req.recipientId, recipientName: req.recipientName } })}
                                   className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                                >
                                   Chat Now
                                </button>
                             )}
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </section>

           {/* Quick Tips */}
           <section className="bg-indigo-600 rounded-[2.5rem] p-8 text-white">
              <h3 className="text-lg font-bold mb-4">Pro Tip 💡</h3>
              <p className="text-indigo-100 text-sm leading-relaxed mb-6 font-medium">
                 Projects with clear descriptions and diverse skill sets attract the best partners 2x faster!
              </p>
              <div className="pt-6 border-t border-indigo-500/50">
                 <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2 text-center">Community Impact</p>
                 <div className="flex justify-between items-end">
                    <div className="text-center">
                       <p className="text-2xl font-black">24</p>
                       <p className="text-[8px] font-bold uppercase tracking-tighter opacity-70">Active<br/>Teams</p>
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black">150</p>
                       <p className="text-[8px] font-bold uppercase tracking-tighter opacity-70">Solved<br/>Doubts</p>
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black">89</p>
                       <p className="text-[8px] font-bold uppercase tracking-tighter opacity-70">Resources<br/>Shared</p>
                    </div>
                 </div>
              </div>
           </section>
        </div>

      </div>
    </div>
  );
}
