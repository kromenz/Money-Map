"use client";

/*
  Os dois logos vao inline: a lucide v1 deixou de exportar icones de marca, e o
  G da Google tem quatro cores fixas que um icone monocromatico perderia.
*/
function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.55v-2.13c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.21.66.8.55A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.16a6.9 6.9 0 0 1 0-4.32V6.86H1.71a11.5 11.5 0 0 0 0 10.28l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.09c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.63 15.11.5 12 .5A11.5 11.5 0 0 0 1.71 6.86l3.84 2.98C6.46 7.11 9 5.09 12 5.09Z"
      />
    </svg>
  );
}

function SocialButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}

export function SocialButtons({
  onGithub,
  onGoogle,
}: {
  onGithub: () => void;
  /* Ainda nao ha rota de OAuth da Google no backend, por isso fica desativado. */
  onGoogle?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <SocialButton
        label={
          onGoogle ? "Continue with Google" : "Google sign-in is not available yet"
        }
        onClick={onGoogle}
        disabled={!onGoogle}>
        <GoogleMark className="size-4" />
        <span>Google</span>
      </SocialButton>

      <SocialButton label="Continue with GitHub" onClick={onGithub}>
        <GithubMark className="size-4" />
        <span>GitHub</span>
      </SocialButton>
    </div>
  );
}
