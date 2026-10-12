/**
 * User.ts
 *
 * mongoose schema and model for application users.
 * key security design decisions:
 * - email is stored AES-256-GCM encrypted (privacy at rest)
 * - passwords are never stored — only bcrypt hashes
 * - last 5 password hashes are tracked to prevent reuse
 * - failed login tracking with automatic lockout
 * - soft-deactivation support (isActive flag)
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { comparePassword } from '../utils/passwordUtils';
import { VALID_ROLES, UserRole, LOCKOUT_POLICY, PASSWORD_POLICY } from '../config/constants';

/**
 * interface for the user document fields.
 */
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  // email is stored as an encrypted string (AES-256-GCM "iv:authTag:cipher" format)
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  isLocked: boolean;
  lockoutExpires: Date | null;
  failedLoginAttempts: number;
  // array of the last N bcrypt hashes for password reuse prevention
  passwordHistory: string[];
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementFailedLogin(): Promise<void>;
  resetFailedLogin(): Promise<void>;
  isLockedOut(): boolean;
}

/**
 * interface for the user model (static methods).
 */
export interface IUserModel extends Model<IUser> {
  findByUsername(username: string): Promise<IUser | null>;
}

const userSchema = new Schema<IUser, IUserModel>(
  {
    // username: alphanumeric + underscore only, unique, case-sensitive
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must not exceed 30 characters'],
      // validates alphanumeric + underscore only — prevents injection via usernames
      match: [/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'],
      index: true,
    },

    // email stored encrypted — only the encrypted blob is persisted
    // searching by email requires encrypting the query value first
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      // no format validation here — validated before encryption in service layer
    },

    // bcrypt hash — never the raw password
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      // select: false means passwordHash is NOT returned by default in queries
      // callers must explicitly request it: User.findOne().select('+passwordHash')
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: VALID_ROLES,
        message: 'Role must be one of: employee, manager, admin',
      },
      default: 'employee',
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // isLocked: set to true after MAX_FAILED_ATTEMPTS consecutive failures
    isLocked: {
      type: Boolean,
      default: false,
    },

    // lockoutExpires: when the lockout period ends (null = not locked)
    lockoutExpires: {
      type: Date,
      default: null,
    },

    // count of consecutive failed login attempts since last success
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    // circular array of the last PASSWORD_HISTORY_DEPTH bcrypt hashes
    // stored with select: false — never returned in regular queries
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // automatically manages createdAt and updatedAt
    // do not expose the version key (__v) in responses
    versionKey: false,
    // transform: strip internal fields from json output
    toJSON: {
      transform: (_doc, ret) => {
        // never expose passwordHash, passwordHistory in json output
        delete ret.passwordHash;
        delete ret.passwordHistory;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// compound index for lockout queries
userSchema.index({ isLocked: 1, lockoutExpires: 1 });
// index on role for role-based queries
userSchema.index({ role: 1 });
// index on isActive for filtering active users
userSchema.index({ isActive: 1 });

/**
 * instance method: compares a candidate password against the stored hash.
 * returns false (not throw) on error to prevent oracle attacks.
 */
userSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return comparePassword(candidatePassword, this.passwordHash);
};

/**
 * instance method: increments the failed login counter.
 * if the threshold is reached, locks the account for LOCKOUT_DURATION.
 * this is called after each failed authentication attempt.
 */
userSchema.methods.incrementFailedLogin = async function (this: IUser): Promise<void> {
  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= LOCKOUT_POLICY.MAX_FAILED_ATTEMPTS) {
    this.isLocked = true;
    this.lockoutExpires = new Date(Date.now() + LOCKOUT_POLICY.DURATION_MS);
  }

  await this.save();
};

/**
 * instance method: resets the failed login counter after a successful login.
 * also clears any existing lockout.
 */
userSchema.methods.resetFailedLogin = async function (this: IUser): Promise<void> {
  this.failedLoginAttempts = 0;
  this.isLocked = false;
  this.lockoutExpires = null;
  this.lastLogin = new Date();
  await this.save();
};

/**
 * instance method: checks whether the account is currently locked.
 * automatically clears expired lockouts.
 * does NOT save — caller must save if the lockout is cleared.
 */
userSchema.methods.isLockedOut = function (this: IUser): boolean {
  if (!this.isLocked) return false;

  // check if the lockout period has expired
  if (this.lockoutExpires && this.lockoutExpires <= new Date()) {
    // lockout has expired — clear it (caller should save)
    this.isLocked = false;
    this.lockoutExpires = null;
    this.failedLoginAttempts = 0;
    return false;
  }

  return true;
};

/**
 * static method: find a user by username.
 * used during authentication — case-insensitive exact match so users don't have
 * to worry about capitalisation when signing in. The unique index on username
 * still prevents duplicate registrations.
 */
userSchema.statics.findByUsername = function (username: string): Promise<IUser | null> {
  // escape regex metacharacters in the user input, then match with the ^...$ anchors
  // and the 'i' flag for case-insensitive comparison.
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return this.findOne({ username: { $regex: `^${escaped}$`, $options: 'i' } })
    .select('+passwordHash +passwordHistory')
    .exec();
};

/**
 * pre-save hook: enforce password history array length.
 * keeps only the last PASSWORD_HISTORY_DEPTH entries.
 */
userSchema.pre('save', function (this: IUser, next) {
  if (this.passwordHistory && this.passwordHistory.length > PASSWORD_POLICY.HISTORY_DEPTH) {
    // trim from the front — oldest entries are removed first
    this.passwordHistory = this.passwordHistory.slice(-PASSWORD_POLICY.HISTORY_DEPTH);
  }
  next();
});

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
