import { useState } from "react";

interface TeamAvatarProps {
  name: string;
  photo: string;
  size?: number;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function TeamAvatar({
  name,
  photo,
  size = 96,
  className = "",
}: TeamAvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 font-semibold text-white ${className}`}
      >
        <span style={{ fontSize: size * 0.34 }}>{getInitials(name)}</span>
      </div>
    );
  }

  return (
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
