import Link from "next/link";

type Props = {
  websiteUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
};

function IconLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{icon}</span>
    </Link>
  );
}

export function SocialIconLinks(props: Props) {
  const links = [
    props.websiteUrl ? { href: props.websiteUrl, label: "Website", icon: "🌐" } : null,
    props.linkedinUrl ? { href: props.linkedinUrl, label: "LinkedIn", icon: "in" } : null,
    props.twitterUrl ? { href: props.twitterUrl, label: "Twitter", icon: "𝕏" } : null,
    props.instagramUrl ? { href: props.instagramUrl, label: "Instagram", icon: "◎" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: string }>;

  if (links.length === 0) {
    return <span className="text-slate-500">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((item) => (
        <IconLink key={item.label} href={item.href} label={item.label} icon={item.icon} />
      ))}
    </div>
  );
}