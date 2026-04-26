import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp, onSnapshot, where, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useAuth } from '../App.tsx';
import { HelpCircle, Search, MessageCircle, ArrowUpCircle, Filter, Plus, User, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function Questions() {
  const { user } = useAuth()!;
  const [questions, setQuestions] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', body: '', tags: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any[]>>({});
  const [newAnswer, setNewAnswer] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const unsubscribes = React.useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      fetchQuestions();
    }
    return () => {
      Object.values(unsubscribes.current).forEach(unsub => unsub());
    };
  }, [userProfile, sortBy]);

  const fetchUserProfile = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchQuestions = async () => {
    if (!userProfile?.collegeName) return;
    try {
      const q = query(
        collection(db, 'questions'), 
        where('collegeName', '==', userProfile.collegeName),
        orderBy(sortBy === 'newest' ? 'createdAt' : 'upvotes', 'desc')
      );
      const snap = await getDocs(q);
      setQuestions(snap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
      // Fallback if index is missing for top voted
      if (sortBy === 'top') {
        const q = query(
          collection(db, 'questions'), 
          where('collegeName', '==', userProfile.collegeName),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0));
        setQuestions(data);
      }
    }
  };

  const fetchAnswers = (questionId: string) => {
    const q = query(collection(db, 'questions', questionId, 'answers'), orderBy('createdAt', 'asc'));
    if (unsubscribes.current[questionId]) {
      unsubscribes.current[questionId]();
    }
    
    const unsub = onSnapshot(q, (snap) => {
      setAnswers(prev => ({
        ...prev,
        [questionId]: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (err) => {
      handleFirestoreError(err, 'list', `questions/${questionId}/answers`);
    });
    
    unsubscribes.current[questionId] = unsub;
    return unsub;
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!answers[id]) {
        fetchAnswers(id);
      }
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      const questionRef = doc(db, 'questions', questionId);
      const isUpvoted = questions.find(q => q._id === questionId)?.upvotedBy?.includes(user.uid);

      if (isUpvoted) {
        await updateDoc(questionRef, {
          upvotes: (questions.find(q => q._id === questionId)?.upvotes || 1) - 1,
          upvotedBy: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(questionRef, {
          upvotes: (questions.find(q => q._id === questionId)?.upvotes || 0) + 1,
          upvotedBy: arrayUnion(user.uid)
        });
      }
      fetchQuestions();
    } catch (err) {
      handleFirestoreError(err, 'update', `questions/${questionId}`);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        title: newQuestion.title,
        body: newQuestion.body,
        tags: Array.from(new Set(newQuestion.tags.split(',').map(t => t.trim()).filter(Boolean))),
        authorId: user?.uid,
        authorName: user?.displayName || 'Student',
        collegeName: userProfile.collegeName,
        upvotes: 0,
        upvotedBy: [],
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setNewQuestion({ title: '', body: '', tags: '' });
      fetchQuestions();
    } catch (err) {
      handleFirestoreError(err, 'create', 'questions');
    } finally {
      setLoading(false);
    }
  };

  const handlePostAnswer = async (e: React.FormEvent, question: any) => {
    e.preventDefault();
    if (!newAnswer.trim()) return;

    try {
      await addDoc(collection(db, 'questions', question._id, 'answers'), {
        text: newAnswer,
        authorId: user?.uid,
        authorName: user?.displayName || 'Student',
        createdAt: serverTimestamp()
      });

      // Send notification to question author
      if (question.authorId !== user?.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: question.authorId,
          senderId: user?.uid,
          senderName: user?.displayName || 'Student',
          type: 'reply',
          relatedId: question._id,
          text: `Answered your doubt: "${question.title.substring(0, 30)}..."`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewAnswer('');
    } catch (err) {
      handleFirestoreError(err, 'create', `questions/${question._id}/answers`);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         q.body.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !activeTag || q.tags?.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(questions.flatMap(q => q.tags || []))).sort();

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Doubt Section</h1>
          <p className="text-slate-500">Ask questions and get help from our smart student community.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-200 hover:bg-black transition-all self-start"
        >
          <Plus size={20} />
          Ask a Question
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search problems, topics or keywords..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
           <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden p-1">
             <button 
               onClick={() => setSortBy('newest')}
               className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'newest' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               Newest
             </button>
             <button 
               onClick={() => setSortBy('top')}
               className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'top' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               Top Voted
             </button>
           </div>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${!activeTag ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTag === tag ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="py-20 text-center bg-white border border-slate-100 rounded-3xl border-dashed">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={32} />
            </div>
            <p className="text-slate-500 font-medium">No doubts posted yet. Be the first to ask!</p>
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <motion.div
              key={q._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group bg-white border transition-all duration-300 overflow-hidden ${
                expandedId === q._id 
                  ? 'border-indigo-200 ring-4 ring-indigo-50 rounded-[2rem] shadow-xl relative z-10' 
                  : 'border-slate-100 rounded-[2rem] hover:border-indigo-100 hover:shadow-md hover:shadow-slate-100'
              }`}
            >
              <div 
                className={`p-6 sm:p-8 flex gap-6 cursor-pointer select-none transition-colors ${
                  expandedId === q._id ? 'bg-white' : 'hover:bg-slate-50/30'
                }`}
                onClick={() => toggleExpand(q._id)}
              >
                {/* Upvote Section */}
                <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(q._id);
                    }}
                    className={`p-3 rounded-2xl transition-all ${
                      q.upvotedBy?.includes(user?.uid) 
                        ? 'text-white bg-indigo-600 shadow-lg shadow-indigo-100' 
                        : 'text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-indigo-600'
                    }`}
                  >
                    <ArrowUpCircle size={24} fill={q.upvotedBy?.includes(user?.uid) ? "currentColor" : "none"} strokeWidth={2.5} />
                  </motion.button>
                  <span className={`text-sm font-black tabular-nums transition-colors ${
                    q.upvotedBy?.includes(user?.uid) ? 'text-indigo-600' : 'text-slate-400'
                  }`}>
                    {q.upvotes || 0}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-bold ring-4 ring-slate-50">
                        {q.authorName?.charAt(0) || <User size={14} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 leading-none mb-0.5">
                          {q.authorName || 'Student'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none">
                          {q.createdAt?.toDate ? formatDistanceToNow(q.createdAt.toDate()) : 'Recently'} ago
                        </span>
                      </div>
                    </div>
                    <div className={`p-2 rounded-xl transition-colors ${
                      expandedId === q._id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'
                    }`}>
                      {expandedId === q._id ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                    </div>
                  </div>
                  
                  <h3 className={`text-xl font-black mb-3 leading-tight transition-colors ${
                    expandedId === q._id ? 'text-slate-900' : 'text-slate-800 group-hover:text-indigo-600'
                  }`}>
                    {q.title}
                  </h3>
                  
                  <p className={`text-slate-500 font-medium leading-relaxed transition-all ${
                    expandedId === q._id ? 'text-base mb-6' : 'text-sm line-clamp-2'
                  }`}>
                    {q.body}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <div className="flex flex-wrap gap-2">
                      {q.tags?.map((tag: string, idx: number) => (
                        <span 
                          key={`tag-${q._id}-${tag}-${idx}`} 
                          className="px-3 py-1 bg-white border border-slate-100 text-slate-400 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    {!expandedId || expandedId !== q._id ? (
                      <div className="flex items-center gap-3 ml-auto">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full border border-indigo-100 uppercase tracking-wider">
                          <MessageCircle size={12} strokeWidth={3} />
                          {answers[q._id]?.length || 0}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Expanded Answers Section */}
              <AnimatePresence>
                {expandedId === q._id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-50 bg-slate-50/30"
                  >
                    <div className="p-8 space-y-8">
                       <div className="flex items-center justify-between px-2">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                           Expert Insights & Replies
                         </h4>
                         <span className="text-[10px] font-black text-indigo-600/50 uppercase tracking-widest">
                           {answers[q._id]?.length || 0} Responses
                         </span>
                       </div>

                       {/* Answers List */}
                       <div className="space-y-4">
                         {answers[q._id]?.length === 0 ? (
                           <div className="bg-white/50 border border-slate-100 rounded-3xl p-8 text-center">
                             <p className="text-sm text-slate-400 italic font-medium">No insights shared yet. Be the voice of reason!</p>
                           </div>
                         ) : (
                           answers[q._id]?.map((ans) => (
                             <motion.div 
                               initial={{ opacity: 0, x: 10 }}
                               animate={{ opacity: 1, x: 0 }}
                               key={ans.id} 
                               className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                             >
                               <div className="flex items-center gap-3 mb-4">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                                    {ans.authorName?.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-900 leading-tight">
                                      {ans.authorName}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                                      {ans.createdAt?.toDate ? formatDistanceToNow(ans.createdAt.toDate()) : 'Recently'} ago
                                    </span>
                                  </div>
                               </div>
                               <p className="text-sm text-slate-600 font-medium leading-relaxed">{ans.text}</p>
                             </motion.div>
                           ))
                         )}
                       </div>

                       {/* Post Answer Form */}
                       <div className="relative pt-4 group/form">
                         <form onSubmit={(e) => handlePostAnswer(e, q)} className="relative">
                            <textarea
                              value={newAnswer}
                              onChange={(e) => setNewAnswer(e.target.value)}
                              placeholder="Share your expertise or helpful tip..."
                              className="w-full pl-6 pr-16 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-300 resize-none min-h-[100px]"
                            />
                            <div className="absolute right-3 bottom-3">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="submit"
                                disabled={!newAnswer.trim()}
                                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 disabled:bg-slate-200 disabled:shadow-none"
                              >
                                <Send size={20} strokeWidth={2.5} />
                              </motion.button>
                            </div>
                         </form>
                         <p className="absolute -bottom-6 left-6 text-[9px] font-bold text-slate-300 uppercase tracking-widest opacity-0 group-focus-within/form:opacity-100 transition-opacity">
                           Press Enter to share or click the icon
                         </p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Question Modal */}
      <AnimatePresence>
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
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Ask the Community</h2>
              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 focus-within:text-indigo-600 transition-colors">Question Title</label>
                  <input
                    type="text"
                    required
                    value={newQuestion.title}
                    onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                    placeholder="e.g. How to use Firestore subcollections?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 focus-within:text-indigo-600 transition-colors">Details</label>
                  <textarea
                    required
                    rows={4}
                    value={newQuestion.body}
                    onChange={(e) => setNewQuestion({ ...newQuestion, body: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
                    placeholder="Provide more context for your doubt..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 focus-within:text-indigo-600 transition-colors">Tags</label>
                  <input
                    type="text"
                    required
                    value={newQuestion.tags}
                    onChange={(e) => setNewQuestion({ ...newQuestion, tags: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                    placeholder="React, Firebase, Logic"
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
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Posting...' : 'Post Question'}
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
