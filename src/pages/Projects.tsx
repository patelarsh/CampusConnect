import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { Rocket, Plus, Search, User, MessageCircle, Clock, CheckCircle2, Loader2, Users, UserPlus, ShieldCheck, School, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { generateText } from '../lib/gemini.ts';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [requestingCollabId, setRequestingCollabId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ title: '', description: '', requiredSkills: '' });
  const [loading, setLoading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [collabRequests, setCollabRequests] = useState<Record<string, string>>({}); // projectId -> status
  const [acceptedRequests, setAcceptedRequests] = useState<Set<string>>(new Set());
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [loadingAuthor, setLoadingAuthor] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const { user } = useAuth()!;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAuthorProfile = async (authorId: string) => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'users', authorId));
        if (snap.exists()) {
          setAuthorProfile(snap.data());
        }
      } catch (e) {
        console.error("Error fetching author profile:", e);
      } finally {
        setLoadingAuthor(false);
      }
    };

    if (selectedProject) {
      setLoadingAuthor(true);
      fetchAuthorProfile(selectedProject.authorId);
      
      if (selectedProject.collaborators && selectedProject.collaborators.length > 0) {
        fetchCollaboratorProfiles(selectedProject.collaborators);
      } else {
        setCollaboratorProfiles([]);
      }
    } else {
      setAuthorProfile(null);
      setCollaboratorProfiles([]);
    }
  }, [selectedProject]);

  const fetchCollaboratorProfiles = async (collaboratorIds: string[]) => {
    setLoadingCollaborators(true);
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const uniqueIds = Array.from(new Set(collaboratorIds));
      const profiles = await Promise.all(
        uniqueIds.map(async (id) => {
          const snap = await getDoc(doc(db, 'users', id));
          return snap.exists() ? { id, ...snap.data() } : null;
        })
      );
      setCollaboratorProfiles(profiles.filter(p => p !== null));
    } catch (e) {
      console.error("Error fetching collaborator profiles:", e);
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const handleViewProfile = async (userId: string) => {
    setFetchingProfile(true);
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        setViewingProfile({ id: snap.id, ...snap.data() });
        setIsProfileModalOpen(true);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    } finally {
      setFetchingProfile(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      fetchProjects();
      fetchUserRequests();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    } catch (e) {
      console.error("Error fetching user profile:", e);
    }
  };

  const fetchProjects = async () => {
    if (!userProfile?.collegeName) return;
    try {
      const q = query(
        collection(db, 'posts'), 
        where('collegeName', '==', userProfile.collegeName),
        orderBy('createdAt', 'desc')
      );
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

  const handlePolishAI = async () => {
    if (!newProject.title) {
      alert("Please enter a project title first.");
      return;
    }
    setPolishing(true);
    try {
      const prompt = `Write a professional and catchy project description for a university collaboration platform. 
        Title: ${newProject.title}
        Current Description: ${newProject.description || "Looking for partners"}
        Requirements: ${newProject.requiredSkills || "TBD"}
        Make it around 2-3 sentences. Focused on student collaboration.`;
      
      const result = await generateText(prompt);
      setNewProject(prev => ({ ...prev, description: result.trim() }));
    } catch (e) {
      console.error("AI Polish failed:", e);
      alert("AI service is currently unavailable. Please try again later.");
    } finally {
      setPolishing(false);
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
        collegeName: userProfile.collegeName,
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
        <div className="flex bg-slate-800/50 p-3 rounded-2xl border border-slate-800 flex-1">
           <School size={16} className="text-indigo-400 mt-0.5" />
           <div className="ml-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Affiliated Campus</p>
              <p className="text-xs font-bold text-slate-200">{userProfile?.collegeName || 'Loading...'}</p>
           </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all self-start"
        >
          <Plus size={20} />
          Post a Project
        </button>
      </header>

      {/* College Info Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck size={18} />
          </div>
          <p className="text-sm text-indigo-900 font-medium">
            You are viewing projects exclusive to <span className="font-bold">{userProfile?.collegeName}</span>
          </p>
        </div>
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap bg-white px-2 py-1 rounded-lg border border-indigo-100">
          Campus Locked
        </div>
      </div>

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
            whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
            onClick={() => setSelectedProject(project)}
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
              {project.requiredSkills?.slice(0, 3).map((skill: string, idx: number) => (
                <span key={`skill-${project._id}-${idx}`} className="px-3 py-1.5 bg-slate-50/50 text-slate-500 text-[10px] font-bold rounded-xl border border-slate-100 uppercase tracking-wider">
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
                     {(Array.isArray(selectedProject.requiredSkills) 
                        ? selectedProject.requiredSkills 
                        : (typeof selectedProject.requiredSkills === 'string' ? selectedProject.requiredSkills.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '') : [])
                      ).map((skill: string, idx: number) => (
                        <span key={`skill-req-${selectedProject._id}-${idx}`} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-100">
                         {skill}
                       </span>
                     ))}
                   </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Project Lead</h4>
                  <div 
                    onClick={() => handleViewProfile(selectedProject.authorId)}
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-colors"
                  >
                     <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 overflow-hidden">
                        {authorProfile?.photoURL ? (
                          <img src={authorProfile.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          selectedProject.authorName?.charAt(0)
                        )}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{selectedProject.authorName}</p>
                        {loadingAuthor ? (
                          <div className="h-3 w-20 bg-slate-200 animate-pulse rounded mt-1" />
                        ) : authorProfile ? (
                          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter">
                            {authorProfile.semester} • {authorProfile.department || 'Student'}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Campus Member</p>
                        )}
                     </div>
                  </div>
                </div>
              </div>

              {selectedProject.collaborators && selectedProject.collaborators.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Collaborators</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {loadingCollaborators ? (
                      [1, 2].map(i => (
                        <div key={`skeleton-${i}`} className="h-16 bg-slate-50 animate-pulse rounded-2xl" />
                      ))
                    ) : (
                      collaboratorProfiles.map((collab: any) => (
                        <div 
                          key={collab.id}
                          onClick={() => handleViewProfile(collab.id)}
                          className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm overflow-hidden">
                            {collab.photoURL ? (
                              <img src={collab.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              collab.name?.charAt(0) || collab.displayName?.charAt(0) || 'U'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{collab.name || collab.displayName || 'Student'}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{collab.semester} • {collab.department}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Author Actions (Manage) */}
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

              {/* Collaborator Actions (View Workspace) */}
              {(selectedProject.collaborators?.includes(user?.uid) || selectedProject.authorId === user?.uid) && (
                 <div className="mb-8 p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                          <CheckCircle2 size={24} />
                       </div>
                       <div>
                          <h4 className="text-emerald-900 font-black text-sm uppercase tracking-tight">Access Granted</h4>
                          <p className="text-emerald-600/80 text-xs font-medium">You are a confirmed collaborator on this project.</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/workspace/${selectedProject._id}`)}
                      className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all uppercase tracking-widest"
                    >
                       Workspace Hub
                    </button>
                 </div>
              )}

              <div className="flex gap-4">
                 <button
                   onClick={() => setSelectedProject(null)}
                   className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                 >
                   Close Details
                 </button>
                 {selectedProject.authorId !== user?.uid && !selectedProject.collaborators?.includes(user?.uid) && (
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

        {/* Profile Card Modal */}
        <AnimatePresence>
          {isProfileModalOpen && viewingProfile && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-100 mb-6 overflow-hidden">
                    {viewingProfile.photoURL ? (
                      <img src={viewingProfile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      viewingProfile.name?.charAt(0) || 'U'
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 mb-1">{viewingProfile.name}</h3>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded uppercase tracking-widest border border-indigo-100">
                      {viewingProfile.semester}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 text-xs font-bold">{viewingProfile.department}</span>
                  </div>

                  <div className="w-full space-y-6 text-left">
                    {viewingProfile.bio && (
                      <div>
                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1">About</h4>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-sm text-slate-600 leading-relaxed italic">"{viewingProfile.bio}"</p>
                        </div>
                      </div>
                    )}

                    {viewingProfile.skills && (
                      <div>
                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1 text-center md:text-left">Expertise</h4>
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      {(Array.isArray(viewingProfile.skills) 
                        ? viewingProfile.skills 
                        : (typeof viewingProfile.skills === 'string' ? viewingProfile.skills.split(',') : [])
                      ).map((skill: string, idx: number) => (
                        <span key={`profile-skill-${viewingProfile.id}-${idx}`} className="px-3 py-1.5 bg-white border border-slate-100 text-slate-600 text-xs font-bold rounded-xl shadow-sm">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                      </div>
                    )}

                    <div className="pt-6 flex flex-col gap-3">
                      <button
                        onClick={() => navigate('/chat', { state: { recipientId: viewingProfile.id, recipientName: viewingProfile.name } })}
                        className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={18} />
                        Message {(viewingProfile.name || 'User').split(' ')[0]}
                      </button>
                      <button
                        onClick={() => setIsProfileModalOpen(false)}
                        className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Description</label>
                    <button 
                      type="button"
                      onClick={handlePolishAI}
                      disabled={polishing}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      {polishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI Polish
                    </button>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium"
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
