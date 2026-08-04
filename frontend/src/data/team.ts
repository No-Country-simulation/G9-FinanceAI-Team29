export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo: string;
  linkedin?: string;
  github?: string;
  isLead?: boolean;
}

// Fotos: colocar el original en frontend/team-photos-raw/ y correr `npm run team-photos`
// (genera automáticamente el .webp recortado y liviano en public/team/).
export const teamMembers: TeamMember[] = [
  {
    id: "guillermo-illanes",
    name: "Guillermo Illanes",
    role: "Team Lead · Full Stack Developer",
    photo: "/team/guillermo-illanes.webp",
    linkedin: "https://www.linkedin.com/in/guillermo-illanes-172aaa229/",
    github: "https://github.com/guille2506",
    isLead: true,
  },
  {
    id: "edgardo-villalba",
    name: "Edgardo Villalba",
    role: "Full Stack Developer · AI Developer · Data Scientist",
    photo: "/team/edgardo-villalba.png",
    linkedin: "https://www.linkedin.com/in/edgardo-villalba/",
    github: "https://github.com/Linth84",
  },
  {
    id: "felipe-pereira-alarcon",
    name: "Felipe Pereira Alarcón",
    role: "Full Stack Developer · Frontend Developer · Data Scientist",
    photo: "/team/felipe-pereira.webp",
    linkedin: "https://www.linkedin.com/in/felipe-pereira-alarcon/",
    github: "https://github.com/fpereira22",
  },
  {
    id: "karen-dominguez",
    name: "Karen Domínguez",
    role: "Data Analyst · QA Tester",
    photo: "/team/karen-dominguez.webp",
    linkedin: "https://www.linkedin.com/in/karen-domínguez-0897bb295",
    github: "https://github.com/Karen314",
  },
  {
    id: "raul-vidaurre",
    name: "Raúl Enrique Vidaurre Vallejos",
    role: "Data Analyst · Backend · QA Tester",
    photo: "/team/raul-vidaurre.png",
    github: "https://github.com/Raul-V2",
  },
];
