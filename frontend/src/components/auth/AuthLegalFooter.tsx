import { Link, useLocation } from "react-router";

export default function AuthLegalFooter() {
  const location = useLocation();

  return (
    <div className="pt-4 pb-2 flex-col items-center gap-1 text-sm text-center text-gray-500 dark:text-gray-400 hidden lg:flex">
      <p>&copy; {new Date().getFullYear()} - TwentyNineDevs</p>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link
          to="/terminos"
          state={{ from: location.pathname }}
          className="whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300"
        >
          Términos y Condiciones
        </Link>
        <span aria-hidden="true">&middot;</span>
        <Link
          to="/privacidad"
          state={{ from: location.pathname }}
          className="whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300"
        >
          Política de Privacidad
        </Link>
      </div>
    </div>
  );
}
