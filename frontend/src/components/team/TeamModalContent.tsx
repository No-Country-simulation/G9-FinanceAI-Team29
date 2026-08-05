import { useRef, useState } from "react";
import { teamMembers } from "../../data/team";
import TeamAvatar from "./TeamAvatar";
import TeamGraphBackground from "./TeamGraphBackground";
import SponsorsMarquee from "./SponsorsMarquee";
import type { TeamMember } from "../../data/team";

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a10.98 10.98 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.42.36.78 1.07.78 2.16v3.2c0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

function SocialLinks({ member }: { member: TeamMember }) {
  if (!member.linkedin && !member.github) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      {member.linkedin && (
        <a
          href={member.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`LinkedIn de ${member.name}`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-brand-500 hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500 dark:hover:text-white"
        >
          <LinkedInIcon />
        </a>
      )}
      {member.github && (
        <a
          href={member.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`GitHub de ${member.name}`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-brand-500 hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500 dark:hover:text-white"
        >
          <GitHubIcon />
        </a>
      )}
    </div>
  );
}

function MemberIdentity({
  member,
  avatarSize,
}: {
  member: TeamMember;
  avatarSize: number;
}) {
  return (
    <div className="relative">
      <TeamAvatar
        name={member.name}
        photo={member.photo}
        size={avatarSize}
        className="ring-4 ring-gray-50 dark:ring-gray-900"
      />
      {member.countryFlag && (
        <div className="group/flag absolute -right-2 -top-2 z-20">
          <img
            src={member.countryFlag}
            alt={member.country ?? "País"}
            className="h-7 w-7 object-contain drop-shadow-md"
          />
          {member.location && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/flag:opacity-100 dark:bg-gray-700"
            >
              📍 {member.location}
            </div>
          )}
        </div>
      )}
      {member.isLead && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-theme-xs">
          Lead
        </span>
      )}
    </div>
  );
}

type SpotlightRect = { top: number; left: number; width: number; height: number };

export default function TeamModalContent() {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const focusMember = (id: string) => {
    const cardEl = cardRefs.current[id];
    const gridEl = gridRef.current;
    if (!cardEl || !gridEl) return;
    const cardBox = cardEl.getBoundingClientRect();
    const gridBox = gridEl.getBoundingClientRect();

    // Se ensancha respecto a la card original para que nombres largos
    // ("Raúl Enrique Vidaurre Vallejos") entren en una sola línea,
    // recentrada y sin salirse de los bordes de la grilla.
    const extraWidth = 120;
    const width = cardBox.width + extraWidth;
    const rawLeft = cardBox.left - gridBox.left - extraWidth / 2;
    const left = Math.min(Math.max(rawLeft, 0), Math.max(gridBox.width - width, 0));

    setSpotlightRect({
      top: cardBox.top - gridBox.top,
      left,
      width,
      height: cardBox.height,
    });
    setFocusedId(id);
  };

  const clearFocus = () => {
    setFocusedId(null);
    setSpotlightRect(null);
  };

  const focusedMember = teamMembers.find((m) => m.id === focusedId) ?? null;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-white dark:bg-gray-900">
      <TeamGraphBackground />

      <div className="no-scrollbar relative z-10 max-h-[90vh] overflow-y-auto p-6 sm:p-10 lg:p-12">
        <div className="animate-team-fade-up flex flex-col items-center pr-8 text-center sm:pr-0">
          <img
            src="/logo_team.png"
            alt="TwentyNineDevs"
            className="mb-4 h-20 w-20 rounded-2xl object-contain shadow-theme-md sm:h-24 sm:w-24"
          />
          <h4 className="text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-3xl">
            TwentyNineDevs
          </h4>
          <p className="mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Un equipo multidisciplinario enfocado en desarrollar soluciones
            tecnológicas mediante la colaboración y la innovación.
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Grupo 9 · Hackathon ONE Next Education — Oracle · Alura · No Country
          </p>
        </div>

        {/* Fuera del wrapper con pr-8 (reservado para el botón de cerrar en
            mobile) para que la banda quede al ancho completo, igual que la
            grilla de miembros de abajo. */}
        <SponsorsMarquee />

        <div
          ref={gridRef}
          className="relative mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5"
          onMouseLeave={clearFocus}
        >
          {teamMembers.map((member, index) => {
            const isFocused = focusedId === member.id;
            const isDimmed = focusedId !== null && !isFocused;

            return (
              <div
                key={member.id}
                ref={(el) => {
                  cardRefs.current[member.id] = el;
                }}
                onMouseEnter={() => focusMember(member.id)}
                onClick={() => (isFocused ? clearFocus() : focusMember(member.id))}
                className={`animate-team-fade-up flex cursor-pointer flex-col items-center rounded-2xl border border-gray-200 bg-white px-3 py-5 text-center transition-all duration-500 ease-out dark:border-gray-800 dark:bg-white/[0.02] sm:px-4 sm:py-6 ${
                  isFocused ? "opacity-0" : isDimmed ? "scale-[0.97] opacity-70 blur-[3px]" : "opacity-100"
                }`}
                style={{ animationDelay: `${80 + index * 90}ms` }}
              >
                <MemberIdentity member={member} avatarSize={92} />
                <h6 className="mt-4 text-sm font-semibold text-gray-800 dark:text-white/90 sm:text-base">
                  {member.name}
                </h6>
                <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                <SocialLinks member={member} />
              </div>
            );
          })}

          {/* Clon flotante: se posiciona exactamente sobre la card real y crece
              mostrando la frase, sin mover ni recortar el resto de la grilla. */}
          {focusedMember && spotlightRect && (
            <div
              key={focusedMember.id}
              className="pointer-events-auto absolute z-30 flex animate-team-spotlight-in flex-col items-center rounded-2xl border border-brand-300 bg-white px-4 py-5 text-center shadow-2xl dark:border-brand-500/50 dark:bg-gray-900 sm:px-5 sm:py-6"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
              }}
              onMouseLeave={clearFocus}
            >
              <MemberIdentity member={focusedMember} avatarSize={92} />
              <h6 className="mt-4 text-sm font-semibold text-gray-800 dark:text-white/90 sm:text-base">
                {focusedMember.name}
              </h6>
              <p className="text-xs text-gray-500 dark:text-gray-400">{focusedMember.role}</p>
              {focusedMember.quote && (
                <p className="mt-3 text-xs italic leading-5 text-gray-500 dark:text-gray-400">
                  "{focusedMember.quote}"
                </p>
              )}
              <SocialLinks member={focusedMember} />
            </div>
          )}
        </div>

        {/* Reserva espacio real cuando hay alguien enfocado, para que el cuadro
            blanco crezca y la frase de la card flotante no quede recortada. */}
        <div
          aria-hidden="true"
          className="transition-all duration-300 ease-out"
          style={{ height: focusedId ? 110 : 0 }}
        />
      </div>
    </div>
  );
}
