import { useAuth } from '../../context/AuthContext';

interface UserAvatarProps {
  className?: string;
  emojiClassName?: string;
  status?: 'online' | 'offline' | 'busy' | 'none';
}

export default function UserAvatar({
  className = 'h-11 w-11',
  emojiClassName = 'text-xl',
  status = 'online',
}: UserAvatarProps) {
  const { avatarIcon } = useAuth();

  return (
    <span className={`relative inline-flex shrink-0 rounded-full ${className}`}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-brand-50 dark:bg-brand-500/10">
        {avatarIcon ? (
          <span className={emojiClassName} aria-hidden="true">
            {avatarIcon}
          </span>
        ) : (
          <img src="/logo_crop.png" alt="Usuario" className="h-full w-full object-cover" />
        )}
      </span>
      {status !== 'none' && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-[1.5px] border-white dark:border-gray-900 ${
            status === 'online'
              ? 'bg-success-500'
              : status === 'busy'
                ? 'bg-warning-500'
                : 'bg-error-400'
          } h-[22%] min-h-2.5 w-[22%] min-w-2.5`}
          aria-label={status === 'online' ? 'Perfil en línea' : 'Estado del perfil'}
        />
      )}
    </span>
  );
}
