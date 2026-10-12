/**
 * ChatRoom.ts
 *
 * mongoose schema for chat rooms.
 * rooms have an access level that controls which roles can join.
 * three access levels: public (all), manager (manager+), admin (admin only).
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { VALID_ROLES, UserRole } from '../config/constants';

// valid room access levels
export const ROOM_ACCESS_LEVELS = ['public', 'manager', 'admin'] as const;
export type RoomAccessLevel = (typeof ROOM_ACCESS_LEVELS)[number];

/**
 * interface for a chat room document.
 */
export interface IChatRoom extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  accessLevel: RoomAccessLevel;
  // which roles can participate in this room
  allowedRoles: UserRole[];
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatRoomModel extends Model<IChatRoom> {
  findAccessibleByRole(role: UserRole): Promise<IChatRoom[]>;
}

const chatRoomSchema = new Schema<IChatRoom, IChatRoomModel>(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [2, 'Room name must be at least 2 characters'],
      maxlength: [100, 'Room name must not exceed 100 characters'],
      unique: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
      default: '',
    },

    // access level determines which roles can see and join this room
    accessLevel: {
      type: String,
      enum: {
        values: ROOM_ACCESS_LEVELS,
        message: 'Access level must be one of: public, manager, admin',
      },
      default: 'public',
    },

    // allowedRoles is derived from accessLevel but stored for efficient querying
    allowedRoles: {
      type: [String],
      enum: VALID_ROLES,
      default: ['employee', 'manager', 'admin'],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// index for role-based room access queries
chatRoomSchema.index({ allowedRoles: 1, isActive: 1 });

/**
 * static method: finds all rooms accessible to a given role.
 */
chatRoomSchema.statics.findAccessibleByRole = function (
  role: UserRole
): Promise<IChatRoom[]> {
  return this.find({
    allowedRoles: role,
    isActive: true,
  })
    .sort({ name: 1 })
    .lean()
    .exec();
};

export const ChatRoom = mongoose.model<IChatRoom, IChatRoomModel>('ChatRoom', chatRoomSchema);
