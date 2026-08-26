export type BlogPostSource = "static" | "admin";

export type BlogAffiliateLink = {
  label: string;
  goCode: string;
  merchant?: string;
  note?: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  body: string;
  affiliateLinks: BlogAffiliateLink[];
  publishedAt: string;
  updatedAt?: string;
  published: boolean;
  source: BlogPostSource;
};

export type BlogPostInput = Omit<BlogPost, "source" | "updatedAt" | "affiliateLinks"> & {
  affiliateLinks?: BlogAffiliateLink[];
  affiliateLinkLines?: string;
};

