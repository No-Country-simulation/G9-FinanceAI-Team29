interface Sponsor {
  name: string;
  logo: string;
}

const one: Sponsor = {
  name: "Oracle Next Education (ONE)",
  logo: "https://aprende.goodneighbors.cl/wp-content/uploads/2022/02/ONE_logo_rgb-768x408.png",
};

const alura: Sponsor = {
  name: "Alura",
  logo: "https://www.aluracursos.com/favicon.ico?favicon.13d5bcvsvnm6t.ico",
};

const oracle: Sponsor = {
  name: "Oracle",
  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Oracle_logo.svg/3840px-Oracle_logo.svg.png",
};

const noCountry: Sponsor = {
  name: "No Country",
  logo: "https://nocountry.tech/nocountry-logo.png",
};

type MarqueeItem =
  // ONE y Alura van juntos con un separador "|": son el mismo programa
  // (Oracle Next Education, dictado con Alura), no dos auspiciantes sueltos.
  | { kind: "pair"; left: Sponsor; right: Sponsor }
  | { kind: "single"; sponsor: Sponsor };

const sponsorSet: MarqueeItem[] = [
  { kind: "pair", left: one, right: alura },
  { kind: "single", sponsor: oracle },
  { kind: "single", sponsor: noCountry },
];

// Se repite el set varias veces (no solo x2): la animación recorre -50% del
// ancho total, y ese medio recorrido debe ser más ancho que el contenedor
// visible para que nunca se agote el contenido y quede un hueco antes de
// reiniciar el loop. Con 6 copias, medio recorrido = 3 sets (~2000px+),
// más que suficiente para el modal más ancho (~1040px).
const loopedSet = Array.from({ length: 6 }, () => sponsorSet).flat();

export default function SponsorsMarquee() {
  return (
    <div className="mt-6 w-full rounded-2xl bg-gray-50 py-5 ring-1 ring-gray-200/70 dark:bg-white/[0.04] dark:ring-white/10">
      <div
        className="relative w-full overflow-hidden px-4 sm:px-6"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        }}
      >
        <div className="animate-sponsors-marquee flex w-max items-center gap-10 sm:gap-14">
          {loopedSet.map((item, index) =>
            item.kind === "pair" ? (
              <div
                key={`pair-${index}`}
                className="flex shrink-0 items-center gap-4 sm:gap-5"
              >
                <img
                  src={item.left.logo}
                  alt={item.left.name}
                  title={item.left.name}
                  className="h-8 w-auto object-contain sm:h-10"
                />
                <span
                  aria-hidden="true"
                  className="h-6 w-px shrink-0 bg-gray-300 dark:bg-white/20 sm:h-8"
                />
                <img
                  src={item.right.logo}
                  alt={item.right.name}
                  title={item.right.name}
                  className="h-7 w-7 shrink-0 rounded-md object-contain sm:h-8 sm:w-8"
                />
              </div>
            ) : (
              <img
                key={`single-${index}`}
                src={item.sponsor.logo}
                alt={item.sponsor.name}
                title={item.sponsor.name}
                className="h-8 w-auto shrink-0 object-contain sm:h-10"
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
