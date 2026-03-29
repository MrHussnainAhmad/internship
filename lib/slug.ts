import slugify from "slugify";

export function createInternshipSlug(title: string, location: string) {
  return slugify(`${title}-${location}`.trim(), {
    lower: true,
    strict: true,
    trim: true,
  });
}
