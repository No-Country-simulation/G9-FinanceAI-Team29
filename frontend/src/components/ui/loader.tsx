interface LoaderProps {
  size?: "sm" | "md" | "lg"
  text?: string
  fullScreen?: boolean
}

export default function Loader({
  size = "md",
  text,
  fullScreen = false,
}: LoaderProps) {
  const sizes = {
    sm: "size-4 border-2",
    md: "size-8 border-4",
    lg: "size-12 border-4",
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={[
          "animate-spin rounded-full border-blue-500 border-t-transparent",
          sizes[size],
        ].join(" ")}
      />

      {text && <p className="text-sm text-slate-400">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  return content
}