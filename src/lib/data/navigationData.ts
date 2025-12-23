const navItems = {
  public: [
    { href: "/konzerte", label: "Konzerte" },
    { href: "/ueber-uns", label: "Über uns" },
    { href: "/gallerie", label: "Gallerie" },
    { href: "/kontakt", label: "Kontakt" },
  ],
  private: [
    { href: "/intern/home", label: "Dash Home" },
    { href: "/intern/concerts", label: "Konzerte" },
    { href: "/intern/venues", label: "Veranstaltungsorte" },
    { href: "/intern/songs", label: "Songs" },
    { href: "/intern/gallery", label: "Galerie" },
    { href: "/intern/users", label: "Benutzer", requiresAdmin: true },
  ],
} as {
  public: NavItem[];
  private: NavItem[];
};

function getItemsForPath(pathname: string): NavItem[] {
  if (pathname === "/intern/login" || pathname === "/intern/signup") return [];
  if (pathname.startsWith("/intern")) return navItems.private;
  return navItems.public;
}

export { getItemsForPath, navItems };
