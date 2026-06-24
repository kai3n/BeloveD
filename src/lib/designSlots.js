export const DESIGN_CATEGORIES = [
  {
    key: "ring",
    label: "Rings",
    shortLabel: "Ring",
    intro: "Engagement rings, solitaire settings, bands, and statement center-stone pieces.",
    target: 4,
    price: "$1,900+",
    media: [
      { kind: "image", src: "/assets/lineup-ring.png" },
      { kind: "image", src: "/assets/lineup-band.png" },
      { kind: "video", src: "/assets/freestyle-trump.mp4" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
    ],
    names: ["Solitaire Ring", "Eternity Band", "Hidden Halo Ring", "Three-Stone Ring"],
  },
  {
    key: "earrings",
    label: "Earrings",
    shortLabel: "Earrings",
    intro: "Studs, drops, halos, and refined everyday diamond silhouettes.",
    target: 4,
    price: "$1,200+",
    media: [
      { kind: "image", src: "/assets/lineup-studs.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-studs.png" },
    ],
    names: ["Classic Studs", "Halo Studs", "Drop Earrings", "Bezel Studs"],
  },
  {
    key: "bangle",
    label: "Bracelets",
    shortLabel: "Bracelet",
    intro: "Tennis bracelets, bangles, and custom wrist pieces with calibrated stones.",
    target: 4,
    price: "$2,400+",
    media: [
      { kind: "image", src: "/assets/lineup-bracelet.png" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-bracelet.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
    ],
    names: ["Tennis Bracelet", "Diamond Bangle", "Half Tennis Bracelet", "Bezel Bracelet"],
  },
  {
    key: "necklace",
    label: "Necklaces",
    shortLabel: "Necklace",
    intro: "Pendants and chain-led pieces designed around a single stone or matched layout.",
    target: 4,
    price: "$1,500+",
    media: [
      { kind: "image", src: "/assets/lineup-pendant.png" },
      { kind: "image", src: "/assets/lab-diamond-tweezers.webp" },
      { kind: "video", src: "/assets/diamond-noir-white.mp4" },
      { kind: "image", src: "/assets/lineup-pendant.png" },
    ],
    names: ["Solitaire Pendant", "Bezel Pendant", "Floating Diamond Necklace", "Station Necklace"],
  },
];

export function categoryMeta(categoryKey) {
  return DESIGN_CATEGORIES.find((category) => category.key === categoryKey);
}

export function designCategoryCards(styles, category, locale, pickI18n) {
  const realStyles = styles.filter((style) => style.category === category.key).slice(0, 5);
  const cards = realStyles.map((style, index) => {
    const isVideo = style.coverImage?.endsWith(".mp4");
    return {
      id: style.id,
      category: category.key,
      code: style.id,
      title: pickI18n(style.name, locale),
      media: { kind: isVideo ? "video" : "image", src: style.coverImage },
      price: category.price,
      lead: `${style.leadDays} days`,
      href: `/designs/${style.id}`,
      ctaHref: `/custom/new?style=${style.id}`,
      state: "published",
      mediaLabel: index === 0 ? "Hero sample" : "Sample media",
    };
  });

  while (cards.length < category.target) {
    const index = cards.length;
    cards.push({
      id: `${category.key}-slot-${index + 1}`,
      category: category.key,
      code: `${category.key.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      title: category.names[index] || `${category.shortLabel} design`,
      media: category.media[index % category.media.length],
      price: category.price,
      lead: "Media slot ready",
      href: "",
      ctaHref: "",
      state: "slot",
      mediaLabel: "Photo / video slot",
    });
  }

  return cards.slice(0, 5);
}
