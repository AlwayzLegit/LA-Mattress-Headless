import { cache } from 'react';
import { shopifyFetch } from '../client';
import type { Article, ArticleSummary, BlogWithArticles } from '../types';
import { IMAGE_FRAGMENT, SEO_FRAGMENT } from './fragments';

const ARTICLE_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment ArticleSummaryFields on Article {
    id
    handle
    title
    excerpt
    publishedAt
    image { ...ImageFields }
    authorV2 { name bio }
  }
`;

const GET_BLOG = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${SEO_FRAGMENT}
  ${ARTICLE_SUMMARY_FRAGMENT}
  query GetBlog($handle: String!, $first: Int!, $after: String) {
    blog(handle: $handle) {
      id
      handle
      title
      seo { ...SeoFields }
      articles(first: $first, after: $after, sortKey: PUBLISHED_AT, reverse: true) {
        nodes { ...ArticleSummaryFields }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

type RawBlog = {
  blog: (Omit<BlogWithArticles, 'articles'> & {
    articles: {
      nodes: (Omit<ArticleSummary, 'author'> & { authorV2: ArticleSummary['author'] })[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }) | null;
};

export async function getBlogByHandle(args: {
  handle: string;
  first?: number;
  after?: string | null;
}): Promise<BlogWithArticles | null> {
  const { handle, first = 24, after = null } = args;
  const data = await shopifyFetch<RawBlog>(
    GET_BLOG,
    { handle, first, after },
    { tags: [`blog:${handle}`] },
  );
  if (!data.blog) return null;
  return {
    ...data.blog,
    articles: {
      ...data.blog.articles,
      nodes: data.blog.articles.nodes.map((a) => {
        const { authorV2, ...rest } = a;
        return { ...rest, author: authorV2 };
      }),
    },
  };
}

const GET_ARTICLE = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${SEO_FRAGMENT}
  query GetArticle($blogHandle: String!, $articleHandle: String!) {
    blog(handle: $blogHandle) {
      handle
      title
      articleByHandle(handle: $articleHandle) {
        id
        handle
        title
        excerpt
        contentHtml
        content
        publishedAt
        tags
        image { ...ImageFields }
        authorV2 { name bio }
        seo { ...SeoFields }
      }
    }
  }
`;

type RawArticle = {
  blog: {
    handle: string;
    title: string;
    articleByHandle: (Omit<Article, 'author' | 'blog'> & { authorV2: Article['author'] }) | null;
  } | null;
};

// Memoized so the blogs/[blog]/[article] segment layout (JSON-LD) and
// the page's ArticleBody share a single Storefront request per render.
export const getArticleByHandle = cache(async (blogHandle: string, articleHandle: string): Promise<Article | null> => {
  const data = await shopifyFetch<RawArticle>(
    GET_ARTICLE,
    { blogHandle, articleHandle },
    { tags: [`article:${blogHandle}/${articleHandle}`] },
  );
  if (!data.blog?.articleByHandle) return null;
  const { authorV2, ...rest } = data.blog.articleByHandle;
  return {
    ...rest,
    author: authorV2,
    blog: { handle: data.blog.handle, title: data.blog.title },
  };
});
