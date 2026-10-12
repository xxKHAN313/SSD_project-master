/**
 * Message.ts
 *
 * mongoose schema for chat messages.
 * all message content is stored AES-256-GCM encrypted — never plaintext.
 * the encrypted content, iv, and authTag are stored as separate fields
 * to allow future key rotation without schema changes.
 * soft-delete (isDeleted) is used to preserve audit trails.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * interface for a message document.
 */
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  // stored in the combined "iv:authTag:ciphertext" format from encryption.ts
  encryptedContent: string;
  isDeleted: boolean;
  // soft delete tracking — who deleted and when
  deletedBy: mongoose.Types.ObjectId | null;
  deletedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * interface for the message model (static methods).
 */
export interface IMessageModel extends Model<IMessage> {
  findByRoom(
    roomId: string,
    page: number,
    limit: number
  ): Promise<{ messages: IMessage[]; total: number }>;
}

const messageSchema = new Schema<IMessage, IMessageModel>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: [true, 'Room ID is required'],
      index: true,
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },

    // the full AES-256-GCM encrypted payload ("iv:authTag:ciphertext")
    // this format is self-contained — includes everything needed for decryption
    encryptedContent: {
      type: String,
      required: [true, 'Encrypted content is required'],
    },

    // soft delete — messages are never hard-deleted to preserve audit integrity
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // tracks who deleted the message (admin/manager may delete others' messages)
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // tracks last edit time (for future message editing feature)
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// compound index for room + timestamp queries (primary access pattern)
messageSchema.index({ roomId: 1, createdAt: -1 });

// compound index for sender queries (audit/history lookups)
messageSchema.index({ senderId: 1, createdAt: -1 });

/**
 * static method: retrieves paginated messages for a room.
 * excludes deleted messages from the result set.
 * returns messages in reverse-chronological order (newest first).
 */
messageSchema.statics.findByRoom = async function (
  roomId: string,
  page: number,
  limit: number
): Promise<{ messages: IMessage[]; total: number }> {
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    this.find({ roomId, isDeleted: false })
      .sort({ createdAt: -1 }) // newest first for chat pagination
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'username role') // populate sender info (no passwordHash)
      .lean()
      .exec(),
    this.countDocuments({ roomId, isDeleted: false }),
  ]);

  return { messages, total };
};

export const Message = mongoose.model<IMessage, IMessageModel>('Message', messageSchema);
