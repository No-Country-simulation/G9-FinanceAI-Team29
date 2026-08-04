import { useLocation, useNavigate } from "react-router";
import { ChevronLeftIcon } from "../../icons";
import PageMeta from "../../components/common/PageMeta";
import TeamCredit from "../../components/team/TeamCredit";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  ultimaActualizacion: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({
  title,
  description,
  ultimaActualizacion,
  children,
}: LegalPageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const origen = (location.state as { from?: string } | null)?.from;

  function volver() {
    if (origen) {
      navigate(origen);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  return (
    <>
      <PageMeta title={`${title} - FinSightAI`} description={description} />

      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16">
          <button
            type="button"
            onClick={volver}
            className="mb-8 inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ChevronLeftIcon className="size-5" />
            Volver
          </button>

          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            {title}
          </h1>

          <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
            Última actualización: {ultimaActualizacion}
          </p>

          <div className="legal-content space-y-8 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base [&_h2]:mb-3 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:dark:text-white/90 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-gray-800 [&_strong]:dark:text-white/90 [&_a]:text-brand-500 [&_a]:hover:text-brand-600">
            {children}
          </div>

          <p className="mt-12 border-t border-gray-100 pt-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            &copy; {new Date().getFullYear()} FinSightAI — <TeamCredit />
          </p>
        </div>
      </div>
    </>
  );
}
