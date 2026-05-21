'use client';

import { useRef, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { getBrowserApiClient } from '@/lib/api';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ApiError } from '@longform/api-client';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB pre-resize cap
const TARGET_DIM = 512;
const TARGET_TYPE = 'image/webp';
const TARGET_QUALITY = 0.85;

async function resizeToSquare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = url;
    });

    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_DIM;
    canvas.height = TARGET_DIM;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_DIM, TARGET_DIM);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Resize failed'))),
        TARGET_TYPE,
        TARGET_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Status = 'idle' | 'uploading' | 'error';

export function AvatarUploader({
  userId,
  username,
  initialAvatarUrl,
  onUploaded,
}: {
  userId: string;
  username: string;
  initialAvatarUrl: string | null;
  onUploaded?: (url: string) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 2 MB.');
      return;
    }

    setStatus('uploading');
    try {
      const resized = await resizeToSquare(file);
      const supabase = createSupabaseBrowserClient();
      const path = `${userId}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, {
          contentType: TARGET_TYPE,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so the new image renders immediately.
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      await getBrowserApiClient().request('/api/users/me', {
        method: 'PATCH',
        body: { avatar_url: publicUrl },
      });

      setAvatarUrl(publicUrl);
      onUploaded?.(publicUrl);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Upload failed.');
      }
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={avatarUrl} name={username} seed={userId} size="xl" />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={status === 'uploading'}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-[hsl(var(--accent))]"
        >
          {status === 'uploading' ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            // Reset so re-selecting the same file fires onChange again.
            e.target.value = '';
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && status === 'idle' && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            JPG, PNG, or WebP. Up to 2 MB.
          </p>
        )}
      </div>
    </div>
  );
}
