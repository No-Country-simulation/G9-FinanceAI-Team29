export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo: string;
  quote?: string;
  linkedin?: string;
  github?: string;
  isLead?: boolean;
  country?: string;
  countryFlag?: string;
  location?: string;
}

// Fotos: colocar el original en frontend/team-photos-raw/ y correr `npm run team-photos`
// (genera automáticamente el .webp recortado y liviano en public/team/).
export const teamMembers: TeamMember[] = [
  {
    id: "guillermo-illanes",
    name: "Guillermo Illanes",
    role: "Team Lead · Full Stack Developer",
    photo: "/team/guillermo-illanes.webp",
    quote: "Cuando sale algo es bons, pero cuando no sale nada es gg nomás.",
    linkedin: "https://www.linkedin.com/in/guillermo-illanes-172aaa229/",
    github: "https://github.com/guille2506",
    isLead: true,
    country: "Argentina",
    countryFlag:
      "https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/1024px/1f1e6-1f1f7.png",
    location: "San Juan, Provincia de San Juan",
  },
  {
    id: "edgardo-villalba",
    name: "Edgardo Villalba",
    role: "Full Stack Developer · AI Developer · Data Scientist",
    photo: "/team/edgardo-villalba.webp",
    quote:
      "Full Stack Developer, IA, React, Python y FastAPI. Disfruto resolver problemas, trabajar en equipo y desarrollar productos con impacto real.",
    linkedin: "https://www.linkedin.com/in/edgardo-villalba/",
    github: "https://github.com/Linth84",
    country: "Argentina",
    countryFlag:
      "https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/1024px/1f1e6-1f1f7.png",
    location: "Buenos Aires, Capital",
  },
  {
    id: "felipe-pereira-alarcon",
    name: "Felipe Pereira Alarcón",
    role: "Full Stack Developer · Frontend Developer · Data Scientist",
    photo: "/team/felipe-pereira.webp",
    quote:
      "Ingeniero por profesión, buena persona gracias a mi madre. M.Sc. e Ing. Civil Informático especializado en IA, Ciencia de Datos y Optimización Combinatoria.",
    linkedin: "https://www.linkedin.com/in/felipe-pereira-alarcon/",
    github: "https://github.com/fpereira22",
    country: "Chile",
    countryFlag:
      "https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/1024px/1f1e8-1f1f1.png",
    location: "Santiago de Chile, Región Metropolitana",
  },
  {
    id: "karen-dominguez",
    name: "Karen Domínguez",
    role: "Data Analyst · QA Tester",
    photo: "/team/karen-dominguez.webp",
    linkedin: "https://www.linkedin.com/in/karen-domínguez-0897bb295",
    github: "https://github.com/Karen314",
    country: "Colombia",
    countryFlag:
      "https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/1024px/1f1e8-1f1f4.png",
    location: "Bogotá, Colombia",
  },
  {
    id: "raul-vidaurre",
    name: "Raúl Enrique Vidaurre Vallejos",
    role: "Data Analyst · Backend · QA Tester",
    photo: "/team/raul-vidaurre.webp",
    quote:
      "Técnico en Computación e Informática que recién inicia en el mundo del Backend Developer. Apasionado por el aprendizaje continuo en programación, IA y diseño digital.",
    github: "https://github.com/Raul-V2",
    country: "Perú",
    countryFlag:
      "https://em-content.zobj.net/source/google/439/flag-peru_1f1f5-1f1ea.png",
    location: "Lima, Perú",
  },
];
