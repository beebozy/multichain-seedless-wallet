"use client";

type Variant = "error" | "success" | "info";

type Props = {
  title: string;
  message: string;
  variant?: Variant;
};

const glyphByVariant: Record<Variant, string> = {
  error: "!",
  success: "✓",
  info: "i"
};

export function InlineNotice({ title, message, variant = "info" }: Props) {
  return (
    <section className={`inline-notice inline-notice-${variant}`} role={variant === "error" ? "alert" : "status"}>
      <span className="inline-notice-glyph" aria-hidden="true">
        {glyphByVariant[variant]}
      </span>
      <div>
        <p className="inline-notice-title">{title}</p>
        <p className="inline-notice-message">{message}</p>
      </div>
    </section>
  );
}
