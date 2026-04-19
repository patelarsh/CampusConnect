import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for 1-to-1
  groupId: { type: String }, // for group chat
  text: { type: String, required: true },
}, { timestamps: true });

export const Message = mongoose.model('Message', messageSchema);
