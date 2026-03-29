const KNOWN_LOCATIONS = [
  "lahore",
  "karachi",
  "islamabad",
  "rawalpindi",
  "faisalabad",
  "multan",
  "peshawar",
  "quetta",
  "pakistan",
];

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const TYPES = ["paid", "unpaid", "learn_and_earn"] as const;

export type InternshipLevel = (typeof LEVELS)[number];
export type InternshipType = (typeof TYPES)[number];

export type ParsedSearch = {
  skillTerms: string[];
  locationTerms: string[];
  level?: InternshipLevel;
  type?: InternshipType;
};

export function parseSearchKeywords(rawQuery: string): ParsedSearch {
  const clean = rawQuery.toLowerCase().trim();
  const tokens = clean.split(/\s+/).filter(Boolean);

  const locationTerms: string[] = [];
  const skillTerms: string[] = [];
  let level: InternshipLevel | undefined;
  let type: InternshipType | undefined;

  for (const token of tokens) {
    if (token === "internship" || token === "internships") continue;
    if ((LEVELS as readonly string[]).includes(token)) {
      level = token as InternshipLevel;
      continue;
    }
    if ((TYPES as readonly string[]).includes(token)) {
      type = token as InternshipType;
      continue;
    }
    if (KNOWN_LOCATIONS.includes(token)) {
      locationTerms.push(token);
      continue;
    }
    if (token === "js") {
      skillTerms.push("javascript");
      continue;
    }
    if (token === "ts") {
      skillTerms.push("typescript");
      continue;
    }
    skillTerms.push(token);
  }

  return { skillTerms, locationTerms, level, type };
}
