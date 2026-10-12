/**
 * @fileoverview Modal for creating a new chat room.
 * Available to managers and admins (the backend enforces the same rule).
 * Captures name, description, and access level then calls chatService.createRoom.
 */

import React, { useState, FormEvent, useEffect } from 'react';
import Modal from '../Common/Modal';
import Input from '../Common/Input';
import Button from '../Common/Button';
import styles from './Chat.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../store/appContext';
import chatService from '../../services/chatService';
import { ChatRoom, CreateRoomData } from '../../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  // called with the newly-created room so the parent can select it
  onCreated: (room: ChatRoom) => void;
}

interface FormState {
  name: string;
  description: string;
  accessLevel: 'public' | 'manager' | 'admin';
}

interface FormErrors {
  name?: string;
  description?: string;
}

const initialState: FormState = {
  name: '',
  description: '',
  accessLevel: 'public',
};

export function CreateRoomModal({
  isOpen,
  onClose,
  onCreated,
}: CreateRoomModalProps): JSX.Element {
  const { isAdmin } = useAuth();
  const { addToast } = useAppContext();

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // reset the form every time the modal opens so stale values from a previous
  // attempt don't stick around
  useEffect(() => {
    if (isOpen) {
      setForm(initialState);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const validateForm = (): boolean => {
    const next: FormErrors = {};
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      next.name = 'Room name is required.';
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      next.name = 'Room name must be between 2 and 100 characters.';
    } else if (!/^[a-zA-Z0-9 _-]+$/.test(trimmedName)) {
      next.name = 'Use only letters, numbers, spaces, hyphens, and underscores.';
    }
    if (form.description.length > 500) {
      next.description = 'Description must not exceed 500 characters.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: CreateRoomData = {
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      accessLevel: form.accessLevel,
    };

    setIsSubmitting(true);
    try {
      const room = await chatService.createRoom(payload);
      addToast('success', `Room "${room.name}" created successfully.`);
      onCreated(room);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create chat room.';
      addToast('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // only admins can create admin-only rooms; managers may create public / manager rooms.
  // (the backend also enforces this via role middleware on POST /chat/rooms.)
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create new chat room"
      size="md"
      disableBackdropClose={isSubmitting}
      hideFooter
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Create chat room form"
        className={styles.createRoomForm}
      >
        <Input
          label="Room name"
          type="text"
          value={form.name}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, name: e.target.value }));
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          error={errors.name}
          placeholder="e.g. Engineering Standup"
          required
          disabled={isSubmitting}
          maxLength={100}
          autoFocus
        />

        <div className={styles.createRoomField}>
          <label htmlFor="room-description" className={styles.createRoomLabel}>
            Description <span className={styles.createRoomOptional}>(optional)</span>
          </label>
          <textarea
            id="room-description"
            className={styles.createRoomTextarea}
            value={form.description}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, description: e.target.value }));
              if (errors.description) {
                setErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="What's this room for?"
            rows={3}
            maxLength={500}
            disabled={isSubmitting}
          />
          {errors.description && (
            <span className={styles.createRoomError}>{errors.description}</span>
          )}
          <span className={styles.createRoomHint}>
            {form.description.length}/500
          </span>
        </div>

        <div className={styles.createRoomField}>
          <label htmlFor="room-access" className={styles.createRoomLabel}>
            Access level
          </label>
          <select
            id="room-access"
            className={styles.createRoomSelect}
            value={form.accessLevel}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                accessLevel: e.target.value as FormState['accessLevel'],
              }))
            }
            disabled={isSubmitting}
          >
            <option value="public">Public — any authenticated user</option>
            <option value="manager">Manager — managers and admins</option>
            {isAdmin && (
              <option value="admin">Admin — admins only</option>
            )}
          </select>
          <span className={styles.createRoomHint}>
            Controls which roles can join and send messages in this room.
          </span>
        </div>

        <div className={styles.createRoomActions}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            Create Room
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateRoomModal;
