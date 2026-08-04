import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import TeamCredit from "../../components/team/TeamCredit";

export default function NotFound() {
  return (
    <>
      <PageMeta
        title="Página no encontrada - 404"
        description="La página que buscas no existe o fue movida."
      />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
        <GridShape />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 text-center sm:gap-6 md:flex-row md:text-left">
          <img
            src="/images/mascot/finsight-bird-404.png"
            alt="Finsi buscando la página perdida"
            className="h-64 w-auto object-contain drop-shadow-xl sm:h-80 md:h-[28rem]"
          />
          <div className="max-w-md">
            <h1 className="font-bold text-brand-500 text-title-2xl sm:text-title-3xl">
              404
            </h1>
            <h2 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Esta página se nos perdió
            </h2>

            <p className="mt-3 mb-6 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
              Finsi la buscó por todas partes, pero parece que no existe o fue movida.
            </p>

            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
        {/* <!-- Footer --> */}
        <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
          &copy; {new Date().getFullYear()} - <TeamCredit />
        </p>
      </div>
    </>
  );
}
