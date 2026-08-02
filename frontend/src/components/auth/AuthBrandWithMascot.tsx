import { Link } from "react-router";

export default function AuthBrandWithMascot() {
  return (
    <div className="flex items-center">
      <Link to="/" className="relative z-10 inline-block shrink-0">
        <img
          width={231}
          height={60}
          src="/images/logo/logo.png"
          alt="FinSightAI"
          className="h-auto w-[190px] object-contain dark:hidden sm:w-[231px]"
        />
        <img
          width={231}
          height={60}
          src="/images/logo/logo_white.png"
          alt="FinSightAI"
          className="hidden h-auto w-[190px] object-contain dark:block sm:w-[231px]"
        />
      </Link>
      <img
        src="/images/mascot/finsight-bird-auth-lean-light-compact.png"
        alt="Finsi acompañándote"
        className="relative z-20 ml-1 h-24 w-auto shrink-0 object-contain drop-shadow-lg dark:hidden sm:h-28"
      />
      <img
        src="/images/mascot/finsight-bird-auth-lean-dark-compact.png"
        alt="Finsi acompañándote"
        className="relative z-20 ml-1 hidden h-24 w-auto shrink-0 object-contain drop-shadow-lg dark:block sm:h-28"
      />
    </div>
  );
}
