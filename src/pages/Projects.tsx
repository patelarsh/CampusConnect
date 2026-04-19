import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { Rocket, Plus, Search, User, MessageCircle, Clock, CheckCircle2, Loader2, Users, UserPlus, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [requestingCollabId, setRequestingCollabId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ title: '', description: '', requiredSkills: '' });
  const [loading, setLoading] = useState(false);
  const [collabRequests, setCollabRequests] = useState<Record<string, string>>({}); // projectId -> status
  const [acceptedRequests, setAcceptedRequests] = useState<Set<string>>(new Set());
  const { user } = useAuth()!;
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchUserRequests();
  }, [user]);

  const fetchProjects = async () => {
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedProjects = querySnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      setProjects(fetchedProjects);
      
      // Update selected project if it exists
      if (selectedProject) {
        const updated = fetchedProjects.find(p => p._id === selectedProject._id);
        if (updated) setSelectedProject(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserRequests = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'collaborationRequests'), where('senderId', '==', user.uid));
      const snap = await getDocs(q);
      const reqMap: Record<string, string> = {};
      const accepted = new Set<string>();
      snap.forEach(doc => {
        const data = doc.data();
        reqMap[data.projectId] = data.status;
        if (data.status === 'accepted') accepted.add(data.projectId);
      });
      setCollabRequests(reqMap);
      setAcceptedRequests(accepted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        title: newProject.title,
        description: newProject.description,
        authorId: user?.uid,
        authorName: user?.displayName,
        requiredSkills: newProject.requiredSkills.split(',').map(s => s.trim()),
        collaborators: [],
        status: 'open',
        createdAt: serverTimestamp(),
      });

      setShowModal(false);
      setNewProject({ title: '', description: '', requiredSkills: '' });
      fetchProjects();
    } catch (err) {
      handleFirestoreError(err, 'create', 'posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCollabRequest = async (project: any) => {
    if (project.authorId === user?.uid) return;
    // Check if any request exists to prevent multiples
    if (collabRequests[project._id]) return;

    setRequestingCollabId(project._id);
    try {
      await addDoc(collection(db, 'collaborationRequests'), {
        projectId: project._id,
        projectTitle: project.title,
        senderId: user?.uid,
        senderName: user?.displayName || 'Student',
        recipientId: project.authorId,
        recipientName: project.authorName || 'Student',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Notify project owner
      await addDoc(collection(db, 'notifications'), {
        recipientId: project.authorId,
        senderId: user?.uid,
        senderName: user?.displayName || 'Student',
        type: 'collab_request',
        relatedId: project._id,
        text: `Requested to collaborate on: ${project.title}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setCollabRequests(prev => ({ ...prev, [project._id]: 'pending' }));
      alert(`Collaboration request for "${project.title}" has been sent!`);
    } catch (e) {
      handleFirestoreError(e, 'create', 'collaborationRequests');
    } finally {
      setRequestingCollabId(null);
    }
  };

  const updateProjectStatus = async (projectId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'posts', projectId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      await fetchProjects();
    } catch (err) {
      handleFirestoreError(err, 'update', `posts/${projectId}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Project Hub</h1>
          <p className="text-slate-500">Find the perfect partners for your next big idea.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all self-start"
        >
          <Plus size={20} />
          Post a Project
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by title, skills or keywords..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => (
          <motion.div
            key={project._id}
            layout
            whileHover={{ y: -5, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
            onClick={() => {
              const isMember = project.authorId === user?.uid || project.collaborators?.includes(user?.uid);
              if (isMember) {
                navigate(`/projects/${project._id}/workspace`);
              } else {
                setSelectedProject(project);
              }
            }}
            className="p-7 bg-white border border-slate-100 rounded-[2rem] shadow-sm transition-all duration-300 group flex flex-col cursor-pointer hover:border-indigo-100 relative overflow-hidden"
          >
            {/* Background Decorative Element */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50/30 rounded-full blur-2xl group-hover:bg-indigo-100/50 transition-colors" />

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-white text-indigo-600 rounded-2xl shadow-inner border border-indigo-50/50">
                <Rocket size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                  project.status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                  project.status === 'in-progress' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                  'bg-slate-50 text-slate-500 border border-slate-100'
                }`}>
                  {project.status}
                </span>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                  {project.createdAt?.toDate ? formatDistanceToNow(project.createdAt.toDate()) : 'Now'} ago
                </span>
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-2 truncate group-hover:text-indigo-600 transition-colors tracking-tight">{project.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1 line-clamp-3 font-medium">{project.description}</p>

            <div className="flex flex-wrap gap-2 mb-8">
              {project.requiredSkills?.slice(0, 3).map((skill: string) => (
                <span key={skill} className="px-3 py-1.5 bg-slate-50/50 text-slate-500 text-[10px] font-bold rounded-xl border border-slate-100 uppercase tracking-wider">
                  {skill}
                </span>
              ))}
              {project.requiredSkills?.length > 3 && (
                <span className="px-2 py-1.5 text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                  +{project.requiredSkills.length - 3} More
                </span>
              )}
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm border border-white">
                    {project.authorName?.charAt(0) || <User size={16} />}
                  </div>
                  <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                    <CheckCircle2 size={8} className="text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-none mb-0.5">{project.authorName || 'Campus Student'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Project Lead</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    project.authorId === user?.uid ? navigate('/dashboard') : handleCollabRequest(project);
                  }}
                  disabled={(project.authorId !== user?.uid && collabRequests[project._id] === 'pending') || requestingCollabId === project._id}
                  className={`p-2.5 rounded-xl transition-all shadow-sm ${
                    project.authorId === user?.uid 
                      ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' 
                      : collabRequests[project._id]
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                  }`}
                  title={project.authorId === user?.uid ? "Manage Project" : collabRequests[project._id] ? "Request Already Sent" : "Request Collaboration"}
                >
                   {requestingCollabId === project._id ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : project.authorId === user?.uid ? (
                    <Users size={18} />
                  ) : acceptedRequests.has(project._id) ? (
                    <ShieldCheck size={18} />
                  ) : collabRequests[project._id] ? (
                    <Clock size={18} />
                  ) : (
                    <UserPlus size={18} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Post Project Modal */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                   <Rocket size={32} />
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    selectedProject.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 
                    selectedProject.status === 'in-progress' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {selectedProject.status}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-2">
                    Project Life-cycle
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 p-2 rounded-xl">
                 <div className="flex items-center gap-1.5 ml-2">
                    <Clock size={12} className="text-slate-300" />
                    <span>Posted {selectedProject.createdAt?.toDate ? formatDistanceToNow(selectedProject.createdAt.toDate()) : 'Recently'}</span>
                 </div>
                 <div className="w-1 h-1 bg-slate-200 rounded-full" />
                 <div className="flex items-center gap-1.5 font-black text-indigo-500">
                    <Rocket size={12} />
                    <span>ID: {selectedProject._id.substring(0, 8)}</span>
                 </div>
              </div>

              <h2 className="text-3xl font-black text-slate-900 mb-4 leading-tight">{selectedProject.title}</h2>
              <div className="prose prose-slate max-w-none mb-8">
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedProject.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Required Expertise</h4>
                   <div className="flex flex-wrap gap-2">
                     {selectedProject.requiredSkills?.map((skill: string) => (
                       <span key={skill} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-100">
                         {skill}
                       </span>
                     ))}
                   </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Project Lead</h4>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                     <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {selectedProject.authorName?.charAt(0)}
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-900">{selectedProject.authorName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Campus Hero</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* Author Actions */}
              {selectedProject.authorId === user?.uid && (
                <div className="p-8 bg-slate-900 rounded-[2rem] text-white mb-8 shadow-2xl shadow-slate-200 border border-slate-800">
                   <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="text-center md:text-left">
                         <h4 className="font-black text-lg mb-1 flex items-center gap-2 justify-center md:justify-start">
                            Management Terminal
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                         </h4>
                         <p className="text-slate-400 text-xs font-medium">Control the project's public visibility and active status.</p>
                      </div>
                      <div className="flex bg-slate-800/50 p-1 rounded-2xl border border-slate-700">
                        {['open', 'in-progress', 'completed'].map((status) => (
                          <button
                            key={status}
                            disabled={updatingStatus || selectedProject.status === status}
                            onClick={() => updateProjectStatus(selectedProject._id, status)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                              selectedProject.status === status
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50'
                            }`}
                          >
                            {status.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                   </div>
                </div>
              )}

              <div className="flex gap-4">
                 <button
                   onClick={() => setSelectedProject(null)}
                   className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                 >
                   Close Details
                 </button>
                 {selectedProject.authorId !== user?.uid && (
                    <button
                      onClick={() => handleCollabRequest(selectedProject)}
                      disabled={!!collabRequests[selectedProject._id]}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
                        collabRequests[selectedProject._id]
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700'
                      }`}
                    >
                      {collabRequests[selectedProject._id] === 'accepted' ? 'Partnered' : 
                       collabRequests[selectedProject._id] ? 'Request Sent' : 'Request to Collaborate'}
                    </button>
                 )}
              </div>
            </motion.div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Post a New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Title</label>
                  <input
                    type="text"
                    required
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. React Native Fitness App"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Describe the project goal, scope and what you need..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Skills (comma separated)</label>
                  <input
                    type="text"
                    required
                    value={newProject.requiredSkills}
                    onChange={(e) => setNewProject({ ...newProject, requiredSkills: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="React, Firebase, UI Design"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Posting...' : 'Post Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
