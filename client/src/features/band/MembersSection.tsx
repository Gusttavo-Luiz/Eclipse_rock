import type { BandMember } from "../../../../shared/types";
import { InstagramIcon } from "../../components/icons";
import { Img } from "../../components/Img";
import { instagramUrl } from "../../lib/links";

export function MembersSection({ members }: { members: BandMember[] }) {
  if (!members.length) return null;
  return (
    <section id="integrantes" aria-labelledby="integrantes-title" className="pb-24 sm:pb-32">
      <div className="container-page">
        <h2 id="integrantes-title" className="display mb-10 text-[clamp(2.25rem,6vw,4rem)] sm:mb-12">
          Integrantes
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {members.map((m) => (
            <li key={m.id}>
              <BandMemberCard member={m} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function initials(name: string) {
  return name
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

export function BandMemberCard({ member }: { member: BandMember }) {
  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-line bg-night transition-[border-color,box-shadow] duration-300 group-hover:border-violet/70 group-hover:shadow-[var(--shadow-glow)] group-focus-within:border-violet/70">
        {member.photo ? (
          <Img
            image={member.photo}
            alt={`Foto de ${member.name}`}
            sizes="(min-width: 1024px) 280px, 50vw"
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <div className="starfield flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgb(123_63_228/0.35),transparent_65%)]">
            <span className="display text-[clamp(3.5rem,10vw,6rem)] text-moon/80" aria-hidden>
              {initials(member.name)}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-abyss/90 to-transparent" />
      </div>
      <div className="mt-3">
        <h3 className="font-display text-2xl font-extrabold uppercase leading-tight sm:text-3xl">{member.name}</h3>
        {member.role && <p className="text-sm text-mist">{member.role}</p>}
        {member.instagram && (
          <a
            href={instagramUrl(member.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[40px] max-w-full items-center gap-1.5 text-sm text-violet-soft hover:text-magenta-soft"
            aria-label={`Instagram de ${member.name}: @${member.instagram} (abre em nova aba)`}
          >
            <InstagramIcon size={16} />
            <span className="truncate">@{member.instagram}</span>
          </a>
        )}
      </div>
    </article>
  );
}
