import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../App.tsx';
import { HelpCircle, Search, MessageCircle, ArrowUpCircle, Filter, Plus, User, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function Questions() {
  const { user } = useAuth()!;
  const [questions, setQuestions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', body: '', tags: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any[]>>({});
  const [newAnswer, setNewAnswer] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnswers = (questionId: string) => {
    const q = query(collection(db, 'questions', questionId, 'answers'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setAnswers(prev => ({
        ...prev,
        [questionId]: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (err) => {
      handleFirestoreError(err, 'list', `questions/${questionId}/answers`);
    });
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

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        title: newQuestion.title,
        body: newQuestion.body,
        tags: newQuestion.tags.split(',').map(t => t.trim()),
        authorId: user?.uid,
        authorName: user?.displayName || 'Student',
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
           <button className="p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all text-slate-600">
             <Filter size={20} />
           </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="py-20 text-center bg-white border border-slate-100 rounded-3xl border-dashed">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={32} />
            </div>
            <p className="text-slate-500 font-medium">No doubts posted yet. Be the first to ask!</p>
          </div>
        ) : (
          questions.map((q) => (
            <motion.div
              key={q._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-white border transition-all overflow-hidden ${expandedId === q._id ? 'border-indigo-200 ring-2 ring-indigo-50 rounded-3xl shadow-lg' : 'border-slate-200 rounded-3xl hover:border-slate-300 shadow-sm'}`}
            >
              <div 
                className="p-6 flex gap-6 cursor-pointer"
                onClick={() => toggleExpand(q._id)}
              >
                <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                  <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                    <ArrowUpCircle size={24} />
                  </button>
                  <span className="font-bold text-slate-900">0</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[8px] font-bold">
                        {q.authorName?.charAt(0) || <User size={10} />}
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                        {q.authorName || 'Student'} • {q.createdAt?.toDate ? formatDistanceToNow(q.createdAt.toDate()) : 'Recently'} ago
                      </span>
                    </div>
                    {expandedId === q._id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{q.title}</h3>
                  <p className={`text-slate-600 text-sm leading-relaxed ${expandedId === q._id ? 'mb-6' : 'line-clamp-2'}`}>{q.body}</p>
                  
                  {!expandedId || expandedId !== q._id ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {q.tags?.map((tag: string) => (
                        <span key={tag} className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100 uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                      <div className="flex-1" />
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                        <MessageCircle size={14} />
                        {answers[q._id]?.length || 0} Answers
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Expanded Answers Section */}
              <AnimatePresence>
                {expandedId === q._id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 bg-slate-50/50"
                  >
                    <div className="p-6 pt-4 space-y-6">
                       {/* Answers List */}
                       <div className="space-y-4">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Community Solutions</h4>
                         {answers[q._id]?.length === 0 ? (
                           <p className="text-sm text-slate-400 italic px-2">No answers yet. Share your knowledge!</p>
                         ) : (
                           answers[q._id]?.map((ans) => (
                             <div key={ans.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                               <div className="flex items-center gap-2 mb-2">
                                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[8px] font-bold">
                                    {ans.authorName?.charAt(0)}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {ans.authorName} • {ans.createdAt?.toDate ? formatDistanceToNow(ans.createdAt.toDate()) : 'Now'}
                                  </span>
                               </div>
                               <p className="text-sm text-slate-700 leading-relaxed">{ans.text}</p>
                             </div>
                           ))
                         )}
                       </div>

                       {/* Post Answer Form */}
                       <form onSubmit={(e) => handlePostAnswer(e, q)} className="relative pt-2">
                          <textarea
                            value={newAnswer}
                            onChange={(e) => setNewAnswer(e.target.value)}
                            placeholder="Write your answer..."
                            className="w-full pl-4 pr-14 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
                            rows={2}
                          />
                          <button
                            type="submit"
                            className="absolute right-2 bottom-4 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
                          >
                            <Send size={16} />
                          </button>
                       </form>
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
