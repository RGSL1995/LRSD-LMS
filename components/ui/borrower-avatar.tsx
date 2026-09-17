"use client";

import { useState, useRef, useTransition, type ChangeEvent } from "react";
import { Building2, User, Camera, Trash2, Loader2 } from "lucide-react";
import { uploadBorrowerAvatar, removeBorrowerAvatar } from "@/app/borrowers/avatar-actions";
import { cn } from "@/lib/utils";

export interface BorrowerAvatarProps {
  borrowerId?: string;
  name: string;
  type?: "corporate" | "individual" | "other" | string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  className?: string;
  onAvatarChange?: (newUrl: string | null) => void;
}

const SIZE_CONFIG = {
  xs: {
    container: "size-6 text-[10px]",
    badge: "size-2.5",
    badgeIcon: "size-1.5",
    cameraIcon: "size-2.5",
  },
  sm: {
    container: "size-8 text-xs font-semibold",
    badge: "size-3",
    badgeIcon: "size-2",
    cameraIcon: "size-3",
  },
  md: {
    container: "size-10 text-sm font-bold",
    badge: "size-3.5",
    badgeIcon: "size-2.5",
    cameraIcon: "size-3.5",
  },
  lg: {
    container: "size-14 text-lg font-bold",
    badge: "size-4",
    badgeIcon: "size-3",
    cameraIcon: "size-4",
  },
  xl: {
    container: "size-20 text-2xl font-bold",
    badge: "size-5",
    badgeIcon: "size-3.5",
    cameraIcon: "size-5",
  },
};

const CORPORATE_GRADIENTS = [
  "from-blue-600 to-indigo-800 text-white",
  "from-slate-700 to-blue-900 text-white",
  "from-indigo-600 to-violet-800 text-white",
  "from-cyan-700 to-blue-800 text-white",
  "from-emerald-700 to-teal-900 text-white",
];

const INDIVIDUAL_GRADIENTS = [
  "from-violet-500 to-purple-700 text-white",
  "from-teal-500 to-emerald-700 text-white",
  "from-rose-500 to-pink-700 text-white",
  "from-amber-500 to-orange-700 text-white",
  "from-sky-500 to-indigo-600 text-white",
];

function getInitials(name: string): string {
  if (!name || name.trim() === "—") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getGradient(name: string, isCorp: boolean): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * 31) % 1000;
  }
  const gradients = isCorp ? CORPORATE_GRADIENTS : INDIVIDUAL_GRADIENTS;
  return gradients[Math.abs(hash) % gradients.length];
}

export function BorrowerAvatar({
  borrowerId,
  name,
  type = "corporate",
  avatarUrl: initialAvatarUrl,
  size = "md",
  editable = false,
  className = "",
  onAvatarChange,
}: BorrowerAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [isUploading, startTransition] = useTransition();
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCorp = type === "corporate";
  const initials = getInitials(name);
  const gradient = getGradient(name, isCorp);
  const sizeClass = SIZE_CONFIG[size];
  const isRound = !isCorp; // Individuals circular, corporates rounded-2xl

  // If initial prop changes, synchronize state
  if (initialAvatarUrl !== undefined && initialAvatarUrl !== avatarUrl && !isUploading) {
    setAvatarUrl(initialAvatarUrl);
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !borrowerId) return;

    const formData = new FormData();
    formData.set("borrower_id", borrowerId);
    formData.set("borrower_type", type);
    formData.set("file", file);

    startTransition(async () => {
      const res = await uploadBorrowerAvatar(formData);
      if (res.success && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        setImageError(false);
        if (onAvatarChange) onAvatarChange(res.avatarUrl);
      }
    });

    e.target.value = "";
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!borrowerId) return;

    startTransition(async () => {
      const res = await removeBorrowerAvatar(borrowerId, type);
      if (res.success) {
        setAvatarUrl(null);
        if (onAvatarChange) onAvatarChange(null);
      }
    });
  }

  const hasImage = Boolean(avatarUrl) && !imageError;

  return (
    <div className={cn("relative shrink-0 select-none group inline-block", className)}>
      <div
        className={cn(
          "relative overflow-hidden flex items-center justify-center transition-all duration-200",
          sizeClass.container,
          isRound ? "rounded-full" : "rounded-2xl",
          hasImage
            ? isCorp
              ? "bg-white dark:bg-zinc-900 border border-border/80 shadow-xs p-1"
              : "border-2 border-background shadow-xs ring-2 ring-primary/20"
            : cn("bg-gradient-to-br shadow-xs border border-white/20", gradient),
        )}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl!}
            alt={name}
            onError={() => setImageError(true)}
            className={cn(
              "w-full h-full",
              isCorp ? "object-contain rounded-xl" : "object-cover",
            )}
          />
        ) : (
          <span className="font-bold tracking-wider leading-none drop-shadow-xs">
            {initials}
          </span>
        )}

        {/* Upload Loading Spinner */}
        {isUploading && (
          <div
            className={cn(
              "absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center text-white z-10",
              isRound ? "rounded-full" : "rounded-2xl",
            )}
          >
            <Loader2 className={cn("animate-spin", sizeClass.cameraIcon)} />
          </div>
        )}

        {/* Hover Camera Overlay for Editable Mode */}
        {editable && !isUploading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={isCorp ? "Upload Company Logo" : "Upload Profile Photo"}
            className={cn(
              "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer z-10",
              isRound ? "rounded-full" : "rounded-2xl",
            )}
          >
            <Camera className={sizeClass.cameraIcon} />
            {size === "xl" && (
              <span className="text-[9px] font-semibold mt-1 tracking-tight">
                {hasImage ? "Change" : "Upload"}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Type Badge Emblem (Bottom-Right) */}
      {!editable && size !== "xs" && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background flex items-center justify-center shadow-xs",
            sizeClass.badge,
            isCorp
              ? "bg-blue-600 text-white"
              : "bg-emerald-600 text-white",
          )}
          title={isCorp ? "Corporate Legal Entity" : "Individual Borrower"}
        >
          {isCorp ? (
            <Building2 className={sizeClass.badgeIcon} />
          ) : (
            <User className={sizeClass.badgeIcon} />
          )}
        </div>
      )}

      {/* Delete / Remove Action when Editable & Image Exists */}
      {editable && hasImage && !isUploading && size === "xl" && (
        <button
          type="button"
          onClick={handleRemove}
          title="Remove Photo / Logo"
          className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground border-2 border-background flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer z-20"
        >
          <Trash2 className="size-2.5" />
        </button>
      )}

      {/* Hidden File Input for Direct Upload */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg,image/*"
          onChange={handleFileSelected}
          className="sr-only"
        />
      )}
    </div>
  );
}
