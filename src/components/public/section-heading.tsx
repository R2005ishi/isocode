export function SectionHeading({
  title,
  subtitle,
  action,
  as: Tag = "h2",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <Tag className="display text-3xl font-semibold md:text-4xl">{title}</Tag>
        {subtitle && <p className="max-w-xl text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
