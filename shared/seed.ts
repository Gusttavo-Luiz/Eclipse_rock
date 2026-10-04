/**
 * Conteúdo inicial CONFIRMADO (metadados do site de referência + perfis informados no briefing).
 * Nada de eventos, números, instrumentos ou contatos inventados.
 * Usado pela migração 002 e pela versão de demonstração estática (GitHub Pages).
 */
export const SEED_SETTINGS = {
  bandName: "Eclipse Rock",
  tagline: "Rock 2000s • Pop Punk • Emo",
  heroText:
    "Rock 2000s, Pop Punk, Emo e tributo à Pitty. Confira os próximos shows e venha cantar com a gente.",
  aboutText: [
    "A Eclipse Rock é uma banda dedicada ao rock dos anos 2000. O repertório passa pelo pop punk, pelo emo e pelos clássicos do rock alternativo que marcaram a era da MTV — e inclui um tributo à Pitty.",
    "A proposta é transformar cada show em um grande coro: as músicas que tanta gente cantou no quarto, no fone de ouvido e na pista, tocadas ao vivo com a energia que elas pedem.",
    "Se essas faixas fizeram parte da sua história, o convite está feito: venha cantar com a gente.",
  ].join("\n\n"),
  instagram: "eclipserockoficial",
  youtubeUrl: null,
  spotifyUrl: null,
  tiktokUrl: null,
  facebookUrl: null,
  whatsapp: null,
  whatsappMessage: "Olá, Eclipse Rock! Gostaria de saber mais sobre a contratação da banda para um evento.",
  contactEmail: null,
  privacyEmail: null,
  logoId: null,
  heroImageId: null,
  aboutImageId: null,
  ogImageId: null,
  seoTitle: "Eclipse Rock | Rock 2000s • Pop Punk • Emo",
  seoDescription:
    "Eclipse Rock — Rock 2000s, Pop Punk, Emo e tributo à Pitty. Confira os próximos shows e venha cantar com a gente.",
  siteUrl: "https://eclipserock.com.br",
};

/** photo: arquivo em server/seed/members/ (fotos enviadas pela banda, já recortadas em 4:5). */
export const SEED_MEMBERS: { name: string; instagram: string; monogram: string | null; photo: string | null }[] = [
  { name: "Isabella", instagram: "itsbellaland", monogram: null, photo: "isabella.webp" },
  { name: "Mauro", instagram: "mam.filho", monogram: "MA", photo: "mauro.webp" },
  { name: "Mamute", instagram: "mamute.ferreira", monogram: "MM", photo: "mamute.webp" },
  { name: "Rodrigo", instagram: "rodrigodi", monogram: null, photo: "rodrigo.webp" },
];

/** Fotos da galeria enviadas pela banda (arquivos em server/seed/gallery/), na ordem de exibição. */
export const SEED_GALLERY: { file: string; alt: string; category: string }[] = [
  { file: "isabella-palco.webp", alt: "Isabella sorrindo ao microfone no palco", category: "Ao vivo" },
  { file: "mauro-guitarra.webp", alt: "Mauro tocando guitarra no palco, em preto e branco", category: "Ao vivo" },
  { file: "rodrigo-bateria.webp", alt: "Rodrigo na bateria sob luz vermelha", category: "Ao vivo" },
  { file: "mamute-baixo.webp", alt: "Mamute com o baixo no palco", category: "Ao vivo" },
  {
    file: "banda.webp",
    alt: "Mamute, Mauro, Isabella e Rodrigo reunidos em um sofá diante de uma janela em arco",
    category: "Banda",
  },
];

/** Foto da seção "A banda" (um dos arquivos de SEED_GALLERY). */
export const SEED_ABOUT_PHOTO = "banda.webp";
