import { teamMembers } from "../../data/team";
import TeamAvatar from "./TeamAvatar";
import TeamGraphBackground from "./TeamGraphBackground";
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

export default function TeamModalContent() {
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

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
          {teamMembers.map((member, index) => (
            <div
              key={member.id}
              className="animate-team-fade-up flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-3 py-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/40 sm:px-4 sm:py-6"
              style={{ animationDelay: `${80 + index * 90}ms` }}
            >
              <div className="relative">
                <TeamAvatar
                  name={member.name}
                  photo={member.photo}
                  size={92}
                  className="ring-4 ring-gray-50 dark:ring-gray-900"
                />
                {member.isLead && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-theme-xs">
                    Lead
                  </span>
                )}
              </div>
              <h6 className="mt-4 text-sm font-semibold text-gray-800 dark:text-white/90 sm:text-base">
                {member.name}
              </h6>
              <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
              <SocialLinks member={member} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
