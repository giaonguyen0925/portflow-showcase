import { Inter, Manrope, Space_Grotesk } from "next/font/google";

import type { SiteFont } from "@/modules/site/domain/site-document";

/**
 * Static mapping for the three fonts the site document can pick from
 * (ARD §2.1). next/font requires each font to be a module-scope constant.
 */

const inter = Inter({ subsets: ["latin", "vietnamese"], preload: false });
const manrope = Manrope({ subsets: ["latin", "vietnamese"], preload: false });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  preload: false,
});

const FONT_CLASS_NAMES: Record<SiteFont, string> = {
  inter: inter.className,
  manrope: manrope.className,
  "space-grotesk": spaceGrotesk.className,
};

export function siteFontClassName(font: SiteFont): string {
  return FONT_CLASS_NAMES[font];
}
